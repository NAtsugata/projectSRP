import { QueryClient } from '@tanstack/react-query';

// Configuration du client React Query
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache les données pendant 5 minutes
            staleTime: 5 * 60 * 1000,
            // Garde les données en cache pendant 10 minutes
            cacheTime: 10 * 60 * 1000,
            // Retry automatique en cas d'erreur
            retry: 2,
            // Refetch au focus de la fenêtre
            refetchOnWindowFocus: false,
            // Refetch à la reconnexion
            refetchOnReconnect: true,
        },
        mutations: {
            // Retry pour les mutations en cas d'erreur réseau
            retry: 1,
        },
    },
});
