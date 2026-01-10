// src/components/planning/InterventionList.js
// Liste d'interventions avec tri et filtrage

import React, { useState, useMemo } from 'react';
import InterventionCard from './InterventionCard';
import { EmptyState } from '../ui';
import { CalendarIcon } from '../SharedUI';
import './InterventionList.css';

/**
 * Sort interventions by date and time
 */
const sortInterventions = (interventions, sortBy) => {
  const sorted = [...interventions];

  switch (sortBy) {
    case 'date-asc':
      return sorted.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.time || '').localeCompare(b.time || '');
      });

    case 'date-desc':
      return sorted.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.time || '').localeCompare(a.time || '');
      });

    case 'client':
      return sorted.sort((a, b) => (a.client || '').localeCompare(b.client || ''));

    case 'status':
      const statusOrder = { 'En cours': 0, 'À venir': 1, 'Terminée': 2 };
      return sorted.sort((a, b) => {
        const statusA = a.status || 'À venir';
        const statusB = b.status || 'À venir';
        return (statusOrder[statusA] || 99) - (statusOrder[statusB] || 99);
      });

    default:
      return sorted;
  }
};

/**
 * Filter interventions
 */
const filterInterventions = (interventions, filters) => {
  return interventions.filter(intervention => {
    // Filter by search text
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      const matchesClient = intervention.client?.toLowerCase().includes(search);
      const matchesService = intervention.service?.toLowerCase().includes(search);
      const matchesAddress = intervention.address?.toLowerCase().includes(search);
      if (!matchesClient && !matchesService && !matchesAddress) {
        return false;
      }
    }

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      const interventionStatus = intervention.status || 'À venir';
      if (interventionStatus !== filters.status) {
        return false;
      }
    }

    return true;
  });
};

/**
 * InterventionList Component
 * @param {Array} interventions - List of interventions
 * @param {Function} onView - Handler to view details
 * @param {Function} onArchive - Handler to archive
 * @param {Function} onDelete - Handler to delete
 * @param {Array} checklistTemplates - Available checklist templates
 * @param {Function} onAssignChecklist - Handler to assign checklist
 * @param {boolean} showFilters - Show filter controls
 * @param {boolean} showSort - Show sort controls
 * @param {boolean} showActions - Show actions on cards (default true)
 */
const InterventionList = ({
  interventions = [],
  onView,
  onArchive,
  onDelete,
  checklistTemplates,
  onAssignChecklist,
  showFilters = true,
  showSort = true,
  showActions = true
}) => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-asc');

  const filteredAndSorted = useMemo(() => {
    const filtered = filterInterventions(interventions, {
      searchText,
      status: statusFilter
    });
    return sortInterventions(filtered, sortBy);
  }, [interventions, searchText, statusFilter, sortBy]);

  return (
    <div className="intervention-list-container">
      {/* Filters and Sort */}
      {(showFilters || showSort) && (
        <div className="intervention-list-controls">
          {showFilters && (
            <div className="control-group">
              <input
                type="text"
                placeholder="Rechercher (client, service, adresse)..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="search-input"
                aria-label="Rechercher des interventions"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
                aria-label="Filtrer par statut"
              >
                <option value="all">Tous les statuts</option>
                <option value="À venir">À venir</option>
                <option value="En cours">En cours</option>
                <option value="Terminée">Terminée</option>
              </select>
            </div>
          )}

          {showSort && (
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
              aria-label="Trier par"
            >
              <option value="date-asc">Date (croissant)</option>
              <option value="date-desc">Date (décroissant)</option>
              <option value="client">Client (A-Z)</option>
              <option value="status">Statut</option>
            </select>
          )}
        </div>
      )}

      {/* Results count */}
      {(searchText || statusFilter !== 'all') && (
        <div className="results-info">
          {filteredAndSorted.length} intervention{filteredAndSorted.length > 1 ? 's' : ''} trouvée{filteredAndSorted.length > 1 ? 's' : ''}
          {filteredAndSorted.length < interventions.length && ` sur ${interventions.length}`}
        </div>
      )}

      {/* List */}
      {filteredAndSorted.length > 0 ? (
        <div className="intervention-list" role="list">
          {filteredAndSorted.map(intervention => (
            <div key={intervention.id} role="listitem">
              <InterventionCard
                intervention={intervention}
                onView={onView}
                onArchive={onArchive}
                onDelete={onDelete}
                checklistTemplates={checklistTemplates}
                onAssignChecklist={onAssignChecklist}
                showActions={showActions}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarIcon />}
          title={
            searchText || statusFilter !== 'all'
              ? 'Aucune intervention trouvée'
              : 'Aucune intervention planifiée'
          }
          message={
            searchText || statusFilter !== 'all'
              ? 'Aucune intervention ne correspond aux filtres sélectionnés.'
              : 'Créez votre première intervention pour commencer.'
          }
        />
      )}
    </div>
  );
};

export default InterventionList;
