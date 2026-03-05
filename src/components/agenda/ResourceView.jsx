// src/components/agenda/ResourceView.js
// Vue des interventions groupées par ressource (employé) - Version Admin améliorée

import React, { useMemo, useState } from 'react';
import { AlertTriangleIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon, MapPinIcon } from '../SharedUI';
import { getUrgentCount, hasSAV, getUserColor } from '../../utils/agendaHelpers';
import './ResourceView.css';

/**
 * Génère une couleur avatar basée sur le nom
 */
const getAvatarColor = (name) => {
  const colors = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a18cd1', '#fbc2eb'],
    ['#ff9a9e', '#fecfef'],
    ['#6a11cb', '#2575fc']
  ];
  const index = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[index];
};

/**
 * Groupe les interventions par employé
 */
const groupInterventionsByEmployee = (interventions, employees) => {
  const grouped = {};

  // Initialiser pour chaque employé
  employees.forEach(emp => {
    grouped[emp.id] = {
      employee: emp,
      interventions: [],
      stats: {
        total: 0,
        urgent: 0,
        sav: 0,
        hours: 0,
        completed: 0,
        inProgress: 0
      }
    };
  });

  // Grouper les interventions
  interventions.forEach(itv => {
    // Utiliser intervention_assignments (structure réelle de la BDD)
    const assignments = itv.intervention_assignments;
    if (assignments && Array.isArray(assignments)) {
      assignments.forEach(assignment => {
        const empId = assignment.user_id;
        if (grouped[empId]) {
          grouped[empId].interventions.push(itv);
          grouped[empId].stats.total++;

          if (getUrgentCount(itv) > 0) {
            grouped[empId].stats.urgent++;
          }

          if (hasSAV(itv)) {
            grouped[empId].stats.sav++;
          }

          if (itv.status === 'completed') {
            grouped[empId].stats.completed++;
          } else if (itv.status === 'in_progress') {
            grouped[empId].stats.inProgress++;
          }

          // Estimation 2h par intervention
          grouped[empId].stats.hours += 2;
        }
      });
    }
  });

  // Trier par nombre d'interventions (décroissant)
  return Object.values(grouped).sort((a, b) => b.stats.total - a.stats.total);
};

/**
 * Composant pour une ligne d'employé - Version Admin améliorée
 */
