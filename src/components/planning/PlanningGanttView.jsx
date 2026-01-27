// src/components/planning/PlanningGanttView.jsx
// Vue Gantt pour visualiser le planning par équipe et par jour

import React, { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from '../SharedUI';
import './PlanningGanttView.css';

// Couleurs pour les équipes
const TEAM_COLORS = [
  '#3b82f6', // Bleu
  '#10b981', // Vert
  '#f59e0b', // Orange
  '#8b5cf6', // Violet
  '#ef4444', // Rouge
  '#06b6d4', // Cyan
  '#ec4899', // Rose
  '#84cc16', // Lime
];

/**
 * Génère les jours de la semaine à partir d'une date
 */
const getWeekDays = (startDate) => {
  const days = [];
  const start = new Date(startDate);
  // Aller au lundi de cette semaine
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      date,
      dateStr: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
      dayNum: date.getDate(),
      isToday: date.toDateString() === new Date().toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }
  return days;
};

/**
 * Groupe les interventions par équipe
 */
const groupByTeam = (interventions, users) => {
  const teams = {};
  const usersMap = {};
  users.forEach(u => { usersMap[u.id] = u; });

  // Créer une équipe "Non assigné"
  teams['unassigned'] = {
    id: 'unassigned',
    name: 'Non assigné',
    color: '#94a3b8',
    interventions: [],
    userIds: []
  };

  interventions.forEach(itv => {
    const assignments = itv.intervention_assignments || [];

    if (assignments.length === 0) {
      teams['unassigned'].interventions.push(itv);
      return;
    }

    // Créer une clé unique pour cette équipe
    const userIds = assignments.map(a => a.user_id).sort();
    const teamKey = userIds.join('-');

    if (!teams[teamKey]) {
      const names = assignments
        .map(a => a.profiles?.full_name || usersMap[a.user_id]?.full_name || '?')
        .join(' + ');

      teams[teamKey] = {
        id: teamKey,
        name: names,
        color: TEAM_COLORS[Object.keys(teams).length % TEAM_COLORS.length],
        interventions: [],
        userIds
      };
    }

    teams[teamKey].interventions.push(itv);
  });

  // Trier: équipes avec le plus d'interventions en premier, "Non assigné" en dernier
  return Object.values(teams).sort((a, b) => {
    if (a.id === 'unassigned') return 1;
    if (b.id === 'unassigned') return -1;
    return b.interventions.length - a.interventions.length;
  });
};

/**
 * Composant pour une barre d'intervention
 */
const InterventionBar = ({ intervention, color, onClick }) => {
  const status = intervention.status || 'À venir';
  const isCompleted = status === 'Terminée';
  const isInProgress = status === 'En cours';

  return (
    <div
      className={`gantt-bar ${isCompleted ? 'completed' : ''} ${isInProgress ? 'in-progress' : ''}`}
      style={{ '--bar-color': color }}
      onClick={() => onClick?.(intervention)}
      title={`${intervention.client} - ${intervention.service || ''}\n${intervention.address || ''}`}
    >
      <span className="bar-time">{intervention.time || '08:00'}</span>
      <span className="bar-client">{intervention.client}</span>
      {intervention.service && (
        <span className="bar-service">{intervention.service}</span>
      )}
    </div>
  );
};

/**
 * Composant principal Gantt
 */
