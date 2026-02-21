// src/pages/AdminPlanningViewContainer.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterventions } from '../hooks/useInterventions';
import { useUsers } from '../hooks/useUsers';
import { useChecklists } from '../hooks/useChecklists';
import { useToast } from '../contexts/ToastContext';
import { clientService } from '../services/clientService';
import AdminPlanningView from './AdminPlanningView';

const AdminPlanningViewContainer = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { interventions, isLoading, createIntervention, updateIntervention, deleteIntervention, updateAssignments, updateDailyAssignments, isUpdatingAssignments } = useInterventions();
    const { users } = useUsers();
    const { templates, assignChecklist } = useChecklists();

    const handleCreateIntervention = async (formData, assignedUsers, files) => {
        try {
            // Auto-enregistrer le client dans la base clients
            // (ne bloque pas la creation d'intervention si ca echoue)
            let clientId = null;
            if (formData?.client) {
                const { data: clientData } = await clientService.getOrCreateClientFromIntervention(formData);
                if (clientData?.id) {
                    clientId = clientData.id;
                }
            }

            const interventionData = clientId
                ? { ...formData, client_id: clientId }
                : formData;

            // Gerer le cas ou on recoit plusieurs arguments (depuis AdminPlanningView)
            // ou un seul objet (legacy)
            if (assignedUsers || files) {
                await createIntervention({
                    interventionData,
                    assignedUserIds: assignedUsers,
                    briefingFiles: files
                });
            } else {
                await createIntervention(interventionData);
            }
            toast?.success('Intervention créée avec succès');
            return true; // Retourner true pour fermer le formulaire
        } catch (error) {
            toast?.error('Erreur lors de la création');
            throw error;
        }
    };

    const handleUpdateIntervention = async (id, updates) => {
        try {
            await updateIntervention({ id, updates });
            toast?.success('Intervention mise à jour');
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour');
            throw error;
        }
    };

    const handleDeleteIntervention = async (id) => {
        try {
            await deleteIntervention(id);
            toast?.success('Intervention supprimée');
        } catch (error) {
            toast?.error('Erreur lors de la suppression');
            throw error;
        }
    };

    const handleAssignChecklist = async (interventionId, templateId) => {
        const intervention = interventions.find(i => i.id === interventionId);
        const assignedUserIds = intervention?.intervention_assignments
            ?.map(assignment => assignment.user_id)
            .filter(Boolean) || [];

        if (!intervention || assignedUserIds.length === 0) {
            toast?.error('Aucun employé assigné à cette intervention');
            return;
        }

        try {
            await assignChecklist({ interventionId, templateId, assignedUserIds });
            toast?.success('Checklist assignée !');
        } catch (error) {
            toast?.error(`Erreur: ${error.message}`);
        }
    };

    const handleUpdateTeam = async (interventionId, userIds, dailyAssignments) => {
        try {
            await updateAssignments({ interventionId, userIds });
            // Si des assignations journalières sont fournies, les sauvegarder aussi
            if (dailyAssignments) {
                await updateDailyAssignments({ interventionId, dailyAssignments });
            }
            toast?.success('Équipe mise à jour !');
        } catch (error) {
            toast?.error('Erreur lors de la mise à jour de l\'équipe');
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement du planning...</div>
            </div>
        );
    }

    return (
        <AdminPlanningView
            interventions={interventions}
            users={users}
            checklistTemplates={templates}
            onAddIntervention={handleCreateIntervention}
            onUpdateIntervention={handleUpdateIntervention}
            onDelete={handleDeleteIntervention}
            onArchive={(id) => handleUpdateIntervention(id, { is_archived: true })}
            onAssignChecklist={handleAssignChecklist}
            onUpdateTeam={handleUpdateTeam}
            isUpdatingTeam={isUpdatingAssignments}
            onView={(itv) => navigate(`/planning/${itv.id}`)}
        />
    );
};

export default AdminPlanningViewContainer;
