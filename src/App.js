import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, Outlet, useLocation } from 'react-router-dom';
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

// --- Composant de Layout (structure de la page) ---
const AppLayout = ({ profile, handleLogout }) => {
    const location = useLocation();
    const navItems = profile.is_admin ?
        [{ id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboardIcon /> }, {id: 'agenda', label: 'Agenda', icon: <CalendarIcon/>}, { id: 'planning', label: 'Planning', icon: <BriefcaseIcon /> }, { id: 'archives', label: 'Archives', icon: <ArchiveIcon /> }, { id: 'leaves', label: 'Congés', icon: <SunIcon /> }, { id: 'users', label: 'Employés', icon: <UsersIcon /> }, { id: 'vault', label: 'Coffre-fort', icon: <FolderIcon /> }] :
        [{ id: 'planning', label: 'Planning', icon: <BriefcaseIcon/> }, {id: 'agenda', label: 'Agenda', icon: <CalendarIcon/>}, { id: 'leaves', label: 'Congés', icon: <SunIcon/> }, { id: 'vault', label: 'Coffre-fort', icon: <LockIcon/> }];

    return (
        <div className="app-container">
            {/* --- Barre de navigation pour Desktop --- */}
            <header className="app-header desktop-nav">
                <div className="header-content">
                    <div className="flex-center" style={{gap: '0.75rem'}}>
                        <UserIcon />
                        <span style={{fontWeight: 600}}>{profile.full_name || 'Utilisateur'}</span>
                    </div>
                    <nav className="main-nav">
                        {navItems.map(item => (
                            <Link key={item.id} to={`/${item.id}`} className={`nav-button ${location.pathname.startsWith('/' + item.id) ? 'active' : ''}`}>
                                {item.icon} <span className="nav-label">{item.label}</span>
                            </Link>
                        ))}
                        <button onClick={handleLogout} className="nav-button"><LogOutIcon /><span className="nav-label">Déconnexion</span></button>
                    </nav>
                </div>
            </header>

            {/* --- Contenu principal de la page --- */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* --- Barre d'onglets pour Mobile --- */}
            <footer className="mobile-nav">
                 <div className="mobile-nav-header">
                    <div className="flex-center" style={{gap: '0.5rem'}}>
                        <UserIcon />
                        <span>{profile.full_name || 'Utilisateur'}</span>
                    </div>
                    <button onClick={handleLogout} className="btn-icon-logout"><LogOutIcon /></button>
                </div>
                <div className="mobile-nav-icons">
                    {navItems.map(item => (
                        <Link key={item.id} to={`/${item.id}`} className={`mobile-nav-button ${location.pathname.startsWith('/' + item.id) ? 'active' : ''}`}>
                            {item.icon}
                            <span className="mobile-nav-label">{item.label}</span>
                        </Link>
                    ))}
                </div>
            </footer>
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

    const [dataVersion, setDataVersion] = useState(Date.now());

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
    const showConfirmationModal = useCallback((config) => setModal(config), []);

    const refreshData = useCallback(async (userProfile) => {
        if (!userProfile) return;
        try {
            const isAdmin = userProfile.is_admin;
            const userId = userProfile.id;
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

            setDataVersion(Date.now());

        } catch (error) {
            console.error('❌ Erreur chargement données:', error);
            showToast(`Erreur de chargement: ${error.message}`, "error");
        }
    }, [showToast]);

    useEffect(() => {
        const { data: { subscription } } = authService.onAuthStateChange((_event, sessionData) => {
            setSession(sessionData);
        });
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
            const initialLoad = async () => {
                await refreshData(profile);
            };
            initialLoad();

            const sub = supabase
                .channel('public-changes')
                .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                    refreshData(profile);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(sub);
            };
        }
    }, [profile, refreshData]);

    const handleLogout = async () => {
        await authService.signOut();
        navigate('/login');
    };

    const handleUpdateUser = async (updatedUserData) => {
        const updates = {
            full_name: updatedUserData.full_name,
            is_admin: updatedUserData.is_admin,
        };

        const { error } = await profileService.updateProfile(updatedUserData.id, updates);

        if (error) {
            showToast(`Erreur mise à jour: ${error.message}`, "error");
        } else {
            showToast("Profil mis à jour avec succès.");
            await refreshData(profile);
        }
    };

    const handleAddIntervention = async (interventionData, assignedUserIds) => {
        const { error } = await interventionService.createIntervention(interventionData, assignedUserIds, []);
        if (error) {
            showToast(`Erreur création intervention: ${error.message}`, "error");
        } else {
            showToast("Intervention créée avec succès.");
            await refreshData(profile);
        }
    };

    const handleAddBriefingDocuments = async (interventionId, files) => {
        try {
            const { error } = await interventionService.addBriefingDocuments(interventionId, files);
            if (error) throw error;
            showToast("Documents de préparation ajoutés avec succès.");
            await refreshData(profile);
        } catch (error) {
            showToast(`Erreur lors de l'ajout des documents : ${error.message}`, "error");
        }
    };

    const handleUpdateInterventionReportSilent = async (interventionId, report) => {
        const { error } = await interventionService.updateIntervention(interventionId, { report });
        return { success: !error, error };
    };

    const handleUpdateInterventionReport = async (interventionId, reportData) => {
        const { report, admin_notes } = reportData;
        const newStatus = report.departureTime ? 'Terminée' : 'En cours';
        const { error } = await interventionService.updateIntervention(interventionId, {
            report: report,
            admin_notes: admin_notes,
            status: newStatus
        });
        if (error) {
            showToast("Erreur lors de la sauvegarde: " + error.message, "error");
        } else {
            showToast(newStatus === 'Terminée' ? "Rapport sauvegardé et intervention clôturée." : "Rapport sauvegardé.");
            navigate('/planning');
            await refreshData(profile);
        }
    };

    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible et supprimera tous les documents associés.",
            onConfirm: async () => {
                const { error } = await interventionService.deleteIntervention(id);
                if (error) showToast("Erreur suppression.", "error");
                else showToast("Intervention supprimée.");
                await refreshData(profile);
            }
        });
    };

    const handleArchiveIntervention = (id) => {
        showConfirmationModal({
            title: "Archiver l'intervention ?",
            message: "L'intervention sera déplacée vers les archives.",
            onConfirm: async () => {
                const { error } = await interventionService.updateIntervention(id, { is_archived: true });
                if (error) showToast("Erreur archivage.", "error");
                else showToast("Intervention archivée.");
                await refreshData(profile);
            }
        });
    };

    const handleSubmitLeaveRequest = async (requestData) => {
        const newRequest = {
            userId: profile.id,
            userName: profile.full_name,
            ...requestData
        };
        const { error } = await leaveService.createLeaveRequest(newRequest);
        if (error) {
            showToast(`Erreur lors de l'envoi: ${error.message}`, "error");
        } else {
            showToast("Votre demande de congé a été envoyée.", "success");
            await refreshData(profile);
        }
    };

    const handleUpdateLeaveStatus = async (requestId, status) => {
        const { error } = await leaveService.updateRequestStatus(requestId, status);
        if (error) {
            showToast(`Erreur: ${error.message}`, "error");
        } else {
            showToast(`La demande a été ${status.toLowerCase()}.`, "success");
            await refreshData(profile);
        }
    };

    const handleDeleteLeaveRequest = (requestId) => {
        showConfirmationModal({
            title: "Supprimer la demande ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await leaveService.deleteLeaveRequest(requestId);
                if (error) {
                    showToast(`Erreur: ${error.message}`, "error");
                } else {
                    showToast("La demande a été supprimée.", "success");
                }
                await refreshData(profile);
            }
        });
    };

    if (loading) {
        return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>;
    }

    const interventionDetailProps = {
        interventions,
        onSave: handleUpdateInterventionReport,
        onSaveSilent: handleUpdateInterventionReportSilent,
        isAdmin: profile?.is_admin,
        onAddBriefingDocuments: handleAddBriefingDocuments,
        dataVersion,
        refreshData: () => refreshData(profile)
    };

    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            {modal && <ConfirmationModal {...modal} onConfirm={(val) => { modal.onConfirm(val); setModal(null); }} onCancel={() => setModal(null)} />}
            <Routes>
                {!session || !profile ? (
                    <Route path="*" element={<LoginScreen />} />
                ) : (
                    <Route path="/" element={<AppLayout profile={profile} handleLogout={handleLogout} />}>
                        {profile.is_admin ? (
                            <>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="dashboard" element={<AdminDashboard interventions={interventions} leaveRequests={leaveRequests} />} />
                                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                                <Route path="planning" element={<AdminPlanningView interventions={interventions} users={users} onAddIntervention={handleAddIntervention} onArchive={handleArchiveIntervention} onDelete={handleDeleteIntervention} onAddBriefingDocuments={handleAddBriefingDocuments} />} />
                                <Route path="planning/:interventionId" element={<InterventionDetailView {...interventionDetailProps} />} />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                {/* --- LA CORRECTION EST ICI --- */}
                                <Route
                                    path="leaves"
                                    element={<AdminLeaveView
                                        leaveRequests={leaveRequests}
                                        onUpdateStatus={handleUpdateLeaveStatus}
                                        onDelete={handleDeleteLeaveRequest}
                                    />}
                                />
                                <Route path="users" element={<AdminUserView users={users} onUpdateUser={handleUpdateUser} />} />
                                <Route path="vault" element={<AdminVaultView users={users} vaultDocuments={vaultDocuments} />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        ) : (
                            <>
                                <Route index element={<Navigate to="/planning" replace />} />
                                <Route path="planning" element={<EmployeePlanningView interventions={interventions} />} />
                                <Route path="planning/:interventionId" element={<InterventionDetailView {...interventionDetailProps} />} />
                                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                                <Route
                                    path="leaves"
                                    element={<EmployeeLeaveView
                                        leaveRequests={leaveRequests}
                                        onSubmitRequest={handleSubmitLeaveRequest}
                                        userName={profile.full_name}
                                        userId={profile.id}
                                        showToast={showToast}
                                    />}
                                />
                                <Route path="vault" element={<CoffreNumeriqueView vaultDocuments={vaultDocuments.filter(doc => doc.user_id === profile.id)} />} />
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

