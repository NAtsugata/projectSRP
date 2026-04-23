import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import checklistService from '../services/checklistService';

/**
 * Hook pour gérer les checklists avec React Query
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {object} - Checklists, templates, loading, error, et fonctions de mutation
 */
export function useChecklists(userId = null) {
    const queryClient = useQueryClient();

    // Query pour récupérer les checklists
    const {
        data: checklists = [],
        isLoading: checklistsLoading,
        error: checklistsError,
    } = useQuery({
        queryKey: ['checklists', userId],
        queryFn: async () => {
            const result = userId
                ? await checklistService.getUserChecklists(userId)
                : await checklistService.getAllChecklists();
            if (result.error) throw result.error;
            return result.data || [];
        },
        staleTime: 5 * 60 * 1000,  // 5 minutes
        gcTime: 15 * 60 * 1000,
    });

    // Query pour récupérer les templates
    const {
        data: templates = [],
        isLoading: templatesLoading,
        error: templatesError,
        refetch: refetchTemplates,
    } = useQuery({
        queryKey: ['checklistTemplates'],
        queryFn: async () => {
            const result = await checklistService.getAllTemplates();
            if (result.error) throw result.error;
            return result.data || [];
        },
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
        refetchOnReconnect: 'always',
    });

    // Mutation pour mettre à jour une checklist
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            const result = await checklistService.updateChecklist(id, updates);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklists'] });
        },
    });

    // Mutation pour créer un template
    const createTemplateMutation = useMutation({
        mutationFn: async (template) => {
            const result = await checklistService.createTemplate(template);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
        },
    });

    // Mutation pour mettre à jour un template
    const updateTemplateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            const result = await checklistService.updateTemplate(id, updates);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
        },
    });

    // Mutation pour supprimer un template
    const deleteTemplateMutation = useMutation({
        mutationFn: async (id) => {
            const result = await checklistService.deleteTemplate(id);
            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
        },
    });

    return {
        // Données
        checklists,
        templates,
        isLoading: checklistsLoading || templatesLoading,
        error: checklistsError || templatesError,

        // Fonctions
        updateChecklist: updateMutation.mutate,
        createTemplate: createTemplateMutation.mutate,
        updateTemplate: updateTemplateMutation.mutate,
        deleteTemplate: deleteTemplateMutation.mutate,
        refetchTemplates,

        // États des mutations
        isUpdating: updateMutation.isPending,
        isCreatingTemplate: createTemplateMutation.isPending,
        isUpdatingTemplate: updateTemplateMutation.isPending,
        isDeletingTemplate: deleteTemplateMutation.isPending,
    };
}
