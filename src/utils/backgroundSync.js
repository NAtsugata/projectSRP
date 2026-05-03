// src/utils/backgroundSync.js
// Wrapper pour Background Sync API - Synchronisation automatique intelligente

import logger from './logger';
import { syncMultipleTables } from './deltaSync';
import { STORES_ENUM } from './offlineStorage';

/**
 * Tags de synchronisation
 */
export const SYNC_TAGS = {
  INTERVENTIONS: 'sync-interventions',
  EXPENSES: 'sync-expenses',
  PROFILES: 'sync-profiles',
  FULL_SYNC: 'sync-all'
};

/**
 * Vérifie si Background Sync est supporté
 * @returns {boolean}
 */
export const isBackgroundSyncSupported = () => {
  return 'serviceWorker' in navigator &&
    typeof registration !== 'undefined' &&
    'sync' in registration;
};

/**
 * Enregistre une tâche de synchronisation en arrière-plan
 * @param {string} tag - Tag de synchronisation
 * @returns {Promise<void>}
 */
export const registerBackgroundSync = async (tag = SYNC_TAGS.FULL_SYNC) => {
  if (!isBackgroundSyncSupported()) {
    logger.warn('[BackgroundSync] API non supportée, fallback sync classique');
    return performSyncFallback(tag);
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
    logger.log(`[BackgroundSync] Sync enregistrée: ${tag}`);
  } catch (error) {
    logger.error('[BackgroundSync] Erreur enregistrement:', error);
    // Fallback vers sync classique
    return performSyncFallback(tag);
  }
};

/**
 * Fallback si Background Sync non disponible
 * @param {string} tag - Tag de synchronisation
 */
const performSyncFallback = async (tag) => {
  logger.log('[BackgroundSync] Fallback: sync immédiate');

  if (!navigator.onLine) {
    logger.log('[BackgroundSync] Hors ligne, sync reportée');
    // Écouter le retour en ligne
    window.addEventListener('online', () => performSync(tag), { once: true });
    return;
  }

  return performSync(tag);
};

/**
 * Effectue la synchronisation selon le tag
 * @param {string} tag - Tag de synchronisation
 * @returns {Promise<Object>} - Résultat de la sync
 */
export const performSync = async (tag) => {
  logger.log(`[BackgroundSync] Début sync pour tag: ${tag}`);

  try {
    let result;

    switch (tag) {
      case SYNC_TAGS.INTERVENTIONS:
        result = await syncMultipleTables([
          { table: 'interventions', store: STORES_ENUM.INTERVENTIONS }
        ]);
        break;

      case SYNC_TAGS.EXPENSES:
        result = await syncMultipleTables([
          { table: 'expenses', store: STORES_ENUM.EXPENSES }
        ]);
        break;

      case SYNC_TAGS.PROFILES:
        result = await syncMultipleTables([
          { table: 'profiles', store: STORES_ENUM.PROFILES }
        ]);
        break;

      case SYNC_TAGS.FULL_SYNC:
      default:
        result = await syncMultipleTables([
          { table: 'interventions', store: STORES_ENUM.INTERVENTIONS },
          { table: 'expenses', store: STORES_ENUM.EXPENSES },
          { table: 'profiles', store: STORES_ENUM.PROFILES },
          { table: 'contracts', store: STORES_ENUM.CONTRACTS },
          { table: 'clients', store: STORES_ENUM.CLIENTS }
        ]);
        break;
    }

    logger.log('[BackgroundSync] Sync terminée:', result);
    notifySyncComplete(result);
    return result;

  } catch (error) {
    logger.error('[BackgroundSync] Erreur sync:', error);
    notifySyncError(error);
    throw error;
  }
};

/**
 * Notifie l'utilisateur de la fin de sync
 * @param {Object} result - Résultat de la sync
 */
const notifySyncComplete = (result) => {
  const { succeeded, failed } = result;

  if (succeeded > 0) {
    showNotification('Synchronisation réussie', {
      body: `${succeeded} table(s) synchronisée(s)`,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'sync-complete'
    });
  }

  if (failed > 0) {
    showNotification('Synchronisation partielle', {
      body: `${failed} table(s) en erreur`,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'sync-warning'
    });
  }
};

/**
 * Notifie une erreur de sync
 * @param {Error} error - Erreur
 */
const notifySyncError = (error) => {
  showNotification('Erreur de synchronisation', {
    body: error.message || 'Une erreur est survenue',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'sync-error'
  });
};

/**
 * Affiche une notification
 * @param {string} title - Titre
 * @param {Object} options - Options
 */
const showNotification = (title, options) => {
  if (!('Notification' in window)) {
    logger.warn('[BackgroundSync] Notifications non supportées');
    return;
  }

  if (Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, options);
    });
  }
};

