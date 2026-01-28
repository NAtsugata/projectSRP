// src/pages/EmployeePlanningViewContainer.js
// Wrapper qui utilise les hooks React Query et passe les données à EmployeePlanningView
import React, { useEffect } from 'react';
import { useInterventions } from '../hooks/useInterventions';
import { useUsers } from '../hooks/useUsers';
import { useAuthStore } from '../store/authStore';
import EmployeePlanningView from './EmployeePlanningView';
import logger from '../utils/logger';

/**
 * Container pour EmployeePlanningView qui gère la logique de données avec React Query
 */
const EmployeePlanningViewContainer = () => {
    const { profile, user } = useAuthStore();

    // Debug: Log profile info
    useEffect(() => {
        logger.log('👤 EmployeePlanningViewContainer - Profile:', {
            profileId: profile?.id,
            profileName: profile?.full_name,
            userId: user?.id,
            isAdmin: profile?.is_admin
        });
    }, [profile, user]);

    // Récupérer les interventions de l'employé avec le hook
    const { interventions, isLoading, error } = useInterventions(profile?.id);

    // Récupérer les utilisateurs pour afficher les noms dans le Gantt
    const { users } = useUsers();

    // Debug: Log interventions
    useEffect(() => {
        logger.log('📋 EmployeePlanningViewContainer - Interventions:', {
            count: interventions?.length,
            isLoading,
            error: error?.message,
            profileId: profile?.id
        });
    }, [interventions, isLoading, error, profile?.id]);

    return (
        <EmployeePlanningView
            interventions={interventions}
            users={users}
            loading={isLoading}
            userId={profile?.id}
            userName={profile?.full_name || profile?.email?.split('@')[0] || 'Collaborateur'}
        />
    );
};

export default EmployeePlanningViewContainer;
