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
            if (userId) {
                return await checklistService.getUserChecklists(userId);
            }
            return await checklistService.getAllChecklists();
        },
    });

    // Query pour récupérer les templates
    const {
        data: templates = [],
        isLoading: templatesLoading,
        error: templatesError,
    } = useQuery({
        queryKey: ['checklistTemplates'],
        queryFn: async () => {
            const result = await checklistService.getAllTemplates();
            return result.data || [];
        },
    });

    // Mutation pour mettre à jour une checklist
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => checklistService.updateChecklist(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['checklists']);
        },
    });

    // Mutation pour créer un template
    const createTemplateMutation = useMutation({
        mutationFn: (template) => checklistService.createTemplate(template),
        onSuccess: () => {
            queryClient.invalidateQueries(['checklistTemplates']);
        },
    });

    // Mutation pour mettre à jour un template
    const updateTemplateMutation = useMutation({
        mutationFn: ({ id, updates }) => checklistService.updateTemplate(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['checklistTemplates']);
        },
    });

    // Mutation pour supprimer un template
    const deleteTemplateMutation = useMutation({
        mutationFn: (id) => checklistService.deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['checklistTemplates']);
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

        // États des mutations
        isUpdating: updateMutation.isPending,
        isCreatingTemplate: createTemplateMutation.isPending,
        isUpdatingTemplate: updateTemplateMutation.isPending,
        isDeletingTemplate: deleteTemplateMutation.isPending,
    };
}
