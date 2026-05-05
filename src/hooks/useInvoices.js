import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicingService } from '../services/invoicingService';
import { useOnlineStatus } from './useOnlineStatus';
import logger from '../utils/logger';
import { safeStorage } from '../utils/safeStorage';

// Cache pour le mode offline
const INVOICES_CACHE_KEY = 'invoices_cache';
const QUOTES_CACHE_KEY = 'quotes_cache';

const getCachedInvoices = () => {
  return safeStorage.getJSON(INVOICES_CACHE_KEY, []);
};

const cacheInvoices = (invoices) => {
  const success = safeStorage.setJSON(INVOICES_CACHE_KEY, invoices);
  if (!success) {
    logger.warn('[useInvoices] Cache failed');
  }
};

const getCachedQuotes = () => {
  return safeStorage.getJSON(QUOTES_CACHE_KEY, []);
};

const cacheQuotes = (quotes) => {
  const success = safeStorage.setJSON(QUOTES_CACHE_KEY, quotes);
  if (!success) {
    logger.warn('[useInvoices] Quotes cache failed');
  }
};

/**
 * Hook pour gerer les factures avec React Query
 * Supporte le mode hors ligne avec cache localStorage
 * @param {Object} options - Options de filtrage
 * @returns {Object} - Factures, loading, error, et fonctions de mutation
 */
