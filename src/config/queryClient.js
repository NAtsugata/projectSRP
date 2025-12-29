import { QueryClient } from '@tanstack/react-query';
import { CACHE, NETWORK } from './constants';

/**
 * Fonction de retry intelligente avec gestion du rate limiting
 * @param {number} failureCount - Nombre d'échecs
 * @param {Error} error - Erreur retournée
 * @returns {boolean} - Doit-on réessayer ?
 */
const shouldRetry = (failureCount, error) => {
  // Ne pas retry si c'est une erreur 429 (Too Many Requests - Rate Limit)
  if (error?.status === 429 || error?.message?.includes('429')) {
    console.warn('⚠️ Rate limit atteint, arrêt des tentatives');
    return false;
  }

  // Ne pas retry si c'est une erreur 4xx (sauf 429 géré ci-dessus)
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }

  // Retry uniquement pour les erreurs réseau et 5xx
  return failureCount < NETWORK.RETRY_ATTEMPTS;
};

// Configuration du client React Query - Optimisée Mobile
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache les données (optimisé pour mobile)
            staleTime: CACHE.STALE_TIME_MS,
            // Garde les données en cache
            gcTime: CACHE.GC_TIME_MS,
            // Retry intelligent avec gestion du rate limiting
            retry: shouldRetry,
            retryDelay: (attemptIndex) =>
                Math.min(
                    NETWORK.RETRY_DELAY_BASE_MS * (2 ** attemptIndex),
                    NETWORK.MAX_RETRY_DELAY_MS
                ),
            // Refetch au focus de la fenêtre (désactivé pour mobile)
            refetchOnWindowFocus: false,
            // Refetch à la reconnexion
            refetchOnReconnect: true,
            // Mode network : online d'abord avec fallback
            networkMode: 'online',
        },
        mutations: {
            // Retry pour les mutations (limité car modifications de données)
            retry: (failureCount, error) => {
                // Pas de retry pour rate limiting ou erreurs 4xx
                if (error?.status === 429 || (error?.status >= 400 && error?.status < 500)) {
                    return false;
                }
                return failureCount < 1;
            },
        },
    },
});
