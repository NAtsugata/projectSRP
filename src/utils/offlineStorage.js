// src/utils/offlineStorage.js
// Stockage IndexedDB pour le mode hors ligne

import logger from './logger';

const DB_NAME = 'srp-offline-db';
const DB_VERSION = 2; // v2: Ajout stores AUTH et USER_DATA pour mode hors ligne

// Stores (tables) dans IndexedDB
const STORES = {
  INTERVENTIONS: 'interventions',
  PROFILES: 'profiles',
  EXPENSES: 'expenses',
  CONTRACTS: 'contracts',
  AUTH: 'auth',
  USER_DATA: 'userData',
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

      // Store pour l'authentification (session, credentials hash)
      if (!database.objectStoreNames.contains(STORES.AUTH)) {
        database.createObjectStore(STORES.AUTH, { keyPath: 'key' });
      }

      // Store pour les données utilisateur (profil, permissions, etc.)
      if (!database.objectStoreNames.contains(STORES.USER_DATA)) {
        database.createObjectStore(STORES.USER_DATA, { keyPath: 'key' });
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

/**
 * Sauvegarde les contrats pour le mode offline
 */
export const cacheContracts = async (contracts) => {
  await saveToStore(STORES.CONTRACTS, contracts);
  await saveToStore(STORES.META, { key: 'lastSync_contracts', value: Date.now() });
  console.log(`[OfflineDB] ${contracts.length} contrats en cache`);
};

/**
 * Récupère les contrats du cache
 */
export const getCachedContracts = async () => {
  return getAllFromStore(STORES.CONTRACTS);
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
// AUTHENTIFICATION HORS LIGNE
// ========================================

/**
 * Sauvegarde la session utilisateur pour mode hors ligne
 * @param {Object} session - Session Supabase
 */
export const cacheAuthSession = async (session) => {
  if (!session) return;

  await saveToStore(STORES.AUTH, {
    key: 'session',
    value: session,
    timestamp: Date.now()
  });
  logger.log('[OfflineDB] Session en cache');
};

/**
 * Récupère la session en cache
 * @returns {Object|null} Session ou null
 */
export const getCachedAuthSession = async () => {
  const data = await getFromStore(STORES.AUTH, 'session');
  return data?.value || null;
};

/**
 * Sauvegarde les credentials hashés pour vérification hors ligne
 * NE JAMAIS stocker le mot de passe en clair !
 * @param {string} email
 * @param {string} passwordHash - Hash du mot de passe
 */
export const cacheAuthCredentials = async (email, passwordHash) => {
  await saveToStore(STORES.AUTH, {
    key: 'credentials',
    email,
    passwordHash,
    timestamp: Date.now()
  });
  logger.log('[OfflineDB] Credentials en cache (hashés)');
};

/**
 * Vérifie les credentials hors ligne
 * @param {string} email
 * @param {string} passwordHash
 * @returns {boolean}
 */
export const verifyOfflineCredentials = async (email, passwordHash) => {
  const data = await getFromStore(STORES.AUTH, 'credentials');
  if (!data) return false;
  return data.email === email && data.passwordHash === passwordHash;
};

/**
 * Supprime toutes les données d'authentification (logout)
 */
export const clearAuthCache = async () => {
  await clearStore(STORES.AUTH);
  await clearStore(STORES.USER_DATA);
  logger.log('[OfflineDB] Données auth supprimées');
};

/**
 * Sauvegarde les données utilisateur (profil, permissions)
 * @param {Object} userData - Données utilisateur
 */
export const cacheUserData = async (userData) => {
  await saveToStore(STORES.USER_DATA, {
    key: 'current_user',
    ...userData,
    timestamp: Date.now()
  });
  logger.log('[OfflineDB] Données utilisateur en cache');
};

/**
 * Récupère les données utilisateur du cache
 */
export const getCachedUserData = async () => {
  const data = await getFromStore(STORES.USER_DATA, 'current_user');
  return data || null;
};

/**
 * Vérifie si la session est encore valide
 * @param {number} maxAgeMs - Âge maximum en ms (défaut: 7 jours)
 */
export const isSessionValid = async (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
  const data = await getFromStore(STORES.AUTH, 'session');
  if (!data) return false;

  const age = Date.now() - data.timestamp;
  return age < maxAgeMs;
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
  cacheContracts,
  getCachedContracts,
  addToSyncQueue,
  getPendingSyncOperations,
  removeSyncOperation,
  clearSyncQueue,
  getLastSyncTime,
  isDataStale,
  cacheAuthSession,
  getCachedAuthSession,
  cacheAuthCredentials,
  verifyOfflineCredentials,
  clearAuthCache,
  cacheUserData,
  getCachedUserData,
  isSessionValid,
  STORES: STORES_ENUM
};
