// src/components/agenda/AgendaDashboard.js
// Dashboard avec statistiques et KPIs pour l'agenda

import React, { useMemo } from 'react';
import { AlertTriangleIcon, ClockIcon, UsersIcon, CheckCircleIcon } from '../SharedUI';
import { getUrgentCount, hasSAV } from '../../utils/agendaHelpers';
import './AgendaDashboard.css';

/**
 * Calcule les statistiques des interventions
 */
const calculateStats = (interventions, employees) => {
  const stats = {
    total: interventions.length,
    urgent: 0,
    sav: 0,
    unassigned: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    employeeLoad: {},
    overloadedEmployees: []
  };

  // Initialiser la charge de chaque employé
  employees.forEach(emp => {
    stats.employeeLoad[emp.id] = {
      name: emp.full_name,
      count: 0,
      hours: 0
    };
  });

  // Analyser chaque intervention
  interventions.forEach(itv => {
    // Compter les urgents
    if (getUrgentCount(itv) > 0) {
      stats.urgent++;
    }

    // Compter les SAV
    if (hasSAV(itv)) {
      stats.sav++;
    }

    // Compter les non assignées
    if (!itv.assigned_to || itv.assigned_to.length === 0) {
      stats.unassigned++;
    }

    // Compter par statut
    if (itv.status === 'completed') {
      stats.completed++;
    } else if (itv.status === 'in_progress') {
      stats.inProgress++;
    } else {
      stats.pending++;
    }

    // Calculer la charge par employé (estimation : 2h par intervention)
    const estimatedHours = 2;
    if (itv.assigned_to && Array.isArray(itv.assigned_to)) {
      itv.assigned_to.forEach(userId => {
        if (stats.employeeLoad[userId]) {
          stats.employeeLoad[userId].count++;
          stats.employeeLoad[userId].hours += estimatedHours;
        }
      });
    }
  });

  // Identifier les employés surchargés (>8h)
  Object.entries(stats.employeeLoad).forEach(([userId, load]) => {
    if (load.hours > 8) {
      stats.overloadedEmployees.push({
        id: userId,
        name: load.name,
        count: load.count,
        hours: load.hours
      });
    }
  });

  // Calculer la charge moyenne
  const totalHours = Object.values(stats.employeeLoad).reduce((sum, load) => sum + load.hours, 0);
  stats.averageLoad = employees.length > 0 ? (totalHours / employees.length).toFixed(1) : 0;

  return stats;
};

/**
 * AgendaDashboard Component
 * @param {Array} interventions - Liste des interventions filtrées
 * @param {Array} allInterventions - Liste complète (pour comparaison)
 * @param {Array} employees - Liste des employés
 * @param {Object} dateRange - Plage de dates affichée
 */
const AgendaDashboard = ({
  interventions = [],
  allInterventions = [],
  employees = [],
  dateRange
}) => {
  const stats = useMemo(() => {
    return calculateStats(interventions, employees);
  }, [interventions, employees]);

  const formatDateRange = () => {
    if (!dateRange) return '';
    const start = dateRange.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const end = dateRange.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${start} - ${end}`;
  };

  return (
    <div className="agenda-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">
          <ClockIcon className="dashboard-icon" />
          Vue d'ensemble
          {dateRange && (
            <span className="dashboard-period">{formatDateRange()}</span>
          )}
        </h2>
      </div>

      <div className="dashboard-grid">
        {/* Total interventions */}
        <div className="dashboard-card">
          <div className="card-icon card-icon-primary">
            <CheckCircleIcon />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.total}</div>
            <div className="card-label">Interventions</div>
            {allInterventions.length > stats.total && (
              <div className="card-subtitle">
                ({allInterventions.length} au total)
              </div>
            )}
          </div>
        </div>

        {/* Interventions urgentes */}
        <div className="dashboard-card">
          <div className="card-icon card-icon-warning">
            <AlertTriangleIcon />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.urgent}</div>
            <div className="card-label">Besoins urgents</div>
            {stats.urgent > 0 && (
              <div className="card-subtitle card-subtitle-warning">
                Nécessitent attention
              </div>
            )}
          </div>
        </div>

        {/* SAV à prévoir */}
        <div className="dashboard-card">
          <div className="card-icon card-icon-info">
            <ClockIcon />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.sav}</div>
            <div className="card-label">SAV à prévoir</div>
          </div>
        </div>

        {/* Non assignées */}
        <div className="dashboard-card">
          <div className="card-icon card-icon-secondary">
            <UsersIcon />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.unassigned}</div>
            <div className="card-label">Non assignées</div>
            {stats.unassigned > 0 && (
              <div className="card-subtitle card-subtitle-warning">
                À assigner rapidement
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alertes de surcharge */}
      {stats.overloadedEmployees.length > 0 && (
        <div className="dashboard-alerts">
          <div className="alert alert-warning">
            <AlertTriangleIcon className="alert-icon" />
            <div className="alert-content">
              <div className="alert-title">
                ⚠️ {stats.overloadedEmployees.length} employé(s) surchargé(s)
              </div>
              <div className="alert-list">
                {stats.overloadedEmployees.map(emp => (
                  <div key={emp.id} className="alert-item">
                    <strong>{emp.name}</strong> : {emp.count} interventions
                    ({emp.hours}h estimées, seuil : 8h)
                  </div>
                ))}
              </div>
              <div className="alert-hint">
                💡 Conseil : Redistribuez certaines interventions pour équilibrer la charge
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques complémentaires */}
      <div className="dashboard-stats">
        <div className="stat-item">
          <span className="stat-label">Charge moyenne :</span>
          <span className="stat-value">{stats.averageLoad}h / employé</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Statut :</span>
          <span className="stat-value">
            {stats.pending} en attente, {stats.inProgress} en cours, {stats.completed} terminées
          </span>
        </div>
      </div>
    </div>
  );
};

export default AgendaDashboard;
