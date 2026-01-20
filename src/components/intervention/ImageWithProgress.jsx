// src/components/intervention/ImageWithProgress.jsx
// Composant pour afficher une image avec overlay de progression d'upload

import React from 'react';
import { CheckCircleIcon, AlertTriangleIcon } from '../SharedUI';

/**
 * Affiche une image avec un overlay de progression pendant l'upload
 * @param {string} src - URL de l'image (locale ou cloud)
 * @param {string} alt - Texte alternatif
 * @param {string} status - 'uploading' | 'completed' | 'error'
 * @param {number} progress - Progression de 0 à 100
 * @param {string} error - Message d'erreur si status === 'error'
 * @param {Function} onRemove - Callback pour supprimer l'image
 * @param {Function} onClick - Callback au clic sur l'image
 */
const ImageWithProgress = ({
  src,
  alt = 'Image',
  status = 'completed',
  progress = 100,
  error = null,
  onRemove,
  onClick,
  style = {}
}) => {
  const isUploading = status === 'uploading';
  const isError = status === 'error';
  const isCompleted = status === 'completed';

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '4/3',
        borderRadius: 8,
        overflow: 'hidden',
        border: isError ? '2px solid #ef4444' : '2px solid #e5e7eb',
        background: '#f8fafc',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      onClick={onClick}
    >
      {/* Image */}
      {src && (
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isUploading ? 0.6 : 1,
            transition: 'opacity 0.3s'
          }}
        />
      )}

      {/* Overlay pendant upload */}
      {isUploading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          {/* Cercle de progression */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: `conic-gradient(#0ea5a5 ${progress * 3.6}deg, rgba(255,255,255,0.3) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {Math.round(progress)}%
            </div>
          </div>

          {/* Texte */}
          <div style={{ color: 'white', fontSize: 12, fontWeight: 500 }}>
            Envoi en cours...
          </div>
        </div>
      )}

      {/* Overlay succès (bref) */}
      {isCompleted && progress === 100 && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: '#22c55e',
            borderRadius: '50%',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <CheckCircleIcon style={{ width: 16, height: 16, color: 'white' }} />
        </div>
      )}

      {/* Overlay erreur */}
      {isError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(239, 68, 68, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 8
          }}
        >
          <AlertTriangleIcon style={{ width: 32, height: 32, color: 'white' }} />
          <div style={{ color: 'white', fontSize: 11, textAlign: 'center' }}>
            {error || 'Erreur d\'envoi'}
          </div>
        </div>
      )}

      {/* Bouton supprimer */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            minHeight: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
            opacity: isUploading ? 0.5 : 1
          }}
          disabled={isUploading}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ImageWithProgress;
