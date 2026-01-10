// src/components/agenda/AgendaFilters.js
// Composant de filtres pour l'agenda

import React, { useState } from 'react';
import { Button } from '../ui';
import { FilterIcon, XIcon } from '../SharedUI';
import './AgendaFilters.css';

/**
 * AgendaFilters Component
 * @param {Array} employees - List of employees to filter by
 * @param {Object} filters - Current filter values
 * @param {Function} onFiltersChange - Handler when filters change
 * @param {Function} onClearFilters - Handler to clear all filters
 */
const AgendaFilters = ({
  employees = [],
  filters = {},
  onFiltersChange,
  onClearFilters
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handleEmployeeToggle = (employeeId) => {
    const selectedEmployees = filters.employees || [];
    const isSelected = selectedEmployees.includes(employeeId);

    handleFilterChange(
      'employees',
      isSelected
        ? selectedEmployees.filter(id => id !== employeeId)
        : [...selectedEmployees, employeeId]
    );
  };

  const hasActiveFilters = () => {
    return (
      (filters.employees && filters.employees.length > 0) ||
      filters.showUrgentOnly ||
      filters.showSAVOnly ||
      filters.searchText
    );
  };

  const activeFilterCount = () => {
    let count = 0;
    if (filters.employees && filters.employees.length > 0) count += filters.employees.length;
    if (filters.showUrgentOnly) count++;
    if (filters.showSAVOnly) count++;
    if (filters.searchText) count++;
    return count;
  };

  return (
    <div className="agenda-filters">
      <div className="agenda-filters-header">
        <Button
          variant="secondary"
          size="sm"
          icon={<FilterIcon />}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="filters-panel"
        >
          Filtres
          {activeFilterCount() > 0 && (
            <span className="filter-badge">{activeFilterCount()}</span>
          )}
        </Button>

        {hasActiveFilters() && (
          <Button
            variant="ghost"
            size="sm"
            icon={<XIcon />}
            onClick={onClearFilters}
          >
            Effacer tout
          </Button>
        )}
      </div>

      {isExpanded && (
        <div
          id="filters-panel"
          className="agenda-filters-panel"
          role="region"
          aria-label="Panneau de filtres"
        >
          {/* Search */}
          <div className="filter-group">
            <label htmlFor="search-filter" className="filter-label">
              Rechercher
            </label>
            <input
              id="search-filter"
              type="text"
              className="filter-input"
              placeholder="Client, service, adresse..."
              value={filters.searchText || ''}
              onChange={(e) => handleFilterChange('searchText', e.target.value)}
            />
          </div>

          {/* Employees */}
          {employees.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">Intervenants</label>
              <div className="filter-checkboxes">
                {employees.map((employee) => (
                  <label key={employee.id} className="filter-checkbox-label">
                    <input
                      type="checkbox"
                      checked={(filters.employees || []).includes(employee.id)}
                      onChange={() => handleEmployeeToggle(employee.id)}
                      className="filter-checkbox"
                    />
                    <span>{employee.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status filters */}
          <div className="filter-group">
            <label className="filter-label">Statut</label>
            <div className="filter-checkboxes">
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.showUrgentOnly || false}
                  onChange={(e) => handleFilterChange('showUrgentOnly', e.target.checked)}
                  className="filter-checkbox"
                />
                <span>Besoins urgents uniquement</span>
              </label>
              <label className="filter-checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.showSAVOnly || false}
                  onChange={(e) => handleFilterChange('showSAVOnly', e.target.checked)}
                  className="filter-checkbox"
                />
                <span>SAV à prévoir uniquement</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaFilters;
