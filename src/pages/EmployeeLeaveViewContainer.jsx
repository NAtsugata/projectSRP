// src/pages/EmployeeLeaveViewContainer.js
// Wrapper qui utilise les hooks React Query et passe les données à EmployeeLeaveView
import React from 'react';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../contexts/ToastContext';
import EmployeeLeaveView from './EmployeeLeaveView';

/**
 * Container pour EmployeeLeaveView qui gère la logique de données avec React Query
 */
const EmployeeLeaveViewContainer = () => {
    const { profile } = useAuthStore();
    const toast = useToast();

    // Récupérer les demandes de congés avec le hook
    const {
        leaveRequests,
        isLoading,
        error,
        createLeaveRequest,
        // isCreating unused - available for future loading state UI
    } = useLeaveRequests(profile?.id);

    // Handler pour soumettre une demande de congé
    const handleSubmitRequest = async (requestData) => {
        try {
            await createLeaveRequest(requestData);
            toast?.success('Demande de congé créée avec succès');
            return true;
        } catch (error) {
            console.error('Erreur création demande de congé:', error);
            toast?.error('Erreur lors de la création de la demande');
            return false;
        }
    };

    // Fonction showToast pour compatibilité
    const showToast = (message, type = 'success') => {
        if (type === 'success') {
            toast?.success(message);
        } else if (type === 'error') {
            toast?.error(message);
        } else {
            toast?.info(message);
        }
    };

    // Afficher le loading si les données sont en cours de chargement
    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div>Chargement des demandes de congés...</div>
            </div>
        );
    }

    // Afficher l'erreur si présente
    if (error) {
        return (
            <div style={{ padding: '2rem', color: '#ef4444' }}>
                <h3>Erreur de chargement</h3>
                <p>{error.message || 'Impossible de charger les demandes de congés'}</p>
            </div>
        );
    }

    return (
        <EmployeeLeaveView
            leaveRequests={leaveRequests}
            onSubmitRequest={handleSubmitRequest}
            userName={profile?.full_name}
            userId={profile?.id}
            showToast={showToast}
        />
    );
};

export default EmployeeLeaveViewContainer;
