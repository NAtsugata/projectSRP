// src/components/leave/LeaveRequestCard.js
// Card pour afficher une demande de congé

import React from 'react';
import { Button } from '../ui';
import { CheckIcon, XIcon, TrashIcon } from '../SharedUI';
import './LeaveRequestCard.css';

/**
 * Status badge color mapping
 */
const STATUS_COLORS = {
  'Approuvé': 'status-approved',
  'En attente': 'status-pending',
  'Rejeté': 'status-rejected'
};

/**
 * Calculate number of days between two dates
 */
const calculateDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  return diffDays;
};

/**
 * LeaveRequestCard Component
 * @param {Object} request - Leave request data
 * @param {Function} onApprove - Handler to approve (admin only)
 * @param {Function} onReject - Handler to reject (admin only)
 * @param {Function} onDelete - Handler to delete
 * @param {boolean} showActions - Show action buttons (admin view)
 * @param {boolean} showUserName - Show user name (admin view)
 */
const LeaveRequestCard = ({
  request,
  onApprove,
  onReject,
  onDelete,
  showActions = true,
  showUserName = false
}) => {
  const statusClass = STATUS_COLORS[request.status] || 'status-default';
  const days = calculateDays(request.start_date, request.end_date);
  const isPending = request.status === 'En attente';

  return (
    <div className="leave-request-card">
      <div className="leave-request-content">
        {/* Header */}
        <div className="leave-request-header">
          <div className="header-row">
            {showUserName && request.user_name && (
              <h4 className="request-user-name">{request.user_name}</h4>
            )}
            <span className={`status-badge ${statusClass}`}>
              {request.status}
            </span>
          </div>
          <p className="request-reason">{request.reason}</p>
        </div>

        {/* Info */}
        <div className="leave-request-info">
          <p className="info-item">
            <span className="info-icon">📅</span>
            <span className="info-text">
              Du {new Date(request.start_date).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
              {' au '}
              {new Date(request.end_date).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </p>
          <p className="info-item">
            <span className="info-icon">⏱️</span>
            <span className="info-text">
              {days} jour{days > 1 ? 's' : ''}
            </span>
          </p>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="leave-request-actions">
          {isPending && (
            <>
              <Button
                variant="success"
                size="sm"
                icon={<CheckIcon />}
                onClick={() => onApprove?.(request.id)}
                title="Approuver la demande"
                aria-label={`Approuver la demande de ${request.user_name || 'congé'}`}
              >
                Approuver
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<XIcon />}
                onClick={() => onReject?.(request.id)}
                title="Rejeter la demande"
                aria-label={`Rejeter la demande de ${request.user_name || 'congé'}`}
              >
                Rejeter
              </Button>
            </>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              icon={<TrashIcon width={18} height={18} />}
              onClick={() => onDelete(request.id)}
              title="Supprimer"
              aria-label={`Supprimer la demande de ${request.user_name || 'congé'}`}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default LeaveRequestCard;
