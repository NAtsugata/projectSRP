// src/components/planning/PlanningCalendarView.jsx
// Vue calendrier pour la gestion du planning

import { useMemo, useState, useCallback } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../SharedUI';
import { toLocalDateStr } from '../../utils/agendaHelpers';
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
  return toLocalDateStr(date);
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
 * Icônes par type d'absence
 */
const ABSENCE_ICONS = {
  'Congés': '🏖️',
  'Maladie': '🏥',
  'Formation': '📚',
  'École': '🎓',
  'Autre': '📋'
};

/**
 * PlanningCalendarView Component
 */
const PlanningCalendarView = ({
  interventions = [],
  onInterventionClick,
  onDateClick,
  users = [],
  absences = []
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState(null);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const toggleExpanded = useCallback((key, e) => {
    e.stopPropagation();
    setExpandedDay(prev => prev === key ? null : key);
  }, []);

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

  // Grouper les absences par date
  const absencesByDate = useMemo(() => {
    const byDate = {};

    absences.forEach(absence => {
      const startDate = absence.startDate || absence.start_date;
      const endDate = absence.endDate || absence.end_date;
      const empId = absence.employeeId || absence.employee_id;

      if (!startDate || !endDate || !empId) return;

      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toLocalDateStr(d);
        if (!byDate[dateStr]) byDate[dateStr] = [];

        // Éviter les doublons
        if (!byDate[dateStr].find(a => a.id === absence.id)) {
          byDate[dateStr].push({
            ...absence,
            employeeId: empId,
            employeeName: usersMap[empId]?.full_name || usersMap[empId]?.name || '?'
          });
        }
      }
    });

    return byDate;
  }, [absences, usersMap]);

  // Navigation
  const goToPreviousMonth = () => {
    setExpandedDay(null);
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setExpandedDay(null);
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setExpandedDay(null);
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
      {/* Backdrop pour fermer le panel */}
      {expandedDay && (
        <div
          className="overflow-panel-backdrop"
          onClick={() => setExpandedDay(null)}
          aria-hidden="true"
        />
      )}

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
          const dayAbsences = absencesByDate[dateKey] || [];
          const hasInterventions = dayInterventions.length > 0;
          const hasAbsences = dayAbsences.length > 0;
          const VISIBLE = 3;
          const overflow = dayInterventions.length - VISIBLE;
          const isExpanded = expandedDay === dateKey;
          const panelAlignRight = (index % 7) >= 4;

          // Indicateur de charge
          const loadClass = dayInterventions.length >= 4
            ? 'load-heavy'
            : dayInterventions.length >= 2
              ? 'load-medium'
              : '';

          // Répartition par statut
          let pendingCount = 0, progressCount = 0, doneCount = 0;
          for (const itv of dayInterventions) {
            if (itv.status === 'Terminée') doneCount++;
            else if (itv.status === 'En cours') progressCount++;
            else pendingCount++;
          }

          return (
            <div
              key={index}
              className={[
                'calendar-day',
                !day.isCurrentMonth && 'other-month',
                day.isToday && 'today',
                hasInterventions && 'has-interventions',
                hasAbsences && 'has-absences',
                isExpanded && 'is-expanded',
                loadClass
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (isExpanded) { setExpandedDay(null); return; }
                onDateClick?.(day.date, dayInterventions);
              }}
            >
              {/* Numéro du jour + badge total */}
              <div className="day-header-row">
                <span className="day-number">{day.date.getDate()}</span>
                {dayInterventions.length > 1 && day.isCurrentMonth && (
                  <span className="day-total-badge" title={`${dayInterventions.length} interventions`}>
                    {dayInterventions.length}
                  </span>
                )}
              </div>

              {/* Mini-barre de répartition par statut */}
              {hasInterventions && day.isCurrentMonth && (
                <div
                  className="day-status-bar"
                  title={`À venir: ${pendingCount} • En cours: ${progressCount} • Terminées: ${doneCount}`}
                >
                  {pendingCount > 0 && (
                    <span className="status-segment seg-pending" style={{ flex: pendingCount }} />
                  )}
                  {progressCount > 0 && (
                    <span className="status-segment seg-progress" style={{ flex: progressCount }} />
                  )}
                  {doneCount > 0 && (
                    <span className="status-segment seg-done" style={{ flex: doneCount }} />
                  )}
                </div>
              )}

              {/* Absences du jour */}
              {hasAbsences && (
                <div className="day-absences">
                  {dayAbsences.slice(0, 2).map((absence, idx) => {
                    const reason = absence.reason || 'Autre';
                    const icon = ABSENCE_ICONS[reason] || '📋';
                    const absenceClass = `absence-${reason.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`;

                    return (
                      <div
                        key={`absence-${absence.id}-${idx}`}
                        className={`absence-chip ${absenceClass}`}
                        title={`${absence.employeeName} — ${reason}`}
                      >
                        <span className="absence-icon">{icon}</span>
                        <span className="absence-name">{absence.employeeName?.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                  {dayAbsences.length > 2 && (
                    <span className="more-absences">+{dayAbsences.length - 2} absent(s)</span>
                  )}
                </div>
              )}

              {/* Interventions du jour */}
              <div className="day-interventions">
                {dayInterventions.slice(0, VISIBLE).map(itv => (
                  <div
                    key={itv.id}
                    className={`intervention-chip ${itv.status === 'Terminée' ? 'completed' : ''}`}
                    style={{
                      borderLeftColor: getTeamColor(itv),
                      backgroundColor: `${getTeamColor(itv)}18`
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

                {overflow > 0 && (
                  <button
                    type="button"
                    className={`more-interventions-btn${isExpanded ? ' is-open' : ''}`}
                    onClick={(e) => toggleExpanded(dateKey, e)}
                    title="Voir toutes les interventions"
                  >
                    {isExpanded ? '▲ Réduire' : `+${overflow} autres`}
                  </button>
                )}
              </div>

              {/* Panel flottant — toutes les interventions du jour */}
              {isExpanded && (
                <div
                  className={`day-overflow-panel${panelAlignRight ? ' align-right' : ''}`}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="overflow-panel-header">
                    <span className="overflow-panel-date">
                      {day.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="overflow-panel-count">
                      {dayInterventions.length} intervention{dayInterventions.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="overflow-panel-list">
                    {dayInterventions.map(itv => (
                      <button
                        key={itv.id}
                        type="button"
                        className={`overflow-item${itv.status === 'Terminée' ? ' completed' : itv.status === 'En cours' ? ' in-progress' : ''}`}
                        style={{ borderLeftColor: getTeamColor(itv) }}
                        onClick={() => {
                          onInterventionClick?.(itv);
                          setExpandedDay(null);
                        }}
                      >
                        <span className="overflow-item-time">{itv.time || '--:--'}</span>
                        <div className="overflow-item-info">
                          <span className="overflow-item-client">{itv.client}</span>
                          <span className="overflow-item-assignee">{getAssignedNames(itv)}</span>
                        </div>
                        <span className={`overflow-item-dot${itv.status === 'Terminée' ? ' dot-done' : itv.status === 'En cours' ? ' dot-progress' : ' dot-pending'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
          <span>Interventions</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot absence-dot"></span>
          <span>Absences</span>
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
