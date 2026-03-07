// src/services/offlineAuthService.js
// Service d'authentification hors ligne avec IndexedDB

import {
  cacheAuthSession,
  getCachedAuthSession,
  cacheAuthCredentials,
  verifyOfflineCredentials,
  clearAuthSession,
  clearAuthCache,
  cacheUserData,
  getCachedUserData,
  isSessionValid,
  cacheProfiles
} from '../utils/offlineStorage';
import logger from '../utils/logger';

/**
 * Hash simple pour le mot de passe (pour vérification hors ligne)
 * Utilise Web Crypto API pour un hash sécurisé
 * @param {string} password
 * @returns {Promise<string>} Hash en hex
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sauvegarde la session après une connexion réussie
 * @param {Object} session - Session Supabase
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe (sera hashé)
 */
export async function saveAuthData(session, email, password, userProfile = null) {
  try {
    // Sauvegarder la session
    await cacheAuthSession(session);

    // Hasher et sauvegarder les credentials pour vérification offline
    const passwordHash = await hashPassword(password);
    await cacheAuthCredentials(email, passwordHash);

    // Sauvegarder les données utilisateur si fournies
    if (userProfile) {
      await cacheUserData(userProfile);
    }

    logger.log('[OfflineAuth] ✅ Données auth sauvegardées pour mode hors ligne');
    return true;
  } catch (error) {
    logger.error('[OfflineAuth] ❌ Erreur sauvegarde auth:', error);
    return false;
  }
}

/**
 * Vérifie si l'utilisateur peut se connecter hors ligne
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, session?: Object, user?: Object, error?: string}>}
 */
export async function signInOffline(email, password) {
  try {
    logger.log('[OfflineAuth] 🔍 Tentative de connexion hors ligne pour:', email);

    // Hasher le mot de passe fourni
    logger.log('[OfflineAuth] 1/3 Hash du mot de passe...');
    const passwordHash = await hashPassword(password);
    logger.log('[OfflineAuth] Hash généré:', passwordHash.substring(0, 20) + '...');

    // Vérifier les credentials
    logger.log('[OfflineAuth] 2/3 Vérification credentials...');
    const credentialsValid = await verifyOfflineCredentials(email, passwordHash);
    logger.log('[OfflineAuth] Credentials valides:', credentialsValid);

    if (!credentialsValid) {
      logger.warn('[OfflineAuth] ❌ Credentials invalides (email ou mot de passe incorrect)');
      return {
        success: false,
        error: 'Email ou mot de passe incorrect.'
      };
    }

    // Récupérer les données utilisateur (nécessaire pour le profil)
    logger.log('[OfflineAuth] 3/3 Récupération user data...');
    const userData = await getCachedUserData();
    logger.log('[OfflineAuth] User data récupéré:', userData ? 'Oui' : 'Non');

    if (!userData) {
      logger.warn('[OfflineAuth] ❌ User data manquant');
      return {
        success: false,
        error: 'Données utilisateur introuvables. Connexion internet requise.'
      };
    }

    // Créer une session offline basique (pas besoin de l'ancienne session)
    const offlineSession = {
      access_token: 'offline-mode-token',
      refresh_token: 'offline-mode-refresh',
      user: userData,
      expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 jours
      token_type: 'bearer'
    };

    // Sauvegarder la nouvelle session
    await cacheAuthSession(offlineSession);
    logger.log('[OfflineAuth] ✅ Nouvelle session offline créée');

    logger.log('[OfflineAuth] ✅ Connexion hors ligne réussie');
    return {
      success: true,
      session: offlineSession,
      user: userData,
      isOfflineMode: true
    };
  } catch (error) {
    logger.error('[OfflineAuth] ❌ Erreur connexion hors ligne:', error);
    return {
      success: false,
      error: 'Erreur lors de la connexion hors ligne.'
    };
  }
}

/**
 * Nettoie seulement la session (garde credentials pour reconnexion offline)
 * À utiliser lors de la déconnexion normale
 */
export async function clearOfflineAuthSession() {
  try {
    await clearAuthSession();
    logger.log('[OfflineAuth] ✅ Session effacée (credentials conservés pour offline)');
    return true;
  } catch (error) {
    logger.error('[OfflineAuth] ❌ Erreur effacement session:', error);
    return false;
  }
}

/**
 * Nettoie toutes les données d'authentification (credentials + session + user data)
 * À utiliser uniquement pour changement d'utilisateur ou nettoyage complet
 */
export async function clearOfflineAuth() {
  try {
    await clearAuthCache();
    logger.log('[OfflineAuth] ✅ Toutes les données auth effacées');
    return true;
  } catch (error) {
    logger.error('[OfflineAuth] ❌ Erreur effacement auth:', error);
    return false;
  }
}

/**
 * Vérifie si une session hors ligne existe
 */
export async function hasOfflineSession() {
  try {
    const session = await getCachedAuthSession();
    const valid = await isSessionValid();
    return !!(session && valid);
  } catch (error) {
    return false;
  }
}

/**
 * Récupère les données utilisateur en cache
 */
export async function getOfflineUserData() {
  try {
    return await getCachedUserData();
  } catch (error) {
    logger.error('[OfflineAuth] Erreur récupération user data:', error);
    return null;
  }
}

/**
 * Synchronise les données essentielles pour le mode hors ligne
 * À appeler après une connexion réussie avec internet
 */
export async function syncOfflineData(supabase, userId) {
  try {
    logger.log('[OfflineAuth] Synchronisation données hors ligne...');

    // Récupérer le profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Récupérer tous les profils (pour l'app)
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) throw profilesError;

    // Sauvegarder les profils
    await cacheProfiles(allProfiles || []);

    // Sauvegarder les données utilisateur
    await cacheUserData(profile);

    logger.log('[OfflineAuth] ✅ Synchronisation terminée');
    return true;
  } catch (error) {
    logger.error('[OfflineAuth] ❌ Erreur synchronisation:', error);
    return false;
  }
}

// Réexporter les fonctions du cache pour un accès direct
export { getCachedAuthSession, isSessionValid };

export default {
  saveAuthData,
  signInOffline,
  clearOfflineAuthSession,
  clearOfflineAuth,
  hasOfflineSession,
  getOfflineUserData,
  syncOfflineData,
  getCachedAuthSession,
  isSessionValid
};
