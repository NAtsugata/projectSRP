import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionService } from '../services/interventionService';
import { clientService } from '../services/clientService';
import { cacheInterventions, getCachedInterventions } from '../utils/offlineStorage';
import { queueOperation, SYNC_OPERATION_TYPES } from '../utils/syncService';
import logger from '../utils/logger';

/**
 * Hook pour gérer les interventions avec React Query
 * Supporte le mode hors ligne avec cache IndexedDB
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
            // Si hors ligne, utiliser le cache
            if (!navigator.onLine) {
                logger.log('[useInterventions] Mode offline - utilisation du cache');
                const cached = await getCachedInterventions();
                let filtered = cached;
                if (userId) {
                    filtered = cached.filter(i =>
                        i.assigned_users?.some(u => u.id === userId) || i.user_id === userId
                    );
                }
                if (isArchived !== null) {
                    filtered = filtered.filter(i => i.is_archived === isArchived);
                }
                return filtered;
            }

            // En ligne : récupérer depuis Supabase
            const { data, error } = await interventionService.getInterventions(userId, isArchived);

            if (error) throw error;

            // Mettre en cache pour le mode offline
            if (data && data.length > 0) {
                cacheInterventions(data).catch(e => logger.warn('[useInterventions] Cache failed:', e));
            }

            return data || [];
        },
        staleTime: 2 * 60 * 1000, // 2 minutes - interventions changent modérément
        gcTime: 10 * 60 * 1000,   // 10 minutes en cache
        placeholderData: (previousData) => previousData,
        networkMode: 'offlineFirst',
    });

    // Mutation pour créer une intervention (avec support offline)
    const createMutation = useMutation({
        mutationFn: async (params) => {
            if (!navigator.onLine) {
                // Mode offline : queue l'opération
                logger.log('[useInterventions] Offline - creation en queue');
                const tempId = `temp-${Date.now()}`;
                const tempIntervention = {
                    ...(params.interventionData || params),
                    id: tempId,
                    _offline: true,
                    created_at: new Date().toISOString()
                };
                await queueOperation(SYNC_OPERATION_TYPES.CREATE_INTERVENTION, params);
                return { data: tempIntervention };
            }

            const interventionData = params.interventionData || params;

            // Si un client_id n'est pas fourni mais qu'on a un nom de client,
            // créer ou récupérer le client automatiquement
            if (!interventionData.client_id && interventionData.client) {
                logger.log('[useInterventions] Auto-creation/recuperation du client:', interventionData.client);
                const { data: clientData } = await clientService.getOrCreateClientFromIntervention(interventionData);
                if (clientData?.id) {
                    interventionData.client_id = clientData.id;
                    logger.log('[useInterventions] Client lie a l\'intervention:', clientData.id);
                }
            }

            let result;
            // Support both old style (just data) and new style (object with fields)
            if (params.interventionData || params.assignedUserIds) {
                result = await interventionService.createIntervention(
                    interventionData,
                    params.assignedUserIds,
                    params.briefingFiles
                );
            } else {
                result = await interventionService.createIntervention(interventionData);
            }

            if (result.error) throw result.error;
            return result;
        },
        onSuccess: () => {
            // Invalider le cache pour recharger les données
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
            // Invalider aussi le cache des clients car un nouveau client peut avoir été créé
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
    });

    // Mutation pour mettre à jour une intervention (avec support offline)
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            if (!navigator.onLine) {
                logger.log('[useInterventions] Offline - mise a jour en queue');
                await queueOperation(SYNC_OPERATION_TYPES.UPDATE_INTERVENTION, { id, updates });
                return { data: { id, ...updates } };
            }

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

        // Fonctions pour mettre à jour les assignations (mutateAsync pour await)
        updateAssignments: updateAssignmentsMutation.mutateAsync,
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
