// src/components/dashboard/StatCard.js
// Carte de statistique avec icône, valeur, label et trend

import React from 'react';
import './StatCard.css';

/**
 * StatCard Component
 *
 * @param {string|number} value - La valeur principale à afficher
 * @param {string} label - Le libellé descriptif
 * @param {React.ReactNode} icon - L'icône à afficher (optionnel)
 * @param {string} trend - Tendance: 'up', 'down', 'neutral' (optionnel)
 * @param {string|number} trendValue - Valeur du trend (ex: "+12%") (optionnel)
 * @param {string} variant - Variante de couleur: 'primary', 'success', 'warning', 'danger', 'info' (default: 'primary')
 * @param {Function} onClick - Callback au clic (rend la carte cliquable)
 */
const StatCard = ({
  value,
  label,
  icon,
  trend,
  trendValue,
  variant = 'primary',
  onClick
}) => {
  const isClickable = typeof onClick === 'function';

  const getTrendIcon = () => {
    if (!trend) return null;

    switch (trend) {
      case 'up':
        return (
          <svg
            className="trend-icon trend-up"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
        );
      case 'down':
        return (
          <svg
            className="trend-icon trend-down"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
            <polyline points="17 18 23 18 23 12"></polyline>
          </svg>
        );
      case 'neutral':
        return (
          <svg
            className="trend-icon trend-neutral"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`stat-card stat-card-${variant} ${isClickable ? 'stat-card-clickable' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyPress={isClickable ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {icon && (
        <div className="stat-card-icon">
          {icon}
        </div>
      )}

      <div className="stat-card-content">
        <p className="stat-card-value">{value}</p>
        <p className="stat-card-label">{label}</p>

        {(trend || trendValue) && (
          <div className="stat-card-trend">
            {getTrendIcon()}
            {trendValue && <span className="trend-value">{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
