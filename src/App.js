import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, Outlet } from 'react-router-dom';
// CORRIGÉ: On importe bien 'storageService' qui était manquant
import { authService, profileService, interventionService, leaveService, vaultService, storageService, supabase } from './lib/supabase';
import './App.css';

// Import des pages
import LoginScreen from './pages/LoginScreen';
import AdminDashboard from './pages/AdminDashboard';
import AdminPlanningView from './pages/AdminPlanningView';
import AdminLeaveView from './pages/AdminLeaveView';
import AdminUserView from './pages/AdminUserView';
import AdminVaultView from './pages/AdminVaultView';
import AdminArchiveView from './pages/AdminArchiveView';
import EmployeePlanningView from './pages/EmployeePlanningView';
import EmployeeLeaveView from './pages/EmployeeLeaveView';
import CoffreNumeriqueView from './pages/CoffreNumeriqueView';
import AgendaView from './pages/AgendaView';
import InterventionDetailView from './pages/InterventionDetailView';

// Import des composants UI partagés
import { Toast, ConfirmationModal } from './components/SharedUI';
import { UserIcon, LogOutIcon, LayoutDashboardIcon, CalendarIcon, BriefcaseIcon, ArchiveIcon, SunIcon, UsersIcon, FolderIcon, LockIcon } from './components/SharedUI';

// ✅ NOUVEAU : Hook pour détecter les appareils mobiles
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
            const isSmallScreen = window.innerWidth <= 768;
            setIsMobile(isMobileAgent || isSmallScreen);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    return isMobile;
};

// ✅ NOUVEAU : Composant de chargement progressif mobile
const MobileLoadingIndicator = ({ loadingState, isMobile, isAdmin }) => {
    if (!isMobile || !isAdmin) return null;

    const steps = [
        { key: 'interventions', label: 'Interventions', priority: 1 },
        { key: 'users', label: 'Utilisateurs', priority: 2 },
        { key: 'leaves', label: 'Congés', priority: 3 },
        { key: 'vault', label: 'Documents', priority: 4 }
    ];

    const allLoaded = Object.values(loadingState).every(state => state === 'loaded');

    if (allLoaded) return null;

    return (
        <div className="mobile-loading-overlay">
            <div className="mobile-loading-content">
                <div className="loading-spinner"></div>
                <h3>Chargement optimisé mobile</h3>
                <div className="loading-steps">
                    {steps.map((step) => (
                        <div key={step.key} className={`loading-step ${loadingState[step.key] || 'idle'}`}>
                            <div className="step-indicator">
                                {loadingState[step.key] === 'loaded' && '✅'}
                                {loadingState[step.key] === 'loading' && '⏳'}
                                {(loadingState[step.key] === 'idle' || !loadingState[step.key]) && '⭕'}
                                {loadingState[step.key] === 'error' && '❌'}
                            </div>
                            <span>{step.label}</span>
                        </div>
                    ))}
                </div>
                <p className="loading-tip">
                    💡 Premier chargement optimisé pour mobile admin
                </p>
            </div>
        </div>
    );
};

