/**
 * Hook React pour détecter le statut de connexion internet
 * Compatible iOS Safari et Android Chrome
 * Inclut la gestion de la queue de synchronisation offline
 *
 * @returns {boolean|object} - true si en ligne, false si hors ligne (ou objet complet avec useOnlineStatusFull)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import logger from '../utils/logger';
import { syncPendingOperations, getPendingCount, addSyncListener } from '../utils/syncService';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  useEffect(() => {
    function handleOnline() {
      logger.log('📶 Connexion rétablie');
      setIsOnline(true);
    }

    function handleOffline() {
      logger.log('📵 Connexion perdue');
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérification périodique (utile sur mobile)
    const checkInterval = setInterval(() => {
      const currentStatus = navigator.onLine;
      if (currentStatus !== isOnlineRef.current) {
        setIsOnline(currentStatus);
        logger.log(`📡 Statut connexion mis à jour: ${currentStatus ? 'en ligne' : 'hors ligne'}`);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkInterval);
    };
  }, []);

  return isOnline;
}

/**
 * Hook complet avec gestion de la synchronisation offline
 * @returns {object} - { isOnline, isSyncing, pendingCount, forceSync, hasPendingChanges }
 */
export function useOnlineStatusFull() {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // Mettre à jour le compteur d'opérations en attente
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (e) {
      // Silently fail if IndexedDB not available
    }
  }, []);

  // Forcer une synchronisation
  const forceSync = useCallback(async () => {
    if (!isOnline || isSyncing) return { synced: 0, failed: 0 };
    setIsSyncing(true);
    try {
      const result = await syncPendingOperations();
      setLastSyncResult(result);
      await updatePendingCount();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCount]);

  useEffect(() => {
    // Écouter les événements de sync
    const unsubscribe = addSyncListener((event) => {
      if (event.type === 'SYNC_START') {
        setIsSyncing(true);
      } else if (event.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        setLastSyncResult({ synced: event.synced, failed: event.failed });
        updatePendingCount();
      } else if (event.type === 'QUEUED') {
        updatePendingCount();
      }
    });

    // Charger le compteur initial
    updatePendingCount();

    return () => {
      unsubscribe();
    };
  }, [updatePendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncResult,
    forceSync,
    hasPendingChanges: pendingCount > 0
  };
}

/**
 * Hook pour détecter quand on passe de online à offline et vice-versa
 *
 * @param {Function} onOnline - Callback quand on revient en ligne
 * @param {Function} onOffline - Callback quand on passe hors ligne
 */
export function useOnlineStatusChange(onOnline, onOffline) {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline && onOnline) {
      onOnline();
    } else if (!isOnline && onOffline) {
      onOffline();
    }
  }, [isOnline, onOnline, onOffline]);

  return isOnline;
}

/**
 * Hook pour afficher une notification quand le statut change
 *
 * @param {Function} showToast - Fonction pour afficher une notification
 * @returns {boolean} - Statut de connexion
 */
export function useOnlineStatusWithToast(showToast) {
  const isOnline = useOnlineStatus();
  const [wasOnline, setWasOnline] = useState(isOnline);

  useEffect(() => {
    // Détecter les changements de statut
    if (isOnline !== wasOnline) {
      if (isOnline) {
        if (showToast) {
          showToast('Connexion rétablie ! 📶', 'success');
        }
      } else {
        if (showToast) {
          showToast('Mode hors ligne - Fonctionnalités limitées 📵', 'warning');
        }
      }
      setWasOnline(isOnline);
    }
  }, [isOnline, wasOnline, showToast]);

  return isOnline;
}
