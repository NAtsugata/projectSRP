import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionService } from '../lib/supabase';

/**
 * Hook pour gérer les interventions avec React Query
 * @param {string} userId - ID de l'utilisateur (optionnel, pour filtrer)
 * @returns {object} - Interventions, loading, error, et fonctions de mutation
 */
export function useInterventions(userId = null, isArchived = false) {
    const queryClient = useQueryClient();

    // Query pour récupérer les interventions
    const {
        data: interventions = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['interventions', userId, isArchived],
        queryFn: async () => {
            const { data, error } = await interventionService.getInterventions(userId, isArchived);

            if (error) throw error;
            return data || [];
        },
        staleTime: 2 * 60 * 1000, // 2 minutes - interventions changent modérément
        gcTime: 10 * 60 * 1000,   // 10 minutes en cache
    });

    // Mutation pour créer une intervention
    const createMutation = useMutation({
        mutationFn: async (params) => {
            let result;
            // Support both old style (just data) and new style (object with fields)
            if (params.interventionData || params.assignedUserIds) {
                result = await interventionService.createIntervention(
                    params.interventionData || params,
                    params.assignedUserIds,
                    params.briefingFiles
                );
            } else {
                result = await interventionService.createIntervention(params);
            }

            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            // Invalider le cache pour recharger les données
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        },
    });

    // Mutation pour mettre à jour une intervention
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            const result = await interventionService.updateIntervention(id, updates);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        },
    });

    // Mutation pour supprimer une intervention
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const result = await interventionService.deleteIntervention(id);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        },
    });

    // Mutation pour mettre à jour les assignations d'une intervention
    const updateAssignmentsMutation = useMutation({
        mutationFn: async ({ interventionId, userIds }) => {
            const result = await interventionService.updateAssignments(interventionId, userIds);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        },
    });

    // Mutation pour mettre à jour les assignations journalières
    const updateDailyAssignmentsMutation = useMutation({
        mutationFn: async ({ interventionId, dailyAssignments }) => {
            const result = await interventionService.updateDailyAssignments(interventionId, dailyAssignments);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
        },
    });

    return {
        // Données
        interventions,
        isLoading,
        error,

        // Fonctions
        refetch,
        createIntervention: createMutation.mutate,
        updateIntervention: updateMutation.mutate,
        deleteIntervention: deleteMutation.mutate,

        // États des mutations
        isCreating: createMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isUpdatingAssignments: updateAssignmentsMutation.isPending,

        // Nouvelle fonction pour mettre à jour les assignations
        updateAssignments: updateAssignmentsMutation.mutate,
        updateDailyAssignments: updateDailyAssignmentsMutation.mutateAsync,
        isUpdatingDailyAssignments: updateDailyAssignmentsMutation.isPending,
    };
}

/**
 * Hook pour récupérer une intervention spécifique
 * @param {string} interventionId - ID de l'intervention
 * @returns {object} - Intervention, loading, error
 */
export function useIntervention(interventionId) {
    return useQuery({
        queryKey: ['intervention', interventionId],
        queryFn: async () => {
            const { data, error } = await interventionService.getInterventions(null, null);
            if (error) throw error;
            // Filtrer pour trouver l'intervention spécifique
            const intervention = data?.find(i => i.id === interventionId);
            if (!intervention) throw new Error('Intervention non trouvée');
            return intervention;
        },
        enabled: !!interventionId,
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 10 * 60 * 1000,
    });
}
