// src/utils/offlineStorage.js
// Stockage IndexedDB pour le mode hors ligne

import logger from './logger';

const DB_NAME = 'srp-offline-db';
const DB_VERSION = 1;

// Stores (tables) dans IndexedDB
const STORES = {
  INTERVENTIONS: 'interventions',
  PROFILES: 'profiles',
  EXPENSES: 'expenses',
  CONTRACTS: 'contracts',
  SYNC_QUEUE: 'syncQueue',
  META: 'meta'
};

let db = null;

/**
 * Ouvre la connexion à IndexedDB
 */
export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('[OfflineDB] Erreur ouverture:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      logger.log('[OfflineDB] Base ouverte avec succès');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      logger.log('[OfflineDB] Mise à jour du schéma...');

      // Store pour les interventions
      if (!database.objectStoreNames.contains(STORES.INTERVENTIONS)) {
        const store = database.createObjectStore(STORES.INTERVENTIONS, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }

      // Store pour les profils/utilisateurs
      if (!database.objectStoreNames.contains(STORES.PROFILES)) {
        database.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
      }

      // Store pour les dépenses
      if (!database.objectStoreNames.contains(STORES.EXPENSES)) {
        const store = database.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        store.createIndex('user_id', 'user_id', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }

      // Store pour les contrats
      if (!database.objectStoreNames.contains(STORES.CONTRACTS)) {
        database.createObjectStore(STORES.CONTRACTS, { keyPath: 'id' });
      }

      // Store pour la queue de synchronisation
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      // Store pour les métadonnées (dernière sync, etc.)
      if (!database.objectStoreNames.contains(STORES.META)) {
        database.createObjectStore(STORES.META, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Sauvegarde des données dans un store
 */
export const saveToStore = async (storeName, data) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Si c'est un tableau, sauvegarder chaque élément
    if (Array.isArray(data)) {
      data.forEach(item => store.put(item));
    } else {
      store.put(data);
    }

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Récupère toutes les données d'un store
 */
export const getAllFromStore = async (storeName) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Récupère un élément par ID
 */
export const getFromStore = async (storeName, id) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Supprime un élément par ID
 */
export const deleteFromStore = async (storeName, id) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Vide un store entier
 */
export const clearStore = async (storeName) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// ========================================
// FONCTIONS SPÉCIFIQUES PAR TYPE DE DONNÉES
// ========================================

/**
 * Sauvegarde les interventions pour le mode offline
 */
export const cacheInterventions = async (interventions) => {
  await saveToStore(STORES.INTERVENTIONS, interventions);
  await saveToStore(STORES.META, { key: 'lastSync_interventions', value: Date.now() });
  console.log(`[OfflineDB] ${interventions.length} interventions en cache`);
};

/**
 * Récupère les interventions du cache
 */
export const getCachedInterventions = async () => {
  return getAllFromStore(STORES.INTERVENTIONS);
};

/**
 * Sauvegarde les profils pour le mode offline
 */
export const cacheProfiles = async (profiles) => {
  await saveToStore(STORES.PROFILES, profiles);
  await saveToStore(STORES.META, { key: 'lastSync_profiles', value: Date.now() });
  console.log(`[OfflineDB] ${profiles.length} profils en cache`);
};

/**
 * Récupère les profils du cache
 */
export const getCachedProfiles = async () => {
  return getAllFromStore(STORES.PROFILES);
};

/**
 * Sauvegarde les dépenses pour le mode offline
 */
export const cacheExpenses = async (expenses) => {
  await saveToStore(STORES.EXPENSES, expenses);
  await saveToStore(STORES.META, { key: 'lastSync_expenses', value: Date.now() });
  console.log(`[OfflineDB] ${expenses.length} dépenses en cache`);
};

/**
 * Récupère les dépenses du cache
 */
export const getCachedExpenses = async () => {
  return getAllFromStore(STORES.EXPENSES);
};

// ========================================
// QUEUE DE SYNCHRONISATION
// ========================================

/**
 * Ajoute une opération à la queue de sync
 */
export const addToSyncQueue = async (operation) => {
  const queueItem = {
    ...operation,
    timestamp: Date.now(),
    retries: 0
  };
  await saveToStore(STORES.SYNC_QUEUE, queueItem);
  logger.log('[OfflineDB] Opération ajoutée à la queue:', operation.type);
  return queueItem;
};

/**
 * Récupère toutes les opérations en attente
 */
export const getPendingSyncOperations = async () => {
  return getAllFromStore(STORES.SYNC_QUEUE);
};

/**
 * Supprime une opération de la queue après sync réussie
 */
export const removeSyncOperation = async (id) => {
  await deleteFromStore(STORES.SYNC_QUEUE, id);
  logger.log('[OfflineDB] Opération synchronisée et supprimée:', id);
};

/**
 * Vide la queue de sync
 */
export const clearSyncQueue = async () => {
  await clearStore(STORES.SYNC_QUEUE);
  logger.log('[OfflineDB] Queue de sync vidée');
};

// ========================================
// MÉTADONNÉES
// ========================================

/**
 * Récupère la date de dernière synchronisation
 */
export const getLastSyncTime = async (type) => {
  const meta = await getFromStore(STORES.META, `lastSync_${type}`);
  return meta?.value || null;
};

/**
 * Vérifie si les données sont périmées (> 1 heure)
 */
export const isDataStale = async (type, maxAgeMs = 3600000) => {
  const lastSync = await getLastSyncTime(type);
  if (!lastSync) return true;
  return (Date.now() - lastSync) > maxAgeMs;
};

export const STORES_ENUM = STORES;

export default {
  openDatabase,
  saveToStore,
  getAllFromStore,
  getFromStore,
  deleteFromStore,
  clearStore,
  cacheInterventions,
  getCachedInterventions,
  cacheProfiles,
  getCachedProfiles,
  cacheExpenses,
  getCachedExpenses,
  addToSyncQueue,
  getPendingSyncOperations,
  removeSyncOperation,
  clearSyncQueue,
  getLastSyncTime,
  isDataStale,
  STORES: STORES_ENUM
};
