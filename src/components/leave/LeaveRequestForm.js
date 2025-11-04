// src/components/leave/LeaveRequestForm.js
// Formulaire de demande de congé

import React from 'react';
import { Button } from '../ui';
import { PlusIcon } from '../SharedUI';
import { useForm } from '../../hooks';
import { validateLeaveRequest } from '../../utils/validators';
import './LeaveRequestForm.css';

/**
 * LeaveRequestForm Component
 * @param {Object} initialValues - Initial form values
 * @param {Function} onSubmit - Handler for form submission
 * @param {Function} onCancel - Handler for cancel action
 * @param {boolean} isSubmitting - Submission state
 */
const LeaveRequestForm = ({
  initialValues = {
    startDate: '',
    endDate: '',
    reason: ''
  },
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  const { values, errors, handleChange, handleSubmit } = useForm(
    initialValues,
    validateLeaveRequest,
    onSubmit
  );

  return (
    <form onSubmit={handleSubmit} className="leave-request-form">
      <h3 className="form-title">Nouvelle demande de congé</h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="startDate" className="form-label">
            Date de début <span className="required">*</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            value={values.startDate}
            onChange={handleChange}
            disabled={isSubmitting}
            className={`form-control ${errors.startDate ? 'error' : ''}`}
            required
          />
          {errors.startDate && <span className="error-message">{errors.startDate}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="endDate" className="form-label">
            Date de fin <span className="required">*</span>
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            value={values.endDate}
            onChange={handleChange}
            disabled={isSubmitting}
            className={`form-control ${errors.endDate ? 'error' : ''}`}
            required
          />
          {errors.endDate && <span className="error-message">{errors.endDate}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="reason" className="form-label">
          Motif <span className="required">*</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          value={values.reason}
          onChange={handleChange}
          disabled={isSubmitting}
          className={`form-control ${errors.reason ? 'error' : ''}`}
          rows="3"
          placeholder="Décrivez le motif de votre demande..."
          required
        />
        {errors.reason && <span className="error-message">{errors.reason}</span>}
      </div>

      <div className="form-actions">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          icon={<PlusIcon />}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Envoi en cours...' : 'Envoyer la demande'}
        </Button>
      </div>
    </form>
  );
};

export default LeaveRequestForm;
