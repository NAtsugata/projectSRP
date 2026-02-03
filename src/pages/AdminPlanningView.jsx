// src/pages/AdminPlanningView.js - Version refactorisée
// Gestion du planning admin avec composants modulaires

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InterventionForm, InterventionList, EditTeamModal, PlanningGanttView, PlanningMonthView, TeamStatistics } from '../components/planning';
import { EmployeeAlertsPanel, useUnreadAlertsCount } from '../components/admin';
import AbsenceManager from '../components/agenda/AbsenceManager';
import { Button, ConfirmDialog } from '../components/ui';
import { PlusIcon, ClipboardListIcon, CalendarIcon, ListIcon } from '../components/SharedUI';
import logger from '../utils/logger';
import './AdminPlanningView.css';

// Types de vue disponibles
const VIEW_MODES = {
  GANTT: 'gantt',
  MONTH: 'month',
  LIST: 'list'
};

export default function AdminPlanningView({
  interventions,
  users,
  onAddIntervention,
  onArchive,
  onDelete,
  onUpdateTeam,
  isUpdatingTeam = false,
  checklistTemplates,
  onAssignChecklist
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [viewMode, setViewMode] = useState(() => {
    // Récupérer la préférence de vue depuis localStorage (Gantt par défaut)
    return localStorage.getItem('planningViewMode') || VIEW_MODES.GANTT;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  const [editTeamIntervention, setEditTeamIntervention] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [absences, setAbsences] = useState([]);
  const unreadAlertsCount = useUnreadAlertsCount();

  const handleAbsencesChange = useCallback((newAbsences) => {
    setAbsences(newAbsences);
  }, []);

  // Sync form visibility with URL params
  useEffect(() => {
    setShowForm(searchParams.get('new') === 'true');
  }, [searchParams]);

  // Sauvegarder la préférence de vue
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    localStorage.setItem('planningViewMode', mode);
    logger.log('AdminPlanningView: Vue changée en', mode);
  }, []);

  const openForm = useCallback(() => {
    setSearchParams({ new: 'true' });
    logger.log('AdminPlanningView: Ouverture formulaire');
  }, [setSearchParams]);

  const closeForm = useCallback(() => {
    setSearchParams({});
    logger.log('AdminPlanningView: Fermeture formulaire');
  }, [setSearchParams]);

  const handleSubmit = useCallback(async ({ formData, assignedUsers, files }) => {
    setIsSubmitting(true);
    logger.log('AdminPlanningView: Soumission intervention', { formData, assignedUsers, filesCount: files.length });

    try {
      const result = await onAddIntervention(formData, assignedUsers, files);

      if (result) {
        logger.log('AdminPlanningView: Intervention créée avec succès');
        closeForm();
        return true;
      } else {
        logger.error('AdminPlanningView: Échec de création');
        return false;
      }
    } catch (error) {
      logger.error('AdminPlanningView: Erreur création', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [onAddIntervention, closeForm]);

  const handleView = useCallback((intervention) => {
    logger.log('AdminPlanningView: Navigation vers détails', intervention.id);
    navigate(`/planning/${intervention.id}`);
  }, [navigate]);

  const handleArchive = useCallback((interventionId) => {
    logger.log('AdminPlanningView: Demande archivage', interventionId);
    setArchiveConfirm(interventionId);
  }, []);

  const confirmArchive = useCallback(() => {
    if (archiveConfirm) {
      logger.log('AdminPlanningView: Archivage confirmé', archiveConfirm);
      onArchive(archiveConfirm);
      setArchiveConfirm(null);
    }
  }, [archiveConfirm, onArchive]);

  const handleDelete = useCallback((interventionId) => {
    logger.log('AdminPlanningView: Demande suppression', interventionId);
    setDeleteConfirm(interventionId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      logger.log('AdminPlanningView: Suppression confirmée', deleteConfirm);
      onDelete(deleteConfirm);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, onDelete]);

  const handleEditTeam = useCallback((intervention) => {
    logger.log('AdminPlanningView: Ouverture modal équipe', intervention.id);
    setEditTeamIntervention(intervention);
  }, []);

  const handleSaveTeam = useCallback(async (selectedUserIds) => {
    if (editTeamIntervention && onUpdateTeam) {
      logger.log('AdminPlanningView: Sauvegarde équipe', {
        interventionId: editTeamIntervention.id,
        userIds: selectedUserIds
      });
      await onUpdateTeam(editTeamIntervention.id, selectedUserIds);
      setEditTeamIntervention(null);
    }
  }, [editTeamIntervention, onUpdateTeam]);

  return (
    <div className="admin-planning-view">
      {/* Header */}
      <div className="planning-header">
        <h2 className="planning-title">
          <ClipboardListIcon className="w-8 h-8 text-primary-500 mr-3" />
          Gestion du Planning
        </h2>
        <div className="planning-header-actions">
          {/* Bouton alertes employés */}
          <button
            className="alerts-btn"
            onClick={() => setShowAlerts(true)}
            title="Alertes employés"
          >
            <span className="alerts-icon">🚨</span>
            {unreadAlertsCount > 0 && (
              <span className="alerts-badge">{unreadAlertsCount}</span>
            )}
          </button>

          {/* Gestionnaire absences */}
          <AbsenceManager
            employees={users.filter(u => !u.is_admin)}
            onAbsencesChange={handleAbsencesChange}
          />

          {/* Sélecteur de vue simplifié */}
          <div className="view-mode-selector">
            <button
              className={`view-mode-btn ${viewMode === VIEW_MODES.GANTT ? 'active' : ''}`}
              onClick={() => handleViewModeChange(VIEW_MODES.GANTT)}
              title="Vue Semaine"
            >
              <CalendarIcon />
              <span className="view-mode-label">Semaine</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === VIEW_MODES.MONTH ? 'active' : ''}`}
              onClick={() => handleViewModeChange(VIEW_MODES.MONTH)}
              title="Vue Mois"
            >
              <span className="view-mode-icon">📅</span>
              <span className="view-mode-label">Mois</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === VIEW_MODES.LIST ? 'active' : ''}`}
              onClick={() => handleViewModeChange(VIEW_MODES.LIST)}
              title="Vue liste"
            >
              <ListIcon />
              <span className="view-mode-label">Liste</span>
            </button>
          </div>

          <Button
            variant="primary"
            icon={<PlusIcon />}
            onClick={showForm ? closeForm : openForm}
          >
            {showForm ? 'Annuler' : 'Nouvelle Intervention'}
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="planning-form-section">
          <InterventionForm
            users={users}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Contenu selon le mode de vue */}
      <div className="planning-content-section">
        {viewMode === VIEW_MODES.GANTT && (
          <div className="planning-gantt-section">
            <PlanningGanttView
              interventions={interventions}
              users={users}
              absences={absences}
              onInterventionClick={handleView}
              onEditTeam={handleEditTeam}
            />
          </div>
        )}

        {viewMode === VIEW_MODES.MONTH && (
          <div className="planning-month-section">
            <PlanningMonthView
              interventions={interventions}
              absences={absences}
              users={users}
              onInterventionClick={handleView}
            />
          </div>
        )}

        {viewMode === VIEW_MODES.LIST && (
          <div className="planning-list-section">
            <h3 className="section-title">Interventions planifiées</h3>
            <InterventionList
              interventions={interventions}
              onView={handleView}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onEditTeam={handleEditTeam}
              checklistTemplates={checklistTemplates}
              onAssignChecklist={onAssignChecklist}
              showFilters={true}
              showSort={true}
            />
          </div>
        )}

        {/* Statistiques d'équipe (visible sur toutes les vues) */}
        <div className="planning-stats-section">
          <TeamStatistics
            interventions={interventions}
            users={users}
          />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Supprimer l'intervention ?"
        message="Cette action est irréversible. Êtes-vous sûr de vouloir supprimer cette intervention ?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Archive confirmation dialog */}
      <ConfirmDialog
        isOpen={!!archiveConfirm}
        title="Archiver l'intervention ?"
        message="L'intervention sera déplacée dans les archives. Vous pourrez la restaurer plus tard."
        onConfirm={confirmArchive}
        onCancel={() => setArchiveConfirm(null)}
      />

      {/* Edit team modal */}
      <EditTeamModal
        isOpen={!!editTeamIntervention}
        intervention={editTeamIntervention}
        users={users}
        onSave={handleSaveTeam}
        onCancel={() => setEditTeamIntervention(null)}
        loading={isUpdatingTeam}
      />

      {/* Panneau alertes employés */}
      {showAlerts && (
        <EmployeeAlertsPanel onClose={() => setShowAlerts(false)} />
      )}
    </div>
  );
}
