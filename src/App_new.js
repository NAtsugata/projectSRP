// =============================
// FILE: src/App.js — REFACTORISÉ
// Version simplifiée utilisant AppLayout et les hooks personnalisés
// =============================
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './contexts/ToastContext';
import LoginScreen from './pages/LoginScreen';
import AppLayout from './components/layout/AppLayout';
import { setToastFunction, overrideAlert } from './utils/alertOverride';
import OfflineIndicator from './components/OfflineIndicator';
import { Suspense, lazy } from 'react';
import './App.css';

// Lazy loading des pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminPlanningView = lazy(() => import('./pages/AdminPlanningView'));
const AdminLeaveView = lazy(() => import('./pages/AdminLeaveView'));
const AdminUserView = lazy(() => import('./pages/AdminUserView'));
const AdminVaultView = lazy(() => import('./pages/AdminVaultView'));
const AdminArchiveView = lazy(() => import('./pages/AdminArchiveView'));
const EmployeePlanningView = lazy(() => import('./pages/EmployeePlanningView'));
const EmployeeLeaveView = lazy(() => import('./pages/EmployeeLeaveView'));
const CoffreNumeriqueView = lazy(() => import('./pages/CoffreNumeriqueView'));
const AgendaView = lazy(() => import('./pages/AgendaView'));
const InterventionDetailView = lazy(() => import('./pages/InterventionDetailView'));
const IRShowerFormsView = lazy(() => import('./pages/IRShowerFormsView'));
const ExpensesView = lazy(() => import('./pages/ExpensesView'));
const AdminExpensesView = lazy(() => import('./pages/AdminExpensesView'));
const ChecklistView = lazy(() => import('./pages/ChecklistView'));
const AdminChecklistTemplatesView = lazy(() => import('./pages/AdminChecklistTemplatesView'));
const MyDocumentsView = lazy(() => import('./pages/MyDocumentsView'));
const MobileDiagnosticsPage = lazy(() => import('./pages/MobileDiagnosticsPage'));

// Composant de chargement
const LoadingFallback = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Chargement...</div>
    </div>
);

// Routes protégées
const ProtectedRoute = ({ children, requireAdmin = false }) => {
    const { user, profile, loading } = useAuthStore();

    if (loading) return <LoadingFallback />;
    if (!user) return <Navigate to="/login" replace />;
    if (requireAdmin && !profile?.is_admin) return <Navigate to="/planning" replace />;

    return children;
};

function App() {
    const { user, profile, loading, initializeAuth, logout } = useAuthStore();

    // Initialiser l'authentification au montage
    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    // Override alert pour utiliser des toasts
    useEffect(() => {
        const showToast = (message, type = 'success') => {
            // TODO: Implémenter avec ToastContext
            console.log(`Toast: ${message} (${type})`);
        };
        setToastFunction(showToast);
        overrideAlert();
    }, []);

    // Afficher le loading pendant l'initialisation
    if (loading) {
        return <LoadingFallback />;
    }

    // Afficher l'écran de connexion si pas authentifié
    if (!user) {
        return <LoginScreen />;
    }

    // Routes de l'application
    return (
        <ToastProvider>
            <OfflineIndicator />
            <Routes>
                {/* Layout avec navigation */}
                <Route element={<AppLayout profile={profile} handleLogout={logout} />}>
                    {/* Routes Admin */}
                    {profile?.is_admin && (
                        <>
                            <Route path="/dashboard" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminDashboard />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/users" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminUserView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/archives" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminArchiveView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/planning" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminPlanningView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/leaves" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminLeaveView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/expenses" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminExpensesView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/checklist-templates" element={
                                <ProtectedRoute requireAdmin>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <AdminChecklistTemplatesView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                        </>
                    )}

                    {/* Routes Employé */}
                    {!profile?.is_admin && (
                        <>
                            <Route path="/planning" element={
                                <ProtectedRoute>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <EmployeePlanningView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/leaves" element={
                                <ProtectedRoute>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <EmployeeLeaveView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/expenses" element={
                                <ProtectedRoute>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <ExpensesView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                            <Route path="/checklists" element={
                                <ProtectedRoute>
                                    <Suspense fallback={<LoadingFallback />}>
                                        <ChecklistView />
                                    </Suspense>
                                </ProtectedRoute>
                            } />
                        </>
                    )}

                    {/* Routes communes */}
                    <Route path="/agenda" element={
                        <ProtectedRoute>
                            <Suspense fallback={<LoadingFallback />}>
                                <AgendaView />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/vault" element={
                        <ProtectedRoute>
                            <Suspense fallback={<LoadingFallback />}>
                                {profile?.is_admin ? <AdminVaultView /> : <CoffreNumeriqueView />}
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/documents" element={
                        <ProtectedRoute>
                            <Suspense fallback={<LoadingFallback />}>
                                <MyDocumentsView />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/ir-docs" element={
                        <ProtectedRoute>
                            <Suspense fallback={<LoadingFallback />}>
                                <IRShowerFormsView />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/intervention/:id" element={
                        <ProtectedRoute>
                            <Suspense fallback={<LoadingFallback />}>
                                <InterventionDetailView />
                            </Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/diagnostics" element={
                        <ProtectedRoute>
                            <Suspense fallback={<LoadingFallback />}>
                                <MobileDiagnosticsPage />
                            </Suspense>
                        </ProtectedRoute>
                    } />

                    {/* Redirection par défaut */}
                    <Route path="/" element={
                        <Navigate to={profile?.is_admin ? "/dashboard" : "/planning"} replace />
                    } />
                </Route>

                {/* Route de connexion */}
                <Route path="/login" element={<LoginScreen />} />
            </Routes>
        </ToastProvider>
    );
}

export default App;
