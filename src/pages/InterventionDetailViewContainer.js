// src/pages/InterventionDetailViewContainer.js
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { interventionService } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import InterventionDetailView from './InterventionDetailView';

const InterventionDetailViewContainer = () => {
    const { interventionId } = useParams();
    const { profile } = useAuthStore();

    const { data: intervention, isLoading } = useQuery({
        queryKey: ['intervention', interventionId],
        queryFn: async () => {
            const { data, error } = await interventionService.supabase
                .from('interventions')
                .select('*')
                .eq('id', interventionId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!interventionId,
    });

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement de l'intervention...</div>
            </div>
        );
    }

    // InterventionDetailView attend beaucoup de props, je vais passer les props essentiels
    return (
        <InterventionDetailView
            intervention={intervention}
            profile={profile}
        // Les autres props seront gérés par le composant lui-même
        />
    );
};

export default InterventionDetailViewContainer;
