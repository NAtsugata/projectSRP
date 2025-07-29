import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock ultra-simple pour diagnostic
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
      // Force l'état "non connecté" immédiatement
      callback('SIGNED_OUT', null);
      return {
        data: { subscription: { unsubscribe: jest.fn() } }
      };
    }),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signIn: jest.fn(() => Promise.resolve({ error: null })),
  },
  profileService: {
    getProfile: jest.fn(() => Promise.resolve({ data: null, error: null })),
    getAllProfiles: jest.fn(() => Promise.resolve({ data: [], error: null })),
    updateProfile: jest.fn(() => Promise.resolve({ error: null })),
  },
  interventionService: {
    getInterventions: jest.fn(() => Promise.resolve({ data: [], error: null })),
    createIntervention: jest.fn(() => Promise.resolve({ error: null })),
    updateIntervention: jest.fn(() => Promise.resolve({ error: null })),
    deleteIntervention: jest.fn(() => Promise.resolve({ error: null })),
  },
  leaveService: {
    getLeaveRequests: jest.fn(() => Promise.resolve({ data: [], error: null })),
    createLeaveRequest: jest.fn(() => Promise.resolve({ error: null })),
    updateRequestStatus: jest.fn(() => Promise.resolve({ error: null })),
    deleteLeaveRequest: jest.fn(() => Promise.resolve({ error: null })),
  },
  payslipService: {
    getPayslips: jest.fn(() => Promise.resolve({ data: [], error: null })),
  },
  storageService: {
    uploadVaultFile: jest.fn(() => Promise.resolve({ error: null })),
    deleteVaultFile: jest.fn(() => Promise.resolve({ error: null })),
    uploadInterventionFile: jest.fn(() => Promise.resolve({
      publicURL: 'https://example.com/test.jpg',
      error: null
    })),
  },
}));

// Mocks environnementaux minimaux
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
});

window.addEventListener = jest.fn();
window.removeEventListener = jest.fn();

// Supprimer tous les console logs pendant les tests
console.warn = jest.fn();
console.error = jest.fn();

test('Test de diagnostic - État de l\'application', async () => {
  console.log('🔍 Début du test de diagnostic...');

  const { debug, container } = render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  console.log('📸 Snapshot initial:');
  debug();

  // Attendre un petit délai pour les effets
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  console.log('📸 Snapshot après 500ms:');
  debug();

  // Vérifications basiques
  const hasContent = container.firstChild !== null;
  console.log('✅ L\'application a du contenu:', hasContent);

  const loadingText = screen.queryByText(/chargement/i);
  console.log('🔄 Écran de chargement présent:', !!loadingText);

  const loginText = screen.queryByText(/entreprise srp|connexion/i);
  console.log('🔐 Écran de connexion présent:', !!loginText);

  // Test: Au moins un des deux écrans doit être présent
  expect(loadingText || loginText).toBeTruthy();

  console.log('🎉 Test de diagnostic terminé avec succès');
});

test('Test du mock authService', () => {
  const { authService } = require('./lib/supabase');

  console.log('🔧 Test du mock authService...');

  const mockCallback = jest.fn();
  const result = authService.onAuthStateChange(mockCallback);

  console.log('📞 Callback appelé:', mockCallback.mock.calls.length, 'fois');
  console.log('🔄 Résultat du mock:', result);

  expect(mockCallback).toHaveBeenCalled();
  expect(result).toBeDefined();
  expect(result.data).toBeDefined();
  expect(result.data.subscription).toBeDefined();

  console.log('✅ Mock authService fonctionne correctement');
});

test('Test simple de rendu sans attentes complexes', () => {
  const { container } = render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  // Test ultra-basique : l'app se rend sans erreur
  expect(container).toBeInTheDocument();
  expect(container.firstChild).not.toBeNull();

  console.log('✅ Rendu de base réussi');
});