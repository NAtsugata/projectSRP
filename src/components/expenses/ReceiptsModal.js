// src/components/expenses/ReceiptsModal.js
// Modal de visualisation des justificatifs

import React, { useState } from 'react';

const ReceiptsModal = ({ receipts, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!receipts || receipts.length === 0) return null;

  return (
    <div className="receipts-modal-overlay" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="receipts-modal-close"
      >
        ×
      </button>

      <img
        src={receipts[currentIndex].url}
        alt={receipts[currentIndex].name || `Justificatif ${currentIndex + 1}`}
        className="receipts-modal-image"
        onClick={(e) => e.stopPropagation()}
      />

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
};

export default ReceiptsModal;
