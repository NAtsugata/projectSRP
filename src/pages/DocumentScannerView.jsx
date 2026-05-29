// src/pages/DocumentScannerView.jsx
// Scanner de documents - Design moderne blanc/noir/cuivre
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  RotateCwIcon,
  DownloadIcon
} from '../components/SharedUI';
import { createAndDownloadPdf, downloadImagesAsZip } from '../utils/pdfGenerator';
import {
  enhanceBlackAndWhite,
  enhanceColor,
  enhanceGrayscale,
  enhanceClearScan,
  enhanceMagicColor,
  isOpenCvReady,
  applyPerspectiveTransform
} from '../utils/documentScanner';
import { preloadOpenCV } from '../utils/jscanifyDetector';
import { useDocumentDetection } from '../hooks/useDocumentDetection';
import { useCornerDrag } from '../hooks/useCornerDrag';
import { useOCR } from '../hooks/useOCR';
import logger from '../utils/logger';
import '../components/scanner/ScannerStyles.css';

// Filtres disponibles
const FILTERS = [
  { id: 'clearscan', label: 'ClearScan', icon: '📋', desc: 'Texte net, fond blanc (adaptatif)' },
  { id: 'original', label: 'Original', icon: '🖼️', desc: 'Sans modification' },
  { id: 'magic', label: 'Magic Color', icon: '✨', desc: 'Couleurs + suppression ombres' },
  { id: 'gray', label: 'Gris', icon: '⬜', desc: 'Niveaux de gris' },
  { id: 'bw', label: 'N&B pur', icon: '📄', desc: 'Noir & Blanc global' },
];

