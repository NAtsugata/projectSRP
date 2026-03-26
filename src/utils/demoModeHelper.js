/**
 * Helper pour gérer les restrictions en mode démonstration
 */

import logger from './logger';

/**
 * Vérifie si l'organisation est en mode démonstration
 * @param {Object} organization - L'objet organization du store
 * @returns {boolean}
 */
export function isDemoMode(organization) {
  return organization?.settings?.demo_mode === true || organization?.is_demo === true;
}

/**
 * Wrapper pour l'envoi d'emails qui bloque les envois en mode démo
 * @param {Object} organization - L'organisation courante
 * @param {string} to - Adresse email destinataire
 * @param {string} subject - Sujet de l'email
 * @param {string} body - Corps de l'email
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<{success: boolean, demo: boolean, message?: string}>}
 */
export async function safeSendEmail(organization, to, subject, body, options = {}) {
  if (isDemoMode(organization)) {
    logger.info('[MODE DÉMO] Email non envoyé:', {
      to,
      subject,
      bodyPreview: body?.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      demo: true,
      message: 'Email simulé en mode démonstration (non envoyé réellement)'
    };
  }

  // TODO: Implémenter l'envoi réel d'email ici
  // Par exemple: return await actualEmailService.send(to, subject, body, options);

  logger.warn('Service d\'envoi d\'email non implémenté');
  return {
    success: false,
    demo: false,
    message: 'Service d\'email non configuré'
  };
}

/**
 * Wrapper pour l'envoi de SMS qui bloque les envois en mode démo
 * @param {Object} organization - L'organisation courante
 * @param {string} phone - Numéro de téléphone
 * @param {string} message - Message à envoyer
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<{success: boolean, demo: boolean, message?: string}>}
 */
export async function safeSendSMS(organization, phone, message, options = {}) {
  if (isDemoMode(organization)) {
    logger.info('[MODE DÉMO] SMS non envoyé:', {
      phone,
      messagePreview: message?.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      demo: true,
      message: 'SMS simulé en mode démonstration (non envoyé réellement)'
    };
  }

  // TODO: Implémenter l'envoi réel de SMS ici
  // Par exemple: return await actualSMSService.send(phone, message, options);

  logger.warn('Service d\'envoi de SMS non implémenté');
  return {
    success: false,
    demo: false,
    message: 'Service SMS non configuré'
  };
}

/**
 * Vérifie si une opération externe (paiement, API tierce) doit être bloquée en mode démo
 * @param {Object} organization - L'organisation courante
 * @param {string} operationName - Nom de l'opération
 * @returns {boolean} true si l'opération doit être bloquée
 */
export function shouldBlockExternalOperation(organization, operationName) {
  if (isDemoMode(organization)) {
    logger.warn(`[MODE DÉMO] Opération externe bloquée: ${operationName}`);
    return true;
  }
  return false;
}

/**
 * Affiche un avertissement pour les données de démonstration
 * @param {Object} organization - L'organisation courante
 * @returns {string|null} Message d'avertissement ou null
 */
export function getDemoWarning(organization) {
  if (isDemoMode(organization)) {
    return organization.settings?.demo_banner_text || 'Environnement de démonstration';
  }
  return null;
}

/**
 * Exemple d'utilisation:
 *
 * import { useAuthStore } from '../store/authStore';
 * import { safeSendEmail } from '../utils/demoModeHelper';
 *
 * const MyComponent = () => {
 *   const { organization } = useAuthStore();
 *
 *   const sendNotification = async () => {
 *     const result = await safeSendEmail(
 *       organization,
 *       'client@example.com',
 *       'Rapport d\'intervention',
 *       'Votre intervention est terminée...'
 *     );
 *
 *     if (result.demo) {
 *       // Afficher un message "Email simulé" à l'utilisateur
 *       toast.info('Email simulé (mode démo)');
 *     }
 *   };
 * };
 */
