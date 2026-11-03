// src/components/intervention/StatusCard.jsx
// Carte de résumé rapide de l'intervention

import './StatusCard.css';
import StatusBadge from '../ui/StatusBadge';

const StatusCard = ({ intervention, report, stats }) => {
  const { client, address, status } = intervention || {};
  const { duration, photoCount, checkpointProgress, team,teamCount } = stats || {};


  return (
    <div className="status-card">
      <div className="status-card-header">
        <StatusBadge status={status}/>
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
            <span className="metric-value">{Number.isInteger(teamCount)?`${teamCount} personne${teamCount>1?'s':''} · ${team}`:Array.isArray(team)?team.join(', '):team}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
