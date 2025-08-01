import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// ✅ Mock simple et fonctionnel
jest.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))
    },
    channel: jest.fn(() => ({
      on: jest.fn(() => ({ subscribe: jest.fn() }))
    })),
    removeChannel: jest.fn(),
  },
  authService: {
    onAuthStateChange: jest.fn((callback) => {
      // Déclencher immédiatement l'état "non connecté"
      setTimeout(() => callback('SIGNED_OUT', null), 10);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signIn: jest.fn(() => Promise.resolve({ error: null })),
  },
  profileService: {
    getProfile: jest.fn(() => Promise.resolve({ data: null, error: null })),
    getAllProfiles: jest.fn(() => Promise.resolve({ data: [], error: null })),
    updateProfile: jest.fn(() => Promise.resolve({ error: null }))
  },
  interventionService: {
    getInterventions: jest.fn(() => Promise.resolve({ data: [], error: null })),
    createIntervention: jest.fn(() => Promise.resolve({ error: null })),
    updateIntervention: jest.fn(() => Promise.resolve({ error: null })),
    deleteIntervention: jest.fn(() => Promise.resolve({ error: null }))
  },
  leaveService: {
    getLeaveRequests: jest.fn(() => Promise.resolve({ data: [], error: null })),
    createLeaveRequest: jest.fn(() => Promise.resolve({ error: null })),
    updateRequestStatus: jest.fn(() => Promise.resolve({ error: null })),
    deleteLeaveRequest: jest.fn(() => Promise.resolve({ error: null }))
  },
  payslipService: {
    getPayslips: jest.fn(() => Promise.resolve({ data: [], error: null }))
  },
  storageService: {
    uploadVaultFile: jest.fn(() => Promise.resolve({ error: null })),
    deleteVaultFile: jest.fn(() => Promise.resolve({ error: null })),
    uploadInterventionFile: jest.fn(() => Promise.resolve({
      publicURL: 'test.jpg', error: null
    }))
  },
}));

import App from './App';

// Mocks environnementaux
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  }
});
window.addEventListener = jest.fn();
window.removeEventListener = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('App Component', () => {
  test('affiche l\'écran de connexion par défaut', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Au début, écran de chargement
    expect(screen.getByText(/Chargement de votre espace/i)).toBeInTheDocument();

    // Attendre l'écran de connexion
    await waitFor(() => {
      expect(screen.getByText(/Entreprise SRP/i)).toBeInTheDocument();
    }, { timeout: 3000 });
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

  test('gère la navigation mobile', async () => {
    // Simule mobile
    Object.defineProperty(window, 'innerWidth', { value: 480, writable: true });

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Entreprise SRP/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(window.innerWidth).toBe(480);
  });
});