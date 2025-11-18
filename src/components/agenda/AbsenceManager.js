// src/components/agenda/AbsenceManager.js
// Gestionnaire d'absences et de congés des employés

import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import { UserIcon, PlusIcon, XIcon, CalendarIcon } from '../SharedUI';
import { safeStorage } from '../../utils/safeStorage';
import './AbsenceManager.css';

const STORAGE_KEY = 'employee_absences';

/**
 * AbsenceManager Component
 * Gérer les absences et congés des employés
 *
 * @param {Array} employees - Liste des employés
 * @param {Function} onAbsencesChange - Callback quand les absences changent
 */
const AbsenceManager = ({
  employees = [],
  onAbsencesChange
}) => {
  const [absences, setAbsences] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newAbsence, setNewAbsence] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: 'Congés',
    notes: ''
  });

  // Charger les absences au montage
  useEffect(() => {
    const stored = safeStorage.getJSON(STORAGE_KEY, []);
    setAbsences(stored);

    if (onAbsencesChange) {
      onAbsencesChange(stored);
    }
  }, []);

  // Persister dans localStorage
  const persistAbsences = (newAbsences) => {
    safeStorage.setJSON(STORAGE_KEY, newAbsences);
    setAbsences(newAbsences);

    if (onAbsencesChange) {
      onAbsencesChange(newAbsences);
    }
  };

  // Ajouter une absence
  const handleAddAbsence = () => {
    if (!newAbsence.employeeId || !newAbsence.startDate || !newAbsence.endDate) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (newAbsence.startDate > newAbsence.endDate) {
      alert('La date de fin doit être après la date de début');
      return;
    }

    const absence = {
      id: `absence-${Date.now()}`,
      ...newAbsence,
      createdAt: new Date().toISOString()
    };

    const updated = [...absences, absence];
    persistAbsences(updated);

    // Reset form
    setNewAbsence({
      employeeId: '',
      startDate: '',
      endDate: '',
      reason: 'Congés',
      notes: ''
    });
    setIsAdding(false);
  };

  // Supprimer une absence
  const handleDeleteAbsence = (absenceId) => {
    if (!window.confirm('Supprimer cette absence ?')) return;

    const updated = absences.filter(a => a.id !== absenceId);
    persistAbsences(updated);
  };

  // Vérifier si un employé est absent à une date donnée
  const isEmployeeAbsent = (employeeId, date) => {
    return absences.some(absence => {
      return (
        absence.employeeId === employeeId &&
        date >= absence.startDate &&
        date <= absence.endDate
      );
    });
  };

  // Obtenir les absences en cours
  const getCurrentAbsences = () => {
    const today = new Date().toISOString().split('T')[0];
    return absences.filter(absence => {
      return absence.startDate <= today && absence.endDate >= today;
    });
  };

  // Obtenir les absences à venir
  const getUpcomingAbsences = () => {
    const today = new Date().toISOString().split('T')[0];
    return absences.filter(absence => {
      return absence.startDate > today;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  };

  const currentAbsences = getCurrentAbsences();
  const upcomingAbsences = getUpcomingAbsences();

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.full_name || employee?.name || 'Inconnu';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysCount = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end - start;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="absence-manager">
      <button
        className="absence-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Gérer les absences"
      >
        <UserIcon />
        <span className="absence-btn-text">Absences</span>
        {currentAbsences.length > 0 && (
          <span className="absence-badge">{currentAbsences.length}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="absence-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absence-panel">
            <div className="absence-header">
              <h4 className="absence-title">Gestion des absences</h4>
              <button
                className="absence-close"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
              >
                <XIcon />
              </button>
            </div>

            <div className="absence-body">
              {/* Absences en cours */}
              {currentAbsences.length > 0 && (
                <div className="absence-section">
                  <h5 className="absence-section-title">
                    🔴 Absents actuellement ({currentAbsences.length})
                  </h5>
                  <div className="absence-list">
                    {currentAbsences.map(absence => (
                      <div key={absence.id} className="absence-card current">
                        <div className="absence-card-header">
                          <div className="absence-employee">
                            <UserIcon />
                            <span className="absence-employee-name">
                              {getEmployeeName(absence.employeeId)}
                            </span>
                          </div>
                          <button
                            className="absence-delete"
                            onClick={() => handleDeleteAbsence(absence.id)}
                            aria-label="Supprimer"
                          >
                            <XIcon />
                          </button>
                        </div>
                        <div className="absence-card-body">
                          <div className="absence-dates">
                            <CalendarIcon />
                            <span>
                              {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                              ({getDaysCount(absence.startDate, absence.endDate)} jour{getDaysCount(absence.startDate, absence.endDate) > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="absence-reason">{absence.reason}</div>
                          {absence.notes && (
                            <div className="absence-notes">{absence.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Absences à venir */}
              {upcomingAbsences.length > 0 && (
                <div className="absence-section">
                  <h5 className="absence-section-title">
                    📅 À venir ({upcomingAbsences.length})
                  </h5>
                  <div className="absence-list">
                    {upcomingAbsences.map(absence => (
                      <div key={absence.id} className="absence-card upcoming">
                        <div className="absence-card-header">
                          <div className="absence-employee">
                            <UserIcon />
                            <span className="absence-employee-name">
                              {getEmployeeName(absence.employeeId)}
                            </span>
                          </div>
                          <button
                            className="absence-delete"
                            onClick={() => handleDeleteAbsence(absence.id)}
                            aria-label="Supprimer"
                          >
                            <XIcon />
                          </button>
                        </div>
                        <div className="absence-card-body">
                          <div className="absence-dates">
                            <CalendarIcon />
                            <span>
                              {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                              ({getDaysCount(absence.startDate, absence.endDate)} jour{getDaysCount(absence.startDate, absence.endDate) > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="absence-reason">{absence.reason}</div>
                          {absence.notes && (
                            <div className="absence-notes">{absence.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {absences.length === 0 && !isAdding && (
                <div className="absence-empty">
                  <p>Aucune absence enregistrée</p>
                </div>
              )}

              {/* Formulaire d'ajout */}
              {isAdding ? (
                <div className="absence-form">
                  <h5 className="absence-form-title">Nouvelle absence</h5>

                  <div className="form-group">
                    <label htmlFor="absence-employee">Employé *</label>
                    <select
                      id="absence-employee"
                      className="form-control"
                      value={newAbsence.employeeId}
                      onChange={(e) => setNewAbsence({ ...newAbsence, employeeId: e.target.value })}
                    >
                      <option value="">Sélectionner un employé</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name || emp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="absence-start">Date de début *</label>
                      <input
                        id="absence-start"
                        type="date"
                        className="form-control"
                        value={newAbsence.startDate}
                        onChange={(e) => setNewAbsence({ ...newAbsence, startDate: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="absence-end">Date de fin *</label>
                      <input
                        id="absence-end"
                        type="date"
                        className="form-control"
                        value={newAbsence.endDate}
                        onChange={(e) => setNewAbsence({ ...newAbsence, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="absence-reason">Motif</label>
                    <select
                      id="absence-reason"
                      className="form-control"
                      value={newAbsence.reason}
                      onChange={(e) => setNewAbsence({ ...newAbsence, reason: e.target.value })}
                    >
                      <option value="Congés">Congés</option>
                      <option value="Maladie">Maladie</option>
                      <option value="Formation">Formation</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="absence-notes">Notes (optionnel)</label>
                    <textarea
                      id="absence-notes"
                      className="form-control"
                      rows="2"
                      placeholder="Informations complémentaires..."
                      value={newAbsence.notes}
                      onChange={(e) => setNewAbsence({ ...newAbsence, notes: e.target.value })}
                    />
                  </div>

                  <div className="form-actions">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsAdding(false);
                        setNewAbsence({
                          employeeId: '',
                          startDate: '',
                          endDate: '',
                          reason: 'Congés',
                          notes: ''
                        });
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleAddAbsence}
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="absence-add-btn"
                  onClick={() => setIsAdding(true)}
                >
                  <PlusIcon />
                  <span>Ajouter une absence</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AbsenceManager;

// Export helper pour vérifier les absences
export const isEmployeeAbsent = (employeeId, date) => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  return absences.some(absence => {
    return (
      absence.employeeId === employeeId &&
      date >= absence.startDate &&
      date <= absence.endDate
    );
  });
};

export const getAbsentEmployees = (date) => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  return absences
    .filter(absence => date >= absence.startDate && date <= absence.endDate)
    .map(absence => absence.employeeId);
};
