// =============================
// FILE: src/App.js — REFACTORISÉ (Containers + React Query)
// =============================
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authService, profileService, supabase } from './lib/supabase';
import { Toast, ConfirmationModal } from './components/SharedUI';
import { ToastProvider } from './contexts/ToastContext';
import { useAuthStore } from './store/authStore';
import { DownloadProvider } from './contexts/DownloadContext';
import LoginScreen from './pages/LoginScreen';
import { useRealtimePushNotifications } from './hooks/usePushNotifications';
import { NotificationPermissionManager } from './components/mobile/NotificationPermissionPrompt';
import { debounce } from './utils/debounce';
import { setToastFunction, overrideAlert } from './utils/alertOverride';
import logger from './utils/logger';
import OfflineIndicator from './components/OfflineIndicator';
import MobileIndicators from './components/mobile/MobileIndicators';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import ConnectionStatusBanner from './components/ConnectionStatusBanner';
import { startConnectionMonitoring, onConnectionChange } from './utils/connectionMonitor';
import ErrorBoundary from './components/ErrorBoundary';
import SectionErrorBoundary from './components/SectionErrorBoundary';
import { PrivacyPolicyPage, LegalNoticePage, TermsOfServicePage } from './pages/LegalPages';
import PermissionRoute from './components/PermissionRoute';
import './App.css';
import AppLayout from './components/layout/AppLayout';

// Lazy loading des Containers
const AdminDashboardContainer = lazy(() => import('./pages/AdminDashboardContainer'));
const AdminPlanningViewContainer = lazy(() => import('./pages/AdminPlanningViewContainer'));
const AdminLeaveViewContainer = lazy(() => import('./pages/AdminLeaveViewContainer'));
const AdminUserViewContainer = lazy(() => import('./pages/AdminUserViewContainer'));
const AdminVaultViewContainer = lazy(() => import('./pages/AdminVaultViewContainer'));
const AdminArchiveViewContainer = lazy(() => import('./pages/AdminArchiveViewContainer'));
const AdminExpensesViewContainer = lazy(() => import('./pages/AdminExpensesViewContainer'));
const AdminChecklistTemplatesViewContainer = lazy(() => import('./pages/AdminChecklistTemplatesViewContainer'));
const AdminContractsViewContainer = lazy(() => import('./pages/AdminContractsViewContainer'));
const ContractDetailViewContainer = lazy(() => import('./pages/ContractDetailViewContainer'));
const AdminMonthlyExportViewContainer = lazy(() => import('./pages/AdminMonthlyExportViewContainer'));
const AdminEmployeeTrackingViewContainer = lazy(() => import('./pages/AdminEmployeeTrackingViewContainer'));
const AdminOrganizationsViewContainer = lazy(() => import('./pages/AdminOrganizationsViewContainer'));
const AdminClientsViewContainer = lazy(() => import('./pages/AdminClientsViewContainer'));
const AdminInvoicesViewContainer = lazy(() => import('./pages/AdminInvoicesViewContainer'));
const AdminCatalogViewContainer = lazy(() => import('./pages/AdminCatalogViewContainer'));
const QuoteEditorPage = lazy(() => import('./pages/QuoteEditorPage'));
const OrganizationSettingsPage = lazy(() => import('./pages/OrganizationSettingsPage'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));
const SmartPlanningManager = lazy(() => import('./components/SmartPlanningManager'));

