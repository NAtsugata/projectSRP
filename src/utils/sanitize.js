// src/utils/sanitize.js
// Sanitisation XSS avec DOMPurify

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
 * Sanitize du HTML avec DOMPurify
 * @param {string} dirty - HTML non sécurisé
 * @param {Object} config - Configuration DOMPurify (optionnel)
 * @returns {string} HTML sécurisé
 */
export const sanitizeHTML = (dirty, config = DEFAULT_CONFIG) => {
  if (typeof dirty !== 'string') return '';
  if (!dirty.trim()) return '';

  try {
    return DOMPurify.sanitize(dirty, config);
  } catch (error) {
    console.error('Erreur sanitization HTML:', error);
    // Fallback: retirer tous les tags
    return dirty.replace(/<[^>]*>/g, '');
  }
};

/**
 * Sanitize strictement (supprime tous les tags HTML)
 * @param {string} dirty - Texte potentiellement dangereux
 * @returns {string} Texte sécurisé sans HTML
 */
export const sanitizeText = (dirty) => {
  if (typeof dirty !== 'string') return '';

  try {
    return DOMPurify.sanitize(dirty, STRICT_CONFIG);
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
 * @returns {string} URL sécurisée ou chaîne vide si invalide
 */
export const sanitizeURL = (url) => {
  if (typeof url !== 'string') return '';

  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    // Vérifier que l'URL commence par un protocole sûr
    const urlObj = new URL(trimmed);
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

    if (safeProtocols.includes(urlObj.protocol)) {
      return DOMPurify.sanitize(trimmed, { ALLOWED_TAGS: [] });
    }

    return '';
  } catch (error) {
    // Si ce n'est pas une URL valide, retourner vide
    return '';
  }
};

/**
 * Sanitize un objet (nettoie récursivement toutes les chaînes)
 * @param {Object} obj - Objet à nettoyer
 * @param {boolean} strict - Utiliser sanitizeText au lieu de sanitizeHTML
 * @returns {Object} Objet avec toutes les chaînes nettoyées
 */
export const sanitizeObject = (obj, strict = true) => {
  // Nettoyer les strings directement
  if (typeof obj === 'string') {
    const sanitizeFunc = strict ? sanitizeText : sanitizeHTML;
    return sanitizeFunc(obj);
  }

  if (!obj || typeof obj !== 'object') return obj;

  const sanitizeFunc = strict ? sanitizeText : sanitizeHTML;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, strict));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      cleaned[key] = sanitizeFunc(value);
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeObject(value, strict);
    } else {
      cleaned[key] = value;
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
 * Wrapper pour compatibilité avec l'ancienne fonction sanitizeString
 * @deprecated Utiliser sanitizeText à la place
 */
export const sanitizeString = sanitizeText;

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeObject,
  createSafeHTML,
  sanitizeString
};