const PlanningGanttView = ({
  interventions = [],
  users = [],
  onInterventionClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Générer les jours de la semaine
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Grouper par équipe
  const teams = useMemo(() =>
    groupByTeam(interventions, users),
    [interventions, users]
  );

  // Navigation
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Obtenir les interventions d'une équipe pour un jour donné
  const getInterventionsForDay = (team, dateStr) => {
    return team.interventions.filter(itv => {
      // Vérifier scheduled_dates d'abord
      if (itv.scheduled_dates?.includes(dateStr)) return true;
      // Sinon vérifier la date principale
      return itv.date === dateStr;
    });
  };

  // Calculer le titre de la période
  const periodTitle = useMemo(() => {
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const startMonth = start.toLocaleDateString('fr-FR', { month: 'long' });
    const endMonth = end.toLocaleDateString('fr-FR', { month: 'long' });
    const year = end.getFullYear();

    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} ${startMonth} ${year}`;
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${year}`;
  }, [weekDays]);

  // Stats rapides
  const stats = useMemo(() => {
    const weekInterventions = interventions.filter(itv => {
      const startStr = weekDays[0].dateStr;
      const endStr = weekDays[6].dateStr;
      if (itv.scheduled_dates?.some(d => d >= startStr && d <= endStr)) return true;
      return itv.date >= startStr && itv.date <= endStr;
    });

    return {
      total: weekInterventions.length,
      completed: weekInterventions.filter(i => i.status === 'Terminée').length,
      teams: teams.filter(t => t.id !== 'unassigned' && t.interventions.length > 0).length
    };
  }, [interventions, weekDays, teams]);

  return (
    <div className="planning-gantt">
      {/* Header */}
      <div className="gantt-header">
        <div className="gantt-nav">
          <button className="nav-btn" onClick={goToPreviousWeek}>
            <ChevronLeftIcon />
          </button>
          <div className="gantt-period">
            <h3>{periodTitle}</h3>
            <div className="gantt-stats">
              <span>{stats.total} intervention{stats.total > 1 ? 's' : ''}</span>
              <span className="stat-separator">•</span>
              <span>{stats.teams} équipe{stats.teams > 1 ? 's' : ''}</span>
              <span className="stat-separator">•</span>
              <span className="stat-completed">{stats.completed} terminée{stats.completed > 1 ? 's' : ''}</span>
            </div>
          </div>
          <button className="nav-btn" onClick={goToNextWeek}>
            <ChevronRightIcon />
          </button>
        </div>
        <button className="today-btn" onClick={goToToday}>
          Aujourd'hui
        </button>
      </div>

      {/* Grille Gantt */}
      <div className="gantt-container">
        <div className="gantt-grid">
          {/* Header des jours */}
          <div className="gantt-row gantt-days-header">
            <div className="gantt-team-cell header-cell">
              <UsersIcon />
              <span>Équipes</span>
            </div>
            {weekDays.map(day => (
              <div
                key={day.dateStr}
                className={`gantt-day-cell header-cell ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''}`}
              >
                <span className="day-name">{day.dayName}</span>
                <span className="day-num">{day.dayNum}</span>
              </div>
            ))}
          </div>

          {/* Lignes des équipes */}
          {teams.length === 0 ? (
            <div className="gantt-empty">
              <p>Aucune intervention cette semaine</p>
            </div>
          ) : (
            teams.map(team => (
              <div key={team.id} className="gantt-row">
                {/* Cellule équipe */}
                <div className="gantt-team-cell" style={{ '--team-color': team.color }}>
                  <div className="team-color-indicator"></div>
                  <span className="team-name">{team.name}</span>
                  <span className="team-count">
                    {team.interventions.length}
                  </span>
                </div>

                {/* Cellules des jours */}
                {weekDays.map(day => {
                  const dayInterventions = getInterventionsForDay(team, day.dateStr);

                  return (
                    <div
                      key={day.dateStr}
                      className={`gantt-day-cell ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''} ${dayInterventions.length > 0 ? 'has-items' : ''}`}
                    >
                      {dayInterventions.map(itv => (
                        <InterventionBar
                          key={itv.id}
                          intervention={itv}
                          color={team.color}
                          onClick={onInterventionClick}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="gantt-legend">
        <div className="legend-item">
          <span className="legend-bar"></span>
          <span>À venir</span>
        </div>
        <div className="legend-item">
          <span className="legend-bar in-progress"></span>
          <span>En cours</span>
        </div>
        <div className="legend-item">
          <span className="legend-bar completed"></span>
          <span>Terminée</span>
        </div>
      </div>
    </div>
  );
};

export default PlanningGanttView;
