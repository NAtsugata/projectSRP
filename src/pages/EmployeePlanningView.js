// src/pages/EmployeePlanningView.js - Version refactorisée
// Planning employé avec réutilisation des composants

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { InterventionList } from '../components/planning';
import { LoadingSpinner } from '../components/ui';
import './EmployeePlanningView.css';

export default function EmployeePlanningView({ interventions, loading = false, userName }) {
  const navigate = useNavigate();

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
        <h2 className="planning-title">Bonjour, {userName} 👋</h2>
        <p className="planning-subtitle">
          Vous avez {interventionCount} intervention{interventionCount > 1 ? 's' : ''} prévue{interventionCount > 1 ? 's' : ''} aujourd'hui.
        </p>
      </div>

      {interventionCount === 0 ? (
        <div className="employee-planning-empty">
          <div className="employee-planning-empty-icon">☕</div>
          <h3 className="employee-planning-empty-title">Aucune intervention</h3>
          <p className="employee-planning-empty-description">
            Profitez de votre journée ! Votre planning est vide pour le moment.
          </p>
        </div>
      ) : (
        <InterventionList
          interventions={interventions}
          onView={handleView}
          showFilters={true}
          showSort={true}
          showActions={false}
        />
      )}
    </div>
  );
}