const EmployeeRow = ({ data, onInterventionClick, dateRange }) => {
  const { employee, interventions, stats } = data;
  const [isExpanded, setIsExpanded] = useState(true);

  // Couleurs avatar
  const avatarColors = useMemo(() => getAvatarColor(employee.full_name), [employee.full_name]);

  // Vérifier la surcharge
  const overloadCheck = useMemo(() => {
    if (!dateRange) return { overloaded: false, hours: stats.hours };

    // Pour simplifier, on vérifie la charge totale sur la période
    return {
      overloaded: stats.hours > 40, // 8h * 5 jours
      hours: stats.hours,
      maxHours: 40
    };
  }, [stats.hours, dateRange]);

  // Calculer la barre de progression
  const progressPercent = Math.min((stats.hours / 40) * 100, 100);
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Trier les interventions par date
  const sortedInterventions = useMemo(() => {
    return [...interventions].sort((a, b) => {
      const dateCompare = a.date?.localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [interventions]);

  return (
    <div className={`resource-row ${overloadCheck.overloaded ? 'overloaded' : ''}`}>
      <div className="resource-header" onClick={() => setIsExpanded(!isExpanded)}>
        {/* Avatar et infos employé */}
        <div className="resource-employee">
          <div
            className="employee-avatar-large"
            style={{
              background: `linear-gradient(135deg, ${avatarColors[0]}, ${avatarColors[1]})`
            }}
          >
            {employee.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="employee-details">
            <h3 className="resource-name">{employee.full_name}</h3>
            <div className="resource-stats">
              <span className="stat-badge stat-total">
                {stats.total} intervention{stats.total > 1 ? 's' : ''}
              </span>
              {stats.urgent > 0 && (
                <span className="stat-badge stat-urgent">
                  <AlertTriangleIcon className="badge-icon" />
                  {stats.urgent}
                </span>
              )}
              {stats.sav > 0 && (
                <span className="stat-badge stat-sav">
                  {stats.sav} SAV
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Barre de progression et charge */}
        <div className="resource-load-section">
          <div className="load-stats-grid">
            <div className="load-stat">
              <span className="load-stat-value">{stats.hours}h</span>
              <span className="load-stat-label">Estimées</span>
            </div>
            <div className="load-stat">
              <span className="load-stat-value">{completionRate}%</span>
              <span className="load-stat-label">Complétées</span>
            </div>
            <div className="load-stat">
              <span className={`load-stat-value ${overloadCheck.overloaded ? 'overload-text' : ''}`}>
                {overloadCheck.overloaded ? 'Surchargé' : 'OK'}
              </span>
              <span className="load-stat-label">Statut</span>
            </div>
          </div>

          <div className="load-bar-container">
            <div className="load-bar">
              <div
                className={`load-progress ${overloadCheck.overloaded ? 'overload' : ''}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="load-percent">{Math.round(progressPercent)}%</span>
          </div>
        </div>

        {/* Bouton expand */}
        <button className="expand-btn" aria-label={isExpanded ? 'Réduire' : 'Développer'}>
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>
      </div>

      {/* Liste des interventions */}
      {isExpanded && interventions.length > 0 && (
        <div className="resource-interventions">
          {sortedInterventions.map(itv => {
            const urgentCount = getUrgentCount(itv);
            const isSav = hasSAV(itv);
            const statusColor = itv.status === 'completed' ? '#22c55e' :
                               itv.status === 'in_progress' ? '#3b82f6' : '#f59e0b';

            return (
              <div
                key={itv.id}
                className={`intervention-card intervention-${itv.status || 'pending'}`}
                onClick={() => onInterventionClick && onInterventionClick(itv)}
              >
                <div className="card-status-bar" style={{ backgroundColor: statusColor }} />

                <div className="card-header">
                  <div className="card-datetime">
                    <span className="card-date">
                      {new Date(itv.date).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                    <span className="card-time">{itv.time || '08:00'}</span>
                  </div>
                  <div className="card-status-badge" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                    {itv.status === 'completed' ? 'Terminée' :
                     itv.status === 'in_progress' ? 'En cours' : 'En attente'}
                  </div>
                </div>

                <div className="card-content">
                  <h4 className="card-client">{itv.client}</h4>
                  {itv.service && <p className="card-service">{itv.service}</p>}
                  {itv.address && (
                    <p className="card-address">
                      <MapPinIcon className="address-icon" />
                      {itv.address}
                    </p>
                  )}
                </div>

                {(urgentCount > 0 || isSav) && (
                  <div className="card-alerts">
                    {urgentCount > 0 && (
                      <span className="alert-badge alert-urgent">
                        <AlertTriangleIcon className="alert-badge-icon" />
                        {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {isSav && (
                      <span className="alert-badge alert-sav">SAV</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * ResourceView Component - Version Admin améliorée
 * @param {Array} interventions - Liste des interventions
 * @param {Array} employees - Liste des employés
 * @param {Function} onInterventionClick - Handler pour le clic sur une intervention
 * @param {Object} dateRange - Plage de dates
 */
const ResourceView = ({
  interventions = [],
  employees = [],
  onInterventionClick,
  dateRange
}) => {
  const [sortBy, setSortBy] = useState('interventions'); // 'interventions', 'name', 'hours'
  const [showAvailable, setShowAvailable] = useState(true);

  const groupedData = useMemo(() => {
    return groupInterventionsByEmployee(interventions, employees);
  }, [interventions, employees]);

  // Employés avec et sans interventions
  const employeesWithWork = useMemo(() => {
    const filtered = groupedData.filter(data => data.interventions.length > 0);

    // Tri
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.employee.full_name || '').localeCompare(b.employee.full_name || '');
        case 'hours':
          return b.stats.hours - a.stats.hours;
        default:
          return b.stats.total - a.stats.total;
      }
    });
  }, [groupedData, sortBy]);

  const employeesWithoutWork = groupedData.filter(data => data.interventions.length === 0);

  // Stats globales
  const globalStats = useMemo(() => {
    const total = employeesWithWork.reduce((sum, e) => sum + e.stats.total, 0);
    const overloaded = employeesWithWork.filter(e => e.stats.hours > 8).length;
    return { total, overloaded, active: employeesWithWork.length };
  }, [employeesWithWork]);

  return (
    <div className="resource-view resource-view-admin">
      {/* En-tête avec résumé et tri */}
      <div className="resource-view-header">
        <div className="resource-summary">
          <div className="summary-stat">
            <span className="summary-value">{globalStats.active}</span>
            <span className="summary-label">Techniciens actifs</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{globalStats.total}</span>
            <span className="summary-label">Interventions</span>
          </div>
          {globalStats.overloaded > 0 && (
            <div className="summary-stat summary-warning">
              <span className="summary-value">{globalStats.overloaded}</span>
              <span className="summary-label">Surchargés</span>
            </div>
          )}
        </div>

        <div className="resource-controls">
          <label className="sort-label">Trier par:</label>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="interventions">Nb interventions</option>
            <option value="hours">Heures</option>
            <option value="name">Nom</option>
          </select>
        </div>
      </div>

      {employeesWithWork.length === 0 ? (
        <div className="resource-empty">
          <ClockIcon className="empty-icon" />
          <p className="empty-title">Aucune intervention assignée</p>
          <p className="empty-subtitle">Aucun technicien n'a d'intervention pour cette période</p>
        </div>
      ) : (
        <>
          {/* Liste des employés actifs */}
          <div className="resource-list">
            {employeesWithWork.map(data => (
              <EmployeeRow
                key={data.employee.id}
                data={data}
                onInterventionClick={onInterventionClick}
                dateRange={dateRange}
              />
            ))}
          </div>

          {/* Employés disponibles */}
          {employeesWithoutWork.length > 0 && (
            <div className="resource-available-section">
              <button
                className="available-toggle"
                onClick={() => setShowAvailable(!showAvailable)}
              >
                <span className="available-toggle-icon">{showAvailable ? '−' : '+'}</span>
                <span className="available-toggle-text">
                  Techniciens disponibles ({employeesWithoutWork.length})
                </span>
              </button>

              {showAvailable && (
                <div className="available-grid">
                  {employeesWithoutWork.map(data => {
                    const colors = getAvatarColor(data.employee.full_name);
                    return (
                      <div key={data.employee.id} className="available-employee">
                        <div
                          className="available-avatar"
                          style={{
                            background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
                          }}
                        >
                          {data.employee.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="available-name">{data.employee.full_name}</span>
                        <span className="available-status">Libre</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResourceView;
