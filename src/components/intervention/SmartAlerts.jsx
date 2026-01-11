// src/components/intervention/SmartAlerts.js
// Alertes intelligentes pour guider l'employé

import React, { useMemo } from 'react';
import './SmartAlerts.css';

const SmartAlerts = ({ report, intervention, MIN_PHOTOS = 2 }) => {
  const alerts = useMemo(() => {
    const alertList = [];

    if (!report) return alertList;

    // Photos manquantes
    const photoCount = (report.files || []).filter(f => f.type?.startsWith('image/')).length;
    if (photoCount < MIN_PHOTOS) {
      alertList.push({
        type: 'warning',
        icon: '📸',
        title: 'Photos manquantes',
        message: `${photoCount}/${MIN_PHOTOS} photos minimum requises`,
        action: 'photos'
      });
    }

    // Signature manquante
    if (!report.signature) {
      alertList.push({
        type: 'warning',
        icon: '✍️',
        title: 'Signature requise',
        message: 'Pensez à faire signer le client',
        action: 'signature'
      });
    }

    // Checkpoints incomplets
    const checkpointsDone = (report.quick_checkpoints || []).filter(c => c.done).length;
    const checkpointsTotal = (report.quick_checkpoints || []).length;
    if (checkpointsDone < checkpointsTotal) {
      alertList.push({
        type: 'info',
        icon: '✅',
        title: 'Checklist incomplète',
        message: `${checkpointsDone}/${checkpointsTotal} points validés`,
        action: 'checklist'
      });
    }

    // Temps écoulé long sans départ
    if (report.arrivalTime && !report.departureTime) {
      const elapsed = Math.floor((new Date() - new Date(report.arrivalTime)) / 1000);
      if (elapsed > 7200) { // 2 heures
        alertList.push({
          type: 'info',
          icon: '⏱️',
          title: 'Intervention longue',
          message: 'Plus de 2h écoulées',
          action: 'time'
        });
      }
    }

    // Intervention urgente non terminée
    const isUrgent = intervention?.additional_needs?.some(need => need.isUrgent);
    if (isUrgent && !report.departureTime) {
      alertList.push({
        type: 'error',
        icon: '🚨',
        title: 'Intervention urgente',
        message: 'Priorisez cette intervention',
        action: 'urgent'
      });
    }

    // Félicitations si tout est bon
    if (alertList.length === 0 && photoCount >= MIN_PHOTOS && report.signature) {
      alertList.push({
        type: 'success',
        icon: '🎉',
        title: 'Tout est prêt !',
        message: 'Vous pouvez clôturer l\'intervention',
        action: 'complete'
      });
    }

    return alertList;
  }, [report, intervention, MIN_PHOTOS]);

  if (alerts.length === 0) return null;

  const scrollToSection = (action) => {
    const sectionMap = {
      photos: 'photos-section',
      signature: 'signature-section',
      checklist: 'checklist-section',
    };

    const targetId = sectionMap[action];
    if (targetId) {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Flash effect
        element.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.3)';
        setTimeout(() => {
          element.style.boxShadow = '';
        }, 1500);
      }
    }
  };

  const handleKeyDown = (event, action) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToSection(action);
    }
  };

  return (
    <div className="smart-alerts" role="region" aria-label="Alertes intervention" aria-live="polite">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className={`smart-alert alert-${alert.type}`}
          onClick={() => scrollToSection(alert.action)}
          onKeyDown={(e) => handleKeyDown(e, alert.action)}
          role={alert.action ? 'button' : 'status'}
          tabIndex={alert.action ? 0 : undefined}
          aria-label={`${alert.title}: ${alert.message}`}
        >
          <div className="alert-icon" aria-hidden="true">{alert.icon}</div>
          <div className="alert-content">
            <div className="alert-title">{alert.title}</div>
            <div className="alert-message">{alert.message}</div>
          </div>
          {alert.action && alert.action !== 'complete' && (
            <svg
              className="alert-arrow"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          )}
        </div>
      ))}
    </div>
  );
};

export default SmartAlerts;
