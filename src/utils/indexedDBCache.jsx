// src/utils/indexedDBCache.js - Système de cache IndexedDB pour uploads mobiles
// Permet de stocker les fichiers volumineux (fiches de paye PDF, etc.) en cache
import logger from './logger';

const DB_NAME = 'SRP_FileCache';
const DB_VERSION = 1;
const STORE_NAME = 'pendingUploads';

/**
 * Initialise la base de données IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Créer le store s'il n'existe pas
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Index pour recherche rapide
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('status', 'status', { unique: false });
        objectStore.createIndex('userId', 'metadata.userId', { unique: false });
      }
    };
  });
};

/**
 * Convertit un File en ArrayBuffer (avec fallback FileReader pour mobile)
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
const fileToArrayBuffer = (file) => {
  return new Promise((resolve, reject) => {
    // Essayer d'abord arrayBuffer() (moderne)
    if (typeof file.arrayBuffer === 'function') {
      file.arrayBuffer()
        .then(resolve)
        .catch(() => {
          // Fallback FileReader si arrayBuffer() échoue
          console.log('⚠️ arrayBuffer() échoué, utilisation FileReader...');
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });
    } else {
      // Fallback FileReader pour vieux navigateurs
      console.log('⚠️ arrayBuffer() non supporté, utilisation FileReader...');
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Stocke un fichier pour upload ultérieur
 * @param {File} file - Le fichier à stocker
 * @param {Object} metadata - Métadonnées (userId, interventionId, folder, etc.)
 * @param {string} customId - ID personnalisé (optionnel)
 * @returns {Promise<string>} ID du fichier stocké
 */
