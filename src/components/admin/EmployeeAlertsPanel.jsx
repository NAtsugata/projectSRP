// src/components/admin/EmployeeAlertsPanel.jsx
// Panneau admin pour voir les alertes des employés

import React, { useState, useEffect, useCallback } from 'react';
import { getAlerts, markAlertAsRead, ALERT_TYPES, getUnreadCount } from '../../services/employeeAlertService';
import { Button } from '../ui';
import './EmployeeAlertsPanel.css';

const EmployeeAlertsPanel = ({ onClose }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, read

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const options = {
        limit: 50,
        ...(filter === 'pending' && { status: 'pending' }),
        ...(filter === 'read' && { status: 'read' })
      };
      const { data } = await getAlerts(options);
      setAlerts(data || []);
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleMarkAsRead = async (alertId) => {
    await markAlertAsRead(alertId);
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'read', read_at: new Date().toISOString() } : a
    ));
  };

  const handleMarkAllAsRead = async () => {
    const pendingAlerts = alerts.filter(a => a.status === 'pending');
    for (const alert of pendingAlerts) {
      await markAlertAsRead(alert.id);
    }
    loadAlerts();
  };

  const getAlertTypeInfo = (type) => {
    const upperType = type?.toUpperCase();
    return ALERT_TYPES[upperType] || ALERT_TYPES.OTHER;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const pendingCount = alerts.filter(a => a.status === 'pending').length;

  return (
    <div className="alerts-panel-overlay" onClick={onClose}>
      <div className="alerts-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="alerts-panel-header">
          <div className="header-title">
            <span className="header-icon">🚨</span>
            <h2>Alertes Employés</h2>
            {pendingCount > 0 && (
              <span className="pending-badge">{pendingCount}</span>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Filters */}
        <div className="alerts-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Toutes
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Non lues
          </button>
          <button
            className={`filter-btn ${filter === 'read' ? 'active' : ''}`}
            onClick={() => setFilter('read')}
          >
            Lues
          </button>
          {pendingCount > 0 && (
            <button className="mark-all-btn" onClick={handleMarkAllAsRead}>
              Tout marquer lu
            </button>
          )}
        </div>

        {/* Alerts list */}
        <div className="alerts-list">
          {loading ? (
            <div className="alerts-loading">
              <div className="loading-spinner"></div>
              <p>Chargement...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="alerts-empty">
              <span className="empty-icon">✨</span>
              <p>Aucune alerte</p>
            </div>
          ) : (
            alerts.map(alert => {
              const typeInfo = getAlertTypeInfo(alert.alert_type);
              const isPending = alert.status === 'pending';

              return (
                <div
                  key={alert.id}
                  className={`alert-item ${isPending ? 'pending' : 'read'}`}
                  style={{ '--alert-color': typeInfo.color }}
                >
                  <div className="alert-type-indicator">
                    <span className="type-emoji">{typeInfo.emoji}</span>
                  </div>

                  <div className="alert-content">
                    <div className="alert-header">
                      <span className="alert-employee">{alert.employee_name || 'Employé'}</span>
                      <span className="alert-type-label">{typeInfo.label}</span>
                    </div>

                    {alert.message && (
                      <p className="alert-message">{alert.message}</p>
                    )}

                    {alert.estimated_delay && (
                      <p className="alert-delay">
                        <span className="delay-icon">⏱️</span>
                        Retard estimé: {alert.estimated_delay}
                      </p>
                    )}

                    <div className="alert-footer">
                      <span className="alert-time">{formatTime(alert.created_at)}</span>
                      {isPending && (
                        <button
                          className="mark-read-btn"
                          onClick={() => handleMarkAsRead(alert.id)}
                        >
                          Marquer lu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// Hook pour obtenir le nombre d'alertes non lues
export const useUnreadAlertsCount = (refreshInterval = 30000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count: unreadCount } = await getUnreadCount();
      setCount(unreadCount || 0);
    };

    fetchCount();
    const interval = setInterval(fetchCount, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return count;
};

export default EmployeeAlertsPanel;
