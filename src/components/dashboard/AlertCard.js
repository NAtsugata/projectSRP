// src/components/dashboard/AlertCard.js
// Carte d'alerte/notification pour dashboard

import React from 'react';
import { AlertTriangleIcon } from '../SharedUI';
import './AlertCard.css';

/**
 * AlertCard Component
 *
 * @param {string} title - Titre de l'alerte
 * @param {string} message - Message descriptif
 * @param {string} variant - Type d'alerte: 'info', 'warning', 'danger', 'success' (default: 'info')
 * @param {React.ReactNode} icon - Icône personnalisée (optionnel)
 * @param {React.ReactNode} action - Bouton d'action (optionnel)
 * @param {Function} onDismiss - Callback pour fermer l'alerte (optionnel)
 */
const AlertCard = ({
  title,
  message,
  variant = 'info',
  icon,
  action,
  onDismiss
}) => {
  const defaultIcons = {
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
    warning: <AlertTriangleIcon />,
    danger: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    ),
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="9 12 11 14 15 10"></polyline>
      </svg>
    )
  };

  return (
    <div className={`alert-card alert-card-${variant}`}>
      <div className="alert-card-icon">
        {icon || defaultIcons[variant]}
      </div>

      <div className="alert-card-content">
        <h4 className="alert-card-title">{title}</h4>
        {message && <p className="alert-card-message">{message}</p>}
        {action && <div className="alert-card-action">{action}</div>}
      </div>

      {onDismiss && (
        <button
          className="alert-card-dismiss"
          onClick={onDismiss}
          aria-label="Fermer l'alerte"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
};

export default AlertCard;
