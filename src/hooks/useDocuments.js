import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import scannedDocumentsService from '../services/scannedDocumentsService';

/**
 * Hook pour gérer les documents scannés avec React Query
 * @param {string} userId - ID de l'utilisateur
 * @returns {object} - Documents, loading, error, et fonctions de mutation
 */
export function useDocuments(userId) {
    const queryClient = useQueryClient();

    // Query pour récupérer les documents scannés
    const {
        data: scannedDocuments = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['scannedDocuments', userId],
        queryFn: async () => {
            const result = userId
                ? await scannedDocumentsService.getUserDocuments(userId)
                : await scannedDocumentsService.getAllDocuments();

            if (result.error) throw result.error;
            return result.data;
        },
    });

    // Mutation pour sauvegarder des documents scannés
    const saveMutation = useMutation({
        mutationFn: ({ documents, metadata }) => scannedDocumentsService.saveDocuments(documents, metadata),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scannedDocuments'] });
        },
        onError: (error) => {
            console.error('Erreur sauvegarde documents:', error);
        },
    });

    // Mutation pour supprimer un document
    const deleteMutation = useMutation({
        mutationFn: (id) => scannedDocumentsService.deleteDocument(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scannedDocuments'] });
        },
    });

    // Mutation pour mettre à jour un document
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => scannedDocumentsService.updateDocument(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['scannedDocuments'] });
        },
    });

    // Wrapper pour saveDocuments qui accepte (documents, metadata) comme arguments séparés
    const saveDocuments = (documents, metadata) => {
        return saveMutation.mutateAsync({ documents, metadata });
    };

    return {
        // Données
        scannedDocuments,
        isLoading,
        error,

        // Fonctions
        refetch,
        saveDocuments,
        deleteDocument: deleteMutation.mutate,
        updateDocument: updateMutation.mutate,

        // États des mutations
        isSaving: saveMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isUpdating: updateMutation.isPending,
    };
}
