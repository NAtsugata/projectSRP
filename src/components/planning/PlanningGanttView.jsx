// src/components/planning/PlanningGanttView.jsx
// Vue Gantt pour visualiser le planning par équipe et par jour

import React, { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon, EditIcon, DownloadIcon } from '../SharedUI';
import { exportWeeklyPlanningPdf } from '../../utils/planningPdfExport';
import { toLocalDateStr } from '../../utils/agendaHelpers';
import logger from '../../utils/logger';
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
  const s = new Date(startDate);
  // Aller au lundi de cette semaine (en heure locale, sans mutation)
  const day = s.getDay();
  const diff = s.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(s.getFullYear(), s.getMonth(), diff);

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push({
      date,
      dateStr: toLocalDateStr(date),
      dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
      dayNum: date.getDate(),
      isToday: date.toDateString() === new Date().toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }
  return days;
};

/**
 * Récupère l'équipe assignée pour une intervention à une date donnée
 * Prend en compte daily_assignments si disponible, sinon utilise intervention_assignments
 */
const getTeamForDate = (intervention, dateStr, usersMap) => {
  const dailyAssignments = intervention.daily_assignments || {};
  const globalAssignments = intervention.intervention_assignments || [];

  // Vérifier si une équipe spécifique est assignée pour ce jour
  let userIds = [];
  if (dailyAssignments[dateStr] && dailyAssignments[dateStr].length > 0) {
    userIds = [...dailyAssignments[dateStr]].sort();
  } else if (globalAssignments.length > 0) {
    userIds = globalAssignments.map(a => a.user_id).sort();
  }

  if (userIds.length === 0) {
    return { teamKey: 'unassigned', userIds: [], name: 'Non assigné' };
  }

  const teamKey = userIds.join('-');
  const names = userIds
    .map(uid => usersMap[uid]?.full_name || '?');

  return { teamKey, userIds, names };
};

/**
 * Groupe les interventions par équipe (basé sur les assignations globales)
 */
