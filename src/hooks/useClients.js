import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { useOnlineStatus } from './useOnlineStatus';
import logger from '../utils/logger';
import { safeStorage } from '../utils/safeStorage';

// Cache pour le mode offline
const CLIENTS_CACHE_KEY = 'clients_cache';

const getCachedClients = async () => {
  return safeStorage.getJSON(CLIENTS_CACHE_KEY, []);
};

const cacheClients = (clients) => {
  const success = safeStorage.setJSON(CLIENTS_CACHE_KEY, clients);
  if (!success) {
    logger.warn('[useClients] Cache failed');
  }
};

/**
 * Hook pour gerer les clients avec React Query
 * Supporte le mode hors ligne avec cache localStorage
 * @param {Object} options - Options de filtrage
 * @returns {Object} - Clients, loading, error, et fonctions de mutation
 */
export function useClients(options = {}) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const {
    searchTerm = null,
    clientType = null,
    city = null,
    isActive = true,
    limit = 100
  } = options;

  // Query pour recuperer les clients
  const {
    data: clients = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['clients', searchTerm, clientType, city, isActive, limit],
    queryFn: async () => {
      // Si hors ligne, utiliser le cache
      if (!navigator.onLine) {
        logger.log('[useClients] Mode offline - utilisation du cache');
        const cached = await getCachedClients();

        // Appliquer les filtres cote client
        let filtered = cached;
        if (isActive !== null) {
          filtered = filtered.filter(c => c.is_active === isActive);
        }
        if (clientType) {
          filtered = filtered.filter(c => c.client_type === clientType);
        }
        if (city) {
          filtered = filtered.filter(c => c.city?.toLowerCase().includes(city.toLowerCase()));
        }
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = filtered.filter(c =>
            c.name?.toLowerCase().includes(term) ||
            c.company_name?.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term)
          );
        }
        return filtered.slice(0, limit);
      }

      // En ligne : recuperer depuis Supabase
      const { data, error } = await clientService.getClients({
        searchTerm,
        clientType,
        city,
        isActive,
        limit
      });

      if (error) throw error;

      // Mettre en cache pour le mode offline
      if (data && data.length > 0) {
        cacheClients(data);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 15 * 60 * 1000,    // 15 minutes
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst',
  });

  // Query pour un client specifique
  const useClient = (clientId) => {
    return useQuery({
      queryKey: ['client', clientId],
      queryFn: async () => {
        if (!clientId) return null;

        const { data, error } = await clientService.getClientById(clientId);
        if (error) throw error;
        return data;
      },
      enabled: !!clientId,
      staleTime: 2 * 60 * 1000,
    });
  };

  // Mutation pour creer un client
  const createMutation = useMutation({
    mutationFn: async ({ clientData, contacts }) => {
      if (!navigator.onLine) {
        throw new Error('Creation de client impossible hors ligne');
      }
      return clientService.createClient(clientData, contacts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // Mutation pour mettre a jour un client
  const updateMutation = useMutation({
    mutationFn: async ({ clientId, updates }) => {
      if (!navigator.onLine) {
        throw new Error('Modification impossible hors ligne');
      }
      const result = await clientService.updateClient(clientId, updates);
      // Propager l'erreur pour que onError soit appele
      if (result.error) {
        throw result.error;
      }
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.clientId] });
    },
    onError: (error) => {
      logger.error('[useClients] Erreur mise a jour client:', error);
    },
  });

  // Mutation pour desactiver un client
  const deactivateMutation = useMutation({
    mutationFn: async (clientId) => {
      return clientService.deactivateClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // Mutation pour supprimer un client
  const deleteMutation = useMutation({
    mutationFn: async (clientId) => {
      return clientService.deleteClient(clientId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // Mutation pour ajouter un contact
  const addContactMutation = useMutation({
    mutationFn: async ({ clientId, contactData }) => {
      return clientService.addContact(clientId, contactData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client', variables.clientId] });
    },
  });

  // Mutation pour mettre a jour un contact
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, updates }) => {
      return clientService.updateContact(contactId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  // Mutation pour supprimer un contact
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId) => {
      return clientService.deleteContact(contactId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return {
    // Donnees
    clients,
    isLoading,
    error,
    isOnline,

    // Actions
    refetch,
    useClient,

    // Mutations clients
    createClient: createMutation.mutateAsync,
    updateClient: updateMutation.mutateAsync,
    deactivateClient: deactivateMutation.mutateAsync,
    deleteClient: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,

    // Mutations contacts
    addContact: addContactMutation.mutateAsync,
    updateContact: updateContactMutation.mutateAsync,
    deleteContact: deleteContactMutation.mutateAsync,

    // Utilitaires
    searchClients: clientService.searchClients,
    getClientStats: clientService.getClientStats,
    getClientInterventions: clientService.getClientInterventions,
    exportCSV: clientService.exportClientsCSV,
  };
}

/**
 * Hook pour recuperer un client specifique par ID
 * @param {string} clientId - ID du client
 * @returns {Object} - Client, loading, error
 */
export function useClient(clientId) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await clientService.getClientById(clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook pour l'historique interventions d'un client
 * @param {string} clientId - ID du client
 * @returns {Object} - Interventions, loading, error
 */
export function useClientInterventions(clientId) {
  return useQuery({
    queryKey: ['client-interventions', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await clientService.getClientInterventions(clientId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook pour les statistiques d'un client
 * @param {string} clientId - ID du client
 * @returns {Object} - Stats, loading, error
 */
export function useClientStats(clientId) {
  return useQuery({
    queryKey: ['client-stats', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await clientService.getClientStats(clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}

export default useClients;