export const storeFileForUpload = async (file, metadata = {}, customId = null) => {
  try {
    console.log(`📦 Stockage IndexedDB: ${file.name}, type: ${file.type}, size: ${file.size}`);

    const db = await initDB();

    // Convertir le fichier en ArrayBuffer pour stockage (avec fallback)
    const arrayBuffer = await fileToArrayBuffer(file);
    console.log(`✅ ArrayBuffer créé: ${arrayBuffer.byteLength} bytes`);

    // Utiliser le type corrigé si disponible (pour mobile iOS)
    const fileType = metadata.correctedType || file.type || 'application/octet-stream';

    const uploadItem = {
      id: customId || `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileData: arrayBuffer,
      fileName: file.name,
      fileType: fileType,
      fileSize: file.size,
      metadata: {
        ...metadata,
        uploadedAt: new Date().toISOString()
      },
      timestamp: Date.now(),
      status: 'pending', // pending | uploading | completed | failed
      retryCount: 0,
      lastError: null
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(uploadItem);

      request.onsuccess = () => {
        logger.log(`✅ Fichier stocké en cache: ${file.name} (${uploadItem.id})`);
        resolve(uploadItem.id);
      };

      request.onerror = () => {
        console.error('❌ Erreur stockage fichier:', request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur storeFileForUpload:', error);
    throw error;
  }
};

/**
 * Récupère tous les fichiers en attente d'upload
 * @param {string} status - Filtre par statut (optionnel)
 * @returns {Promise<Array>}
 */
export const getPendingUploads = async (status = null) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      let request;
      if (status) {
        const index = store.index('status');
        request = index.getAll(status);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur getPendingUploads:', error);
    return [];
  }
};

/**
 * Récupère un fichier spécifique par ID
 * @param {string} id - ID du fichier
 * @returns {Promise<Object|null>}
 */
export const getUploadById = async (id) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur getUploadById:', error);
    return null;
  }
};

/**
 * Met à jour le statut d'un upload
 * @param {string} id - ID du fichier
 * @param {string} status - Nouveau statut
 * @param {Object} updates - Autres mises à jour (optionnel)
 * @returns {Promise<boolean>}
 */
export const updateUploadStatus = async (id, status, updates = {}) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // D'abord récupérer l'item
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error('Upload introuvable'));
          return;
        }

        // Mettre à jour
        const updatedItem = {
          ...item,
          status,
          ...updates,
          lastUpdated: Date.now()
        };

        const putRequest = store.put(updatedItem);

        putRequest.onsuccess = () => {
          logger.log(`✅ Upload ${id} mis à jour: ${status}`);
          resolve(true);
        };

        putRequest.onerror = () => {
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur updateUploadStatus:', error);
    return false;
  }
};

/**
 * Supprime un upload du cache
 * @param {string} id - ID du fichier
 * @returns {Promise<boolean>}
 */
export const deleteUpload = async (id) => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        logger.log(`✅ Upload ${id} supprimé du cache`);
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur deleteUpload:', error);
    return false;
  }
};

/**
 * Supprime tous les uploads complétés
 * @returns {Promise<number>} Nombre d'uploads supprimés
 */
export const clearCompletedUploads = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.openCursor('completed');

      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          logger.log(`✅ ${count} upload(s) complété(s) supprimé(s)`);
          resolve(count);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur clearCompletedUploads:', error);
    return 0;
  }
};

/**
 * Obtient le nombre total d'uploads et leur taille totale
 * @returns {Promise<{count: number, totalSize: number}>}
 */
export const getCacheStats = async () => {
  try {
    const uploads = await getPendingUploads();
    const totalSize = uploads.reduce((sum, upload) => sum + (upload.fileSize || 0), 0);

    return {
      count: uploads.length,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      pending: uploads.filter(u => u.status === 'pending').length,
      uploading: uploads.filter(u => u.status === 'uploading').length,
      failed: uploads.filter(u => u.status === 'failed').length,
      completed: uploads.filter(u => u.status === 'completed').length
    };
  } catch (error) {
    console.error('❌ Erreur getCacheStats:', error);
    return { count: 0, totalSize: 0, totalSizeMB: '0.00', pending: 0, uploading: 0, failed: 0, completed: 0 };
  }
};

/**
 * Supprime TOUS les uploads du cache (DANGER!)
 * @returns {Promise<boolean>}
 */
export const clearAllUploads = async () => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        logger.log('✅ Tous les uploads supprimés du cache');
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur clearAllUploads:', error);
    return false;
  }
};

/**
 * Convertit un ArrayBuffer en File pour upload
 * @param {Object} uploadItem - Item du cache
 * @returns {File}
 */
export const arrayBufferToFile = (uploadItem) => {
  return new File(
    [uploadItem.fileData],
    uploadItem.fileName,
    { type: uploadItem.fileType }
  );
};

/**
 * Nettoie les uploads trop anciens (> 7 jours)
 * @param {number} maxAgeDays - Age maximum en jours (défaut: 7)
 * @returns {Promise<number>} Nombre d'uploads supprimés
 */
export const cleanOldUploads = async (maxAgeDays = 7) => {
  try {
    const db = await initDB();
    const maxAge = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor();

      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < maxAge) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        } else {
          logger.log(`✅ ${count} upload(s) ancien(s) supprimé(s)`);
          resolve(count);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('❌ Erreur cleanOldUploads:', error);
    return 0;
  }
};

/**
 * Alias pour getCacheStats (compatibilité)
 */
export const getUploadStats = getCacheStats;

/**
 * Initialise le nettoyage automatique du cache au démarrage
 * @returns {Promise<void>}
 */
export const initCacheCleanup = async () => {
  try {
    logger.log('🧹 Nettoyage automatique du cache...');

    // Nettoyer les uploads complétés de plus de 24h
    const completedCleaned = await clearCompletedUploads();

    // Nettoyer les uploads de plus de 7 jours
    const oldCleaned = await cleanOldUploads(7);

    const stats = await getCacheStats();

    logger.log(`✅ Cache nettoyé: ${completedCleaned} complétés, ${oldCleaned} anciens supprimés`);
    logger.log(`📊 Cache actuel: ${stats.count} fichiers (${stats.totalSizeMB} MB)`);
  } catch (error) {
    console.error('❌ Erreur nettoyage cache:', error);
  }
};

const indexedDBCache = {
  storeFileForUpload,
  getPendingUploads,
  getUploadById,
  updateUploadStatus,
  deleteUpload,
  clearCompletedUploads,
  getCacheStats,
  getUploadStats,
  clearAllUploads,
  arrayBufferToFile,
  cleanOldUploads,
  initCacheCleanup
};

export default indexedDBCache;
