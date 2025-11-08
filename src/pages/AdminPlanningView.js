// src/pages/AdminPlanningView.js - Version refactorisée
// Gestion du planning admin avec composants modulaires

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InterventionForm, InterventionList } from '../components/planning';
import { Button, ConfirmDialog } from '../components/ui';
import { PlusIcon } from '../components/SharedUI';
import logger from '../utils/logger';
import './AdminPlanningView.css';

export default function AdminPlanningView({
  interventions,
  users,
  onAddIntervention,
  onArchive,
  onDelete,
  checklistTemplates,
  onAssignChecklist
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null);

  // Sync form visibility with URL params
  useEffect(() => {
    setShowForm(searchParams.get('new') === 'true');
  }, [searchParams]);

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

  return (
    <div className="admin-planning-view">
      {/* Header */}
      <div className="planning-header">
        <h2 className="planning-title">Gestion du Planning</h2>
        <Button
          variant="primary"
          icon={<PlusIcon />}
          onClick={showForm ? closeForm : openForm}
        >
          {showForm ? 'Annuler' : 'Nouvelle Intervention'}
        </Button>
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

      {/* List */}
      <div className="planning-list-section">
        <h3 className="section-title">Interventions planifiées</h3>
        <InterventionList
          interventions={interventions}
          onView={handleView}
          onArchive={handleArchive}
          onDelete={handleDelete}
          checklistTemplates={checklistTemplates}
          onAssignChecklist={onAssignChecklist}
          showFilters={true}
          showSort={true}
        />
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
    </div>
  );
}
