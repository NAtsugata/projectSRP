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

    // ✅ NOUVEAU : État pour forcer la mise à jour des composants enfants
    const [dataVersion, setDataVersion] = useState(Date.now());

    const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
    const showConfirmationModal = useCallback((config) => setModal(config), []);

    const refreshData = useCallback(async (userProfile) => {
        if (!userProfile) return;
        try {
            console.log('🔄 Rafraîchissement des données pour:', userProfile.full_name);

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

            // ✅ NOUVEAU : Mettre à jour la version des données pour forcer le re-render
            setDataVersion(Date.now());
            console.log('✅ Données rafraîchies, nouvelle version:', dataVersion);

        } catch (error) {
            console.error('❌ Erreur chargement données:', error);
            showToast(`Erreur de chargement: ${error.message}`, "error");
        }
    }, [showToast, dataVersion]); // Ajout de dataVersion ici

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
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    console.log('🔄 Changement détecté en temps réel:', payload.table);
                    refreshData(profile);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(sub);
            };
        }
    }, [profile, refreshData, supabase]);

    const handleLogout = async () => {
        const { error } = await authService.signOut();
        if (error) {
            showToast("Erreur lors de la déconnexion.", "error");
        }
        navigate('/login');
    };

    const handleUpdateUser = async (updatedUserData) => {
        const { error } = await profileService.updateProfile(updatedUserData.id, updatedUserData);
        if (error) {
            showToast("Erreur mise à jour profil.", "error");
        } else {
            showToast("Profil mis à jour.");
        }
    };

    const handleAddIntervention = async (interventionData, assignedUserIds, briefingFiles) => {
        const { error } = await interventionService.createIntervention(interventionData, assignedUserIds, briefingFiles);
        if (error) {
            showToast(`Erreur création intervention: ${error.message}`, "error");
        } else {
            showToast("Intervention ajoutée.");
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
        if (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
            return { success: false, error };
        }
        return { success: true };
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

    // ... (le reste des fonctions handle... reste inchangé)

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement de votre espace...</p>
            </div>
        );
    }

    // ✅ NOUVEAU : On prépare les props à passer à InterventionDetailView
    const interventionDetailProps = {
        interventions,
        onSave: handleUpdateInterventionReport,
        onSaveSilent: handleUpdateInterventionReportSilent,
        isAdmin: profile?.is_admin,
        onAddBriefingDocuments: handleAddBriefingDocuments,
        dataVersion, // On passe la version
        refreshData: () => refreshData(profile) // On passe la fonction de rafraîchissement
    };

    return (
        <>
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
                                <Route path="planning" element={<AdminPlanningView interventions={interventions} users={users} onAddIntervention={handleAddIntervention} onArchive={handleArchiveIntervention} onDelete={handleDeleteIntervention} />} />
                                <Route
                                    path="planning/:interventionId"
                                    // ✅ NOUVEAU : On utilise les props préparées
                                    element={<InterventionDetailView {...interventionDetailProps} />}
                                />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="leaves" element={<AdminLeaveView />} />
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
                                    // ✅ NOUVEAU : On utilise aussi les props ici
                                    element={<InterventionDetailView {...interventionDetailProps} />}
                                />
                                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                                <Route path="leaves" element={<EmployeeLeaveView />} />
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