export default function DocumentScannerView({ onSave, onClose }) {
  const [scannedDocs, setScannedDocs] = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [mode, setMode] = useState('capture'); // capture, scanning, adjust, preview, export
  const [isProcessing, setIsProcessing] = useState(false);
  const [enhanceMode, setEnhanceMode] = useState('original'); // Couleur originale par défaut
  const [scanProgress, setScanProgress] = useState(0);
  const [corners, setCorners] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [stream, setStream] = useState(null);
  const [cvReady, setCvReady] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [autoCapturing, setAutoCapturing] = useState(false); // compteur de capture auto
  const [autoProgress, setAutoProgress] = useState(0);      // 0–100 pour l'animation
  const [stageDims, setStageDims] = useState(null);          // taille px réelle de l'image en mode ajustement
  const [videoDims, setVideoDims] = useState(null);          // rect px du contenu vidéo dans le conteneur (object-fit: contain)

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const adjustContainerRef = useRef(null);
  const streamRef = useRef(null);
  const isStartingCameraRef = useRef(false);
  const capturePhotoRef = useRef(null);
  const stableFrameCountRef = useRef(0); // compte les sondages YOLO stables consécutifs

  const { runOCR, isProcessingOCR, ocrProgress, terminateWorker } = useOCR();

  // Hooks personnalisés
  const {
    liveCorners,
    detectionConfidence,
    detectDocument,
    startLiveDetection,
    stopLiveDetection,
    yoloModelLoaded,
    yoloModelLoading,
    yoloIsSegmentation
  } = useDocumentDetection({ initialDetector: 'yolo' });

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
    if (!stream || mode !== 'capture') return;

    const attachStream = () => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          logger.error('Erreur play:', err);
        });
      }
    };

    // Essayer immédiatement
    attachStream();

    // Réessayer après un court délai si le ref n'était pas prêt
    const timeout = setTimeout(attachStream, 100);

    return () => {
      clearTimeout(timeout);
      // Détacher le stream du video element au cleanup
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, mode]);

  // Nettoyage mémoire pour originalImage
  useEffect(() => {
    return () => {
      if (originalImage && typeof originalImage === 'string' && originalImage.startsWith('blob:')) {
        URL.revokeObjectURL(originalImage);
      }
    };
  }, [originalImage]);

  // Cleanup du stream et du worker OCR au démontage du composant
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      terminateWorker();
    };
  }, [terminateWorker]);

  // Charger OpenCV
  useEffect(() => {
    preloadOpenCV()
      .then(() => {
        logger.log('[OpenCV] Chargé avec succès');
        setCvReady(true);
      })
      .catch((err) => {
        logger.error('[OpenCV] Erreur:', err);
      });

    const checkCv = setInterval(() => {
      if (isOpenCvReady()) {
        setCvReady(true);
        clearInterval(checkCv);
      }
    }, 1000);

    return () => clearInterval(checkCv);
  }, []);

  // Détection en temps réel
  useEffect(() => {
    if (mode !== 'capture' || !stream || !videoRef.current || !overlayCanvasRef.current || !cvReady) {
      stopLiveDetection();
      return;
    }

    const video = videoRef.current;

    const start = () => {
      if (video.readyState >= 2) {
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
        }
        startLiveDetection(videoRef, overlayCanvasRef, 150);
      }
    };

    video.addEventListener('loadeddata', start);
    if (video.readyState >= 2) start();

    return () => {
      video.removeEventListener('loadeddata', start);
      stopLiveDetection();
    };
  }, [mode, stream, cvReady, startLiveDetection, stopLiveDetection]);

  // Refs tenant les dernières valeurs de détection (mises à jour à chaque render).
  // Indispensable : YOLO change liveCorners à chaque cycle et la confidence reste
  // figée à 90 tant que c'est stable — un useEffect sur ces valeurs ne suffit pas.
  const detectionConfidenceRef = useRef(0);
  const liveCornersRef = useRef(null);
  detectionConfidenceRef.current = detectionConfidence;
  liveCornersRef.current = liveCorners;

  // Auto-capture : un unique timer de polling sonde la stabilité toutes les 200ms.
  // Après STABLE_TARGET sondages stables consécutifs (~2s) → capture automatique.
  useEffect(() => {
    if (mode !== 'capture') {
      stableFrameCountRef.current = 0;
      setAutoCapturing(false);
      setAutoProgress(0);
      return;
    }

    const POLL_MS = 200;
    const STABLE_TARGET = 10; // 10 × 200ms = 2s de stabilité

    const poll = setInterval(() => {
      const isStable =
        detectionConfidenceRef.current >= 90 && liveCornersRef.current !== null;

      if (!isStable) {
        // Document bougé / perdu → on repart de zéro
        if (stableFrameCountRef.current !== 0) {
          stableFrameCountRef.current = 0;
          setAutoCapturing(false);
          setAutoProgress(0);
        }
        return;
      }

      stableFrameCountRef.current += 1;
      const count = stableFrameCountRef.current;

      if (count === 1) setAutoCapturing(true);
      setAutoProgress(Math.min(100, (count / STABLE_TARGET) * 100));

      if (count >= STABLE_TARGET) {
        clearInterval(poll);
        stableFrameCountRef.current = 0;
        setAutoCapturing(false);
        setAutoProgress(0);
        logger.log('[Auto-capture] Document stable 2s — déclenchement');
        if (capturePhotoRef.current) capturePhotoRef.current();
      }
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      stableFrameCountRef.current = 0;
      setAutoCapturing(false);
      setAutoProgress(0);
    };
  }, [mode]);

  // Calcule le rect px du contenu vidéo dans la camera-view (object-fit: contain).
  // Permet de superposer l'overlay canvas exactement sur la zone vidéo visible.
  const recomputeVideoDims = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth || !vid.videoHeight) return;
    const cont = vid.parentElement;
    if (!cont) return;
    const cw = cont.clientWidth;
    const ch = cont.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / vid.videoWidth, ch / vid.videoHeight);
    const w = Math.round(vid.videoWidth * scale);
    const h = Math.round(vid.videoHeight * scale);
    setVideoDims({ w, h, left: Math.round((cw - w) / 2), top: Math.round((ch - h) / 2) });
  }, []);

  // Calcule la position et la taille exactes de l'image dans le conteneur.
  // Overlay et poignées utilisent ce rect → même repère que le drag (image, pas conteneur).
  const recomputeStage = useCallback(() => {
    const cont = adjustContainerRef.current;
    const imgEl = previewCanvasRef.current;
    if (!cont || !imgEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return;
    const cw = cont.clientWidth;
    const ch = cont.clientHeight;
    if (cw === 0 || ch === 0) return;
    const scale = Math.min(cw / imgEl.naturalWidth, ch / imgEl.naturalHeight);
    const w = Math.round(imgEl.naturalWidth * scale);
    const h = Math.round(imgEl.naturalHeight * scale);
    setStageDims({
      w,
      h,
      left: Math.round((cw - w) / 2),
      top:  Math.round((ch - h) / 2),
    });
  }, []);

  // Maintenir videoDims synchronisé avec la zone vidéo rendue (object-fit: contain)
  useEffect(() => {
    if (mode !== 'capture' || !stream) {
      setVideoDims(null);
      return;
    }
    const vid = videoRef.current;
    if (!vid) return;

    vid.addEventListener('loadedmetadata', recomputeVideoDims);
    vid.addEventListener('resize', recomputeVideoDims);
    if (vid.videoWidth) recomputeVideoDims();

    const cont = vid.parentElement;
    if (!cont) return () => {
      vid.removeEventListener('loadedmetadata', recomputeVideoDims);
      vid.removeEventListener('resize', recomputeVideoDims);
    };
    const ro = new ResizeObserver(recomputeVideoDims);
    ro.observe(cont);
    return () => {
      vid.removeEventListener('loadedmetadata', recomputeVideoDims);
      vid.removeEventListener('resize', recomputeVideoDims);
      ro.disconnect();
    };
  }, [mode, stream, recomputeVideoDims]);

  // Recalculer la taille du stage en mode ajustement (au montage + au resize)
  useEffect(() => {
    if (mode !== 'adjust') {
      setStageDims(null);
      return;
    }
    const cont = adjustContainerRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(() => recomputeStage());
    ro.observe(cont);
    recomputeStage();
    return () => ro.disconnect();
  }, [mode, originalImage, recomputeStage]);

  // Démarrer la caméra avec protection contre les appels multiples
  const startCamera = useCallback(async () => {
    // Éviter les appels multiples simultanés
    if (isStartingCameraRef.current) {
      logger.log('[Camera] Démarrage déjà en cours, ignoré');
      return;
    }
    isStartingCameraRef.current = true;

    try {
      // Arrêter l'ancien stream s'il existe
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      // Vérifier qu'on n'a pas été annulé pendant l'attente
      streamRef.current = mediaStream;
      setStream(mediaStream);
      logger.log('[Camera] Stream démarré');
    } catch (error) {
      logger.error('Erreur caméra:', error);
      alert("Impossible d'accéder à la caméra");
    } finally {
      isStartingCameraRef.current = false;
    }
  }, []);

  // Arrêter la caméra (utilise ref pour éviter dépendances)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  // Capturer une photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Snapshot coins AVANT tout arrêt de la caméra (ils disparaissent après stopCamera)
    const snapshotCorners = detectionConfidenceRef.current >= 90 ? liveCornersRef.current : null;

    // ImageCapture API : photo à la résolution native du capteur, pas une frame vidéo
    // compressée H.264. Doit être appelé AVANT stopCamera() (track encore active).
    let capturedViaImageCapture = false;
    if (streamRef.current && typeof window.ImageCapture !== 'undefined') {
      try {
        const track = streamRef.current.getVideoTracks()[0];
        const ic = new window.ImageCapture(track);
        const blob = await ic.takePhoto();
        const bmp = await createImageBitmap(blob);
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close();
        capturedViaImageCapture = true;
        logger.log(`[Capture] ImageCapture ${canvas.width}×${canvas.height}`);
      } catch (err) {
        logger.warn('[Capture] ImageCapture non disponible, fallback vidéo:', err.message);
      }
    }
    if (!capturedViaImageCapture) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
    }

    setMode('scanning');
    setScanProgress(0);
    stopCamera();

    // Animation de scan rapide
    await new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 8;
        setScanProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 15);
    });

    setIsProcessing(true);

    try {
      // PNG pour garder la qualité maximale (pas de compression lossy)
      const imgUrl = canvas.toDataURL('image/png');
      setOriginalImage(imgUrl);

      if (!isOpenCvReady()) {
        await new Promise(r => setTimeout(r, 500));
      }

      // ── Chemin 1 : coins détectés en live → aplanissement automatique ──
      // Les liveCorners sont en % du flux vidéo (même résolution que canvas).
      if (snapshotCorners && snapshotCorners.length === 4 && isOpenCvReady()) {
        const absoluteCorners = snapshotCorners.map(c => ({
          x: (c.x / 100) * canvas.width,
          y: (c.y / 100) * canvas.height
        }));

        const outputCanvas = applyPerspectiveTransform(canvas, absoluteCorners);

        if (outputCanvas && outputCanvas.width > 0) {
          // Garder les coins en % pour permettre un ré-ajustement manuel
          setCorners(snapshotCorners);

          const transformedBlob = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout blob')), 10000);
            outputCanvas.toBlob(
              blob => { clearTimeout(timeout); blob ? resolve(blob) : reject(new Error('Blob échoué')); },
              'image/png'
            );
          });

          const url = URL.createObjectURL(transformedBlob);
          setCurrentDoc({
            id: Date.now(),
            url,
            originalUrl: url,
            blob: transformedBlob,
            timestamp: new Date().toISOString(),
            enhanceMode: 'original',
            rotation: 0,
            wasDetected: true,
            ocrText: '',
          });
          setEnhanceMode('original');
          setMode('preview');
          // originalImage et corners sont gardés → "Re-ajuster" reste possible

          runOCR(transformedBlob)
            .then(text => {
              setCurrentDoc(prev => prev ? { ...prev, ocrText: text || '', ocrAttempted: true } : prev);
            })
            .catch(err => {
              logger.error('[OCR] Échec:', err);
              setCurrentDoc(prev => prev ? { ...prev, ocrText: '', ocrAttempted: true, ocrError: true } : prev);
            });

          return; // ← on ne passe PAS par l'étape d'ajustement
        }
      }

      // ── Chemin 2 : pas de coins live → détection statique + ajustement manuel ──
      const detectionWidth = Math.min(1920, canvas.width);
      const scaleFactor = canvas.width / detectionWidth;
      const detectionHeight = Math.round(canvas.height / scaleFactor);

      const detectionCanvas = document.createElement('canvas');
      detectionCanvas.width = detectionWidth;
      detectionCanvas.height = detectionHeight;
      detectionCanvas.getContext('2d').drawImage(canvas, 0, 0, detectionWidth, detectionHeight);

      const blob = await new Promise(r => detectionCanvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'capture.png', { type: 'image/png' });

      const result = await detectDocument(file);

      let cornersData = null;
      if (result.detected && result.contour) {
        cornersData = result.contour.map(point => ({
          x: (point.x / detectionWidth) * 100,
          y: (point.y / detectionHeight) * 100
        }));
      }

      setCorners(cornersData || [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 }
      ]);

      setMode('adjust');

    } catch (error) {
      logger.error('Erreur capture:', error);
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
  }, [stopCamera, detectDocument, runOCR]);

  // Maintenir le ref à jour pour l'auto-capture
  useEffect(() => { capturePhotoRef.current = capturePhoto; }, [capturePhoto]);

  // Appliquer un filtre
  const applyFilter = useCallback((filterId) => {
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

      switch (filterId) {
        case 'clearscan':
          imageData = enhanceClearScan(imageData);
          break;
        case 'magic':
          imageData = enhanceMagicColor(imageData);
          break;
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

      // PNG pour qualité sans perte
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc(prev => {
          // Révoquer l'ancienne URL filtrée, mais JAMAIS originalUrl
          // (relue à chaque application de filtre — doit rester valide)
          if (prev?.url && prev.url.startsWith('blob:') && prev.url !== prev.originalUrl) {
            URL.revokeObjectURL(prev.url);
          }
          return { ...prev, url, blob, enhanceMode: filterId };
        });
        setEnhanceMode(filterId);
        setIsProcessing(false);
      }, 'image/png');
    };

    img.onerror = () => {
      logger.error('[Filter] Erreur chargement image pour filtre');
      setIsProcessing(false);
    };

    img.src = currentDoc.originalUrl || currentDoc.url;
  }, [currentDoc]);

  // Valider l'ajustement et appliquer le filtre B&W automatiquement
  const validateAdjustment = useCallback(async () => {
    if (!corners || !originalImage) return;

    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
        img.onload = () => { clearTimeout(timeout); resolve(); };
        img.onerror = () => { clearTimeout(timeout); reject(new Error('Erreur image')); };
        img.src = originalImage;
      });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const absoluteCorners = corners.map(corner => ({
        x: (corner.x / 100) * img.width,
        y: (corner.y / 100) * img.height
      }));

      if (!isOpenCvReady()) {
        await new Promise(r => setTimeout(r, 1000));
      }

      const outputCanvas = applyPerspectiveTransform(tempCanvas, absoluteCorners);

      if (!outputCanvas || outputCanvas.width === 0) {
        throw new Error('Transformation échouée');
      }

      // Pas de filtre - garder l'image originale en couleur
      // PNG pour qualité sans perte
      const transformedBlob = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout blob')), 10000);
        outputCanvas.toBlob(
          (blob) => {
            clearTimeout(timeout);
            blob ? resolve(blob) : reject(new Error('Blob échoué'));
          },
          'image/png'
        );
      });

      const url = URL.createObjectURL(transformedBlob);

      // Nouveau document : révoquer l'ancien url ET son originalUrl
      if (currentDoc?.url && currentDoc.url.startsWith('blob:')) URL.revokeObjectURL(currentDoc.url);
      if (currentDoc?.originalUrl && currentDoc.originalUrl.startsWith('blob:') && currentDoc.originalUrl !== currentDoc.url) {
        URL.revokeObjectURL(currentDoc.originalUrl);
      }

      const newDoc = {
        id: Date.now(),
        url,
        originalUrl: url,
        blob: transformedBlob,
        timestamp: new Date().toISOString(),
        enhanceMode: 'original',
        rotation: 0,
        wasDetected: true,
        ocrText: '',
      };
      setCurrentDoc(newDoc);
      setEnhanceMode('original');
      setMode('preview');
      // originalImage et corners sont gardés intentionnellement :
      // le bouton "Re-ajuster" dans la preview permet de revenir ici.

      // Lancer l'OCR en arrière-plan (non bloquant), avec retour explicite
      runOCR(transformedBlob)
        .then(text => {
          setCurrentDoc(prev => prev ? { ...prev, ocrText: text || '', ocrAttempted: true } : prev);
          logger.log(text ? '[OCR] Texte intégré au document' : '[OCR] Aucun texte détecté');
        })
        .catch(err => {
          logger.error('[OCR] Échec:', err);
          setCurrentDoc(prev => prev ? { ...prev, ocrText: '', ocrAttempted: true, ocrError: true } : prev);
        });

    } catch (error) {
      logger.error('Erreur transformation:', error);
      alert('Erreur: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [corners, originalImage, runOCR]);

  // Annuler l'ajustement
  const cancelAdjustment = useCallback(() => {
    stopLiveDetection();
    setCorners(null);
    setOriginalImage(null);
    setIsProcessing(false);
    setMode('capture');
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

      // PNG pour qualité sans perte
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc(prev => {
          // Révoquer l'ancienne URL pivotée, mais JAMAIS originalUrl
          if (prev?.url && prev.url.startsWith('blob:') && prev.url !== prev.originalUrl) {
            URL.revokeObjectURL(prev.url);
          }
          return { ...prev, url, blob, rotation: newRotation };
        });
        setIsProcessing(false);
      }, 'image/png');
    };

    img.onerror = () => {
      logger.error('[Rotation] Erreur chargement image pour rotation');
      setIsProcessing(false);
    };

    img.src = currentDoc.url;
  }, [currentDoc]);

  // Valider et continuer (scanner un autre)
  const confirmAndContinue = useCallback(() => {
    if (!currentDoc) return;
    setScannedDocs(prev => [...prev, currentDoc]);
    setCurrentDoc(null);
    setEnhanceMode('original');
    setCorners(null);
    setOriginalImage(null);
    setIsProcessing(false);
    setMode('capture');
    startCamera();
  }, [currentDoc, startCamera]);

  // Valider et terminer
  const confirmDocument = useCallback(() => {
    if (!currentDoc) return;
    setScannedDocs(prev => [...prev, currentDoc]);
    setCurrentDoc(null);
    setEnhanceMode('original');
    setCorners(null);
    setOriginalImage(null);
    setIsProcessing(false);
    setMode('capture');
  }, [currentDoc]);

  // Retirer un document
  const removeDocument = useCallback((docId) => {
    setScannedDocs(prev => {
      // Le document retiré ne sera ni exporté ni sauvegardé : libérer ses blob URLs
      const target = prev.find(doc => doc.id === docId);
      if (target) {
        if (target.url && target.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
        if (target.originalUrl && target.originalUrl.startsWith('blob:') && target.originalUrl !== target.url) {
          URL.revokeObjectURL(target.originalUrl);
        }
      }
      return prev.filter(doc => doc.id !== docId);
    });
  }, []);

  // Upload depuis fichier
  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Le flux d'ajustement traite une image à la fois : on prend la première.
    // (un setOriginalImage par fichier ne garderait que le dernier de toute façon)
    if (files.length > 1) {
      logger.log(`[Upload] ${files.length} fichiers sélectionnés — traitement du premier`);
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalImage(event.target.result);
      setCorners([
        { x: 5, y: 5 },
        { x: 95, y: 5 },
        { x: 95, y: 95 },
        { x: 5, y: 95 }
      ]);
      setMode('adjust');
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  }, []);

  // Ouvrir le panneau d'export
  const openExportPanel = useCallback(() => {
    if (scannedDocs.length === 0) {
      alert('Aucun document à exporter');
      return;
    }
    setMode('export');
  }, [scannedDocs]);

  // Export PDF
  const exportAsPdf = useCallback(async () => {
    if (scannedDocs.length === 0) return;

    setIsProcessing(true);
    try {
      const filename = `scan_${new Date().toISOString().slice(0, 10)}`;
      await createAndDownloadPdf(scannedDocs, filename, {
        title: filename,
        pageSize: 'a4',
        orientation: 'portrait'
      });
    } catch (error) {
      logger.error('Erreur PDF:', error);
      alert('Erreur lors de la création du PDF');
    } finally {
      setIsProcessing(false);
    }
  }, [scannedDocs]);

  // Export images
  const exportAsImages = useCallback(async () => {
    if (scannedDocs.length === 0) return;

    setIsProcessing(true);
    try {
      const baseName = `scan_${new Date().toISOString().slice(0, 10)}`;
      await downloadImagesAsZip(scannedDocs, baseName);
    } catch (error) {
      logger.error('Erreur images:', error);
      alert('Erreur lors du téléchargement');
    } finally {
      setIsProcessing(false);
    }
  }, [scannedDocs]);

  // Sauvegarder dans le cloud
  const saveToCloud = useCallback(() => {
    if (scannedDocs.length === 0) return;
    if (onSave) onSave(scannedDocs);
  }, [scannedDocs, onSave]);

  // Export selon format
  const handleExport = useCallback(async () => {
    switch (exportFormat) {
      case 'pdf': await exportAsPdf(); break;
      case 'images': await exportAsImages(); break;
      case 'cloud': saveToCloud(); break;
      default: await exportAsPdf();
    }
  }, [exportFormat, exportAsPdf, exportAsImages, saveToCloud]);

  // === RENDUS ===

  const renderStartView = () => (
    <div className="start-view">
      <h2>Scanner de Documents</h2>
      <p>Numérisez vos documents en haute qualité</p>

      <div className="start-actions">
        <button className="scanner-btn primary" onClick={startCamera}>
          <CameraIcon style={{ width: 20, height: 20 }} />
          Ouvrir la caméra
        </button>

        <span className="start-divider">ou</span>

        <button className="scanner-btn" onClick={() => fileInputRef.current?.click()}>
          <DownloadIcon style={{ width: 20, height: 20 }} />
          Choisir une image
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="scanner-file-input"
      />
    </div>
  );

  const renderCameraView = () => (
    <>
      <video ref={videoRef} autoPlay playsInline muted className="camera-video"
        onLoadedMetadata={recomputeVideoDims} />
      <canvas ref={overlayCanvasRef} className="camera-overlay-canvas"
        style={videoDims ? {
          position: 'absolute',
          left: videoDims.left,
          top: videoDims.top,
          width: videoDims.w,
          height: videoDims.h,
        } : undefined} />
      {!liveCorners && <div className="guide-frame" />}

      {yoloModelLoading && <div className="detector-badge loading">Chargement YOLO...</div>}
      {yoloModelLoaded && yoloIsSegmentation && <div className="detector-badge yolo-seg">YOLO-SEG</div>}
      {yoloModelLoaded && !yoloIsSegmentation && <div className="detector-badge yolo">YOLO</div>}
      {!yoloModelLoaded && !yoloModelLoading && <div className="detector-badge opencv">OpenCV</div>}

      {scannedDocs.length > 0 && (
        <div className="mini-gallery">
          <div className="mini-gallery-thumbs">
            {scannedDocs.slice(-3).map((doc) => (
              <img key={doc.id} src={doc.url} alt="" />
            ))}
          </div>
          <div className="mini-gallery-count">{scannedDocs.length}</div>
        </div>
      )}

      {liveCorners && detectionConfidence > 0 && (
        <div className="detection-indicator">
          <CheckCircleIcon style={{ width: 18, height: 18 }} />
          Document détecté
        </div>
      )}
    </>
  );

  const renderScanningView = () => (
    <div className="scanning-view">
      <div className="scan-line" style={{ top: `${scanProgress}%` }} />
      <div className="scanning-text">
        {liveCornersRef.current ? 'Aplanissement...' : 'Analyse en cours...'}
      </div>
    </div>
  );

  const renderAdjustView = () => {
    // Dimensions pixel de l'image rendu (recalculées par recomputeStage).
    // Overlay SVG et handles sont positionnés en px absolus sur adjust-container
    // → même repère que getBoundingClientRect() utilisé dans useCornerDrag.
    const hasStage = !!stageDims;
    const ol = stageDims ? {
      left:   stageDims.left,
      top:    stageDims.top,
      width:  stageDims.w,
      height: stageDims.h,
    } : null;

    return (
      <div
        ref={adjustContainerRef}
        className="adjust-container"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Image au centre — max-width/max-height sans déformation */}
        <img
          ref={previewCanvasRef}
          src={originalImage}
          alt="Document"
          className="adjust-image"
          onLoad={recomputeStage}
        />

        {/* Overlay et poignées uniquement quand le rect image est connu */}
        {hasStage && (
          <>
            <svg
              className="adjust-overlay"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
              style={ol}
            >
              <defs>
                <mask id="docMask">
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <polygon points={corners.map(c => `${c.x},${c.y}`).join(' ')} fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.55)" mask="url(#docMask)" />
              <polygon
                points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke="#b87333"
                strokeWidth="0.6"
                strokeLinejoin="round"
              />
            </svg>

            {corners.map((corner, index) => (
              <div
                key={index}
                className="corner-handle"
                style={{
                  left: stageDims.left + (corner.x / 100) * stageDims.w,
                  top:  stageDims.top  + (corner.y / 100) * stageDims.h,
                }}
                onMouseDown={(e) => handleCornerMouseDown(index, e)}
                onTouchStart={(e) => handleCornerTouchStart(index, e)}
              />
            ))}
          </>
        )}

        {/* Loupe lors du drag */}
        {draggedCorner !== null && corners && originalImage && (
          <div style={{
            position: 'absolute', top: '20px', left: '50%',
            transform: 'translateX(-50%)',
            width: '100px', height: '100px',
            borderRadius: '50%', border: '4px solid #b87333',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            overflow: 'hidden', zIndex: 100,
            backgroundColor: '#000', pointerEvents: 'none',
          }}>
            <img
              src={originalImage}
              alt=""
              style={{
                position: 'absolute',
                width: '300%', height: '300%',
                left: `calc(50% - ${corners[draggedCorner].x * 3}%)`,
                top:  `calc(50% - ${corners[draggedCorner].y * 3}%)`,
                objectFit: 'cover', pointerEvents: 'none',
              }}
            />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '16px', height: '16px',
              border: '2px solid #b87333', borderRadius: '50%',
            }} />
          </div>
        )}

        <div className="adjust-hint">Ajustez les coins du document</div>
      </div>
    );
  };

  const renderPreviewView = () => (
    <img src={currentDoc.url} alt="Document scanné" className="document-preview" />
  );

  const renderFilterBar = () => (
    <div className="enhance-mode-bar">
      {FILTERS.map(filter => (
        <button
          key={filter.id}
          className={`filter-btn ${enhanceMode === filter.id ? 'active' : ''}`}
          onClick={() => applyFilter(filter.id)}
          disabled={isProcessing}
        >
          <span className="filter-icon">{filter.icon}</span>
          <span>{filter.label}</span>
        </button>
      ))}
    </div>
  );

  const renderGallery = () => (
    <div className="docs-gallery">
      {scannedDocs.map(doc => (
        <div key={doc.id} className="doc-thumbnail">
          <img src={doc.url} alt="Document" />
          <button className="doc-remove" onClick={() => removeDocument(doc.id)}>×</button>
        </div>
      ))}
    </div>
  );

  const renderExportView = () => (
    <div className="export-view">
      <div className="export-preview">
        {scannedDocs.map((doc, idx) => (
          <div key={doc.id} className="export-preview-item">
            <img src={doc.url} alt={`Page ${idx + 1}`} />
            <span className="page-number">{idx + 1}</span>
          </div>
        ))}
      </div>

      <h3 className="export-title">
        {scannedDocs.length} document{scannedDocs.length > 1 ? 's' : ''} prêt{scannedDocs.length > 1 ? 's' : ''}
      </h3>

      <div className="export-options">
        <div
          className={`export-option ${exportFormat === 'pdf' ? 'selected' : ''}`}
          onClick={() => setExportFormat('pdf')}
        >
          <span className="option-icon">📄</span>
          <div className="option-info">
            <div className="option-title">PDF</div>
            <div className="option-desc">Un seul fichier multi-pages</div>
          </div>
          <div className="option-check">{exportFormat === 'pdf' ? '✓' : ''}</div>
        </div>

        <div
          className={`export-option ${exportFormat === 'images' ? 'selected' : ''}`}
          onClick={() => setExportFormat('images')}
        >
          <span className="option-icon">🖼️</span>
          <div className="option-info">
            <div className="option-title">Images JPG</div>
            <div className="option-desc">{scannedDocs.length} fichier{scannedDocs.length > 1 ? 's' : ''} séparé{scannedDocs.length > 1 ? 's' : ''}</div>
          </div>
          <div className="option-check">{exportFormat === 'images' ? '✓' : ''}</div>
        </div>

        {onSave && (
          <div
            className={`export-option ${exportFormat === 'cloud' ? 'selected' : ''}`}
            onClick={() => setExportFormat('cloud')}
          >
            <span className="option-icon">☁️</span>
            <div className="option-info">
              <div className="option-title">Sauvegarder</div>
              <div className="option-desc">Dans vos documents</div>
            </div>
            <div className="option-check">{exportFormat === 'cloud' ? '✓' : ''}</div>
          </div>
        )}
      </div>

      <div className="export-actions">
        <button
          className="scanner-btn"
          onClick={() => { setMode('capture'); startCamera(); }}
          disabled={isProcessing}
        >
          + Ajouter
        </button>
        <button
          className="scanner-btn primary"
          onClick={handleExport}
          disabled={isProcessing}
        >
          {isProcessing ? 'Export...' : 'Exporter'}
        </button>
      </div>
    </div>
  );

  const renderControls = () => (
    <div className="control-buttons">
      {mode === 'capture' && stream && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          {scannedDocs.length > 0 && (
            <button className="scanner-btn success" onClick={() => { stopCamera(); setIsProcessing(false); }}>
              <CheckCircleIcon style={{ width: 18, height: 18 }} />
              Terminer ({scannedDocs.length})
            </button>
          )}
          {/* Bouton de capture avec anneau de progression auto-capture */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {autoCapturing && (
              <svg style={{ position: 'absolute', width: 80, height: 80, transform: 'rotate(-90deg)', pointerEvents: 'none' }} viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#b87333" strokeWidth="4" strokeOpacity="0.3" />
                <circle
                  cx="40" cy="40" r="36" fill="none" stroke="#b87333" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - autoProgress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                />
              </svg>
            )}
            <button className="capture-button" onClick={capturePhoto} disabled={isProcessing}
              title={autoCapturing ? 'Capture auto dans 2s — cliquez pour forcer' : 'Capturer'}
            />
          </div>
        </div>
      )}

      {mode === 'adjust' && corners && (
        <>
          <button className="scanner-btn danger" onClick={cancelAdjustment} disabled={isProcessing}>
            <XCircleIcon style={{ width: 18, height: 18 }} />
            Annuler
          </button>
          <button className="scanner-btn success" onClick={validateAdjustment} disabled={isProcessing}>
            <CheckCircleIcon style={{ width: 18, height: 18 }} />
            Valider
          </button>
        </>
      )}

      {mode === 'preview' && currentDoc && (
        <>
          {/* Badge OCR */}
          {isProcessingOCR && (
            <div style={{ fontSize: 12, color: '#b87333', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              OCR {ocrProgress}%
            </div>
          )}
          {!isProcessingOCR && currentDoc.ocrText && (
            <div style={{ fontSize: 12, color: '#10b981' }} title={`${currentDoc.ocrText.length} caractères reconnus`}>
              ✓ Texte reconnu
            </div>
          )}
          {!isProcessingOCR && currentDoc.ocrAttempted && !currentDoc.ocrText && (
            <div style={{ fontSize: 12, color: '#9ca3af' }} title={currentDoc.ocrError ? 'OCR indisponible (réseau ?)' : 'Aucun texte détecté'}>
              {currentDoc.ocrError ? 'OCR indisponible' : 'Aucun texte'}
            </div>
          )}
          <button className="scanner-btn" onClick={rotateImage} disabled={isProcessing}>
            <RotateCwIcon style={{ width: 18, height: 18 }} />
          </button>
          {/* Visible uniquement si on a l'image originale pour re-recadrer */}
          {originalImage && corners && (
            <button
              className="scanner-btn"
              onClick={() => setMode('adjust')}
              disabled={isProcessing}
              title="Réajuster les coins manuellement"
            >
              Réajuster
            </button>
          )}
          <button
            className="scanner-btn danger"
            onClick={() => {
              stopLiveDetection();
              setCurrentDoc(null);
              setCorners(null);
              setOriginalImage(null);
              setIsProcessing(false);
              setMode('capture');
              startCamera();
            }}
          >
            <XCircleIcon style={{ width: 18, height: 18 }} />
          </button>
          <button className="scanner-btn primary" onClick={confirmAndContinue}>
            <CameraIcon style={{ width: 18, height: 18 }} />
            +1
          </button>
          <button className="scanner-btn success" onClick={confirmDocument}>
            <CheckCircleIcon style={{ width: 18, height: 18 }} />
            OK
          </button>
        </>
      )}

      {mode === 'capture' && !stream && scannedDocs.length > 0 && (
        <button className="scanner-btn primary" onClick={openExportPanel}>
          <DownloadIcon style={{ width: 18, height: 18 }} />
          Exporter ({scannedDocs.length})
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
        >
          <ChevronLeftIcon style={{ width: 18, height: 18 }} />
          Retour
        </button>
        <h1 className="scanner-title">Scanner</h1>
        <div className="scanner-counter">
          {scannedDocs.length} doc{scannedDocs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Vue principale */}
      <div className="camera-view">
        {mode === 'capture' && !stream && renderStartView()}
        {mode === 'capture' && stream && renderCameraView()}
        {mode === 'scanning' && renderScanningView()}
        {mode === 'adjust' && originalImage && corners && renderAdjustView()}
        {mode === 'preview' && currentDoc && renderPreviewView()}
        {mode === 'export' && renderExportView()}
        {isProcessing && mode !== 'export' && (
          <div className="processing-overlay">Traitement...</div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Contrôles */}
      {mode !== 'export' && (
        <div className="scanner-controls">
          {scannedDocs.length > 0 && mode !== 'preview' && mode !== 'adjust' && mode !== 'scanning' && renderGallery()}
          {mode === 'preview' && currentDoc && renderFilterBar()}
          {renderControls()}
        </div>
      )}
    </div>
  );
}
