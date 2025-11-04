// src/components/dashboard/QuickActions.js
// Boutons d'actions rapides pour le dashboard

import React from 'react';
import { Button } from '../ui';
import './QuickActions.css';

/**
 * QuickActions Component
 *
 * @param {Array} actions - Liste des actions [{label, icon, onClick, variant}]
 * @param {string} title - Titre de la section (default: "Actions rapides")
 */
const QuickActions = ({
  actions = [],
  title = 'Actions rapides'
}) => {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="quick-actions">
      <h3 className="quick-actions-title">{title}</h3>

      <div className="quick-actions-grid">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'secondary'}
            icon={action.icon}
            onClick={action.onClick}
            className="quick-action-btn"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
