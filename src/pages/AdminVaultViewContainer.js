import React from 'react';
import { useVault } from '../hooks/useVault';
import { useUsers } from '../hooks/useUsers';
import { storageService } from '../lib/supabase';
import { validateFileSize } from '../utils/validators';
import AdminVaultView from './AdminVaultView';
import logger from '../utils/logger';

const AdminVaultViewContainer = ({ showToast, showConfirmationModal }) => {
    const { vaultDocuments, createVaultDocument, deleteVaultDocument } = useVault();
    const { users } = useUsers();

    const handleSendDocument = async ({ file, userId, name, fileSize = null, description = '', tags = [] }) => {
        logger.log('🚀 AdminVaultViewContainer: handleSendDocument started', { userId, name });
        try {
            // Validation de la taille du fichier
            const sizeValidation = validateFileSize(file.size, 20); // 20MB max
            if (!sizeValidation.isValid) {
                showToast(sizeValidation.message, 'error');
                return;
            }

            logger.log('🚀 AdminVaultViewContainer: Calling uploadVaultFile...');
            const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
            logger.log('🚀 AdminVaultViewContainer: uploadVaultFile result:', { publicURL, filePath, uploadError });

            if (uploadError) throw uploadError;

            logger.log('🚀 AdminVaultViewContainer: Creating DB entry...');
            await createVaultDocument({
                user_id: userId, // Note: DB column is user_id
                file_name: name, // Note: DB column is file_name
                file_url: publicURL, // Note: DB column is file_url
                // path: filePath, // Colonne inexistante en BDD
                // file_size: fileSize || file.size, // Colonne inexistante en BDD
                // description, // Colonne inexistante en BDD
                // tags // Colonne inexistante en BDD
            });
            logger.log('🚀 AdminVaultViewContainer: DB entry created');

            showToast('Document envoyé avec succès !');
        } catch (error) {
            console.error("❌ Erreur lors de l'envoi du document:", error);
            showToast(`Erreur d'envoi: ${error.message}`, 'error');
            throw error;
        }
    };

    const handleDeleteDocument = (document) => {
        showConfirmationModal({
            title: 'Supprimer le document ?',
            message: `Êtes-vous sûr de vouloir supprimer "${document.file_name}" ? Cette action est irréversible.`,
            onConfirm: () => {
                deleteVaultDocument(document.id, {
                    onSuccess: () => showToast('Le document a été supprimé.', 'success'),
                    onError: (error) => showToast(`Erreur: ${error.message}`, 'error')
                });
            }
        });
    };

    return (
        <AdminVaultView
            users={users}
            vaultDocuments={vaultDocuments}
            onSendDocument={handleSendDocument}
            onDeleteDocument={handleDeleteDocument}
        />
    );
};

export default AdminVaultViewContainer;
