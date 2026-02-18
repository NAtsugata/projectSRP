// src/services/employeeAlertService.js
// Service pour les alertes rapides des employés (malade, retard, etc.)

import { supabase } from '../lib/supabase';
import { safeStorage } from '../utils/safeStorage';
import logger from '../utils/logger';
import { withOrgId } from '../utils/orgHelper';

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
  return sendAlertFallback(alertData);
};

/**
 * Récupérer les alertes (pour admin)
 */
export const getAlerts = async (options = {}) => {
  return getAlertsFallback(options);
};

/**
 * Marquer une alerte comme vue/traitée
 */
export const markAlertAsRead = async (alertId) => {
  return markAlertAsReadFallback(alertId);
};

/**
 * Compter les alertes non lues (pour badge)
 */
export const getUnreadCount = async () => {
  return getUnreadCountFallback();
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
