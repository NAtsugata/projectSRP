// src/components/ui/EmptyState.js
// Composant pour afficher un état vide avec style

import './EmptyState.css';

/**
 * Composant EmptyState
 * @param {string} icon - Icône (emoji ou SVG)
 * @param {string} title - Titre
 * @param {string} message - Message descriptif
 * @param {ReactNode} action - Action (bouton, lien, etc.)
 */
const EmptyState = ({
  icon = '📭',
  title = 'Aucun élément',
  message,
  action
}) => {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon">{icon}</div>

      <h3 className="empty-state-title">{title}</h3>

      {message && (
        <p className="empty-state-message">{message}</p>
      )}

      {action && (
        <div className="empty-state-action">{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
