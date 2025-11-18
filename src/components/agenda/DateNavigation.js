// src/components/agenda/DateNavigation.js
// Composant de navigation entre dates/périodes

import React from 'react';
import { Button } from '../ui';
import { ChevronLeftIcon, ChevronRightIcon } from '../SharedUI';
import './DateNavigation.css';

/**
 * Formats a date range for display
 */
const formatDateRange = (startDate, endDate, viewMode) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (viewMode === 'week' || viewMode === 'resource') {
    const startMonth = start.toLocaleDateString('fr-FR', { month: 'short' });
    const endMonth = end.toLocaleDateString('fr-FR', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = end.getFullYear();

    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${endMonth} ${year}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
  }

  if (viewMode === 'month') {
    return start.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric'
    });
  }

  return start.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * DateNavigation Component
 * @param {Date} startDate - Start date of current period
 * @param {Date} endDate - End date of current period
 * @param {Function} onPrevious - Handler for previous period
 * @param {Function} onNext - Handler for next period
 * @param {Function} onToday - Handler to jump to today
 * @param {'day'|'week'|'month'|'resource'} viewMode - Current view mode
 * @param {Function} onViewModeChange - Handler for view mode change
 */
const DateNavigation = ({
  startDate,
  endDate,
  onPrevious,
  onNext,
  onToday,
  viewMode = 'week',
  onViewModeChange
}) => {
  const dateRangeText = formatDateRange(startDate, endDate, viewMode);

  return (
    <div className="date-navigation">
      <div className="date-navigation-controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          icon={<ChevronLeftIcon />}
          aria-label="Période précédente"
        />

        <div className="date-navigation-display">
          <h2 className="date-navigation-title">{dateRangeText}</h2>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          icon={<ChevronRightIcon />}
          aria-label="Période suivante"
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={onToday}
          className="date-navigation-today"
        >
          Aujourd'hui
        </Button>
      </div>

      {onViewModeChange && (
        <div className="date-navigation-view-modes" role="tablist">
          <button
            role="tab"
            aria-selected={viewMode === 'day'}
            className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => onViewModeChange('day')}
          >
            Jour
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'week'}
            className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => onViewModeChange('week')}
          >
            Semaine
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'month'}
            className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => onViewModeChange('month')}
          >
            Mois
          </button>
          <button
            role="tab"
            aria-selected={viewMode === 'resource'}
            className={`view-mode-btn ${viewMode === 'resource' ? 'active' : ''}`}
            onClick={() => onViewModeChange('resource')}
            title="Vue par employé"
          >
            👤 Par ressource
          </button>
        </div>
      )}
    </div>
  );
};

export default DateNavigation;
