// src/utils/syncService.js
// Service de synchronisation pour le mode hors ligne

import { supabase } from '../lib/supabaseClient';
import {
  addToSyncQueue,
  getPendingSyncOperations,
  removeSyncOperation,
  saveToStore,
  STORES_ENUM
} from './offlineStorage';
import logger from './logger';

// Types d'opérations supportées
export const SYNC_OPERATION_TYPES = {
  CREATE_EXPENSE: 'CREATE_EXPENSE',
  UPDATE_EXPENSE: 'UPDATE_EXPENSE',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
  CREATE_INTERVENTION: 'CREATE_INTERVENTION',
  UPDATE_INTERVENTION: 'UPDATE_INTERVENTION',
  CREATE_LEAVE_REQUEST: 'CREATE_LEAVE_REQUEST',
  UPDATE_CHECKLIST: 'UPDATE_CHECKLIST'
};

// État de la synchronisation
let isSyncing = false;
let syncListeners = [];

/**
 * Ajoute un listener pour les événements de sync
 */
export const addSyncListener = (callback) => {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter(cb => cb !== callback);
  };
};

/**
 * Notifie tous les listeners
 */
const notifySyncListeners = (event) => {
  syncListeners.forEach(cb => cb(event));
};

/**
 * Queue une opération pour synchronisation ultérieure
 */
export const queueOperation = async (type, payload) => {
  const operation = {
    type,
    payload,
    timestamp: Date.now()
  };

  await addToSyncQueue(operation);
  notifySyncListeners({ type: 'QUEUED', operation });

  logger.log('[SyncService] Opération en queue:', type);
  return operation;
};

/**
 * Exécute une opération de sync
 */
const executeOperation = async (operation) => {
  const { type, payload } = operation;

  switch (type) {
    case SYNC_OPERATION_TYPES.CREATE_EXPENSE:
      return await supabase.from('expenses').insert([payload]).select().single();

    case SYNC_OPERATION_TYPES.UPDATE_EXPENSE:
      return await supabase
        .from('expenses')
        .update(payload.updates)
        .eq('id', payload.id)
        .select()
        .single();

    case SYNC_OPERATION_TYPES.DELETE_EXPENSE: {
      let query = supabase.from('expenses').delete().eq('id', payload.id);
      // Suppression employé mise en queue hors-ligne : ré-applique les mêmes
      // gardes que le chemin en ligne (propriétaire + encore en attente), pour
      // ne pas supprimer une note approuvée entre-temps par un admin.
      if (payload.userId) {
        query = query.eq('user_id', payload.userId).eq('status', 'pending');
      }
      return await query;
    }

    case SYNC_OPERATION_TYPES.CREATE_INTERVENTION:
      return await supabase.from('interventions').insert([payload]).select().single();

    case SYNC_OPERATION_TYPES.UPDATE_INTERVENTION:
      return await supabase
        .from('interventions')
        .update(payload.updates)
        .eq('id', payload.id)
        .select()
        .single();

    case SYNC_OPERATION_TYPES.CREATE_LEAVE_REQUEST:
      return await supabase.from('leave_requests').insert([payload]).select().single();

    case SYNC_OPERATION_TYPES.UPDATE_CHECKLIST:
      return await supabase
        .from('checklists')
        .update(payload.updates)
        .eq('id', payload.id)
        .select()
        .single();

    default:
      throw new Error(`Type d'opération inconnu: ${type}`);
  }
};

/**
 * Synchronise toutes les opérations en attente
 */
export const syncPendingOperations = async () => {
  if (isSyncing) {
    logger.log('[SyncService] Synchronisation déjà en cours');
    return { synced: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    logger.log('[SyncService] Pas de connexion, sync reportée');
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  notifySyncListeners({ type: 'SYNC_START' });

  const operations = await getPendingSyncOperations();
  let synced = 0;
  let failed = 0;

  logger.log(`[SyncService] ${operations.length} opérations à synchroniser`);

  for (const operation of operations) {
    try {
      const { error } = await executeOperation(operation);

      if (error) {
        throw error;
      }

      await removeSyncOperation(operation.id);
      synced++;
      notifySyncListeners({ type: 'OPERATION_SYNCED', operation });
      logger.log('[SyncService] Opération synchronisée:', operation.type);

    } catch (error) {
      failed++;
      logger.error('[SyncService] Erreur sync:', operation.type, error);

      // Mettre à jour le compteur de tentatives
      operation.retries = (operation.retries || 0) + 1;
      operation.lastError = error.message;

      // Supprimer après 3 tentatives
      if (operation.retries >= 3) {
        await removeSyncOperation(operation.id);
        notifySyncListeners({ type: 'OPERATION_FAILED', operation, error });
        logger.warn('[SyncService] Opération abandonnée après 3 échecs:', operation.type);
      } else {
        await saveToStore(STORES_ENUM.SYNC_QUEUE, operation);
      }
    }
  }

  isSyncing = false;
  notifySyncListeners({ type: 'SYNC_COMPLETE', synced, failed });
  logger.log(`[SyncService] Sync terminée: ${synced} réussies, ${failed} échouées`);

  return { synced, failed };
};

/**
 * Vérifie s'il y a des opérations en attente
 */
export const hasPendingOperations = async () => {
  const operations = await getPendingSyncOperations();
  return operations.length > 0;
};

/**
 * Compte les opérations en attente
 */
export const getPendingCount = async () => {
  const operations = await getPendingSyncOperations();
  return operations.length;
};

// Écouter les changements de connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    logger.log('[SyncService] Connexion rétablie, démarrage sync...');
    setTimeout(syncPendingOperations, 1000); // Petit délai pour s'assurer que la connexion est stable
  });
}

export default {
  SYNC_OPERATION_TYPES,
  queueOperation,
  syncPendingOperations,
  hasPendingOperations,
  getPendingCount,
  addSyncListener
};
