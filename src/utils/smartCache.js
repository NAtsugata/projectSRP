// src/utils/smartCache.js
// Système de cache intelligent avec TTL et nettoyage automatique

import { saveToStore, getAllFromStore, getFromStore, STORES_ENUM, openDatabase } from './offlineStorage';
import logger from './logger';

/**
 * Configuration par défaut du cache
 */
const DEFAULT_CONFIG = {
  // TTL par type de données (en millisecondes)
  ttl: {
    interventions: 60 * 60 * 1000,      // 1 heure
    profiles: 24 * 60 * 60 * 1000,      // 24 heures
    expenses: 60 * 60 * 1000,           // 1 heure
    contracts: 7 * 24 * 60 * 60 * 1000, // 7 jours
    clients: 7 * 24 * 60 * 60 * 1000    // 7 jours
  },

  // Taille max du cache (en octets)
  maxSize: 50 * 1024 * 1024, // 50 MB

  // Pourcentage de nettoyage quand limite atteinte
  cleanupPercentage: 20 // Supprimer 20% du cache le plus ancien
};

/**
 * Wrapper pour sauvegarder avec métadonnées TTL
 * @param {string} storeName - Nom du store
 * @param {Object|Array} data - Données à sauvegarder
 * @param {Object} options - Options (ttl personnalisé)
 * @returns {Promise}
 */
export const cacheSet = async (storeName, data, options = {}) => {
  const { ttl } = options;
  const now = Date.now();

  // Obtenir le TTL configuré ou par défaut
  const cacheTTL = ttl || DEFAULT_CONFIG.ttl[storeName] || DEFAULT_CONFIG.ttl.interventions;

  // Ajouter les métadonnées de cache
  const withMetadata = (item) => ({
    ...item,
    _cached_at: now,
    _expires_at: now + cacheTTL,
    _cache_ttl: cacheTTL
  });

  const dataToCache = Array.isArray(data)
    ? data.map(withMetadata)
    : withMetadata(data);

  // Vérifier la taille avant de sauvegarder
  await checkCacheSize(storeName, dataToCache);

  // Sauvegarder
  await saveToStore(storeName, dataToCache);

  logger.log(`[SmartCache] Données cachées dans ${storeName}:`,
    Array.isArray(data) ? `${data.length} items` : '1 item');

  return dataToCache;
};

/**
 * Récupère les données du cache si elles sont encore valides
 * @param {string} storeName - Nom du store
 * @param {string} id - ID de l'élément (optionnel)
 * @param {Object} options - Options
 * @returns {Promise<Object|Array|null>} - Données ou null si expirées
 */
export const cacheGet = async (storeName, id = null, options = {}) => {
  const { ignoreTTL = false } = options;
  const now = Date.now();

  try {
    // Récupérer un élément ou tous
    const data = id
      ? await getFromStore(storeName, id)
      : await getAllFromStore(storeName);

    if (!data) return null;

    // Vérifier TTL
    const isValid = (item) => {
      if (ignoreTTL) return true;
      if (!item._expires_at) return true; // Pas de TTL défini = valide
      return item._expires_at > now;
    };

    // Filtrer les données valides
    if (Array.isArray(data)) {
      const validData = data.filter(isValid);
      const expiredCount = data.length - validData.length;

      if (expiredCount > 0) {
        logger.log(`[SmartCache] ${expiredCount} items expirés ignorés dans ${storeName}`);
      }

      return validData.length > 0 ? validData : null;
    }

    // Un seul élément
    if (isValid(data)) {
      return data;
    }

    logger.log(`[SmartCache] Item ${id} expiré dans ${storeName}`);
    return null;

  } catch (error) {
    logger.error('[SmartCache] Erreur lecture cache:', error);
    return null;
  }
};

/**
 * Vérifie si le cache est encore valide
 * @param {string} storeName - Nom du store
 * @param {string} id - ID (optionnel)
 * @returns {Promise<boolean>}
 */
export const cacheIsValid = async (storeName, id = null) => {
  const data = await cacheGet(storeName, id);
  return data !== null;
};

/**
 * Invalide le cache (supprime)
 * @param {string} storeName - Nom du store
 * @param {string} id - ID à supprimer (optionnel, sinon tout)
 */
export const cacheInvalidate = async (storeName, id = null) => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    if (id) {
      store.delete(id);
      logger.log(`[SmartCache] Item ${id} invalidé dans ${storeName}`);
    } else {
      store.clear();
      logger.log(`[SmartCache] Tout le cache ${storeName} invalidé`);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });

  } catch (error) {
    logger.error('[SmartCache] Erreur invalidation:', error);
    throw error;
  }
};

/**
 * Nettoie les entrées expirées du cache
 * @param {string} storeName - Nom du store (optionnel, sinon tous)
 * @returns {Promise<Object>} - Statistiques de nettoyage
 */
export const cleanupExpired = async (storeName = null) => {
  const now = Date.now();
  const stats = {
    scanned: 0,
    removed: 0,
    stores: []
  };

  try {
    const storesToClean = storeName
      ? [storeName]
      : Object.values(STORES_ENUM);

    for (const store of storesToClean) {
      try {
        const allData = await getAllFromStore(store);
        stats.scanned += allData.length;

        const expired = allData.filter(item =>
          item._expires_at && item._expires_at < now
        );

        if (expired.length > 0) {
          const db = await openDatabase();
          const transaction = db.transaction(store, 'readwrite');
          const objectStore = transaction.objectStore(store);

          expired.forEach(item => {
            objectStore.delete(item.id);
          });

          await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
          });

          stats.removed += expired.length;
          stats.stores.push({
            name: store,
            removed: expired.length,
            total: allData.length
          });

          logger.log(`[SmartCache] ${expired.length} items expirés supprimés de ${store}`);
        }

      } catch (error) {
        logger.error(`[SmartCache] Erreur cleanup ${store}:`, error);
      }
    }

    logger.log('[SmartCache] Nettoyage terminé:', stats);
    return stats;

  } catch (error) {
    logger.error('[SmartCache] Erreur cleanup global:', error);
    throw error;
  }
};

