// src/hooks/useSubcontractors.js
// Hook React Query pour les sous-traitants. Fichier autonome.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subcontractorService } from '../services/subcontractorService';

export function useSubcontractors() {
  const queryClient = useQueryClient();
  const queryKey = ['subcontractors'];

  const { data: subcontractors = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await subcontractorService.getAll();
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createSub = useMutation({
    mutationFn: async (data) => {
      const { data: created, error } = await subcontractorService.create(data);
      if (error) throw error;
      return created;
    },
    onSuccess: invalidate,
  });

  const updateSub = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await subcontractorService.update(id, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteSub = useMutation({
    mutationFn: async (id) => {
      const { error } = await subcontractorService.remove(id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    subcontractors,
    isLoading,
    error,
    refetch,
    createSubcontractor: createSub.mutateAsync,
    updateSubcontractor: updateSub.mutateAsync,
    deleteSubcontractor: deleteSub.mutateAsync,
    isMutating: createSub.isPending || updateSub.isPending || deleteSub.isPending,
  };
}
