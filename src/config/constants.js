// src/config/constants.js
// Constantes globales de l'application

/**
 * Configuration réseau
 */
export const NETWORK = {
  TIMEOUT_MS: 15000, // 15 secondes optimisé pour mobile
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE_MS: 1000,
  MAX_RETRY_DELAY_MS: 10000,
};

/**
 * Configuration authentification
 */
export const AUTH = {
  MIN_PASSWORD_LENGTH: 6,
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 heures
};

/**
 * Configuration cache
 */
export const CACHE = {
  LRU_SIZE: 100, // Taille du cache LRU (optimisé mobile)
  STALE_TIME_MS: 1 * 60 * 1000, // 1 minute
  GC_TIME_MS: 5 * 60 * 1000, // 5 minutes
  MAX_AGE_DAYS: 7, // Age maximum des données en cache
};

/**
 * Configuration validation
 */
export const VALIDATION = {
  MAX_STRING_LENGTH: 1000,
  MAX_FILENAME_LENGTH: 255,
  MAX_EMAIL_LENGTH: 254, // RFC 5321
  MAX_PHONE_LENGTH: 20,
  MAX_LEAVE_REASON_LENGTH: 500,
  MAX_USER_NAME_LENGTH: 100,
  MIN_USER_NAME_LENGTH: 2,
};

/**
 * Configuration fichiers
 */
export const FILES = {
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  ALLOWED_DOCUMENT_TYPES: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  ALLOWED_ALL_TYPES: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'],
};

/**
 * Configuration UI
 */
export const UI = {
  LOADING_DELAY_MS: 300,
  TOAST_DURATION_MS: 3000,
  DEBOUNCE_DELAY_MS: 300,
  MIN_TOUCH_TARGET_PX: 44, // iOS guidelines
};

/**
 * Configuration sécurité
 */
export const SECURITY = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
};

/**
 * Environnements
 */
export const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
};

/**
 * Statuts des interventions
 */
export const INTERVENTION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * Statuts des demandes de congé
 */
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

/**
 * Types de services
 */
export const SERVICE_TYPES = {
  PLUMBING: 'plomberie',
  HEATING: 'chauffage',
  MAINTENANCE: 'entretien',
  EMERGENCY: 'urgence',
};

export default {
  NETWORK,
  AUTH,
  CACHE,
  VALIDATION,
  FILES,
  UI,
  SECURITY,
  ENV,
  INTERVENTION_STATUS,
  LEAVE_STATUS,
  SERVICE_TYPES,
};