const EmployeePlanningViewContainer = lazy(() => import('./pages/EmployeePlanningViewContainer'));
const EmployeeLeaveViewContainer = lazy(() => import('./pages/EmployeeLeaveViewContainer'));
const CoffreNumeriqueViewContainer = lazy(() => import('./pages/CoffreNumeriqueViewContainer'));
const AgendaViewContainer = lazy(() => import('./pages/AgendaViewContainer'));
const InterventionDetailViewContainer = lazy(() => import('./pages/InterventionDetailViewContainer'));
const IRShowerFormsViewContainer = lazy(() => import('./pages/IRShowerFormsViewContainer'));
const ExpensesViewContainer = lazy(() => import('./pages/ExpensesViewContainer'));
const ChecklistViewContainer = lazy(() => import('./pages/ChecklistViewContainer'));
const MyDocumentsViewContainer = lazy(() => import('./pages/MyDocumentsViewContainer'));
const MobileDiagnosticsPageContainer = lazy(() => import('./pages/MobileDiagnosticsPageContainer'));
const MobileMenu = lazy(() => import('./pages/MobileMenu'));
const CerfaManager = lazy(() => import('./pages/CerfaManager'));
const CerfaPage = lazy(() => import('./pages/CerfaPage'));
const CerfaPage15498 = lazy(() => import('./pages/CerfaPage15498'));
const CerfaPage1301 = lazy(() => import('./pages/CerfaPage1301'));
const CalculateurAidesView = lazy(() => import('./pages/CalculateurAidesView'));



