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

// Nombre max d'interventions visibles par cellule
const MAX_VISIBLE_PER_CELL = 3;

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
 * Formate l'heure pour enlever les secondes (08:00:00 → 08:00)
 */
const formatTime = (time) => {
  if (!time) return '08:00';
  // Si le format est HH:MM:SS, enlever les secondes
  const parts = time.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return time;
};

/**
 * Composant pour une barre d'intervention
 */
const InterventionBar = ({ intervention, color, onClick, isSpanStart, isSpanMiddle, isSpanEnd, spanDays }) => {
  const status = intervention.status || 'À venir';
  const isCompleted = status === 'Terminée';
  const isInProgress = status === 'En cours';

  // Classes pour les barres multi-jours
  const spanClass = isSpanStart ? 'span-start' : isSpanMiddle ? 'span-middle' : isSpanEnd ? 'span-end' : '';
  const isMultiDay = spanDays > 1;

  return (
    <div
      className={`gantt-bar ${isCompleted ? 'completed' : ''} ${isInProgress ? 'in-progress' : ''} ${spanClass} ${isMultiDay ? 'multi-day' : ''}`}
      style={{ '--bar-color': color }}
      onClick={() => onClick?.(intervention)}
      title={`${intervention.client} - ${intervention.service || ''}\n${intervention.address || ''}${isMultiDay ? `\n📅 ${spanDays} jours` : ''}`}
    >
      {isSpanMiddle ? (
        <span className="bar-continuation">⋯</span>
      ) : (
        <>
          <span className="bar-time">{formatTime(intervention.time)}</span>
          <span className="bar-client">{intervention.client}</span>
          {intervention.service && !isSpanMiddle && (
            <span className="bar-service">{intervention.service}</span>
          )}
        </>
      )}
      {isMultiDay && isSpanStart && (
        <span className="bar-days-badge">{spanDays}j</span>
      )}
    </div>
  );
};

/**
 * Indicateur de débordement (plus d'interventions que visible)
 */
const OverflowIndicator = ({ count, onClick }) => (
  <button className="overflow-indicator" onClick={onClick}>
    +{count} autre{count > 1 ? 's' : ''}
  </button>
);

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

  // Obtenir les interventions d'une équipe pour un jour donné avec infos de span
  const getInterventionsForDay = (team, dateStr, weekDaysArray) => {
    const dayInterventions = [];

    team.interventions.forEach(itv => {
      // Récupérer toutes les dates de l'intervention
      const allDates = itv.scheduled_dates?.length > 0
        ? [...itv.scheduled_dates].sort()
        : [itv.date];

      // Vérifier si cette date fait partie des dates de l'intervention
      if (!allDates.includes(dateStr)) return;

      // Déterminer la position dans le span
      const indexInDates = allDates.indexOf(dateStr);
      const totalDays = allDates.length;
      const isSpanStart = indexInDates === 0;
      const isSpanEnd = indexInDates === totalDays - 1;
      const isSpanMiddle = !isSpanStart && !isSpanEnd;

      // Vérifier si l'intervention continue avant ou après la semaine visible
      const weekStart = weekDaysArray[0].dateStr;
      const weekEnd = weekDaysArray[6].dateStr;
      const hasDatesBefore = allDates.some(d => d < weekStart);
      const hasDatesAfter = allDates.some(d => d > weekEnd);

      dayInterventions.push({
        ...itv,
        isSpanStart: isSpanStart && !hasDatesBefore,
        isSpanMiddle: isSpanMiddle || (isSpanStart && hasDatesBefore),
        isSpanEnd: isSpanEnd && !hasDatesAfter,
        spanDays: totalDays,
        continuesBefore: hasDatesBefore && dateStr === weekStart,
        continuesAfter: hasDatesAfter && dateStr === weekEnd
      });
    });

    // Trier par heure
    return dayInterventions.sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
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
                  const dayInterventions = getInterventionsForDay(team, day.dateStr, weekDays);
                  const visibleInterventions = dayInterventions.slice(0, MAX_VISIBLE_PER_CELL);
                  const overflowCount = dayInterventions.length - MAX_VISIBLE_PER_CELL;
                  const hasOverflow = overflowCount > 0;

                  return (
                    <div
                      key={day.dateStr}
                      className={`gantt-day-cell ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''} ${dayInterventions.length > 0 ? 'has-items' : ''} ${hasOverflow ? 'has-overflow' : ''}`}
                    >
                      {visibleInterventions.map(itv => (
                        <InterventionBar
                          key={itv.id}
                          intervention={itv}
                          color={team.color}
                          onClick={onInterventionClick}
                          isSpanStart={itv.isSpanStart}
                          isSpanMiddle={itv.isSpanMiddle}
                          isSpanEnd={itv.isSpanEnd}
                          spanDays={itv.spanDays}
                        />
                      ))}
                      {hasOverflow && (
                        <OverflowIndicator
                          count={overflowCount}
                          onClick={() => {
                            // Ouvrir la première intervention cachée
                            const firstHidden = dayInterventions[MAX_VISIBLE_PER_CELL];
                            onInterventionClick?.(firstHidden);
                          }}
                        />
                      )}
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
