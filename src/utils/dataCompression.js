// src/utils/dataCompression.js
// Système de compression des données pour IndexedDB

import logger from './logger';

/**
 * Vérifie si la compression native est supportée
 * @returns {boolean}
 */
const isCompressionSupported = () => {
  return 'CompressionStream' in window && 'DecompressionStream' in window;
};

/**
 * Compresse des données avec l'API native (si supportée)
 * @param {string} data - Données à compresser (JSON string)
 * @returns {Promise<Uint8Array>} - Données compressées
 */
const compressNative = async (data) => {
  const stream = new Blob([data]).stream();
  const compressedStream = stream.pipeThrough(
    new CompressionStream('gzip')
  );

  const compressedBlob = await new Response(compressedStream).blob();
  const arrayBuffer = await compressedBlob.arrayBuffer();

  return new Uint8Array(arrayBuffer);
};

/**
 * Décompresse avec l'API native
 * @param {Uint8Array} compressed - Données compressées
 * @returns {Promise<string>} - Données décompressées
 */
const decompressNative = async (compressed) => {
  const stream = new Blob([compressed]).stream();
  const decompressedStream = stream.pipeThrough(
    new DecompressionStream('gzip')
  );

  return await new Response(decompressedStream).text();
};

/**
 * Compression LZ simple (fallback)
 * Algorithme LZ-String simplifié pour compatibilité
 */
const compressLZ = (data) => {
  // Dictionnaire pour stocker les séquences
  const dict = {};
  let dictSize = 256;
  let current = '';
  const result = [];

  for (let i = 0; i < data.length; i++) {
    const char = data.charAt(i);
    const phrase = current + char;

    if (dict[phrase] !== undefined) {
      current = phrase;
    } else {
      result.push(current.length > 1 ? dict[current] : current.charCodeAt(0));
      dict[phrase] = dictSize++;
      current = char;
    }
  }

  if (current !== '') {
    result.push(current.length > 1 ? dict[current] : current.charCodeAt(0));
  }

  // Convertir en Uint8Array
  return new Uint8Array(result);
};

/**
 * Décompression LZ simple
 */
const decompressLZ = (compressed) => {
  const dict = {};
  let dictSize = 256;
  let current = String.fromCharCode(compressed[0]);
  let result = current;

  for (let i = 1; i < compressed.length; i++) {
    const code = compressed[i];
    let entry;

    if (dict[code] !== undefined) {
      entry = dict[code];
    } else if (code === dictSize) {
      entry = current + current.charAt(0);
    } else {
      entry = String.fromCharCode(code);
    }

    result += entry;
    dict[dictSize++] = current + entry.charAt(0);
    current = entry;
  }

  return result;
};

/**
 * Compresse des données (objet/array → Uint8Array compressé)
 * @param {Object|Array} data - Données à compresser
 * @param {Object} options - Options
 * @returns {Promise<Object>} - { compressed, metadata }
 */
export const compress = async (data, options = {}) => {
  const { method = 'auto', threshold = 1024 } = options;

  try {
    // Convertir en JSON
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;

    // Si trop petit, ne pas compresser
    if (originalSize < threshold) {
      return {
        data: jsonString,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        method: 'none'
      };
    }

    // Déterminer la méthode
    const useNative = method === 'native' ||
                     (method === 'auto' && isCompressionSupported());

    let compressed;
    let compressionMethod;

    if (useNative) {
      compressed = await compressNative(jsonString);
      compressionMethod = 'gzip';
    } else {
      compressed = compressLZ(jsonString);
      compressionMethod = 'lz';
    }

    const compressedSize = compressed.byteLength;
    const ratio = (compressedSize / originalSize).toFixed(2);

    logger.log(`[Compression] ${compressionMethod}: ${originalSize}B → ${compressedSize}B (${ratio}x)`);

    return {
      data: compressed,
      compressed: true,
      originalSize,
      compressedSize,
      ratio: parseFloat(ratio),
      method: compressionMethod
    };

  } catch (error) {
    logger.error('[Compression] Erreur:', error);
    // En cas d'erreur, retourner non compressé
    return {
      data: JSON.stringify(data),
      compressed: false,
      error: error.message
    };
  }
};

/**
 * Décompresse des données
 * @param {Uint8Array|string} compressed - Données compressées
 * @param {Object} metadata - Métadonnées de compression
 * @returns {Promise<Object|Array>} - Données décompressées
 */
