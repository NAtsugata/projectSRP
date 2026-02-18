// src/components/ui/LoadingSpinner.js
// Composants de chargement réutilisables (Spinner + Skeleton)

import React from 'react';
import './LoadingSpinner.css';

/**
 * Composant LoadingSpinner
 * @param {string} size - sm | md | lg
 * @param {string} text - Texte de chargement
 * @param {boolean} fullScreen - Prend tout l'écran
 */
const LoadingSpinner = ({
  size = 'md',
  text = 'Chargement...',
  fullScreen = false
}) => {
  const classNames = [
    'loading-spinner-container',
    fullScreen && 'loading-fullscreen'
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} role="status" aria-live="polite">
      <div className={`loading-spinner loading-spinner-${size}`}>
        <svg className="spinner-svg" viewBox="0 0 50 50">
          <circle
            className="spinner-path"
            cx="25"
            cy="25"
            r="20"
            fill="none"
            strokeWidth="4"
          />
        </svg>
      </div>
      {text && (
        <p className="loading-text">{text}</p>
      )}
    </div>
  );
};

/**
 * Composant Skeleton - placeholder animé pendant le chargement
 * @param {string} variant - text | circle | card | row
 * @param {string|number} width - Largeur
 * @param {string|number} height - Hauteur
 * @param {number} count - Nombre de lignes (pour variant=text)
 */
export const Skeleton = ({
  variant = 'text',
  width,
  height,
  count = 1,
  className = ''
}) => {
  if (variant === 'card') {
    return (
      <div className={`skeleton-card ${className}`} role="status" aria-label="Chargement">
        <div className="skeleton-line skeleton-pulse" style={{ width: '60%', height: '14px' }} />
        <div className="skeleton-line skeleton-pulse" style={{ width: '100%', height: '12px', marginTop: '12px' }} />
        <div className="skeleton-line skeleton-pulse" style={{ width: '80%', height: '12px', marginTop: '8px' }} />
        <div className="skeleton-line skeleton-pulse" style={{ width: '40%', height: '12px', marginTop: '8px' }} />
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className={`skeleton-row ${className}`} role="status" aria-label="Chargement">
        <div className="skeleton-circle skeleton-pulse" />
        <div className="skeleton-row-content">
          <div className="skeleton-line skeleton-pulse" style={{ width: '70%', height: '14px' }} />
          <div className="skeleton-line skeleton-pulse" style={{ width: '40%', height: '12px', marginTop: '6px' }} />
        </div>
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={`skeleton-circle skeleton-pulse ${className}`}
        style={{ width: width || 40, height: height || 40 }}
        role="status"
        aria-label="Chargement"
      />
    );
  }

  // variant === 'text'
  return (
    <div className={className} role="status" aria-label="Chargement">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line skeleton-pulse"
          style={{
            width: i === count - 1 && count > 1 ? '60%' : (width || '100%'),
            height: height || '14px',
            marginTop: i > 0 ? '8px' : 0
          }}
        />
      ))}
    </div>
  );
};

/**
 * Skeleton pour une liste de cartes
 * @param {number} count - Nombre de cartes skeleton
 */
export const SkeletonList = ({ count = 3, variant = 'card' }) => (
  <div className="skeleton-list" role="status" aria-label="Chargement de la liste">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant={variant} />
    ))}
  </div>
);

export default LoadingSpinner;
