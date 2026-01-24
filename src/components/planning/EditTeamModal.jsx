// src/components/planning/EditTeamModal.jsx
// Modal pour modifier l'équipe assignée à une intervention

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui';
import './EditTeamModal.css';

/**
 * Modal pour éditer l'équipe assignée à une intervention
 * @param {boolean} isOpen - Ouvert/fermé
 * @param {Object} intervention - L'intervention à modifier
 * @param {Array} users - Liste des utilisateurs disponibles
 * @param {Function} onSave - Callback avec les nouveaux IDs utilisateurs
 * @param {Function} onCancel - Callback d'annulation
 * @param {boolean} loading - État de chargement
 */
const EditTeamModal = ({
  isOpen,
  intervention,
  users = [],
  onSave,
  onCancel,
  loading = false
}) => {
  const dialogRef = useRef(null);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Initialiser avec les utilisateurs déjà assignés
  useEffect(() => {
    if (isOpen && intervention) {
      const currentAssignments = intervention.intervention_assignments || [];
      const currentUserIds = currentAssignments
        .map(a => a.user_id)
        .filter(Boolean);
      setSelectedUsers(currentUserIds);
    }
  }, [isOpen, intervention]);

  // Gestion du focus et escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };

      document.addEventListener('keydown', handleEscape);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = () => {
    onSave(selectedUsers);
  };

  // Filtrer pour n'afficher que les employés (non-admin)
  const employees = users.filter(u => !u.is_admin);

  return (
    <div
      className="edit-team-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="edit-team-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="edit-team-icon">👥</div>

        <h2 id="dialog-title" className="edit-team-title">
          Modifier l'équipe
        </h2>

        <p className="edit-team-subtitle">
          {intervention?.client} - {intervention?.service}
        </p>

        <div className="edit-team-users">
          {employees.length > 0 ? (
            employees.map(user => (
              <label key={user.id} className="edit-team-user-checkbox">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.id)}
                  onChange={() => handleUserToggle(user.id)}
                  disabled={loading}
                />
                <span className="checkmark"></span>
                <span className="user-name">{user.full_name}</span>
              </label>
            ))
          ) : (
            <p className="no-employees">Aucun employé disponible</p>
          )}
        </div>

        <div className="edit-team-summary">
          {selectedUsers.length === 0 ? (
            <span className="text-warning">Aucun employé sélectionné</span>
          ) : (
            <span>{selectedUsers.length} employé(s) assigné(s)</span>
          )}
        </div>

        <div className="edit-team-actions">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Annuler
          </Button>

          <Button
            variant="primary"
            onClick={handleSave}
            loading={loading}
            disabled={loading}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditTeamModal;
