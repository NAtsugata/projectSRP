// src/pages/DocumentScannerView.js
// Scanner de documents style ClearScanner - Interface moderne et épurée
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  RotateCwIcon,
  DownloadIcon
} from '../components/SharedUI';
import {
  enhanceBlackAndWhite,
  enhanceColor,
  enhanceGrayscale
} from '../utils/documentScanner';
import documentDetectorUtils from '../utils/documentDetector';

export default function DocumentScannerView({ onSave, onClose }) {
  const [scannedDocs, setScannedDocs] = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [mode, setMode] = useState('capture'); // 'capture', 'preview', 'edit', 'detection'
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState('original'); // 'original', 'bw', 'gray', 'color'
  const [detectionResult, setDetectionResult] = useState(null); // Résultat OpenCV
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);

  // Appliquer le stream à la vidéo quand il est disponible
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Erreur play:', err);
      });
    }
  }, [stream]);

  // Démarrer la caméra
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      // Le useEffect se chargera d'appliquer le stream à la vidéo
      setStream(mediaStream);
    } catch (error) {
      console.error('Erreur caméra:', error);
      alert('Impossible d\'accéder à la caméra');
    }
  }, []);

  // Arrêter la caméra
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Capturer une photo avec détection OpenCV automatique
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    setIsProcessing(true);
    stopCamera();

    try {
      // Créer un fichier temporaire pour OpenCV
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });

      // Lancer la détection OpenCV
      const result = await documentDetectorUtils.detectDocument(file, {
        minArea: 0.1,
        autoTransform: true,
        drawContours: true
      });

      if (result.detected) {
        // Document détecté avec succès
        setDetectionResult(result);
        setMode('detection');
      } else {
        // Pas de document détecté, utiliser l'original
        const url = URL.createObjectURL(blob);
        setCurrentDoc({
          id: Date.now(),
          url,
          originalUrl: url,
          blob,
          timestamp: new Date().toISOString(),
          enhanceMode: 'original',
          rotation: 0
        });
        setMode('preview');
      }
    } catch (error) {
      console.error('Erreur détection OpenCV:', error);
      // En cas d'erreur, utiliser l'image originale
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc({
          id: Date.now(),
          url,
          originalUrl: url,
          blob,
          timestamp: new Date().toISOString(),
          enhanceMode: 'original',
          rotation: 0
        });
        setMode('preview');
      }, 'image/jpeg', 0.92);
    } finally {
      setIsProcessing(false);
    }
  }, [stopCamera]);

  // Appliquer un mode d'amélioration
  const applyEnhanceMode = useCallback((targetMode) => {
    if (!currentDoc || !canvasRef.current) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Appliquer le mode sélectionné
      switch (targetMode) {
        case 'bw':
          imageData = enhanceBlackAndWhite(imageData);
          break;
        case 'gray':
          imageData = enhanceGrayscale(imageData);
          break;
        case 'color':
          imageData = enhanceColor(imageData);
          break;
        case 'original':
        default:
          // Pas de traitement
          break;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc(prev => ({
          ...prev,
          url,
          blob,
          enhanceMode: targetMode
        }));
        setEnhanceMode(targetMode);
        setIsProcessing(false);
      }, 'image/jpeg', 0.92);
    };

    // IMPORTANT: Charger l'image originale pour toujours partir de la source
    img.src = currentDoc.originalUrl || currentDoc.url;
  }, [currentDoc]);

  // Accepter la détection OpenCV (utiliser le document recadré)
  const acceptDetection = useCallback(() => {
    if (!detectionResult) return;

    // Utiliser l'image transformée (recadrée et redressée)
    const transformedUrl = detectionResult.transformed;

    fetch(transformedUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc({
          id: Date.now(),
          url,
          originalUrl: url,
          blob,
          timestamp: new Date().toISOString(),
          enhanceMode: 'original',
          rotation: 0,
          wasDetected: true
        });
        setDetectionResult(null);
        setMode('preview');
      });
  }, [detectionResult]);

  // Refuser la détection (utiliser l'image originale)
  const rejectDetection = useCallback(() => {
    if (!detectionResult) return;

    // Utiliser l'image originale sans recadrage
    const originalUrl = detectionResult.original;

    fetch(originalUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc({
          id: Date.now(),
          url,
          originalUrl: url,
          blob,
          timestamp: new Date().toISOString(),
          enhanceMode: 'original',
          rotation: 0
        });
        setDetectionResult(null);
        setMode('preview');
      });
  }, [detectionResult]);

  // Rotation de l'image
  const rotateImage = useCallback(() => {
    if (!currentDoc || !canvasRef.current) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const newRotation = (currentDoc.rotation + 90) % 360;

      // Swap dimensions pour 90° et 270°
      if (newRotation === 90 || newRotation === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Rotation autour du centre
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((newRotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc(prev => ({
          ...prev,
          url,
          blob,
          rotation: newRotation
        }));
        setIsProcessing(false);
      }, 'image/jpeg', 0.92);
    };

    img.src = currentDoc.url;
  }, [currentDoc]);

  // Valider le document
  const confirmDocument = useCallback(() => {
    if (!currentDoc) return;

    setScannedDocs(prev => [...prev, currentDoc]);
    setCurrentDoc(null);
    setMode('capture');
  }, [currentDoc]);

  // Retirer un document
  const removeDocument = useCallback((docId) => {
    setScannedDocs(prev => prev.filter(doc => doc.id !== docId));
  }, []);

  // Upload depuis fichier
  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target.result;
        const newDoc = {
          id: Date.now() + Math.random(),
          url,
          blob: file,
          timestamp: new Date().toISOString(),
          enhanced: false,
          rotation: 0
        };
        setScannedDocs(prev => [...prev, newDoc]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Sauvegarder tous les documents
  const saveAllDocuments = useCallback(() => {
    if (scannedDocs.length === 0) {
      alert('Aucun document à sauvegarder');
      return;
    }

    if (onSave) {
      onSave(scannedDocs);
    }
  }, [scannedDocs, onSave]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>{`
        .scanner-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .scanner-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .scanner-counter {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .camera-view {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #000;
          min-height: 400px;
          overflow: hidden;
        }

        .camera-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .document-preview {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #1a1a1a;
        }

        .scanner-controls {
          background: linear-gradient(to top, #000 0%, rgba(0,0,0,0.8) 100%);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .capture-button {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: white;
          border: 6px solid #667eea;
          cursor: pointer;
          transition: all 0.2s;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
        }

        .capture-button:active {
          transform: scale(0.9);
        }

        .control-buttons {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .scanner-btn {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 0.75rem 1.25rem;
          border-radius: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .scanner-btn:hover {
          background: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }

        .scanner-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
        }

        .scanner-btn.success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: none;
        }

        .scanner-btn.danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: none;
        }

        .scanner-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .docs-gallery {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .doc-thumbnail {
          position: relative;
          width: 80px;
          height: 100px;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 2px solid rgba(255,255,255,0.2);
          flex-shrink: 0;
        }

        .doc-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .doc-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .processing-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .guide-frame {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 400px;
          aspect-ratio: 1.414; /* Format A4 */
          border: 3px dashed rgba(102, 126, 234, 0.8);
          border-radius: 1rem;
          pointer-events: none;
        }

        input[type="file"] {
          display: none;
        }
      `}</style>

      {/* Header */}
      <div className="scanner-header">
        <button
          className="scanner-btn"
          onClick={() => {
            stopCamera();
            if (onClose) onClose();
          }}
          style={{ padding: '0.5rem' }}
        >
          <ChevronLeftIcon /> Retour
        </button>
        <h1 className="scanner-title">
          📄 ClearScanner
        </h1>
        <div className="scanner-counter">
          {scannedDocs.length} doc{scannedDocs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Vue principale */}
      <div className="camera-view">
        {mode === 'capture' && !stream && (
          <div style={{ textAlign: 'center', color: 'white' }}>
            <CameraIcon style={{ width: '64px', height: '64px', margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              Prêt à scanner un document
            </p>
            <button
              className="scanner-btn primary"
              onClick={startCamera}
              style={{ fontSize: '1rem', padding: '1rem 2rem' }}
            >
              <CameraIcon /> Démarrer la caméra
            </button>
            <p style={{ margin: '1rem 0', opacity: 0.7 }}>ou</p>
            <button
              className="scanner-btn"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: '1rem', padding: '1rem 2rem' }}
            >
              <DownloadIcon /> Choisir une image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
            />
          </div>
        )}

        {mode === 'capture' && stream && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            <div className="guide-frame" />
          </>
        )}

        {mode === 'preview' && currentDoc && (
          <img
            src={currentDoc.url}
            alt="Document scanné"
            className="document-preview"
          />
        )}

        {mode === 'detection' && detectionResult && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img
              src={detectionResult.preview || detectionResult.original}
              alt="Document détecté"
              className="document-preview"
              style={{ objectFit: 'contain' }}
            />
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(16, 185, 129, 0.95)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '2rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircleIcon style={{ width: '20px', height: '20px' }} />
              Document détecté automatiquement
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="processing-overlay">
            ⚙️ Détection en cours...
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Contrôles */}
      <div className="scanner-controls">
        {/* Galerie des documents scannés */}
        {scannedDocs.length > 0 && mode !== 'preview' && mode !== 'detection' && (
          <div className="docs-gallery">
            {scannedDocs.map(doc => (
              <div key={doc.id} className="doc-thumbnail">
                <img src={doc.url} alt="Document" />
                <button
                  className="doc-remove"
                  onClick={() => removeDocument(doc.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Modes d'amélioration */}
        {mode === 'preview' && currentDoc && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '1rem',
            overflowX: 'auto',
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {[
              { value: 'original', label: '📄 Original', emoji: '📄' },
              { value: 'bw', label: '⬛ N&B', emoji: '⬛' },
              { value: 'gray', label: '⚪ Gris', emoji: '⚪' },
              { value: 'color', label: '🎨 Couleur+', emoji: '🎨' }
            ].map(modeOption => (
              <button
                key={modeOption.value}
                className={`scanner-btn ${enhanceMode === modeOption.value ? 'primary' : ''}`}
                onClick={() => applyEnhanceMode(modeOption.value)}
                disabled={isProcessing}
                style={{
                  flex: '1',
                  minWidth: '100px',
                  opacity: enhanceMode === modeOption.value ? 1 : 0.7
                }}
              >
                {modeOption.label}
              </button>
            ))}
          </div>
        )}

        {/* Boutons selon le mode */}
        <div className="control-buttons">
          {mode === 'capture' && stream && (
            <button
              className="capture-button"
              onClick={capturePhoto}
              disabled={isProcessing}
            >
              <CameraIcon style={{ width: '32px', height: '32px', color: '#667eea' }} />
            </button>
          )}

          {mode === 'detection' && detectionResult && (
            <>
              <button
                className="scanner-btn danger"
                onClick={rejectDetection}
                disabled={isProcessing}
                style={{ flex: 1 }}
              >
                <XCircleIcon /> Utiliser l'original
              </button>
              <button
                className="scanner-btn success"
                onClick={acceptDetection}
                disabled={isProcessing}
                style={{ flex: 1 }}
              >
                <CheckCircleIcon /> Accepter le recadrage
              </button>
            </>
          )}

          {mode === 'preview' && currentDoc && (
            <>
              <button
                className="scanner-btn"
                onClick={rotateImage}
                disabled={isProcessing}
              >
                <RotateCwIcon /> Rotation
              </button>
              <button
                className="scanner-btn danger"
                onClick={() => {
                  setCurrentDoc(null);
                  setMode('capture');
                  setEnhanceMode('original');
                  startCamera();
                }}
              >
                <XCircleIcon /> Annuler
              </button>
              <button
                className="scanner-btn success"
                onClick={confirmDocument}
              >
                <CheckCircleIcon /> Valider
              </button>
            </>
          )}

          {mode === 'capture' && !stream && scannedDocs.length > 0 && (
            <button
              className="scanner-btn success"
              onClick={saveAllDocuments}
              style={{ fontSize: '1rem', padding: '1rem 2rem', flex: 1 }}
            >
              <CheckCircleIcon /> Sauvegarder ({scannedDocs.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
