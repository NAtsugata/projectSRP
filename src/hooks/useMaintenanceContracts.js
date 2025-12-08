// =============================
// FILE: src/hooks/useMaintenanceContracts.js
// React Query hook for maintenance contracts management
// =============================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceContractService } from '../lib/supabase';

// ========== QUERY KEYS ==========
export const contractKeys = {
    all: ['contracts'],
    lists: () => [...contractKeys.all, 'list'],
    list: (filters) => [...contractKeys.lists(), filters],
    details: () => [...contractKeys.all, 'detail'],
    detail: (id) => [...contractKeys.details(), id],
    visits: (contractId) => [...contractKeys.all, 'visits', contractId],
    allVisits: (filters) => [...contractKeys.all, 'allVisits', filters],
    expiring: (days) => [...contractKeys.all, 'expiring', days],
    upcoming: (days) => [...contractKeys.all, 'upcoming', days],
    stats: () => [...contractKeys.all, 'stats'],
};

// ========== QUERIES ==========

/**
 * Hook pour récupérer la liste des contrats
 */
export function useContracts(filters = {}) {
    return useQuery({
        queryKey: contractKeys.list(filters),
        queryFn: async () => {
            const { data, error } = await maintenanceContractService.getContracts(filters);
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook pour récupérer un contrat par ID
 */
export function useContractById(id) {
    return useQuery({
        queryKey: contractKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await maintenanceContractService.getContractById(id);
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });
}

/**
 * Hook pour récupérer les visites d'un contrat
 */
export function useContractVisits(contractId) {
    return useQuery({
        queryKey: contractKeys.visits(contractId),
        queryFn: async () => {
            const { data, error } = await maintenanceContractService.getContractVisits(contractId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!contractId,
    });
}

/**
 * Hook pour récupérer toutes les visites
 */
export function useAllVisits(filters = {}) {
    return useQuery({
        queryKey: contractKeys.allVisits(filters),
        queryFn: async () => {
            const { data, error } = await maintenanceContractService.getAllVisits(filters);
            if (error) throw error;
            return data || [];
        },
    });
}

/**
 * Hook pour récupérer les contrats expirant bientôt
 */
export function useExpiringContracts(days = 30) {
    return useQuery({
        queryKey: contractKeys.expiring(days),
        queryFn: async () => {
            const { data, error } = await maintenanceContractService.getExpiringContracts(days);
            if (error) throw error;
            return data || [];
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}

/**
 * Hook pour récupérer les visites à venir
 */
export function useUpcomingVisits(days = 7) {
    return useQuery({
        queryKey: contractKeys.upcoming(days),
        queryFn: async () => {
            const { data, error } = await maintenanceContractService.getUpcomingVisits(days);
            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook pour récupérer les statistiques des contrats
 */
export function useContractStats() {
    return useQuery({
        queryKey: contractKeys.stats(),
        queryFn: async () => {
            const stats = await maintenanceContractService.getContractStats();
            return stats;
        },
        staleTime: 10 * 60 * 1000,
    });
}

// ========== MUTATIONS ==========

/**
 * Hook pour créer un contrat
 */
export function useCreateContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (contractData) => {
            const { data, error } = await maintenanceContractService.createContract(contractData);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contractKeys.all });
        },
    });
}

/**
 * Hook pour mettre à jour un contrat
 */
export function useUpdateContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }) => {
            const { data, error } = await maintenanceContractService.updateContract(id, updates);
            if (error) throw error;
            return data;
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: contractKeys.all });
            queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables.id) });
        },
    });
}

/**
 * Hook pour supprimer un contrat
 */
export function useDeleteContract() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id) => {
            const { error } = await maintenanceContractService.deleteContract(id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contractKeys.all });
        },
    });
}

/**
 * Hook pour générer les visites d'un contrat
 */
export function useGenerateVisits() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (contractId) => {
            const { data, error } = await maintenanceContractService.generateVisits(contractId);
            if (error) throw error;
            return data;
        },
        onSuccess: (data, contractId) => {
            queryClient.invalidateQueries({ queryKey: contractKeys.visits(contractId) });
            queryClient.invalidateQueries({ queryKey: contractKeys.allVisits({}) });
        },
    });
}

/**
 * Hook pour mettre à jour le statut d'une visite
 */
export function useUpdateVisitStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ visitId, status, notes }) => {
            const { error } = await maintenanceContractService.updateVisitStatus(visitId, status, notes);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contractKeys.all });
        },
    });
}

/**
 * Hook pour lier une visite à une intervention
 */
export function useLinkVisitToIntervention() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ visitId, interventionId }) => {
            const { error } = await maintenanceContractService.linkVisitToIntervention(visitId, interventionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contractKeys.all });
        },
    });
}
