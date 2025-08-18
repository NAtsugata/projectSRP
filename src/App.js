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

            <main className="main-content">
                <Outlet />
            </main>

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
    }, [profile, refreshData, supabase]);

    const handleLogout = async () => {
        await authService.signOut();
        navigate('/login');
    };

    const handleUpdateUser = async (updatedUserData) => {
        const { error } = await profileService.updateProfile(updatedUserData.id, updatedUserData);
        if (error) showToast("Erreur mise à jour profil.", "error");
        else showToast("Profil mis à jour.");
    };

    // ✅ CORRECTION : La fonction ne gère plus les fichiers et retourne la nouvelle intervention.
    const handleAddIntervention = async (interventionData, assignedUserIds) => {
        const { data, error } = await interventionService.createIntervention(interventionData, assignedUserIds);
        if (error) {
            showToast(`Erreur création intervention: ${error.message}`, "error");
            throw error; // Propage l'erreur pour que le composant puisse la gérer
        }
        showToast("Intervention ajoutée.");
        return data; // Retourne l'objet de la nouvelle intervention
    };

    const handleAddBriefingDocuments = async (interventionId, files) => {
        try {
            const { error } = await interventionService.addBriefingDocuments(interventionId, files);
            if (error) throw error;
            showToast("Documents de préparation ajoutés avec succès.");
            await refreshData(profile);
        } catch (error) {
            showToast(`Erreur lors de l'ajout des documents : ${error.message}`, "error");
            throw error;
        }
    };

    const handleUpdateInterventionReportSilent = async (interventionId, report) => {
        const sanitizedReport = {
            notes: report.notes || '',
            files: Array.isArray(report.files) ? report.files : [],
            arrivalTime: report.arrivalTime || null,
            departureTime: report.departureTime || null,
            signature: report.signature || null
        };
        const { error } = await interventionService.updateIntervention(interventionId, { report: sanitizedReport });
        return { success: !error, error };
    };

    const handleUpdateInterventionReport = async (interventionId, report) => {
        try {
            const newStatus = report.departureTime ? 'Terminée' : 'En cours';
            const sanitizedReport = {
                notes: report.notes || '',
                files: Array.isArray(report.files) ? report.files : [],
                arrivalTime: report.arrivalTime || null,
                departureTime: report.departureTime || null,
                signature: report.signature || null
            };

            const { error } = await interventionService.updateIntervention(interventionId, {
                report: sanitizedReport,
                status: newStatus
            });

            if (error) throw error;

            showToast(newStatus === 'Terminée' ? "Rapport sauvegardé et intervention clôturée." : "Rapport sauvegardé.");
            navigate('/planning');
            await refreshData(profile);

        } catch (error) {
            showToast("Erreur lors de la sauvegarde: " + (error.message || 'Erreur inconnue'), "error");
            throw error;
        }
    };

    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await interventionService.deleteIntervention(id);
                if (error) showToast("Erreur suppression.", "error");
                else showToast("Intervention supprimée.");
            }
        });
    };

    const handleArchiveIntervention = async (id) => {
        const { error } = await interventionService.updateIntervention(id, { is_archived: true });
        if (error) showToast("Erreur archivage.", "error");
        else showToast("Intervention archivée.");
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement de votre espace...</p>
            </div>
        );
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
            <style>{`
                /* ... (les styles restent inchangés) ... */
            `}</style>

            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            {modal && <ConfirmationModal {...modal} onConfirm={(inputValue) => { modal.onConfirm(inputValue); setModal(null); }} onCancel={() => setModal(null)} />}
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
                                <Route
                                    path="planning"
                                    element={<AdminPlanningView
                                        interventions={interventions}
                                        users={users}
                                        onAddIntervention={handleAddIntervention}
                                        onArchive={handleArchiveIntervention}
                                        onDelete={handleDeleteIntervention}
                                        onAddBriefingDocuments={handleAddBriefingDocuments} // ✅ CORRECTION : Ajout de la prop
                                    />}
                                />
                                <Route
                                    path="planning/:interventionId"
                                    element={<InterventionDetailView {...interventionDetailProps} />}
                                />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="leaves" element={<AdminLeaveView leaveRequests={leaveRequests} />} />
                                <Route path="users" element={<AdminUserView users={users} onUpdateUser={handleUpdateUser} />} />
                                <Route path="vault" element={<AdminVaultView users={users} vaultDocuments={vaultDocuments} />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        ) : (
                            <>
                                <Route index element={<Navigate to="/planning" replace />} />
                                <Route path="planning" element={<EmployeePlanningView interventions={interventions} />} />
                                <Route
                                    path="planning/:interventionId"
                                    element={<InterventionDetailView {...interventionDetailProps} />}
                                />
                                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                                <Route path="leaves" element={<EmployeeLeaveView leaveRequests={leaveRequests} />} />
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
