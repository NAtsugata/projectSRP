// src/utils/sanitize.js
// Sanitisation XSS avec DOMPurify - Version améliorée

import DOMPurify from 'dompurify';

/**
 * Configuration par défaut pour DOMPurify
 */
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true
};

/**
 * Configuration stricte (texte uniquement)
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true
};

/**
 * Limites de sécurité
 */
const SECURITY_LIMITS = {
  MAX_STRING_LENGTH: 1024 * 1024, // 1MB
  MAX_OBJECT_DEPTH: 10,
  MAX_ARRAY_LENGTH: 10000,
  MAX_OBJECT_KEYS: 1000
};

/**
 * Cache LRU simple pour améliorer les performances
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // Déplacer en fin (plus récent)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Supprimer si existe déjà (pour le replacer en fin)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Supprimer le plus ancien si cache plein
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// Cache global pour les sanitizations fréquentes
const sanitizeCache = new LRUCache(200);

/**
 * Vérifie si une chaîne dépasse la limite de taille
 * @param {string} str - Chaîne à vérifier
 * @param {number} maxLength - Longueur maximale
 * @returns {boolean}
 */
const isWithinSizeLimit = (str, maxLength = SECURITY_LIMITS.MAX_STRING_LENGTH) => {
  return str.length <= maxLength;
};

/**
 * Sanitize du HTML avec DOMPurify
 * @param {string} dirty - HTML non sécurisé
 * @param {Object} config - Configuration DOMPurify (optionnel)
 * @param {Object} options - Options supplémentaires { maxLength, useCache }
 * @returns {string} HTML sécurisé
 */
export const sanitizeHTML = (dirty, config = DEFAULT_CONFIG, options = {}) => {
  if (typeof dirty !== 'string') return '';
  if (!dirty.trim()) return '';

  const { maxLength = SECURITY_LIMITS.MAX_STRING_LENGTH, useCache = true } = options;

  // Vérifier la taille
  if (!isWithinSizeLimit(dirty, maxLength)) {
    console.warn('⚠️ String trop longue pour sanitization:', dirty.length, 'caractères');
    return dirty.substring(0, maxLength);
  }

  // Vérifier le cache
  const cacheKey = `html:${dirty}:${JSON.stringify(config)}`;
  if (useCache) {
    const cached = sanitizeCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  try {
    const sanitized = DOMPurify.sanitize(dirty, config);

    // Mettre en cache
    if (useCache && sanitized.length < 10000) {
      sanitizeCache.set(cacheKey, sanitized);
    }

    return sanitized;
  } catch (error) {
    console.error('Erreur sanitization HTML:', error);
    // Fallback: retirer tous les tags
    return dirty.replace(/<[^>]*>/g, '');
  }
};

/**
 * Sanitize strictement (supprime tous les tags HTML)
 * @param {string} dirty - Texte potentiellement dangereux
 * @param {Object} options - Options { maxLength, useCache }
 * @returns {string} Texte sécurisé sans HTML
 */
export const sanitizeText = (dirty, options = {}) => {
  if (typeof dirty !== 'string') return '';

  const { maxLength = SECURITY_LIMITS.MAX_STRING_LENGTH, useCache = true } = options;

  // Vérifier la taille
  if (!isWithinSizeLimit(dirty, maxLength)) {
    console.warn('⚠️ String trop longue pour sanitization:', dirty.length, 'caractères');
    return dirty.substring(0, maxLength);
  }

  // Vérifier le cache
  const cacheKey = `text:${dirty}`;
  if (useCache) {
    const cached = sanitizeCache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  try {
    const sanitized = DOMPurify.sanitize(dirty, STRICT_CONFIG);

    // Mettre en cache
    if (useCache && sanitized.length < 10000) {
      sanitizeCache.set(cacheKey, sanitized);
    }

    return sanitized;
  } catch (error) {
    console.error('Erreur sanitization texte:', error);
    // Fallback: retirer tous les tags et caractères dangereux
    return String(dirty)
      .replace(/<[^>]*>/g, '')
      .replace(/[<>"'&]/g, (char) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[char] || char;
      });
  }
};

/**
 * Sanitize une URL pour éviter les protocoles dangereux
 * @param {string} url - URL à valider
 * @param {Object} options - Options { allowRelative }
 * @returns {string} URL sécurisée ou chaîne vide si invalide
 */
export const sanitizeURL = (url, options = {}) => {
  if (typeof url !== 'string') return '';

  const { allowRelative = true } = options;
  const trimmed = url.trim();
  if (!trimmed) return '';

  // URLs relatives (chemins, ancres, query strings)
  if (allowRelative) {
    if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
      // Sanitize pour éviter javascript: dans les URLs relatives
      if (trimmed.toLowerCase().includes('javascript:')) return '';
      if (trimmed.toLowerCase().includes('data:')) return '';
      return DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });
    }
  }

  try {
    // Vérifier que l'URL commence par un protocole sûr
    const urlObj = new URL(trimmed);
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

    if (safeProtocols.includes(urlObj.protocol)) {
      return DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });
    }

    return '';
  } catch (error) {
    // Si ce n'est pas une URL absolue valide
    // et que allowRelative est false, retourner vide
    return '';
  }
};

