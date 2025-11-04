// src/components/planning/InterventionCard.js
// Card pour afficher une intervention

import React from 'react';
import { Button } from '../ui';
import { EditIcon, ArchiveIcon, TrashIcon } from '../SharedUI';
import { getAssignedUsersNames } from '../../utils/helpers';
import './InterventionCard.css';

/**
 * Get status of intervention
 */
const getInterventionStatus = (intervention) => {
  if (intervention.status === 'Terminée') return 'Terminée';
  if (intervention.report && intervention.report.arrivalTime) return 'En cours';
  return intervention.status || 'À venir';
};

/**
 * Status badge color mapping
 */
const STATUS_COLORS = {
  'À venir': 'status-blue',
  'En cours': 'status-yellow',
  'Terminée': 'status-green'
};

/**
 * InterventionCard Component
 * @param {Object} intervention - Intervention data
 * @param {Function} onView - Handler to view details
 * @param {Function} onArchive - Handler to archive
 * @param {Function} onDelete - Handler to delete
 * @param {boolean} showActions - Show action buttons
 */
const InterventionCard = ({
  intervention,
  onView,
  onArchive,
  onDelete,
  showActions = true
}) => {
  const status = getInterventionStatus(intervention);
  const statusClass = STATUS_COLORS[status] || 'status-default';
  const assignedNames = getAssignedUsersNames(intervention.intervention_assignments);
  const documentsCount = intervention.intervention_briefing_documents?.length || 0;

  return (
    <div className="intervention-card">
      <div className="intervention-card-content">
        {/* Header */}
        <div className="intervention-card-header">
          <div className="intervention-card-title-row">
            <h4 className="intervention-card-title">
              {intervention.client}
            </h4>
            <span className={`status-badge ${statusClass}`}>
              {status}
            </span>
          </div>
          {intervention.service && (
            <p className="intervention-card-service">{intervention.service}</p>
          )}
        </div>

        {/* Info */}
        <div className="intervention-card-info">
          {intervention.address && (
            <p className="info-item">
              <span className="info-icon">📍</span>
              <span className="info-text">{intervention.address}</span>
            </p>
          )}

          <p className="info-item">
            <span className="info-icon">📅</span>
            <span className="info-text">
              {new Date(intervention.date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {intervention.time && ` à ${intervention.time}`}
            </span>
          </p>

          {assignedNames && assignedNames !== 'Non assigné' && (
            <p className="info-item">
              <span className="info-icon">👥</span>
              <span className="info-text">{assignedNames}</span>
            </p>
          )}

          {documentsCount > 0 && (
            <p className="info-item">
              <span className="info-icon">📎</span>
              <span className="info-text">
                {documentsCount} document{documentsCount > 1 ? 's' : ''} joint{documentsCount > 1 ? 's' : ''}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="intervention-card-actions">
          <Button
            variant="ghost"
            size="sm"
            icon={<EditIcon width={18} height={18} />}
            onClick={() => onView?.(intervention)}
            title="Voir les détails"
            aria-label={`Voir les détails de l'intervention ${intervention.client}`}
          >
            Détails
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArchiveIcon />}
            onClick={() => onArchive?.(intervention.id)}
            title="Archiver"
            aria-label={`Archiver l'intervention ${intervention.client}`}
          />
          <Button
            variant="danger"
            size="sm"
            icon={<TrashIcon width={18} height={18} />}
            onClick={() => onDelete?.(intervention.id)}
            title="Supprimer"
            aria-label={`Supprimer l'intervention ${intervention.client}`}
          />
        </div>
      )}
    </div>
  );
};

export default InterventionCard;
