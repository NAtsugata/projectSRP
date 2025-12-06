import { QueryClient } from '@tanstack/react-query';

// Configuration du client React Query - Optimisée Mobile
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache les données pendant 1 minute (réduit pour mobile)
            staleTime: 1 * 60 * 1000,
            // Garde les données en cache pendant 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry automatique en cas d'erreur (3 pour mobile)
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
            // Refetch au focus de la fenêtre (désactivé pour mobile)
            refetchOnWindowFocus: false,
            // Refetch à la reconnexion
            refetchOnReconnect: true,
            // Mode network : toujours essayer le réseau d'abord
            networkMode: 'offlineFirst',
        },
        mutations: {
            // Retry pour les mutations en cas d'erreur réseau
            retry: 1,
        },
    },
});
