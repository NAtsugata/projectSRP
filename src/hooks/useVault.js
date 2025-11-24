import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vaultService } from '../lib/supabase';

/**
 * Hook pour gérer le coffre-fort avec React Query
 * @param {string} userId - ID de l'utilisateur (optionnel, pour filtrer)
 * @returns {object} - Documents du coffre, loading, error, et fonctions de mutation
 */
export function useVault(userId = null) {
    const queryClient = useQueryClient();

    // Query pour récupérer les documents du coffre
    const {
        data: vaultDocuments = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['vault', userId],
        queryFn: async () => {
            const result = await vaultService.getVaultDocuments();
            if (result.error) throw result.error;

            let documents = result.data || [];

            // Filtrer par userId si fourni
            if (userId) {
                documents = documents.filter(doc => doc.user_id === userId);
            }

            return documents;
        },
    });

    // Mutation pour envoyer un document
    // Mutation pour créer un document
    const createMutation = useMutation({
        mutationFn: (data) => vaultService.createVaultDocument(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['vault']);
        },
    });

    // Mutation pour supprimer un document
    const deleteMutation = useMutation({
        mutationFn: (id) => vaultService.deleteVaultDocument(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['vault']);
        },
    });

    return {
        // Données
        vaultDocuments,
        isLoading,
        error,

        // Fonctions
        refetch,
        createVaultDocument: createMutation.mutateAsync, // Use mutateAsync for await in container
        deleteVaultDocument: deleteMutation.mutate,

        // États des mutations
        isCreating: createMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
