import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import expenseService from '../services/expenseService';

/**
 * Hook pour gérer les notes de frais avec React Query
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {object} - Notes de frais, loading, error, et fonctions de mutation
 */
export function useExpenses(userId = null) {
    const queryClient = useQueryClient();

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
                return await expenseService.getExpensesByUser(userId);
            }
            return await expenseService.getAllExpenses();
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

    // Mutation pour approuver/rejeter une note de frais
    const approveMutation = useMutation({
        mutationFn: ({ id, status }) => expenseService.updateExpenseStatus(id, status),
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
        createExpense: createMutation.mutate,
        updateExpense: updateMutation.mutate,
        deleteExpense: deleteMutation.mutate,
        approveExpense: approveMutation.mutate,

        // États des mutations
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isApproving: approveMutation.isPending,
    };
}
