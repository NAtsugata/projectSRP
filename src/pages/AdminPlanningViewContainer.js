// src/pages/AdminPlanningViewContainer.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterventions } from '../hooks/useInterventions';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import AdminPlanningView from './AdminPlanningView';

const AdminPlanningViewContainer = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const { interventions, isLoading, createIntervention, updateIntervention, deleteIntervention } = useInterventions();
    const { users } = useUsers();

    const handleCreateIntervention = async (data) => {
        try {
            await createIntervention(data);
            toast?.success('Intervention créée avec succès');
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
            onCreateIntervention={handleCreateIntervention}
            onUpdateIntervention={handleUpdateIntervention}
            onDeleteIntervention={handleDeleteIntervention}
            onViewIntervention={(itv) => navigate(`/planning/${itv.id}`)}
        />
    );
};

export default AdminPlanningViewContainer;
