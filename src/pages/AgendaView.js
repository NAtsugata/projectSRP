// src/pages/AgendaView_v2.js
// Version améliorée de l'agenda avec navigation, filtres et accessibilité

import React, { useState, useMemo, useCallback } from 'react';
import { AgendaDay, DateNavigation, AgendaFilters } from '../components/agenda';
import { EmptyState, LoadingSpinner } from '../components/ui';
import { CalendarIcon } from '../components/SharedUI';
import {
  filterInterventions,
  getDateRange,
  navigatePeriod
} from '../utils/agendaHelpers';
import logger from '../utils/logger';
import './AgendaView.css';

/**
 * AgendaView Component (v2 - Refactored)
 * @param {Array} interventions - List of interventions
 * @param {Function} onSelect - Handler when an intervention is clicked
 * @param {Array} employees - List of employees for filtering
 * @param {boolean} loading - Loading state
 * @param {Error} error - Error state
 */
const AgendaView = ({
  interventions = [],
  onSelect,
  employees = [],
  loading = false,
  error = null
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [filters, setFilters] = useState({
    employees: [],
    showUrgentOnly: false,
    showSAVOnly: false,
    searchText: ''
  });

  // Get current date range
  const dateRange = useMemo(() => {
    return getDateRange(currentDate, viewMode);
  }, [currentDate, viewMode]);

  // Filter interventions by date range and filters
  const filteredInterventions = useMemo(() => {
    logger.log('AgendaView: Filtering interventions...', {
      total: interventions.length,
      filters,
      viewMode,
      dateRange
    });

    // First filter by date range
    const startStr = dateRange.start.toISOString().split('T')[0];
    const endStr = dateRange.end.toISOString().split('T')[0];

    const inRange = interventions.filter(itv => {
      if (!itv.date) return false;
      return itv.date >= startStr && itv.date <= endStr;
    });

    // Then apply user filters
    const filtered = filterInterventions(inRange, filters);

    logger.log(`AgendaView: ${filtered.length} interventions after filtering`);
    return filtered;
  }, [interventions, filters, dateRange, viewMode]);

  // Group interventions by date
  const byDate = useMemo(() => {
    const acc = {};
    for (const it of filteredInterventions) {
      const d = it.date;
      if (!d) continue;
      (acc[d] = acc[d] || []).push(it);
    }
    return acc;
  }, [filteredInterventions]);

  const dates = useMemo(() => Object.keys(byDate).sort(), [byDate]);

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    const newDate = navigatePeriod(currentDate, viewMode, 'previous');
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleNext = useCallback(() => {
    const newDate = navigatePeriod(currentDate, viewMode, 'next');
    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    logger.log(`AgendaView: View mode changed to ${mode}`);
  }, []);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    logger.log('AgendaView: Filters changed', newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({
      employees: [],
      showUrgentOnly: false,
      showSAVOnly: false,
      searchText: ''
    });
    logger.log('AgendaView: Filters cleared');
  }, []);

  // Error state
  if (error) {
    return (
      <div className="agenda-view">
        <h2 className="view-title">Agenda</h2>
        <EmptyState
          icon={<CalendarIcon />}
          title="Erreur de chargement"
          message={error.message || "Impossible de charger l'agenda"}
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="agenda-view">
        <h2 className="view-title">Agenda</h2>
        <LoadingSpinner text="Chargement de l'agenda..." />
      </div>
    );
  }

  return (
    <div className="agenda-view">
      <h2 className="view-title">Agenda</h2>

      {/* Date Navigation */}
      <DateNavigation
        startDate={dateRange.start}
        endDate={dateRange.end}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Filters */}
      <AgendaFilters
        employees={employees}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Days list */}
      {dates.length > 0 ? (
        <div className="agenda-days-list">
          {dates.map((date) => (
            <AgendaDay
              key={date}
              date={date}
              interventions={byDate[date] || []}
              onSelect={onSelect}
              showDate={true}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarIcon />}
          title="Aucune intervention"
          message={
            filters.employees?.length > 0 ||
            filters.showUrgentOnly ||
            filters.showSAVOnly ||
            filters.searchText
              ? "Aucune intervention ne correspond aux filtres sélectionnés."
              : "Aucune intervention prévue pour cette période."
          }
        />
      )}
    </div>
  );
};

export default AgendaView;
