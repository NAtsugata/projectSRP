// src/components/planning/PlanningCalendarView.jsx
// Vue calendrier pour la gestion du planning

import React, { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../SharedUI';
import './PlanningCalendarView.css';

/**
 * Génère les jours du mois
 */
const generateCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Ajuster pour commencer par lundi (0 = lundi, 6 = dimanche)
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const days = [];

  // Jours du mois précédent
  const prevMonth = new Date(year, month, 0);
  const prevDays = prevMonth.getDate();
  for (let i = adjustedStartDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevDays - i),
      isCurrentMonth: false,
      isToday: false
    });
  }

  // Jours du mois courant
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime()
    });
  }

  // Jours du mois suivant pour compléter la grille
  const remaining = 42 - days.length; // 6 semaines * 7 jours
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: new Date(year, month + 1, d),
      isCurrentMonth: false,
      isToday: false
    });
  }

  return days;
};

/**
 * Formater la date en YYYY-MM-DD
 */
const formatDateKey = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Obtenir la couleur basée sur l'équipe assignée
 */
const getTeamColor = (intervention) => {
  const assignments = intervention.intervention_assignments || [];
  if (assignments.length === 0) return '#94a3b8'; // Gris pour non assigné

  // Hash simple basé sur le premier user_id pour avoir une couleur cohérente
  const firstUserId = assignments[0]?.user_id || '';
  let hash = 0;
  for (let i = 0; i < firstUserId.length; i++) {
    hash = firstUserId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    '#3b82f6', // Bleu
    '#10b981', // Vert
    '#f59e0b', // Orange
    '#8b5cf6', // Violet
    '#ef4444', // Rouge
    '#06b6d4', // Cyan
    '#ec4899', // Rose
  ];

  return colors[Math.abs(hash) % colors.length];
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * PlanningCalendarView Component
 */
const PlanningCalendarView = ({
  interventions = [],
  onInterventionClick,
  onDateClick,
  users = []
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Générer les jours du calendrier
  const calendarDays = useMemo(() =>
    generateCalendarDays(year, month),
    [year, month]
  );

  // Grouper les interventions par date
  const interventionsByDate = useMemo(() => {
    const grouped = {};

    interventions.forEach(itv => {
      // Gérer les dates planifiées multiples
      const dates = itv.scheduled_dates?.length > 0
        ? itv.scheduled_dates
        : [itv.date];

      dates.forEach(date => {
        if (!date) return;
        const key = date.split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(itv);
      });
    });

    return grouped;
  }, [interventions]);

  // Créer une map des utilisateurs pour lookup rapide
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Obtenir les noms des assignés
  const getAssignedNames = (intervention) => {
    const assignments = intervention.intervention_assignments || [];
    if (assignments.length === 0) return 'Non assigné';

    return assignments
      .map(a => a.profiles?.full_name || usersMap[a.user_id]?.full_name || '?')
      .join(', ');
  };

  return (
    <div className="planning-calendar">
      {/* Header avec navigation */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button
            className="nav-btn"
            onClick={goToPreviousMonth}
            aria-label="Mois précédent"
          >
            <ChevronLeftIcon />
          </button>
          <h3 className="calendar-title">
            {MONTHS[month]} {year}
          </h3>
          <button
            className="nav-btn"
            onClick={goToNextMonth}
            aria-label="Mois suivant"
          >
            <ChevronRightIcon />
          </button>
        </div>
        <button
          className="today-btn"
          onClick={goToToday}
        >
          <CalendarIcon />
          Aujourd'hui
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="calendar-weekdays">
        {WEEKDAYS.map(day => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      {/* Grille du calendrier */}
      <div className="calendar-grid">
        {calendarDays.map((day, index) => {
          const dateKey = formatDateKey(day.date);
          const dayInterventions = interventionsByDate[dateKey] || [];
          const hasInterventions = dayInterventions.length > 0;

          return (
            <div
              key={index}
              className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${hasInterventions ? 'has-interventions' : ''}`}
              onClick={() => onDateClick?.(day.date, dayInterventions)}
            >
              <span className="day-number">{day.date.getDate()}</span>

              {/* Interventions du jour */}
              <div className="day-interventions">
                {dayInterventions.slice(0, 3).map(itv => (
                  <div
                    key={itv.id}
                    className={`intervention-chip ${itv.status === 'Terminée' ? 'completed' : ''}`}
                    style={{
                      borderLeftColor: getTeamColor(itv),
                      backgroundColor: `${getTeamColor(itv)}15`
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInterventionClick?.(itv);
                    }}
                    title={`${itv.client} - ${getAssignedNames(itv)}`}
                  >
                    <span className="chip-time">{itv.time || '—'}</span>
                    <span className="chip-client">{itv.client}</span>
                  </div>
                ))}

                {dayInterventions.length > 3 && (
                  <div className="more-interventions">
                    +{dayInterventions.length - 3} autres
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot today-dot"></span>
          <span>Aujourd'hui</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot has-dot"></span>
          <span>Avec interventions</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot completed-dot"></span>
          <span>Terminée</span>
        </div>
      </div>
    </div>
  );
};

export default PlanningCalendarView;
