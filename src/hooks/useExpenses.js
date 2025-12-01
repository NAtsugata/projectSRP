import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import expenseService from '../services/expenseService';
import { useAuthStore } from '../store/authStore';

/**
 * Hook pour gérer les notes de frais avec React Query
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {object} - Notes de frais, loading, error, et fonctions de mutation
 */
export function useExpenses(userId = null) {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    // Query pour récupérer les notes de frais
    const {
        data: expenses = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['expenses', userId],
        queryFn: async () => {
            if (userId) {
                const { data } = await expenseService.getUserExpenses(userId, 1, 1000);
                return data || [];
            }
            const { data } = await expenseService.getAllExpenses(1, 1000);
            return data || [];
        },
        enabled: true,
    });

    // Mutation pour créer une note de frais
    const createMutation = useMutation({
        mutationFn: (newExpense) => expenseService.createExpense(newExpense),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
        },
    });

    // Mutation pour mettre à jour une note de frais
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => expenseService.updateExpense(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
        },
    });

    // Mutation pour supprimer une note de frais
    const deleteMutation = useMutation({
        mutationFn: (id) => expenseService.deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
        },
    });

    // Mutation pour approuver une note de frais
    const approveMutation = useMutation({
        mutationFn: ({ id, comment }) => expenseService.approveExpense(id, user?.id, comment),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
        },
    });

    // Mutation pour rejeter une note de frais
    const rejectMutation = useMutation({
        mutationFn: ({ id, comment }) => expenseService.rejectExpense(id, user?.id, comment),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
        },
    });

    // Mutation pour marquer comme payée
    const markAsPaidMutation = useMutation({
        mutationFn: (id) => expenseService.markAsPaid(id, user?.id),
        onSuccess: () => {
            queryClient.invalidateQueries(['expenses']);
        },
    });

    return {
        // Données
        expenses,
        isLoading,
        error,

        // Fonctions
        refetch,
        createExpense: createMutation.mutateAsync,
        updateExpense: updateMutation.mutateAsync,
        deleteExpense: deleteMutation.mutateAsync,
        approveExpense: approveMutation.mutateAsync,
        rejectExpense: rejectMutation.mutateAsync,
        markAsPaid: markAsPaidMutation.mutateAsync,

        // États des mutations
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isApproving: approveMutation.isPending,
        isRejecting: rejectMutation.isPending,
        isMarkingAsPaid: markAsPaidMutation.isPending,
    };
}