// --- Application principale ---
function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileRef = useRef(profile);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ✅ Hook de notifications push en temps réel
  const pushNotifications = useRealtimePushNotifications(profile?.id);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const showConfirmationModal = useCallback((config) => setModal(config), []);

  // ✅ Override window.alert pour utiliser des toasts
  useEffect(() => {
    setToastFunction(showToast);
    overrideAlert();
    logger.log('alert() remplacé par des toasts');
  }, [showToast]);

  // Keep ref in sync so the connection callback always has the latest profile value
  useEffect(() => { profileRef.current = profile; }, [profile]);

  useEffect(() => {
    startConnectionMonitoring();

    const unsubscribe = onConnectionChange((isOnline) => {
      if (isOnline) {
        logger.log('[App] Connexion Supabase rétablie — reload des données');
        queryClient.invalidateQueries();
        if (session?.user && !profileRef.current) {
          profileService.getProfile(session.user.id)
            .then(({ data: userProfile, error }) => {
              if (!error && userProfile) setProfile(userProfile);
            })
            .catch(err => logger.error('[App] Erreur profil reconnexion:', err));
        }
      }
    });

    return unsubscribe;
  }, [queryClient, session]);

  // ✅ Vérifier session hors ligne au démarrage
  useEffect(() => {
    const checkOfflineSession = async () => {
      if (!navigator.onLine) {
        logger.log('📴 Mode hors ligne détecté - Vérification session cache');
        const result = await authService.getSession();
        if (result.data?.session && result.isOfflineMode) {
          logger.log('✅ Session hors ligne trouvée');
          setSession(result.data.session);
        }
      }
    };
    checkOfflineSession();
  }, []);

  useEffect(() => {
    const {
      data: { subscription }
    } = authService.onAuthStateChange((event, sessionData) => {
      // Token de refresh invalide (expiré pendant panne Supabase) — déconnecter proprement
      if (!sessionData && event === 'SIGNED_OUT' && profileRef.current) {
        logger.warn('[App] Session expirée (token invalide) — reconnexion requise');
        showToast('Votre session a expiré. Veuillez vous reconnecter.', 'warning');
        setProfile(null);
      }
      setSession(sessionData);
    });
    return () => subscription.unsubscribe();
  }, [showToast]);

  // Sync with Zustand store
  const { setUser, setProfile: setStoreProfile, setLoading: setStoreLoading, logout } = useAuthStore();

  useEffect(() => {
    setStoreLoading(loading);
    if (session?.user) {
      setUser(session.user);
    } else {
      setUser(null);
    }
    if (profile) {
      setStoreProfile(profile);
    } else {
      setStoreProfile(null);
    }
  }, [loading, session, profile, setUser, setStoreProfile, setStoreLoading]);

  useEffect(() => {
    if (session?.user) {
      setLoading(true);

      // Si hors ligne, charger depuis le cache
      if (!navigator.onLine) {
        logger.log('📴 [App] Mode hors ligne détecté - Chargement profil depuis cache');
        import('./services/offlineAuthService').then(({ getOfflineUserData }) => {
          getOfflineUserData()
            .then(cachedProfile => {
              if (cachedProfile) {
                logger.log('📴 [App] ✅ Profil chargé depuis le cache:', {
                  id: cachedProfile.id,
                  email: cachedProfile.email,
                  is_admin: cachedProfile.is_admin,
                  full_name: cachedProfile.full_name
                });
                setProfile(cachedProfile);
              } else {
                logger.warn('📴 [App] ❌ Profil non disponible en cache');
                showToast('Profil non disponible hors ligne. Reconnectez-vous en ligne une fois.', 'warning');
                setProfile(null);
              }
            })
            .catch(err => {
              logger.error('📴 [App] ❌ Erreur chargement profil hors ligne:', err);
              setProfile(null);
            })
            .finally(() => setLoading(false));
        });
      } else {
        // Mode en ligne : charger depuis Supabase
        profileService
          .getProfile(session.user.id)
          .then(({ data: userProfile, error }) => {
            if (error) {
              // Ne pas déconnecter l'utilisateur sur erreur réseau/Supabase temporaire
              // La connexion sera réessayée automatiquement par le ConnectionMonitor
              logger.warn('[App] Erreur chargement profil (probablement temporaire):', error.message);
              showToast('Connexion au serveur impossible. Nouvelle tentative automatique...', 'warning');
              setProfile(null);
            } else {
              setProfile(userProfile);
            }
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [session, showToast]);

  // ✅ Gestion des mises à jour temps réel via React Query Invalidation
  useEffect(() => {
    if (profile) {
      // Debounce pour éviter trop d'invalidations simultanées
      const invalidateDebounced = debounce(
        (keys) => {
          logger.log('Invalidation React Query:', keys);
          queryClient.invalidateQueries({ queryKey: keys });
        },
        1000,
        { leading: true, trailing: true }
      );

      const sub = supabase
        .channel('app-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          invalidateDebounced(['users']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => {
          invalidateDebounced(['interventions']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_assignments' }, () => {
          invalidateDebounced(['interventions']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          invalidateDebounced(['leaveRequests']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_documents' }, () => {
          invalidateDebounced(['vault']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          invalidateDebounced(['expenses']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, () => {
          invalidateDebounced(['checklists']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_contracts' }, () => {
          invalidateDebounced(['contracts']);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_visits' }, () => {
          invalidateDebounced(['contracts', 'contractVisits']);
        })
        .subscribe();

      return () => {
        invalidateDebounced.cancel();
        supabase.removeChannel(sub);
      };
    }
  }, [profile, queryClient]);

  const handleLogout = async () => {
    // Utiliser la fonction logout du store pour nettoyer l'état
    await logout();
    // Réinitialiser l'état local aussi
    setSession(null);
    setProfile(null);
    // Naviguer vers login
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Chargement de votre espace...</p>
      </div>
    );
  }

  return (
    <DownloadProvider>
      <ToastProvider>
        <ConnectionStatusBanner />
        <OfflineIndicator />
        <PWAInstallPrompt />


        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        {modal && (
          <ConfirmationModal
            {...modal}
            onConfirm={(inputValue) => {
              modal.onConfirm(inputValue);
              setModal(null);
            }}
            onCancel={() => setModal(null)}
          />
        )}
        <ErrorBoundary>
        <Routes>
          {/* Pages légales accessibles sans authentification */}
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/legal-notice" element={<LegalNoticePage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />

          {!session || !profile ? (
            <>
              {/* Log pour débogage */}
              {logger.log('[App] 🚫 Accès bloqué - Redirection vers LoginScreen', {
                hasSession: !!session,
                hasProfile: !!profile,
                isOffline: !navigator.onLine
              })}
              <Route path="*" element={<LoginScreen />} />
            </>
          ) : (
            <Route path="/" element={<AppLayout profile={profile} handleLogout={handleLogout} lastNotification={pushNotifications.lastNotification} />}>
              {profile.is_admin ? (
                <>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminDashboardContainer />
                    </Suspense>
                  } />
                  <Route path="agenda" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AgendaViewContainer />
                    </Suspense>
                  } />
                  <Route
                    path="planning"
                    element={
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminPlanningViewContainer />
                      </Suspense>
                    }
                  />
                  <Route path="planning/:interventionId" element={
                    <SectionErrorBoundary section="intervention-detail" title="Erreur intervention">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <InterventionDetailViewContainer />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="archives" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminArchiveViewContainer showToast={showToast} showConfirmationModal={showConfirmationModal} />
                    </Suspense>
                  } />
                  <Route
                    path="leaves"
                    element={
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminLeaveViewContainer />
                      </Suspense>
                    }
                  />
                  <Route path="users" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminUserViewContainer />
                    </Suspense>
                  } />
                  <Route
                    path="vault"
                    element={
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminVaultViewContainer showToast={showToast} showConfirmationModal={showConfirmationModal} />
                      </Suspense>
                    }
                  />
                  <Route path="documents" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <MyDocumentsViewContainer />
                    </Suspense>
                  } />
                  <Route path="checklist-templates" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminChecklistTemplatesViewContainer showToast={showToast} />
                    </Suspense>
                  } />
                  <Route path="expenses" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminExpensesViewContainer showConfirmationModal={showConfirmationModal} />
                    </Suspense>
                  } />
                  <Route path="monthly-export" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminMonthlyExportViewContainer />
                    </Suspense>
                  } />
                  <Route path="employee-tracking" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminEmployeeTrackingViewContainer />
                    </Suspense>
                  } />
                  <Route path="contracts" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminContractsViewContainer />
                    </Suspense>
                  } />
                  <Route path="contracts/:contractId" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <ContractDetailViewContainer />
                    </Suspense>
                  } />
                  <Route path="organizations" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminOrganizationsViewContainer />
                    </Suspense>
                  } />
                  <Route path="clients" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminClientsViewContainer />
                    </Suspense>
                  } />
                  <Route path="invoices" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminInvoicesViewContainer />
                    </Suspense>
                  } />
                  <Route path="quotes/new" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <QuoteEditorPage />
                    </Suspense>
                  } />
                  <Route path="quotes/:id" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <QuoteEditorPage />
                    </Suspense>
                  } />
                  <Route path="catalog" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminCatalogViewContainer />
                    </Suspense>
                  } />
                  <Route path="multi-day-planning" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <SmartPlanningManager />
                    </Suspense>
                  } />
                  <Route path="settings" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <OrganizationSettingsPage />
                    </Suspense>
                  } />
                  <Route path="company-settings" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CompanySettings />
                    </Suspense>
                  } />
                  <Route path="ir-docs" element={
                    <SectionErrorBoundary section="ir-docs" title="Erreur documents IR">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <IRShowerFormsViewContainer />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="mobile-diagnostics" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <MobileDiagnosticsPageContainer />
                    </Suspense>
                  } />
                  <Route path="menu" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <MobileMenu />
                    </Suspense>
                  } />
                  <Route path="cerfa" element={
                    <SectionErrorBoundary section="cerfa" title="Erreur CERFA">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaManager />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="cerfa-form" element={
                    <SectionErrorBoundary section="cerfa-form" title="Erreur formulaire CERFA">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaPage />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="cerfa-form-15498" element={
                    <SectionErrorBoundary section="cerfa-form-15498" title="Erreur formulaire CERFA 15498">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaPage15498 />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="cerfa-form-1301" element={
                    <SectionErrorBoundary section="cerfa-form-1301" title="Erreur formulaire CERFA 1301">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaPage1301 />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="calculateur-aides" element={
                    <SectionErrorBoundary section="calculateur-aides" title="Erreur calculateur">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CalculateurAidesView />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </>
              ) : (
                <>
                  <Route index element={<Navigate to="/planning" replace />} />
                  <Route path="planning" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <EmployeePlanningViewContainer />
                    </Suspense>
                  } />
                  <Route path="planning/:interventionId" element={
                    <SectionErrorBoundary section="intervention-detail" title="Erreur intervention">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <InterventionDetailViewContainer />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="agenda" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AgendaViewContainer />
                    </Suspense>
                  } />
                  <Route
                    path="leaves"
                    element={
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <EmployeeLeaveViewContainer />
                      </Suspense>
                    }
                  />
                  <Route path="vault" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CoffreNumeriqueViewContainer />
                    </Suspense>
                  } />
                  <Route path="documents" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <MyDocumentsViewContainer />
                    </Suspense>
                  } />
                  <Route path="checklists" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <ChecklistViewContainer />
                    </Suspense>
                  } />
                  <Route path="expenses" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <ExpensesViewContainer />
                    </Suspense>
                  } />
                  <Route path="ir-docs" element={
                    <SectionErrorBoundary section="ir-docs" title="Erreur documents IR">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <IRShowerFormsViewContainer />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="mobile-diagnostics" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <MobileDiagnosticsPageContainer />
                    </Suspense>
                  } />
                  <Route path="menu" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <MobileMenu />
                    </Suspense>
                  } />
                  <Route path="cerfa" element={
                    <SectionErrorBoundary section="cerfa" title="Erreur CERFA">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaManager />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="cerfa-form" element={
                    <SectionErrorBoundary section="cerfa-form" title="Erreur formulaire CERFA">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaPage />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="cerfa-form-15498" element={
                    <SectionErrorBoundary section="cerfa-form-15498" title="Erreur formulaire CERFA 15498">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaPage15498 />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="cerfa-form-1301" element={
                    <SectionErrorBoundary section="cerfa-form-1301" title="Erreur formulaire CERFA 1301">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CerfaPage1301 />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />
                  <Route path="calculateur-aides" element={
                    <SectionErrorBoundary section="calculateur-aides" title="Erreur calculateur">
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <CalculateurAidesView />
                    </Suspense>
                    </SectionErrorBoundary>
                  } />

                  {/* Routes protegees par permissions pour employes */}
                  <Route path="dashboard" element={
                    <PermissionRoute permission="view_reports">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminDashboardContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="clients" element={
                    <PermissionRoute permission="manage_clients">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminClientsViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="contracts" element={
                    <PermissionRoute permission="view_contracts">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminContractsViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="contracts/:contractId" element={
                    <PermissionRoute permission="view_contracts">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <ContractDetailViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="invoices" element={
                    <PermissionRoute permission="view_invoices">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminInvoicesViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="catalog" element={
                    <PermissionRoute permission="access_catalog">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminCatalogViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="admin-vault" element={
                    <PermissionRoute permission="access_admin_vault">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminVaultViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="archives" element={
                    <PermissionRoute permission="view_all_interventions">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminArchiveViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="checklist-templates" element={
                    <PermissionRoute permission="manage_checklist_templates">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminChecklistTemplatesViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="admin-expenses" element={
                    <PermissionRoute permission="approve_expenses">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminExpensesViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />
                  <Route path="admin-leaves" element={
                    <PermissionRoute permission="approve_leave_requests">
                      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                        <AdminLeaveViewContainer />
                      </Suspense>
                    </PermissionRoute>
                  } />

                  <Route path="*" element={<Navigate to="/planning" replace />} />
                </>
              )}
            </Route>
          )}
        </Routes>
        </ErrorBoundary>

        {/* ✅ Gestionnaire de notifications push pour tous les utilisateurs */}
        {profile && (
          <NotificationPermissionManager
            userId={profile.id}
            pushNotifications={pushNotifications}
          />
        )}
        <MobileIndicators />
      </ToastProvider>
    </DownloadProvider>
  );
}

export default App;
