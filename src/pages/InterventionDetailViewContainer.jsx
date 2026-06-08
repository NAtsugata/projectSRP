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
        try {
            const { error } = await interventionService.updateIntervention(id, {
                admin_note: note
            });

            if (error) throw error;

            // Silent update or toast? Toast is better for explicit save
            // But if it's auto-save (onBlur), maybe silent?
            // Let's assume explicit save or onBlur with toast
            toast?.success('Note admin mise à jour.');
            refetch();
        } catch (error) {
            toast?.error('Erreur maj note: ' + error.message);
        }
    };

    const handleUpdateIntervention = async (id, updates) => {
        try {
            const { error } = await interventionService.updateIntervention(id, updates);
            if (error) throw error;
            toast?.success('Intervention modifiée.');
            refetch();
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        } catch (err) {
            toast?.error('Erreur : ' + (err.message || 'impossible de modifier.'));
            throw err;
        }
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
            onUpdateIntervention={handleUpdateIntervention}
            onUpdateTeam={handleUpdateTeam}
            isUpdatingTeam={isUpdatingTeam}
            users={users}
            isAdmin={profile?.is_admin}
            refreshData={refetch}
            dataVersion={intervention?.updated_at}
        />
    );
};

export default InterventionDetailViewContainer;
