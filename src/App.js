import React, { useState, useEffect, useCallback } from 'react';
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

// --- Composant de Layout (structure de la page) ---
const AppLayout = ({ profile, handleLogout }) => {
    const navItems = profile.is_admin ?
        [
            { id: 'dashboard', path: '/dashboard', label: 'Tableau de Bord', icon: <LayoutDashboardIcon /> },
            { id: 'planning', path: '/planning', label: 'Planning', icon: <CalendarIcon /> },
            { id: 'leaves', path: '/leaves', label: 'Congés', icon: <SunIcon /> },
            { id: 'users', path: '/users', label: 'Employés', icon: <UsersIcon /> },
            { id: 'vault', path: '/vault', label: 'Coffre-fort', icon: <LockIcon /> },
            { id: 'archives', path: '/archives', label: 'Archives', icon: <ArchiveIcon /> },
        ] :
        [
            { id: 'planning', path: '/planning', label: 'Planning', icon: <CalendarIcon /> },
            { id: 'agenda', path: '/agenda', label: 'Agenda', icon: <BriefcaseIcon /> },
            { id: 'leaves', path: '/leaves', label: 'Congés', icon: <SunIcon /> },
            { id: 'vault', path: '/vault', label: 'Coffre-fort', icon: <FolderIcon /> },
        ];

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1 className="logo">Portail SRP</h1>
                    <div className="profile-info">
                        <UserIcon />
                        <span>{profile.full_name}</span>
                    </div>
                </div>
                <nav className="main-nav">
                    {navItems.map(item => <Link key={item.id} to={item.path} className="nav-item">{item.icon}<span>{item.label}</span></Link>)}
                </nav>
                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="nav-item logout-btn"><LogOutIcon /><span>Déconnexion</span></button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

// --- Composant Principal de l'Application ---
function App() {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [users, setUsers] = useState([]);
    const [interventions, setInterventions] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [vaultDocuments, setVaultDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ show: false, title: '', message: '', onConfirm: () => {} });
    const navigate = useNavigate();

    const showToast = (message, type = 'success') => setToast({ show: true, message, type });
    const showConfirmationModal = ({ title, message, onConfirm }) => setConfirmation({ show: true, title, message, onConfirm: () => { onConfirm(); setConfirmation({ show: false }); } });

    const refreshData = useCallback(async (currentProfile) => {
        if (!currentProfile) return;
        setLoading(true);
        try {
            const [interventionsRes, usersRes, leavesRes, vaultRes] = await Promise.all([
                interventionService.getInterventions(currentProfile.is_admin ? null : currentProfile.id),
                currentProfile.is_admin ? profileService.getAllProfiles() : Promise.resolve({ data: [] }),
                leaveService.getLeaveRequests(),
                vaultService.getVaultDocuments()
            ]);
            if (interventionsRes.error) throw interventionsRes.error;
            if (usersRes.error) throw usersRes.error;
            if (leavesRes.error) throw leavesRes.error;
            if (vaultRes.error) throw vaultRes.error;

            setInterventions(interventionsRes.data);
            setUsers(usersRes.data);
            setLeaveRequests(leavesRes.data);
            setVaultDocuments(vaultRes.data);
        } catch (error) {
            showToast("Erreur de chargement des données: " + error.message, "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const { data: { subscription } } = authService.onAuthStateChange(async (_event, session) => {
            setSession(session);
            if (session) {
                const { data: userProfile, error } = await profileService.getProfile(session.user.id);
                if (error) {
                    showToast("Impossible de récupérer le profil utilisateur.", "error");
                    setLoading(false);
                } else {
                    setProfile(userProfile);
                    await refreshData(userProfile);
                }
            } else {
                setProfile(null);
                setLoading(false);
                navigate('/login');
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate, refreshData]);

    // ✅ CORRECTION: Écoute en temps réel optimisée avec des canaux spécifiques
    useEffect(() => {
        if (!profile) return;

        const interventionsChannel = supabase.channel('public:interventions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => refreshData(profile))
            .subscribe();

        const assignmentsChannel = supabase.channel('public:intervention_assignments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_assignments' }, () => refreshData(profile))
            .subscribe();

        const leavesChannel = supabase.channel('public:leave_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => refreshData(profile))
            .subscribe();

        const vaultChannel = supabase.channel('public:vault_documents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_documents' }, () => refreshData(profile))
            .subscribe();

        return () => {
            supabase.removeChannel(interventionsChannel);
            supabase.removeChannel(assignmentsChannel);
            supabase.removeChannel(leavesChannel);
            supabase.removeChannel(vaultChannel);
        };
    }, [profile, refreshData]);

    const handleLogout = async () => {
        const { error } = await authService.signOut();
        if (error) showToast("Erreur lors de la déconnexion.", "error");
    };

    // --- Fonctions de gestion des données (passées en props) ---
    const handleAddIntervention = async (formValues, assignedUsers, briefingFiles) => {
        const { error } = await interventionService.createIntervention(formValues, assignedUsers, briefingFiles);
        if (error) showToast("Erreur lors de l'ajout: " + error.message, "error");
        else showToast("Intervention ajoutée avec succès.");
    };
    const handleUpdateInterventionReport = async (interventionId, report) => {
        const { error } = await interventionService.updateInterventionReport(interventionId, report);
        if (error) showToast("Erreur de sauvegarde du rapport: " + error.message, "error");
        else { showToast("Rapport sauvegardé."); navigate('/planning'); }
    };
    const handleArchiveIntervention = (id) => {
        showConfirmationModal({
            title: "Archiver l'intervention ?",
            message: "L'intervention ne sera plus visible dans le planning mais pourra être consultée dans les archives.",
            onConfirm: async () => {
                const { error } = await interventionService.archiveIntervention(id);
                if (error) showToast("Erreur d'archivage.", "error"); else showToast("Intervention archivée.");
            }
        });
    };
    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible. L'intervention sera supprimée mais pas les fichiers associés.",
            onConfirm: async () => {
                const { error } = await interventionService.deleteIntervention(id);
                if (error) showToast("Erreur de suppression.", "error"); else showToast("Intervention supprimée.");
            }
        });
    };
    const handleUpdateUser = async (userData) => {
        const { error } = await profileService.updateProfile(userData.id, userData);
        if (error) showToast("Erreur de mise à jour: " + error.message, "error");
        else showToast("Profil mis à jour.");
    };
    const handleSendVaultDocument = async ({ file, userId, name }) => {
        const { error } = await vaultService.createVaultDocument({ file, userId, name });
        if (error) { showToast("Erreur d'envoi: " + error.message, "error"); throw error; }
        else showToast("Document envoyé avec succès.");
    };
    const handleDeleteVaultDocument = (docId) => {
        showConfirmationModal({
            title: "Supprimer ce document ?",
            message: "Le document sera supprimé définitivement pour cet employé.",
            onConfirm: async () => {
                const { error } = await vaultService.deleteVaultDocument(docId);
                if (error) showToast("Erreur de suppression.", "error"); else showToast("Document supprimé.");
            }
        });
    };
    const handleSubmitLeaveRequest = async ({ startDate, endDate, reason }) => {
        const { error } = await leaveService.createRequest(startDate, endDate, reason);
        if (error) showToast("Erreur d'envoi: " + error.message, "error");
        else showToast("Demande de congé envoyée.");
    };
    const handleUpdateLeaveStatus = async (id, status, reason) => {
        const { error } = await leaveService.updateRequestStatus(id, status, reason);
        if (error) showToast("Erreur de mise à jour.", "error");
        else showToast("Statut de la demande mis à jour.");
    };

    if (loading && !profile) return <div className="loading-container"><div className="loading-spinner"></div></div>;

    return (
        <>
            {toast.show && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ show: false })} />}
            {confirmation.show && <ConfirmationModal title={confirmation.title} message={confirmation.message} onConfirm={confirmation.onConfirm} onCancel={() => setConfirmation({ show: false })} />}
            <Routes>
                <Route path="/login" element={<LoginScreen onLogin={authService.signIn} />} />
                {!session ? <Route path="*" element={<Navigate to="/login" replace />} /> : (
                    <Route path="/" element={<AppLayout profile={profile} handleLogout={handleLogout} />}>
                        {profile.is_admin ? (
                            <>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="dashboard" element={<AdminDashboard interventions={interventions} leaveRequests={leaveRequests} />} />
                                <Route path="planning" element={<AdminPlanningView interventions={interventions} users={users} onAddIntervention={handleAddIntervention} onArchive={handleArchiveIntervention} onDelete={handleDeleteIntervention} />} />
                                <Route path="planning/:interventionId" element={<InterventionDetailView interventions={interventions} onSave={handleUpdateInterventionReport} isAdmin={profile.is_admin} />} />
                                <Route path="leaves" element={<AdminLeaveView leaveRequests={leaveRequests} onUpdateStatus={handleUpdateLeaveStatus} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="users" element={<AdminUserView users={users} onUpdateUser={handleUpdateUser} />} />
                                <Route path="vault" element={<AdminVaultView users={users} vaultDocuments={vaultDocuments} onSendDocument={handleSendVaultDocument} onDeleteDocument={handleDeleteVaultDocument} />} />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        ) : (
                            <>
                                <Route index element={<Navigate to="/planning" replace />} />
                                <Route path="planning" element={<EmployeePlanningView interventions={interventions} />} />
                                <Route path="planning/:interventionId" element={<InterventionDetailView interventions={interventions} onSave={handleUpdateInterventionReport} isAdmin={profile.is_admin} />} />
                                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                                <Route path="leaves" element={<EmployeeLeaveView leaveRequests={leaveRequests.filter(lr => lr.user_id === profile.id)} onSubmitRequest={handleSubmitLeaveRequest} />} />
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
