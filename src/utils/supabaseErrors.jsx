// src/utils/supabaseErrors.js
// Gestion centralisée des erreurs Supabase

/**
 * Messages d'erreur Supabase traduits en français
 */
const ERROR_MESSAGES = {
  // Erreurs d'authentification
  'Invalid login credentials': 'Email ou mot de passe incorrect',
  'Email not confirmed': 'Email non confirmé. Veuillez vérifier votre boîte de réception.',
  'User already registered': 'Cet email est déjà utilisé',
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères',
  'Unable to validate email address': 'Adresse email invalide',
  'Email link is invalid or has expired': 'Le lien email est invalide ou a expiré',
  'Token has expired or is invalid': 'Votre session a expiré. Veuillez vous reconnecter.',
  'User not found': 'Utilisateur non trouvé',
  'New password should be different from the old password': 'Le nouveau mot de passe doit être différent de l\'ancien',
  
  // Erreurs de base de données
  'duplicate key value violates unique constraint': 'Cette donnée existe déjà',
  'violates foreign key constraint': 'Impossible de supprimer : des données liées existent',
  'permission denied': 'Vous n\'avez pas les droits pour effectuer cette action',
  'row-level security policy': 'Accès refusé : vous n\'êtes pas autorisé à accéder à cette ressource',
  'new row violates row-level security policy': 'Vous n\'êtes pas autorisé à créer cette ressource',
  
  // Erreurs réseau
  'Failed to fetch': 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
  'NetworkError': 'Erreur réseau. Vérifiez votre connexion internet.',
  'timeout': 'La requête a pris trop de temps. Veuillez réessayer.',
  
  // Erreurs de storage
  'Bucket not found': 'Espace de stockage non trouvé',
  'Object not found': 'Fichier non trouvé',
  'The resource already exists': 'Ce fichier existe déjà',
  'Payload too large': 'Le fichier est trop volumineux',
  'Invalid mime type': 'Type de fichier non autorisé',
};

/**
 * Codes d'erreur PostgreSQL
 */
const PG_ERROR_CODES = {
  '23505': 'Cette donnée existe déjà (doublon)',
  '23503': 'Impossible de supprimer : des données liées existent',
  '23502': 'Champ requis manquant',
  '42P01': 'Table non trouvée',
  '42703': 'Colonne non trouvée',
  '28P01': 'Authentification échouée',
  'PGRST116': 'Données introuvables',
  'PGRST204': 'Aucun résultat trouvé'
};

/**
 * Classe d'erreur personnalisée pour Supabase
 */
export class SupabaseError extends Error {
  constructor(originalError, context = {}) {
    const message = formatErrorMessage(originalError);
    super(message);
    
    this.name = 'SupabaseError';
    this.originalError = originalError;
    this.context = context;
    this.code = originalError?.code;
    this.details = originalError?.details;
    this.hint = originalError?.hint;
    this.statusCode = originalError?.status;
  }

  toString() {
    return this.message;
  }

  toJSON() {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
      hint: this.hint,
      statusCode: this.statusCode,
      context: this.context
    };
  }
}

/**
 * Formate un message d'erreur Supabase en français
 * @param {Error|Object} error - Erreur Supabase
 * @returns {string} Message d'erreur formaté
 */
export const formatErrorMessage = (error) => {
  if (!error) return 'Une erreur inconnue s\'est produite';

  // Si c'est une chaîne
  if (typeof error === 'string') {
    return translateError(error);
  }

  // Si c'est un objet erreur
  const errorMessage = error.message || error.error || error.msg || '';
  const errorCode = error.code || error.error_code || '';

  // Vérifier les codes PostgreSQL
  if (errorCode && PG_ERROR_CODES[errorCode]) {
    return PG_ERROR_CODES[errorCode];
  }

  // Traduire le message
  return translateError(errorMessage);
};

/**
 * Traduit un message d'erreur en français
 * @param {string} message - Message original
 * @returns {string} Message traduit
 */
const translateError = (message) => {
  if (!message) return 'Une erreur s\'est produite';

  // Chercher une correspondance exacte
  for (const [key, translation] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return translation;
    }
  }

  // Retourner le message original si pas de traduction
  return message;
};

/**
 * Wrapper pour les appels Supabase avec gestion d'erreur améliorée
 * @param {Promise} promise - Promise Supabase
 * @param {Object} context - Contexte pour le debugging
 * @returns {Promise<{data, error}>}
 */
export const handleSupabaseCall = async (promise, context = {}) => {
  try {
    const result = await promise;

    if (result.error) {
      throw new SupabaseError(result.error, context);
    }

    return { data: result.data, error: null };
  } catch (error) {
    if (error instanceof SupabaseError) {
      return { data: null, error };
    }

    return { 
      data: null, 
      error: new SupabaseError(error, context) 
    };
  }
};

/**
 * Vérifie si une erreur est liée à l'authentification
 * @param {Error} error - Erreur à vérifier
 * @returns {boolean}
 */
export const isAuthError = (error) => {
  if (!error) return false;
  
  const authCodes = ['23505', '28P01', 'PGRST301'];
  const authMessages = [
    'Invalid login credentials',
    'JWT expired',
    'Token has expired',
    'session missing',
    'Email not confirmed',
    'User not found'
  ];

  const code = error.code || error.error_code || '';
  const message = error.message || error.error || '';

  return authCodes.includes(code) || 
         authMessages.some(msg => message.includes(msg));
};

/**
 * Vérifie si une erreur est liée au réseau
 * @param {Error} error - Erreur à vérifier
 * @returns {boolean}
 */
export const isNetworkError = (error) => {
  if (!error) return false;
  
  const message = error.message || error.error || '';
  return message.includes('Failed to fetch') || 
         message.includes('NetworkError') ||
         message.includes('timeout') ||
         message.includes('network');
};

/**
 * Suggère une action basée sur le type d'erreur
 * @param {Error} error - Erreur Supabase
 * @returns {string} Suggestion d'action
 */
export const getSuggestion = (error) => {
  if (isAuthError(error)) {
    return 'Veuillez vous reconnecter et réessayer.';
  }

  if (isNetworkError(error)) {
    return 'Vérifiez votre connexion internet et réessayez.';
  }

  const code = error?.code || '';
  if (code === '23505') {
    return 'Veuillez modifier les données et réessayer.';
  }

  if (code === '23503') {
    return 'Supprimez d\'abord les données liées.';
  }

  return 'Si le problème persiste, contactez le support.';
};

export default {
  SupabaseError,
  formatErrorMessage,
  handleSupabaseCall,
  isAuthError,
  isNetworkError,
  getSuggestion
};
