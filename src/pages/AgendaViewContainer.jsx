// src/pages/AgendaViewContainer.js
// Wrapper qui utilise les hooks React Query et passe les données à AgendaView
// Affiche une vue simplifiée pour les employés et une vue complète pour les admins
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterventions } from '../hooks/useInterventions';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { profileService } from '../lib/supabase';
import AgendaView from './AgendaView';
import { EmployeeAgendaView } from '../components/agenda';

/**
 * Container pour AgendaView qui gère la logique de données avec React Query
 * Utilise une vue simplifiée pour les employés et une vue complète pour les admins
 */
const AgendaViewContainer = () => {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const isAdmin = profile?.is_admin;

    // Récupérer les interventions avec le hook
    // Pour les employés, filtrer uniquement leurs interventions
    const { interventions, isLoading: interventionsLoading, error: interventionsError, refetch } = useInterventions(
        isAdmin ? null : profile?.id
    );

    // Récupérer la liste des employés (seulement pour les admins)
    const { data: employees = [], isLoading: employeesLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const profiles = await profileService.getAllProfiles();
            return profiles.data || [];
        },
        enabled: isAdmin, // Seulement charger pour les admins
    });

    // Handler pour la sélection d'une intervention
    const handleSelect = (intervention) => {
        navigate(`/planning/${intervention.id}`);
    };

    // Combiner les états de chargement
    const loading = interventionsLoading || (isAdmin && employeesLoading);
    const error = interventionsError;

    // Pour les employés, afficher la vue simplifiée
    if (!isAdmin) {
        return (
            <EmployeeAgendaView
                interventions={interventions}
                loading={loading}
                error={error}
                userName={profile?.full_name || profile?.email?.split('@')[0]}
            />
        );
    }

    // Pour les admins, afficher la vue complète
    return (
        <AgendaView
            interventions={interventions}
            onSelect={handleSelect}
            employees={employees}
            loading={loading}
            error={error}
            currentUserId={profile?.id}
            onRefreshInterventions={refetch}
        />
    );
};

export default AgendaViewContainer;