const groupByTeam = (interventions, users) => {
  const teams = {};
  const usersMap = {};
  users.forEach(u => { usersMap[u.id] = u; });

  // Créer une équipe "Non assigné"
  teams['unassigned'] = {
    id: 'unassigned',
    name: 'Non assigné',
    names: ['Non assigné'],
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
        .map(a => a.profiles?.full_name || usersMap[a.user_id]?.full_name || '?');

      teams[teamKey] = {
        id: teamKey,
        name: names.join(' + '),
        names: names,
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
 * Groupe les interventions par équipe pour un jour spécifique (prend en compte daily_assignments)
 */
const groupByTeamForDay = (interventions, users, dateStr) => {
  const teams = {};
  const usersMap = {};
  users.forEach(u => { usersMap[u.id] = u; });

  // Créer une équipe "Non assigné"
  teams['unassigned'] = {
    id: 'unassigned',
    name: 'Non assigné',
    names: ['Non assigné'],
    color: '#94a3b8',
    interventions: [],
    userIds: []
  };

  interventions.forEach(itv => {
    // Vérifier si cette intervention est prévue pour ce jour
    const allDates = itv.scheduled_dates?.length > 0
      ? itv.scheduled_dates
      : [itv.date];

    if (!allDates.includes(dateStr)) return;

    // Obtenir l'équipe pour ce jour spécifique
    const { teamKey, userIds, names } = getTeamForDate(itv, dateStr, usersMap);

    if (!teams[teamKey]) {
      teams[teamKey] = {
        id: teamKey,
        names: names, // Array de noms
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
const InterventionBar = ({ intervention, color, onClick, onEditTeam, isSpanStart, isSpanMiddle, isSpanEnd, spanDays }) => {
  const status = intervention.status || 'À venir';
  const isCompleted = status === 'Terminée';
  const isInProgress = status === 'En cours';

  // Classes pour les barres multi-jours
  const spanClass = isSpanStart ? 'span-start' : isSpanMiddle ? 'span-middle' : isSpanEnd ? 'span-end' : '';
  const isMultiDay = spanDays > 1;

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEditTeam?.(intervention);
  };

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
      {onEditTeam && !isSpanMiddle && (
        <button
          className="bar-edit-btn"
          onClick={handleEditClick}
          title="Modifier l'équipe"
        >
          <EditIcon />
        </button>
      )}
    </div>
  );
};

/**
 * Indicateur de débordement (plus d'interventions que visible)
 */
const OverflowIndicator = ({ count, onClick }) => (
  <button className="overflow-indicator" onClick={onClick}>
    <span className="overflow-indicator-icon">▼</span>
    +{count} autre{count > 1 ? 's' : ''}
  </button>
);

/**
 * Barre d'absence dans le Gantt
 */
const AbsenceBar = ({ absence, employeeName }) => {
  const reasonLabels = {
    'Congés': '🏖️',
    'Maladie': '🏥',
    'Formation': '📚',
    'École': '🎓',
    'Autre': '📋'
  };
  const icon = reasonLabels[absence.reason] || '📋';

  const startDate = new Date(absence.startDate + 'T00:00:00');
  const endDate = new Date(absence.endDate + 'T00:00:00');
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div
      className={`absence-bar absence-${(absence.reason || 'Autre').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`}
      title={`${employeeName} — ${absence.reason || 'Absent'}${absence.notes ? '\n' + absence.notes : ''}\n${days} jour${days > 1 ? 's' : ''}`}
    >
      <span className="absence-icon">{icon}</span>
      <span className="absence-name">{employeeName}</span>
      <span className="absence-reason">{absence.reason || 'Absent'}</span>
    </div>
  );
};

/**
 * Composant principal Gantt
 */
const PlanningGanttView = ({
  interventions = [],
  users = [],
  absences = [],
  onInterventionClick,
  onEditTeam
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [expandedCell, setExpandedCell] = useState(null);

  // Générer les jours de la semaine
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Map users pour lookup rapide
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  // Calculer toutes les équipes uniques pour la semaine (basé sur daily_assignments)
  const allTeamsForWeek = useMemo(() => {
    const teamsMap = {};

    // Pour chaque jour de la semaine, trouver les équipes
    weekDays.forEach(day => {
      const dayTeams = groupByTeamForDay(interventions, users, day.dateStr);
      dayTeams.forEach(team => {
        if (!teamsMap[team.id]) {
          teamsMap[team.id] = {
            ...team,
            interventionCount: 0 // Compter le total d'interventions sur la semaine
          };
        }
        teamsMap[team.id].interventionCount += team.interventions.length;
      });
    });

    // Trier par nombre d'interventions
    return Object.values(teamsMap).sort((a, b) => {
      if (a.id === 'unassigned') return 1;
      if (b.id === 'unassigned') return -1;
      return b.interventionCount - a.interventionCount;
    });
  }, [interventions, users, weekDays]);

  // Filtrer les équipes selon le filtre sélectionné
  const teams = useMemo(() => {
    if (selectedTeamFilter === 'all') return allTeamsForWeek;
    return allTeamsForWeek.filter(team => team.id === selectedTeamFilter);
  }, [allTeamsForWeek, selectedTeamFilter]);

  // Calculer les interventions par équipe et par jour
  const interventionsByTeamAndDay = useMemo(() => {
    const result = {};

    teams.forEach(team => {
      result[team.id] = {};
      weekDays.forEach(day => {
        // Obtenir les interventions pour cette équipe ce jour-là
        const dayTeams = groupByTeamForDay(interventions, users, day.dateStr);
        const matchingTeam = dayTeams.find(t => t.id === team.id);
        result[team.id][day.dateStr] = matchingTeam?.interventions || [];
      });
    });

    return result;
  }, [teams, weekDays, interventions, users]);

  // Calculer les absences par jour de la semaine
  const absencesByDay = useMemo(() => {
    const result = {};
    weekDays.forEach(day => {
      const dayAbsences = [];
      absences.forEach(absence => {
        const startDate = absence.startDate || absence.start_date;
        const endDate = absence.endDate || absence.end_date;
        const empId = absence.employeeId || absence.employee_id;
        if (!startDate || !endDate || !empId) return;
        if (day.dateStr >= startDate && day.dateStr <= endDate) {
          const user = usersMap[empId];
          dayAbsences.push({
            ...absence,
            employeeId: empId,
            startDate: startDate,
            endDate: endDate,
            employeeName: user?.full_name || '?'
          });
        }
      });
      result[day.dateStr] = dayAbsences;
    });
    return result;
  }, [absences, weekDays, usersMap]);

  // Absences par employé+jour pour lookup dans les lignes d'équipe
  const absencesByEmployeeDay = useMemo(() => {
    const result = {};
    absences.forEach(absence => {
      const empId = absence.employeeId || absence.employee_id;
      const startDate = absence.startDate || absence.start_date;
      const endDate = absence.endDate || absence.end_date;
      if (!empId || !startDate || !endDate) return;
      weekDays.forEach(day => {
        if (day.dateStr >= startDate && day.dateStr <= endDate) {
          const key = `${empId}_${day.dateStr}`;
          result[key] = absence;
        }
      });
    });
    return result;
  }, [absences, weekDays]);

  // Vérifier s'il y a des absences cette semaine
  const hasAbsencesThisWeek = useMemo(() =>
    Object.values(absencesByDay).some(arr => arr.length > 0),
    [absencesByDay]
  );

  // Navigation
  const goToPreviousWeek = () => {
    setExpandedCell(null);
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    setExpandedCell(null);
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setExpandedCell(null);
    setCurrentDate(new Date());
  };

  // Export PDF
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportWeeklyPlanningPdf(weekDays, teams, {
        title: 'Planning Hebdomadaire'
      });
    } catch (error) {
      logger.error('Erreur export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Obtenir les interventions d'une équipe pour un jour donné avec infos de span
  const getInterventionsForDay = (team, dateStr, weekDaysArray) => {
    // Utiliser les interventions pré-calculées par équipe et jour
    const dayInterventions = interventionsByTeamAndDay[team.id]?.[dateStr] || [];

    const result = dayInterventions.map(itv => {
      // Récupérer toutes les dates de l'intervention
      const allDates = itv.scheduled_dates?.length > 0
        ? [...itv.scheduled_dates].sort()
        : [itv.date];

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

      return {
        ...itv,
        isSpanStart: isSpanStart && !hasDatesBefore,
        isSpanMiddle: isSpanMiddle || (isSpanStart && hasDatesBefore),
        isSpanEnd: isSpanEnd && !hasDatesAfter,
        spanDays: totalDays,
        continuesBefore: hasDatesBefore && dateStr === weekStart,
        continuesAfter: hasDatesAfter && dateStr === weekEnd
      };
    });

    // Trier par heure
    return result.sort((a, b) => {
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

  // Stats rapides (basées sur les interventions de la semaine)
  const stats = useMemo(() => {
    const startStr = weekDays[0].dateStr;
    const endStr = weekDays[6].dateStr;

    // Compter les interventions uniques de la semaine
    const weekInterventions = interventions.filter(itv => {
      if (itv.scheduled_dates?.some(d => d >= startStr && d <= endStr)) return true;
      return itv.date >= startStr && itv.date <= endStr;
    });

    return {
      total: weekInterventions.length,
      completed: weekInterventions.filter(i => i.status === 'Terminée').length,
      teams: teams.filter(t => t.id !== 'unassigned' && t.interventionCount > 0).length
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
        <div className="gantt-actions">
          {/* Filtre par équipe */}
          <select
            className="team-filter-select"
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
            title="Filtrer par équipe"
          >
            <option value="all">Toutes les équipes</option>
            {allTeamsForWeek.map(team => (
              <option key={team.id} value={team.id}>
                {team.names?.join(', ') || team.name} ({team.interventionCount})
              </option>
            ))}
          </select>

          <button className="today-btn" onClick={goToToday}>
            Aujourd'hui
          </button>
          <button
            className="export-btn"
            onClick={handleExportPdf}
            disabled={isExporting}
            title="Exporter en PDF"
          >
            <DownloadIcon />
            {isExporting ? 'Export...' : 'PDF'}
          </button>
        </div>
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

          {/* Ligne des absences */}
          {hasAbsencesThisWeek && (
            <div className="gantt-row gantt-absence-row">
              <div className="gantt-team-cell absence-team-cell">
                <span className="absence-row-icon">🚫</span>
                <span className="team-name">Absences</span>
                <span className="team-count absence-count">
                  {Object.values(absencesByDay).reduce((sum, arr) => sum + arr.length, 0)}
                </span>
              </div>
              {weekDays.map(day => {
                const dayAbsences = absencesByDay[day.dateStr] || [];
                return (
                  <div
                    key={day.dateStr}
                    className={`gantt-day-cell ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''} ${dayAbsences.length > 0 ? 'has-absences' : ''}`}
                  >
                    {dayAbsences.map((absence, idx) => (
                      <AbsenceBar
                        key={`${absence.employeeId}-${idx}`}
                        absence={absence}
                        employeeName={absence.employeeName}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

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
                  <div className="team-names">
                    {team.names?.map((name, idx) => (
                      <span key={idx} className="team-member-name">{name}</span>
                    )) || <span className="team-member-name">{team.name}</span>}
                  </div>
                  <span className="team-count">
                    {team.interventionCount}
                  </span>
                </div>

                {/* Cellules des jours */}
                {weekDays.map(day => {
                  const dayInterventions = getInterventionsForDay(team, day.dateStr, weekDays);
                  const visibleInterventions = dayInterventions.slice(0, MAX_VISIBLE_PER_CELL);
                  const overflowCount = dayInterventions.length - MAX_VISIBLE_PER_CELL;
                  const hasOverflow = overflowCount > 0;
                  const loadClass = dayInterventions.length >= 4
                    ? 'load-heavy'
                    : dayInterventions.length >= 2
                      ? 'load-medium'
                      : '';

                  // Trouver les membres absents de cette équipe ce jour
                  const absentMembers = team.userIds
                    .map(uid => {
                      const key = `${uid}_${day.dateStr}`;
                      const absence = absencesByEmployeeDay[key];
                      if (!absence) return null;
                      return {
                        name: usersMap[uid]?.full_name || '?',
                        reason: absence.reason || 'Absent',
                      };
                    })
                    .filter(Boolean);

                  return (
                    <div
                      key={day.dateStr}
                      className={`gantt-day-cell ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''} ${dayInterventions.length > 0 ? 'has-items' : ''} ${hasOverflow ? 'has-overflow' : ''} ${absentMembers.length > 0 ? 'has-absent-member' : ''} ${loadClass}`}
                    >
                      {dayInterventions.length > 1 && (
                        <span
                          className="gantt-cell-count"
                          title={`${dayInterventions.length} interventions ce jour`}
                        >
                          {dayInterventions.length}
                        </span>
                      )}
                      {absentMembers.map((member, idx) => (
                        <div
                          key={`absent-${idx}`}
                          className="team-absence-indicator"
                          title={`${member.name} — ${member.reason}`}
                        >
                          <span className="team-absence-icon">🚫</span>
                          <span className="team-absence-name">{member.name.split(' ')[0]}</span>
                        </div>
                      ))}
                      {visibleInterventions.map(itv => (
                        <InterventionBar
                          key={itv.id}
                          intervention={itv}
                          color={team.color}
                          onClick={onInterventionClick}
                          onEditTeam={onEditTeam}
                          isSpanStart={itv.isSpanStart}
                          isSpanMiddle={itv.isSpanMiddle}
                          isSpanEnd={itv.isSpanEnd}
                          spanDays={itv.spanDays}
                        />
                      ))}
                      {hasOverflow && (
                        <OverflowIndicator
                          count={overflowCount}
                          onClick={() => setExpandedCell({
                            team,
                            day,
                            interventions: dayInterventions
                          })}
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
        <div className="legend-item">
          <span className="legend-bar absence"></span>
          <span>Absent</span>
        </div>
      </div>

      {/* Modal d'expansion : toutes les interventions d'une équipe pour un jour */}
      {expandedCell && (
        <div
          className="gantt-modal-backdrop"
          onClick={() => setExpandedCell(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="gantt-modal"
            onClick={e => e.stopPropagation()}
            style={{ '--modal-team-color': expandedCell.team.color }}
          >
            <div className="gantt-modal-header">
              <div className="gantt-modal-title">
                <span className="gantt-modal-team-dot" />
                <div className="gantt-modal-titles">
                  <strong>{expandedCell.team.names?.join(' + ') || expandedCell.team.name}</strong>
                  <span className="gantt-modal-date">
                    {expandedCell.day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="gantt-modal-close"
                onClick={() => setExpandedCell(null)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="gantt-modal-body">
              <div className="gantt-modal-count">
                {expandedCell.interventions.length} intervention{expandedCell.interventions.length > 1 ? 's' : ''}
              </div>
              <div className="gantt-modal-list">
                {expandedCell.interventions.map(itv => (
                  <button
                    key={itv.id}
                    type="button"
                    className={`gantt-modal-item${itv.status === 'Terminée' ? ' completed' : itv.status === 'En cours' ? ' in-progress' : ''}`}
                    onClick={() => {
                      onInterventionClick?.(itv);
                      setExpandedCell(null);
                    }}
                  >
                    <span className="gantt-modal-item-time">{formatTime(itv.time)}</span>
                    <div className="gantt-modal-item-info">
                      <span className="gantt-modal-item-client">{itv.client}</span>
                      {itv.service && (
                        <span className="gantt-modal-item-service">{itv.service}</span>
                      )}
                      {itv.address && (
                        <span className="gantt-modal-item-address">📍 {itv.address}</span>
                      )}
                    </div>
                    <span className={`gantt-modal-item-status${itv.status === 'Terminée' ? ' status-done' : itv.status === 'En cours' ? ' status-progress' : ' status-pending'}`}>
                      {itv.status === 'Terminée' ? '✓' : itv.status === 'En cours' ? '▶' : '○'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(PlanningGanttView);
