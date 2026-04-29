import { supabase } from '../lib/supabaseClient';
import logger from './logger';

const state = {
  isOnline: true,
  lastCheck: null,
  consecutiveFailures: 0,
  listeners: [],
  intervalId: null,
  started: false,
  // Stored handlers so they can be removed
  handlers: {},
};

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
      // Only log the state transition, not every individual failure
      logger.warn('🔴 [ConnectionMonitor] Supabase inaccessible (3 échecs consécutifs)');
      notifyListeners(false);
    }
  }
};

const notifyListeners = (isOnline) => {
  state.listeners.forEach(cb => {
    try { cb(isOnline); } catch {}
  });
};

export const startConnectionMonitoring = () => {
  if (state.started) return;
  state.started = true;

  checkSupabaseConnection();

  // 30s interval — events (online/visibilitychange) handle the fast path
  state.intervalId = setInterval(checkSupabaseConnection, 30000);

  state.handlers.visibilitychange = () => {
    if (!document.hidden) checkSupabaseConnection();
  };
  state.handlers.online = () => {
    logger.log('[ConnectionMonitor] Événement online navigateur');
    checkSupabaseConnection();
  };
  state.handlers.offline = () => {
    logger.warn('[ConnectionMonitor] Événement offline navigateur');
    state.consecutiveFailures = 3;
    handleFailure();
  };

  document.addEventListener('visibilitychange', state.handlers.visibilitychange);
  window.addEventListener('online', state.handlers.online);
  window.addEventListener('offline', state.handlers.offline);

  logger.log('[ConnectionMonitor] Monitoring démarré (ping toutes les 30s)');
};

export const stopConnectionMonitoring = () => {
  if (!state.started) return;
  clearInterval(state.intervalId);
  document.removeEventListener('visibilitychange', state.handlers.visibilitychange);
  window.removeEventListener('online', state.handlers.online);
  window.removeEventListener('offline', state.handlers.offline);
  state.started = false;
  state.intervalId = null;
};

export const onConnectionChange = (callback) => {
  state.listeners.push(callback);
  return () => {
    state.listeners = state.listeners.filter(cb => cb !== callback);
  };
};

export const getConnectionState = () => state.isOnline;

export const forceReconnect = async () => {
  logger.log('[ConnectionMonitor] Reconnexion forcée...');
  state.consecutiveFailures = 0;
  return await checkSupabaseConnection();
};