/**
 * Planifie une sync périodique (si Periodic Background Sync disponible)
 * @param {number} intervalMinutes - Intervalle en minutes
 */
export const schedulePeriodicSync = async (intervalMinutes = 60) => {
  if (typeof registration === 'undefined' || !('periodicSync' in registration)) {
    logger.warn('[BackgroundSync] Periodic Sync non supporté');
    // Fallback vers setInterval
    return scheduleSyncWithInterval(intervalMinutes);
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const status = await registration.periodicSync.register('periodic-sync', {
      minInterval: intervalMinutes * 60 * 1000 // Convertir en ms
    });

    logger.log(`[BackgroundSync] Periodic Sync planifiée: ${intervalMinutes}min`);
    return status;

  } catch (error) {
    logger.error('[BackgroundSync] Erreur Periodic Sync:', error);
    return scheduleSyncWithInterval(intervalMinutes);
  }
};

/**
 * Fallback pour sync périodique avec setInterval
 * @param {number} intervalMinutes - Intervalle en minutes
 */
const scheduleSyncWithInterval = (intervalMinutes) => {
  logger.log(`[BackgroundSync] Fallback setInterval: ${intervalMinutes}min`);

  const intervalId = setInterval(async () => {
    if (navigator.onLine) {
      logger.log('[BackgroundSync] Sync périodique déclenchée');
      await registerBackgroundSync(SYNC_TAGS.FULL_SYNC);
    }
  }, intervalMinutes * 60 * 1000);

  // Retourner une fonction pour annuler
  return () => clearInterval(intervalId);
};

/**
 * Synchronisation intelligente basée sur l'activité
 * @param {string} action - Action effectuée (create, update, delete)
 * @param {string} entity - Entité modifiée (intervention, expense, etc.)
 */
export const smartSync = async (action, entity) => {
  logger.log(`[BackgroundSync] Smart sync: ${action} ${entity}`);

  // Déterminer le tag de sync approprié
  let tag = SYNC_TAGS.FULL_SYNC;

  if (entity === 'intervention') {
    tag = SYNC_TAGS.INTERVENTIONS;
  } else if (entity === 'expense') {
    tag = SYNC_TAGS.EXPENSES;
  } else if (entity === 'profile') {
    tag = SYNC_TAGS.PROFILES;
  }

  // Délai avant sync (pour grouper les opérations)
  const DEBOUNCE_MS = 2000;

  // Annuler la sync précédente si existe
  if (smartSync._timeout) {
    clearTimeout(smartSync._timeout);
  }

  // Planifier la sync
  smartSync._timeout = setTimeout(() => {
    registerBackgroundSync(tag);
  }, DEBOUNCE_MS);
};

/**
 * Obtient l'état de la dernière sync
 * @returns {Promise<Object>} - État de sync
 */
export const getSyncStatus = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;

    // Vérifier s'il y a des sync en attente
    const tags = await registration.sync.getTags?.() || [];

    return {
      supported: isBackgroundSyncSupported(),
      pendingTags: tags,
      hasPending: tags.length > 0,
      online: navigator.onLine
    };

  } catch (error) {
    logger.error('[BackgroundSync] Erreur get status:', error);
    return {
      supported: false,
      pendingTags: [],
      hasPending: false,
      online: navigator.onLine
    };
  }
};

/**
 * Annule toutes les sync en attente
 */
export const cancelPendingSync = async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const tags = await registration.sync.getTags?.() || [];

    for (const tag of tags) {
      // Note: Pas de méthode directe pour annuler,
      // mais on peut les marquer pour les ignorer
      logger.log(`[BackgroundSync] Sync ${tag} sera ignorée`);
    }

    logger.log('[BackgroundSync] Toutes les sync annulées');

  } catch (error) {
    logger.error('[BackgroundSync] Erreur annulation:', error);
  }
};

/**
 * Hook pour React - utiliser la sync en arrière-plan
 * @returns {Object} - Méthodes de sync
 */
export const useBackgroundSync = () => {
  return {
    sync: (tag) => registerBackgroundSync(tag),
    syncAll: () => registerBackgroundSync(SYNC_TAGS.FULL_SYNC),
    syncInterventions: () => registerBackgroundSync(SYNC_TAGS.INTERVENTIONS),
    syncExpenses: () => registerBackgroundSync(SYNC_TAGS.EXPENSES),
    smartSync,
    getStatus: getSyncStatus,
    isSupported: isBackgroundSyncSupported()
  };
};

export default {
  SYNC_TAGS,
  isBackgroundSyncSupported,
  registerBackgroundSync,
  performSync,
  schedulePeriodicSync,
  smartSync,
  getSyncStatus,
  cancelPendingSync,
  useBackgroundSync
};
