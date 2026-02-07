import React from 'react';
import { useChecklists } from '../hooks/useChecklists';
import AdminChecklistTemplatesView from './AdminChecklistTemplatesView';
import checklistService from '../services/checklistService';

const AdminChecklistTemplatesViewContainer = ({ showToast }) => {
    const { templates, createTemplate, updateTemplate, deleteTemplate, isLoading, refetchTemplates } = useChecklists();

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

    const handleImportPredefined = async () => {
        try {
            const result = await checklistService.importPredefinedTemplates();
            if (result.error) {
                showToast(`Erreur: ${result.error.message}`, 'error');
                return null;
            }
            // Rafraîchir la liste des templates
            if (refetchTemplates) {
                refetchTemplates();
            }
            showToast(`${result.imported} templates importés !`, 'success');
            return result;
        } catch (error) {
            showToast(`Erreur: ${error.message}`, 'error');
            return null;
        }
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
            onImportPredefined={handleImportPredefined}
        />
    );
};

export default AdminChecklistTemplatesViewContainer;
