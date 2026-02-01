// src/components/planning/PlanningMonthView.jsx
// Vue mensuelle du planning

import React, { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from '../SharedUI';
import { exportMonthlyPlanningPdf } from '../../utils/planningPdfExport';
import { toLocalDateStr } from '../../utils/agendaHelpers';
import logger from '../../utils/logger';
import './PlanningMonthView.css';

/**
 * Génère tous les jours d'un mois avec padding pour aligner au lundi
 */
const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  // Ajouter les jours du mois précédent pour commencer au lundi
  const startDayOfWeek = firstDay.getDay();
  const daysToAdd = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  for (let i = daysToAdd; i > 0; i--) {
    const date = new Date(year, month, 1 - i);
    days.push({
      date,
      dateStr: toLocalDateStr(date),
      dayNum: date.getDate(),
      isCurrentMonth: false,
      isToday: date.toDateString() === new Date().toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }

  // Ajouter les jours du mois courant
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      dateStr: toLocalDateStr(date),
      dayNum: d,
      isCurrentMonth: true,
      isToday: date.toDateString() === new Date().toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }

  // Ajouter les jours du mois suivant pour compléter la grille
  const remainingDays = 42 - days.length; // 6 semaines × 7 jours
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      dateStr: toLocalDateStr(date),
      dayNum: i,
      isCurrentMonth: false,
      isToday: date.toDateString() === new Date().toDateString(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    });
  }

  return days;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const PlanningMonthView = ({
  interventions = [],
  onInterventionClick,
  onDayClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month]);

  // Grouper les interventions par date
  const interventionsByDate = useMemo(() => {
    const byDate = {};

    interventions.forEach(itv => {
      const dates = itv.scheduled_dates?.length > 0
        ? itv.scheduled_dates
        : (itv.date ? [itv.date] : []);

      dates.forEach(dateStr => {
        if (!byDate[dateStr]) {
          byDate[dateStr] = [];
        }
        byDate[dateStr].push(itv);
      });
    });

    return byDate;
  }, [interventions]);

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

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportMonthlyPlanningPdf(year, month, interventions, {
        title: 'Planning Mensuel'
      });
    } catch (error) {
      logger.error('Erreur export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Stats du mois
  const monthStats = useMemo(() => {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-31`;

    const monthInterventions = interventions.filter(itv => {
      const dates = itv.scheduled_dates?.length > 0 ? itv.scheduled_dates : [itv.date];
      return dates.some(d => d >= monthStart && d <= monthEnd);
    });

    return {
      total: monthInterventions.length,
      completed: monthInterventions.filter(i => i.status === 'Terminée').length
    };
  }, [interventions, year, month]);

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="planning-month">
      {/* Header */}
      <div className="month-header">
        <div className="month-nav">
          <button className="nav-btn" onClick={goToPreviousMonth}>
            <ChevronLeftIcon />
          </button>
          <div className="month-title">
            <h3>{monthName}</h3>
            <div className="month-stats">
              <span>{monthStats.total} intervention{monthStats.total > 1 ? 's' : ''}</span>
              <span className="stat-separator">•</span>
              <span className="stat-completed">{monthStats.completed} terminée{monthStats.completed > 1 ? 's' : ''}</span>
            </div>
          </div>
          <button className="nav-btn" onClick={goToNextMonth}>
            <ChevronRightIcon />
          </button>
        </div>
        <div className="month-actions">
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

      {/* Grille du calendrier */}
      <div className="month-grid">
        {/* En-tête des jours */}
        <div className="weekdays-header">
          {WEEKDAYS.map(day => (
            <div key={day} className="weekday-cell">{day}</div>
          ))}
        </div>

        {/* Jours du mois */}
        <div className="days-grid">
          {monthDays.map(day => {
            const dayInterventions = interventionsByDate[day.dateStr] || [];
            const hasInterventions = dayInterventions.length > 0;

            return (
              <div
                key={day.dateStr}
                className={`day-cell ${day.isCurrentMonth ? '' : 'other-month'} ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''} ${hasInterventions ? 'has-items' : ''}`}
                onClick={() => onDayClick?.(day.date, dayInterventions)}
              >
                <span className="day-number">{day.dayNum}</span>

                {hasInterventions && (
                  <div className="day-interventions">
                    {dayInterventions.slice(0, 3).map(itv => (
                      <div
                        key={itv.id}
                        className={`intervention-dot ${itv.status === 'Terminée' ? 'completed' : itv.status === 'En cours' ? 'in-progress' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onInterventionClick?.(itv);
                        }}
                        title={`${itv.time || ''} ${itv.client}`}
                      >
                        <span className="dot-time">{itv.time?.slice(0, 5) || '08:00'}</span>
                        <span className="dot-client">{itv.client}</span>
                      </div>
                    ))}
                    {dayInterventions.length > 3 && (
                      <span className="more-count">+{dayInterventions.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="month-legend">
        <div className="legend-item">
          <span className="legend-dot"></span>
          <span>À venir</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot in-progress"></span>
          <span>En cours</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot completed"></span>
          <span>Terminée</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PlanningMonthView);
