// src/components/leave/LeaveRequestList.js
// Liste intelligente de demandes de congés avec recherche, tri et filtrage

import React, { useState, useMemo } from 'react';
import LeaveRequestCard from './LeaveRequestCard';
import { EmptyState } from '../ui';
import { SearchIcon, FilterIcon } from '../SharedUI';
import logger from '../../utils/logger';
import './LeaveRequestList.css';

/**
 * Helper: Filter leave requests by search and status
 */
const filterRequests = (requests, searchText, statusFilter) => {
  let filtered = [...requests];

  // Search filter (user name or reason)
  if (searchText.trim()) {
    const search = searchText.toLowerCase();
    filtered = filtered.filter(req =>
      req.user_name?.toLowerCase().includes(search) ||
      req.reason?.toLowerCase().includes(search)
    );
  }

  // Status filter
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(req => req.status === statusFilter);
  }

  return filtered;
};

/**
 * Helper: Sort leave requests
 */
const sortRequests = (requests, sortBy) => {
  const sorted = [...requests];

  switch (sortBy) {
    case 'date-asc':
      return sorted.sort((a, b) =>
        new Date(a.start_date) - new Date(b.start_date)
      );
    case 'date-desc':
      return sorted.sort((a, b) =>
        new Date(b.start_date) - new Date(a.start_date)
      );
    case 'status':
      // Order: En attente > Approuvée > Rejetée
      const statusOrder = { 'En attente': 0, 'Approuvée': 1, 'Rejetée': 2 };
      return sorted.sort((a, b) =>
        (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      );
    case 'user':
      return sorted.sort((a, b) =>
        (a.user_name || '').localeCompare(b.user_name || '')
      );
    default:
      return sorted;
  }
};

/**
 * LeaveRequestList Component
 *
 * @param {Array} requests - Array of leave request objects
 * @param {Function} onApprove - Callback when approving (admin only)
 * @param {Function} onReject - Callback when rejecting (admin only)
 * @param {Function} onDelete - Callback when deleting
 * @param {boolean} showFilters - Show search/filter controls (default true)
 * @param {boolean} showSort - Show sort controls (default true)
 * @param {boolean} showActions - Show actions on cards (default true)
 * @param {boolean} showUserName - Show user name on cards (default false)
 */
const LeaveRequestList = ({
  requests = [],
  onApprove,
  onReject,
  onDelete,
  showFilters = true,
  showSort = true,
  showActions = true,
  showUserName = false
}) => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  // Filtered and sorted requests
  const displayedRequests = useMemo(() => {
    const filtered = filterRequests(requests, searchText, statusFilter);
    const sorted = sortRequests(filtered, sortBy);

    logger.log('LeaveRequestList: Affichage', {
      total: requests.length,
      filtered: filtered.length,
      sorted: sorted.length,
      searchText,
      statusFilter,
      sortBy
    });

    return sorted;
  }, [requests, searchText, statusFilter, sortBy]);

  const handleClearFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setSortBy('date-desc');
    logger.log('LeaveRequestList: Réinitialisation filtres');
  };

  const hasActiveFilters = searchText || statusFilter !== 'all';

  return (
    <div className="leave-request-list">
      {/* Search and Filters */}
      {showFilters && (
        <div className="list-controls">
          <div className="search-box">
            <SearchIcon />
            <input
              type="text"
              placeholder="Rechercher par nom ou motif..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <FilterIcon />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tous les statuts</option>
              <option value="En attente">En attente</option>
              <option value="Approuvée">Approuvée</option>
              <option value="Rejetée">Rejetée</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="clear-filters-btn"
              type="button"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Sort Controls */}
      {showSort && (
        <div className="sort-controls">
          <label className="sort-label">Trier par :</label>
          <div className="sort-options">
            <button
              className={`sort-btn ${sortBy === 'date-desc' ? 'active' : ''}`}
              onClick={() => setSortBy('date-desc')}
              type="button"
            >
              Date (récent)
            </button>
            <button
              className={`sort-btn ${sortBy === 'date-asc' ? 'active' : ''}`}
              onClick={() => setSortBy('date-asc')}
              type="button"
            >
              Date (ancien)
            </button>
            <button
              className={`sort-btn ${sortBy === 'status' ? 'active' : ''}`}
              onClick={() => setSortBy('status')}
              type="button"
            >
              Statut
            </button>
            {showUserName && (
              <button
                className={`sort-btn ${sortBy === 'user' ? 'active' : ''}`}
                onClick={() => setSortBy('user')}
                type="button"
              >
                Employé
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results Counter */}
      {requests.length > 0 && (
        <div className="results-info">
          {displayedRequests.length} demande{displayedRequests.length > 1 ? 's' : ''}
          {hasActiveFilters && ` sur ${requests.length}`}
        </div>
      )}

      {/* List */}
      {displayedRequests.length > 0 ? (
        <div className="requests-grid">
          {displayedRequests.map((request) => (
            <LeaveRequestCard
              key={request.id}
              request={request}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
              showActions={showActions}
              showUserName={showUserName}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📋"
          title={
            hasActiveFilters
              ? 'Aucune demande trouvée'
              : 'Aucune demande de congé'
          }
          message={
            hasActiveFilters
              ? 'Essayez de modifier vos critères de recherche'
              : 'Les demandes de congés apparaîtront ici'
          }
          action={
            hasActiveFilters ? (
              <button onClick={handleClearFilters} className="empty-action-btn">
                Réinitialiser les filtres
              </button>
            ) : null
          }
        />
      )}
    </div>
  );
};

export default LeaveRequestList;
