// src/hooks/useOfflineMutationQueue.js
// File d'attente de mutations hors-ligne avec replay automatique au retour en ligne

import { useState, useEffect, useCallback, useRef } from 'react';
import logger from '../utils/logger';

const DB_NAME = 'srp-offline-mutations';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;

/**
 * Ouvre (ou crée) la base IndexedDB pour les mutations offline
 */
function openMutationDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('type', 'type', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Ajoute une mutation à la file d'attente IndexedDB
 */
async function enqueueMutation(mutation) {
    const db = await openMutationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const entry = {
            ...mutation,
            timestamp: Date.now(),
            status: 'pending',
        };
        const request = store.add(entry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Récupère toutes les mutations en attente, triées par timestamp
 */
async function getPendingMutations() {
    const db = await openMutationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const request = index.getAll();
        request.onsuccess = () => {
            const all = request.result.filter((m) => m.status === 'pending');
            resolve(all);
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Supprime une mutation de la file après replay réussi
 */
async function removeMutation(id) {
    const db = await openMutationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

const MAX_RETRIES = 3;

/**
 * Incrémente retryCount. Passe en 'failed' seulement après MAX_RETRIES tentatives.
 */
async function markMutationRetryOrFailed(id, error) {
    const db = await openMutationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const entry = getReq.result;
            if (entry) {
                const retryCount = (entry.retryCount || 0) + 1;
                entry.retryCount = retryCount;
                entry.lastError = String(error);
                entry.lastFailedAt = Date.now();
                if (retryCount >= MAX_RETRIES) {
                    entry.status = 'failed';
                    entry.failedAt = Date.now();
                }
                // Sinon on garde status = 'pending' pour rejouer au prochain online
                store.put(entry);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Vide toutes les mutations (pour reset)
 */
async function clearAllMutations() {
    const db = await openMutationDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    });
}

/**
 * Registry de handlers de mutation par type.
 * Les composants enregistrent des handlers pour chaque type de mutation
 * afin que le replay sache comment exécuter chaque opération.
 */
const mutationHandlers = {};

export function registerMutationHandler(type, handler) {
    mutationHandlers[type] = handler;
}

/**
 * Hook principal : file d'attente de mutations offline
 *
 * Usage :
 *   const { queueMutation, pendingCount, isReplaying } = useOfflineMutationQueue();
 *
 *   // Au lieu d'appeler directement le service:
 *   if (!navigator.onLine) {
 *       queueMutation({ type: 'updateIntervention', payload: { id, updates } });
 *   }
 */
export function useOfflineMutationQueue() {
    const [pendingCount, setPendingCount] = useState(0);
    const [isReplaying, setIsReplaying] = useState(false);
    const replayingRef = useRef(false);

    // Compte les mutations en attente
    const refreshCount = useCallback(async () => {
        try {
            const pending = await getPendingMutations();
            setPendingCount(pending.length);
        } catch (err) {
            logger.error('Erreur comptage mutations offline:', err);
        }
    }, []);

    // Met en file d'attente une mutation
    const queueMutation = useCallback(
        async (mutation) => {
            try {
                await enqueueMutation(mutation);
                logger.log(`📦 Mutation mise en file: ${mutation.type}`);
                await refreshCount();
            } catch (err) {
                logger.error('Erreur mise en file mutation:', err);
            }
        },
        [refreshCount]
    );

    // Rejoue toutes les mutations en attente
    const replayMutations = useCallback(async () => {
        if (replayingRef.current) return;
        replayingRef.current = true;
        setIsReplaying(true);

        try {
            const pending = await getPendingMutations();
            if (pending.length === 0) return;

            logger.log(`🔄 Replay de ${pending.length} mutation(s) en attente...`);

            for (const mutation of pending) {
                const handler = mutationHandlers[mutation.type];
                if (!handler) {
                    logger.warn(`Pas de handler pour mutation type: ${mutation.type}`);
                    await markMutationFailed(mutation.id, 'No handler registered');
                    continue;
                }

                try {
                    await handler(mutation.payload);
                    await removeMutation(mutation.id);
                    logger.log(`✅ Mutation rejouée: ${mutation.type}`);
                } catch (err) {
                    logger.error(`❌ Échec replay mutation ${mutation.type}:`, err);
                    await markMutationRetryOrFailed(mutation.id, err.message || err);
                }
            }
        } catch (err) {
            logger.error('Erreur replay mutations:', err);
        } finally {
            replayingRef.current = false;
            setIsReplaying(false);
            await refreshCount();
        }
    }, [refreshCount]);

    // Écouter le retour en ligne pour replay automatique
    useEffect(() => {
        refreshCount();

        const handleOnline = async () => {
            logger.log('📶 Retour en ligne — démarrage replay mutations...');
            // Attendre 2s pour stabiliser la connexion
            await new Promise((r) => setTimeout(r, 2000));
            if (navigator.onLine) {
                await replayMutations();
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [refreshCount, replayMutations]);

    return {
        queueMutation,
        pendingCount,
        isReplaying,
        replayMutations,
        clearQueue: clearAllMutations,
        refreshCount,
    };
}

export default useOfflineMutationQueue;