/**
 * Sanitize un objet (nettoie récursivement toutes les chaînes)
 * @param {*} obj - Objet à nettoyer
 * @param {boolean} strict - Utiliser sanitizeText au lieu de sanitizeHTML
 * @param {Object} options - Options { maxDepth, sanitizeKeys, seen }
 * @returns {*} Objet avec toutes les chaînes nettoyées
 */
export const sanitizeObject = (obj, strict = true, options = {}) => {
  const {
    maxDepth = SECURITY_LIMITS.MAX_OBJECT_DEPTH,
    sanitizeKeys = false,
    seen = new WeakSet(),
    currentDepth = 0
  } = options;

  // Protection contre la profondeur excessive
  if (currentDepth >= maxDepth) {
    console.warn('⚠️ Profondeur maximale atteinte lors de la sanitization');
    return obj;
  }

  // Nettoyer les strings directement
  if (typeof obj === 'string') {
    const sanitizeFunc = strict ? sanitizeText : sanitizeHTML;
    return sanitizeFunc(obj);
  }

  // Préserver les types primitifs
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Protection contre les références circulaires
  if (seen.has(obj)) {
    console.warn('⚠️ Référence circulaire détectée');
    return '[Circular]';
  }
  seen.add(obj);

  const sanitizeFunc = strict ? sanitizeText : sanitizeHTML;

  // Préserver les types spéciaux
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj);
  if (obj instanceof Map) {
    const newMap = new Map();
    let count = 0;
    for (const [key, value] of obj) {
      if (count++ >= SECURITY_LIMITS.MAX_OBJECT_KEYS) break;
      const sanitizedKey = sanitizeKeys && typeof key === 'string' ? sanitizeFunc(key) : key;
      newMap.set(sanitizedKey, sanitizeObject(value, strict, { ...options, currentDepth: currentDepth + 1, seen }));
    }
    return newMap;
  }
  if (obj instanceof Set) {
    const newSet = new Set();
    let count = 0;
    for (const value of obj) {
      if (count++ >= SECURITY_LIMITS.MAX_OBJECT_KEYS) break;
      newSet.add(sanitizeObject(value, strict, { ...options, currentDepth: currentDepth + 1, seen }));
    }
    return newSet;
  }

  // Traiter les tableaux
  if (Array.isArray(obj)) {
    // Protection contre les tableaux massifs
    const length = Math.min(obj.length, SECURITY_LIMITS.MAX_ARRAY_LENGTH);
    if (obj.length > length) {
      console.warn(`⚠️ Tableau tronqué de ${obj.length} à ${length} éléments`);
    }
    return obj.slice(0, length).map(item =>
      sanitizeObject(item, strict, { ...options, currentDepth: currentDepth + 1, seen })
    );
  }

  // Traiter les objets
  const cleaned = {};
  const entries = Object.entries(obj);

  // Protection contre trop de clés
  if (entries.length > SECURITY_LIMITS.MAX_OBJECT_KEYS) {
    console.warn(`⚠️ Objet avec trop de clés: ${entries.length}, limité à ${SECURITY_LIMITS.MAX_OBJECT_KEYS}`);
  }

  for (const [key, value] of entries.slice(0, SECURITY_LIMITS.MAX_OBJECT_KEYS)) {
    const sanitizedKey = sanitizeKeys ? sanitizeFunc(key) : key;

    if (typeof value === 'string') {
      cleaned[sanitizedKey] = sanitizeFunc(value);
    } else if (typeof value === 'object' && value !== null) {
      cleaned[sanitizedKey] = sanitizeObject(value, strict, { ...options, currentDepth: currentDepth + 1, seen });
    } else {
      cleaned[sanitizedKey] = value;
    }
  }

  return cleaned;
};

