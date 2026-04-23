// src/utils/connectionMonitor.js
// Moniteur de connexion Supabase avec auto-détection du retour en ligne

import { supabase } from '../lib/supabaseClient';
import logger from './logger';

const state = {
  isOnline: true,
  lastCheck: null,
  consecutiveFailures: 0,
  listeners: [],
  intervalId: null,
  started: false,
};

/**
 * Ping Supabase pour vérifier la connexion réelle (pas seulement navigator.onLine)
 */
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (!error) {
      const wasOffline = !state.isOnline;
      state.isOnline = true;
      state.consecutiveFailures = 0;
      state.lastCheck = Date.now();

      if (wasOffline) {
        logger.log('🟢 [ConnectionMonitor] Supabase de nouveau accessible');
        notifyListeners(true);
      }
      return true;
    }

    handleFailure();
  } catch {
    handleFailure();
  }

  state.lastCheck = Date.now();
  return false;
};

const handleFailure = () => {
  state.consecutiveFailures++;
  const wasOnline = state.isOnline;

  if (state.consecutiveFailures >= 3) {
    state.isOnline = false;
    if (wasOnline) {
      logger.warn('🔴 [ConnectionMonitor] Supabase inaccessible (3 échecs)');
      notifyListeners(false);
    }
  }

  logger.warn(`[ConnectionMonitor] Échec ping ${state.consecutiveFailures}/3`);
};

const notifyListeners = (isOnline) => {
  state.listeners.forEach(cb => {
    try { cb(isOnline); } catch {}
  });
};

/**
 * Démarre le monitoring automatique
 * Ping toutes les 10s + retour de visibilité + event online/offline
 */
export const startConnectionMonitoring = () => {
  if (state.started) return;
  state.started = true;

  // Ping immédiat au démarrage
  checkSupabaseConnection();

  // Ping périodique toutes les 10 secondes
  state.intervalId = setInterval(checkSupabaseConnection, 10000);

  // Ping quand l'onglet redevient visible (retour sur l'app)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSupabaseConnection();
  });

  // Ping quand le navigateur détecte un retour réseau
  window.addEventListener('online', () => {
    logger.log('[ConnectionMonitor] Événement online navigateur');
    checkSupabaseConnection();
  });

  window.addEventListener('offline', () => {
    logger.warn('[ConnectionMonitor] Événement offline navigateur');
    state.consecutiveFailures = 3;
    handleFailure();
  });

  logger.log('[ConnectionMonitor] Monitoring démarré (ping toutes les 10s)');
};

/**
 * S'abonner aux changements de connexion
 * @param {function} callback - Appelé avec (isOnline: boolean)
 * @returns {function} Fonction de désabonnement
 */
export const onConnectionChange = (callback) => {
  state.listeners.push(callback);
  return () => {
    state.listeners = state.listeners.filter(cb => cb !== callback);
  };
};

export const getConnectionState = () => state.isOnline;

/**
 * Force un ping immédiat pour vérifier la connexion
 * Utilisé pour les reconnexions manuelles
 */
export const forceReconnect = async () => {
  logger.log('[ConnectionMonitor] Tentative de reconnexion forcée...');
  state.consecutiveFailures = 0; // Reset des échecs
  return await checkSupabaseConnection();
};
