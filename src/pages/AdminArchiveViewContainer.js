import React from 'react';
import { useInterventions } from '../hooks/useInterventions';
import AdminArchiveView from './AdminArchiveView';

const AdminArchiveViewContainer = ({ showToast, showConfirmationModal }) => {
    const { interventions: archivedInterventions, isLoading, deleteIntervention } = useInterventions(null, true);

    const handleDelete = (id) => {
        deleteIntervention(id, {
            onSuccess: () => showToast("Archive supprimée avec succès."),
            onError: () => showToast("Erreur lors de la suppression de l'archive.", "error")
        });
    };

    return (
        <AdminArchiveView
            archivedInterventions={archivedInterventions}
            isLoading={isLoading}
            onDelete={handleDelete}
            showToast={showToast}
            showConfirmationModal={showConfirmationModal}
        />
    );
};

export default AdminArchiveViewContainer;
