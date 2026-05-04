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
            const { data, error } = await leaveService.getLeaveRequests(userId);
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - congés changent peu fréquemment
        gcTime: 15 * 60 * 1000,   // 15 minutes en cache
    });

    // Mutation pour créer une demande de congé
    const createMutation = useMutation({
        mutationFn: async (newLeaveRequest) => {
            const result = await leaveService.createLeaveRequest(newLeaveRequest);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
        },
    });

    // Mutation pour mettre à jour une demande de congé
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            const result = await leaveService.updateLeaveRequest(id, updates);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
        },
    });

    // Mutation pour supprimer une demande de congé
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const result = await leaveService.deleteLeaveRequest(id);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
        },
    });

    return {
        // Données
        leaveRequests,
        isLoading,
        error,

        // Fonctions
        refetch,
        createLeaveRequest: createMutation.mutateAsync,
        updateLeaveRequest: updateMutation.mutateAsync,
        deleteLeaveRequest: deleteMutation.mutateAsync,

        // États des mutations
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
