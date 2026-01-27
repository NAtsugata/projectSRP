// src/pages/EmployeePlanningView.js - Version refactorisée
// Planning employé avec réutilisation des composants

import React, { useCallback, useState } from 'react';
import { CoffeeIcon, CalendarIcon, ListIcon } from '../components/SharedUI';
import { useNavigate } from 'react-router-dom';
import { InterventionList, PlanningGanttView } from '../components/planning';
import { LoadingSpinner } from '../components/ui';
import './EmployeePlanningView.css';

// Types de vue disponibles
const VIEW_MODES = {
  GANTT: 'gantt',
  LIST: 'list'
};

export default function EmployeePlanningView({ interventions, loading = false, userName, users = [] }) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('employeePlanningViewMode') || VIEW_MODES.GANTT;
  });

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    localStorage.setItem('employeePlanningViewMode', mode);
  }, []);

  const handleView = useCallback((intervention) => {
    navigate(`/planning/${intervention.id}`);
  }, [navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="employee-planning-view">
        <div className="planning-header-section">
          <h2 className="planning-title">Bonjour, {userName} 👋</h2>
          <p className="planning-subtitle">Chargement de votre planning...</p>
        </div>
        <LoadingSpinner text="Récupération des interventions..." />
      </div>
    );
  }

  const interventionCount = interventions?.length || 0;

  return (
    <div className="employee-planning-view">
      <div className="planning-header-section">
        <div className="header-top">
          <div className="header-text">
            <h2 className="planning-title">Bonjour, {userName} 👋</h2>
            <p className="planning-subtitle">
              Vous avez {interventionCount} intervention{interventionCount > 1 ? 's' : ''} planifiée{interventionCount > 1 ? 's' : ''}.
            </p>
          </div>

          {/* Sélecteur de vue */}
          <div className="view-mode-selector">
            <button
              className={`view-mode-btn ${viewMode === VIEW_MODES.GANTT ? 'active' : ''}`}
              onClick={() => handleViewModeChange(VIEW_MODES.GANTT)}
              title="Vue Planning"
            >
              <CalendarIcon />
              <span className="view-mode-label">Planning</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === VIEW_MODES.LIST ? 'active' : ''}`}
              onClick={() => handleViewModeChange(VIEW_MODES.LIST)}
              title="Vue Liste"
            >
              <ListIcon />
              <span className="view-mode-label">Liste</span>
            </button>
          </div>
        </div>
      </div>

      {interventionCount === 0 ? (
        <div className="employee-planning-empty">
          <CoffeeIcon className="employee-planning-empty-icon" />
          <h3 className="employee-planning-empty-title">Aucune intervention</h3>
          <p className="employee-planning-empty-description">
            Profitez de votre journée ! Votre planning est vide pour le moment.
          </p>
        </div>
      ) : (
        <div className="planning-content">
          {viewMode === VIEW_MODES.GANTT && (
            <PlanningGanttView
              interventions={interventions}
              users={users}
              onInterventionClick={handleView}
            />
          )}

          {viewMode === VIEW_MODES.LIST && (
            <InterventionList
              interventions={interventions}
              onView={handleView}
              showFilters={true}
              showSort={true}
              showActions={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
