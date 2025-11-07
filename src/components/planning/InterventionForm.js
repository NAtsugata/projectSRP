// src/components/planning/InterventionForm.js
// Formulaire de création/édition d'intervention

import React, { useState, useCallback } from 'react';
import { Button } from '../ui';
import { PlusIcon, XIcon, FileTextIcon, CustomFileInput } from '../SharedUI';
import { useForm } from '../../hooks';
import { validateIntervention } from '../../utils/validators';
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
    km_start: ''
  },
  users = [],
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  const { values, errors, handleChange, handleSubmit, reset } = useForm(
    initialValues,
    validateIntervention,
    async (formData) => {
      logger.log('InterventionForm: Submitting...', formData);
      await onSubmit({
        formData,
        assignedUsers,
        files: briefingFiles.map(f => f.fileObject)
      });
    }
  );

  const [assignedUsers, setAssignedUsers] = useState([]);
  const [briefingFiles, setBriefingFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');

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
    const dateStr = date.toISOString().split('T')[0];
    handleChange({ target: { name: 'date', value: dateStr } });
  }, [handleChange]);

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
    onCancel();
  }, [reset, onCancel]);

  const employees = users.filter(u => !u.is_admin);

  return (
    <form onSubmit={handleSubmit} className="intervention-form">
      {/* Client */}
      <div className="form-group">
        <label htmlFor="client" className="form-label">
          Client <span className="required">*</span>
        </label>
        <input
          id="client"
          name="client"
          type="text"
          value={values.client}
          onChange={handleChange}
          disabled={isSubmitting}
          className={`form-control ${errors.client ? 'error' : ''}`}
          placeholder="Nom du client"
          required
        />
        {errors.client && <span className="error-message">{errors.client}</span>}
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
