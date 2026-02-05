// src/components/agenda/AbsenceManager.js
// Gestionnaire d'absences et de congés des employés

import React, { useState, useEffect, useCallback } from 'react';
import { Button, LoadingSpinner } from '../ui';
import { UserIcon, PlusIcon, XIcon, CalendarIcon } from '../SharedUI';
import { useToast } from '../../contexts/ToastContext';
import * as absenceService from '../../lib/absenceService';
import logger from '../../utils/logger';
import './AbsenceManager.css';

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
  const toast = useToast();
  const [absences, setAbsences] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [newAbsence, setNewAbsence] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: 'Congés',
    notes: ''
  });

  // Fonction de chargement des absences (définie avant le useEffect)
  const loadAbsences = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await absenceService.getAllAbsences();
      if (error) throw error;

      const formattedAbsences = (data || []).map(absence => ({
        id: absence.id,
        employeeId: absence.employee_id,
        startDate: absence.start_date,
        endDate: absence.end_date,
        reason: absence.reason,
        notes: absence.notes,
        createdAt: absence.created_at
      }));

      setAbsences(formattedAbsences);

      if (onAbsencesChange) {
        onAbsencesChange(formattedAbsences);
      }
    } catch (error) {
      logger.error('Erreur chargement absences:', error);
      toast.error('Impossible de charger les absences');
    } finally {
      setLoading(false);
    }
  }, [onAbsencesChange, toast]);

  // Charger les absences au montage
  useEffect(() => {
    loadAbsences();
  }, [loadAbsences]);

  // Ajouter une absence (ou plusieurs en mode multi-sélection)
  const handleAddAbsence = async () => {
    // Validation des dates
    if (!newAbsence.startDate || !newAbsence.endDate) {
      toast.warning('Veuillez remplir les dates');
      return;
    }

    if (newAbsence.startDate > newAbsence.endDate) {
      toast.error('La date de fin doit être après la date de début');
      return;
    }

    // Mode multi-sélection (pour École)
    if (multiSelectMode) {
      if (selectedEmployeeIds.length === 0) {
        toast.warning('Veuillez sélectionner au moins un employé');
        return;
      }

      setLoading(true);
      try {
        let successCount = 0;
        let errorCount = 0;

        // Créer une absence pour chaque employé sélectionné
        for (const empId of selectedEmployeeIds) {
          const { error } = await absenceService.createAbsence({
            employeeId: empId,
            startDate: newAbsence.startDate,
            endDate: newAbsence.endDate,
            reason: newAbsence.reason,
            notes: newAbsence.notes
          });
          if (error) {
            errorCount++;
            logger.error('Erreur ajout absence pour', empId, error);
          } else {
            successCount++;
          }
        }

        if (successCount > 0) {
          toast.success(`${successCount} absence(s) enregistrée(s) avec succès`);
        }
        if (errorCount > 0) {
          toast.warning(`${errorCount} erreur(s) lors de l'enregistrement`);
        }

        // Reset form
        setNewAbsence({
          employeeId: '',
          startDate: '',
          endDate: '',
          reason: 'Congés',
          notes: ''
        });
        setSelectedEmployeeIds([]);
        setMultiSelectMode(false);
        setIsAdding(false);

        // Reload absences
        await loadAbsences();
      } catch (error) {
        logger.error('Erreur ajout absences multiples:', error);
        toast.error('Impossible d\'enregistrer les absences');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Mode normal (un seul employé)
    if (!newAbsence.employeeId) {
      toast.warning('Veuillez sélectionner un employé');
      return;
    }

    setLoading(true);
    try {
      const { error } = await absenceService.createAbsence(newAbsence);
      if (error) throw error;

      toast.success('Absence enregistrée avec succès');

      // Reset form
      setNewAbsence({
        employeeId: '',
        startDate: '',
        endDate: '',
        reason: 'Congés',
        notes: ''
      });
      setIsAdding(false);

      // Reload absences
      await loadAbsences();
    } catch (error) {
      logger.error('Erreur ajout absence:', error);
      toast.error('Impossible d\'enregistrer l\'absence');
    } finally {
      setLoading(false);
    }
  };

  // Toggle employee selection in multi-select mode
  const toggleEmployeeSelection = (empId) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(empId)
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  // Supprimer une absence
  const handleDeleteAbsence = async (absenceId) => {
    if (!window.confirm('Supprimer cette absence ?')) return;

    setLoading(true);
    try {
      const { error } = await absenceService.deleteAbsence(absenceId);
      if (error) throw error;

      toast.success('Absence supprimée');

      // Reload absences
      await loadAbsences();
    } catch (error) {
      logger.error('Erreur suppression absence:', error);
      toast.error('Impossible de supprimer l\'absence');
    } finally {
      setLoading(false);
    }
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
              {/* Loading state */}
              {loading && (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <LoadingSpinner text="Chargement..." />
                </div>
              )}

              {/* Absences en cours */}
              {!loading && currentAbsences.length > 0 && (
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
              {!loading && upcomingAbsences.length > 0 && (
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
              {!loading && absences.length === 0 && !isAdding && (
                <div className="absence-empty">
                  <p>Aucune absence enregistrée</p>
                </div>
              )}

              {/* Formulaire d'ajout */}
              {!loading && isAdding ? (
                <div className="absence-form">
                  <h5 className="absence-form-title">Nouvelle absence</h5>

                  <div className="form-group">
                    <label htmlFor="absence-reason">Motif</label>
                    <select
                      id="absence-reason"
                      className="form-control"
                      value={newAbsence.reason}
                      onChange={(e) => {
                        const reason = e.target.value;
                        setNewAbsence({ ...newAbsence, reason });
                        // Activer automatiquement le mode multi-sélection pour École
                        if (reason === 'École') {
                          setMultiSelectMode(true);
                        } else {
                          setMultiSelectMode(false);
                          setSelectedEmployeeIds([]);
                        }
                      }}
                    >
                      <option value="Congés">Congés</option>
                      <option value="Maladie">Maladie</option>
                      <option value="Formation">Formation</option>
                      <option value="École">🎓 École (apprenti) - Multi-sélection</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>

                  {/* Mode multi-sélection pour École */}
                  {multiSelectMode ? (
                    <div className="form-group">
                      <label>Sélectionner les apprentis * ({selectedEmployeeIds.length} sélectionné{selectedEmployeeIds.length > 1 ? 's' : ''})</label>
                      <div className="employee-checkbox-list">
                        {employees.map(emp => (
                          <label key={emp.id} className="employee-checkbox-item">
                            <input
                              type="checkbox"
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onChange={() => toggleEmployeeSelection(emp.id)}
                            />
                            <span className="employee-checkbox-name">{emp.full_name || emp.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
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
                  )}

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
                        setMultiSelectMode(false);
                        setSelectedEmployeeIds([]);
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
                      {multiSelectMode && selectedEmployeeIds.length > 1
                        ? `Enregistrer (${selectedEmployeeIds.length})`
                        : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              ) : !loading && (
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

// Re-export helpers from absenceService for backward compatibility
export { isEmployeeAbsent, getAbsentEmployees } from '../../lib/absenceService';
