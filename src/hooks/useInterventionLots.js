// src/hooks/useInterventionLots.js
// Hook React Query pour les lots de chantier (Phase 2). Fichier autonome.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lotService } from '../services/lotService';

export function useInterventionLots(interventionId) {
  const queryClient = useQueryClient();
  const queryKey = ['intervention-lots', interventionId];

  const { data: lots = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await lotService.getLots(interventionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!interventionId,
    staleTime: 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createLot = useMutation({
    mutationFn: async (lot) => {
      const { data, error } = await lotService.createLot(interventionId, lot);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateLot = useMutation({
    mutationFn: async ({ lotId, updates }) => {
      const { data, error } = await lotService.updateLot(lotId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteLot = useMutation({
    mutationFn: async (lotId) => {
      const { error } = await lotService.deleteLot(lotId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    lots,
    isLoading,
    error,
    refetch,
    createLot: createLot.mutateAsync,
    updateLot: updateLot.mutateAsync,
    deleteLot: deleteLot.mutateAsync,
    isMutating: createLot.isPending || updateLot.isPending || deleteLot.isPending,
  };
}
