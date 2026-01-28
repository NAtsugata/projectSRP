// src/services/employeeAlertService.js
// Service pour les alertes rapides des employés (malade, retard, etc.)

import { supabase } from '../lib/supabase';
import { safeStorage } from '../utils/safeStorage';
import logger from '../utils/logger';

const STORAGE_KEY = 'employee_alerts';

// Types d'alertes disponibles
export const ALERT_TYPES = {
  SICK: {
    id: 'sick',
    label: 'Malade',
    emoji: '🤒',
    color: '#ef4444',
    message: 'Je suis malade et ne peux pas travailler aujourd\'hui'
  },
  LATE: {
    id: 'late',
    label: 'En retard',
    emoji: '⏰',
    color: '#f59e0b',
    message: 'Je serai en retard'
  },
  EMERGENCY: {
    id: 'emergency',
    label: 'Urgence',
    emoji: '🚨',
    color: '#dc2626',
    message: 'J\'ai une urgence personnelle'
  },
  CAR_PROBLEM: {
    id: 'car_problem',
    label: 'Panne véhicule',
    emoji: '🚗',
    color: '#6366f1',
    message: 'J\'ai un problème avec mon véhicule'
  },
  OTHER: {
    id: 'other',
    label: 'Autre',
    emoji: '💬',
    color: '#64748b',
    message: ''
  }
};

/**
 * Envoyer une alerte
 */
export const sendAlert = async ({
  employeeId,
  employeeName,
  alertType,
  message,
  interventionId = null,
  estimatedDelay = null
}) => {
  try {
    const alertData = {
      employee_id: employeeId,
      employee_name: employeeName,
      alert_type: alertType,
      message: message || ALERT_TYPES[alertType.toUpperCase()]?.message || '',
      intervention_id: interventionId,
      estimated_delay: estimatedDelay,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    logger.log('🚨 Envoi alerte:', alertData);

    // Essayer d'insérer dans Supabase
    const { data, error } = await supabase
      .from('employee_alerts')
      .insert([alertData])
      .select();

    if (error) {
      // Fallback localStorage si table n'existe pas
      if (error.code === '42P01') {
        logger.warn('⚠️ Table employee_alerts non trouvée, utilisation localStorage');
        return sendAlertFallback(alertData);
      }
      throw error;
    }

    logger.log('✅ Alerte envoyée avec succès');
    return { data: data[0], error: null };

  } catch (error) {
    logger.error('❌ Erreur envoi alerte:', error);
    // Fallback en cas d'erreur
    return sendAlertFallback({
      employee_id: employeeId,
      employee_name: employeeName,
      alert_type: alertType,
      message: message || ALERT_TYPES[alertType.toUpperCase()]?.message || '',
      intervention_id: interventionId,
      estimated_delay: estimatedDelay,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }
};

/**
 * Récupérer les alertes (pour admin)
 */
export const getAlerts = async (options = {}) => {
  try {
    const { status = null, today = false, limit = 50 } = options;

    let query = supabase
      .from('employee_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (today) {
      const todayStr = new Date().toISOString().split('T')[0];
      query = query.gte('created_at', `${todayStr}T00:00:00`);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        return getAlertsFallback(options);
      }
      throw error;
    }

    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur récupération alertes:', error);
    return getAlertsFallback(options);
  }
};

/**
 * Marquer une alerte comme vue/traitée
 */
export const markAlertAsRead = async (alertId) => {
  try {
    const { error } = await supabase
      .from('employee_alerts')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) {
      if (error.code === '42P01') {
        return markAlertAsReadFallback(alertId);
      }
      throw error;
    }

    return { error: null };

  } catch (error) {
    logger.error('❌ Erreur marquage alerte:', error);
    return { error };
  }
};

/**
 * Compter les alertes non lues (pour badge)
 */
export const getUnreadCount = async () => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const { count, error } = await supabase
      .from('employee_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .gte('created_at', `${todayStr}T00:00:00`);

    if (error) {
      if (error.code === '42P01') {
        return getUnreadCountFallback();
      }
      throw error;
    }

    return { count: count || 0, error: null };

  } catch (error) {
    return getUnreadCountFallback();
  }
};

// ========== FALLBACK LOCALSTORAGE ==========

const sendAlertFallback = (alertData) => {
  const alerts = safeStorage.getJSON(STORAGE_KEY, []);
  const newAlert = {
    id: `alert-${Date.now()}`,
    ...alertData
  };
  alerts.unshift(newAlert);
  safeStorage.setJSON(STORAGE_KEY, alerts.slice(0, 100)); // Garder max 100
  return { data: newAlert, error: null };
};

const getAlertsFallback = (options = {}) => {
  let alerts = safeStorage.getJSON(STORAGE_KEY, []);

  if (options.status) {
    alerts = alerts.filter(a => a.status === options.status);
  }

  if (options.today) {
    const todayStr = new Date().toISOString().split('T')[0];
    alerts = alerts.filter(a => a.created_at?.startsWith(todayStr));
  }

  return { data: alerts.slice(0, options.limit || 50), error: null };
};

const markAlertAsReadFallback = (alertId) => {
  const alerts = safeStorage.getJSON(STORAGE_KEY, []);
  const updated = alerts.map(a =>
    a.id === alertId ? { ...a, status: 'read', read_at: new Date().toISOString() } : a
  );
  safeStorage.setJSON(STORAGE_KEY, updated);
  return { error: null };
};

const getUnreadCountFallback = () => {
  const alerts = safeStorage.getJSON(STORAGE_KEY, []);
  const todayStr = new Date().toISOString().split('T')[0];
  const unread = alerts.filter(a =>
    a.status === 'pending' && a.created_at?.startsWith(todayStr)
  );
  return { count: unread.length, error: null };
};

export default {
  ALERT_TYPES,
  sendAlert,
  getAlerts,
  markAlertAsRead,
  getUnreadCount
};
