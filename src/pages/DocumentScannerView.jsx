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
  enhanceGrayscale,
  isOpenCvReady,
  applyPerspectiveTransform
} from '../utils/documentScanner';
import { preloadOpenCV } from '../utils/jscanifyDetector'; // AJOUT: Import preloadOpenCV
import { useDocumentDetection } from '../hooks/useDocumentDetection';
import { useCornerDrag } from '../hooks/useCornerDrag';
import logger from '../utils/logger';
import '../components/scanner/ScannerStyles.css';

export default function DocumentScannerView({ onSave, onClose }) {
  const [scannedDocs, setScannedDocs] = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [mode, setMode] = useState('capture');
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState('original');
  const [scanProgress, setScanProgress] = useState(0);
  const [corners, setCorners] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [stream, setStream] = useState(null);
  const [cvReady, setCvReady] = useState(false); // Nouvel état pour OpenCV

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Hooks personnalisés
  const {
    detectorType,
    yoloModelLoaded,
    liveCorners,
    detectionConfidence,
    setDetectorType,
    detectDocument,
    startLiveDetection,
    stopLiveDetection
  } = useDocumentDetection({ initialDetector: 'opencv' });

  const {
    draggedCorner,
    handleCornerMouseDown,
    handleCornerTouchStart,
    handleMouseMove,
    handleTouchMove,
    handleMouseUp
  } = useCornerDrag(previewCanvasRef, setCorners);

  // Appliquer le stream à la vidéo
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Erreur play:', err);
      });
    }
  }, [stream]);

  // Nettoyage mémoire pour originalImage
  useEffect(() => {
    return () => {
      if (originalImage && typeof originalImage === 'string' && originalImage.startsWith('blob:')) {
        URL.revokeObjectURL(originalImage);
      }
    };
  }, [originalImage]);

  // Charger et vérifier OpenCV
  useEffect(() => {
    logger.log('[OpenCV] Lancement du préchargement...');

    // Lancer le chargement d'OpenCV
    preloadOpenCV()
      .then(() => {
        logger.log('[OpenCV] Chargé avec succès !');
        setCvReady(true);
      })
      .catch((err) => {
        logger.error('[OpenCV] Erreur de chargement:', err);
      });

    // Vérification de backup au cas où
    const checkCv = setInterval(() => {
      if (isOpenCvReady()) {
        setCvReady(true);
        logger.log('[OpenCV] Détecté via polling');
        clearInterval(checkCv);
      }
    }, 1000);

    return () => clearInterval(checkCv);
  }, []);

  // Détection en temps réel
  useEffect(() => {
    // Ne rien faire si : pas en mode capture, pas de stream, ou OpenCV pas prêt
    if (mode !== 'capture' || !stream || !videoRef.current || !overlayCanvasRef.current || !cvReady) {
      stopLiveDetection();
      return;
    }

    const video = videoRef.current;

    const start = () => {
      if (video.readyState >= 2) {
        // S'assurer que le canvas overlay a la même taille que la vidéo
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
        }
        logger.log('[LIVE DETECTION] Démarrage détection (interval: 150ms)');
        startLiveDetection(videoRef, overlayCanvasRef, 150);
      }
    };

    video.addEventListener('loadeddata', start);
    // Cas où la vidéo est déjà chargée
    if (video.readyState >= 2) start();

    return () => {
      video.removeEventListener('loadeddata', start);
      stopLiveDetection();
    };
  }, [mode, stream, cvReady, startLiveDetection, stopLiveDetection]);

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

  // Capturer une photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    setMode('scanning');
    setScanProgress(0);
    stopCamera();

    // Animation de scan
    await new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        setScanProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });

    setIsProcessing(true);

    try {
      const imgUrl = canvas.toDataURL('image/jpeg', 0.92);
      setOriginalImage(imgUrl);

      // TOUJOURS relancer la détection sur l'image capturée
      // (plus précis car haute résolution + pas de mouvement)
      logger.log('[CAPTURE] Détection précise sur image HD...');

      if (!isOpenCvReady()) {
        logger.log('Waiting for OpenCV...');
        await new Promise(r => setTimeout(r, 500));
      }

      // Détection sur image plus grande (1000px) pour plus de précision
      const detectionWidth = 1000;
      const scaleFactor = canvas.width / detectionWidth;
      const detectionHeight = Math.round(canvas.height / scaleFactor);

      const detectionCanvas = document.createElement('canvas');
      detectionCanvas.width = detectionWidth;
      detectionCanvas.height = detectionHeight;
      detectionCanvas.getContext('2d').drawImage(canvas, 0, 0, detectionWidth, detectionHeight);

      const blob = await new Promise(r => detectionCanvas.toBlob(r, 'image/jpeg', 0.9));
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });

      const result = await detectDocument(file);

      let cornersData = null;
      if (result.detected && result.contour) {
        cornersData = result.contour.map(point => ({
          x: (point.x / detectionWidth) * 100,
          y: (point.y / detectionHeight) * 100
        }));
        logger.log('[CAPTURE] Coins détectés avec précision');
      }

      setCorners(cornersData || [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 }
      ]);

      setMode('adjust');

    } catch (error) {
      console.error('Erreur capture/détection:', error);
      setCorners([
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 }
      ]);
      setMode('adjust');
    } finally {
      setIsProcessing(false);
    }
  }, [stopCamera, detectDocument]);

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
        default:
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

    img.src = currentDoc.originalUrl || currentDoc.url;
  }, [currentDoc]);

  // Valider l'ajustement
  const validateAdjustment = useCallback(async () => {
    if (!corners || !originalImage) {
      console.error('Validation impossible: corners ou originalImage manquant');
      return;
    }

    setIsProcessing(true);
    logger.log('[VALIDATE] Début de la validation...');

    try {
      // 1. Charger l'image avec timeout
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10000);
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = (e) => {
          clearTimeout(timeout);
          reject(new Error('Image load error'));
        };
        img.src = originalImage;
      });

      logger.log('[VALIDATE] Image chargée:', img.width, 'x', img.height);

      // 2. Créer le canvas temporaire
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // 3. Convertir les coins en pixels absolus
      const absoluteCorners = corners.map(corner => ({
        x: (corner.x / 100) * img.width,
        y: (corner.y / 100) * img.height
      }));

      logger.log('[VALIDATE] Coins absolus:', absoluteCorners);

      // 4. Vérifier si OpenCV est prêt
      if (!isOpenCvReady()) {
        logger.log('[VALIDATE] OpenCV pas prêt, attente...');
        await new Promise(r => setTimeout(r, 1000));
        if (!isOpenCvReady()) {
          throw new Error('OpenCV non disponible');
        }
      }

      // 5. Appliquer la transformation
      const outputCanvas = applyPerspectiveTransform(tempCanvas, absoluteCorners);

      if (!outputCanvas || outputCanvas.width === 0 || outputCanvas.height === 0) {
        throw new Error('Canvas de sortie invalide');
      }

      logger.log('[VALIDATE] Transformation appliquée:', outputCanvas.width, 'x', outputCanvas.height);

      // 6. Convertir en blob avec timeout
      const transformedBlob = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('toBlob timeout')), 10000);
        try {
          outputCanvas.toBlob(
            (blob) => {
              clearTimeout(timeout);
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Blob création échouée'));
              }
            },
            'image/jpeg',
            0.95
          );
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });

      const url = URL.createObjectURL(transformedBlob);
      logger.log('[VALIDATE] Blob créé, URL:', url);

      // 7. Mettre à jour l'état
      setCurrentDoc({
        id: Date.now(),
        url,
        originalUrl: url,
        blob: transformedBlob,
        timestamp: new Date().toISOString(),
        enhanceMode: 'original',
        rotation: 0,
        wasDetected: true
      });
      setMode('preview');
      setCorners(null);
      setOriginalImage(null);

      logger.log('[VALIDATE] Validation terminée avec succès');

    } catch (error) {
      console.error('Erreur transformation:', error);
      logger.error('[VALIDATE] Erreur:', error.message);
      alert('Erreur: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [corners, originalImage]);

  // Annuler l'ajustement
  const cancelAdjustment = useCallback(() => {
    // Arrêter d'abord la détection pour éviter les conflits
    stopLiveDetection();

    // Nettoyer l'état avant de redémarrer
    setCorners(null);
    setOriginalImage(null);

    // Changer le mode en dernier pour éviter les re-renders intermédiaires
    setMode('capture');

    // Démarrer la caméra de manière asynchrone
    startCamera();
  }, [startCamera, stopLiveDetection]);

  // Rotation de l'image
  const rotateImage = useCallback(() => {
    if (!currentDoc || !canvasRef.current) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const newRotation = (currentDoc.rotation + 90) % 360;

      if (newRotation === 90 || newRotation === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
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

  // Rendu des différentes vues
  const renderCaptureStartView = () => (
    <div className="start-view">
      <CameraIcon style={{ width: '64px', height: '64px', margin: '0 auto 1rem' }} />
      <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
        Prêt à scanner un document
      </p>

      <div className="detector-selector">
        <button
          className={`scanner-btn ${detectorType === 'opencv' ? 'primary' : ''}`}
          onClick={() => setDetectorType('opencv')}
          style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem 1rem', opacity: detectorType === 'opencv' ? 1 : 0.5 }}
        >
          OpenCV (Rapide)
        </button>
        <button
          className={`scanner-btn ${detectorType === 'yolo' ? 'primary' : ''}`}
          onClick={() => setDetectorType('yolo')}
          style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem 1rem', opacity: detectorType === 'yolo' ? 1 : 0.5 }}
        >
          YOLO (IA) {yoloModelLoaded && '✓'}
        </button>
      </div>

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
        className="scanner-file-input"
      />
    </div>
  );

  const renderCameraLiveView = () => (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
      <canvas ref={overlayCanvasRef} className="camera-overlay-canvas" />
      {!liveCorners && <div className="guide-frame" />}

      <div className={`detector-badge ${detectorType === 'yolo' && yoloModelLoaded ? 'yolo' : 'opencv'}`}>
        {detectorType === 'yolo' && yoloModelLoaded ? '🤖 YOLO' : '📐 OpenCV'}
      </div>

      {liveCorners && detectionConfidence > 0 && (
        <div className="detection-indicator">
          <CheckCircleIcon style={{ width: '20px', height: '20px' }} />
          Document détecté !
        </div>
      )}
    </>
  );

  const renderScanningView = () => (
    <div className="scanning-view">
      <canvas ref={canvasRef} className="scanning-canvas" />
      <div className="scan-line" style={{ top: `${scanProgress}%` }} />
      <div className="scanning-text">📄 Scan en cours...</div>
    </div>
  );

  const renderAdjustView = () => (
    <div
      className="adjust-container"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      <img
        ref={previewCanvasRef}
        src={originalImage}
        alt="Document à ajuster"
        className="adjust-image"
      />
      <svg className="adjust-overlay" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <mask id="docMask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <polygon points={corners.map(c => `${c.x},${c.y}`).join(' ')} fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.6)" mask="url(#docMask)" />
        <polygon
          points={corners.map(c => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke="#10b981"
          strokeWidth="0.5"
          strokeLinejoin="round"
          filter="drop-shadow(0 0 2px #10b981)"
        />
        {corners.map((corner, i) => {
          const nextCorner = corners[(i + 1) % corners.length];
          return (
            <line
              key={i}
              x1={corner.x}
              y1={corner.y}
              x2={nextCorner.x}
              y2={nextCorner.y}
              stroke="#10b981"
              strokeWidth="0.3"
            />
          );
        })}
      </svg>

      {corners.map((corner, index) => (
        <div
          key={index}
          className="corner-handle"
          style={{ left: `${corner.x}%`, top: `${corner.y}%` }}
          onMouseDown={(e) => handleCornerMouseDown(index, e)}
          onTouchStart={(e) => handleCornerTouchStart(index, e)}
        />
      ))}

      {/* Loupe - affichée uniquement lors du drag */}
      {draggedCorner !== null && corners && originalImage && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          border: '4px solid #fff',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 100,
          backgroundColor: '#000',
          pointerEvents: 'none'
        }}>
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}>
            <img
              src={originalImage}
              alt=""
              style={{
                position: 'absolute',
                width: '300%',
                height: '300%',
                left: `calc(50% - ${corners[draggedCorner].x * 3}%)`,
                top: `calc(50% - ${corners[draggedCorner].y * 3}%)`,
                objectFit: 'cover',
                pointerEvents: 'none'
              }}
            />
            {/* Croix centrale */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '20px',
              border: '2px solid #10b981',
              borderRadius: '50%',
              boxShadow: '0 0 5px #10b981'
            }} />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '12px',
              backgroundColor: '#10b981'
            }} />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '2px',
              backgroundColor: '#10b981'
            }} />
          </div>
        </div>
      )}

      <div className="adjust-hint">✋ Déplacez les coins pour ajuster la zone</div>
    </div>
  );

  const renderPreviewView = () => (
    <img src={currentDoc.url} alt="Document scanné" className="document-preview" />
  );

  const renderDocumentGallery = () => (
    <div className="docs-gallery">
      {scannedDocs.map(doc => (
        <div key={doc.id} className="doc-thumbnail">
          <img src={doc.url} alt="Document" />
          <button className="doc-remove" onClick={() => removeDocument(doc.id)}>×</button>
        </div>
      ))}
    </div>
  );

  const renderEnhanceModeBar = () => (
    <div className="enhance-mode-bar">
      {[
        { value: 'original', label: '📄 Original' },
        { value: 'bw', label: '⬛ N&B' },
        { value: 'gray', label: '⚪ Gris' },
        { value: 'color', label: '🎨 Couleur+' }
      ].map(modeOption => (
        <button
          key={modeOption.value}
          className={`scanner-btn ${enhanceMode === modeOption.value ? 'primary' : ''}`}
          onClick={() => applyEnhanceMode(modeOption.value)}
          disabled={isProcessing}
          style={{ flex: '1', minWidth: '100px', opacity: enhanceMode === modeOption.value ? 1 : 0.7 }}
        >
          {modeOption.label}
        </button>
      ))}
    </div>
  );

  const renderControlButtons = () => (
    <div className="control-buttons">
      {mode === 'capture' && stream && (
        <button className="capture-button" onClick={capturePhoto} disabled={isProcessing}>
          <CameraIcon style={{ width: '32px', height: '32px', color: '#667eea' }} />
        </button>
      )}

      {mode === 'adjust' && corners && (
        <>
          <button className="scanner-btn danger" onClick={cancelAdjustment} disabled={isProcessing} style={{ flex: 1 }}>
            <XCircleIcon /> Annuler
          </button>
          <button className="scanner-btn success" onClick={validateAdjustment} disabled={isProcessing} style={{ flex: 1 }}>
            <CheckCircleIcon /> Valider & Recadrer
          </button>
        </>
      )}

      {mode === 'preview' && currentDoc && (
        <>
          <button className="scanner-btn" onClick={rotateImage} disabled={isProcessing}>
            <RotateCwIcon /> Rotation
          </button>
          <button
            className="scanner-btn danger"
            onClick={() => {
              stopLiveDetection();
              setCurrentDoc(null);
              setEnhanceMode('original');
              setMode('capture');
              startCamera();
            }}
          >
            <XCircleIcon /> Annuler
          </button>
          <button className="scanner-btn success" onClick={confirmDocument}>
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
  );

  return (
    <div className="scanner-container">
      {/* Header */}
      <div className="scanner-header">
        <button
          className="scanner-btn"
          onClick={() => { stopCamera(); if (onClose) onClose(); }}
          style={{ padding: '0.5rem' }}
        >
          <ChevronLeftIcon /> Retour
        </button>
        <h1 className="scanner-title">📄 ClearScanner</h1>
        <div className="scanner-counter">
          {scannedDocs.length} doc{scannedDocs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Vue principale */}
      <div className="camera-view">
        {mode === 'capture' && !stream && renderCaptureStartView()}
        {mode === 'capture' && stream && renderCameraLiveView()}
        {mode === 'scanning' && renderScanningView()}
        {mode === 'adjust' && originalImage && corners && renderAdjustView()}
        {mode === 'preview' && currentDoc && renderPreviewView()}
        {isProcessing && <div className="processing-overlay">⚙️ Détection en cours...</div>}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Contrôles */}
      <div className="scanner-controls">
        {scannedDocs.length > 0 && mode !== 'preview' && mode !== 'adjust' && mode !== 'scanning' && renderDocumentGallery()}
        {mode === 'preview' && currentDoc && renderEnhanceModeBar()}
        {renderControlButtons()}
      </div>
    </div>
  );
}
