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
            console.log('✅ Profils chargés:', (profilesRes.data || []).length);

            if (interventionsRes.error) throw interventionsRes.error;
            setInterventions(interventionsRes.data || []);
            console.log('✅ Interventions chargées:', (interventionsRes.data || []).length);

            if (leavesRes.error) throw leavesRes.error;
            setLeaveRequests(leavesRes.data || []);
            console.log('✅ Demandes de congé chargées:', (leavesRes.data || []).length);

            if (vaultRes.error) throw vaultRes.error;
            setVaultDocuments(vaultRes.data || []);
            console.log('✅ Documents coffre-fort chargés:', (vaultRes.data || []).length);

        } catch (error) {
            console.error('❌ Erreur chargement données:', error);
            showToast(`Erreur de chargement: ${error.message}`, "error");
        }
    }, [showToast]);

    useEffect(() => {
        const { data: { subscription } } = authService.onAuthStateChange((_event, sessionData) => {
            console.log('🔐 Changement d\'état d\'authentification:', _event);
            setSession(sessionData);
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session?.user) {
            setLoading(true);
            console.log('👤 Chargement du profil pour:', session.user.email);

            profileService.getProfile(session.user.id)
                .then(({ data: userProfile, error }) => {
                    if (error) {
                        console.error("❌ Error fetching profile:", error);
                        showToast("Impossible de récupérer le profil.", "error");
                        authService.signOut();
                    } else {
                        console.log('✅ Profil chargé:', userProfile?.full_name);
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
            refreshData(profile);

            // ✅ AMÉLIORATION: Listener temps réel plus spécifique
            const sub = supabase
                .channel('public-changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'interventions'
                }, (payload) => {
                    console.log('🔄 Changement détecté dans interventions:', payload);
                    refreshData(profile);
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'leave_requests'
                }, (payload) => {
                    console.log('🔄 Changement détecté dans leave_requests:', payload);
                    refreshData(profile);
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'vault_documents'
                }, (payload) => {
                    console.log('🔄 Changement détecté dans vault_documents:', payload);
                    refreshData(profile);
                })
                .subscribe();

            return () => {
                console.log('🔌 Déconnexion des listeners temps réel');
                supabase.removeChannel(sub);
            };
        }
    }, [profile, refreshData]);

    const handleLogout = async () => {
        console.log('🚪 Déconnexion en cours...');
        const { error } = await authService.signOut();
        if (error) {
            showToast("Erreur lors de la déconnexion.", "error");
        } else {
            console.log('✅ Déconnexion réussie');
        }
        navigate('/login');
    };

    const handleUpdateUser = async (updatedUserData) => {
        console.log('👤 Mise à jour utilisateur:', updatedUserData.full_name);
        const { error } = await profileService.updateProfile(updatedUserData.id, updatedUserData);
        if (error) {
            console.error('❌ Erreur mise à jour profil:', error);
            showToast("Erreur mise à jour profil.", "error");
        } else {
            console.log('✅ Profil mis à jour avec succès');
            showToast("Profil mis à jour.");
        }
    };

    const handleAddIntervention = async (interventionData, assignedUserIds, briefingFiles) => {
        console.log('➕ Création intervention:', interventionData.client);
        const { error } = await interventionService.createIntervention(interventionData, assignedUserIds, briefingFiles);
        if (error) {
            console.error('❌ Erreur création intervention:', error);
            showToast(`Erreur création intervention: ${error.message}`, "error");
        } else {
            console.log('✅ Intervention créée avec succès');
            showToast("Intervention ajoutée.");
        }
    };

    // ✅ NOUVELLE FONCTION: Sauvegarde silencieuse SANS changement de statut
    const handleUpdateInterventionReportSilent = async (interventionId, report) => {
        try {
            console.log('💾 Sauvegarde silencieuse du rapport (SANS changement de statut)');
            console.log('📄 Données du rapport:', {
                notesLength: report.notes?.length || 0,
                filesCount: report.files?.length || 0,
                hasArrival: !!report.arrivalTime,
                hasDeparture: !!report.departureTime,
                hasSignature: !!report.signature
            });

            // ✅ CORRECTION: S'assurer que tous les champs sont correctement sérialisés
            const sanitizedReport = {
                notes: report.notes || '',
                files: Array.isArray(report.files) ? report.files : [],
                arrivalTime: report.arrivalTime || null,
                departureTime: report.departureTime || null,
                signature: report.signature || null
            };

            console.log('📁 Fichiers à sauvegarder:', sanitizedReport.files.map(f => f.name));

            // ✅ SAUVEGARDE EN BASE DE DONNÉES SANS CHANGEMENT DE STATUT
            const { error } = await interventionService.updateIntervention(interventionId, {
                report: sanitizedReport
                // ❌ PAS de changement de statut ici !
            });

            if (error) {
                console.error('❌ Erreur sauvegarde silencieuse:', error);
                throw error;
            }

            console.log('✅ Rapport sauvegardé silencieusement (intervention reste ouverte)');
            return { success: true };

        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde silencieuse:', error);
            return { success: false, error };
        }
    };

    // ✅ CORRECTION PRINCIPALE: Fonction de gestion des rapports améliorée POUR LA FERMETURE
    const handleUpdateInterventionReport = async (interventionId, report) => {
        try {
            console.log('🔒 SAUVEGARDE FINALE avec clôture potentielle:', interventionId);
            console.log('📄 Données du rapport:', {
                notesLength: report.notes?.length || 0,
                filesCount: report.files?.length || 0,
                hasArrival: !!report.arrivalTime,
                hasDeparture: !!report.departureTime,
                hasSignature: !!report.signature
            });

            // Détermine le nouveau statut en fonction du rapport
            const newStatus = report.departureTime ? 'Terminée' : 'En cours';

            // ✅ CORRECTION: S'assurer que tous les champs sont correctement sérialisés
            const sanitizedReport = {
                notes: report.notes || '',
                files: Array.isArray(report.files) ? report.files : [],
                arrivalTime: report.arrivalTime || null,
                departureTime: report.departureTime || null,
                signature: report.signature || null
            };

            console.log('💾 Sauvegarde finale avec statut:', newStatus);
            console.log('📁 Fichiers à sauvegarder:', sanitizedReport.files.map(f => f.name));

            // ✅ SAUVEGARDE EN BASE DE DONNÉES AVEC CHANGEMENT DE STATUT
            const { error } = await interventionService.updateIntervention(interventionId, {
                report: sanitizedReport,
                status: newStatus
            });

            if (error) {
                console.error('❌ Erreur sauvegarde finale:', error);
                showToast("Erreur sauvegarde rapport: " + error.message, "error");
                throw error;
            }

            // ✅ SUCCÈS
            console.log('✅ Rapport sauvegardé avec succès et intervention clôturée si nécessaire');

            if (newStatus === 'Terminée') {
                showToast("Rapport sauvegardé et intervention clôturée.");
            } else {
                showToast("Rapport sauvegardé. L'intervention est maintenant 'En cours'.");
            }

            // ✅ NAVIGATION ET REFRESH
            navigate('/planning');

            // ✅ FORCER LE REFRESH DES DONNÉES
            await refreshData(profile);

            console.log('🔄 Données rafraîchies après sauvegarde finale');

        } catch (error) {
            console.error('❌ Erreur complète lors de la sauvegarde finale:', error);
            showToast("Erreur lors de la sauvegarde: " + (error.message || 'Erreur inconnue'), "error");
            throw error;
        }
    };

    const handleDeleteIntervention = (id) => {
        showConfirmationModal({
            title: "Supprimer l'intervention ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                console.log('🗑️ Suppression intervention:', id);
                const { error } = await interventionService.deleteIntervention(id);
                if (error) {
                    console.error('❌ Erreur suppression:', error);
                    showToast("Erreur suppression.", "error");
                } else {
                    console.log('✅ Intervention supprimée');
                    showToast("Intervention supprimée.");
                }
            }
        });
    };

    const handleArchiveIntervention = async (id) => {
        console.log('📦 Archivage intervention:', id);
        const { error } = await interventionService.updateIntervention(id, { is_archived: true });
        if (error) {
            console.error('❌ Erreur archivage:', error);
            showToast("Erreur archivage.", "error");
        } else {
            console.log('✅ Intervention archivée');
            showToast("Intervention archivée.");
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
                    console.log('❌ Rejet demande congé:', id, 'Motif:', reason);
                    const { error } = await leaveService.updateRequestStatus(id, status, reason);
                    if (error) {
                        console.error('❌ Erreur mise à jour congé:', error);
                        showToast("Erreur mise à jour congé.", "error");
                    } else {
                        console.log('✅ Demande rejetée');
                        showToast("Statut de la demande mis à jour.");
                    }
                }
            });
        } else {
            console.log('✅ Approbation demande congé:', id);
            leaveService.updateRequestStatus(id, status).then(({error}) => {
                if (error) {
                    console.error('❌ Erreur mise à jour congé:', error);
                    showToast("Erreur mise à jour congé.", "error");
                } else {
                    console.log('✅ Demande approuvée');
                    showToast("Statut de la demande mis à jour.");
                }
            });
        }
    };

    const handleDeleteLeaveRequest = (id) => {
        showConfirmationModal({
            title: "Supprimer la demande ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                console.log('🗑️ Suppression demande congé:', id);
                const { error } = await leaveService.deleteLeaveRequest(id);
                if (error) {
                    console.error('❌ Erreur suppression:', error);
                    showToast("Erreur suppression.", "error");
                } else {
                    console.log('✅ Demande supprimée');
                    showToast("Demande supprimée.");
                }
            }
        });
    };

    const handleSubmitLeaveRequest = async (requestData) => {
        console.log('📝 Soumission demande congé:', requestData);
        const { error } = await leaveService.createLeaveRequest(requestData);
        if (error) {
            console.error('❌ Erreur envoi demande:', error);
            showToast("Erreur envoi demande.", "error");
        } else {
            console.log('✅ Demande envoyée');
            showToast("Demande de congé envoyée.");
        }
    };

    const handleSendDocument = async ({ file, userId, name }) => {
        try {
            console.log('📎 Envoi document:', name, 'pour utilisateur:', userId);
            const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
            if (uploadError) throw uploadError;

            const { error: dbError } = await vaultService.createVaultDocument({ userId, name, url: publicURL, path: filePath });
            if (dbError) throw dbError;

            await refreshData(profile);
            console.log('✅ Document envoyé avec succès');
            showToast("Document envoyé avec succès.");
        } catch (error) {
            console.error("❌ Erreur lors de l'envoi du document:", error);
            showToast(`Erreur lors de l'envoi: ${error.message}`, "error");
        }
    };

    const handleDeleteDocument = async (documentId) => {
        showConfirmationModal({
            title: "Supprimer ce document ?",
            message: "Cette action est irréversible et supprimera le fichier définitivement.",
            onConfirm: async () => {
                console.log('🗑️ Suppression document:', documentId);
                const { error } = await vaultService.deleteVaultDocument(documentId);
                if (error) {
                    console.error('❌ Erreur suppression document:', error);
                    showToast("Erreur lors de la suppression : " + error.message, "error");
                } else {
                    console.log('✅ Document supprimé');
                    showToast("Document supprimé.");
                    await refreshData(profile);
                }
            }
        });
    };

    const handleAddBriefingDocuments = async (interventionId, files) => {
        try {
            console.log('📋 Ajout documents préparation pour intervention:', interventionId);
            const { error } = await interventionService.addBriefingDocuments(interventionId, files);
            if (error) {
                throw error;
            }
            console.log('✅ Documents de préparation ajoutés');
            showToast("Documents de préparation ajoutés avec succès.");
            await refreshData(profile);
        } catch (error) {
            console.error('❌ Erreur ajout documents préparation:', error);
            showToast(`Erreur lors de l'ajout des documents : ${error.message}`, "error");
            throw error;
        }
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
                                        onSaveSilent={handleUpdateInterventionReportSilent}
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
                                        onSaveSilent={handleUpdateInterventionReportSilent}
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