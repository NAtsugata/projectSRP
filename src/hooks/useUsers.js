import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../lib/supabase';

/**
 * Hook pour gérer les utilisateurs avec React Query
 * @returns {object} - Users, loading, error, et fonctions de mutation
 */
export function useUsers() {
    const queryClient = useQueryClient();

    // Query pour récupérer tous les utilisateurs
    const {
        data: users = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const result = await profileService.getAllProfiles();
            if (result.error) throw result.error;
            return result.data || [];
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - utilisateurs changent rarement
        gcTime: 30 * 60 * 1000,    // 30 minutes en cache
    });

    // Mutation pour mettre à jour un utilisateur
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }) => {
            console.log('🔄 Updating user:', { id, updates });
            const result = await profileService.updateProfile(id, updates);
            console.log('🔄 Update result:', result);
            if (result.error) {
                console.error('❌ Update error:', result.error);
                throw result.error;
            }
            return result.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    return {
        // Données
        users,
        isLoading,
        error,

        // Fonctions
        refetch,
        updateUser: updateMutation.mutate,

        // États des mutations
        isUpdating: updateMutation.isPending,
    };
}
