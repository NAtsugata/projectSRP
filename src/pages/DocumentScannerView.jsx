// src/pages/DocumentScannerView.jsx
// Scanner de documents — style ClearScanner
// États: idle | camera | processing | preview | adjust | export
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronLeftIcon,
  RotateCwIcon,
  DownloadIcon,
} from '../components/SharedUI';
import { createAndDownloadPdf, downloadImagesAsZip } from '../utils/pdfGenerator';
import {
  enhanceBlackAndWhite,
  enhanceColor,
  enhanceGrayscale,
  enhanceClearScan,
  enhanceMagicColor,
  isOpenCvReady,
  applyPerspectiveTransform,
} from '../utils/documentScanner';
import { preloadOpenCV } from '../utils/jscanifyDetector';
import { useDocumentDetection } from '../hooks/useDocumentDetection';
import { useCornerDrag } from '../hooks/useCornerDrag';
import { useOCR } from '../hooks/useOCR';
import logger from '../utils/logger';
import '../components/scanner/ScannerStyles.css';

// ─── Filtres disponibles ──────────────────────────────────────────────────────

const FILTERS = [
  { id: 'magic',     label: 'Auto',     icon: '✨', desc: 'Fond blanc, couleurs nettes' },
  { id: 'clearscan', label: 'Net N&B',  icon: '📋', desc: 'Texte noir, fond blanc' },
  { id: 'gray',      label: 'Gris',     icon: '⬜', desc: 'Niveaux de gris' },
  { id: 'bw',        label: 'N&B pur',  icon: '📄', desc: 'Noir & Blanc global' },
  { id: 'original',  label: 'Original', icon: '🖼️', desc: 'Sans modification' },
];

// Filtre appliqué automatiquement après capture (signature ClearScanner)
const DEFAULT_FILTER = 'magic';

// Auto-capture : polling toutes les 200ms, déclenche après 8 sondages stables (~1.6s)
const AUTO_POLL_MS    = 200;
const AUTO_STABLE_TARGET = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Applique un filtre d'amélioration à un canvas et retourne un NOUVEAU canvas.
 */
function enhanceCanvas(sourceCanvas, filterId) {
  if (!filterId || filterId === 'original') return sourceCanvas;
  try {
    const ctx = sourceCanvas.getContext('2d');
    let imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    switch (filterId) {
      case 'clearscan': imageData = enhanceClearScan(imageData);    break;
      case 'magic':     imageData = enhanceMagicColor(imageData);   break;
      case 'bw':        imageData = enhanceBlackAndWhite(imageData); break;
      case 'gray':      imageData = enhanceGrayscale(imageData);    break;
      case 'color':     imageData = enhanceColor(imageData);        break;
      default:          return sourceCanvas;
    }
    const out = document.createElement('canvas');
    out.width  = sourceCanvas.width;
    out.height = sourceCanvas.height;
    out.getContext('2d').putImageData(imageData, 0, 0);
    return out;
  } catch (err) {
    logger.error('[Enhance] Filtre échoué:', err);
    return sourceCanvas;
  }
}

