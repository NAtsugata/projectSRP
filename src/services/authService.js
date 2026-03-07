// src/services/authService.js
// Service d'authentification Supabase avec support hors ligne

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import offlineAuthService from './offlineAuthService';

export const authService = {
  /** Sign in with email & password (avec support hors ligne) */
  async signIn(email, password) {
    logger.emoji('🔐', 'Tentative de connexion pour:', email);

    // Vérifier si on est en ligne
    const isOnline = navigator.onLine;
    logger.log('[AuthService] État connexion:', isOnline ? '🌐 En ligne' : '📴 Hors ligne');

    if (!isOnline) {
      // Mode hors ligne : tenter connexion avec cache
      logger.emoji('📴', 'Mode hors ligne - Utilisation du cache local');
      logger.log('[AuthService] Appel de signInOffline...');
      const offlineResult = await offlineAuthService.signInOffline(email, password);
      logger.log('[AuthService] Résultat signInOffline:', offlineResult);

      if (offlineResult.success) {
        return {
          data: {
            session: offlineResult.session,
            user: offlineResult.user
          },
          error: null,
          isOfflineMode: true
        };
      } else {
        return {
          data: { session: null, user: null },
          error: { message: offlineResult.error },
          isOfflineMode: true
        };
      }
    }

    // Mode en ligne : connexion normale
    const result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      logger.error('❌ Erreur de connexion:', result.error);

      // Si échec réseau, tenter mode hors ligne
      if (result.error.message?.includes('Failed to fetch') || result.error.message?.includes('network')) {
        logger.emoji('📴', 'Échec réseau - Basculement en mode hors ligne');
        const offlineResult = await offlineAuthService.signInOffline(email, password);

        if (offlineResult.success) {
          return {
            data: {
              session: offlineResult.session,
              user: offlineResult.user
            },
            error: null,
            isOfflineMode: true
          };
        }
      }
    } else {
      logger.emoji('✅', 'Connexion réussie');

      // Sauvegarder pour le mode hors ligne
      if (result.data?.session && result.data?.user) {
        await offlineAuthService.saveAuthData(
          result.data.session,
          email,
          password,
          result.data.user
        );

        // Synchroniser les données essentielles
        await offlineAuthService.syncOfflineData(supabase, result.data.user.id);
      }
    }

    return result;
  },

  /** Sign out and clean local storage (y compris cache hors ligne) */
  async signOut() {
    logger.emoji('🚪', 'Déconnexion en cours...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          logger.error('❌ Erreur lors de la déconnexion:', error);
        }
      }

      // Clear Supabase-related keys from storage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('supabase')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('supabase')) sessionStorage.removeItem(k);
      });

      // Nettoyer le cache hors ligne
      await offlineAuthService.clearOfflineAuth();

      logger.emoji('✅', 'Déconnexion réussie');
      return { error: null };
    } catch (e) {
      logger.error('❌ Erreur inattendue lors de la déconnexion:', e);
      return { error: e };
    }
  },

  /** Subscribe to auth state changes */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  /** Get current session (avec support cache hors ligne) */
  async getSession() {
    // Essayer d'abord la session Supabase
    const result = await supabase.auth.getSession();

    // Si pas de session online, vérifier le cache hors ligne
    if (!result.data?.session && !navigator.onLine) {
      logger.emoji('📴', 'Vérification session hors ligne...');
      const offlineSession = await offlineAuthService.getCachedAuthSession();
      const offlineUser = await offlineAuthService.getOfflineUserData();
      const isValid = await offlineAuthService.hasOfflineSession();

      if (offlineSession && offlineUser && isValid) {
        logger.emoji('✅', 'Session hors ligne valide trouvée');
        return {
          data: {
            session: offlineSession,
            user: offlineUser
          },
          error: null,
          isOfflineMode: true
        };
      }
    }

    return result;
  },
};

export default authService;
