// src/components/agenda/AbsenceManager.js
// Gestionnaire d'absences et de congés des employés

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../ui';
import { UserIcon, PlusIcon, XIcon, CalendarIcon, EditIcon, DownloadIcon, SearchIcon } from '../SharedUI';
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

  // États pour l'édition
  const [editingAbsence, setEditingAbsence] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

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
        const failedNames = [];

        // Créer une absence pour chaque employé sélectionné
        for (const empId of selectedEmployeeIds) {
          const emp = employees.find(e => e.id === empId);
          const empName = emp?.full_name || emp?.name || empId;

          logger.log('🔄 Création absence pour:', empName, empId);

          const { data, error } = await absenceService.createAbsence({
            employeeId: empId,
            startDate: newAbsence.startDate,
            endDate: newAbsence.endDate,
            reason: newAbsence.reason,
            notes: newAbsence.notes
          });

          if (error) {
            errorCount++;
            failedNames.push(empName);
            logger.error('❌ Erreur ajout absence pour', empName, ':', error.message || error);
          } else {
            successCount++;
            logger.log('✅ Absence créée pour', empName, data);
          }
        }

        if (successCount > 0) {
          toast.success(`${successCount} absence(s) enregistrée(s) avec succès`);
        }
        if (errorCount > 0) {
          toast.error(`Échec pour: ${failedNames.join(', ')}`);
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
      // Vérifier les chevauchements
      const { hasOverlap, overlapping } = await absenceService.checkAbsenceOverlap(
        newAbsence.employeeId,
        newAbsence.startDate,
        newAbsence.endDate,
        isEditing ? editingAbsence.id : null
      );

      if (hasOverlap) {
        const empName = getEmployeeName(newAbsence.employeeId);
        const overlapDetails = overlapping.map(o => {
          const startDate = o.start_date || o.startDate;
          const endDate = o.end_date || o.endDate;
          return `• ${o.reason}: ${formatDate(startDate)} - ${formatDate(endDate)}`;
        }).join('\n');

        const proceed = window.confirm(
          `⚠️ Attention: ${empName} a déjà une absence sur cette période:\n\n${overlapDetails}\n\nVoulez-vous continuer ?`
        );

        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Mode édition ou création
      if (isEditing && editingAbsence) {
        const { error } = await absenceService.updateAbsence(editingAbsence.id, newAbsence);
        if (error) throw error;
        toast.success('Absence modifiée avec succès');
        setIsEditing(false);
        setEditingAbsence(null);
      } else {
        const { error } = await absenceService.createAbsence(newAbsence);
        if (error) throw error;
        toast.success('Absence enregistrée avec succès');
      }

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
      logger.error('Erreur ajout/modification absence:', error);
      toast.error(isEditing ? 'Impossible de modifier l\'absence' : 'Impossible d\'enregistrer l\'absence');
    } finally {
      setLoading(false);
    }
  };

  // Éditer une absence
  const handleEditAbsence = (absence) => {
    setEditingAbsence(absence);
    setNewAbsence({
      employeeId: absence.employeeId,
      startDate: absence.startDate,
      endDate: absence.endDate,
      reason: absence.reason || 'Congés',
      notes: absence.notes || ''
    });
    setIsEditing(true);
    setIsAdding(true);
  };

  // Annuler l'édition
  const cancelEdit = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEditingAbsence(null);
    setMultiSelectMode(false);
    setSelectedEmployeeIds([]);
    setNewAbsence({
      employeeId: '',
      startDate: '',
      endDate: '',
      reason: 'Congés',
      notes: ''
    });
  };

  // Exporter les absences en CSV
  const handleExport = () => {
    absenceService.exportAbsencesToCSV(absences, employees);
    toast.success('Export CSV téléchargé');
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

  // Obtenir les absences passées (récentes, max 10)
  const getPastAbsences = () => {
    const today = new Date().toISOString().split('T')[0];
    return absences.filter(absence => {
      return absence.endDate < today;
    }).sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, 10);
  };

  const currentAbsences = getCurrentAbsences();
  const upcomingAbsences = getUpcomingAbsences();
  const pastAbsences = getPastAbsences();

  // Helper pour trier par nom d'employé
  const getEmployeeNameSort = useCallback((employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.full_name || emp?.name || '';
  }, [employees]);

  // Absences filtrées pour la recherche (pour future utilisation)
  const _filteredAbsences = useMemo(() => {
    let result = [...absences];

    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(a => {
        const emp = employees.find(e => e.id === a.employeeId);
        const empName = (emp?.full_name || emp?.name || '').toLowerCase();
        return empName.includes(term);
      });
    }

    // Filtre par employé
    if (filterEmployee !== 'all') {
      result = result.filter(a => a.employeeId === filterEmployee);
    }

    // Filtre par type
    if (filterType !== 'all') {
      result = result.filter(a => a.reason === filterType);
    }

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return a.startDate.localeCompare(b.startDate);
        case 'date-desc':
          return b.startDate.localeCompare(a.startDate);
        case 'name-asc':
          return getEmployeeNameSort(a.employeeId).localeCompare(getEmployeeNameSort(b.employeeId));
        case 'name-desc':
          return getEmployeeNameSort(b.employeeId).localeCompare(getEmployeeNameSort(a.employeeId));
        default:
          return 0;
      }
    });

    return result;
  }, [absences, searchTerm, filterEmployee, filterType, sortBy, employees, getEmployeeNameSort]);

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
              <div className="absence-header-actions">
                {absences.length > 0 && (
                  <button
                    className="absence-export-btn"
                    onClick={handleExport}
                    title="Exporter en CSV"
                  >
                    <DownloadIcon />
                  </button>
                )}
                <button
                  className="absence-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            <div className="absence-body">
              {/* Filtres */}
              {!loading && absences.length > 3 && !isAdding && (
                <div className="absence-filters">
                  <div className="absence-search-wrapper">
                    <SearchIcon />
                    <input
                      type="text"
                      className="absence-search"
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <select
                    className="absence-filter-select"
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                  >
                    <option value="all">Tous les employés</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="absence-filter-select"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">Tous les types</option>
                    <option value="Congés">Congés</option>
                    <option value="Maladie">Maladie</option>
                    <option value="Formation">Formation</option>
                    <option value="École">École</option>
                    <option value="Autre">Autre</option>
                  </select>

                  <select
                    className="absence-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="date-desc">Date ↓</option>
                    <option value="date-asc">Date ↑</option>
                    <option value="name-asc">Nom A-Z</option>
                    <option value="name-desc">Nom Z-A</option>
                  </select>
                </div>
              )}

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
                          <div className="absence-card-actions">
                            <button
                              className="absence-edit"
                              onClick={() => handleEditAbsence(absence)}
                              aria-label="Modifier"
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="absence-delete"
                              onClick={() => handleDeleteAbsence(absence.id)}
                              aria-label="Supprimer"
                            >
                              <XIcon />
                            </button>
                          </div>
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
                          <div className="absence-card-actions">
                            <button
                              className="absence-edit"
                              onClick={() => handleEditAbsence(absence)}
                              aria-label="Modifier"
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="absence-delete"
                              onClick={() => handleDeleteAbsence(absence.id)}
                              aria-label="Supprimer"
                            >
                              <XIcon />
                            </button>
                          </div>
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

              {/* Absences passées (récentes) */}
              {!loading && pastAbsences.length > 0 && (
                <div className="absence-section">
                  <h5 className="absence-section-title">
                    📋 Historique récent ({pastAbsences.length})
                  </h5>
                  <div className="absence-list">
                    {pastAbsences.map(absence => (
                      <div key={absence.id} className="absence-card past">
                        <div className="absence-card-header">
                          <div className="absence-employee">
                            <UserIcon />
                            <span className="absence-employee-name">
                              {getEmployeeName(absence.employeeId)}
                            </span>
                          </div>
                          <div className="absence-card-actions">
                            <button
                              className="absence-edit"
                              onClick={() => handleEditAbsence(absence)}
                              aria-label="Modifier"
                            >
                              <EditIcon />
                            </button>
                            <button
                              className="absence-delete"
                              onClick={() => handleDeleteAbsence(absence.id)}
                              aria-label="Supprimer"
                            >
                              <XIcon />
                            </button>
                          </div>
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

              {/* Formulaire d'ajout/édition */}
              {!loading && isAdding ? (
                <div className="absence-form">
                  <h5 className="absence-form-title">
                    {isEditing ? 'Modifier l\'absence' : 'Nouvelle absence'}
                  </h5>

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
                      onClick={cancelEdit}
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleAddAbsence}
                    >
                      {isEditing
                        ? 'Modifier'
                        : multiSelectMode && selectedEmployeeIds.length > 1
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
