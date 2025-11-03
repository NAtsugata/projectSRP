// src/components/ui/ConfirmDialog.js
// Modal de confirmation améliorée avec accessibilité

import React, { useEffect, useRef } from 'react';
import Button from './Button';
import './ConfirmDialog.css';

/**
 * Dialog de confirmation accessible
 * @param {boolean} isOpen - Ouvert/fermé
 * @param {string} title - Titre du dialog
 * @param {string} message - Message de confirmation
 * @param {string} confirmText - Texte du bouton de confirmation
 * @param {string} cancelText - Texte du bouton d'annulation
 * @param {string} variant - danger | warning | info
 * @param {Function} onConfirm - Callback de confirmation
 * @param {Function} onCancel - Callback d'annulation
 * @param {boolean} loading - État de chargement
 */
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false
}) => {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Gestion du focus trap
  useEffect(() => {
    if (isOpen) {
      // Focus sur le bouton de confirmation
      confirmButtonRef.current?.focus();

      // Prévenir le scroll du body
      document.body.style.overflow = 'hidden';

      // Gestion de la touche Escape
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };

      document.addEventListener('keydown', handleEscape);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
      default:
        return '❓';
    }
  };

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`confirm-dialog confirm-dialog-${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
      >
        <div className="confirm-dialog-icon">
          {getIcon()}
        </div>

        <h2 id="dialog-title" className="confirm-dialog-title">
          {title}
        </h2>

        <p id="dialog-message" className="confirm-dialog-message">
          {message}
        </p>

        <div className="confirm-dialog-actions">
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            ref={confirmButtonRef}
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
