import React, { useCallback } from 'react';
import { useVault } from '../hooks/useVault';
import { useUsers } from '../hooks/useUsers';
import { storageService } from '../lib/supabase';
import { validateFileSize } from '../utils/validators';
import AdminVaultView from './AdminVaultView';
import logger from '../utils/logger';

const AdminVaultViewContainer = ({ showToast, showConfirmationModal }) => {
    const { vaultDocuments, createVaultDocument, deleteVaultDocument } = useVault();
    const { users } = useUsers();

    const handleSendDocument = useCallback(async ({ file, userId, name, fileSize = null, description = '', tags = [] }) => {
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
                user_id: userId,
                file_name: name,
                file_url: publicURL,
                // Les champs suivants sont optionnels selon la structure de la table
                // file_size: fileSize || file.size,
                // description,
                // tags
            });
            logger.log('🚀 AdminVaultViewContainer: DB entry created');

            showToast('Document envoyé avec succès !');
        } catch (error) {
            logger.error("Erreur lors de l'envoi du document:", error);
            showToast(`Erreur d'envoi: ${error.message}`, 'error');
            throw error;
        }
    }, [showToast, createVaultDocument]);

    const handleDeleteDocument = useCallback((document) => {
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
    }, [showConfirmationModal, deleteVaultDocument, showToast]);

    // Import en masse depuis un fichier JSON exporté
    const handleBulkImport = useCallback(async (documents) => {
        if (!documents || !Array.isArray(documents)) {
            showToast('Format d\'import invalide', 'error');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const doc of documents) {
            try {
                // Vérifier que l'utilisateur existe
                const userExists = users.find(u => u.id === doc.user_id);
                if (!userExists) {
                    logger.warn(`Import: Utilisateur ${doc.user_id} non trouvé, document ignoré`);
                    errorCount++;
                    continue;
                }

                // Vérifier que le document a les champs requis
                if (!doc.file_name || !doc.file_url) {
                    logger.warn('Import: Document sans nom ou URL, ignoré');
                    errorCount++;
                    continue;
                }

                // Créer le document dans la base
                await createVaultDocument({
                    user_id: doc.user_id,
                    file_name: doc.file_name,
                    file_url: doc.file_url,
                    // Les champs optionnels si la table les supporte
                    // file_size: doc.file_size,
                    // description: doc.description,
                    // tags: doc.tags,
                });

                successCount++;
            } catch (error) {
                logger.error('Erreur import document:', error);
                errorCount++;
            }
        }

        if (successCount > 0) {
            showToast(`${successCount} document(s) importé(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`, 'success');
        } else if (errorCount > 0) {
            showToast(`Aucun document importé, ${errorCount} erreur(s)`, 'error');
        }

        logger.log('Import terminé:', { successCount, errorCount });
    }, [users, createVaultDocument, showToast]);

    return (
        <AdminVaultView
            users={users}
            vaultDocuments={vaultDocuments}
            onSendDocument={handleSendDocument}
            onDeleteDocument={handleDeleteDocument}
            onBulkImport={handleBulkImport}
        />
    );
};

export default AdminVaultViewContainer;
