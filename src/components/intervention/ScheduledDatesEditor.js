// src/components/intervention/ScheduledDatesEditor.js
// Composant pour éditer les dates planifiées d'une intervention

import React, { useState, useCallback } from 'react';
import { PlusIcon, XIcon } from '../SharedUI';
import { useToast } from '../../contexts/ToastContext';
import logger from '../../utils/logger';
import './ScheduledDatesEditor.css';

/**
 * ScheduledDatesEditor Component
 * @param {Array} scheduledDates - Current scheduled dates
 * @param {Function} onUpdate - Handler when dates are updated (receives new array)
 * @param {boolean} disabled - Whether editing is disabled
 */
const ScheduledDatesEditor = ({ scheduledDates = [], onUpdate, disabled = false }) => {
  const [newDate, setNewDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const handleAddDate = useCallback(async () => {
    if (!newDate) {
      toast.warning('Veuillez sélectionner une date');
      return;
    }

    // Vérifier si la date n'est pas déjà dans la liste
    if (scheduledDates.includes(newDate)) {
      toast.warning('Cette date est déjà planifiée');
      return;
    }

    const updatedDates = [...scheduledDates, newDate].sort();

    setIsSaving(true);
    try {
      await onUpdate(updatedDates);
      setNewDate('');
      toast.success('Date ajoutée avec succès');
      logger.log('ScheduledDatesEditor: Date ajoutée', newDate);
    } catch (error) {
      logger.error('ScheduledDatesEditor: Erreur ajout date', error);
      toast.error('Erreur lors de l\'ajout de la date');
    } finally {
      setIsSaving(false);
    }
  }, [newDate, scheduledDates, onUpdate, toast]);

  const handleRemoveDate = useCallback(async (dateToRemove) => {
    const updatedDates = scheduledDates.filter(d => d !== dateToRemove);

    setIsSaving(true);
    try {
      await onUpdate(updatedDates);
      toast.success('Date retirée avec succès');
      logger.log('ScheduledDatesEditor: Date retirée', dateToRemove);
    } catch (error) {
      logger.error('ScheduledDatesEditor: Erreur suppression date', error);
      toast.error('Erreur lors de la suppression de la date');
    } finally {
      setIsSaving(false);
    }
  }, [scheduledDates, onUpdate, toast]);

  return (
    <div className="scheduled-dates-editor">
      <h4 className="section-title">📅 Planification multi-jours</h4>
      <p className="section-description">
        Ajoutez ou supprimez des dates pour planifier cette intervention sur plusieurs jours.
      </p>

      {/* Add date form */}
      <div className="add-date-form">
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          disabled={disabled || isSaving}
          className="date-input"
        />
        <button
          type="button"
          onClick={handleAddDate}
          disabled={disabled || isSaving || !newDate}
          className="btn-add-date"
        >
          <PlusIcon width={16} height={16} />
          {isSaving ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>

      {/* Dates list */}
      {scheduledDates.length > 0 ? (
        <div className="scheduled-dates-list">
          <div className="dates-count">
            {scheduledDates.length} date{scheduledDates.length > 1 ? 's' : ''} planifiée{scheduledDates.length > 1 ? 's' : ''}
          </div>
          <ul className="dates-items">
            {scheduledDates.map(date => {
              const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              return (
                <li key={date} className="date-item">
                  <span className="date-text">📅 {formattedDate}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDate(date)}
                    disabled={disabled || isSaving}
                    className="btn-remove-date"
                    title="Retirer cette date"
                    aria-label={`Retirer la date du ${formattedDate}`}
                  >
                    <XIcon width={16} height={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="empty-state">Aucune date planifiée pour cette intervention.</p>
      )}
    </div>
  );
};

export default ScheduledDatesEditor;