export const decompress = async (compressed, metadata = {}) => {
  const { method = 'gzip', compressed: isCompressed = true } = metadata;

  try {
    // Si pas compressé, juste parser le JSON
    if (!isCompressed) {
      return JSON.parse(compressed);
    }

    let jsonString;

    if (method === 'gzip') {
      jsonString = await decompressNative(compressed);
    } else if (method === 'lz') {
      jsonString = decompressLZ(compressed);
    } else {
      throw new Error(`Méthode de décompression inconnue: ${method}`);
    }

    return JSON.parse(jsonString);

  } catch (error) {
    logger.error('[Decompression] Erreur:', error);
    throw error;
  }
};

/**
 * Compresse un store IndexedDB complet
 * @param {Array} items - Items du store
 * @returns {Promise<Object>} - { items, stats }
 */
export const compressStore = async (items) => {
  const compressedItems = [];
  const stats = {
    total: items.length,
    compressed: 0,
    originalSize: 0,
    compressedSize: 0,
    savedBytes: 0
  };

  for (const item of items) {
    try {
      const result = await compress(item);

      if (result.compressed) {
        compressedItems.push({
          id: item.id,
          _compressed_data: result.data,
          _compression_meta: {
            method: result.method,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            ratio: result.ratio
          }
        });

        stats.compressed++;
        stats.originalSize += result.originalSize;
        stats.compressedSize += result.compressedSize;
      } else {
        compressedItems.push(item);
      }

    } catch (error) {
      logger.error('[CompressStore] Erreur item:', error);
      compressedItems.push(item); // Garder original en cas d'erreur
    }
  }

  stats.savedBytes = stats.originalSize - stats.compressedSize;
  stats.savedPercent = stats.originalSize > 0
    ? ((stats.savedBytes / stats.originalSize) * 100).toFixed(2)
    : 0;

  logger.log('[CompressStore] Stats:', stats);

  return {
    items: compressedItems,
    stats
  };
};

/**
 * Décompresse un store complet
 * @param {Array} compressedItems - Items compressés
 * @returns {Promise<Array>} - Items décompressés
 */
export const decompressStore = async (compressedItems) => {
  const decompressedItems = [];

  for (const item of compressedItems) {
    try {
      if (item._compressed_data && item._compression_meta) {
        // Décompresser
        const decompressed = await decompress(
          item._compressed_data,
          item._compression_meta
        );

        decompressedItems.push(decompressed);
      } else {
        // Pas compressé
        decompressedItems.push(item);
      }

    } catch (error) {
      logger.error('[DecompressStore] Erreur item:', error);
      decompressedItems.push(item); // Garder compressé en cas d'erreur
    }
  }

  return decompressedItems;
};

/**
 * Teste le ratio de compression sur un échantillon
 * @param {Object|Array} sample - Échantillon de données
 * @returns {Promise<Object>} - Statistiques de test
 */
export const testCompression = async (sample) => {
  const jsonString = JSON.stringify(sample);
  const originalSize = new Blob([jsonString]).size;

  const results = {
    originalSize,
    originalSizeKB: (originalSize / 1024).toFixed(2),
    methods: {}
  };

  // Tester avec gzip (si supporté)
  if (isCompressionSupported()) {
    const gzipResult = await compress(sample, { method: 'native' });
    results.methods.gzip = {
      size: gzipResult.compressedSize,
      sizeKB: (gzipResult.compressedSize / 1024).toFixed(2),
      ratio: gzipResult.ratio,
      savedPercent: ((1 - gzipResult.ratio) * 100).toFixed(2)
    };
  }

  // Tester avec LZ
  const lzResult = await compress(sample, { method: 'lz' });
  results.methods.lz = {
    size: lzResult.compressedSize || originalSize,
    sizeKB: ((lzResult.compressedSize || originalSize) / 1024).toFixed(2),
    ratio: lzResult.ratio || 1,
    savedPercent: lzResult.ratio ? ((1 - lzResult.ratio) * 100).toFixed(2) : 0
  };

  // Meilleure méthode
  results.bestMethod = results.methods.gzip?.ratio < results.methods.lz?.ratio
    ? 'gzip'
    : 'lz';

  logger.log('[TestCompression] Résultats:', results);

  return results;
};

/**
 * Obtient des infos sur le support de compression
 * @returns {Object}
 */
export const getCompressionInfo = () => {
  return {
    nativeSupported: isCompressionSupported(),
    methods: {
      gzip: isCompressionSupported() ? 'Supporté (natif)' : 'Non supporté',
      lz: 'Supporté (fallback)'
    },
    recommended: isCompressionSupported() ? 'gzip' : 'lz'
  };
};

export default {
  compress,
  decompress,
  compressStore,
  decompressStore,
  testCompression,
  getCompressionInfo,
  isCompressionSupported
};
