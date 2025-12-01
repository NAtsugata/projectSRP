// src/pages/InterventionDetailViewContainer.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { interventionService, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../contexts/ToastContext';
import { buildSanitizedReport } from '../utils/reportHelpers';
import InterventionDetailView from './InterventionDetailView';

const InterventionDetailViewContainer = () => {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data: intervention, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['intervention', interventionId],
        queryFn: async () => {
            console.log('🔍 Fetching intervention:', interventionId);
            const { data, error } = await supabase
                .from('interventions')
                .select('*')
                .eq('id', interventionId)
                .single();

            if (error) {
                console.error('❌ Error fetching intervention:', error);
                throw error;
            }
            return data;
        },
        enabled: !!interventionId,
        retry: 1
    });

    if (isError) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h3>Erreur lors du chargement de l'intervention</h3>
                <p className="text-danger">{error?.message || 'Intervention introuvable ou accès refusé.'}</p>
                <button className="btn btn-primary" onClick={() => navigate('/planning')}>
                    Retour au planning
                </button>
            </div>
        );
    }

    // ⚙️ Persistance silencieuse — attend le *report* directement
    const handleUpdateInterventionReportSilent = async (id, report) => {
        const sanitizedReport = buildSanitizedReport(report);
        const { error } = await interventionService.updateIntervention(id, {
            report: sanitizedReport
        });
        if (!error) {
            queryClient.invalidateQueries(['intervention', id]);
        }
        return { success: !error, error };
    };

    // 💾 Sauvegarde + statut
    const handleUpdateInterventionReport = async (id, report) => {
        try {
            const newStatus = report?.departureTime ? 'Terminée' : 'En cours';
            const sanitizedReport = buildSanitizedReport(report);

            const { error } = await interventionService.updateIntervention(id, {
                report: sanitizedReport,
                status: newStatus
            });

            if (error) throw error;

            toast?.success(newStatus === 'Terminée' ? 'Rapport sauvegardé et intervention clôturée.' : 'Rapport sauvegardé.');
            queryClient.invalidateQueries(['intervention', id]);
            queryClient.invalidateQueries(['interventions']); // Refresh list too
            navigate('/planning');
        } catch (error) {
            toast?.error('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'));
            throw error;
        }
    };

    const handleAddBriefingDocuments = async (id, files) => {
        try {
            const { error } = await interventionService.addBriefingDocuments(id, files);
            if (error) throw error;
            toast?.success('Documents de préparation ajoutés avec succès.');
            refetch();
        } catch (error) {
            toast?.error(`Erreur lors de l'ajout des documents : ${error.message}`);
            throw error;
        }
    };

    const handleUpdateScheduledDates = async (id, scheduledDates) => {
        try {
            const { error } = await interventionService.updateIntervention(id, {
                scheduled_dates: scheduledDates.length > 0 ? scheduledDates : null
            });

            if (error) throw error;

            toast?.success('Dates planifiées mises à jour.');
            refetch();
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour des dates: ' + (error.message || 'Erreur inconnue'));
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement de l'intervention...</div>
            </div>
        );
    }

    return (
        <InterventionDetailView
            intervention={intervention} // Pass single intervention if view supports it
            interventions={intervention ? [intervention] : []} // Pass array for compatibility
            profile={profile}
            onSave={handleUpdateInterventionReport}
            onSaveSilent={handleUpdateInterventionReportSilent}
            onAddBriefingDocuments={handleAddBriefingDocuments}
            onUpdateScheduledDates={handleUpdateScheduledDates}
            isAdmin={profile?.is_admin}
            refreshData={refetch}
            dataVersion={Date.now()} // Force update if needed
        />
    );
};

export default InterventionDetailViewContainer;
