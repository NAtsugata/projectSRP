// src/components/planning/InterventionForm.js
// Formulaire de création/édition d'intervention

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../ui';
import { PlusIcon, XIcon, FileTextIcon, CustomFileInput } from '../SharedUI';
import { useFormDraft, DraftBanner } from '../../hooks/useFormDraft';
import { validateIntervention } from '../../utils/validators';
import { toLocalDateStr } from '../../utils/agendaHelpers';
import { clientService } from '../../services/clientService';
import logger from '../../utils/logger';
import './InterventionForm.css';

/**
 * Formats file size in human readable format
 */
const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
};

/**
 * InterventionForm Component
 * @param {Object} initialValues - Initial form values
 * @param {Array} users - List of users for assignment
 * @param {Function} onSubmit - Handler for form submission
 * @param {Function} onCancel - Handler for cancel action
 * @param {boolean} isSubmitting - Submission state
 */
const InterventionForm = ({
  initialValues = {
    client: '',
    address: '',
    service: '',
    date: '',
    time: '08:00',
    client_phone: '',
    secondary_phone: '',
    client_email: '',
    ticket_number: '',
    km_start: '',
    admin_note: ''
  },
  users = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  prefillClient = null
}) => {
  // Si un client est préfillé (depuis la vue clients), fusionner avec les valeurs initiales
  const mergedInitialValues = prefillClient
    ? {
        ...initialValues,
        client: prefillClient.client || '',
        address: prefillClient.address || '',
        client_phone: prefillClient.client_phone || '',
        client_email: prefillClient.client_email || '',
        client_id: prefillClient.client_id || null
      }
    : initialValues;
  const { formData: values, setFormData: setValues, clearDraft, hasDraft, lastSavedAt } = useFormDraft('intervention-create', mergedInitialValues);
  const [errors, setErrors] = useState({});

  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setValues(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors, setValues]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Valide tous les champs
    const validationErrors = validateIntervention(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    logger.log('InterventionForm: Submitting...', values);
    const formDataWithScheduledDates = {
      ...values,
      scheduled_dates: scheduledDates.length > 0 ? scheduledDates : null,
      client_id: selectedClient?.id || prefillClient?.client_id || null
    };

    await onSubmit({
      formData: formDataWithScheduledDates,
      assignedUsers,
      files: briefingFiles.map(f => f.fileObject)
    });
    
    clearDraft();
  };

  const reset = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  const [assignedUsers, setAssignedUsers] = useState([]);
  const [briefingFiles, setBriefingFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [scheduledDates, setScheduledDates] = useState([]);

  // Client autocomplete
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Si un client est préfillé, le marquer comme sélectionné
  const [selectedClient, setSelectedClient] = useState(
    prefillClient?.client_id ? { id: prefillClient.client_id, name: prefillClient.client } : null
  );
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Recherche clients avec debounce
  const searchClientsDebounced = useCallback((searchTerm) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm || searchTerm.length < 2) {
      setClientSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await clientService.searchClients(searchTerm, 8);
        setClientSuggestions(data || []);
        setShowSuggestions((data || []).length > 0);
      } catch (error) {
        logger.warn('Erreur recherche clients:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Quand on tape dans le champ client, lancer la recherche
  const handleClientInputChange = useCallback((e) => {
    handleChange(e);
    setSelectedClient(null); // Reset la selection si on retape
    searchClientsDebounced(e.target.value);
  }, [handleChange, searchClientsDebounced]);

  // Quand on selectionne un client dans la liste
  const handleSelectClient = useCallback((client) => {
    setSelectedClient(client);
    setShowSuggestions(false);
    setClientSuggestions([]);

    // Auto-remplir les champs
    const fullAddress = [client.address, client.postal_code, client.city]
      .filter(Boolean)
      .join(', ');

    // Mettre a jour les champs du formulaire
    handleChange({ target: { name: 'client', value: client.name } });
    if (fullAddress) {
      handleChange({ target: { name: 'address', value: fullAddress } });
    }
    if (client.phone) {
      handleChange({ target: { name: 'client_phone', value: client.phone } });
    }
    if (client.email) {
      handleChange({ target: { name: 'client_email', value: client.email } });
    }

    logger.log('InterventionForm: Client selectionne', client.name);
  }, [handleChange]);

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleUserAssignmentChange = useCallback((userId) => {
    setAssignedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const setDateShortcut = useCallback((daysToAdd) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    const dateStr = toLocalDateStr(date);
    handleChange({ target: { name: 'date', value: dateStr } });
  }, [handleChange]);

  const handleAddScheduledDate = useCallback(() => {
    const dateValue = values.date;
    if (!dateValue) {
      alert('Veuillez sélectionner une date d\'abord');
      return;
    }

    // Vérifier si la date n'est pas déjà dans la liste
    if (scheduledDates.includes(dateValue)) {
      alert('Cette date est déjà dans la liste');
      return;
    }

    setScheduledDates(prev => [...prev, dateValue].sort());
    logger.log('InterventionForm: Date ajoutée au planning multi-jours', dateValue);
  }, [values.date, scheduledDates]);

  const handleRemoveScheduledDate = useCallback((dateToRemove) => {
    setScheduledDates(prev => prev.filter(d => d !== dateToRemove));
    logger.log('InterventionForm: Date retirée du planning', dateToRemove);
  }, []);

  const handleFileChange = useCallback((e) => {
    setUploadError('');
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Validation: max 10 files
    if (briefingFiles.length + files.length > 10) {
      setUploadError('Vous ne pouvez pas ajouter plus de 10 fichiers.');
      return;
    }

    // Validation: max 10MB per file
    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setUploadError(`Certains fichiers dépassent 10 MB : ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    const newFilesWithId = files.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      fileObject: file
    }));

    setBriefingFiles(prev => [...prev, ...newFilesWithId]);
    logger.log(`InterventionForm: ${files.length} fichier(s) ajouté(s)`);
  }, [briefingFiles.length]);

  const handleRemoveFile = useCallback((fileId) => {
    setBriefingFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const handleFormCancel = useCallback(() => {
    reset();
    setAssignedUsers([]);
    setBriefingFiles([]);
    setUploadError('');
    setScheduledDates([]);
    onCancel();
  }, [reset, onCancel]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData.items;
    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        files.push(items[i].getAsFile());
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      // Reuse handleFileChange logic
      const syntheticEvent = { target: { files: files } };
      handleFileChange(syntheticEvent);
    }
  }, [handleFileChange]);

  const employees = users;

  return (
    <form onSubmit={handleSubmit} className="intervention-form" onPaste={handlePaste}>
      {hasDraft && <DraftBanner lastSavedAt={lastSavedAt} onIgnore={clearDraft} />}
      
      {/* Client avec autocomplete */}
      <div className="form-group client-autocomplete-wrapper" ref={suggestionsRef}>
        <label htmlFor="client" className="form-label">
          Client <span className="required">*</span>
        </label>
        <div className="client-input-container">
          <input
            id="client"
            name="client"
            type="text"
            value={values.client}
            onChange={handleClientInputChange}
            onFocus={() => {
              if (clientSuggestions.length > 0) setShowSuggestions(true);
            }}
            disabled={isSubmitting}
            className={`form-control ${errors.client ? 'error' : ''}`}
            placeholder="Tapez pour rechercher un client existant..."
            required
            autoComplete="off"
          />
          {isSearching && <span className="client-search-indicator">...</span>}
          {selectedClient && <span className="client-selected-badge">Client existant</span>}
        </div>
        {errors.client && <span className="error-message">{errors.client}</span>}

        {/* Liste de suggestions clients */}
        {showSuggestions && clientSuggestions.length > 0 && (
          <div className="client-suggestions-dropdown">
            <div className="suggestions-header">Clients existants :</div>
            {clientSuggestions.map(client => (
              <div
                key={client.id}
                className="client-suggestion-item"
                onClick={() => handleSelectClient(client)}
              >
                <div className="suggestion-name">{client.name}</div>
                <div className="suggestion-details">
                  {client.address && <span>{client.address}</span>}
                  {client.city && <span> - {client.city}</span>}
                  {client.phone && <span> | {client.phone}</span>}
                </div>
              </div>
            ))}
            <div className="suggestions-footer">
              Ou continuez a taper pour creer un nouveau client
            </div>
          </div>
        )}
      </div>

      {/* Contact Info - 2 columns */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="client_phone" className="form-label">
            ☎️ Téléphone client <span className="required">*</span>
          </label>
          <input
            id="client_phone"
            name="client_phone"
            type="tel"
            value={values.client_phone}
            onChange={handleChange}
            disabled={isSubmitting}
            className={`form-control ${errors.client_phone ? 'error' : ''}`}
            placeholder="06 12 34 56 78"
            required
          />
          {errors.client_phone && <span className="error-message">{errors.client_phone}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="secondary_phone" className="form-label">
            📞 N° secondaire <span className="optional">(optionnel)</span>
          </label>
          <input
            id="secondary_phone"
            name="secondary_phone"
            type="tel"
            value={values.secondary_phone}
            onChange={handleChange}
            disabled={isSubmitting}
            className="form-control"
            placeholder="Fournisseur, autre contact..."
          />
        </div>
      </div>

      {/* Email & Ticket */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="client_email" className="form-label">
            📧 Email client <span className="optional">(optionnel)</span>
          </label>
          <input
            id="client_email"
            name="client_email"
            type="email"
            value={values.client_email}
            onChange={handleChange}
            disabled={isSubmitting}
            className="form-control"
            placeholder="client@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ticket_number" className="form-label">
            🎫 N° ticket/référence <span className="optional">(optionnel)</span>
          </label>
          <input
            id="ticket_number"
            name="ticket_number"
            type="text"
            value={values.ticket_number}
            onChange={handleChange}
            disabled={isSubmitting}
            className="form-control"
            placeholder="TICKET-2024-001"
          />
        </div>
      </div>

      {/* Address */}
      <div className="form-group">
        <label htmlFor="address" className="form-label">
          Adresse <span className="required">*</span>
        </label>
        <input
          id="address"
          name="address"
          type="text"
          value={values.address}
          onChange={handleChange}
          disabled={isSubmitting}
          className={`form-control ${errors.address ? 'error' : ''}`}
          placeholder="Adresse complète"
          required
        />
        {errors.address && <span className="error-message">{errors.address}</span>}
      </div>

      {/* Service */}
      <div className="form-group">
        <label htmlFor="service" className="form-label">
          Service <span className="required">*</span>
        </label>
        <input
          id="service"
          name="service"
          type="text"
          value={values.service}
          onChange={handleChange}
          disabled={isSubmitting}
          className={`form-control ${errors.service ? 'error' : ''}`}
          placeholder="Type de service"
          required
        />
        {errors.service && <span className="error-message">{errors.service}</span>}
      </div>

      {/* Date & Time */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date" className="form-label">
            Date <span className="required">*</span>
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={values.date}
            onChange={handleChange}
            disabled={isSubmitting}
            className={`form-control ${errors.date ? 'error' : ''}`}
            required
          />
          {errors.date && <span className="error-message">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="time" className="form-label">
            Heure <span className="required">*</span>
          </label>
          <input
            id="time"
            name="time"
            type="time"
            value={values.time}
            onChange={handleChange}
            disabled={isSubmitting}
            className={`form-control ${errors.time ? 'error' : ''}`}
            required
          />
          {errors.time && <span className="error-message">{errors.time}</span>}
        </div>
      </div>

      {/* Date shortcuts */}
      <div className="date-shortcuts">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDateShortcut(0)}
          disabled={isSubmitting}
        >
          Aujourd'hui
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDateShortcut(1)}
          disabled={isSubmitting}
        >
          Demain
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDateShortcut(7)}
          disabled={isSubmitting}
        >
          Dans 1 semaine
        </Button>
      </div>

      {/* Planification multi-jours */}
      <div className="form-group multi-day-scheduling">
        <label className="form-label">
          📅 Planification multi-jours <span className="optional">(optionnel)</span>
        </label>
        <p className="form-hint">
          Ajoutez plusieurs dates pour planifier cette intervention sur plusieurs jours différents (ex: le 1er, le 6 et le 12).
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddScheduledDate}
            disabled={isSubmitting || !values.date}
          >
            <PlusIcon /> Ajouter la date au planning
          </Button>
        </div>

        {/* Liste des dates planifiées */}
        {scheduledDates.length > 0 && (
          <div className="scheduled-dates-list">
            <h4 className="scheduled-dates-title">Dates planifiées ({scheduledDates.length}):</h4>
            <ul className="scheduled-dates-items">
              {scheduledDates.map(date => {
                const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
                return (
                  <li key={date} className="scheduled-date-item">
                    <span className="scheduled-date-text">📅 {formattedDate}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveScheduledDate(date)}
                      disabled={isSubmitting}
                      className="btn-remove-date"
                      title="Retirer cette date"
                      aria-label={`Retirer la date du ${formattedDate}`}
                    >
                      <XIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Kilométrage départ */}
      <div className="form-group">
        <label htmlFor="km_start" className="form-label">
          🚗 Kilométrage départ <span className="optional">(pour remboursement)</span>
        </label>
        <input
          id="km_start"
          name="km_start"
          type="number"
          min="0"
          step="1"
          value={values.km_start}
          onChange={handleChange}
          disabled={isSubmitting}
          className="form-control"
          placeholder="Ex: 45230"
          style={{ maxWidth: '200px' }}
        />
        <small className="form-hint">Le kilométrage de fin sera enregistré à la clôture</small>
      </div>

      {/* File upload */}
      <div className="form-group">
        <label className="form-label">
          Documents de préparation <span className="optional">(optionnel)</span>
        </label>
        <CustomFileInput
          onChange={handleFileChange}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          multiple={true}
          disabled={isSubmitting}
        >
          📎 Choisir ou glisser des fichiers...
        </CustomFileInput>

        {/* File preview list */}
        {briefingFiles.length > 0 && (
          <ul className="file-preview-list">
            {briefingFiles.map(item => (
              <li key={item.id} className="file-preview-item">
                <FileTextIcon />
                <div className="file-info">
                  <span className="file-name">{item.fileObject.name}</span>
                  <span className="file-size">{formatFileSize(item.fileObject.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(item.id)}
                  disabled={isSubmitting}
                  className="btn-remove-file"
                  title="Retirer"
                  aria-label={`Retirer ${item.fileObject.name}`}
                >
                  <XIcon />
                </button>
              </li>
            ))}
          </ul>
        )}

        {uploadError && <span className="error-message">{uploadError}</span>}
      </div>

      {/* Admin Note */}
      <div className="form-group">
        <label htmlFor="admin_note" className="form-label">
          📝 Note pour l'employé <span className="optional">(visible uniquement par l'employé)</span>
        </label>
        <textarea
          id="admin_note"
          name="admin_note"
          value={values.admin_note || ''}
          onChange={handleChange}
          disabled={isSubmitting}
          className="form-control"
          placeholder="Instructions particulières, code d'accès, etc."
          rows={3}
        />
      </div>

      {/* User assignment */}
      <div className="form-group">
        <label className="form-label">
          Assigner à : <span className="optional">(optionnel)</span>
        </label>
        <div className="user-checkboxes">
          {employees.map(user => (
            <label key={user.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={assignedUsers.includes(user.id)}
                onChange={() => handleUserAssignmentChange(user.id)}
                disabled={isSubmitting}
                className="checkbox-input"
              />
              <span>{user.full_name}</span>
            </label>
          ))}
        </div>
        {employees.length === 0 && (
          <p className="text-muted">Aucun employé disponible</p>
        )}
      </div>

      {/* Form actions */}
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={handleFormCancel}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          variant="primary"
          icon={<PlusIcon />}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Création en cours...' : "Créer l'intervention"}
        </Button>
      </div>
    </form>
  );
};

export default InterventionForm;
