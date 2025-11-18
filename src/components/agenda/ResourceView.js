// src/components/agenda/ResourceView.js
// Vue des interventions groupées par ressource (employé)

import React, { useMemo } from 'react';
import { AlertTriangleIcon, ClockIcon } from '../SharedUI';
import { checkEmployeeOverload, getUrgentCount, hasSAV } from '../../utils/agendaHelpers';
import './ResourceView.css';

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
        hours: 0
      }
    };
  });

  // Grouper les interventions
  interventions.forEach(itv => {
    if (itv.assigned_to && Array.isArray(itv.assigned_to)) {
      itv.assigned_to.forEach(empId => {
        if (grouped[empId]) {
          grouped[empId].interventions.push(itv);
          grouped[empId].stats.total++;

          if (getUrgentCount(itv) > 0) {
            grouped[empId].stats.urgent++;
          }

          if (hasSAV(itv)) {
            grouped[empId].stats.sav++;
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
 * Composant pour une ligne d'employé
 */
const EmployeeRow = ({ data, onInterventionClick, dateRange }) => {
  const { employee, interventions, stats } = data;

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

  return (
    <div className={`resource-row ${overloadCheck.overloaded ? 'overloaded' : ''}`}>
      <div className="resource-header">
        <div className="resource-info">
          <h3 className="resource-name">{employee.full_name}</h3>
          <div className="resource-stats">
            <span className="stat-badge stat-total">
              {stats.total} intervention{stats.total > 1 ? 's' : ''}
            </span>
            {stats.urgent > 0 && (
              <span className="stat-badge stat-urgent">
                <AlertTriangleIcon className="badge-icon" />
                {stats.urgent} urgent{stats.urgent > 1 ? 's' : ''}
              </span>
            )}
            {stats.sav > 0 && (
              <span className="stat-badge stat-sav">
                {stats.sav} SAV
              </span>
            )}
          </div>
        </div>

        <div className="resource-load">
          <div className="load-info">
            <ClockIcon className="load-icon" />
            <span className="load-hours">
              {stats.hours}h estimées
            </span>
            {overloadCheck.overloaded && (
              <span className="load-warning">
                <AlertTriangleIcon className="warning-icon" />
                Surchargé
              </span>
            )}
          </div>
          <div className="load-bar">
            <div
              className={`load-progress ${overloadCheck.overloaded ? 'overload' : ''}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Liste des interventions */}
      {interventions.length > 0 && (
        <div className="resource-interventions">
          {interventions.map(itv => {
            const urgentCount = getUrgentCount(itv);
            const isSav = hasSAV(itv);

            return (
              <div
                key={itv.id}
                className="intervention-card"
                onClick={() => onInterventionClick && onInterventionClick(itv)}
              >
                <div className="card-header">
                  <span className="card-date">
                    {new Date(itv.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                  <span className="card-time">{itv.time || '08:00'}</span>
                </div>

                <div className="card-content">
                  <h4 className="card-client">{itv.client}</h4>
                  <p className="card-service">{itv.service}</p>
                  {itv.address && (
                    <p className="card-address">📍 {itv.address}</p>
                  )}
                </div>

                <div className="card-badges">
                  {urgentCount > 0 && (
                    <span className="badge badge-urgent">
                      URG {urgentCount}
                    </span>
                  )}
                  {isSav && (
                    <span className="badge badge-sav">SAV</span>
                  )}
                  {itv.status && (
                    <span className={`badge badge-status badge-${itv.status}`}>
                      {itv.status === 'completed' && '✓ Terminée'}
                      {itv.status === 'in_progress' && '🔄 En cours'}
                      {itv.status === 'pending' && '⏳ En attente'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * ResourceView Component
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
  const groupedData = useMemo(() => {
    return groupInterventionsByEmployee(interventions, employees);
  }, [interventions, employees]);

  // Employés sans interventions
  const employeesWithoutWork = groupedData.filter(data => data.interventions.length === 0);
  const employeesWithWork = groupedData.filter(data => data.interventions.length > 0);

  return (
    <div className="resource-view">
      {employeesWithWork.length === 0 ? (
        <div className="resource-empty">
          <ClockIcon className="empty-icon" />
          <p>Aucune intervention assignée pour cette période</p>
        </div>
      ) : (
        <>
          {/* Employés avec interventions */}
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
            <div className="resource-available">
              <h3 className="available-title">
                💤 Employés disponibles ({employeesWithoutWork.length})
              </h3>
              <div className="available-list">
                {employeesWithoutWork.map(data => (
                  <span key={data.employee.id} className="available-badge">
                    {data.employee.full_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResourceView;
