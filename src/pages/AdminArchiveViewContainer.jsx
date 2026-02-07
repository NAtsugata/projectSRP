import React from 'react';
import { useInterventions } from '../hooks/useInterventions';
import AdminArchiveView from './AdminArchiveView';

const AdminArchiveViewContainer = ({ showToast, showConfirmationModal }) => {
    const {
        interventions: archivedInterventions,
        isLoading,
        deleteIntervention,
        updateIntervention
    } = useInterventions(null, true);

    const handleDelete = (id) => {
        deleteIntervention(id, {
            onSuccess: () => showToast("Archive supprimée avec succès."),
            onError: () => showToast("Erreur lors de la suppression.", "error")
        });
    };

    const handleRestore = (id) => {
        updateIntervention({
            id,
            is_archived: false,
            archived_at: null
        }, {
            onSuccess: () => showToast("Intervention restaurée avec succès."),
            onError: () => showToast("Erreur lors de la restauration.", "error")
        });
    };

    return (
        <AdminArchiveView
            archivedInterventions={archivedInterventions}
            isLoading={isLoading}
            onDelete={handleDelete}
            onRestore={handleRestore}
            showToast={showToast}
            showConfirmationModal={showConfirmationModal}
        />
    );
};

export default AdminArchiveViewContainer;
