// src/utils/validators.js
// Fonctions de validation pour sécuriser les entrées utilisateur

import { sanitizeText } from './sanitize';
import { FILE_SIZE, fileUtils } from '../config/fileConfig';

/**
 * Valide une adresse email
 * @param {string} email - Email à valider
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Valide un numéro de téléphone français
 * @param {string} phone - Numéro à valider
 * @returns {boolean}
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  // Accepte: 0612345678, 06 12 34 56 78, 06.12.34.56.78, +33612345678
  const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
  return phoneRegex.test(phone.trim());
};

/**
 * Valide un mot de passe
 * @param {string} password - Mot de passe à valider
 * @returns {{ isValid: boolean, message: string }}
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Le mot de passe est requis' };
  }

  if (password.length < 6) {
    return { isValid: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
  }

  return { isValid: true, message: '' };
};

/**
 * Valide une date
 * @param {string} dateString - Date au format YYYY-MM-DD
 * @returns {boolean}
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Valide une plage de dates
 * @param {string} startDate - Date de début
 * @param {string} endDate - Date de fin
 * @returns {{ isValid: boolean, message: string }}
 */
export const validateDateRange = (startDate, endDate) => {
  if (!isValidDate(startDate)) {
    return { isValid: false, message: 'Date de début invalide' };
  }

  if (!isValidDate(endDate)) {
    return { isValid: false, message: 'Date de fin invalide' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    return { isValid: false, message: 'La date de début doit être avant la date de fin' };
  }

  return { isValid: true, message: '' };
};

/**
 * Valide les données d'une intervention
 * @param {Object} intervention - Données d'intervention
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateIntervention = (intervention) => {
  const errors = [];

  if (!intervention.client || intervention.client.trim().length === 0) {
    errors.push('Le nom du client est requis');
  }

  if (!intervention.client_phone || intervention.client_phone.trim().length === 0) {
    errors.push('Le téléphone du client est requis');
  } else if (!isValidPhone(intervention.client_phone)) {
    errors.push('Le numéro de téléphone est invalide (format: 06 12 34 56 78)');
  }

  // Validation optionnelle du téléphone secondaire
  if (intervention.secondary_phone && intervention.secondary_phone.trim().length > 0) {
    if (!isValidPhone(intervention.secondary_phone)) {
      errors.push('Le numéro secondaire est invalide');
    }
  }

  // Validation optionnelle de l'email
  if (intervention.client_email && intervention.client_email.trim().length > 0) {
    if (!isValidEmail(intervention.client_email)) {
      errors.push('L\'email est invalide');
    }
  }

  if (!intervention.address || intervention.address.trim().length === 0) {
    errors.push('L\'adresse est requise');
  }

  if (!intervention.service || intervention.service.trim().length === 0) {
    errors.push('Le type de service est requis');
  }

  if (!isValidDate(intervention.date)) {
    errors.push('La date est invalide');
  }

  if (!intervention.time) {
    errors.push('L\'heure est requise');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valide les données d'un utilisateur
 * @param {Object} user - Données utilisateur
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateUser = (user) => {
  const errors = [];

  if (!user.full_name || user.full_name.trim().length < 2) {
    errors.push('Le nom complet doit contenir au moins 2 caractères');
  }

  if (user.full_name && user.full_name.length > 100) {
    errors.push('Le nom complet ne peut pas dépasser 100 caractères');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valide une demande de congé
 * @param {Object} leaveRequest - Demande de congé
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateLeaveRequest = (leaveRequest) => {
  const errors = [];

  const dateValidation = validateDateRange(leaveRequest.startDate, leaveRequest.endDate);
  if (!dateValidation.isValid) {
    errors.push(dateValidation.message);
  }

  if (!leaveRequest.reason || leaveRequest.reason.trim().length === 0) {
    errors.push('Le motif est requis');
  }

  if (leaveRequest.reason && leaveRequest.reason.length > 500) {
    errors.push('Le motif ne peut pas dépasser 500 caractères');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Nettoie une chaîne de caractères pour éviter les injections
 * ✅ Utilise DOMPurify pour une sanitisation XSS robuste
 * @param {string} str - Chaîne à nettoyer
 * @returns {string}
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  // ✅ Utilise DOMPurify pour une sanitisation robuste contre XSS
  const cleaned = sanitizeText(str);
  // Limite la longueur
  return cleaned.substring(0, 1000);
};

/**
 * Valide une taille de fichier
 * ✅ Utilise fileConfig pour les limites centralisées
 * @param {number} fileSize - Taille en bytes
 * @param {number} maxSize - Taille maximale en MB (défaut: 10MB)
 * @returns {{ isValid: boolean, message: string }}
 */
export const validateFileSize = (fileSize, maxSize = 10) => {
  const maxBytes = fileUtils.mbToBytes(maxSize);

  if (fileSize > maxBytes) {
    return {
      isValid: false,
      message: `Le fichier est trop volumineux (max: ${fileUtils.formatFileSize(maxBytes)})`
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Valide un type de fichier
 * @param {string} fileName - Nom du fichier
 * @param {string[]} allowedTypes - Extensions autorisées
 * @returns {{ isValid: boolean, message: string }}
 */
export const validateFileType = (fileName, allowedTypes = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']) => {
  if (!fileName) {
    return { isValid: false, message: 'Nom de fichier invalide' };
  }

  const extension = fileName.split('.').pop().toLowerCase();

  if (!allowedTypes.includes(extension)) {
    return {
      isValid: false,
      message: `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(', ')}`
    };
  }

  return { isValid: true, message: '' };
};

const validators = {
  isValidEmail,
  validatePassword,
  isValidDate,
  validateDateRange,
  validateIntervention,
  validateUser,
  validateLeaveRequest,
  sanitizeString,
  validateFileSize,
  validateFileType
};

export default validators;