// --- Composant de Layout (structure de la page) ---
const AppLayout = ({ profile, handleLogout }) => {
    const navItems = profile.is_admin ?
        [{ id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboardIcon /> }, {id: 'agenda', label: 'Agenda', icon: <CalendarIcon/>}, { id: 'planning', label: 'Planning', icon: <BriefcaseIcon /> }, { id: 'archives', label: 'Archives', icon: <ArchiveIcon /> }, { id: 'leaves', label: 'Congés', icon: <SunIcon /> }, { id: 'users', label: 'Employés', icon: <UsersIcon /> }, { id: 'vault', label: 'Coffre-fort', icon: <FolderIcon /> }] :
        [{ id: 'planning', label: 'Planning', icon: <BriefcaseIcon/> }, {id: 'agenda', label: 'Agenda', icon: <CalendarIcon/>}, { id: 'leaves', label: 'Congés', icon: <SunIcon/> }, { id: 'vault', label: 'Coffre-fort', icon: <LockIcon/> }];

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-content">
                    <div className="flex-center" style={{gap: '0.75rem'}}>
                        <UserIcon />
                        <span style={{fontWeight: 600}}>{profile.full_name || 'Utilisateur'}</span>
                    </div>
                    <nav className="main-nav">
                        {navItems.map(item => (
                            <Link key={item.id} to={`/${item.id}`} className="nav-button">
                                {item.icon} <span className="nav-label">{item.label}</span>
                            </Link>
                        ))}
                        <button onClick={handleLogout} className="nav-button"><LogOutIcon /><span className="nav-label">Déconnexion</span></button>
                    </nav>
                </div>
            </header>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

// --- Application principale ---
function App() {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [vaultDocuments, setVaultDocuments] = useState([]);
    const [toast, setToast] = useState(null);
    const [modal, setModal] = useState(null);
    const navigate = useNavigate();

    // ✅ NOUVEAU : État de chargement progressif pour mobile
    const [loadingState, setLoadingState] = useState({
        interventions: 'idle',
        users: 'idle',
        leaves: 'idle',
        vault: 'idle'
    });

    // ✅ NOUVEAU : Détection mobile
    const isMobile = useIsMobile();

    // ✅ NOUVEAU : Flag pour éviter les refreshs en cascade
    const [isManualRefresh, setIsManualRefresh] = useState(false);

    // ✅ CORRECTION BOUCLE INFINIE : Ref pour tracker les refreshs
    const refreshTimeoutRef = useRef(null);
    const lastRefreshRef = useRef(0);

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
    const showConfirmationModal = useCallback((config) => setModal(config), []);

    // ✅ CORRECTION BOUCLE INFINIE : Fonction stable avec deps fixes
    const refreshData = useCallback(async (userProfile, isManual = false) => {
        if (!userProfile) return;

        // ✅ PROTECTION ANTI-SPAM : Éviter les refreshs trop rapprochés
        const now = Date.now();
        if (!isManual && (now - lastRefreshRef.current) < 5000) {
            console.log('🚫 Refresh trop récent, ignoré');
            return;
        }
        lastRefreshRef.current = now;

        // ✅ NOUVEAU : Éviter les refreshs en cascade sur mobile admin
        if (isMobile && userProfile.is_admin && isManualRefresh && !isManual) {
            console.log('🚫 Refresh temps réel ignoré sur mobile admin - refresh manuel en cours');
            return;
        }

        // ✅ Annuler le refresh précédent s'il y en a un
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = null;
        }

        try {
            const isAdmin = userProfile.is_admin;
            const userId = userProfile.id;

            console.log('🔄 Démarrage chargement données', {
                isMobile,
                isAdmin,
                isManual,
                strategy: isMobile && isAdmin ? 'séquentiel mobile' : 'parallèle standard'
            });

            if (isMobile && isAdmin && isManual) {
                setIsManualRefresh(true);

                // ✅ CHARGEMENT SÉQUENTIEL OPTIMISÉ MOBILE ADMIN
                console.log('📱 Mode mobile admin - Chargement séquentiel');

                // Réinitialiser les états de chargement
                setLoadingState({
                    interventions: 'loading',
                    users: 'idle',
                    leaves: 'idle',
                    vault: 'idle'
                });

                // 1. PRIORITÉ HAUTE : Interventions (données les plus importantes)
                try {
                    const interventionsRes = await interventionService.getInterventions(null, false);
                    if (interventionsRes.error) throw interventionsRes.error;
                    setInterventions(interventionsRes.data || []);
                    setLoadingState(prev => ({ ...prev, interventions: 'loaded' }));
                    console.log('✅ Interventions chargées');
                } catch (error) {
                    console.error('❌ Erreur interventions:', error);
                    setLoadingState(prev => ({ ...prev, interventions: 'error' }));
                }

                // 2. Attendre 400ms puis charger utilisateurs
                refreshTimeoutRef.current = setTimeout(async () => {
                    setLoadingState(prev => ({ ...prev, users: 'loading' }));
                    try {
                        const profilesRes = await profileService.getAllProfiles();
                        if (profilesRes.error) throw profilesRes.error;
                        setUsers(profilesRes.data || []);
                        setLoadingState(prev => ({ ...prev, users: 'loaded' }));
                        console.log('✅ Utilisateurs chargés');
                    } catch (error) {
                        console.error('❌ Erreur utilisateurs:', error);
                        setLoadingState(prev => ({ ...prev, users: 'error' }));
                    }
                }, 400);

                // 3. Attendre 800ms puis charger congés
                refreshTimeoutRef.current = setTimeout(async () => {
                    setLoadingState(prev => ({ ...prev, leaves: 'loading' }));
                    try {
                        const leavesRes = await leaveService.getLeaveRequests(null);
                        if (leavesRes.error) throw leavesRes.error;
                        setLeaveRequests(leavesRes.data || []);
                        setLoadingState(prev => ({ ...prev, leaves: 'loaded' }));
                        console.log('✅ Congés chargés');
                    } catch (error) {
                        console.error('❌ Erreur congés:', error);
                        setLoadingState(prev => ({ ...prev, leaves: 'error' }));
                    }
                }, 800);

                // 4. Attendre 1200ms puis charger coffre-fort
                refreshTimeoutRef.current = setTimeout(async () => {
                    setLoadingState(prev => ({ ...prev, vault: 'loading' }));
                    try {
                        const vaultRes = await vaultService.getVaultDocuments();
                        if (vaultRes.error) throw vaultRes.error;
                        setVaultDocuments(vaultRes.data || []);
                        setLoadingState(prev => ({ ...prev, vault: 'loaded' }));
                        console.log('✅ Documents chargés');

                        // ✅ Fin du refresh manuel
                        setTimeout(() => {
                            setIsManualRefresh(false);
                            console.log('🎯 Refresh manuel terminé - reprise du temps réel');
                        }, 500);
                    } catch (error) {
                        console.error('❌ Erreur documents:', error);
                        setLoadingState(prev => ({ ...prev, vault: 'error' }));
                        setIsManualRefresh(false);
                    }
                }, 1200);

            } else {
                // ✅ CHARGEMENT PARALLÈLE STANDARD (Desktop ou Employé)
                console.log('💻 Mode standard - Chargement parallèle');

                if (!isManual) {
                    setLoadingState({
                        interventions: 'loading',
                        users: 'loading',
                        leaves: 'loading',
                        vault: 'loading'
                    });
                }

                const [profilesRes, interventionsRes, leavesRes, vaultRes] = await Promise.all([
                    profileService.getAllProfiles(),
                    interventionService.getInterventions(isAdmin ? null : userId, false),
                    leaveService.getLeaveRequests(isAdmin ? null : userId),
                    vaultService.getVaultDocuments()
                ]);

                if (profilesRes.error) throw profilesRes.error;
                setUsers(profilesRes.data || []);

                if (interventionsRes.error) throw interventionsRes.error;
                setInterventions(interventionsRes.data || []);

                if (leavesRes.error) throw leavesRes.error;
                setLeaveRequests(leavesRes.data || []);

                if (vaultRes.error) throw vaultRes.error;
                setVaultDocuments(vaultRes.data || []);

                if (!isManual) {
                    setLoadingState({
                        interventions: 'loaded',
                        users: 'loaded',
                        leaves: 'loaded',
                        vault: 'loaded'
                    });
                }

                console.log('✅ Toutes les données chargées en parallèle');
            }

        } catch (error) {
            console.error('❌ Erreur chargement données:', error);
            showToast(`Erreur de chargement: ${error.message}`, "error");
            setLoadingState({
                interventions: 'error',
                users: 'error',
                leaves: 'error',
                vault: 'error'
            });
            setIsManualRefresh(false);
        }
    }, [showToast]); // ✅ CORRECTION : Dépendances fixes - pas de isMobile ou isManualRefresh

    useEffect(() => {
        const { data: { subscription } } = authService.onAuthStateChange((_event, sessionData) => { setSession(sessionData); });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session?.user) {
            setLoading(true);
            profileService.getProfile(session.user.id)
                .then(({ data: userProfile, error }) => {
                    if (error) {
                        console.error("Error fetching profile:", error);
                        showToast("Impossible de récupérer le profil.", "error");
                        authService.signOut();
                    } else {
                        setProfile(userProfile);
                    }
                }).finally(() => { setLoading(false); });
        } else {
            setProfile(null);
            setLoading(false);
        }
    }, [session, showToast]);

    // ✅ CORRECTION BOUCLE INFINIE : useEffect séparé et stable
    useEffect(() => {
        if (!profile) return;

        console.log('🔄 Setup initial des données pour:', profile.full_name);

        // ✅ Premier chargement manuel
        refreshData(profile, true);

        // ✅ OPTIMISATION : Désactiver temps réel sur mobile admin pendant les interactions
        if (isMobile && profile.is_admin) {
            console.log('📱 Mobile admin détecté - Temps réel désactivé pour optimiser les performances');
            return; // Pas de subscription temps réel sur mobile admin
        }

        // ✅ Temps réel seulement pour desktop ou employés
        console.log('⏰ Setup temps réel pour:', profile.full_name);

        // ✅ FONCTION DEBOUNCE STABLE
        const debouncedRefresh = (() => {
            let timeout;
            return () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    refreshData(profile, false);
                }, 5000); // 5s de debounce
            };
        })();

        const sub = supabase.channel('public-changes').on('postgres_changes', {
            event: '*',
            schema: 'public'
        }, debouncedRefresh).subscribe();

        return () => {
            console.log('🔄 Nettoyage subscription temps réel');
            supabase.removeChannel(sub);
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [profile?.id, isMobile, profile?.is_admin]); // ✅ Deps stables

    const handleLogout = async () => {
        const { error } = await authService.signOut();
        if (error) {
            showToast("Erreur lors de la déconnexion.", "error");
        }
        navigate('/login');
    };

    const handleUpdateUser = async (updatedUserData) => {
        const { error } = await profileService.updateProfile(updatedUserData.id, updatedUserData);
        if (error) { showToast("Erreur mise à jour profil.", "error"); }
        else {
            showToast("Profil mis à jour.");
            // ✅ Refresh manuel uniquement si nécessaire
            refreshData(profile, true);
        }
    };

    const handleAddIntervention = async (interventionData, assignedUserIds, briefingFiles) => {
        try {
            const { error } = await interventionService.createIntervention(interventionData, assignedUserIds, briefingFiles);
            if (error) {
                showToast(`Erreur création intervention: ${error.message}`, "error");
            } else {
                showToast("Intervention ajoutée.");
                // ✅ Refresh manuel après création
                refreshData(profile, true);
            }
        } catch (error) {
            showToast(`Erreur création intervention: ${error.message}`, "error");
        }
    };

    // MODIFIÉ: La fonction gère maintenant le statut de manière dynamique
    const handleUpdateInterventionReport = async (interventionId, report) => {
        // Détermine le nouveau statut en fonction du rapport
        const newStatus = report.departureTime ? 'Terminée' : 'En cours';

        const { error } = await interventionService.updateIntervention(interventionId, { report, status: newStatus });

        if (error) {
            showToast("Erreur sauvegarde rapport.", "error");
        } else {
            if (newStatus === 'Terminée') {
                showToast("Rapport sauvegardé et intervention clôturée.");
            } else {
                showToast("Rapport sauvegardé. L'intervention est maintenant 'En cours'.");
            }
            navigate('/planning');
            // ✅ Refresh après update
            refreshData(profile, true);
        }
    };

    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await interventionService.deleteIntervention(id);
                if (error) {
                    showToast("Erreur suppression.", "error");
                } else {
                    showToast("Intervention supprimée.");
                    refreshData(profile, true);
                }
            }
        });
    };

    const handleArchiveIntervention = async (id) => {
        const { error } = await interventionService.updateIntervention(id, { is_archived: true });
        if (error) {
            showToast("Erreur archivage.", "error");
        } else {
            showToast("Intervention archivée.");
            refreshData(profile, true);
        }
    };

    const handleUpdateLeaveStatus = (id, status) => {
        if (status === 'Rejeté') {
            showConfirmationModal({
                title: "Rejeter la demande",
                message: "Veuillez indiquer le motif du refus.",
                showInput: true,
                inputLabel: "Motif du refus",
                onConfirm: async (reason) => {
                    const { error } = await leaveService.updateRequestStatus(id, status, reason);
                    if (error) {
                        showToast("Erreur mise à jour congé.", "error");
                    } else {
                        showToast("Statut de la demande mis à jour.");
                        refreshData(profile, true);
                    }
                }
            });
        } else {
            leaveService.updateRequestStatus(id, status).then(({error}) => {
                if (error) {
                    showToast("Erreur mise à jour congé.", "error");
                } else {
                    showToast("Statut de la demande mis à jour.");
                    refreshData(profile, true);
                }
            });
        }
    };

    const handleDeleteLeaveRequest = (id) => {
        showConfirmationModal({
            title: "Supprimer la demande ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await leaveService.deleteLeaveRequest(id);
                if (error) {
                    showToast("Erreur suppression.", "error");
                } else {
                    showToast("Demande supprimée.");
                    refreshData(profile, true);
                }
            }
        });
    };

    const handleSubmitLeaveRequest = async (requestData) => {
        const { error } = await leaveService.createLeaveRequest(requestData);
        if (error) {
            showToast("Erreur envoi demande.", "error");
        } else {
            showToast("Demande de congé envoyée.");
            refreshData(profile, true);
        }
    };

    const handleSendDocument = async ({ file, userId, name }) => {
        try {
            const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
            if (uploadError) throw uploadError;
            const { error: dbError } = await vaultService.createVaultDocument({ userId, name, url: publicURL, path: filePath });
            if (dbError) throw dbError;
            await refreshData(profile, true);
            showToast("Document envoyé avec succès.");
        } catch (error) {
            console.error("Erreur lors de l'envoi du document:", error);
            showToast(`Erreur lors de l'envoi: ${error.message}`, "error");
        }
    };

    const handleDeleteDocument = async (documentId) => {
        showConfirmationModal({
            title: "Supprimer ce document ?",
            message: "Cette action est irréversible et supprimera le fichier définitivement.",
            onConfirm: async () => {
                const { error } = await vaultService.deleteVaultDocument(documentId);
                if (error) {
                    showToast("Erreur lors de la suppression : " + error.message, "error");
                } else {
                    showToast("Document supprimé.");
                    await refreshData(profile, true);
                }
            }
        });
    };

    const handleAddBriefingDocuments = async (interventionId, files) => {
        try {
            const { error } = await interventionService.addBriefingDocuments(interventionId, files);
            if (error) {
                throw error;
            }
            showToast("Documents de préparation ajoutés avec succès.");
            await refreshData(profile, true);
        } catch (error) {
            showToast(`Erreur lors de l'ajout des documents : ${error.message}`, "error");
            throw error;
        }
    };

    // ✅ ÉCRAN DE CHARGEMENT AMÉLIORÉ
    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement de votre espace...</p>
                {isMobile && <p className="text-muted">Optimisation mobile activée...</p>}
            </div>
        );
    }

    // ✅ VÉRIFICATION : Chargement mobile admin en cours
    const isMobileAdminLoading = profile?.is_admin && isMobile &&
        Object.values(loadingState).some(state => state === 'loading' || state === 'idle');

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            {modal && <ConfirmationModal {...modal} onConfirm={(inputValue) => { modal.onConfirm(inputValue); setModal(null); }} onCancel={() => setModal(null)} />}

            {/* ✅ INDICATEUR DE CHARGEMENT MOBILE */}
            <MobileLoadingIndicator
                loadingState={loadingState}
                isMobile={isMobile}
                isAdmin={profile?.is_admin}
            />

            <Routes>
                {!session || !profile ? (
                    <Route path="*" element={<LoginScreen />} />
                ) : (
                    <Route path="/" element={<AppLayout profile={profile} handleLogout={handleLogout} />}>
                        {profile.is_admin ? (
                            <>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="dashboard" element={
                                    <AdminDashboard
                                        interventions={interventions}
                                        leaveRequests={leaveRequests}
                                        isLoading={isMobileAdminLoading}
                                        loadingState={loadingState}
                                    />
                                } />
                                <Route path="agenda" element={
                                    <AgendaView
                                        interventions={interventions}
                                        isLoading={loadingState.interventions !== 'loaded'}
                                    />
                                } />
                                <Route path="planning" element={
                                    <AdminPlanningView
                                        interventions={interventions}
                                        users={users}
                                        onAddIntervention={handleAddIntervention}
                                        onArchive={handleArchiveIntervention}
                                        onDelete={handleDeleteIntervention}
                                        isLoading={loadingState.interventions !== 'loaded' || loadingState.users !== 'loaded'}
                                    />
                                } />
                                <Route
                                    path="planning/:interventionId"
                                    element={<InterventionDetailView
                                        interventions={interventions}
                                        onSave={handleUpdateInterventionReport}
                                        isAdmin={profile.is_admin}
                                        onAddBriefingDocuments={handleAddBriefingDocuments}
                                    />}
                                />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="leaves" element={
                                    <AdminLeaveView
                                        leaveRequests={leaveRequests}
                                        onUpdateRequestStatus={handleUpdateLeaveStatus}
                                        onDeleteLeaveRequest={handleDeleteLeaveRequest}
                                        isLoading={loadingState.leaves !== 'loaded'}
                                    />
                                } />
                                <Route path="users" element={
                                    <AdminUserView
                                        users={users}
                                        onUpdateUser={handleUpdateUser}
                                        isLoading={loadingState.users !== 'loaded'}
                                    />
                                } />
                                <Route
                                    path="vault"
                                    element={<AdminVaultView
                                        users={users}
                                        vaultDocuments={vaultDocuments}
                                        onSendDocument={handleSendDocument}
                                        onDeleteDocument={handleDeleteDocument}
                                        isLoading={loadingState.vault !== 'loaded'}
                                    />}
                                />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        ) : (
                            <>
                                <Route index element={<Navigate to="/planning" replace />} />
                                <Route path="planning" element={
                                    <EmployeePlanningView
                                        interventions={interventions}
                                        isLoading={loadingState.interventions !== 'loaded'}
                                    />
                                } />
                                <Route
                                    path="planning/:interventionId"
                                    element={<InterventionDetailView
                                        interventions={interventions}
                                        onSave={handleUpdateInterventionReport}
                                        isAdmin={profile.is_admin}
                                    />}
                                />
                                <Route path="agenda" element={
                                    <AgendaView
                                        interventions={interventions}
                                        isLoading={loadingState.interventions !== 'loaded'}
                                    />
                                } />
                                <Route path="leaves" element={
                                    <EmployeeLeaveView
                                        leaveRequests={leaveRequests}
                                        onSubmitRequest={handleSubmitLeaveRequest}
                                        userName={profile?.full_name}
                                        userId={profile?.id}
                                        showToast={showToast}
                                        isLoading={loadingState.leaves !== 'loaded'}
                                    />
                                } />
                                <Route
                                    path="vault"
                                    element={<CoffreNumeriqueView
                                        vaultDocuments={vaultDocuments.filter(doc => doc.user_id === profile.id)}
                                        isLoading={loadingState.vault !== 'loaded'}
                                    />}
                                />
                                <Route path="*" element={<Navigate to="/planning" replace />} />
                            </>
                        )}
                    </Route>
                )}
            </Routes>
        </>
    );
}

export default App;