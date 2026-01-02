// src/services/authService.js
// Service d'authentification Supabase

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export const authService = {
  /** Sign in with email & password */
  async signIn(email, password) {
    logger.emoji('🔐', 'Tentative de connexion pour:', email);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      logger.error('❌ Erreur de connexion:', result.error);
    } else {
      logger.emoji('✅', 'Connexion réussie');
    }
    return result;
  },

  /** Sign out and clean local storage */
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

  /** Get current session */
  getSession() {
    return supabase.auth.getSession();
  },
};

export default authService;
