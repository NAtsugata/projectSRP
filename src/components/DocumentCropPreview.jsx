import { useState, useEffect } from 'react';
import './DocumentCropPreview.css';

/**
 * DocumentCropPreview Component
 *
 * Displays detected document with highlighted edges and allows user to:
 * - Accept the automatic crop
 * - Use the original image
 * - Cancel and retake photo
 */
const DocumentCropPreview = ({
  detectionResult,
  onAccept,
  onUseOriginal,
  onCancel,
  isProcessing = false
}) => {
  const [currentView, setCurrentView] = useState('preview'); // 'preview' | 'transformed'

  useEffect(() => {
    // Default to preview if available, otherwise original
    if (detectionResult?.preview) {
      setCurrentView('preview');
    } else {
      setCurrentView('original');
    }
  }, [detectionResult]);

  if (!detectionResult) {
    return null;
  }

  const { detected, original, preview, transformed } = detectionResult;

  const handleAcceptCrop = () => {
    if (transformed) {
      onAccept(transformed);
    } else {
      onUseOriginal(original);
    }
  };

  const handleUseOriginal = () => {
    onUseOriginal(original);
  };

  const getCurrentImage = () => {
    if (currentView === 'transformed' && transformed) {
      return transformed;
    } else if (currentView === 'preview' && preview) {
      return preview;
    }
    return original;
  };

  return (
    <div className="document-crop-preview-overlay">
      <div className="document-crop-preview-container">
        {/* Header */}
        <div className="document-crop-preview-header">
          <h3>
            {detected ? '📄 Document détecté' : '📷 Photo capturée'}
          </h3>
          <button
            className="close-button"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Image Preview */}
        <div className="document-crop-preview-image-container">
          <img
            src={getCurrentImage()}
            alt="Document preview"
            className="document-crop-preview-image"
          />

          {detected && (
            <div className="detection-status">
              <span className="detection-badge">
                ✓ Contours détectés
              </span>
            </div>
          )}
        </div>

        {/* View Toggle (if document detected) */}
        {detected && transformed && (
          <div className="view-toggle">
            <button
              className={`toggle-btn ${currentView === 'preview' ? 'active' : ''}`}
              onClick={() => setCurrentView('preview')}
              disabled={isProcessing}
            >
              Aperçu
            </button>
            <button
              className={`toggle-btn ${currentView === 'transformed' ? 'active' : ''}`}
              onClick={() => setCurrentView('transformed')}
              disabled={isProcessing}
            >
              Recadré
            </button>
          </div>
        )}

        {/* Info Message */}
        <div className="document-crop-preview-info">
          {detected ? (
            <p>
              Les contours du document ont été détectés automatiquement.
              Utilisez la version recadrée ou conservez l'original.
            </p>
          ) : (
            <p>
              Aucun document n'a été détecté automatiquement.
              Vous pouvez utiliser la photo telle quelle.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="document-crop-preview-actions">
          {detected ? (
            <>
              <button
                className="action-btn primary"
                onClick={handleAcceptCrop}
                disabled={isProcessing}
              >
                {isProcessing ? 'Traitement...' : '✓ Utiliser le recadrage'}
              </button>
              <button
                className="action-btn secondary"
                onClick={handleUseOriginal}
                disabled={isProcessing}
              >
                Conserver l'original
              </button>
            </>
          ) : (
            <button
              className="action-btn primary"
              onClick={handleUseOriginal}
              disabled={isProcessing}
            >
              {isProcessing ? 'Traitement...' : '✓ Utiliser cette photo'}
            </button>
          )}

          <button
            className="action-btn cancel"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentCropPreview;
