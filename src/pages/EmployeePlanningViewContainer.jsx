// src/pages/EmployeePlanningViewContainer.js
// Wrapper qui utilise les hooks React Query et passe les données à EmployeePlanningView
import React from 'react';
import { useInterventions } from '../hooks/useInterventions';
import { useAuthStore } from '../store/authStore';
import EmployeePlanningView from './EmployeePlanningView';

/**
 * Container pour EmployeePlanningView qui gère la logique de données avec React Query
 */
const EmployeePlanningViewContainer = () => {
    const { profile } = useAuthStore();

    // Récupérer les interventions de l'employé avec le hook
    const { interventions, isLoading } = useInterventions(profile?.id);

    return (
        <EmployeePlanningView
            interventions={interventions}
            loading={isLoading}
            userName={profile?.full_name || profile?.email?.split('@')[0] || 'Collaborateur'}
        />
    );
};

export default EmployeePlanningViewContainer;
