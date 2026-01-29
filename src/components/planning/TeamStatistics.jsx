// src/components/planning/TeamStatistics.jsx
// Statistiques des équipes pour le planning

import React, { useMemo } from 'react';
import { UsersIcon, CheckCircleIcon, ClockIcon } from '../SharedUI';
import './TeamStatistics.css';

const TeamStatistics = ({ interventions = [], users = [] }) => {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;

    // Interventions du mois
    const monthInterventions = interventions.filter(itv => {
      const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
      return dates.some(d => d >= monthStart && d <= monthEnd);
    });

    const total = monthInterventions.length;
    const completed = monthInterventions.filter(i => i.status === 'Terminée').length;
    const inProgress = monthInterventions.filter(i => i.status === 'En cours').length;
    const upcoming = total - completed - inProgress;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Stats par employé
    const employeeStats = {};
    users.forEach(u => {
      employeeStats[u.id] = {
        id: u.id,
        name: u.full_name || u.email || '?',
        total: 0,
        completed: 0,
        inProgress: 0
      };
    });

    monthInterventions.forEach(itv => {
      const assignments = itv.intervention_assignments || [];
      assignments.forEach(a => {
        if (employeeStats[a.user_id]) {
          employeeStats[a.user_id].total++;
          if (itv.status === 'Terminée') employeeStats[a.user_id].completed++;
          if (itv.status === 'En cours') employeeStats[a.user_id].inProgress++;
        }
      });
    });

    const employeeList = Object.values(employeeStats)
      .filter(e => e.total > 0)
      .sort((a, b) => b.total - a.total);

    // Stats par service
    const serviceStats = {};
    monthInterventions.forEach(itv => {
      const service = itv.service || 'Non défini';
      if (!serviceStats[service]) {
        serviceStats[service] = { name: service, total: 0, completed: 0 };
      }
      serviceStats[service].total++;
      if (itv.status === 'Terminée') serviceStats[service].completed++;
    });

    const serviceList = Object.values(serviceStats).sort((a, b) => b.total - a.total);

    // Jours les plus chargés
    const dayLoad = {};
    monthInterventions.forEach(itv => {
      const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
      dates.forEach(d => {
        if (d >= monthStart && d <= monthEnd) {
          dayLoad[d] = (dayLoad[d] || 0) + 1;
        }
      });
    });

    const busiestDays = Object.entries(dayLoad)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([date, count]) => ({
        date,
        count,
        dayName: new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        })
      }));

    return {
      total,
      completed,
      inProgress,
      upcoming,
      completionRate,
      employeeList,
      serviceList,
      busiestDays,
      monthName: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    };
  }, [interventions, users]);

  return (
    <div className="team-statistics">
      <div className="stats-header">
        <h3>Statistiques du mois</h3>
        <span className="stats-period">{stats.monthName}</span>
      </div>

      {/* Résumé global */}
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">Terminées</div>
        </div>
        <div className="stat-card in-progress">
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">En cours</div>
        </div>
        <div className="stat-card upcoming">
          <div className="stat-value">{stats.upcoming}</div>
          <div className="stat-label">A venir</div>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="stats-progress-section">
        <div className="progress-header">
          <span>Taux de complétion</span>
          <span className="progress-value">{stats.completionRate}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
      </div>

      {/* Stats par employé */}
      {stats.employeeList.length > 0 && (
        <div className="stats-section">
          <h4>
            <UsersIcon />
            Par employé
          </h4>
          <div className="employee-stats-list">
            {stats.employeeList.map(emp => (
              <div key={emp.id} className="employee-stat-row">
                <div className="emp-info">
                  <span className="emp-name">{emp.name}</span>
                  <span className="emp-count">{emp.total} interv.</span>
                </div>
                <div className="emp-bar-container">
                  <div className="emp-bar">
                    <div
                      className="emp-bar-completed"
                      style={{ width: `${emp.total > 0 ? (emp.completed / emp.total) * 100 : 0}%` }}
                    />
                    <div
                      className="emp-bar-progress"
                      style={{ width: `${emp.total > 0 ? (emp.inProgress / emp.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="emp-details">
                  {emp.completed > 0 && (
                    <span className="emp-completed">{emp.completed} <CheckCircleIcon className="mini-icon" /></span>
                  )}
                  {emp.inProgress > 0 && (
                    <span className="emp-in-progress">{emp.inProgress} <ClockIcon className="mini-icon" /></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats par service */}
      {stats.serviceList.length > 0 && (
        <div className="stats-section">
          <h4>Par service</h4>
          <div className="service-stats-list">
            {stats.serviceList.map(svc => (
              <div key={svc.name} className="service-stat-row">
                <span className="svc-name">{svc.name}</span>
                <div className="svc-bar-container">
                  <div className="svc-bar">
                    <div
                      className="svc-bar-fill"
                      style={{ width: `${stats.total > 0 ? (svc.total / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="svc-count">{svc.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jours les plus chargés */}
      {stats.busiestDays.length > 0 && (
        <div className="stats-section">
          <h4>Jours les plus chargés</h4>
          <div className="busiest-days-list">
            {stats.busiestDays.map(day => (
              <div key={day.date} className="busiest-day-row">
                <span className="day-label">{day.dayName}</span>
                <div className="day-bar-container">
                  <div className="day-bar">
                    <div
                      className="day-bar-fill"
                      style={{ width: `${stats.busiestDays[0]?.count > 0 ? (day.count / stats.busiestDays[0].count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="day-count">{day.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamStatistics;
