// src/config/fileConfig.js
// Configuration centralisée pour les fichiers et uploads

/**
 * Constantes de taille de fichiers
 */
export const FILE_SIZE = {
  // Tailles en bytes
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,

  // Limites par type de fichier
  MAX_IMAGE: 50 * 1024 * 1024,        // 50 MB
  MAX_IMAGE_MOBILE_2G: 5 * 1024 * 1024,  // 5 MB pour 2G
  MAX_IMAGE_MOBILE_4G: 50 * 1024 * 1024, // 50 MB pour 4G
  MAX_DOCUMENT: 50 * 1024 * 1024,     // 50 MB
  MAX_PDF: 50 * 1024 * 1024,          // 50 MB
  MAX_VIDEO: 100 * 1024 * 1024,       // 100 MB
  MAX_AUDIO: 50 * 1024 * 1024,        // 50 MB

  // Limites par contexte
  MAX_VAULT_FILE: 50 * 1024 * 1024,   // 50 MB pour coffre-fort
  MAX_EXPENSE_RECEIPT: 50 * 1024 * 1024, // 50 MB pour justificatifs notes de frais
  MAX_INTERVENTION_FILE: 50 * 1024 * 1024, // 50 MB pour fichiers intervention
  MAX_BRIEFING_FILE: 50 * 1024 * 1024, // 50 MB pour documents de préparation

  // Compression
  MAX_COMPRESSED_IMAGE: 1 * 1024 * 1024, // 1 MB après compression
};

/**
 * Types MIME acceptés par catégorie
 */
export const ACCEPTED_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ],
  AUDIO: ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  ALL: [] // Sera calculé dynamiquement
};

// Calculer ALL en combinant tous les types
ACCEPTED_TYPES.ALL = [
  ...ACCEPTED_TYPES.IMAGES,
  ...ACCEPTED_TYPES.DOCUMENTS,
  ...ACCEPTED_TYPES.AUDIO,
  ...ACCEPTED_TYPES.VIDEO
];

/**
 * Extensions acceptées
 */
export const ACCEPTED_EXTENSIONS = {
  IMAGES: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  DOCUMENTS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'],
  AUDIO: ['.webm', '.mp3', '.wav'],
  VIDEO: ['.mp4', '.webm', '.mov']
};

/**
 * Limites de vitesse de connexion (pour uploads adaptatifs)
 */
export const NETWORK_LIMITS = {
  '2G': 5 * 1024 * 1024,    // 5 MB/s
  '3G': 10 * 1024 * 1024,   // 10 MB/s
  '4G': 20 * 1024 * 1024,   // 20 MB/s
  'wifi': 50 * 1024 * 1024  // 50 MB/s
};

/**
 * Fonctions utilitaires
 */
export const fileUtils = {
  /**
   * Formate une taille de fichier en lecture humaine
   * @param {number} bytes - Taille en bytes
   * @param {number} decimals - Nombre de décimales (défaut: 1)
   * @returns {string}
   */
  formatFileSize(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';

    const k = FILE_SIZE.KB;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  },

  /**
   * Convertit MB en bytes
   * @param {number} mb - Taille en MB
   * @returns {number} Taille en bytes
   */
  mbToBytes(mb) {
    return mb * FILE_SIZE.MB;
  },

  /**
   * Convertit bytes en MB
   * @param {number} bytes - Taille en bytes
   * @returns {number} Taille en MB
   */
  bytesToMB(bytes) {
    return bytes / FILE_SIZE.MB;
  },

  /**
   * Vérifie si un type MIME est une image
   * @param {string} mimeType - Type MIME
   * @returns {boolean}
   */
  isImage(mimeType) {
    return ACCEPTED_TYPES.IMAGES.includes(mimeType) || mimeType.startsWith('image/');
  },

  /**
   * Vérifie si un type MIME est un document
   * @param {string} mimeType - Type MIME
   * @returns {boolean}
   */
  isDocument(mimeType) {
    return ACCEPTED_TYPES.DOCUMENTS.includes(mimeType) || mimeType === 'application/pdf';
  },

  /**
   * Obtient la limite de taille pour un type de fichier et connexion
   * @param {string} fileType - Type de fichier ('image', 'document', etc.)
   * @param {string} networkType - Type de connexion ('2G', '3G', '4G', 'wifi')
   * @returns {number} Limite en bytes
   */
  getMaxSize(fileType, networkType = '4G') {
    if (fileType === 'image') {
      if (networkType === '2G') return FILE_SIZE.MAX_IMAGE_MOBILE_2G;
      return FILE_SIZE.MAX_IMAGE_MOBILE_4G;
    }

    const sizeMap = {
      document: FILE_SIZE.MAX_DOCUMENT,
      pdf: FILE_SIZE.MAX_PDF,
      video: FILE_SIZE.MAX_VIDEO,
      audio: FILE_SIZE.MAX_AUDIO,
      vault: FILE_SIZE.MAX_VAULT_FILE,
      expense: FILE_SIZE.MAX_EXPENSE_RECEIPT,
      intervention: FILE_SIZE.MAX_INTERVENTION_FILE,
      briefing: FILE_SIZE.MAX_BRIEFING_FILE
    };

    return sizeMap[fileType] || FILE_SIZE.MAX_DOCUMENT;
  },

  /**
   * Valide qu'un fichier respecte les limites
   * @param {File} file - Fichier à valider
   * @param {number} maxSize - Taille maximale en bytes
   * @returns {{ valid: boolean, error: string|null }}
   */
  validateFile(file, maxSize) {
    if (!file) {
      return { valid: false, error: 'Aucun fichier fourni' };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `Fichier trop volumineux (max: ${this.formatFileSize(maxSize)})`
      };
    }

    return { valid: true, error: null };
  }
};

export default {
  FILE_SIZE,
  ACCEPTED_TYPES,
  ACCEPTED_EXTENSIONS,
  NETWORK_LIMITS,
  fileUtils
};
