import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, Outlet } from 'react-router-dom';
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

const MobileLoadingIndicator = ({ loadingState, isMobile, isAdmin }) => {
    if (!isMobile || !isAdmin) return null;
    const allLoaded = Object.values(loadingState).every(state => state === 'loaded');
    if (allLoaded) return null;
    const steps = [
        { key: 'interventions', label: 'Interventions' },
        { key: 'users', label: 'Utilisateurs' },
        { key: 'leaves', label: 'Congés' },
        { key: 'vault', label: 'Documents' }
    ];
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
                <p className="loading-tip">💡 Premier chargement optimisé pour mobile admin</p>
            </div>
        </div>
    );
};

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

    const [loadingState, setLoadingState] = useState({
        interventions: 'idle',
        users: 'idle',
        leaves: 'idle',
        vault: 'idle'
    });

    const isMobile = useIsMobile();
    const [isManualRefresh, setIsManualRefresh] = useState(false);

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
    const showConfirmationModal = useCallback((config) => setModal(config), []);

    const refreshData = useCallback(async (userProfile, isManual = false) => {
        if (!userProfile) return;

        if (isMobile && userProfile.is_admin && isManualRefresh && !isManual) {
            console.log('🚫 Refresh temps réel ignoré sur mobile admin - refresh manuel en cours');
            return;
        }

        try {
            const isAdmin = userProfile.is_admin;
            const userId = userProfile.id;

            console.log('🔄 Démarrage chargement données', { isMobile, isAdmin, isManual, strategy: isMobile && isAdmin && isManual ? 'séquentiel mobile' : 'parallèle standard' });

            if (isMobile && isAdmin && isManual) {
                setIsManualRefresh(true);
                console.log('📱 Mode mobile admin - Chargement séquentiel');
                setLoadingState({ interventions: 'loading', users: 'idle', leaves: 'idle', vault: 'idle' });

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

                setTimeout(async () => {
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

                setTimeout(async () => {
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

                setTimeout(async () => {
                    setLoadingState(prev => ({ ...prev, vault: 'loading' }));
                    try {
                        const vaultRes = await vaultService.getVaultDocuments();
                        if (vaultRes.error) throw vaultRes.error;
                        setVaultDocuments(vaultRes.data || []);
                        setLoadingState(prev => ({ ...prev, vault: 'loaded' }));
                        console.log('✅ Documents chargés');
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
                console.log('💻 Mode standard - Chargement parallèle');
                setLoadingState({ interventions: 'loading', users: 'loading', leaves: 'loading', vault: 'loading' });

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

                setLoadingState({ interventions: 'loaded', users: 'loaded', leaves: 'loaded', vault: 'loaded' });
                console.log('✅ Toutes les données chargées en parallèle');
            }
        } catch (error) {
            console.error('❌ Erreur chargement données:', error);
            showToast(`Erreur de chargement: ${error.message}`, "error");
            setLoadingState({ interventions: 'error', users: 'error', leaves: 'error', vault: 'error' });
            setIsManualRefresh(false);
        }
    }, [showToast, isMobile, isManualRefresh]);

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

    useEffect(() => {
        if (profile) {
            refreshData(profile, true); // Premier chargement manuel
            if (isMobile && profile.is_admin) {
                console.log('📱 Mobile admin détecté - Temps réel désactivé pour optimiser les performances');
                return;
            }
            const debounce = (func, wait) => {
                let timeout;
                return (...args) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => func.apply(this, args), wait);
                };
            };
            const sub = supabase.channel('public-changes').on('postgres_changes', { event: '*', schema: 'public' }, debounce(() => refreshData(profile, false), 10000)).subscribe();
            return () => { supabase.removeChannel(sub); };
        }
    }, [profile, refreshData, isMobile]);

    const handleLogout = async () => {
        await authService.signOut();
        navigate('/login');
    };

    // ✅ CORRECTION : Toutes les fonctions de mise à jour appellent refreshData avec `false`
    // pour éviter de redéclencher le chargement initial optimisé pour mobile.

    const handleUpdateUser = async (updatedUserData) => {
        const { error } = await profileService.updateProfile(updatedUserData.id, updatedUserData);
        if (error) { showToast("Erreur mise à jour profil.", "error"); }
        else {
            showToast("Profil mis à jour.");
            refreshData(profile, false);
        }
    };

    const handleAddIntervention = async (interventionData, assignedUserIds, briefingFiles) => {
        const { error } = await interventionService.createIntervention(interventionData, assignedUserIds, briefingFiles);
        if (error) { showToast(`Erreur création intervention: ${error.message}`, "error"); }
        else {
            showToast("Intervention ajoutée.");
            refreshData(profile, false);
        }
    };

    const handleUpdateInterventionReport = async (interventionId, report) => {
        const newStatus = report.departureTime ? 'Terminée' : 'En cours';
        const { error } = await interventionService.updateIntervention(interventionId, { report, status: newStatus });
        if (error) { showToast("Erreur sauvegarde rapport.", "error"); }
        else {
            showToast("Rapport sauvegardé.");
            navigate('/planning');
            await refreshData(profile, false);
        }
    };

    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await interventionService.deleteIntervention(id);
                if (error) { showToast("Erreur suppression.", "error"); }
                else {
                    showToast("Intervention supprimée.");
                    refreshData(profile, false);
                }
            }
        });
    };

    const handleArchiveIntervention = async (id) => {
        const { error } = await interventionService.updateIntervention(id, { is_archived: true });
        if (error) { showToast("Erreur archivage.", "error"); }
        else {
            showToast("Intervention archivée.");
            refreshData(profile, false);
        }
    };

    const handleUpdateLeaveStatus = (id, status) => {
        const action = async (reason = null) => {
            const { error } = await leaveService.updateRequestStatus(id, status, reason);
            if (error) { showToast("Erreur mise à jour congé.", "error"); }
            else {
                showToast("Statut de la demande mis à jour.");
                refreshData(profile, false);
            }
        };
        if (status === 'Rejeté') {
            showConfirmationModal({
                title: "Rejeter la demande",
                message: "Veuillez indiquer le motif du refus.",
                showInput: true,
                inputLabel: "Motif du refus",
                onConfirm: (reason) => action(reason)
            });
        } else {
            action();
        }
    };

    const handleDeleteLeaveRequest = (id) => {
        showConfirmationModal({
            title: "Supprimer la demande ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await leaveService.deleteLeaveRequest(id);
                if (error) { showToast("Erreur suppression.", "error"); }
                else {
                    showToast("Demande supprimée.");
                    refreshData(profile, false);
                }
            }
        });
    };

    const handleSubmitLeaveRequest = async (requestData) => {
        const { error } = await leaveService.createLeaveRequest(requestData);
        if (error) { showToast("Erreur envoi demande.", "error"); }
        else {
            showToast("Demande de congé envoyée.");
            refreshData(profile, false);
        }
    };

    const handleSendDocument = async ({ file, userId, name }) => {
        const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
        if (uploadError) { showToast(`Erreur envoi: ${uploadError.message}`, "error"); return; }
        const { error: dbError } = await vaultService.createVaultDocument({ userId, name, url: publicURL, path: filePath });
        if (dbError) { showToast(`Erreur base de données: ${dbError.message}`, "error"); return; }
        await refreshData(profile, false);
        showToast("Document envoyé avec succès.");
    };

    const handleDeleteDocument = async (documentId) => {
        showConfirmationModal({
            title: "Supprimer ce document ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await vaultService.deleteVaultDocument(documentId);
                if (error) { showToast("Erreur suppression : " + error.message, "error"); }
                else {
                    showToast("Document supprimé.");
                    await refreshData(profile, false);
                }
            }
        });
    };

    const handleAddBriefingDocuments = async (interventionId, files) => {
        const { error } = await interventionService.addBriefingDocuments(interventionId, files);
        if (error) { showToast(`Erreur ajout documents : ${error.message}`, "error"); throw error; }
        showToast("Documents ajoutés.");
        await refreshData(profile, false);
    };

    if (loading) {
        return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>;
    }

    const isMobileAdminLoading = profile?.is_admin && isMobile && Object.values(loadingState).some(state => state === 'loading' || state === 'idle');

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            {modal && <ConfirmationModal {...modal} onConfirm={(inputValue) => { modal.onConfirm(inputValue); setModal(null); }} onCancel={() => setModal(null)} />}
            <MobileLoadingIndicator loadingState={loadingState} isMobile={isMobile} isAdmin={profile?.is_admin} />

            <Routes>
                {!session || !profile ? (
                    <Route path="*" element={<LoginScreen />} />
                ) : (
                    <Route path="/" element={<AppLayout profile={profile} handleLogout={handleLogout} />}>
                        {profile.is_admin ? (
                            <>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="dashboard" element={<AdminDashboard interventions={interventions} leaveRequests={leaveRequests} isLoading={isMobileAdminLoading} loadingState={loadingState} />} />
                                <Route path="agenda" element={<AgendaView interventions={interventions} isLoading={loadingState.interventions !== 'loaded'} />} />
                                <Route path="planning" element={<AdminPlanningView interventions={interventions} users={users} onAddIntervention={handleAddIntervention} onArchive={handleArchiveIntervention} onDelete={handleDeleteIntervention} isLoading={loadingState.interventions !== 'loaded' || loadingState.users !== 'loaded'} />} />
                                <Route path="planning/:interventionId" element={<InterventionDetailView interventions={interventions} onSave={handleUpdateInterventionReport} isAdmin={profile.is_admin} onAddBriefingDocuments={handleAddBriefingDocuments} />} />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="leaves" element={<AdminLeaveView leaveRequests={leaveRequests} onUpdateRequestStatus={handleUpdateLeaveStatus} onDeleteLeaveRequest={handleDeleteLeaveRequest} isLoading={loadingState.leaves !== 'loaded'} />} />
                                <Route path="users" element={<AdminUserView users={users} onUpdateUser={handleUpdateUser} isLoading={loadingState.users !== 'loaded'} />} />
                                <Route path="vault" element={<AdminVaultView users={users} vaultDocuments={vaultDocuments} onSendDocument={handleSendDocument} onDeleteDocument={handleDeleteDocument} isLoading={loadingState.vault !== 'loaded'} />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        ) : (
                            <>
                                <Route index element={<Navigate to="/planning" replace />} />
                                <Route path="planning" element={<EmployeePlanningView interventions={interventions} isLoading={loadingState.interventions !== 'loaded'} />} />
                                <Route path="planning/:interventionId" element={<InterventionDetailView interventions={interventions} onSave={handleUpdateInterventionReport} isAdmin={profile.is_admin} />} />
                                <Route path="agenda" element={<AgendaView interventions={interventions} isLoading={loadingState.interventions !== 'loaded'} />} />
                                <Route path="leaves" element={<EmployeeLeaveView leaveRequests={leaveRequests} onSubmitRequest={handleSubmitLeaveRequest} userName={profile?.full_name} userId={profile?.id} showToast={showToast} isLoading={loadingState.leaves !== 'loaded'} />} />
                                <Route path="vault" element={<CoffreNumeriqueView vaultDocuments={vaultDocuments.filter(doc => doc.user_id === profile.id)} isLoading={loadingState.vault !== 'loaded'} />} />
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
