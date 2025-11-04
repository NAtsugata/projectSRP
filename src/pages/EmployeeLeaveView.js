// src/pages/EmployeeLeaveView.js - Version refactorisée
// Vue employé pour soumettre et consulter ses demandes de congés

import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LeaveRequestForm, LeaveRequestList } from '../components/leave';
import { Button } from '../components/ui';
import { PlusIcon } from '../components/SharedUI';
import logger from '../utils/logger';
import './EmployeeLeaveView.css';

export default function EmployeeLeaveView({
  leaveRequests = [],
  onSubmitRequest,
  userName,
  userId,
  showToast
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(searchParams.get('new') === 'true');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openForm = useCallback(() => {
    setSearchParams({ new: 'true' });
    logger.log('EmployeeLeaveView: Ouverture formulaire');
  }, [setSearchParams]);

  const closeForm = useCallback(() => {
    setSearchParams({});
    logger.log('EmployeeLeaveView: Fermeture formulaire');
  }, [setSearchParams]);

  const handleSubmit = useCallback(async (formData) => {
    setIsSubmitting(true);
    logger.log('EmployeeLeaveView: Soumission demande', formData);

    try {
      // Validate dates
      if (!formData.startDate || !formData.endDate || !formData.reason) {
        showToast?.('Veuillez remplir tous les champs.', 'error');
        return false;
      }

      // Submit with user info
      const result = await onSubmitRequest({
        userName,
        userId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason
      });

      if (result !== false) {
        logger.log('EmployeeLeaveView: Demande soumise avec succès');
        closeForm();
        return true;
      } else {
        logger.error('EmployeeLeaveView: Échec soumission');
        return false;
      }
    } catch (error) {
      logger.error('EmployeeLeaveView: Erreur soumission', error);
      showToast?.('Erreur lors de la soumission', 'error');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [userName, userId, onSubmitRequest, showToast, closeForm]);

  return (
    <div className="employee-leave-view">
      {/* Header */}
      <div className="leave-header">
        <div className="header-content">
          <h2 className="leave-title">Vos Demandes de Congés</h2>
          <p className="leave-description">
            Soumettez vos demandes de congés et consultez leur statut.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<PlusIcon />}
          onClick={showForm ? closeForm : openForm}
        >
          {showForm ? 'Annuler' : 'Nouvelle Demande'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="leave-form-section">
          <LeaveRequestForm
            onSubmit={handleSubmit}
            onCancel={closeForm}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* List */}
      <div className="leave-list-section">
        <h3 className="section-title">Historique de vos demandes</h3>
        <LeaveRequestList
          requests={leaveRequests}
          showFilters={true}
          showSort={true}
          showActions={false}
          showUserName={false}
        />
      </div>
    </div>
  );
}
