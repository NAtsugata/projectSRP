import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveService } from '../lib/supabase';

/**
 * Hook pour gérer les demandes de congés avec React Query
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {object} - Demandes de congés, loading, error, et fonctions de mutation
 */
export function useLeaveRequests(userId = null) {
    const queryClient = useQueryClient();

    // Query pour récupérer les demandes de congés
    const {
        data: leaveRequests = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['leaveRequests', userId],
        queryFn: async () => {
            return await leaveService.getLeaveRequests(userId);
        },
        enabled: true,
    });

    // Mutation pour créer une demande de congé
    const createMutation = useMutation({
        mutationFn: (newLeaveRequest) => leaveService.createLeaveRequest(newLeaveRequest),
        onSuccess: () => {
            queryClient.invalidateQueries(['leaveRequests']);
        },
    });

    // Mutation pour mettre à jour une demande de congé
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => leaveService.updateLeaveRequest(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['leaveRequests']);
        },
    });

    // Mutation pour supprimer une demande de congé
    const deleteMutation = useMutation({
        mutationFn: (id) => leaveService.deleteLeaveRequest(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['leaveRequests']);
        },
    });

    return {
        // Données
        leaveRequests,
        isLoading,
        error,

        // Fonctions
        refetch,
        createLeaveRequest: createMutation.mutate,
        updateLeaveRequest: updateMutation.mutate,
        deleteLeaveRequest: deleteMutation.mutate,

        // États des mutations
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
