// src/pages/InterventionDetailViewContainer.js
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { interventionService } from '../services/interventionService';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../contexts/ToastContext';
import { useUsers } from '../hooks/useUsers';
import { buildSanitizedReport } from '../utils/reportHelpers';
import InterventionDetailView from './InterventionDetailView';
import logger from '../utils/logger';

const InterventionDetailViewContainer = () => {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const isAdmin = Boolean(profile?.is_admin || profile?.is_super_admin);
    const toast = useToast();
    const queryClient = useQueryClient();
    const { users } = useUsers();
    const [isUpdatingTeam, setIsUpdatingTeam] = React.useState(false);

    const { data: organization } = useQuery({
        queryKey: ['organization', profile?.organization_id],
        queryFn: async () => {
            if (!profile?.organization_id) return null;
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', profile.organization_id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.organization_id,
    });

    const { data: intervention, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['intervention', interventionId],
        queryFn: async () => {
            logger.log('Fetching intervention:', interventionId);
            const { data, error } = await supabase
                .from('interventions')
                .select(`
                    *,
                    intervention_assignments (
                        user_id,
                        profiles (id, full_name)
                    )
                `)
                .eq('id', interventionId)
                .single();

            if (error) {
                logger.error('Error fetching intervention:', error);
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
            queryClient.invalidateQueries({ queryKey: ['intervention', id] });
        }
        return { success: !error, error };
    };

    // 💾 Sauvegarde + clôture
    const handleUpdateInterventionReport = async (id, report) => {
        try {
            // L'utilisateur a cliqué "Sauvegarder et Clôturer" → toujours Terminée
            const sanitizedReport = buildSanitizedReport(report);
            if (!sanitizedReport.departureTime) {
                sanitizedReport.departureTime = new Date().toISOString();
            }

            const { error } = await interventionService.updateIntervention(id, {
                report: sanitizedReport,
                status: 'Terminée'
            });

            if (error) throw error;

            toast?.success('Rapport sauvegardé et intervention clôturée.');
            queryClient.invalidateQueries({ queryKey: ['intervention', id] });
            queryClient.invalidateQueries({ queryKey: ['interventions'] }); // Refresh list too
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

    const handleUpdateAdminNote = async (id, note) => {
        if (!isAdmin || !profile?.organization_id) throw new Error('Accès administrateur requis.');
        const queryKey = ['intervention', String(id)];
        await queryClient.cancelQueries({ queryKey });
        const { data, error } = await supabase.from('interventions')
            .update({ admin_note: note })
            .eq('id', id)
            .eq('organization_id', profile.organization_id)
            .select('admin_note')
            .maybeSingle();

        if (error || !data) throw new Error('Vérifiez vos droits ou la connexion, puis réessayez.');
        queryClient.setQueryData(queryKey, previous => previous && { ...previous, admin_note: data.admin_note });
        queryClient.invalidateQueries({ queryKey: ['interventions'] });
        toast?.success('Note enregistrée.');
        return data.admin_note;
    };

    const handleUpdateTeam = async (id, userIds, dailyAssignments) => {
        setIsUpdatingTeam(true);
        try {
            // Mettre à jour les assignations globales
            const assignResult = await interventionService.updateAssignments(id, userIds);
            if (assignResult.error) throw assignResult.error;

            // Si des assignations journalières sont fournies, les sauvegarder aussi
            if (dailyAssignments) {
                const dailyResult = await interventionService.updateDailyAssignments(id, dailyAssignments);
                if (dailyResult.error) throw dailyResult.error;
            }

            toast?.success('Équipe mise à jour !');
            refetch();
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour de l\'équipe: ' + (error.message || 'Erreur inconnue'));
            throw error;
        } finally {
            setIsUpdatingTeam(false);
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
            intervention={intervention}
            interventions={intervention ? [intervention] : []}
            profile={profile}
            organization={organization}
            onSave={handleUpdateInterventionReport}
            onSaveSilent={handleUpdateInterventionReportSilent}
            onAddBriefingDocuments={handleAddBriefingDocuments}
            onUpdateScheduledDates={handleUpdateScheduledDates}
            onUpdateAdminNote={handleUpdateAdminNote}
            onUpdateTeam={handleUpdateTeam}
            isUpdatingTeam={isUpdatingTeam}
            users={users}
            isAdmin={isAdmin}
            refreshData={refetch}
            dataVersion={Date.now()}
        />
    );
};

export default InterventionDetailViewContainer;
