// src/pages/EmployeePlanningView.js - Version refactorisée
// Planning employé avec réutilisation des composants

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { InterventionList } from '../components/planning';
import { LoadingSpinner } from '../components/ui';
import './EmployeePlanningView.css';

export default function EmployeePlanningView({ interventions, loading = false }) {
  const navigate = useNavigate();

  const handleView = useCallback((intervention) => {
    navigate(`/planning/${intervention.id}`);
  }, [navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="employee-planning-view">
        <h2 className="planning-title">Votre Planning</h2>
        <LoadingSpinner text="Chargement de vos interventions..." />
      </div>
    );
  }

  return (
    <div className="employee-planning-view">
      <h2 className="planning-title">Votre Planning</h2>

      <div className="planning-description">
        <p>Retrouvez ici toutes les interventions qui vous sont assignées.</p>
      </div>

      <InterventionList
        interventions={interventions}
        onView={handleView}
        showFilters={true}
        showSort={true}
        showActions={false}
      />
    </div>
  );
}
