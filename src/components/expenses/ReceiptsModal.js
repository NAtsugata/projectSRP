// src/components/expenses/ReceiptsModal.js
// Modal de visualisation des justificatifs

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal pour afficher les justificatifs de notes de frais
 * @param {Array} receipts - Liste des justificatifs [{url, name}]
 * @param {Function} onClose - Callback pour fermer le modal
 * @param {boolean} usePortal - Utiliser createPortal pour le rendu (défaut: false)
 * @param {boolean} showExternalLink - Afficher le lien externe (défaut: false)
 */
const ReceiptsModal = ({ receipts, onClose, usePortal = false, showExternalLink = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!receipts || receipts.length === 0) return null;

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = 'https://via.placeholder.com/400x300?text=Image+introuvable';
  };

  const modalContent = (
    <div className="receipts-modal-overlay" onClick={onClose}>
      <button type="button" onClick={onClose} className="receipts-modal-close">
        ×
      </button>

      <img
        src={receipts[currentIndex].url}
        alt={receipts[currentIndex].name || `Justificatif ${currentIndex + 1}`}
        className="receipts-modal-image"
        onClick={(e) => e.stopPropagation()}
        onError={handleImageError}
      />

      {showExternalLink && (
        <div className="receipts-modal-info" onClick={(e) => e.stopPropagation()}>
          <p>{receipts[currentIndex].name}</p>
          <a
            href={receipts[currentIndex].url}
            target="_blank"
            rel="noopener noreferrer"
            className="receipts-modal-link"
          >
            Ouvrir l'original dans un nouvel onglet
          </a>
        </div>
      )}

      {receipts.length > 1 && (
        <div className="receipts-modal-nav" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="btn btn-secondary"
          >
            ← Précédent
          </button>
          <span className="receipts-modal-counter">
            {currentIndex + 1} / {receipts.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.min(receipts.length - 1, prev + 1))}
            disabled={currentIndex === receipts.length - 1}
            className="btn btn-secondary"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );

  if (usePortal) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

export default ReceiptsModal;