/** canvas → blob PNG */
function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout blob')), 10000);
    canvas.toBlob(
      (blob) => {
        clearTimeout(t);
        blob ? resolve(blob) : reject(new Error('Blob échoué'));
      },
      'image/png'
    );
  });
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DocumentScannerView({ onSave, onClose }) {
  // ── État principal ─────────────────────────────────────────────────────────
  // States : idle | camera | processing | preview | adjust | export
  const [mode, setMode]             = useState('idle');
  const [scannedDocs, setScannedDocs] = useState([]);
  const [currentDoc, setCurrentDoc] = useState(null);

  // Traitement
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Données image
  const [corners, setCorners]           = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [enhanceMode, setEnhanceMode]   = useState(DEFAULT_FILTER);

  // Caméra
  const [stream, setStream]             = useState(null);
  const [cvReady, setCvReady]           = useState(false);
  const [videoDims, setVideoDims]       = useState(null);

  // Stage (mode adjust)
  const [stageDims, setStageDims]       = useState(null);

  // Export
  const [exportFormat, setExportFormat] = useState('pdf');

  // Auto-capture
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [autoProgress, setAutoProgress]   = useState(0);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef           = useRef(null);
  const canvasRef          = useRef(null);
  const previewCanvasRef   = useRef(null);
  const overlayCanvasRef   = useRef(null);
  const fileInputRef       = useRef(null);
  const adjustContainerRef = useRef(null);
  const streamRef          = useRef(null);
  const isStartingCamRef   = useRef(false);
  const capturePhotoRef    = useRef(null);
  const stableCountRef     = useRef(0);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const { runOCR, isProcessingOCR, ocrProgress, terminateWorker } = useOCR();

  const {
    detectionActive,
    detectionStable,
    liveCornersRef,
    confidenceRef,
    detectDocument,
    startLiveDetection,
    stopLiveDetection,
  } = useDocumentDetection();

  const {
    draggedCorner,
    handleCornerMouseDown,
    handleCornerTouchStart,
    handleMouseMove,
    handleTouchMove,
    handleMouseUp,
  } = useCornerDrag(previewCanvasRef, setCorners);

  // ── Cleanup au démontage ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      terminateWorker();
    };
  }, [terminateWorker]);

  // Nettoyage mémoire de originalImage (blob URL)
  useEffect(() => {
    return () => {
      if (originalImage?.startsWith?.('blob:')) {
        URL.revokeObjectURL(originalImage);
      }
    };
  }, [originalImage]);

  // ── Charger OpenCV ─────────────────────────────────────────────────────────
  useEffect(() => {
    preloadOpenCV()
      .then(() => { logger.log('[OpenCV] Chargé'); setCvReady(true); })
      .catch((err) => logger.error('[OpenCV] Erreur:', err));

    const interval = setInterval(() => {
      if (isOpenCvReady()) { setCvReady(true); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Attacher le stream à la vidéo ─────────────────────────────────────────
  useEffect(() => {
    if (!stream || mode !== 'camera') return;
    const attach = () => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => logger.error('play:', e));
      }
    };
    attach();
    const t = setTimeout(attach, 100);
    return () => {
      clearTimeout(t);
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream, mode]);

  // ── Détection live ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera' || !stream || !videoRef.current || !overlayCanvasRef.current || !cvReady) {
      stopLiveDetection();
      return;
    }
    const video = videoRef.current;
    const start = () => {
      if (video.readyState >= 2) {
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width  = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
        }
        startLiveDetection(videoRef, overlayCanvasRef);
      }
    };
    video.addEventListener('loadeddata', start);
    if (video.readyState >= 2) start();
    return () => {
      video.removeEventListener('loadeddata', start);
      stopLiveDetection();
    };
  }, [mode, stream, cvReady, startLiveDetection, stopLiveDetection]);

  // ── Auto-capture (polling stabilité) ──────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera') {
      stableCountRef.current = 0;
      setAutoCapturing(false);
      setAutoProgress(0);
      return;
    }
    const poll = setInterval(() => {
      // Toujours utiliser liveCornersRef.current sans seuil de confiance
      const isStable = detectionStable && liveCornersRef.current !== null;

      if (!isStable) {
        if (stableCountRef.current !== 0) {
          stableCountRef.current = 0;
          setAutoCapturing(false);
          setAutoProgress(0);
        }
        return;
      }

      stableCountRef.current += 1;
      const count = stableCountRef.current;
      if (count === 1) setAutoCapturing(true);
      setAutoProgress(Math.min(100, (count / AUTO_STABLE_TARGET) * 100));

      if (count >= AUTO_STABLE_TARGET) {
        clearInterval(poll);
        stableCountRef.current = 0;
        setAutoCapturing(false);
        setAutoProgress(0);
        logger.log('[Auto-capture] Stable — déclenchement');
        capturePhotoRef.current?.();
      }
    }, AUTO_POLL_MS);

    return () => {
      clearInterval(poll);
      stableCountRef.current = 0;
      setAutoCapturing(false);
      setAutoProgress(0);
    };
  }, [mode, detectionStable, liveCornersRef]);

  // ── videoDims — rect px du contenu vidéo (object-fit: contain) ────────────
  const recomputeVideoDims = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth || !vid.videoHeight) return;
    const cont = vid.parentElement;
    if (!cont) return;
    const cw = cont.clientWidth, ch = cont.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / vid.videoWidth, ch / vid.videoHeight);
    const w = Math.round(vid.videoWidth  * scale);
    const h = Math.round(vid.videoHeight * scale);
    setVideoDims({
      w, h,
      left: Math.round((cw - w) / 2),
      top:  Math.round((ch - h) / 2),
    });
  }, []);

  useEffect(() => {
    if (mode !== 'camera' || !stream) { setVideoDims(null); return; }
    const vid = videoRef.current;
    if (!vid) return;
    vid.addEventListener('loadedmetadata', recomputeVideoDims);
    vid.addEventListener('resize',         recomputeVideoDims);
    if (vid.videoWidth) recomputeVideoDims();
    const cont = vid.parentElement;
    if (!cont) return () => {
      vid.removeEventListener('loadedmetadata', recomputeVideoDims);
      vid.removeEventListener('resize',         recomputeVideoDims);
    };
    const ro = new ResizeObserver(recomputeVideoDims);
    ro.observe(cont);
    return () => {
      vid.removeEventListener('loadedmetadata', recomputeVideoDims);
      vid.removeEventListener('resize',         recomputeVideoDims);
      ro.disconnect();
    };
  }, [mode, stream, recomputeVideoDims]);

  // ── stageDims — rect px de l'image en mode adjust ─────────────────────────
  const recomputeStage = useCallback(() => {
    const cont  = adjustContainerRef.current;
    const imgEl = previewCanvasRef.current;
    if (!cont || !imgEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return;
    const cw = cont.clientWidth, ch = cont.clientHeight;
    if (!cw || !ch) return;
    const scale = Math.min(cw / imgEl.naturalWidth, ch / imgEl.naturalHeight);
    const w = Math.round(imgEl.naturalWidth  * scale);
    const h = Math.round(imgEl.naturalHeight * scale);
    setStageDims({
      w, h,
      left: Math.round((cw - w) / 2),
      top:  Math.round((ch - h) / 2),
    });
  }, []);

  useEffect(() => {
    if (mode !== 'adjust') { setStageDims(null); return; }
    const cont = adjustContainerRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(recomputeStage);
    ro.observe(cont);
    recomputeStage();
    return () => ro.disconnect();
  }, [mode, originalImage, recomputeStage]);

  // ── Démarrer la caméra ─────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (isStartingCamRef.current) return;
    isStartingCamRef.current = true;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setMode('camera');
    } catch (err) {
      logger.error('Erreur caméra:', err);
      alert("Impossible d'accéder à la caméra");
    } finally {
      isStartingCamRef.current = false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  // ── Capture photo ──────────────────────────────────────────────────────────
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;

    // Snapshot des coins AVANT stopCamera (ils disparaissent après)
    // Pas de seuil de confiance : on utilise TOUT ce qui est détecté
    const snapshotCorners = liveCornersRef.current;

    // ImageCapture API pour photo pleine résolution (avant stopCamera)
    let usedImageCapture = false;
    if (streamRef.current && typeof window.ImageCapture !== 'undefined') {
      try {
        const track = streamRef.current.getVideoTracks()[0];
        const ic    = new window.ImageCapture(track);
        const blob  = await ic.takePhoto();
        const bmp   = await createImageBitmap(blob);
        canvas.width  = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close();
        usedImageCapture = true;
        logger.log(`[Capture] ImageCapture ${canvas.width}×${canvas.height}`);
      } catch (err) {
        logger.warn('[Capture] ImageCapture indisponible, fallback vidéo:', err.message);
      }
    }
    if (!usedImageCapture) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
    }

    // IMPORTANT : sur mobile, ImageCapture renvoie la pleine résolution du capteur
    // (jusqu'à 12 Mpx). warpPerspective + filtres OpenCV sur une image aussi grosse
    // font saturer le heap WASM → crash silencieux, écran bloqué sur "Aplanissement…".
    // On plafonne le bord long à 2200px : qualité largement suffisante, traitement fiable.
    const MAX_EDGE = 2200;
    const longEdge = Math.max(canvas.width, canvas.height);
    if (longEdge > MAX_EDGE) {
      const s = MAX_EDGE / longEdge;
      const tmp = document.createElement('canvas');
      tmp.width  = Math.round(canvas.width * s);
      tmp.height = Math.round(canvas.height * s);
      tmp.getContext('2d').drawImage(canvas, 0, 0, tmp.width, tmp.height);
      canvas.width  = tmp.width;
      canvas.height = tmp.height;
      canvas.getContext('2d').drawImage(tmp, 0, 0);
      logger.log(`[Capture] Réduit à ${canvas.width}×${canvas.height}`);
    }

    setMode('processing');
    setScanProgress(0);
    stopCamera();

    // Animation de scan rapide
    await new Promise((resolve) => {
      let p = 0;
      const iv = setInterval(() => {
        p += 10;
        setScanProgress(p);
        if (p >= 100) { clearInterval(iv); resolve(); }
      }, 20);
    });

    setIsProcessing(true);
    try {
      const imgUrl = canvas.toDataURL('image/png');
      setOriginalImage(imgUrl);

      if (!isOpenCvReady()) await new Promise((r) => setTimeout(r, 500));

      // ── Chemin 1 : coins live détectés → aplanissement auto → preview ────
      if (snapshotCorners && snapshotCorners.length === 4 && isOpenCvReady()) {
        const absoluteCorners = snapshotCorners.map((c) => ({
          x: (c.x / 100) * canvas.width,
          y: (c.y / 100) * canvas.height,
        }));

        const flatCanvas = applyPerspectiveTransform(canvas, absoluteCorners);

        if (flatCanvas && flatCanvas.width > 0) {
          setCorners(snapshotCorners);

          const flatBlob    = await canvasToBlob(flatCanvas);
          const originalUrl = URL.createObjectURL(flatBlob);

          const enhancedCanvas = enhanceCanvas(flatCanvas, DEFAULT_FILTER);
          const enhancedBlob   = await canvasToBlob(enhancedCanvas);
          const url            = URL.createObjectURL(enhancedBlob);

          setCurrentDoc({
            id:         Date.now(),
            url,
            originalUrl,
            blob:       enhancedBlob,
            timestamp:  new Date().toISOString(),
            enhanceMode: DEFAULT_FILTER,
            rotation:   0,
            wasDetected: true,
            ocrText:    '',
          });
          setEnhanceMode(DEFAULT_FILTER);
          setMode('preview');

          runOCR(enhancedBlob)
            .then((text) =>
              setCurrentDoc((prev) =>
                prev ? { ...prev, ocrText: text || '', ocrAttempted: true } : prev
              )
            )
            .catch((err) => {
              logger.error('[OCR]:', err);
              setCurrentDoc((prev) =>
                prev
                  ? { ...prev, ocrText: '', ocrAttempted: true, ocrError: true }
                  : prev
              );
            });

          return; // Ne pas passer par adjust
        }
      }

      // ── Chemin 2 : pas de coins → détection statique → mode adjust ───────
      const detW = Math.min(1920, canvas.width);
      const detH = Math.round(canvas.height * (detW / canvas.width));
      const detCanvas = document.createElement('canvas');
      detCanvas.width  = detW;
      detCanvas.height = detH;
      detCanvas.getContext('2d').drawImage(canvas, 0, 0, detW, detH);

      const blob = await new Promise((r) => detCanvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'capture.png', { type: 'image/png' });
      const result = await detectDocument(file);

      let cornersData = null;
      if (result.detected && result.contour) {
        cornersData = result.contour.map((p) => ({
          x: (p.x / detW) * 100,
          y: (p.y / detH) * 100,
        }));
      }

      setCorners(cornersData || [
        { x: 10, y: 10 }, { x: 90, y: 10 },
        { x: 90, y: 90 }, { x: 10, y: 90 },
      ]);
      setMode('adjust');
    } catch (err) {
      logger.error('Erreur capture:', err);
      setCorners([
        { x: 10, y: 10 }, { x: 90, y: 10 },
        { x: 90, y: 90 }, { x: 10, y: 90 },
      ]);
      setMode('adjust');
    } finally {
      setIsProcessing(false);
    }
  }, [stopCamera, detectDocument, runOCR, liveCornersRef]);

  // Synchroniser ref pour auto-capture
  useEffect(() => { capturePhotoRef.current = capturePhoto; }, [capturePhoto]);

  // ── Appliquer un filtre ────────────────────────────────────────────────────
  const applyFilter = useCallback(
    (filterId) => {
      if (!currentDoc || !canvasRef.current) return;
      setIsProcessing(true);
      const canvas = canvasRef.current;
      const img    = new Image();
      img.onload = () => {
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        switch (filterId) {
          case 'clearscan': imageData = enhanceClearScan(imageData);    break;
          case 'magic':     imageData = enhanceMagicColor(imageData);   break;
          case 'bw':        imageData = enhanceBlackAndWhite(imageData); break;
          case 'gray':      imageData = enhanceGrayscale(imageData);    break;
          case 'color':     imageData = enhanceColor(imageData);        break;
          default: break;
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          setCurrentDoc((prev) => {
            if (prev?.url?.startsWith('blob:') && prev.url !== prev.originalUrl) {
              URL.revokeObjectURL(prev.url);
            }
            return { ...prev, url, blob, enhanceMode: filterId };
          });
          setEnhanceMode(filterId);
          setIsProcessing(false);
        }, 'image/png');
      };
      img.onerror = () => { logger.error('[Filter] Erreur image'); setIsProcessing(false); };
      img.src = currentDoc.originalUrl || currentDoc.url;
    },
    [currentDoc]
  );

  // ── Valider l'ajustement (mode adjust → preview) ──────────────────────────
  const validateAdjustment = useCallback(async () => {
    if (!corners || !originalImage) return;
    setIsProcessing(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('Timeout')), 10000);
        img.onload  = () => { clearTimeout(t); res(); };
        img.onerror = () => { clearTimeout(t); rej(new Error('Erreur image')); };
        img.src = originalImage;
      });

      const tmp = document.createElement('canvas');
      tmp.width  = img.width;
      tmp.height = img.height;
      tmp.getContext('2d').drawImage(img, 0, 0);

      const absoluteCorners = corners.map((c) => ({
        x: (c.x / 100) * img.width,
        y: (c.y / 100) * img.height,
      }));

      if (!isOpenCvReady()) await new Promise((r) => setTimeout(r, 1000));

      const flatCanvas = applyPerspectiveTransform(tmp, absoluteCorners);
      if (!flatCanvas || flatCanvas.width === 0) throw new Error('Transformation échouée');

      const flatBlob    = await canvasToBlob(flatCanvas);
      const originalUrl = URL.createObjectURL(flatBlob);
      const enhanced    = enhanceCanvas(flatCanvas, DEFAULT_FILTER);
      const enhancedBlob = await canvasToBlob(enhanced);
      const url          = URL.createObjectURL(enhancedBlob);

      if (currentDoc?.url?.startsWith('blob:'))         URL.revokeObjectURL(currentDoc.url);
      if (currentDoc?.originalUrl?.startsWith('blob:') && currentDoc.originalUrl !== currentDoc.url) {
        URL.revokeObjectURL(currentDoc.originalUrl);
      }

      setCurrentDoc({
        id:         Date.now(),
        url,
        originalUrl,
        blob:       enhancedBlob,
        timestamp:  new Date().toISOString(),
        enhanceMode: DEFAULT_FILTER,
        rotation:   0,
        wasDetected: true,
        ocrText:    '',
      });
      setEnhanceMode(DEFAULT_FILTER);
      setMode('preview');

      runOCR(enhancedBlob)
        .then((text) =>
          setCurrentDoc((prev) =>
            prev ? { ...prev, ocrText: text || '', ocrAttempted: true } : prev
          )
        )
        .catch((err) => {
          logger.error('[OCR]:', err);
          setCurrentDoc((prev) =>
            prev ? { ...prev, ocrText: '', ocrAttempted: true, ocrError: true } : prev
          );
        });
    } catch (err) {
      logger.error('Erreur transformation:', err);
      alert('Erreur: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [corners, originalImage, currentDoc, runOCR]);

  // ── Annuler ajustement ────────────────────────────────────────────────────
  const cancelAdjustment = useCallback(() => {
    stopLiveDetection();
    setCorners(null);
    setOriginalImage(null);
    setIsProcessing(false);
    startCamera();
  }, [startCamera, stopLiveDetection]);

  // ── Rotation de l'image ────────────────────────────────────────────────────
  const rotateImage = useCallback(() => {
    if (!currentDoc || !canvasRef.current) return;
    setIsProcessing(true);
    const canvas = canvasRef.current;
    const img    = new Image();
    img.onload = () => {
      const newRot = (currentDoc.rotation + 90) % 360;
      if (newRot === 90 || newRot === 270) {
        canvas.width  = img.height;
        canvas.height = img.width;
      } else {
        canvas.width  = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((newRot * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setCurrentDoc((prev) => {
          if (prev?.url?.startsWith('blob:') && prev.url !== prev.originalUrl) {
            URL.revokeObjectURL(prev.url);
          }
          return { ...prev, url, blob, rotation: newRot };
        });
        setIsProcessing(false);
      }, 'image/png');
    };
    img.onerror = () => { logger.error('[Rotation] Erreur'); setIsProcessing(false); };
    img.src = currentDoc.url;
  }, [currentDoc]);

  // ── Confirmer et continuer ─────────────────────────────────────────────────
  const confirmAndContinue = useCallback(() => {
    if (!currentDoc) return;
    setScannedDocs((prev) => [...prev, currentDoc]);
    setCurrentDoc(null);
    setEnhanceMode(DEFAULT_FILTER);
    setCorners(null);
    setOriginalImage(null);
    setIsProcessing(false);
    startCamera();
  }, [currentDoc, startCamera]);

  // ── Confirmer et terminer ──────────────────────────────────────────────────
  const confirmDocument = useCallback(() => {
    if (!currentDoc) return;
    setScannedDocs((prev) => [...prev, currentDoc]);
    setCurrentDoc(null);
    setEnhanceMode(DEFAULT_FILTER);
    setCorners(null);
    setOriginalImage(null);
    setIsProcessing(false);
    setMode('idle');
  }, [currentDoc]);

  // ── Supprimer un document de la galerie ───────────────────────────────────
  const removeDocument = useCallback((docId) => {
    setScannedDocs((prev) => {
      const target = prev.find((d) => d.id === docId);
      if (target) {
        if (target.url?.startsWith('blob:'))         URL.revokeObjectURL(target.url);
        if (target.originalUrl?.startsWith('blob:') && target.originalUrl !== target.url) {
          URL.revokeObjectURL(target.originalUrl);
        }
      }
      return prev.filter((d) => d.id !== docId);
    });
  }, []);

  // ── Upload depuis fichier ──────────────────────────────────────────────────
  const handleFileUpload = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const file   = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      setOriginalImage(ev.target.result);
      setCorners([
        { x: 5, y: 5 }, { x: 95, y: 5 },
        { x: 95, y: 95 }, { x: 5, y: 95 },
      ]);
      setMode('adjust');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportAsPdf = useCallback(async () => {
    if (!scannedDocs.length) return;
    setIsProcessing(true);
    try {
      const filename = `scan_${new Date().toISOString().slice(0, 10)}`;
      await createAndDownloadPdf(scannedDocs, filename, {
        title: filename, pageSize: 'a4', orientation: 'portrait',
      });
    } catch (err) {
      logger.error('Erreur PDF:', err);
      alert('Erreur PDF');
    } finally {
      setIsProcessing(false);
    }
  }, [scannedDocs]);

  const exportAsImages = useCallback(async () => {
    if (!scannedDocs.length) return;
    setIsProcessing(true);
    try {
      await downloadImagesAsZip(scannedDocs, `scan_${new Date().toISOString().slice(0, 10)}`);
    } catch (err) {
      logger.error('Erreur images:', err);
      alert('Erreur téléchargement');
    } finally {
      setIsProcessing(false);
    }
  }, [scannedDocs]);

  const saveToCloud = useCallback(() => {
    if (scannedDocs.length && onSave) onSave(scannedDocs);
  }, [scannedDocs, onSave]);

  const handleExport = useCallback(async () => {
    switch (exportFormat) {
      case 'pdf':    await exportAsPdf();    break;
      case 'images': await exportAsImages(); break;
      case 'cloud':  saveToCloud();          break;
      default:       await exportAsPdf();
    }
  }, [exportFormat, exportAsPdf, exportAsImages, saveToCloud]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDUS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderIdleView = () => (
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
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-video"
        onLoadedMetadata={recomputeVideoDims}
      />
      <canvas
        ref={overlayCanvasRef}
        className="camera-overlay-canvas"
        style={
          videoDims
            ? {
                position: 'absolute',
                left:   videoDims.left,
                top:    videoDims.top,
                width:  videoDims.w,
                height: videoDims.h,
              }
            : undefined
        }
      />
      {!detectionActive && <div className="guide-frame" />}

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

      {detectionActive && (
        <div className={`detection-indicator${detectionStable ? ' stable' : ''}`}>
          <CheckCircleIcon style={{ width: 18, height: 18 }} />
          {detectionStable ? 'Document prêt' : 'Document détecté'}
        </div>
      )}
    </>
  );

  const renderProcessingView = () => (
    <div className="scanning-view">
      <div className="scan-line" style={{ top: `${scanProgress}%` }} />
      <div className="scanning-text">Aplanissement...</div>
    </div>
  );

  const renderAdjustView = () => {
    const hasStage = !!stageDims;
    const ol = stageDims
      ? { left: stageDims.left, top: stageDims.top, width: stageDims.w, height: stageDims.h }
      : null;

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
        <img
          ref={previewCanvasRef}
          src={originalImage}
          alt="Document"
          className="adjust-image"
          onLoad={recomputeStage}
        />

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
                  <polygon
                    points={corners.map((c) => `${c.x},${c.y}`).join(' ')}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0" y="0" width="100" height="100"
                fill="rgba(0,0,0,0.55)"
                mask="url(#docMask)"
              />
              <polygon
                points={corners.map((c) => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke="#b87333"
                strokeWidth="0.6"
                strokeLinejoin="round"
              />
            </svg>

            {corners.map((corner, idx) => (
              <div
                key={idx}
                className="corner-handle"
                style={{
                  left: stageDims.left + (corner.x / 100) * stageDims.w,
                  top:  stageDims.top  + (corner.y / 100) * stageDims.h,
                }}
                onMouseDown={(e) => handleCornerMouseDown(idx, e)}
                onTouchStart={(e) => handleCornerTouchStart(idx, e)}
              />
            ))}
          </>
        )}

        {draggedCorner !== null && corners && originalImage && (
          <div style={{
            position: 'absolute', top: 20, left: '50%',
            transform: 'translateX(-50%)',
            width: 100, height: 100,
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
              width: 16, height: 16,
              border: '2px solid #b87333', borderRadius: '50%',
            }} />
          </div>
        )}

        <div className="adjust-hint">Ajustez les coins du document</div>
      </div>
    );
  };

  const renderPreviewView = () => (
    <img
      src={currentDoc.url}
      alt="Document scanné"
      className="document-preview"
    />
  );

  const renderFilterBar = () => (
    <div className="enhance-mode-bar">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          className={`filter-btn${enhanceMode === f.id ? ' active' : ''}`}
          onClick={() => applyFilter(f.id)}
          disabled={isProcessing}
        >
          <span className="filter-icon">{f.icon}</span>
          <span>{f.label}</span>
        </button>
      ))}
    </div>
  );

  const renderGallery = () => (
    <div className="docs-gallery">
      {scannedDocs.map((doc) => (
        <div key={doc.id} className="doc-thumbnail">
          <img src={doc.url} alt="Document" />
          <button className="doc-remove" onClick={() => removeDocument(doc.id)}>
            ×
          </button>
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
        {scannedDocs.length} document{scannedDocs.length > 1 ? 's' : ''} prêt
        {scannedDocs.length > 1 ? 's' : ''}
      </h3>

      <div className="export-options">
        {[
          { id: 'pdf',    icon: '📄', title: 'PDF',        desc: 'Un seul fichier multi-pages' },
          { id: 'images', icon: '🖼️', title: 'Images JPG', desc: `${scannedDocs.length} fichier${scannedDocs.length > 1 ? 's' : ''} séparé${scannedDocs.length > 1 ? 's' : ''}` },
          ...(onSave ? [{ id: 'cloud', icon: '☁️', title: 'Sauvegarder', desc: 'Dans vos documents' }] : []),
        ].map((opt) => (
          <div
            key={opt.id}
            className={`export-option${exportFormat === opt.id ? ' selected' : ''}`}
            onClick={() => setExportFormat(opt.id)}
          >
            <span className="option-icon">{opt.icon}</span>
            <div className="option-info">
              <div className="option-title">{opt.title}</div>
              <div className="option-desc">{opt.desc}</div>
            </div>
            <div className="option-check">{exportFormat === opt.id ? '✓' : ''}</div>
          </div>
        ))}
      </div>

      <div className="export-actions">
        <button
          className="scanner-btn"
          onClick={() => startCamera()}
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
      {/* ── Mode camera ── */}
      {mode === 'camera' && stream && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          {scannedDocs.length > 0 && (
            <button
              className="scanner-btn success"
              onClick={() => { stopCamera(); setMode('export'); }}
            >
              <CheckCircleIcon style={{ width: 18, height: 18 }} />
              Terminer ({scannedDocs.length})
            </button>
          )}

          {/* Bouton capture avec anneau de progression auto-capture */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {autoCapturing && (
              <svg
                style={{ position: 'absolute', width: 80, height: 80, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
                viewBox="0 0 80 80"
              >
                <circle cx="40" cy="40" r="36" fill="none" stroke="#b87333" strokeWidth="4" strokeOpacity="0.3" />
                <circle
                  cx="40" cy="40" r="36" fill="none" stroke="#b87333" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - autoProgress / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.05s linear' }}
                />
              </svg>
            )}
            <button
              className="capture-button"
              onClick={capturePhoto}
              disabled={isProcessing}
              title={autoCapturing ? 'Capture auto dans 1.6s — cliquez pour forcer' : 'Capturer'}
            />
          </div>
        </div>
      )}

      {/* ── Mode adjust ── */}
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

      {/* ── Mode preview ── */}
      {mode === 'preview' && currentDoc && (
        <>
          {isProcessingOCR && (
            <div style={{ fontSize: 12, color: '#b87333', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              OCR {ocrProgress}%
            </div>
          )}
          {!isProcessingOCR && currentDoc.ocrText && (
            <div
              style={{ fontSize: 12, color: '#10b981' }}
              title={`${currentDoc.ocrText.length} caractères reconnus`}
            >
              Texte reconnu
            </div>
          )}
          {!isProcessingOCR && currentDoc.ocrAttempted && !currentDoc.ocrText && (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {currentDoc.ocrError ? 'OCR indisponible' : 'Aucun texte'}
            </div>
          )}

          <button className="scanner-btn" onClick={rotateImage} disabled={isProcessing}>
            <RotateCwIcon style={{ width: 18, height: 18 }} />
          </button>

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

      {/* ── Mode idle avec docs ── */}
      {mode === 'idle' && scannedDocs.length > 0 && (
        <button className="scanner-btn primary" onClick={() => setMode('export')}>
          <DownloadIcon style={{ width: 18, height: 18 }} />
          Exporter ({scannedDocs.length})
        </button>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="scanner-container">
      {/* ── Header ── */}
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

      {/* ── Vue principale ── */}
      <div className="camera-view">
        {mode === 'idle'       && renderIdleView()}
        {mode === 'camera'     && stream && renderCameraView()}
        {mode === 'processing' && renderProcessingView()}
        {mode === 'adjust'     && originalImage && corners && renderAdjustView()}
        {mode === 'preview'    && currentDoc && renderPreviewView()}
        {mode === 'export'     && renderExportView()}

        {isProcessing && mode !== 'export' && (
          <div className="processing-overlay">Traitement...</div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* ── Contrôles ── */}
      {mode !== 'export' && (
        <div className="scanner-controls">
          {scannedDocs.length > 0 &&
            mode !== 'preview' &&
            mode !== 'adjust' &&
            mode !== 'processing' &&
            renderGallery()}
          {mode === 'preview' && currentDoc && renderFilterBar()}
          {renderControls()}
        </div>
      )}
    </div>
  );
}
