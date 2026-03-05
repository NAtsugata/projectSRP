// src/components/agenda/QuickActionsBar.jsx
// Barre d'actions rapides pour l'admin

import React, { useState } from 'react';
import { PlusIcon, UsersIcon, FilterIcon, DownloadIcon, RefreshCwIcon } from '../SharedUI';
import './QuickActionsBar.css';

/**
 * Barre d'actions rapides pour l'admin
 */
const QuickActionsBar = ({
  onNewIntervention,
  onAssignUnassigned,
  onFilterUrgent,
  onExportPDF,
  onRefresh,
  stats = {}
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  return (
    <div className="quick-actions-bar">
      <div className="quick-actions-left">
        <h3 className="quick-actions-title">Actions rapides</h3>
      </div>

      <div className="quick-actions-buttons">
        {/* Nouvelle intervention */}
        {onNewIntervention && (
          <button
            className="quick-action-btn quick-action-primary"
            onClick={onNewIntervention}
            title="Nouvelle intervention"
          >
            <PlusIcon />
            <span>Nouvelle</span>
          </button>
        )}

        {/* Assigner les non assignées */}
        {onAssignUnassigned && stats.unassigned > 0 && (
          <button
            className="quick-action-btn quick-action-warning"
            onClick={onAssignUnassigned}
            title="Assigner les interventions non assignées"
          >
            <UsersIcon />
            <span>Assigner ({stats.unassigned})</span>
          </button>
        )}

        {/* Filtrer urgents */}
        {onFilterUrgent && stats.urgent > 0 && (
          <button
            className="quick-action-btn quick-action-urgent"
            onClick={onFilterUrgent}
            title="Voir les urgences"
          >
            <FilterIcon />
            <span>Urgents ({stats.urgent})</span>
          </button>
        )}

        {/* Export PDF */}
        {onExportPDF && (
          <button
            className="quick-action-btn quick-action-secondary"
            onClick={onExportPDF}
            title="Exporter en PDF"
          >
            <DownloadIcon />
            <span>Export</span>
          </button>
        )}

        {/* Rafraichir */}
        <button
          className={`quick-action-btn quick-action-refresh ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          title="Rafraichir les données"
          disabled={isRefreshing}
        >
          <RefreshCwIcon className={isRefreshing ? 'spin' : ''} />
        </button>
      </div>
    </div>
  );
};

export default QuickActionsBar;
