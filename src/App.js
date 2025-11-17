// =============================
// FILE: src/App.js — FULL (sections pertinentes corrigées + page IR Douche)
// - Ajout buildSanitizedReport() qui conserve tous les champs du rapport
// - handleUpdateInterventionReportSilent(report) attend *directement* le report
// - handleUpdateInterventionReport(report) idem + statut
// - INTÉGRATION de la page IRShowerFormsView (import + nav + routes admin & employé)
// =============================
import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService, profileService, interventionService, leaveService, vaultService, storageService, supabase } from './lib/supabase';
import expenseService from './services/expenseService';
import checklistService from './services/checklistService';
import scannedDocumentsService from './services/scannedDocumentsService';
import { buildSanitizedReport } from './utils/reportHelpers';
import { validateIntervention, validateUser, validateLeaveRequest, validateFileSize } from './utils/validators';
import { Toast, ConfirmationModal } from './components/SharedUI';
import { UserIcon, LogOutIcon, LayoutDashboardIcon, CalendarIcon, BriefcaseIcon, ArchiveIcon, SunIcon, UsersIcon, FolderIcon, LockIcon, DollarSignIcon, CheckCircleIcon, FileTextIcon } from './components/SharedUI';
import LoginScreen from './pages/LoginScreen';
import { useRealtimePushNotifications } from './hooks/usePushNotifications';
import { NotificationPermissionManager } from './components/mobile/NotificationPermissionPrompt';
import { debounce } from './utils/debounce';
import { setToastFunction, overrideAlert } from './utils/alertOverride';
import './App.css';

