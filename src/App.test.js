import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// ✅ Mock simple et fonctionnel
jest.mock('./lib/supabase', () => {
  // Créer une fonction simple pour le mock
  const createMockAuthStateChange = () => (callback) => {
    setTimeout(() => callback('SIGNED_OUT', null), 10);
    return { data: { subscription: { unsubscribe: () => {} } } };
  };

  const mockAuthStateChange = createMockAuthStateChange();

  return {
    supabase: {
      auth: {
        onAuthStateChange: mockAuthStateChange
      },
      channel: jest.fn(() => ({
        on: jest.fn(() => ({ subscribe: jest.fn() }))
      })),
      removeChannel: jest.fn(),
    },
    authService: {
      onAuthStateChange: mockAuthStateChange,
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
  };
});

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
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Vérifier que l'écran de connexion s'affiche
    await waitFor(() => {
      const loginScreen = container.querySelector('.login-screen-container');
      expect(loginScreen).toBeInTheDocument();
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

    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Vérifier que l'écran de connexion s'affiche
    await waitFor(() => {
      const loginScreen = container.querySelector('.login-screen-container');
      expect(loginScreen).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(window.innerWidth).toBe(480);
  });
});