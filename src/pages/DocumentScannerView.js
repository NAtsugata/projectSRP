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
import { getYOLODetector } from '../utils/yoloDetector';

export default function DocumentScannerView({ onSave, onClose }) {
  const [scannedDocs, setScannedDocs] = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [mode, setMode] = useState('capture'); // 'capture', 'scanning', 'adjust', 'preview'
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState('original'); // 'original', 'bw', 'gray', 'color'
  const [scanProgress, setScanProgress] = useState(0); // Animation de scan 0-100
  const [corners, setCorners] = useState(null); // Coins ajustables [topLeft, topRight, bottomRight, bottomLeft]
  const [draggedCorner, setDraggedCorner] = useState(null); // Index du coin en cours de drag
  const [originalImage, setOriginalImage] = useState(null); // Image originale pour l'ajustement
  const [liveCorners, setLiveCorners] = useState(null); // Coins détectés en temps réel sur la caméra
  const [detectionConfidence, setDetectionConfidence] = useState(0); // Niveau de confiance 0-100
  const [detectorType, setDetectorType] = useState('opencv'); // 'opencv' ou 'yolo'
  const [yoloModelLoaded, setYoloModelLoaded] = useState(false);
  const [yoloModelPath] = useState('/models/document_detector.onnx'); // Chemin vers le modèle YOLO
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null); // Canvas pour l'overlay en temps réel
  const fileInputRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const detectionHistoryRef = useRef([]); // Historique des dernières détections pour lissage
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

  // Charger le modèle YOLO au démarrage (si mode YOLO sélectionné)
  useEffect(() => {
    const loadYOLOModel = async () => {
      if (detectorType === 'yolo' && !yoloModelLoaded) {
        try {
          console.log('🚀 Chargement du modèle YOLO...');
          const detector = getYOLODetector();
          await detector.loadModel(yoloModelPath);
          setYoloModelLoaded(true);
          console.log('✅ Modèle YOLO chargé avec succès !');
        } catch (error) {
          console.error('❌ Erreur chargement modèle YOLO:', error);
          console.warn('⚠️ Retour au mode OpenCV');
          setDetectorType('opencv'); // Fallback vers OpenCV
        }
      }
    };

    loadYOLOModel();
  }, [detectorType, yoloModelLoaded, yoloModelPath]);

  // Fonction helper pour détecter avec le bon détecteur
  const detectDocumentWithCurrentDetector = useCallback(async (file, options = {}) => {
    if (detectorType === 'yolo' && yoloModelLoaded) {
      // Détecter avec YOLO
      const detector = getYOLODetector();
      const result = await detector.detectDocument(file, {
        confidenceThreshold: 0.5,
        ...options
      });

      // Convertir le format YOLO au format attendu (avec contour)
      if (result.detected && result.detections.length > 0) {
        // Prendre la détection avec la plus haute confiance
        const bestDetection = result.detections.reduce((best, det) =>
          det.confidence > best.confidence ? det : best
        );

        // Convertir bbox en coins (format compatible avec le scanner)
        const corners = detector.bboxToCorners(
          bestDetection.bbox,
          result.originalSize.width,
          result.originalSize.height
        );

        return {
          detected: true,
          contour: corners,
          confidence: bestDetection.confidence,
          method: 'yolo'
        };
      }

      return {
        detected: false,
        contour: null,
        method: 'yolo'
      };
    } else {
      // Détecter avec OpenCV
      return await documentDetectorUtils.detectDocument(file, {
        minArea: 0.08,
        autoTransform: false,
        drawContours: false,
        ...options
      });
    }
  }, [detectorType, yoloModelLoaded]);

  // Détection en temps réel sur le flux vidéo avec lissage
  useEffect(() => {
    console.log('[LIVE DETECTION] useEffect triggered', { mode, hasStream: !!stream, hasVideo: !!videoRef.current, hasOverlay: !!overlayCanvasRef.current });

    if (mode !== 'capture' || !stream || !videoRef.current || !overlayCanvasRef.current) {
      // Nettoyer l'interval si on n'est plus en mode capture
      if (detectionIntervalRef.current) {
        console.log('[LIVE DETECTION] Clearing interval');
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      detectionHistoryRef.current = []; // Reset l'historique
      setLiveCorners(null);
      setDetectionConfidence(0);
      return;
    }

    console.log('[LIVE DETECTION] Starting real-time detection loop');

    const detectLive = async () => {
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      if (!video || !overlayCanvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      try {
        // Capturer une frame du flux vidéo
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Convertir en blob
        const blob = await new Promise(resolve => {
          tempCanvas.toBlob(resolve, 'image/jpeg', 0.8);
        });

        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });

        // Détecter avec le détecteur sélectionné (OpenCV ou YOLO)
        const result = await detectDocumentWithCurrentDetector(file);

        // Ajouter à l'historique
        detectionHistoryRef.current.push({
          detected: result.detected,
          contour: result.contour,
          timestamp: Date.now()
        });

        // Garder seulement les 4 dernières détections
        if (detectionHistoryRef.current.length > 4) {
          detectionHistoryRef.current.shift();
        }

        // Calculer le taux de succès sur les 4 dernières détections
        const recentDetections = detectionHistoryRef.current;
        const successCount = recentDetections.filter(d => d.detected && d.contour?.length === 4).length;
        const successRate = successCount / recentDetections.length;

        console.log('[LIVE DETECTION] Success rate:', successRate, `(${successCount}/${recentDetections.length})`);

        // Afficher seulement si au moins 75% de succès (3/4)
        if (successRate >= 0.75 && result.detected && result.contour && result.contour.length === 4) {
          // Moyenner les coins des détections récentes qui ont réussi
          const successfulDetections = recentDetections.filter(d => d.detected && d.contour?.length === 4);
          const smoothedCorners = [];

          for (let i = 0; i < 4; i++) {
            let sumX = 0, sumY = 0;
            successfulDetections.forEach(detection => {
              sumX += detection.contour[i].x;
              sumY += detection.contour[i].y;
            });
            smoothedCorners.push({
              x: sumX / successfulDetections.length,
              y: sumY / successfulDetections.length
            });
          }

          console.log('[LIVE DETECTION] Document detected (stable)! Drawing overlay...');
          setLiveCorners(smoothedCorners);
          setDetectionConfidence(100);

          // Dessiner l'overlay sur le canvas
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
          const overlayCtx = overlayCanvas.getContext('2d');
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

          // Dessiner le polygone vert autour du document
          overlayCtx.strokeStyle = '#10b981';
          overlayCtx.lineWidth = 5;
          overlayCtx.shadowColor = '#10b981';
          overlayCtx.shadowBlur = 20;
          overlayCtx.beginPath();
          overlayCtx.moveTo(smoothedCorners[0].x, smoothedCorners[0].y);
          for (let i = 1; i < smoothedCorners.length; i++) {
            overlayCtx.lineTo(smoothedCorners[i].x, smoothedCorners[i].y);
          }
          overlayCtx.closePath();
          overlayCtx.stroke();

          // Dessiner les coins avec des cercles plus gros
          smoothedCorners.forEach(corner => {
            overlayCtx.fillStyle = '#10b981';
            overlayCtx.shadowColor = '#10b981';
            overlayCtx.shadowBlur = 15;
            overlayCtx.beginPath();
            overlayCtx.arc(corner.x, corner.y, 12, 0, Math.PI * 2);
            overlayCtx.fill();

            // Bordure blanche
            overlayCtx.strokeStyle = '#ffffff';
            overlayCtx.lineWidth = 3;
            overlayCtx.stroke();
          });

          console.log('[LIVE DETECTION] Overlay drawn successfully');
        } else {
          // Pas assez stable ou pas de document détecté
          console.log('[LIVE DETECTION] No stable document detected');
          setLiveCorners(null);
          setDetectionConfidence(Math.round(successRate * 100));
          // Effacer l'overlay
          const overlayCtx = overlayCanvas.getContext('2d');
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
      } catch (error) {
        console.error('[LIVE DETECTION] Error:', error);
        // Ajouter une détection échouée à l'historique
        detectionHistoryRef.current.push({
          detected: false,
          contour: null,
          timestamp: Date.now()
        });
        if (detectionHistoryRef.current.length > 4) {
          detectionHistoryRef.current.shift();
        }
      }
    };

    // Lancer la détection toutes les 600ms (plus stable)
    console.log('[LIVE DETECTION] Setting interval (600ms)');
    detectionIntervalRef.current = setInterval(detectLive, 600);

    return () => {
      if (detectionIntervalRef.current) {
        console.log('[LIVE DETECTION] Cleanup - clearing interval');
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      detectionHistoryRef.current = [];
    };
  }, [mode, stream, detectDocumentWithCurrentDetector]);

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

  // Capturer une photo avec animation de scan et détection OpenCV
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Démarrer l'animation de scan
    setMode('scanning');
    setScanProgress(0);
    stopCamera();

    // Animer le scan de haut en bas
    const animateScan = () => {
      return new Promise((resolve) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          setScanProgress(progress);
          if (progress >= 100) {
            clearInterval(interval);
            resolve();
          }
        }, 30); // Animation de ~600ms
      });
    };

    await animateScan();
    setIsProcessing(true);

    try {
      // Créer un fichier temporaire pour OpenCV
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const imgUrl = URL.createObjectURL(blob);

      // Charger l'image pour avoir ses dimensions réelles
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = imgUrl;
      });

      setOriginalImage(imgUrl);

      // Lancer la détection avec le détecteur sélectionné
      const result = await detectDocumentWithCurrentDetector(file);

      if (result.detected && result.contour) {
        // Convertir les coins en pourcentages pour être responsive
        const cornersData = result.contour.map(point => ({
          x: (point.x / img.width) * 100,
          y: (point.y / img.height) * 100
        }));
        setCorners(cornersData);
        setMode('adjust');
      } else {
        // Pas de document détecté, utiliser les coins par défaut
        const defaultCorners = [
          { x: 10, y: 10 },
          { x: 90, y: 10 },
          { x: 90, y: 90 },
          { x: 10, y: 90 }
        ];
        setCorners(defaultCorners);
        setMode('adjust');
      }
    } catch (error) {
      console.error('Erreur détection OpenCV:', error);
      // En cas d'erreur, utiliser les coins par défaut
      const defaultCorners = [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 }
      ];
      setCorners(defaultCorners);
      setMode('adjust');
    } finally {
      setIsProcessing(false);
    }
  }, [stopCamera, detectDocumentWithCurrentDetector]);

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

  // Gérer le drag des coins
  const handleCornerMouseDown = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedCorner(index);
  }, []);

  const handleCornerTouchStart = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedCorner(index);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (draggedCorner === null || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggedCorner] = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
      return newCorners;
    });
  }, [draggedCorner]);

  const handleTouchMove = useCallback((e) => {
    if (draggedCorner === null || !previewCanvasRef.current) return;
    e.preventDefault();

    const canvas = previewCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggedCorner] = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
      return newCorners;
    });
  }, [draggedCorner]);

  const handleMouseUp = useCallback(() => {
    setDraggedCorner(null);
  }, []);

  // Valider l'ajustement et appliquer la transformation perspective
  const validateAdjustment = useCallback(async () => {
    if (!corners || !originalImage || !canvasRef.current) return;

    setIsProcessing(true);

    try {
      // Charger l'image originale
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = originalImage;
      });

      // Convertir les coins en pixels absolus
      const absoluteCorners = corners.map(corner => ({
        x: (corner.x / 100) * img.width,
        y: (corner.y / 100) * img.height
      }));

      // Créer un fichier depuis l'image originale
      const response = await fetch(originalImage);
      const blob = await response.blob();
      const file = new File([blob], 'adjusted.jpg', { type: 'image/jpeg' });

      // Appliquer la transformation perspective avec les coins ajustés
      const result = await detectDocumentWithCurrentDetector(file, {
        manualCorners: absoluteCorners,
        autoTransform: true
      });

      if (result.transformed) {
        // Utiliser l'image transformée
        const transformedBlob = await fetch(result.transformed).then(r => r.blob());
        const url = URL.createObjectURL(transformedBlob);
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
      }
    } catch (error) {
      console.error('Erreur transformation:', error);
      alert('Erreur lors de la transformation du document');
    } finally {
      setIsProcessing(false);
    }
  }, [corners, originalImage, detectDocumentWithCurrentDetector]);

  // Annuler l'ajustement
  const cancelAdjustment = useCallback(() => {
    setMode('capture');
    setCorners(null);
    setOriginalImage(null);
    startCamera();
  }, [startCamera]);

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

        .camera-overlay-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          object-fit: cover;
        }

        .detection-indicator {
          position: absolute;
          top: 1rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(16, 185, 129, 0.95);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.8;
            transform: translateX(-50%) scale(1.05);
          }
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

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(to right, transparent, #10b981, transparent);
          box-shadow: 0 0 20px #10b981, 0 0 40px #10b981;
          animation: scanGlow 0.5s ease-in-out infinite alternate;
        }

        @keyframes scanGlow {
          from {
            box-shadow: 0 0 20px #10b981, 0 0 40px #10b981;
          }
          to {
            box-shadow: 0 0 30px #10b981, 0 0 60px #10b981;
          }
        }

        .adjust-container {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: none;
        }

        .adjust-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          user-select: none;
        }

        .adjust-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .corner-handle {
          position: absolute;
          width: 50px;
          height: 50px;
          margin-left: -25px;
          margin-top: -25px;
          cursor: move;
          pointer-events: all;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .corner-handle::before {
          content: '';
          width: 24px;
          height: 24px;
          background: #10b981;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 20px rgba(16, 185, 129, 0.5);
        }

        .corner-handle:active::before {
          transform: scale(1.3);
        }

        .adjust-hint {
          position: absolute;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 2rem;
          font-size: 0.875rem;
          font-weight: 600;
          z-index: 5;
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
            <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Prêt à scanner un document
            </p>

            {/* Sélecteur de détecteur */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              padding: '0.5rem',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              maxWidth: '400px',
              margin: '0 auto 1.5rem'
            }}>
              <button
                className={`scanner-btn ${detectorType === 'opencv' ? 'primary' : ''}`}
                onClick={() => setDetectorType('opencv')}
                style={{
                  flex: 1,
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem',
                  opacity: detectorType === 'opencv' ? 1 : 0.5
                }}
              >
                OpenCV (Rapide)
              </button>
              <button
                className={`scanner-btn ${detectorType === 'yolo' ? 'primary' : ''}`}
                onClick={() => setDetectorType('yolo')}
                style={{
                  flex: 1,
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem',
                  opacity: detectorType === 'yolo' ? 1 : 0.5
                }}
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
            <canvas
              ref={overlayCanvasRef}
              className="camera-overlay-canvas"
            />
            {!liveCorners && <div className="guide-frame" />}

            {/* Indicateur du détecteur actif */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: detectorType === 'yolo' && yoloModelLoaded ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              {detectorType === 'yolo' && yoloModelLoaded ? '🤖 YOLO' : '📐 OpenCV'}
            </div>

            {liveCorners && detectionConfidence > 0 && (
              <div className="detection-indicator">
                <CheckCircleIcon style={{ width: '20px', height: '20px' }} />
                Document détecté !
              </div>
            )}
          </>
        )}

        {mode === 'scanning' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
            <div
              className="scan-line"
              style={{ top: `${scanProgress}%` }}
            />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#10b981',
              fontSize: '1.25rem',
              fontWeight: '700',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              📄 Scan en cours...
            </div>
          </div>
        )}

        {mode === 'adjust' && originalImage && corners && (
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
            <svg
              className="adjust-overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              {/* Overlay sombre sur tout sauf la zone du document */}
              <defs>
                <mask id="docMask">
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <polygon
                    points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                fill="rgba(0,0,0,0.6)"
                mask="url(#docMask)"
              />

              {/* Bordures du document détecté */}
              <polygon
                points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="0.5"
                strokeLinejoin="round"
                filter="drop-shadow(0 0 2px #10b981)"
              />

              {/* Lignes de connexion */}
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

            {/* Poignées pour déplacer les coins */}
            {corners.map((corner, index) => (
              <div
                key={index}
                className="corner-handle"
                style={{
                  left: `${corner.x}%`,
                  top: `${corner.y}%`
                }}
                onMouseDown={(e) => handleCornerMouseDown(index, e)}
                onTouchStart={(e) => handleCornerTouchStart(index, e)}
              />
            ))}

            <div className="adjust-hint">
              ✋ Déplacez les coins pour ajuster la zone
            </div>
          </div>
        )}

        {mode === 'preview' && currentDoc && (
          <img
            src={currentDoc.url}
            alt="Document scanné"
            className="document-preview"
          />
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
        {scannedDocs.length > 0 && mode !== 'preview' && mode !== 'adjust' && mode !== 'scanning' && (
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

          {mode === 'adjust' && corners && (
            <>
              <button
                className="scanner-btn danger"
                onClick={cancelAdjustment}
                disabled={isProcessing}
                style={{ flex: 1 }}
              >
                <XCircleIcon /> Annuler
              </button>
              <button
                className="scanner-btn success"
                onClick={validateAdjustment}
                disabled={isProcessing}
                style={{ flex: 1 }}
              >
                <CheckCircleIcon /> Valider & Recadrer
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
