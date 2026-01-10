// src/components/ui/LoadingSpinner.js
// Composant de chargement réutilisable

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

export default LoadingSpinner;
