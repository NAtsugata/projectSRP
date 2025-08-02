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

        } catch (error) {
            console.error('Erreur chargement données:', error);
            showToast(`Erreur de chargement: ${error.message}`, "error");
        }
    }, [showToast]);

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

    // MODIFIÉ: La gestion du temps réel est ajustée pour la stabilité
    useEffect(() => {
        if (profile) {
            refreshData(profile);
            // L'abonnement temps réel est conservé, mais le rafraîchissement automatique
            // qui causait les bugs a été désactivé. Le rafraîchissement est maintenant
            // géré manuellement après chaque action de l'utilisateur.
            const sub = supabase.channel('public-changes').on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                console.log('Changement détecté, rafraîchissement global désactivé pour la stabilité:', payload);
                // La ligne ci-dessous a été volontairement désactivée pour corriger le bug.
                // refreshData(profile);
            }).subscribe();
            return () => { supabase.removeChannel(sub); };
        }
    }, [profile, refreshData]);

    const handleLogout = async () => {
        const { error } = await authService.signOut();
        if (error) {
            showToast("Erreur lors de la déconnexion.", "error");
        }
        navigate('/login');
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleUpdateUser = async (updatedUserData) => {
        const { error } = await profileService.updateProfile(updatedUserData.id, updatedUserData);
        if (error) { showToast("Erreur mise à jour profil.", "error"); }
        else { showToast("Profil mis à jour."); await refreshData(profile); }
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleAddIntervention = async (interventionData, assignedUserIds, briefingFiles) => {
        const { error } = await interventionService.createIntervention(interventionData, assignedUserIds, briefingFiles);
        if (error) { showToast(`Erreur création intervention: ${error.message}`, "error"); }
        else { showToast("Intervention ajoutée."); await refreshData(profile); }
    };

    const handleUpdateInterventionReport = async (interventionId, report) => {
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
            await refreshData(profile);
        }
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await interventionService.deleteIntervention(id);
                if (error) { showToast("Erreur suppression.", "error"); }
                else { showToast("Intervention supprimée."); await refreshData(profile); }
            }
        });
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleArchiveIntervention = async (id) => {
        const { error } = await interventionService.updateIntervention(id, { is_archived: true });
        if (error) { showToast("Erreur archivage.", "error"); }
        else { showToast("Intervention archivée."); await refreshData(profile); }
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleUpdateLeaveStatus = (id, status) => {
        if (status === 'Rejeté') {
            showConfirmationModal({
                title: "Rejeter la demande",
                message: "Veuillez indiquer le motif du refus.",
                showInput: true,
                inputLabel: "Motif du refus",
                onConfirm: async (reason) => {
                    const { error } = await leaveService.updateRequestStatus(id, status, reason);
                    if (error) { showToast("Erreur mise à jour congé.", "error"); }
                    else { showToast("Statut de la demande mis à jour."); await refreshData(profile); }
                }
            });
        } else {
            leaveService.updateRequestStatus(id, status).then(async ({error}) => {
                if (error) { showToast("Erreur mise à jour congé.", "error"); }
                else { showToast("Statut de la demande mis à jour."); await refreshData(profile); }
            });
        }
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleDeleteLeaveRequest = (id) => {
        showConfirmationModal({
            title: "Supprimer la demande ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                const { error } = await leaveService.deleteLeaveRequest(id);
                if (error) { showToast("Erreur suppression.", "error"); }
                else { showToast("Demande supprimée."); await refreshData(profile); }
            }
        });
    };

    // MODIFIÉ: Ajout d'un rafraîchissement manuel après l'action.
    const handleSubmitLeaveRequest = async (requestData) => {
        const { error } = await leaveService.createLeaveRequest(requestData);
        if (error) { showToast("Erreur envoi demande.", "error"); }
        else { showToast("Demande de congé envoyée."); await refreshData(profile); }
    };

    const handleSendDocument = async ({ file, userId, name }) => {
        try {
            const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
            if (uploadError) throw uploadError;
            const { error: dbError } = await vaultService.createVaultDocument({ userId, name, url: publicURL, path: filePath });
            if (dbError) throw dbError;
            await refreshData(profile);
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
                    await refreshData(profile);
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
            await refreshData(profile);
        } catch (error) {
            showToast(`Erreur lors de l'ajout des documents : ${error.message}`, "error");
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement...</p>
            </div>
        );
    }

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
                                    element={<InterventionDetailView
                                        interventions={interventions}
                                        onSave={handleUpdateInterventionReport}
                                        isAdmin={profile.is_admin}
                                        onAddBriefingDocuments={handleAddBriefingDocuments}
                                    />}
                                />
                                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                                <Route path="leaves" element={<AdminLeaveView leaveRequests={leaveRequests} onUpdateRequestStatus={handleUpdateLeaveStatus} onDeleteLeaveRequest={handleDeleteLeaveRequest} />} />
                                <Route path="users" element={<AdminUserView users={users} onUpdateUser={handleUpdateUser} />} />
                                <Route
                                    path="vault"
                                    element={<AdminVaultView
                                        users={users}
                                        vaultDocuments={vaultDocuments}
                                        onSendDocument={handleSendDocument}
                                        onDeleteDocument={handleDeleteDocument}
                                    />}
                                />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </>
                        ) : (
                            <>
                                <Route index element={<Navigate to="/planning" replace />} />
                                <Route path="planning" element={<EmployeePlanningView interventions={interventions} />} />
                                <Route
                                    path="planning/:interventionId"
                                    element={<InterventionDetailView
                                        interventions={interventions}
                                        onSave={handleUpdateInterventionReport}
                                        isAdmin={profile.is_admin}
                                    />}
                                />
                                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                                <Route path="leaves" element={<EmployeeLeaveView leaveRequests={leaveRequests} onSubmitRequest={handleSubmitLeaveRequest} userName={profile?.full_name} userId={profile?.id} showToast={showToast} />} />
                                <Route
                                    path="vault"
                                    element={<CoffreNumeriqueView
                                        vaultDocuments={vaultDocuments.filter(doc => doc.user_id === profile.id)}
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
