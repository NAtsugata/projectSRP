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
    });

    // Mutation pour mettre à jour un utilisateur
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }) => profileService.updateProfile(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['users']);
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
