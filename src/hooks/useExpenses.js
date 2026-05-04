import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import expenseService from '../services/expenseService';
import { useAuthStore } from '../store/authStore';
import { cacheExpenses, getCachedExpenses } from '../utils/offlineStorage';
import { queueOperation, SYNC_OPERATION_TYPES } from '../utils/syncService';
import logger from '../utils/logger';
import { getConnectionState } from '../utils/connectionMonitor';

/**
 * Hook pour gérer les notes de frais avec React Query
 * Supporte le mode hors ligne avec cache IndexedDB
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {object} - Notes de frais, loading, error, et fonctions de mutation
 */
export function useExpenses(userId = null, filters = {}, limit = 1000) {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    // Query pour récupérer les notes de frais
    const {
        data: expenses = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['expenses', userId, filters, limit],
        queryFn: async () => {
            // Offline confirmé par les deux sources — aller directement au cache
            if (!navigator.onLine && !getConnectionState()) {
                const cached = await getCachedExpenses();
                if (cached && cached.length > 0) {
                    return userId ? cached.filter(e => e.user_id === userId) : cached;
                }
                return [];
            }

            // Tenter Supabase, avec fallback cache si ça échoue
            try {
                let data;
                if (userId) {
                    const result = await expenseService.getUserExpenses(userId, 1, limit, filters);
                    if (result.error) throw result.error;
                    data = result.data || [];
                } else {
                    const result = await expenseService.getAllExpenses(1, limit, filters);
                    if (result.error) throw result.error;
                    data = result.data || [];
                }

                if (data.length > 0) {
                    cacheExpenses(data).catch(e => logger.warn('[useExpenses] Cache failed:', e));
                }
                return data;
            } catch (err) {
                // Supabase inaccessible — fallback sur le cache plutôt que spinner infini
                const cached = await getCachedExpenses();
                if (cached && cached.length > 0) {
                    logger.warn('[useExpenses] Supabase inaccessible, données en cache utilisées');
                    return userId ? cached.filter(e => e.user_id === userId) : cached;
                }
                throw err;
            }
        },
        staleTime: 3 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
        networkMode: 'always',
        retry: 1,
        retryDelay: 2000,
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: false,
    });

    // Mutation pour créer une note de frais (avec support offline)
    const createMutation = useMutation({
        mutationFn: async (newExpense) => {
            if (!navigator.onLine && !getConnectionState()) {
                // Mode offline : queue l'opération
                logger.log('[useExpenses] Offline - creation en queue');
                const tempId = `temp-${Date.now()}`;
                const tempExpense = { ...newExpense, id: tempId, _offline: true };
                await queueOperation(SYNC_OPERATION_TYPES.CREATE_EXPENSE, newExpense);
                return { data: tempExpense };
            }
            const result = await expenseService.createExpense(newExpense);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    // Mutation pour mettre à jour une note de frais (avec support offline)
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            if (!navigator.onLine && !getConnectionState()) {
                logger.log('[useExpenses] Offline - mise a jour en queue');
                await queueOperation(SYNC_OPERATION_TYPES.UPDATE_EXPENSE, { id, updates });
                return { data: { id, ...updates } };
            }
            return expenseService.updateExpense(id, updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    // Mutation pour supprimer une note de frais (avec support offline)
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            if (!navigator.onLine && !getConnectionState()) {
                logger.log('[useExpenses] Offline - suppression en queue');
                await queueOperation(SYNC_OPERATION_TYPES.DELETE_EXPENSE, { id });
                return { data: null };
            }
            // Admin (userId=null) → deleteExpenseAdmin ; employé → deleteExpense(id, userId)
            const result = userId
                ? await expenseService.deleteExpense(id, userId)
                : await expenseService.deleteExpenseAdmin(id);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
        },
    });

    // Mutation pour approuver une note de frais (optimisé - sans refetch)
    const approveMutation = useMutation({
        mutationFn: ({ id, comment }) => expenseService.approveExpense(id, user?.id, comment),
        onSuccess: (response) => {
            if (response.data) {
                // Mettre à jour TOUTES les queries expenses en cache (sans refetch)
                queryClient.setQueriesData({ queryKey: ['expenses'] }, (oldExpenses) => {
                    if (!oldExpenses || !Array.isArray(oldExpenses)) return oldExpenses;
                    return oldExpenses.map(exp =>
                        exp.id === response.data.id ? response.data : exp
                    );
                });
            }
        },
    });

    // Mutation pour rejeter une note de frais (optimisé - sans refetch)
    const rejectMutation = useMutation({
        mutationFn: ({ id, comment }) => expenseService.rejectExpense(id, user?.id, comment),
        onSuccess: (response) => {
            if (response.data) {
                // Mettre à jour TOUTES les queries expenses en cache (sans refetch)
                queryClient.setQueriesData({ queryKey: ['expenses'] }, (oldExpenses) => {
                    if (!oldExpenses || !Array.isArray(oldExpenses)) return oldExpenses;
                    return oldExpenses.map(exp =>
                        exp.id === response.data.id ? response.data : exp
                    );
                });
            }
        },
    });

    // Mutation pour marquer comme payée (optimisé - sans refetch)
    const markAsPaidMutation = useMutation({
        mutationFn: (id) => expenseService.markAsPaid(id, user?.id),
        onSuccess: (response) => {
            if (response.data) {
                // Mettre à jour TOUTES les queries expenses en cache (sans refetch)
                queryClient.setQueriesData({ queryKey: ['expenses'] }, (oldExpenses) => {
                    if (!oldExpenses || !Array.isArray(oldExpenses)) return oldExpenses;
                    return oldExpenses.map(exp =>
                        exp.id === response.data.id ? response.data : exp
                    );
                });
            }
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
