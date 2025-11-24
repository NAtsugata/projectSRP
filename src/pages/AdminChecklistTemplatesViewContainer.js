import React from 'react';
import { useChecklists } from '../hooks/useChecklists';
import AdminChecklistTemplatesView from './AdminChecklistTemplatesView';

const AdminChecklistTemplatesViewContainer = ({ showToast }) => {
    const { templates, createTemplate, updateTemplate, deleteTemplate, isLoading } = useChecklists();

    const handleCreateTemplate = (templateData) => {
        createTemplate(templateData, {
            onSuccess: () => showToast('Template créé !', 'success'),
            onError: (error) => showToast(`Erreur: ${error.message}`, 'error')
        });
    };

    const handleUpdateTemplate = (templateData) => {
        updateTemplate(templateData, {
            onSuccess: () => showToast('Template mis à jour !', 'success'),
            onError: (error) => showToast(`Erreur: ${error.message}`, 'error')
        });
    };

    const handleDeleteTemplate = (templateId) => {
        deleteTemplate(templateId, {
            onSuccess: () => showToast('Template supprimé', 'success'),
            onError: (error) => showToast(`Erreur: ${error.message}`, 'error')
        });
    };

    if (isLoading) {
        return <div className="loading-spinner"></div>;
    }

    return (
        <AdminChecklistTemplatesView
            templates={templates}
            onCreateTemplate={handleCreateTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
        />
    );
};

export default AdminChecklistTemplatesViewContainer;
