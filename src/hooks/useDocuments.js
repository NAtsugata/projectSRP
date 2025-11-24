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
            if (userId) {
                return await scannedDocumentsService.getUserDocuments(userId);
            }
            return await scannedDocumentsService.getAllDocuments();
        },
        enabled: !!userId,
    });

    // Mutation pour sauvegarder des documents
    const saveMutation = useMutation({
        mutationFn: (documents) => scannedDocumentsService.saveDocuments(documents),
        onSuccess: () => {
            queryClient.invalidateQueries(['scannedDocuments']);
        },
    });

    // Mutation pour supprimer un document
    const deleteMutation = useMutation({
        mutationFn: (id) => scannedDocumentsService.deleteDocument(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['scannedDocuments']);
        },
    });

    // Mutation pour mettre à jour un document
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => scannedDocumentsService.updateDocument(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['scannedDocuments']);
        },
    });

    return {
        // Données
        scannedDocuments,
        isLoading,
        error,

        // Fonctions
        refetch,
        saveDocuments: saveMutation.mutate,
        deleteDocument: deleteMutation.mutate,
        updateDocument: updateMutation.mutate,

        // États des mutations
        isSaving: saveMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isUpdating: updateMutation.isPending,
    };
}
