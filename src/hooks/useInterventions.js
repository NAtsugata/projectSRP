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
        enabled: true, // Toujours actif
    });

    // Mutation pour créer une intervention
    const createMutation = useMutation({
        mutationFn: (newIntervention) => interventionService.createIntervention(newIntervention),
        onSuccess: () => {
            // Invalider le cache pour recharger les données
            queryClient.invalidateQueries(['interventions']);
        },
    });

    // Mutation pour mettre à jour une intervention
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => interventionService.updateIntervention(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['interventions']);
        },
    });

    // Mutation pour supprimer une intervention
    const deleteMutation = useMutation({
        mutationFn: (id) => interventionService.deleteIntervention(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['interventions']);
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
            const { data, error } = await interventionService.supabase
                .from('interventions')
                .select('*')
                .eq('id', interventionId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!interventionId,
    });
}
