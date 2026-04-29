// src/components/intervention/StatusCard.jsx
// Carte de résumé rapide de l'intervention

import React from 'react';
import './StatusCard.css';

const StatusCard = ({ intervention, report, stats }) => {
  const { client, address, status } = intervention || {};
  const { duration, photoCount, checkpointProgress, team } = stats || {};

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
      case 'Terminé':
        return '#10b981';
      case 'in_progress':
      case 'En cours':
        return '#0ea5e9';
      case 'pending':
      case 'À venir':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const statusColor = getStatusColor(status);

  return (
    <div className="status-card">
      <div className="status-card-header">
        <div className="status-indicator" style={{ background: statusColor }}>
          <span className="status-pulse" style={{ background: statusColor }}></span>
        </div>
        <div className="status-info">
          <h3 className="status-title">{client || 'Client'}</h3>
          <p className="status-subtitle">{address || 'Adresse'}</p>
        </div>
      </div>

      <div className="status-card-metrics">
        {duration && (
          <div className="metric">
            <span className="metric-icon">⏱️</span>
            <span className="metric-value">{duration}</span>
          </div>
        )}

        {photoCount !== undefined && (
          <div className="metric">
            <span className="metric-icon">📸</span>
            <span className="metric-value">{photoCount} photos</span>
          </div>
        )}

        {checkpointProgress && (
          <div className="metric">
            <span className="metric-icon">✓</span>
            <span className="metric-value">{checkpointProgress}</span>
          </div>
        )}

        {team && team.length > 0 && (
          <div className="metric">
            <span className="metric-icon">👥</span>
            <span className="metric-value">{team.length > 1 ? `${team.length} personnes` : team[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
