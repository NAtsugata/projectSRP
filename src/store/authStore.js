import { create } from 'zustand';
import { authService, profileService } from '../lib/supabase';
import { organizationService } from '../services/organizationService';
import logger from '../utils/logger';
import { authRateLimiter } from '../utils/rateLimiter';
import { safeStorage } from '../utils/safeStorage';

function syncOrgToCerfaStorage(org) {
    if (!org) return;
    const existing = safeStorage.getJSON('cerfa_company_info', {});
    safeStorage.setJSON('cerfa_company_info', {
        ...existing,
        companyName: org.name || existing.companyName || '',
        siret:       org.siret   || existing.siret   || '',
        address:     org.address || existing.address || '',
        phone:       org.phone   || existing.phone   || '',
        email:       org.email   || existing.email   || '',
    });
}

// Store Zustand pour l'authentification
export const useAuthStore = create((set, get) => ({
    // État
    user: null,
    profile: null,
    organization: null,   // Organisation courante
    orgRole: null,         // Rôle dans l'organisation ('owner', 'admin', 'manager', 'technician')
    loading: true,
    error: null,

    // Actions
    setUser: (user) => set({ user }),

    setProfile: (profile) => set({ profile }),

    setLoading: (loading) => set({ loading }),

    setError: (error) => set({ error }),

    // Charger l'organisation et le rôle
    loadOrganization: async (profile) => {
        if (!profile?.organization_id) return;
        try {
            const [orgResult, roleResult] = await Promise.all([
                organizationService.getCurrentOrganization(profile.organization_id),
                organizationService.getUserRole(profile.id, profile.organization_id),
            ]);
            set({
                organization: orgResult.data,
                orgRole: roleResult.data?.role || (profile.is_admin ? 'admin' : 'technician'),
            });
            syncOrgToCerfaStorage(orgResult.data);
        } catch (error) {
            logger.error('Error loading organization:', error);
        }
    },

    // Initialiser la session
    initializeAuth: async () => {
        try {
            set({ loading: true, error: null });

            const { data: { session }, error: sessionError } = await authService.getSession();

            if (sessionError) throw sessionError;

            if (session?.user) {
                set({ user: session.user });

                const { data: profile } = await profileService.getProfile(session.user.id);
                set({ profile, loading: false });

                // Charger l'organisation en arrière-plan
                get().loadOrganization(profile);
            } else {
                set({ user: null, profile: null, organization: null, orgRole: null, loading: false });
            }
        } catch (error) {
            logger.error('Error initializing auth:', error);
            set({ error: error.message, loading: false });
        }
    },

    // Connexion
    login: async (email, password) => {
        try {
            set({ loading: true, error: null });

            // Rate limiting : max 5 tentatives par minute
            const { allowed, retryAfterMs } = authRateLimiter.check('login');
            if (!allowed) {
                const seconds = Math.ceil(retryAfterMs / 1000);
                throw new Error(`Trop de tentatives. Réessayez dans ${seconds}s.`);
            }

            const { data, error } = await authService.signIn(email, password);

            if (error) throw error;

            if (data?.user) {
                set({ user: data.user });

                const { data: profile } = await profileService.getProfile(data.user.id);
                set({ profile, loading: false });

                // Charger l'organisation en arrière-plan
                get().loadOrganization(profile);

                return { success: true };
            }
        } catch (error) {
            logger.error('Login error:', error);
            set({ error: error.message, loading: false });
            return { success: false, error: error.message };
        }
    },

    // Déconnexion
    logout: async () => {
        try {
            await authService.signOut();
            set({ user: null, profile: null, organization: null, orgRole: null, loading: false, error: null });
        } catch (error) {
            logger.error('Logout error:', error);
            set({ error: error.message });
        }
    },

    // Rafraîchir le profil
    refreshProfile: async () => {
        const { user } = get();
        if (!user) return;

        try {
            const { data: profile } = await profileService.getProfile(user.id);
            set({ profile });
            get().loadOrganization(profile);
        } catch (error) {
            logger.error('Error refreshing profile:', error);
        }
    },
}));