/**
 * Sanitize pour l'affichage dans React (utilise dangerouslySetInnerHTML)
 * @param {string} html - HTML à afficher
 * @param {Object} config - Configuration DOMPurify
 * @returns {Object} Objet pour dangerouslySetInnerHTML
 */
export const createSafeHTML = (html, config = DEFAULT_CONFIG) => {
  return {
    __html: sanitizeHTML(html, config)
  };
};

/**
 * Sanitize un nom de fichier
 * @param {string} filename - Nom de fichier à nettoyer
 * @returns {string} Nom de fichier sécurisé
 */
export const sanitizeFilename = (filename) => {
  if (typeof filename !== 'string') return '';

  return filename
    // Retirer les caractères dangereux
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    // Retirer les points au début (fichiers cachés)
    .replace(/^\.+/, '')
    // Limiter à 255 caractères (limite filesystem)
    .substring(0, 255)
    // Retirer les espaces en début/fin
    .trim()
    // Remplacer les espaces multiples
    .replace(/\s+/g, ' ')
    // Si vide après nettoyage, retourner un nom par défaut
    || 'fichier-sans-nom';
};

/**
 * Sanitize et valide une adresse email
 * @param {string} email - Email à valider
 * @returns {string} Email nettoyé ou chaîne vide si invalide
 */
export const sanitizeEmail = (email) => {
  if (typeof email !== 'string') return '';

  const trimmed = email.trim().toLowerCase();

  // Regex simple pour validation email
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

  if (!emailRegex.test(trimmed)) return '';

  // Longueur maximale (RFC 5321)
  if (trimmed.length > 254) return '';

  return trimmed;
};

/**
 * Sanitize un numéro de téléphone
 * @param {string} phone - Numéro de téléphone
 * @returns {string} Numéro nettoyé (chiffres + +)
 */
export const sanitizePhone = (phone) => {
  if (typeof phone !== 'string') return '';

  // Garder uniquement les chiffres, +, espaces, tirets, parenthèses
  const cleaned = phone.replace(/[^\d\s\-+()]/g, '');

  // Limiter la longueur (max 20 caractères pour numéros internationaux)
  return cleaned.substring(0, 20).trim();
};

/**
 * Sanitize un attribut HTML (nom ou valeur)
 * @param {string} attr - Attribut à nettoyer
 * @returns {string} Attribut sécurisé
 */
export const sanitizeAttribute = (attr) => {
  if (typeof attr !== 'string') return '';

  // Retirer quotes, <, >, &
  return attr
    .replace(/["'<>&]/g, '')
    .trim()
    .substring(0, 1000); // Limite raisonnable
};

/**
 * Efface le cache de sanitization
 */
export const clearSanitizeCache = () => {
  sanitizeCache.clear();
};

/**
 * Obtenir les statistiques du cache
 */
export const getCacheStats = () => {
  return {
    size: sanitizeCache.cache.size,
    maxSize: sanitizeCache.maxSize
  };
};

/**
 * Wrapper pour compatibilité avec l'ancienne fonction sanitizeString
 * @deprecated Utiliser sanitizeText à la place
 */
export const sanitizeString = sanitizeText;

// Export des limites pour tests/configuration
export { SECURITY_LIMITS };

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeObject,
  createSafeHTML,
  sanitizeFilename,
  sanitizeEmail,
  sanitizePhone,
  sanitizeAttribute,
  sanitizeString,
  clearSanitizeCache,
  getCacheStats,
  SECURITY_LIMITS
};