// Lazy loading pour les autres pages (améliore les performances)
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
        { id: 'documents', label: 'Mes Documents', icon: <FileTextIcon /> },
        { id: 'checklist-templates', label: 'Checklists', icon: <CheckCircleIcon /> },
        { id: 'expenses', label: 'Notes de Frais', icon: <DollarSignIcon /> },
        { id: 'ir-docs', label: 'IR Douche', icon: <FolderIcon /> },
      ]
    : [
        { id: 'planning', label: 'Planning', icon: <BriefcaseIcon /> },
        { id: 'agenda', label: 'Agenda', icon: <CalendarIcon /> },
        { id: 'leaves', label: 'Congés', icon: <SunIcon /> },
        { id: 'vault', label: 'Coffre-fort', icon: <LockIcon /> },
        { id: 'documents', label: 'Mes Documents', icon: <FileTextIcon /> },
        { id: 'checklists', label: 'Checklists', icon: <CheckCircleIcon /> },
        { id: 'expenses', label: 'Notes de Frais', icon: <DollarSignIcon /> },
        { id: 'ir-docs', label: 'IR Douche', icon: <FolderIcon /> },
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
  const [expenses, setExpenses] = useState([]);
  const [checklistTemplates, setChecklistTemplates] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [scannedDocuments, setScannedDocuments] = useState([]);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const navigate = useNavigate();

  const [dataVersion, setDataVersion] = useState(Date.now());

  // ✅ Hook de notifications push en temps réel
  const pushNotifications = useRealtimePushNotifications(profile?.id);

  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const showConfirmationModal = useCallback((config) => setModal(config), []);

  // ✅ Override window.alert pour utiliser des toasts
  useEffect(() => {
    setToastFunction(showToast);
    overrideAlert();
    console.log('✅ alert() remplacé par des toasts');
  }, [showToast]);

  const refreshData = useCallback(
    async (userProfile) => {
      if (!userProfile) return;
      try {
        const isAdmin = userProfile.is_admin;
        const userId = userProfile.id;
        const [profilesRes, interventionsRes, leavesRes, vaultRes, expensesRes, templatesRes, checklistsRes, scannedDocsRes] = await Promise.all([
          profileService.getAllProfiles(),
          interventionService.getInterventions(isAdmin ? null : userId, false),
          leaveService.getLeaveRequests(isAdmin ? null : userId),
          vaultService.getVaultDocuments(),
          isAdmin ? expenseService.getAllExpenses() : expenseService.getUserExpenses(userId),
          checklistService.getAllTemplates(),
          isAdmin ? checklistService.getAllChecklists() : checklistService.getUserChecklists(userId),
          isAdmin ? scannedDocumentsService.getAllDocuments() : scannedDocumentsService.getUserDocuments(userId)
        ]);

        if (profilesRes.error) throw profilesRes.error;
        setUsers(profilesRes.data || []);

        if (interventionsRes.error) throw interventionsRes.error;
        setInterventions(interventionsRes.data || []);

        if (leavesRes.error) throw leavesRes.error;
        setLeaveRequests(leavesRes.data || []);

        if (vaultRes.error) throw vaultRes.error;
        setVaultDocuments(vaultRes.data || []);

        if (expensesRes.error) throw expensesRes.error;
        setExpenses(expensesRes.data || []);

        if (templatesRes.error) throw templatesRes.error;
        setChecklistTemplates(templatesRes.data || []);

        if (checklistsRes.error) throw checklistsRes.error;
        setChecklists(checklistsRes.data || []);

        if (scannedDocsRes.error) throw scannedDocsRes.error;
        setScannedDocuments(scannedDocsRes.data || []);

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

      // ✅ Créer une version debounced de refreshData pour éviter les race conditions
      // Debounce avec leading: true pour un premier rafraîchissement immédiat,
      // puis regroupe les autres appels dans les 1000ms suivantes
      const refreshDebounced = debounce(
        (prof) => {
          console.log('🔄 Refresh debounced triggered');
          refreshData(prof);
        },
        1000,
        { leading: true, trailing: true }
      );

      // Optimisation : écouter uniquement les tables pertinentes au lieu de toutes les tables
      const sub = supabase
        .channel('app-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          refreshDebounced(profile);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => {
          refreshDebounced(profile);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_assignments' }, () => {
          refreshDebounced(profile);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          refreshDebounced(profile);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_documents' }, () => {
          refreshDebounced(profile);
        })
        .subscribe();

      return () => {
        refreshDebounced.cancel(); // ✅ Annuler les debounces en cours
        supabase.removeChannel(sub);
      };
    }
  }, [profile, refreshData]);

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/login');
  };

  const handleUpdateUser = async (updatedUserData) => {
    // Validation des données utilisateur
    const validation = validateUser(updatedUserData);
    if (!validation.isValid) {
      showToast(`Validation échouée: ${validation.errors.join(', ')}`, 'error');
      return;
    }

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
    // Validation des données d'intervention
    const validation = validateIntervention(interventionData);
    if (!validation.isValid) {
      showToast(`Validation échouée: ${validation.errors.join(', ')}`, 'error');
      return null;
    }

    // Validation des fichiers
    if (briefingFiles && briefingFiles.length > 0) {
      for (const file of briefingFiles) {
        const sizeValidation = validateFileSize(file.size);
        if (!sizeValidation.isValid) {
          showToast(`${file.name}: ${sizeValidation.message}`, 'error');
          return null;
        }
      }
    }

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
        if (error) {
          showToast('Erreur suppression.', 'error');
        } else {
          showToast('Intervention supprimée.');
          await refreshData(profile);
        }
      }
    });
  };

  const handleArchiveIntervention = async (id) => {
    const { error } = await interventionService.updateIntervention(id, { is_archived: true });
    if (error) showToast('Erreur archivage.', 'error');
    else showToast('Intervention archivée.');
  };

  const handleUpdateScheduledDates = async (interventionId, scheduledDates) => {
    try {
      const { error } = await interventionService.updateIntervention(interventionId, {
        scheduled_dates: scheduledDates.length > 0 ? scheduledDates : null
      });

      if (error) throw error;

      showToast('Dates planifiées mises à jour.', 'success');
      await refreshData(profile);
    } catch (error) {
      showToast('Erreur lors de la mise à jour des dates: ' + (error.message || 'Erreur inconnue'), 'error');
      throw error;
    }
  };

  const handleSubmitLeaveRequest = async (requestData) => {
    try {
      // Validation de la demande de congé
      const validation = validateLeaveRequest(requestData);
      if (!validation.isValid) {
        showToast(`Validation échouée: ${validation.errors.join(', ')}`, 'error');
        return;
      }

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
  const handleSendVaultDocument = async ({ file, userId, name, fileSize = null, description = '', tags = [] }) => {
    try {
      console.log('🏦 handleSendVaultDocument appelé avec:', {
        fileName: file?.name,
        fileSize: file?.size,
        userId,
        name
      });

      // Validation de la taille du fichier
      const sizeValidation = validateFileSize(file.size, 20); // 20MB max pour coffre-fort
      console.log('🏦 Validation taille:', sizeValidation);
      if (!sizeValidation.isValid) {
        console.error('❌ Fichier trop volumineux');
        showToast(sizeValidation.message, 'error');
        return;
      }

      console.log('🏦 Appel uploadVaultFile...');
      const { publicURL, filePath, error: uploadError } = await storageService.uploadVaultFile(file, userId);
      console.log('🏦 Résultat uploadVaultFile:', { publicURL, filePath, uploadError });
      if (uploadError) throw uploadError;

      const { error: dbError } = await vaultService.createVaultDocument({
        userId,
        name,
        url: publicURL,
        path: filePath,
        fileSize: fileSize || file.size,
        description,
        tags
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

  // ✅ Soumettre une note de frais (employé)
  const handleSubmitExpense = async ({ date, category, amount, description, receipts, userId }) => {
    try {
      console.log('💰 handleSubmitExpense appelé avec:', {
        date,
        category,
        amount,
        description,
        receiptsCount: receipts.length,
        userId
      });

      const { error } = await expenseService.createExpense({
        userId,
        date,
        category,
        amount,
        description,
        receipts
      });

      if (error) throw error;

      showToast('Note de frais soumise avec succès !', 'success');
      await refreshData(profile);
    } catch (error) {
      console.error('❌ Erreur lors de la soumission de la note de frais:', error);
      showToast(`Erreur: ${error.message}`, 'error');
      throw error;
    }
  };

  // ✅ Approuver une note de frais (admin)
  const handleApproveExpense = async (expense, comment = '') => {
    try {
      console.log('✅ handleApproveExpense appelé pour:', expense.id);

      const { error } = await expenseService.approveExpense(expense.id, profile.id, comment);

      if (error) throw error;

      showToast('Note de frais approuvée !', 'success');
      await refreshData(profile);
    } catch (error) {
      console.error('❌ Erreur lors de l\'approbation:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    }
  };

  // ✅ Rejeter une note de frais (admin)
  const handleRejectExpense = async (expense, comment) => {
    try {
      console.log('❌ handleRejectExpense appelé pour:', expense.id);

      const { error } = await expenseService.rejectExpense(expense.id, profile.id, comment);

      if (error) throw error;

      showToast('Note de frais rejetée.', 'info');
      await refreshData(profile);
    } catch (error) {
      console.error('❌ Erreur lors du rejet:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    }
  };

  // ✅ Supprimer une note de frais (employé - seulement si pending)
  const handleDeleteExpense = (expense) => {
    showConfirmationModal({
      title: 'Supprimer la note de frais ?',
      message: `Êtes-vous sûr de vouloir supprimer cette note de frais de ${expense.amount}€ ? Cette action est irréversible.`,
      onConfirm: async () => {
        const { error } = await expenseService.deleteExpense(expense.id, profile.id);
        if (error) {
          showToast(`Erreur: ${error.message}`, 'error');
        } else {
          showToast('Note de frais supprimée.', 'success');
        }
        await refreshData(profile);
      }
    });
  };

  // ✅ Supprimer une note de frais (admin - n'importe quel statut)
  const handleDeleteExpenseAdmin = (expense) => {
    showConfirmationModal({
      title: 'Supprimer la note de frais ?',
      message: `Êtes-vous sûr de vouloir supprimer cette note de frais de ${expense.amount}€ (${expense.status}) ? Cette action est irréversible.`,
      onConfirm: async () => {
        const { error } = await expenseService.deleteExpenseAdmin(expense.id);
        if (error) {
          showToast(`Erreur: ${error.message}`, 'error');
        } else {
          showToast('Note de frais supprimée.', 'success');
        }
        await refreshData(profile);
      }
    });
  };

  // ✅ Créer un template de checklist (admin)
  const handleCreateTemplate = async (templateData) => {
    const { error } = await checklistService.createTemplate(templateData);
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error');
    } else {
      showToast('Template créé !', 'success');
      await refreshData(profile);
    }
  };

  // ✅ Mettre à jour un template de checklist (admin)
  const handleUpdateTemplate = async (templateData) => {
    const { error } = await checklistService.updateTemplate(templateData);
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error');
    } else {
      showToast('Template mis à jour !', 'success');
      await refreshData(profile);
    }
  };

  // ✅ Supprimer un template de checklist (admin)
  const handleDeleteTemplate = async (templateId) => {
    const { error } = await checklistService.deleteTemplate(templateId);
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error');
    } else {
      showToast('Template supprimé', 'success');
      await refreshData(profile);
    }
  };

  // ✅ Assigner une checklist à une intervention (admin)
  const handleAssignChecklist = async (interventionId, templateId) => {
    const intervention = interventions.find(i => i.id === interventionId);

    // Extraire les user_id depuis intervention_assignments
    const assignedUserIds = intervention?.intervention_assignments
      ?.map(assignment => assignment.user_id)
      .filter(Boolean) || [];

    if (!intervention || assignedUserIds.length === 0) {
      showToast('Aucun employé assigné à cette intervention', 'error');
      return;
    }

    const { error } = await checklistService.assignChecklistToIntervention(
      interventionId,
      templateId,
      assignedUserIds
    );

    if (error) {
      showToast(`Erreur: ${error.message}`, 'error');
    } else {
      showToast('Checklist assignée !', 'success');
      await refreshData(profile);
    }
  };

  // ✅ Mettre à jour une checklist (employé)
  const handleUpdateChecklist = async (checklistData) => {
    const { error } = await checklistService.updateChecklist(checklistData);
    if (error) {
      showToast(`Erreur: ${error.message}`, 'error');
      throw error;
    } else {
      await refreshData(profile);
    }
  };

  // ===== HANDLERS DOCUMENTS SCANNÉS =====

  // Sauvegarder des documents scannés
  const handleSaveDocuments = async (scannedDocs, metadata) => {
    try {
      if (!scannedDocs || scannedDocs.length === 0) {
        throw new Error('Aucun document à sauvegarder');
      }

      // Convertir les blobs en Files pour l'upload
      const files = scannedDocs.map(doc => doc.blob);

      const { data, error } = await scannedDocumentsService.createMultipleDocuments({
        userId: metadata.user_id,
        title: metadata.title,
        category: metadata.category,
        tags: metadata.tags || [],
        files,
        description: metadata.description || ''
      });

      if (error) throw error;

      showToast(`${files.length} document(s) sauvegardé(s) !`, 'success');
      await refreshData(profile);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur handleSaveDocuments:', error);
      showToast(`Erreur: ${error.message}`, 'error');
      throw error;
    }
  };

  // Supprimer un document scanné
  const handleDeleteDocument = async (documentId) => {
    try {
      const doc = scannedDocuments.find(d => d.id === documentId);
      if (!doc) throw new Error('Document introuvable');

      const { error } = await scannedDocumentsService.deleteDocument(documentId, doc.file_url);
      if (error) throw error;

      showToast('Document supprimé', 'success');
      await refreshData(profile);
    } catch (error) {
      console.error('❌ Erreur handleDeleteDocument:', error);
      showToast(`Erreur: ${error.message}`, 'error');
      throw error;
    }
  };

  // Mettre à jour un document scanné
  const handleUpdateDocument = async (documentId, updates) => {
    try {
      const { error } = await scannedDocumentsService.updateDocument(documentId, updates);
      if (error) throw error;

      showToast('Document mis à jour', 'success');
      await refreshData(profile);
    } catch (error) {
      console.error('❌ Erreur handleUpdateDocument:', error);
      showToast(`Erreur: ${error.message}`, 'error');
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

  const interventionDetailProps = {
    interventions,
    onSave: handleUpdateInterventionReport,
    onSaveSilent: handleUpdateInterventionReportSilent,
    isAdmin: profile?.is_admin,
    onAddBriefingDocuments: handleAddBriefingDocuments,
    onUpdateScheduledDates: handleUpdateScheduledDates,
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
                <Route path="dashboard" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AdminDashboard interventions={interventions} leaveRequests={leaveRequests} />
                  </Suspense>
                } />
                <Route path="agenda" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AgendaView
                      interventions={interventions}
                      employees={users}
                      loading={loading}
                      onSelect={(intervention) => navigate(`/planning/intervention/${intervention.id}`)}
                    />
                  </Suspense>
                } />
                <Route
                  path="planning"
                  element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminPlanningView
                        interventions={interventions}
                        users={users}
                        onAddIntervention={handleAddIntervention}
                        onArchive={handleArchiveIntervention}
                        onDelete={handleDeleteIntervention}
                        checklistTemplates={checklistTemplates}
                        onAssignChecklist={handleAssignChecklist}
                      />
                    </Suspense>
                  }
                />
                <Route path="planning/:interventionId" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <InterventionDetailView {...interventionDetailProps} />
                  </Suspense>
                } />
                <Route path="archives" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AdminArchiveView showToast={showToast} showConfirmationModal={showConfirmationModal} />
                  </Suspense>
                } />
                <Route
                  path="leaves"
                  element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminLeaveView leaveRequests={leaveRequests} onUpdateStatus={handleUpdateLeaveStatus} onDelete={handleDeleteLeaveRequest} />
                    </Suspense>
                  }
                />
                <Route path="users" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AdminUserView users={users} onUpdateUser={handleUpdateUser} />
                  </Suspense>
                } />
                <Route
                  path="vault"
                  element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <AdminVaultView users={users} vaultDocuments={vaultDocuments} onSendDocument={handleSendVaultDocument} onDeleteDocument={handleDeleteVaultDocument} />
                    </Suspense>
                  }
                />
                <Route path="documents" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <MyDocumentsView
                      scannedDocuments={scannedDocuments}
                      profile={profile}
                      users={users}
                      onSaveDocuments={handleSaveDocuments}
                      onDeleteDocument={handleDeleteDocument}
                      onUpdateDocument={handleUpdateDocument}
                    />
                  </Suspense>
                } />
                <Route path="checklist-templates" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AdminChecklistTemplatesView
                      templates={checklistTemplates}
                      onCreateTemplate={handleCreateTemplate}
                      onUpdateTemplate={handleUpdateTemplate}
                      onDeleteTemplate={handleDeleteTemplate}
                    />
                  </Suspense>
                } />
                <Route path="expenses" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AdminExpensesView users={users} expenses={expenses} onApproveExpense={handleApproveExpense} onRejectExpense={handleRejectExpense} onDeleteExpense={handleDeleteExpenseAdmin} />
                  </Suspense>
                } />
                <Route path="ir-docs" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <IRShowerFormsView profile={profile} />
                  </Suspense>
                } />
                <Route path="mobile-diagnostics" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <MobileDiagnosticsPage />
                  </Suspense>
                } />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </>
            ) : (
              <>
                <Route index element={<Navigate to="/planning" replace />} />
                <Route path="planning" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <EmployeePlanningView interventions={interventions} />
                  </Suspense>
                } />
                <Route path="planning/:interventionId" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <InterventionDetailView {...interventionDetailProps} />
                  </Suspense>
                } />
                <Route path="agenda" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <AgendaView
                      interventions={interventions}
                      employees={users}
                      loading={loading}
                      onSelect={(intervention) => navigate(`/planning/intervention/${intervention.id}`)}
                    />
                  </Suspense>
                } />
                <Route
                  path="leaves"
                  element={
                    <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                      <EmployeeLeaveView leaveRequests={leaveRequests} onSubmitRequest={handleSubmitLeaveRequest} userName={profile.full_name} userId={profile.id} showToast={showToast} />
                    </Suspense>
                  }
                />
                <Route path="vault" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <CoffreNumeriqueView vaultDocuments={vaultDocuments.filter((doc) => doc.user_id === profile.id)} />
                  </Suspense>
                } />
                <Route path="documents" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <MyDocumentsView
                      scannedDocuments={scannedDocuments}
                      profile={profile}
                      users={users}
                      onSaveDocuments={handleSaveDocuments}
                      onDeleteDocument={handleDeleteDocument}
                      onUpdateDocument={handleUpdateDocument}
                    />
                  </Suspense>
                } />
                <Route path="checklists" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <ChecklistView
                      checklists={checklists}
                      templates={checklistTemplates}
                      interventions={interventions}
                      onUpdateChecklist={handleUpdateChecklist}
                      profile={profile}
                    />
                  </Suspense>
                } />
                <Route path="expenses" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <ExpensesView expenses={expenses} onSubmitExpense={handleSubmitExpense} onDeleteExpense={handleDeleteExpense} profile={profile} />
                  </Suspense>
                } />
                <Route path="ir-docs" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <IRShowerFormsView profile={profile} />
                  </Suspense>
                } />
                <Route path="mobile-diagnostics" element={
                  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
                    <MobileDiagnosticsPage />
                  </Suspense>
                } />
                <Route path="*" element={<Navigate to="/planning" replace />} />
              </>
            )}
          </Route>
        )}
      </Routes>

      {/* ✅ Gestionnaire de notifications push pour tous les utilisateurs */}
      {profile && (
        <NotificationPermissionManager
          userId={profile.id}
          pushNotifications={pushNotifications}
        />
      )}
    </>
  );
}

export default App;
