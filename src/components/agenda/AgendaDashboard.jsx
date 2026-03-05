// src/components/agenda/AgendaDashboard.js
// Dashboard avec statistiques et KPIs pour l'agenda - Version Admin améliorée

import React, { useMemo, useState } from 'react';
import { AlertTriangleIcon, ClockIcon, UsersIcon, CheckCircleIcon, CalendarIcon, TrendingUpIcon } from '../SharedUI';
import { getUrgentCount, hasSAV, toLocalDateStr } from '../../utils/agendaHelpers';
import './AgendaDashboard.css';

/**
 * Génère les jours du mois pour le mini-calendrier
 */
const generateCalendarDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Lundi = 0

  const days = [];

  // Jours du mois précédent
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ day: prevMonthLast - i, isCurrentMonth: false, date: null });
  }

  // Jours du mois actuel
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, isCurrentMonth: true, date: dateStr });
  }

  // Compléter la dernière semaine
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isCurrentMonth: false, date: null });
    }
  }

  return days;
};

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
    overloadedEmployees: [],
    interventionsByDate: {},
    completionRate: 0,
    todayCount: 0
  };

  const today = toLocalDateStr(new Date());

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
    // Grouper par date
    if (itv.date) {
      stats.interventionsByDate[itv.date] = (stats.interventionsByDate[itv.date] || 0) + 1;
    }

    // Compter aujourd'hui
    if (itv.date === today) {
      stats.todayCount++;
    }

    // Compter les urgents
    if (getUrgentCount(itv) > 0) {
      stats.urgent++;
    }

    // Compter les SAV
    if (hasSAV(itv)) {
      stats.sav++;
    }

    // Compter les non assignées
    const assignments = itv.intervention_assignments;
    const hasAssignment = assignments && Array.isArray(assignments) && assignments.length > 0;
    if (!hasAssignment && (!itv.assigned_to || itv.assigned_to.length === 0)) {
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

    // Calculer la charge par employé (utilise estimated_duration ou 2h par défaut)
    const duration = parseFloat(itv.estimated_duration) || 2;
    if (assignments && Array.isArray(assignments)) {
      assignments.forEach(assignment => {
        const userId = assignment.user_id;
        if (stats.employeeLoad[userId]) {
          stats.employeeLoad[userId].count++;
          stats.employeeLoad[userId].hours += duration;
        }
      });
    } else if (itv.assigned_to && Array.isArray(itv.assigned_to)) {
      itv.assigned_to.forEach(userId => {
        if (stats.employeeLoad[userId]) {
          stats.employeeLoad[userId].count++;
          stats.employeeLoad[userId].hours += duration;
        }
      });
    }
  });

  // Taux de complétion
  stats.completionRate = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

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
 * Composant Mini-Calendrier
 */
