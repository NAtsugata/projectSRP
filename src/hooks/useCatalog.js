import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogService } from '../services/catalogService';
import { useOnlineStatus } from './useOnlineStatus';
import logger from '../utils/logger';

// Cache localStorage pour le mode offline
const CATALOG_CACHE_KEY = 'catalog_items_cache';
const CATEGORIES_CACHE_KEY = 'catalog_categories_cache';
const TAX_RATES_CACHE_KEY = 'tax_rates_cache';

const getCached = (key) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
};

const setCache = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    logger.warn('[useCatalog] Cache failed:', e);
  }
};

/**
 * Hook pour gerer les articles du catalogue
 * @param {Object} options - Options de filtrage
 * @returns {Object} - Articles, loading, error, et fonctions de mutation
 */
export function useCatalogItems(options = {}) {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const {
    itemType = null,
    category = null,
    searchTerm = null,
    activeOnly = true,
    limit = 100
  } = options;

  // Query pour recuperer les articles
  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['catalog-items', itemType, category, searchTerm, activeOnly, limit],
    queryFn: async () => {
      if (!navigator.onLine) {
        logger.log('[useCatalog] Mode offline - utilisation du cache');
        let cached = getCached(CATALOG_CACHE_KEY);

        if (itemType) {
          cached = cached.filter(i => i.item_type === itemType);
        }
        if (category) {
          cached = cached.filter(i => i.category === category);
        }
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          cached = cached.filter(i =>
            i.name.toLowerCase().includes(term) ||
            (i.reference && i.reference.toLowerCase().includes(term)) ||
            (i.description && i.description.toLowerCase().includes(term))
          );
        }
        if (activeOnly) {
          cached = cached.filter(i => i.is_active);
        }
        return cached.slice(0, limit);
      }

      const { data, error } = await catalogService.getCatalogItems({
        itemType,
        category,
        searchTerm,
        activeOnly,
        limit
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setCache(CATALOG_CACHE_KEY, data);
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst',
  });

  // Mutation pour creer un article
  const createMutation = useMutation({
    mutationFn: async (itemData) => {
      if (!navigator.onLine) {
        throw new Error('Creation impossible hors ligne');
      }
      const { data, error } = await catalogService.createCatalogItem(itemData);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-stats'] });
    },
  });

  // Mutation pour mettre a jour un article
  const updateMutation = useMutation({
    mutationFn: async ({ itemId, updates }) => {
      if (!navigator.onLine) {
        throw new Error('Modification impossible hors ligne');
      }
      const { data, error } = await catalogService.updateCatalogItem(itemId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-stats'] });
    },
  });

  // Mutation pour supprimer un article
  const deleteMutation = useMutation({
    mutationFn: async (itemId) => {
      if (!navigator.onLine) {
        throw new Error('Suppression impossible hors ligne');
      }
      const { data, error } = await catalogService.deleteCatalogItem(itemId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
      queryClient.invalidateQueries({ queryKey: ['catalog-stats'] });
    },
  });

  // Mutation pour basculer le favori
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (itemId) => {
      const { data, error } = await catalogService.toggleFavorite(itemId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
    },
  });

  return {
    items,
    isLoading,
    error,
    refetch,
    isOnline,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    toggleFavorite: toggleFavoriteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook pour la recherche rapide dans le catalogue
 * @param {string} searchTerm - Terme de recherche
 * @param {string} itemType - Type d'article (optionnel)
 * @returns {Object} - Resultats, loading, error
 */
export function useCatalogSearch(searchTerm, itemType = null) {
  return useQuery({
    queryKey: ['catalog-search', searchTerm, itemType],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await catalogService.searchCatalogItems(searchTerm, itemType);
      if (error) throw error;
      return data || [];
    },
    enabled: !!searchTerm && searchTerm.length >= 2,
    staleTime: 30 * 1000, // 30 secondes
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook pour gerer les categories du catalogue
 * @param {string} itemType - Filtrer par type (optionnel)
 * @returns {Object} - Categories, loading, error, et fonctions de mutation
 */
export function useCatalogCategories(itemType = null) {
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['catalog-categories', itemType],
    queryFn: async () => {
      if (!navigator.onLine) {
        return getCached(CATEGORIES_CACHE_KEY);
      }

      const { data, error } = await catalogService.getCategories(itemType);
      if (error) throw error;

      if (data && data.length > 0) {
        setCache(CATEGORIES_CACHE_KEY, data);
      }

      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
    networkMode: 'offlineFirst',
  });

  // Mutation pour creer une categorie
  const createMutation = useMutation({
    mutationFn: async (categoryData) => {
      const { data, error } = await catalogService.createCategory(categoryData);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
    },
  });

  // Mutation pour mettre a jour une categorie
  const updateMutation = useMutation({
    mutationFn: async ({ categoryId, updates }) => {
      const { data, error } = await catalogService.updateCategory(categoryId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
    },
  });

  // Mutation pour supprimer une categorie
  const deleteMutation = useMutation({
    mutationFn: async (categoryId) => {
      const { data, error } = await catalogService.deleteCategory(categoryId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
    },
  });

  // Mutation pour reordonner
  const reorderMutation = useMutation({
    mutationFn: async (categoryIds) => {
      const { data, error } = await catalogService.reorderCategories(categoryIds);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-categories'] });
    },
  });

  return {
    categories,
    isLoading,
    error,
    refetch,
    createCategory: createMutation.mutateAsync,
    updateCategory: updateMutation.mutateAsync,
    deleteCategory: deleteMutation.mutateAsync,
    reorderCategories: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook pour gerer les taux de TVA
 * @returns {Object} - Taux, loading, error, et fonctions de mutation
 */
export function useTaxRates() {
  const queryClient = useQueryClient();

  const {
    data: taxRates = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: async () => {
      if (!navigator.onLine) {
        return getCached(TAX_RATES_CACHE_KEY);
      }

      const { data, error } = await catalogService.getTaxRates();
      if (error) throw error;

      if (data && data.length > 0) {
        setCache(TAX_RATES_CACHE_KEY, data);
      }

      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    networkMode: 'offlineFirst',
  });

  // Mutation pour creer un taux
  const createMutation = useMutation({
    mutationFn: async (rateData) => {
      const { data, error } = await catalogService.createTaxRate(rateData);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
    },
  });

  // Mutation pour mettre a jour un taux
  const updateMutation = useMutation({
    mutationFn: async ({ rateId, updates }) => {
      const { data, error } = await catalogService.updateTaxRate(rateId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
    },
  });

  // Mutation pour supprimer un taux
  const deleteMutation = useMutation({
    mutationFn: async (rateId) => {
      const { data, error } = await catalogService.deleteTaxRate(rateId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
    },
  });

  // Mutation pour definir comme defaut
  const setDefaultMutation = useMutation({
    mutationFn: async (rateId) => {
      const { data, error } = await catalogService.setDefaultTaxRate(rateId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
    },
  });

  // Mutation pour initialiser les taux par defaut
  const initMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await catalogService.initializeDefaultTaxRates();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
    },
  });

  return {
    taxRates,
    isLoading,
    error,
    refetch,
    createTaxRate: createMutation.mutateAsync,
    updateTaxRate: updateMutation.mutateAsync,
    deleteTaxRate: deleteMutation.mutateAsync,
    setDefaultTaxRate: setDefaultMutation.mutateAsync,
    initializeDefaults: initMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook pour le taux de TVA par defaut
 * @returns {Object} - Taux par defaut, loading, error
 */
export function useDefaultTaxRate() {
  return useQuery({
    queryKey: ['default-tax-rate'],
    queryFn: async () => {
      const { data, error } = await catalogService.getDefaultTaxRate();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook pour gerer les modeles de devis
 * @returns {Object} - Modeles, loading, error, et fonctions de mutation
 */
export function useQuoteTemplates() {
  const queryClient = useQueryClient();

  const {
    data: templates = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['quote-templates'],
    queryFn: async () => {
      const { data, error } = await catalogService.getQuoteTemplates();
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Mutation pour creer un modele
  const createMutation = useMutation({
    mutationFn: async (templateData) => {
      const { data, error } = await catalogService.createQuoteTemplate(templateData);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
    },
  });

  // Mutation pour mettre a jour un modele
  const updateMutation = useMutation({
    mutationFn: async ({ templateId, updates }) => {
      const { data, error } = await catalogService.updateQuoteTemplate(templateId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
    },
  });

  // Mutation pour supprimer un modele
  const deleteMutation = useMutation({
    mutationFn: async (templateId) => {
      const { data, error } = await catalogService.deleteQuoteTemplate(templateId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
    },
  });

  // Mutation pour definir comme defaut
  const setDefaultMutation = useMutation({
    mutationFn: async (templateId) => {
      const { data, error } = await catalogService.setDefaultQuoteTemplate(templateId);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
    },
  });

  // Mutation pour dupliquer un modele
  const duplicateMutation = useMutation({
    mutationFn: async ({ templateId, newName }) => {
      const { data, error } = await catalogService.duplicateQuoteTemplate(templateId, newName);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
    },
  });

  return {
    templates,
    isLoading,
    error,
    refetch,
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    setDefaultTemplate: setDefaultMutation.mutateAsync,
    duplicateTemplate: duplicateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook pour le modele de devis par defaut
 * @returns {Object} - Modele par defaut, loading, error
 */
export function useDefaultQuoteTemplate() {
  return useQuery({
    queryKey: ['default-quote-template'],
    queryFn: async () => {
      const { data, error } = await catalogService.getDefaultQuoteTemplate();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook pour les statistiques du catalogue
 * @returns {Object} - Stats, loading, error
 */
export function useCatalogStats() {
  return useQuery({
    queryKey: ['catalog-stats'],
    queryFn: async () => {
      const { data, error } = await catalogService.getCatalogStats();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export default useCatalogItems;