/**
 * Vérifie la taille du cache et nettoie si nécessaire
 * @param {string} storeName - Nom du store
 * @param {Object|Array} newData - Nouvelles données à ajouter
 */
const checkCacheSize = async (storeName, newData) => {
  try {
    // Estimer la taille des données existantes + nouvelles
    const existingData = await getAllFromStore(storeName);
    const existingSize = estimateSize(existingData);
    const newSize = estimateSize(newData);
    const totalSize = existingSize + newSize;

    logger.log(`[SmartCache] Taille cache ${storeName}: ${(existingSize / 1024).toFixed(2)}KB + ${(newSize / 1024).toFixed(2)}KB`);

    // Si dépassement, nettoyer
    if (totalSize > DEFAULT_CONFIG.maxSize) {
      logger.warn(`[SmartCache] Cache plein (${(totalSize / 1024 / 1024).toFixed(2)}MB), nettoyage...`);
      await cleanupOldest(storeName, DEFAULT_CONFIG.cleanupPercentage);
    }

  } catch (error) {
    logger.error('[SmartCache] Erreur vérification taille:', error);
  }
};

/**
 * Estime la taille en octets d'un objet
 * @param {Object|Array} data - Données
 * @returns {number} - Taille estimée en octets
 */
const estimateSize = (data) => {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return 0;
  }
};

/**
 * Supprime les entrées les plus anciennes
 * @param {string} storeName - Nom du store
 * @param {number} percentage - Pourcentage à supprimer (0-100)
 */
const cleanupOldest = async (storeName, percentage = 20) => {
  try {
    const allData = await getAllFromStore(storeName);

    // Trier par date de cache (plus ancien en premier)
    const sorted = allData.sort((a, b) =>
      (a._cached_at || 0) - (b._cached_at || 0)
    );

    // Calculer combien supprimer
    const toRemove = Math.ceil(sorted.length * (percentage / 100));

    if (toRemove === 0) return;

    const itemsToRemove = sorted.slice(0, toRemove);

    // Supprimer
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readwrite');
    const objectStore = transaction.objectStore(storeName);

    itemsToRemove.forEach(item => {
      objectStore.delete(item.id);
    });

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    logger.log(`[SmartCache] ${toRemove} items les plus anciens supprimés de ${storeName}`);

  } catch (error) {
    logger.error('[SmartCache] Erreur cleanup oldest:', error);
  }
};

/**
 * Obtient des statistiques sur le cache
 * @returns {Promise<Object>} - Statistiques
 */
export const getCacheStats = async () => {
  const stats = {
    stores: [],
    totalItems: 0,
    totalSize: 0,
    expiredItems: 0
  };

  const now = Date.now();

  try {
    for (const storeName of Object.values(STORES_ENUM)) {
      try {
        const data = await getAllFromStore(storeName);
        const size = estimateSize(data);
        const expired = data.filter(item =>
          item._expires_at && item._expires_at < now
        ).length;

        stats.stores.push({
          name: storeName,
          items: data.length,
          size,
          sizeKB: (size / 1024).toFixed(2),
          expired
        });

        stats.totalItems += data.length;
        stats.totalSize += size;
        stats.expiredItems += expired;

      } catch (error) {
        logger.error(`[SmartCache] Erreur stats ${storeName}:`, error);
      }
    }

    stats.totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
    stats.usagePercent = ((stats.totalSize / DEFAULT_CONFIG.maxSize) * 100).toFixed(2);

    return stats;

  } catch (error) {
    logger.error('[SmartCache] Erreur stats:', error);
    return stats;
  }
};

/**
 * Planifie un nettoyage automatique périodique
 * @param {number} intervalMinutes - Intervalle en minutes
 * @returns {Function} - Fonction pour arrêter le nettoyage
 */
export const scheduleAutoCleanup = (intervalMinutes = 60) => {
  logger.log(`[SmartCache] Nettoyage auto planifié: toutes les ${intervalMinutes}min`);

  const intervalId = setInterval(async () => {
    logger.log('[SmartCache] Nettoyage auto déclenché');
    const stats = await cleanupExpired();
    logger.log('[SmartCache] Nettoyage auto terminé:', stats);
  }, intervalMinutes * 60 * 1000);

  // Retourner une fonction pour arrêter
  return () => {
    clearInterval(intervalId);
    logger.log('[SmartCache] Nettoyage auto arrêté');
  };
};

/**
 * Initialise le cache intelligent (à appeler au démarrage)
 */
export const initSmartCache = async () => {
  logger.log('[SmartCache] Initialisation...');

  // Nettoyer les données expirées au démarrage
  const stats = await cleanupExpired();
  logger.log('[SmartCache] Nettoyage initial:', stats);

  // Planifier nettoyage auto toutes les heures
  scheduleAutoCleanup(60);

  // Afficher les stats
  const cacheStats = await getCacheStats();
  logger.log('[SmartCache] Stats cache:', cacheStats);

  logger.log('[SmartCache] Initialisé ✓');
};

export default {
  cacheSet,
  cacheGet,
  cacheIsValid,
  cacheInvalidate,
  cleanupExpired,
  getCacheStats,
  scheduleAutoCleanup,
  initSmartCache
};
