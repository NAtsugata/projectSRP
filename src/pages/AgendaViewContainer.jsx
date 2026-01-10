// src/pages/AgendaViewContainer.js
// Wrapper qui utilise les hooks React Query et passe les données à AgendaView
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterventions } from '../hooks/useInterventions';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '../lib/supabase';
import AgendaView from './AgendaView';

/**
 * Container pour AgendaView qui gère la logique de données avec React Query
 */
const AgendaViewContainer = () => {
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    // Récupérer les interventions avec le hook
    const { interventions, isLoading: interventionsLoading, error: interventionsError } = useInterventions(
        profile?.is_admin ? null : profile?.id
    );

    // Récupérer la liste des employés
    const { data: employees = [], isLoading: employeesLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const profiles = await profileService.getAllProfiles();
            return profiles.data || [];
        },
    });

    // Handler pour la sélection d'une intervention
    const handleSelect = (intervention) => {
        navigate(`/intervention/${intervention.id}`);
    };

    // Combiner les états de chargement
    const loading = interventionsLoading || employeesLoading;
    const error = interventionsError;

    return (
        <AgendaView
            interventions={interventions}
            onSelect={handleSelect}
            employees={employees}
            loading={loading}
            error={error}
            currentUserId={profile?.id}
        />
    );
};

export default AgendaViewContainer;