const MiniCalendar = ({ dateRange, interventionsByDate }) => {
  const [currentMonth, setCurrentMonth] = useState(dateRange?.start || new Date());
  const days = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);
  const today = toLocalDateStr(new Date());

  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthYear = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <button className="mini-cal-nav" onClick={prevMonth}>&lt;</button>
        <span className="mini-cal-title">{monthYear}</span>
        <button className="mini-cal-nav" onClick={nextMonth}>&gt;</button>
      </div>
      <div className="mini-calendar-weekdays">
        {weekDays.map((d, i) => (
          <span key={i} className="mini-cal-weekday">{d}</span>
        ))}
      </div>
      <div className="mini-calendar-days">
        {days.map((d, i) => {
          const count = d.date ? (interventionsByDate[d.date] || 0) : 0;
          const isToday = d.date === today;
          const hasEvents = count > 0;

          return (
            <div
              key={i}
              className={`mini-cal-day ${!d.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasEvents ? 'has-events' : ''}`}
              title={hasEvents ? `${count} intervention(s)` : ''}
            >
              <span className="day-number">{d.day}</span>
              {hasEvents && <span className="event-dot" style={{ opacity: Math.min(count / 5, 1) }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Composant barre de progression circulaire
 */
const CircularProgress = ({ value, size = 80, strokeWidth = 8, label }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="progress-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="progress-bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
      </svg>
      <div className="progress-value">
        <span className="progress-number">{value}%</span>
        {label && <span className="progress-label">{label}</span>}
      </div>
    </div>
  );
};

/**
 * AgendaDashboard Component - Version Admin améliorée
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

  // Calculer les tops employés
  const topEmployees = useMemo(() => {
    return Object.entries(stats.employeeLoad)
      .map(([id, data]) => ({ id, ...data }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [stats.employeeLoad]);

  return (
    <div className="agenda-dashboard agenda-dashboard-admin">
      <div className="dashboard-header">
        <h2 className="dashboard-title">
          <CalendarIcon className="dashboard-icon" />
          Tableau de bord Admin
          {dateRange && (
            <span className="dashboard-period">{formatDateRange()}</span>
          )}
        </h2>
      </div>

      <div className="dashboard-main-grid">
        {/* Colonne gauche: Mini calendrier */}
        <div className="dashboard-left">
          <MiniCalendar
            dateRange={dateRange}
            interventionsByDate={stats.interventionsByDate}
          />
        </div>

        {/* Colonne centre: KPIs principaux */}
        <div className="dashboard-center">
          <div className="dashboard-grid">
            {/* Total interventions */}
            <div className="dashboard-card card-highlight">
              <div className="card-icon card-icon-primary">
                <CheckCircleIcon />
              </div>
              <div className="card-content">
                <div className="card-value">{stats.total}</div>
                <div className="card-label">Interventions</div>
                {stats.todayCount > 0 && (
                  <div className="card-today-badge">
                    {stats.todayCount} aujourd'hui
                  </div>
                )}
              </div>
            </div>

            {/* Interventions urgentes */}
            <div className={`dashboard-card ${stats.urgent > 0 ? 'card-urgent' : ''}`}>
              <div className="card-icon card-icon-warning">
                <AlertTriangleIcon />
              </div>
              <div className="card-content">
                <div className="card-value">{stats.urgent}</div>
                <div className="card-label">Urgents</div>
                {stats.urgent > 0 && (
                  <div className="card-subtitle card-subtitle-warning">
                    Action requise
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
                <div className="card-label">SAV</div>
              </div>
            </div>

            {/* Non assignées */}
            <div className={`dashboard-card ${stats.unassigned > 0 ? 'card-warning' : ''}`}>
              <div className="card-icon card-icon-secondary">
                <UsersIcon />
              </div>
              <div className="card-content">
                <div className="card-value">{stats.unassigned}</div>
                <div className="card-label">Non assignées</div>
              </div>
            </div>
          </div>

          {/* Statistiques de progression */}
          <div className="dashboard-progress-section">
            <div className="progress-cards">
              <div className="progress-card">
                <CircularProgress value={stats.completionRate} label="Complétées" />
              </div>
              <div className="status-breakdown">
                <div className="status-item status-completed">
                  <span className="status-dot"></span>
                  <span className="status-label">Terminées</span>
                  <span className="status-count">{stats.completed}</span>
                </div>
                <div className="status-item status-inprogress">
                  <span className="status-dot"></span>
                  <span className="status-label">En cours</span>
                  <span className="status-count">{stats.inProgress}</span>
                </div>
                <div className="status-item status-pending">
                  <span className="status-dot"></span>
                  <span className="status-label">En attente</span>
                  <span className="status-count">{stats.pending}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne droite: Top employés */}
        <div className="dashboard-right">
          <div className="top-employees-card">
            <h3 className="top-employees-title">
              <TrendingUpIcon className="title-icon" />
              Top Techniciens
            </h3>
            {topEmployees.length > 0 ? (
              <div className="top-employees-list">
                {topEmployees.map((emp, index) => (
                  <div key={emp.id} className="top-employee-item">
                    <span className="employee-rank">#{index + 1}</span>
                    <div className="employee-avatar">
                      {emp.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="employee-info">
                      <span className="employee-name">{emp.name}</span>
                      <span className="employee-stats">
                        {emp.count} intervention{emp.count > 1 ? 's' : ''} - {emp.hours}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-employees">
                Aucune intervention assignée
              </div>
            )}

            {/* Charge moyenne */}
            <div className="average-load">
              <span className="load-label">Charge moyenne</span>
              <span className="load-value">{stats.averageLoad}h/tech</span>
            </div>
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
                {stats.overloadedEmployees.length} technicien(s) surchargé(s)
              </div>
              <div className="alert-list">
                {stats.overloadedEmployees.map(emp => (
                  <div key={emp.id} className="alert-item">
                    <strong>{emp.name}</strong> : {emp.count} interventions
                    ({emp.hours}h estimées)
                  </div>
                ))}
              </div>
              <div className="alert-hint">
                Redistribuez les interventions pour équilibrer la charge
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(AgendaDashboard);
