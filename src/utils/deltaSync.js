// src/utils/deltaSync.js
// Système de synchronisation différentielle (Delta Sync)
// Synchronise uniquement les changements au lieu de tout recharger

import { supabase } from '../lib/supabaseClient';
import { saveToStore, getFromStore, getAllFromStore, STORES_ENUM } from './offlineStorage';
import { detectConflict, resolveConflict, RESOLUTION_STRATEGIES, addVersion } from './conflictResolver';
import logger from './logger';

/**
 * Métadonnées de synchronisation
 */
const SYNC_META_KEY = 'last_sync';

/**
 * Obtient le timestamp de la dernière synchronisation
 * @param {string} storeName - Nom du store
 * @returns {string|null} - Timestamp ISO ou null
 */
const getLastSyncTimestamp = async (storeName) => {
  try {
    const meta = await getFromStore(STORES_ENUM.META, `${SYNC_META_KEY}_${storeName}`);
    return meta?.timestamp || null;
  } catch (error) {
    logger.error('[DeltaSync] Erreur lecture last sync:', error);
    return null;
  }
};

/**
 * Enregistre le timestamp de synchronisation
 * @param {string} storeName - Nom du store
 * @param {string} timestamp - Timestamp ISO
 */
const setLastSyncTimestamp = async (storeName, timestamp) => {
  try {
    await saveToStore(STORES_ENUM.META, {
      key: `${SYNC_META_KEY}_${storeName}`,
      timestamp,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[DeltaSync] Erreur sauvegarde last sync:', error);
  }
};

/**
 * Récupère uniquement les modifications depuis la dernière sync
 * @param {string} table - Nom de la table Supabase
 * @param {string} storeName - Nom du store IndexedDB
 * @param {Object} options - Options (filters, select, etc.)
 * @returns {Object} - { added, updated, deleted, conflicts }
 */
export const fetchDelta = async (table, storeName, options = {}) => {
  const { filters = {}, select = '*' } = options;

  // Obtenir le timestamp de la dernière sync
  const lastSync = await getLastSyncTimestamp(storeName);
  const now = new Date().toISOString();

  logger.log(`[DeltaSync] Fetch delta pour ${table} depuis ${lastSync || 'début'}`);

  try {
    let query = supabase.from(table).select(select);

    // Filtrer par date de modification si disponible
    if (lastSync) {
      query = query.or(`updated_at.gte.${lastSync},created_at.gte.${lastSync}`);
    }

    // Appliquer les filtres supplémentaires
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data: serverData, error } = await query;

    if (error) throw error;

    // Comparer avec les données locales
    const localData = await getAllFromStore(storeName);
    const localMap = new Map(localData.map(item => [item.id, item]));

    const added = [];
    const updated = [];
    const conflicts = [];

    serverData.forEach(serverItem => {
      const localItem = localMap.get(serverItem.id);

      if (!localItem) {
        // Nouvelle donnée du serveur
        added.push(serverItem);
      } else {
        // Vérifier s'il y a un conflit
        const conflictCheck = detectConflict(localItem, serverItem);

        if (conflictCheck.hasConflict) {
          conflicts.push({
            id: serverItem.id,
            local: localItem,
            server: serverItem,
            conflicts: conflictCheck.conflicts,
            localTimestamp: conflictCheck.localTimestamp,
            serverTimestamp: conflictCheck.serverTimestamp
          });
        } else if (serverItem.updated_at !== localItem.updated_at) {
          // Mise à jour sans conflit
          updated.push(serverItem);
        }
      }

      localMap.delete(serverItem.id);
    });

    // Les éléments restants dans localMap sont potentiellement supprimés côté serveur
    // (ou créés localement et pas encore sync)
    const potentiallyDeleted = Array.from(localMap.values());

    // Mettre à jour le timestamp de sync
    await setLastSyncTimestamp(storeName, now);

    logger.log(`[DeltaSync] Delta pour ${table}:`, {
      added: added.length,
      updated: updated.length,
      conflicts: conflicts.length,
      local_only: potentiallyDeleted.length
    });

    return {
      added,
      updated,
      conflicts,
      localOnly: potentiallyDeleted,
      timestamp: now
    };

  } catch (error) {
    logger.error('[DeltaSync] Erreur fetch delta:', error);
    throw error;
  }
};

/**
 * Applique les changements du delta au cache local
 * @param {string} storeName - Nom du store
 * @param {Object} delta - Résultat de fetchDelta
 * @param {Object} options - Options de résolution
 * @returns {Object} - Statistiques d'application
 */
export const applyDelta = async (storeName, delta, options = {}) => {
  const {
    conflictStrategy = RESOLUTION_STRATEGIES.LAST_WRITE_WINS,
    onConflict = null
  } = options;

  const stats = {
    added: 0,
    updated: 0,
    conflictsResolved: 0,
    errors: 0
  };

  try {
    // 1. Ajouter les nouvelles données
    if (delta.added.length > 0) {
      await saveToStore(storeName, delta.added);
      stats.added = delta.added.length;
    }

    // 2. Mettre à jour les données modifiées
    if (delta.updated.length > 0) {
      await saveToStore(storeName, delta.updated);
      stats.updated = delta.updated.length;
    }

    // 3. Résoudre les conflits
    if (delta.conflicts.length > 0) {
      for (const conflict of delta.conflicts) {
        try {
          let resolution;

          // Demander à l'utilisateur si callback fourni et stratégie manuelle
          if (conflictStrategy === RESOLUTION_STRATEGIES.MANUAL && onConflict) {
            resolution = await onConflict(conflict);
          } else {
            // Résolution automatique
            const conflictData = {
              localData: conflict.local,
              serverData: conflict.server,
              conflicts: conflict.conflicts,
              localTimestamp: conflict.localTimestamp,
              serverTimestamp: conflict.serverTimestamp
            };

            resolution = resolveConflict(conflictData, conflictStrategy);
          }

          if (resolution.resolved) {
            await saveToStore(storeName, resolution.resolved);
            stats.conflictsResolved++;
            logger.log(`[DeltaSync] Conflit résolu pour ${conflict.id}:`, resolution.reason);
          }

        } catch (error) {
          logger.error('[DeltaSync] Erreur résolution conflit:', error);
          stats.errors++;
        }
      }
    }

    logger.log('[DeltaSync] Delta appliqué:', stats);
    return stats;

  } catch (error) {
    logger.error('[DeltaSync] Erreur application delta:', error);
    throw error;
  }
};

/**
 * Synchronisation complète avec delta
 * @param {string} table - Table Supabase
 * @param {string} storeName - Store IndexedDB
 * @param {Object} options - Options
 * @returns {Object} - Résultat de la sync
 */
export const syncWithDelta = async (table, storeName, options = {}) => {
  if (!navigator.onLine) {
    logger.log('[DeltaSync] Hors ligne, sync ignorée');
    return { success: false, reason: 'offline' };
  }

  logger.log(`[DeltaSync] Début sync ${table} <-> ${storeName}`);

  try {
    // 1. Récupérer le delta
    const delta = await fetchDelta(table, storeName, options);

    // 2. Appliquer le delta
    const stats = await applyDelta(storeName, delta, options);

    // 3. Pousser les changements locaux vers le serveur
    const pushStats = await pushLocalChanges(table, delta.localOnly, options);

    return {
      success: true,
      pull: stats,
      push: pushStats,
      timestamp: delta.timestamp
    };

  } catch (error) {
    logger.error('[DeltaSync] Erreur sync:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Pousse les changements locaux vers le serveur
 * @param {string} table - Table Supabase
 * @param {Array} localItems - Items locaux uniquement
 * @param {Object} options - Options
 * @returns {Object} - Statistiques
 */
const pushLocalChanges = async (table, localItems, options = {}) => {
  const stats = {
    pushed: 0,
    errors: 0
  };

  // Filtrer les items qui ont un flag _local_only ou _pending_sync
  const itemsToPush = localItems.filter(item =>
    item._local_only || item._pending_sync
  );

  if (itemsToPush.length === 0) {
    logger.log('[DeltaSync] Aucun changement local à pousser');
    return stats;
  }

  logger.log(`[DeltaSync] Push ${itemsToPush.length} changements locaux vers ${table}`);

  for (const item of itemsToPush) {
    try {
      // Nettoyer les métadonnées locales
      const cleanItem = { ...item };
      delete cleanItem._local_only;
      delete cleanItem._pending_sync;
      delete cleanItem._version;
      delete cleanItem._modified_at;
      delete cleanItem._client_id;

      // Upsert (insert ou update)
      const { error } = await supabase
        .from(table)
        .upsert(cleanItem, { onConflict: 'id' });

      if (error) throw error;

      stats.pushed++;
      logger.log(`[DeltaSync] Item ${item.id} poussé avec succès`);

    } catch (error) {
      logger.error(`[DeltaSync] Erreur push item ${item.id}:`, error);
      stats.errors++;
    }
  }

  return stats;
};

/**
 * Synchronise plusieurs tables en parallèle
 * @param {Array} tables - Liste de { table, store, options }
 * @returns {Object} - Résultats agrégés
 */
export const syncMultipleTables = async (tables) => {
  logger.log('[DeltaSync] Sync multiple tables:', tables.length);

  const results = await Promise.allSettled(
    tables.map(({ table, store, options }) =>
      syncWithDelta(table, store, options)
    )
  );

  const summary = {
    total: tables.length,
    succeeded: 0,
    failed: 0,
    details: []
  };

  results.forEach((result, index) => {
    const { table, store } = tables[index];

    if (result.status === 'fulfilled' && result.value.success) {
      summary.succeeded++;
      summary.details.push({
        table,
        store,
        success: true,
        stats: result.value
      });
    } else {
      summary.failed++;
      summary.details.push({
        table,
        store,
        success: false,
        error: result.reason || result.value?.error
      });
    }
  });

  logger.log('[DeltaSync] Sync multiple terminée:', summary);
  return summary;
};

/**
 * Calcule la taille du delta (économie de bande passante)
 * @param {Object} delta - Résultat de fetchDelta
 * @returns {Object} - Statistiques de taille
 */
export const calculateDeltaSize = (delta) => {
  const totalItems = delta.added.length + delta.updated.length;
  const totalSize = JSON.stringify(delta).length;

  return {
    items: totalItems,
    bytes: totalSize,
    kb: (totalSize / 1024).toFixed(2),
    efficiency: totalItems > 0 ? `${totalItems} items in ${(totalSize / 1024).toFixed(2)}KB` : 'No changes'
  };
};

export default {
  fetchDelta,
  applyDelta,
  syncWithDelta,
  syncMultipleTables,
  calculateDeltaSize
};