export function useInvoices(options = {}) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const {
    status = null,
    clientId = null,
    dateFrom = null,
    dateTo = null,
    limit = 100
  } = options;

  // Query pour recuperer les factures
  const {
    data: invoices = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['invoices', status, clientId, dateFrom, dateTo, limit],
    queryFn: async () => {
      // Si hors ligne, utiliser le cache
      if (!navigator.onLine) {
        logger.log('[useInvoices] Mode offline - utilisation du cache');
        const cached = getCachedInvoices();

        // Appliquer les filtres cote client
        let filtered = cached;
        if (status) {
          filtered = filtered.filter(i => i.status === status);
        }
        if (clientId) {
          filtered = filtered.filter(i => i.client_id === clientId);
        }
        if (dateFrom) {
          filtered = filtered.filter(i => i.issue_date >= dateFrom);
        }
        if (dateTo) {
          filtered = filtered.filter(i => i.issue_date <= dateTo);
        }
        return filtered.slice(0, limit);
      }

      // En ligne : recuperer depuis Supabase
      const { data, error } = await invoicingService.getInvoices({
        status,
        clientId,
        dateFrom,
        dateTo,
        limit
      });

      if (error) throw error;

      // Mettre en cache pour le mode offline
      if (data && data.length > 0) {
        cacheInvoices(data);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 15 * 60 * 1000,    // 15 minutes
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst',
  });

  // Mutation pour creer une facture
  const createMutation = useMutation({
    mutationFn: async ({ invoiceData, items }) => {
      if (!navigator.onLine) {
        throw new Error('Creation impossible hors ligne');
      }
      const { data, error } = await invoicingService.createInvoice(invoiceData, items);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  // Mutation pour mettre a jour une facture
  const updateMutation = useMutation({
    mutationFn: async ({ invoiceId, updates, items }) => {
      if (!navigator.onLine) {
        throw new Error('Modification impossible hors ligne');
      }
      const { data, error } = await invoicingService.updateInvoice(invoiceId, updates);
      if (error) throw error;

      // Si des items sont fournis, les mettre a jour aussi
      if (items) {
        const { error: itemsError } = await invoicingService.updateInvoiceItems(invoiceId, items);
        if (itemsError) throw itemsError;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  // Mutation pour supprimer une facture
  const deleteMutation = useMutation({
    mutationFn: async (invoiceId) => {
      if (!navigator.onLine) {
        throw new Error('Suppression impossible hors ligne');
      }
      const { data, error } = await invoicingService.deleteInvoice(invoiceId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  // Mutation pour envoyer une facture
  const sendMutation = useMutation({
    mutationFn: async (invoiceId) => {
      if (!navigator.onLine) {
        throw new Error('Envoi impossible hors ligne');
      }
      const { data, error } = await invoicingService.sendInvoice(invoiceId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  // Mutation pour marquer comme payee
  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceId, paymentData }) => {
      if (!navigator.onLine) {
        throw new Error('Modification impossible hors ligne');
      }
      const { data, error } = await invoicingService.markAsPaid(invoiceId, paymentData);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  // Mutation pour annuler une facture
  const cancelMutation = useMutation({
    mutationFn: async (invoiceId) => {
      if (!navigator.onLine) {
        throw new Error('Annulation impossible hors ligne');
      }
      const { data, error } = await invoicingService.cancelInvoice(invoiceId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  return {
    invoices,
    isLoading,
    error,
    refetch,
    isOnline,
    createInvoice: createMutation.mutateAsync,
    updateInvoice: updateMutation.mutateAsync,
    deleteInvoice: deleteMutation.mutateAsync,
    sendInvoice: sendMutation.mutateAsync,
    markAsPaid: markPaidMutation.mutateAsync,
    cancelInvoice: cancelMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSending: sendMutation.isPending,
  };
}

/**
 * Hook pour recuperer une facture specifique
 * @param {string} invoiceId - ID de la facture
 * @returns {Object} - Facture, loading, error
 */
export function useInvoice(invoiceId) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;

      const { data, error } = await invoicingService.getInvoiceById(invoiceId);
      if (error) throw error;
      return data;
    },
    enabled: !!invoiceId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook pour gerer les devis avec React Query
 * @param {Object} options - Options de filtrage
 * @returns {Object} - Devis, loading, error, et fonctions de mutation
 */
export function useQuotes(options = {}) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const {
    status = null,
    clientId = null,
    dateFrom = null,
    dateTo = null,
    limit = 100
  } = options;

  // Query pour recuperer les devis
  const {
    data: quotes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['quotes', status, clientId, dateFrom, dateTo, limit],
    queryFn: async () => {
      // Si hors ligne, utiliser le cache
      if (!navigator.onLine) {
        logger.log('[useQuotes] Mode offline - utilisation du cache');
        const cached = getCachedQuotes();

        let filtered = cached;
        if (status) {
          filtered = filtered.filter(q => q.status === status);
        }
        if (clientId) {
          filtered = filtered.filter(q => q.client_id === clientId);
        }
        if (dateFrom) {
          filtered = filtered.filter(q => q.issue_date >= dateFrom);
        }
        if (dateTo) {
          filtered = filtered.filter(q => q.issue_date <= dateTo);
        }
        return filtered.slice(0, limit);
      }

      const { data, error } = await invoicingService.getQuotes({
        status,
        clientId,
        dateFrom,
        dateTo,
        limit
      });

      if (error) throw error;

      if (data && data.length > 0) {
        cacheQuotes(data);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst',
  });

  // Mutation pour creer un devis
  const createMutation = useMutation({
    mutationFn: async ({ quoteData, items }) => {
      if (!navigator.onLine) {
        throw new Error('Creation impossible hors ligne');
      }
      const { data, error } = await invoicingService.createQuote(quoteData, items);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  // Mutation pour mettre a jour un devis
  const updateMutation = useMutation({
    mutationFn: async ({ quoteId, updates, items }) => {
      if (!navigator.onLine) {
        throw new Error('Modification impossible hors ligne');
      }
      const { data, error } = await invoicingService.updateQuote(quoteId, updates);
      if (error) throw error;

      if (items) {
        await invoicingService.updateQuoteItems(quoteId, items);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] });
    },
  });

  // Mutation pour supprimer un devis
  const deleteMutation = useMutation({
    mutationFn: async (quoteId) => {
      if (!navigator.onLine) {
        throw new Error('Suppression impossible hors ligne');
      }
      const { data, error } = await invoicingService.deleteQuote(quoteId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  // Mutation pour envoyer un devis
  const sendMutation = useMutation({
    mutationFn: async (quoteId) => {
      if (!navigator.onLine) {
        throw new Error('Envoi impossible hors ligne');
      }
      const { data, error } = await invoicingService.sendQuote(quoteId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });

  // Mutation pour accepter un devis
  const acceptMutation = useMutation({
    mutationFn: async (quoteId) => {
      if (!navigator.onLine) {
        throw new Error('Action impossible hors ligne');
      }
      const { data, error } = await invoicingService.acceptQuote(quoteId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });

  // Mutation pour rejeter un devis
  const rejectMutation = useMutation({
    mutationFn: async (quoteId) => {
      if (!navigator.onLine) {
        throw new Error('Action impossible hors ligne');
      }
      const { data, error } = await invoicingService.rejectQuote(quoteId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
    },
  });

  // Mutation pour convertir en facture
  const convertMutation = useMutation({
    mutationFn: async (quoteId) => {
      if (!navigator.onLine) {
        throw new Error('Conversion impossible hors ligne');
      }
      const { data, error } = await invoicingService.convertQuoteToInvoice(quoteId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  return {
    quotes,
    isLoading,
    error,
    refetch,
    isOnline,
    createQuote: createMutation.mutateAsync,
    updateQuote: updateMutation.mutateAsync,
    deleteQuote: deleteMutation.mutateAsync,
    sendQuote: sendMutation.mutateAsync,
    acceptQuote: acceptMutation.mutateAsync,
    rejectQuote: rejectMutation.mutateAsync,
    convertToInvoice: convertMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSending: sendMutation.isPending,
    isConverting: convertMutation.isPending,
  };
}

/**
 * Hook pour recuperer un devis specifique
 * @param {string} quoteId - ID du devis
 * @returns {Object} - Devis, loading, error
 */
export function useQuote(quoteId) {
  return useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;

      const { data, error } = await invoicingService.getQuoteById(quoteId);
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook pour les statistiques de facturation
 * @returns {Object} - Stats, loading, error
 */
export function useInvoiceStats() {
  return useQuery({
    queryKey: ['invoice-stats'],
    queryFn: async () => {
      const { data, error } = await invoicingService.getInvoiceStats();
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook pour le chiffre d'affaires par mois
 * @param {number} year - Annee
 * @returns {Object} - Donnees mensuelles, loading, error
 */
export function useRevenueByMonth(year = new Date().getFullYear()) {
  return useQuery({
    queryKey: ['revenue-by-month', year],
    queryFn: async () => {
      const { data, error } = await invoicingService.getRevenueByMonth(year);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook pour les factures en retard
 * @returns {Object} - Factures en retard, loading, error
 */
export function useOverdueInvoices() {
  return useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: async () => {
      const { data, error } = await invoicingService.getOverdueInvoices();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000, // Rafraichir toutes les 10 minutes
  });
}

export default useInvoices;
