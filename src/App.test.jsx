import { describe, test, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock supabaseClient first (deepest dependency)
vi.mock('./lib/supabaseClient', () => ({
    supabase: {
        auth: {
            onAuthStateChange: vi.fn((callback) => {
                setTimeout(() => callback('SIGNED_OUT', null), 10);
                return { data: { subscription: { unsubscribe: vi.fn() } } };
            }),
            getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
        },
        channel: vi.fn(() => ({
            on: vi.fn(function () { return this; }),
            subscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
    },
}));

// Mock supabase barrel export
vi.mock('./lib/supabase', () => ({
    supabase: {
        auth: {
            onAuthStateChange: vi.fn((callback) => {
                setTimeout(() => callback('SIGNED_OUT', null), 10);
                return { data: { subscription: { unsubscribe: vi.fn() } } };
            }),
        },
        channel: vi.fn(() => ({
            on: vi.fn(function () { return this; }),
            subscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    },
    authService: {
        onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    profileService: {
        getProfile: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    interventionService: {
        getInterventions: vi.fn(() => Promise.resolve({ data: [], error: null })),
    },
}));

// Mock hooks that rely on Supabase
vi.mock('./hooks/usePushNotifications', () => ({
    useRealtimePushNotifications: vi.fn(() => ({ lastNotification: null })),
}));

vi.mock('./utils/alertOverride', () => ({
    setToastFunction: vi.fn(),
    overrideAlert: vi.fn(),
}));

vi.mock('./utils/debounce', () => ({
    debounce: vi.fn((fn) => {
        const debounced = (...args) => fn(...args);
        debounced.cancel = vi.fn();
        return debounced;
    }),
}));

vi.mock('./store/authStore', () => ({
    useAuthStore: vi.fn(() => ({
        setUser: vi.fn(),
        setProfile: vi.fn(),
        setLoading: vi.fn(),
        logout: vi.fn(),
    })),
}));

vi.mock('./contexts/DownloadContext', () => ({
    DownloadProvider: ({ children }) => children,
}));

vi.mock('./contexts/ToastContext', () => ({
    ToastProvider: ({ children }) => children,
}));

vi.mock('./components/OfflineIndicator', () => ({
    default: () => null,
}));

vi.mock('./components/mobile/MobileIndicators', () => ({
    default: () => null,
}));

vi.mock('./components/pwa/PWAInstallPrompt', () => ({
    default: () => null,
}));

vi.mock('./components/mobile/NotificationPermissionPrompt', () => ({
    NotificationPermissionManager: () => null,
}));

vi.mock('./components/layout/AppLayout', () => ({
    default: ({ children }) => children,
}));

// Mock React Query
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn(),
    })),
    QueryClient: vi.fn(() => ({})),
    QueryClientProvider: ({ children }) => children,
}));

const { default: App } = await import('./App');

describe('App Component', () => {
    test('affiche l\'écran de connexion par défaut', async () => {
        const { container } = render(
            <BrowserRouter>
                <App />
            </BrowserRouter>
        );

        await waitFor(
            () => {
                const loginScreen = container.querySelector('.login-screen-container');
                expect(loginScreen).toBeInTheDocument();
            },
            { timeout: 3000 }
        );
    });

    test('application ne crash pas', () => {
        expect(() => {
            render(
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            );
        }).not.toThrow();
    });
});
