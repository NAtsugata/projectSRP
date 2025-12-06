// =============================
// FILE: src/App.js — REFACTORISÉ (Containers + React Query)
// =============================
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
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
import OfflineIndicator from './components/OfflineIndicator';
import MobileIndicators from './components/mobile/MobileIndicators';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import './App.css';
import AppLayout from './components/layout/AppLayout';

// Lazy loading des Containers
// Lazy loading des Containers
const AdminDashboardContainer = lazy(() => import('./pages/AdminDashboardContainer'));
const AdminPlanningViewContainer = lazy(() => import('./pages/AdminPlanningViewContainer'));
const AdminLeaveViewContainer = lazy(() => import('./pages/AdminLeaveViewContainer'));
const AdminUserViewContainer = lazy(() => import('./pages/AdminUserViewContainer'));
const AdminVaultViewContainer = lazy(() => import('./pages/AdminVaultViewContainer'));
const AdminArchiveViewContainer = lazy(() => import('./pages/AdminArchiveViewContainer'));
const AdminExpensesViewContainer = lazy(() => import('./pages/AdminExpensesViewContainer'));
const AdminChecklistTemplatesViewContainer = lazy(() => import('./pages/AdminChecklistTemplatesViewContainer'));

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



// --- Application principale ---
function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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
    console.log('✅ alert() remplacé par des toasts');
  }, [showToast]);

  useEffect(() => {
    const {
      data: { subscription }
    } = authService.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync with Zustand store
  const { setUser, setProfile: setStoreProfile, setLoading: setStoreLoading } = useAuthStore();

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
      profileService
        .getProfile(session.user.id)
        .then(({ data: userProfile, error }) => {
          if (error) {
            showToast('Impossible de récupérer le profil.', 'error');
            authService.signOut();
          } else {
            setProfile(userProfile);
          }
        })
        .finally(() => {
          setLoading(false);
        });
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
          console.log('🔄 Invalidation React Query:', keys);
          queryClient.invalidateQueries(keys);
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
        .subscribe();

      return () => {
        invalidateDebounced.cancel();
        supabase.removeChannel(sub);
      };
    }
  }, [profile, queryClient]);

  const handleLogout = async () => {
    await authService.signOut();
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
        <Routes>
          {!session || !profile ? (
            <Route path="*" element={<LoginScreen />} />
          ) : (
            <Route path="/" element={<AppLayout profile={profile} handleLogout={handleLogout} />}>
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
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <InterventionDetailViewContainer />
                    </Suspense>
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
                  <Route path="ir-docs" element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <IRShowerFormsViewContainer />
                    </Suspense>
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
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <InterventionDetailViewContainer />
                    </Suspense>
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
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <IRShowerFormsViewContainer />
                    </Suspense>
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
                  <Route path="*" element={<Navigate to="/planning" replace />} />
                </>
              )}
            </Route>
          )}
        </Routes>

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
