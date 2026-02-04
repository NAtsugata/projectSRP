// src/components/planning/EditTeamModal.jsx
// Modal pour modifier l'équipe assignée à une intervention
// Supporte les assignations par jour pour les interventions multi-jours

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '../ui';
import './EditTeamModal.css';

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
  const [dailyMode, setDailyMode] = useState(false);
  const [dailyAssignments, setDailyAssignments] = useState({});

  // Dates planifiées de l'intervention
  const scheduledDates = useMemo(() => {
    if (!intervention?.scheduled_dates || !Array.isArray(intervention.scheduled_dates)) {
      return [];
    }
    return [...intervention.scheduled_dates].sort();
  }, [intervention]);

  const isMultiDay = scheduledDates.length > 1;

  // Initialiser avec les utilisateurs déjà assignés
  useEffect(() => {
    if (isOpen && intervention) {
      const currentAssignments = intervention.intervention_assignments || [];
      const currentUserIds = currentAssignments
        .map(a => a.user_id)
        .filter(Boolean);
      setSelectedUsers(currentUserIds);

      // Initialiser les assignations journalières
      const existingDaily = intervention.daily_assignments || {};
      if (Object.keys(existingDaily).length > 0) {
        setDailyAssignments(existingDaily);
        setDailyMode(true);
      } else {
        // Pré-remplir chaque jour avec l'équipe globale
        const initial = {};
        scheduledDates.forEach(date => {
          initial[date] = [...currentUserIds];
        });
        setDailyAssignments(initial);
        setDailyMode(false);
      }
    }
  }, [isOpen, intervention, scheduledDates]);

  // Gestion du focus et escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e) => {
        if (e.key === 'Escape') onCancel();
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
    if (e.target === e.currentTarget) onCancel();
  };

  const handleUserToggle = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Toggle un employé pour un jour spécifique
  const handleDailyUserToggle = (date, userId) => {
    setDailyAssignments(prev => {
      const dayUsers = prev[date] || [];
      const updated = dayUsers.includes(userId)
        ? dayUsers.filter(id => id !== userId)
        : [...dayUsers, userId];
      return { ...prev, [date]: updated };
    });
  };

  // Appliquer l'équipe globale à tous les jours
  const applyGlobalToAllDays = () => {
    const updated = {};
    scheduledDates.forEach(date => {
      updated[date] = [...selectedUsers];
    });
    setDailyAssignments(updated);
  };

  // Activer le mode journalier
  const enableDailyMode = () => {
    // Pré-remplir avec l'équipe globale
    applyGlobalToAllDays();
    setDailyMode(true);
  };

  const handleSave = () => {
    if (dailyMode && isMultiDay) {
      // Calculer l'équipe globale = union de tous les employés assignés
      const allUserIds = new Set();
      Object.values(dailyAssignments).forEach(dayUsers => {
        dayUsers.forEach(uid => allUserIds.add(uid));
      });
      onSave([...allUserIds], dailyAssignments);
    } else {
      onSave(selectedUsers, null);
    }
  };

  const employees = users;
  const employeesMap = {};
  employees.forEach(u => { employeesMap[u.id] = u; });

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="edit-team-backdrop" onClick={handleBackdropClick} role="presentation">
      <div ref={dialogRef} className="edit-team-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="edit-team-icon">👥</div>

        <h2 id="dialog-title" className="edit-team-title">
          Modifier l'équipe
        </h2>

        <p className="edit-team-subtitle">
          {intervention?.client} - {intervention?.service}
          {isMultiDay && <span className="edit-team-days-count"> ({scheduledDates.length} jours)</span>}
        </p>

        {/* Toggle mode : Équipe globale / Par jour */}
        {isMultiDay && (
          <div className="edit-team-mode-toggle">
            <button
              className={`mode-btn ${!dailyMode ? 'active' : ''}`}
              onClick={() => setDailyMode(false)}
              disabled={loading}
            >
              Même équipe tous les jours
            </button>
            <button
              className={`mode-btn ${dailyMode ? 'active' : ''}`}
              onClick={enableDailyMode}
              disabled={loading}
            >
              Équipe par jour
            </button>
          </div>
        )}

        {/* Mode global : liste de checkboxes classique */}
        {!dailyMode && (
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
        )}

        {/* Mode journalier : grille par jour */}
        {dailyMode && isMultiDay && (
          <div className="edit-team-daily">
            <div className="daily-apply-all">
              <button
                className="apply-all-btn"
                onClick={applyGlobalToAllDays}
                disabled={loading}
                title="Appliquer l'équipe globale sélectionnée ci-dessus à tous les jours"
              >
                Appliquer à tous les jours
              </button>
            </div>
            <div className="daily-days-list">
              {scheduledDates.map(date => {
                const dayUsers = dailyAssignments[date] || [];
                return (
                  <div key={date} className="daily-day-card">
                    <div className="daily-day-header">
                      <span className="daily-day-label">{formatDate(date)}</span>
                      <span className="daily-day-count">{dayUsers.length} employé{dayUsers.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="daily-day-employees">
                      {employees.map(user => (
                        <label key={user.id} className="daily-employee-chip">
                          <input
                            type="checkbox"
                            checked={dayUsers.includes(user.id)}
                            onChange={() => handleDailyUserToggle(date, user.id)}
                            disabled={loading}
                          />
                          <span className={`chip-label ${dayUsers.includes(user.id) ? 'active' : ''}`}>
                            {user.full_name?.split(' ')[0]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Résumé */}
        <div className="edit-team-summary">
          {!dailyMode ? (
            selectedUsers.length === 0 ? (
              <span className="text-warning">Aucun employé sélectionné</span>
            ) : (
              <span>{selectedUsers.length} employé(s) assigné(s) — tous les jours</span>
            )
          ) : (
            <span>
              {scheduledDates.length} jour(s) configuré(s) —{' '}
              {Object.values(dailyAssignments).filter(d => d.length > 0).length} avec équipe
            </span>
          )}
        </div>

        <div className="edit-team-actions">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleSave} loading={loading} disabled={loading}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditTeamModal;
