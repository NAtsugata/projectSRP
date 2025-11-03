// src/components/ui/Button.js
// Composant Button réutilisable avec variantes et états

import React from 'react';
import './Button.css';

/**
 * Composant Button amélioré
 * @param {string} variant - primary | secondary | danger | ghost
 * @param {string} size - sm | md | lg
 * @param {boolean} loading - Affiche un spinner
 * @param {boolean} disabled - Désactive le bouton
 * @param {string} fullWidth - Prend toute la largeur
 * @param {ReactNode} icon - Icône à afficher
 * @param {string} type - button | submit | reset
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon = null,
  type = 'button',
  className = '',
  onClick,
  ...props
}) => {
  const classNames = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <svg className="spinner" viewBox="0 0 24 24">
            <circle className="spinner-circle" cx="12" cy="12" r="10" />
          </svg>
        </span>
      )}
      {icon && !loading && <span className="btn-icon">{icon}</span>}
      <span className="btn-text">{children}</span>
    </button>
  );
};

export default Button;
