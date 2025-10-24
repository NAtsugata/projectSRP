// =============================
// FILE: src/App.js — FULL (sections pertinentes corrigées + page IR Douche)
// - Ajout buildSanitizedReport() qui conserve tous les champs du rapport
// - handleUpdateInterventionReportSilent(report) attend *directement* le report
// - handleUpdateInterventionReport(report) idem + statut
// - INTÉGRATION de la page IRShowerFormsView (import + nav + routes admin & employé)
// =============================
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
import IRShowerFormsView from './pages/IRShowerFormsView'; // ⬅️ NEW

// Import des composants UI partagés
import { Toast, ConfirmationModal } from './components/SharedUI';
import { UserIcon, LogOutIcon, LayoutDashboardIcon, CalendarIcon, BriefcaseIcon, ArchiveIcon, SunIcon, UsersIcon, FolderIcon, LockIcon } from './components/SharedUI';

// --- Composant de Layout (structure de la page) ---
const AppLayout = ({ profile, handleLogout }) => {
  const location = useLocation();
  const navItems = profile.is_admin
    ? [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboardIcon /> },
        { id: 'agenda', label: 'Agenda', icon: <CalendarIcon /> },
        { id: 'planning', label: 'Planning', icon: <BriefcaseIcon /> },
        { id: 'archives', label: 'Archives', icon: <ArchiveIcon /> },
        { id: 'leaves', label: 'Congés', icon: <SunIcon /> },
        { id: 'users', label: 'Employés', icon: <UsersIcon /> },
        { id: 'vault', label: 'Coffre-fort', icon: <FolderIcon /> },
        { id: 'ir-docs', label: 'IR Douche', icon: <FolderIcon /> }, // ⬅️ NEW
      ]
    : [
        { id: 'planning', label: 'Planning', icon: <BriefcaseIcon /> },
        { id: 'agenda', label: 'Agenda', icon: <CalendarIcon /> },
        { id: 'leaves', label: 'Congés', icon: <SunIcon /> },
        { id: 'vault', label: 'Coffre-fort', icon: <LockIcon /> },
        { id: 'ir-docs', label: 'IR Douche', icon: <FolderIcon /> }, // ⬅️ NEW
      ];

  return (
    <div className="app-container">
      {/* --- Barre de navigation pour Desktop --- */}
      <header className="app-header desktop-nav">
        <div className="header-content">
          <div className="flex-center" style={{ gap: '0.75rem' }}>
            <UserIcon />
            <span style={{ fontWeight: 600 }}>{profile.full_name || 'Utilisateur'}</span>
          </div>
          <nav className="main-nav">
            {navItems.map((item) => (
              <Link key={item.id} to={`/${item.id}`} className={`nav-button ${location.pathname.startsWith('/' + item.id) ? 'active' : ''}`}>
                {item.icon} <span className="nav-label">{item.label}</span>
              </Link>
            ))}
            <button onClick={handleLogout} className="nav-button">
              <LogOutIcon />
              <span className="nav-label">Déconnexion</span>
            </button>
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
          <div className="flex-center" style={{ gap: '0.5rem' }}>
            <UserIcon />
            <span>{profile.full_name || 'Utilisateur'}</span>
          </div>
          <button onClick={handleLogout} className="btn-icon-logout">
            <LogOutIcon />
          </button>
        </div>
        <div className="mobile-nav-icons">
          {navItems.map((item) => (
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

  const refreshData = useCallback(
    async (userProfile) => {
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
        showToast(`Erreur de chargement: ${error.message}`, 'error');
      }
    },
    [showToast]
  );

  useEffect(() => {
    const {
      data: { subscription }
    } = authService.onAuthStateChange((_event, sessionData) => {
      setSession(sessionData);
    });
    return () => subscription.unsubscribe();
  }, []);

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
      is_admin: updatedUserData.is_admin
    };

    const { error } = await profileService.updateProfile(updatedUserData.id, updates);

    if (error) {
      showToast(`Erreur mise à jour: ${error.message}`, 'error');
    } else {
      showToast('Profil mis à jour avec succès.');
      await refreshData(profile);
    }
  };

  const handleAddIntervention = async (interventionData, assignedUserIds, briefingFiles = []) => {
    const { data: newIntervention, error } = await interventionService.createIntervention(
      interventionData,
      assignedUserIds,
      briefingFiles
    );
    if (error) {
      showToast(`Erreur création intervention: ${error.message}`, 'error');
      return null;
    }
    showToast('Intervention créée avec succès.');
    await refreshData(profile);
    return newIntervention;
  };

  const handleAddBriefingDocuments = async (interventionId, files) => {
    try {
      const { error } = await interventionService.addBriefingDocuments(interventionId, files);
      if (error) throw error;
      showToast('Documents de préparation ajoutés avec succès.');
      await refreshData(profile);
    } catch (error) {
      showToast(`Erreur lors de l'ajout des documents : ${error.message}`, 'error');
      throw error;
    }
  };

  // 🔧 Sanitizer complet pour *tous* les champs du rapport
  const buildSanitizedReport = (report) => ({
    notes: report?.notes || '',
    files: Array.isArray(report?.files) ? report.files : [],
    arrivalTime: report?.arrivalTime || null,
    departureTime: report?.departureTime || null,
    signature: report?.signature || null,

    // ✅ nouveaux champs
    needs: Array.isArray(report?.needs) ? report.needs : [],
    supply_requests: Array.isArray(report?.supply_requests) ? report.supply_requests : [],
    quick_checkpoints: Array.isArray(report?.quick_checkpoints) ? report.quick_checkpoints : [],
    blocks: report?.blocks || null,
    arrivalGeo: report?.arrivalGeo || null,
    departureGeo: report?.departureGeo || null,
    rating: report?.rating ?? null,
    follow_up_required: !!report?.follow_up_required,
    parts_used: Array.isArray(report?.parts_used) ? report.parts_used : []
  });

  // ⚙️ Persistance silencieuse — attend le *report* directement
  const handleUpdateInterventionReportSilent = async (interventionId, report) => {
    const sanitizedReport = buildSanitizedReport(report);
    const { error } = await interventionService.updateIntervention(interventionId, {
      report: sanitizedReport
    });
    return { success: !error, error };
  };

  // 💾 Sauvegarde + statut
  const handleUpdateInterventionReport = async (interventionId, report) => {
    try {
      const newStatus = report?.departureTime ? 'Terminée' : 'En cours';
      const sanitizedReport = buildSanitizedReport(report);

      const { error } = await interventionService.updateIntervention(interventionId, {
        report: sanitizedReport,
        status: newStatus
      });

      if (error) throw error;
      showToast(newStatus === 'Terminée' ? 'Rapport sauvegardé et intervention clôturée.' : 'Rapport sauvegardé.');
      navigate('/planning');
      await refreshData(profile);
    } catch (error) {
      showToast('Erreur lors de la sauvegarde: ' + (error.message || 'Erreur inconnue'), 'error');
      throw error;
    }
  };

  const handleDeleteIntervention = (id) => {
    showConfirmationModal({
      title: "Supprimer l'intervention ?",
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        const { error } = await interventionService.deleteIntervention(id);
        if (error) showToast('Erreur suppression.', 'error');
        else showToast('Intervention supprimée.');
      }
    });
  };

  const handleArchiveIntervention = async (id) => {
    const { error } = await interventionService.updateIntervention(id, { is_archived: true });
    if (error) showToast('Erreur archivage.', 'error');
    else showToast('Intervention archivée.');
  };

  const handleSubmitLeaveRequest = async (requestData) => {
    try {
      const newRequest = {
        userId: profile.id,
        userName: profile.full_name,
        startDate: requestData.startDate,
        endDate: requestData.endDate,
        reason: requestData.reason
      };

      const { error } = await leaveService.createLeaveRequest(newRequest);
      if (error) throw error;
      showToast('Votre demande de congé a été envoyée.', 'success');
      await refreshData(profile);
    } catch (error) {
      console.error('❌ Erreur lors de la soumission de la demande de congé:', error);
      showToast(`Erreur lors de l'envoi: ${error.message}`, 'error');
    }
  };

  const handleUpdateLeaveStatus = async (requestId, status) => {
    const { error } = await leaveService.updateRequestStatus(requestId, status);
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error');
    } else {
      showToast(`La demande a été ${status.toLowerCase()}.`, 'success');
      await refreshData(profile);
    }
  };

  const handleDeleteLeaveRequest = (requestId) => {
    showConfirmationModal({
      title: 'Supprimer la demande ?',
      message: 'Cette action est irréversible.',
      onConfirm: async () => {
        const { error } = await leaveService.deleteLeaveRequest(requestId);
        if (error) {
          showToast(`Erreur: ${error.message}`, 'error');
        } else {
          showToast('La demande a été supprimée.', 'success');
        }
        await refreshData(profile);
      }
    });
  };

  // ✅ Envoi coffre-fort
  const handleSendVaultDocument = async ({ file, userId, name }) => {
    try {
      const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
      if (uploadError) throw uploadError;

      const { error: dbError } = await vaultService.createVaultDocument({
        userId,
        name,
        url: publicURL,
        path: filePath
      });
      if (dbError) throw dbError;

      showToast('Document envoyé avec succès !');
      await refreshData(profile);
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi du document:", error);
      showToast(`Erreur d'envoi: ${error.message}`, 'error');
      throw error;
    }
  };

  // ✅ Suppression coffre-fort
  const handleDeleteVaultDocument = (document) => {
    showConfirmationModal({
      title: 'Supprimer le document ?',
      message: `Êtes-vous sûr de vouloir supprimer "${document.file_name}" ? Cette action est irréversible.`,
      onConfirm: async () => {
        const { error } = await vaultService.deleteVaultDocument(document.id);
        if (error) {
          showToast(`Erreur: ${error.message}`, 'error');
        } else {
          showToast('Le document a été supprimé.', 'success');
        }
        await refreshData(profile);
      }
    });
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
        .desktop-nav { display: none; }
        .mobile-nav { position: fixed; bottom: 0; left: 0; right: 0; background-color: #ffffff; border-top: 1px solid #e5e7eb; z-index: 1000; padding-bottom: env(safe-area-inset-bottom, 0); box-shadow: 0 -2px 10px rgba(0,0,0,0.05); }
        .mobile-nav-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; background-color: #f8f9fa; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; font-weight: 500; }
        .btn-icon-logout { background: none; border: none; cursor: pointer; color: #4b5563; }
        .mobile-nav-icons { display: flex; justify-content: space-around; align-items: center; }
        .mobile-nav-button { display: flex; flex-direction: column; align-items: center; justify-content: center; flex-grow: 1; padding: 0.5rem 0.25rem; color: #6b7280; text-decoration: none; transition: color 0.2s ease; }
        .mobile-nav-button.active { color: #3b82f6; }
        .mobile-nav-button svg { width: 24px; height: 24px; }
        .mobile-nav-label { font-size: 0.7rem; margin-top: 2px; }
        .main-content { padding-bottom: 100px; }
        @media (min-width: 768px) { .desktop-nav { display: flex; } .mobile-nav { display: none; } .main-content { padding-bottom: 0; } }
      `}</style>

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
                <Route path="dashboard" element={<AdminDashboard interventions={interventions} leaveRequests={leaveRequests} />} />
                <Route path="agenda" element={<AgendaView interventions={interventions} />} />
                <Route
                  path="planning"
                  element={
                    <AdminPlanningView
                      interventions={interventions}
                      users={users}
                      onAddIntervention={handleAddIntervention}
                      onArchive={handleArchiveIntervention}
                      onDelete={handleDeleteIntervention}
                    />
                  }
                />
                <Route path="planning/:interventionId" element={<InterventionDetailView {...interventionDetailProps} />} />
                <Route path="archives" element={<AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />} />
                <Route
                  path="leaves"
                  element={<AdminLeaveView leaveRequests={leaveRequests} onUpdateStatus={handleUpdateLeaveStatus} onDelete={handleDeleteLeaveRequest} />}
                />
                <Route path="users" element={<AdminUserView users={users} onUpdateUser={handleUpdateUser} />} />
                <Route
                  path="vault"
                  element={<AdminVaultView users={users} vaultDocuments={vaultDocuments} onSendDocument={handleSendVaultDocument} onDeleteDocument={handleDeleteVaultDocument} />}
                />
                <Route path="ir-docs" element={<IRShowerFormsView />} /> {/* ⬅️ NEW */}
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
                  element={<EmployeeLeaveView leaveRequests={leaveRequests} onSubmitRequest={handleSubmitLeaveRequest} userName={profile.full_name} userId={profile.id} showToast={showToast} />}
                />
                <Route path="vault" element={<CoffreNumeriqueView vaultDocuments={vaultDocuments.filter((doc) => doc.user_id === profile.id)} />} />
                <Route path="ir-docs" element={<IRShowerFormsView />} /> {/* ⬅️ NEW */}
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
