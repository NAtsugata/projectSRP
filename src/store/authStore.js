import { create } from 'zustand';
import { authService, profileService } from '../lib/supabase';

// Store Zustand pour l'authentification
export const useAuthStore = create((set, get) => ({
    // État
    user: null,
    profile: null,
    loading: true,
    error: null,

    // Actions
    setUser: (user) => set({ user }),

    setProfile: (profile) => set({ profile }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    // Initialiser la session
    initializeAuth: async () => {
        try {
            set({ loading: true, error: null });

            const { data: { session }, error: sessionError } = await authService.getSession();

            if (sessionError) throw sessionError;

            if (session?.user) {
                set({ user: session.user });

                // Charger le profil
                const profile = await profileService.getProfile(session.user.id);
                set({ profile, loading: false });
            } else {
                set({ user: null, profile: null, loading: false });
            }
        } catch (error) {
            console.error('Error initializing auth:', error);
            set({ error: error.message, loading: false });
        }
    },

    // Connexion
    login: async (email, password) => {
        try {
            set({ loading: true, error: null });

            const { data, error } = await authService.signIn(email, password);

            if (error) throw error;

            if (data?.user) {
                set({ user: data.user });

                // Charger le profil
                const profile = await profileService.getProfile(data.user.id);
                set({ profile, loading: false });

                return { success: true };
            }
        } catch (error) {
            console.error('Login error:', error);
            set({ error: error.message, loading: false });
            return { success: false, error: error.message };
        }
    },

    // Déconnexion
    logout: async () => {
        try {
            await authService.signOut();
            set({ user: null, profile: null, loading: false, error: null });
        } catch (error) {
            console.error('Logout error:', error);
            set({ error: error.message });
        }
    },

    // Rafraîchir le profil
    refreshProfile: async () => {
        const { user } = get();
        if (!user) return;

        try {
            const profile = await profileService.getProfile(user.id);
            set({ profile });
        } catch (error) {
            console.error('Error refreshing profile:', error);
        }
    },
}));
