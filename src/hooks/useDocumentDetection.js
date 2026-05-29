// src/hooks/useDocumentDetection.js
// Hook de détection de documents - Support OpenCV + YOLO ONNX Segmentation
// V4: YOLO Segmentation pour obtenir les vrais coins du document
import { useState, useCallback, useRef, useEffect } from 'react';
import { detectDocumentEdges, isOpenCvReady } from '../utils/documentScanner';
import { loadYoloModel, isYoloReady, detectDocumentYolo, isSegmentation } from '../utils/yoloDocumentDetector';
import logger from '../utils/logger';

export const useDocumentDetection = (options = {}) => {
  const { initialDetector = 'yolo' } = options; // YOLO par défaut

  const [liveCorners, setLiveCorners] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectorType, setDetectorType] = useState(initialDetector);
  const [yoloModelLoaded, setYoloModelLoaded] = useState(false);
  const [yoloModelLoading, setYoloModelLoading] = useState(false);
  const [yoloIsSegmentation, setYoloIsSegmentation] = useState(false);

  // État de lissage (EMA) et stabilité
  const detectionHistoryRef = useRef([]); // conservé pour compat (resets)
  const stableCornerRef = useRef(null);   // dernier état lissé
  const stableFramesRef = useRef(0);      // frames consécutives considérées stables
  const outlierCountRef = useRef(0);       // sauts brutaux consécutifs (aberrations)
  const noDetectionCountRef = useRef(0);
  const detectionIntervalRef = useRef(null);
  const isDetectingRef = useRef(false);

  // Configuration de stabilité
  const STABILITY_THRESHOLD = 1.8;  // mouvement moyen (%) sous lequel on est "stable"
  const NO_DETECTION_LIMIT = 5;
  const OUTLIER_THRESHOLD = 22;     // saut d'un coin (%) -> probable fausse détection
  const OUTLIER_MAX = 3;            // après N sauts consécutifs, on accepte (vrai déplacement)
  const ALPHA_MIN = 0.12;           // lissage fort quand le document est immobile
  const ALPHA_MAX = 0.7;            // suivi rapide quand le document bouge
  const MOVE_FAST = 8;              // mouvement (%) au-delà duquel alpha = ALPHA_MAX

  // Charger le modèle YOLO au montage (toujours)
  useEffect(() => {
    let cancelled = false;

    // Toujours charger YOLO
    if (!isYoloReady()) {
      setYoloModelLoading(true);
      loadYoloModel().then((loaded) => {
        if (cancelled) return;
        setYoloModelLoaded(loaded);
        setYoloModelLoading(false);
        if (loaded) {
          const isSeg = isSegmentation();
          setYoloIsSegmentation(isSeg);
          logger.log(`[Detection] YOLO chargé - ${isSeg ? 'SEGMENTATION' : 'DETECTION'}`);
        } else {
          logger.warn('[Detection] YOLO non disponible, fallback OpenCV');
        }
      });
    } else {
      setYoloModelLoaded(true);
    }

    return () => { cancelled = true; };
  }, []);

  // Détection sur un fichier (capture finale) - OpenCV prioritaire, YOLO en fallback
  const detectDocument = useCallback(async (file) => {
    // Charger l'image
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
      image.src = objectUrl;
    });

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // OpenCV en premier: 7 méthodes robustes, pas de modèle requis
      if (isOpenCvReady()) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const corners = detectDocumentEdges(imageData);
        if (corners) {
          logger.log('[Detection] OpenCV (primaire) - coins trouvés');
          return {
            detected: true,
            corners,
            contour: corners,
            confidence: 90,
            method: 'opencv'
          };
        }
      }

      // Fallback YOLO si OpenCV n'a rien trouvé
      if (isYoloReady()) {
        const yoloResult = await detectDocumentYolo(img, { confThreshold: 0.15 });
        if (yoloResult?.corners) {
          logger.log(`[Detection] YOLO fallback: ${yoloResult.method} - confiance ${yoloResult.confidence}%`);
          return {
            detected: true,
            corners: yoloResult.corners,
            contour: yoloResult.corners,
            confidence: yoloResult.confidence,
            method: yoloResult.method
          };
        }
      }

      return {
        detected: false,
        contour: null,
        corners: null,
        confidence: 0,
        method: 'none'
      };
    } catch (e) {
      logger.error('[Detection] Erreur:', e);
      return { detected: false, contour: null, corners: null };
    }
  }, []);

  // Détection live sur flux vidéo
  const startLiveDetection = useCallback((videoRef, overlayCanvasRef, interval = 150) => {
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    detectionHistoryRef.current = [];
    stableCornerRef.current = null;
    stableFramesRef.current = 0;
    outlierCountRef.current = 0;
    noDetectionCountRef.current = 0;

    // OpenCV est primaire: 150ms toujours
    const actualInterval = Math.max(interval, 150);

    const detectLive = async () => {
      if (isDetectingRef.current) return;
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      if (!video || !overlayCanvas || video.readyState < 2) return;

      if (!isOpenCvReady() && !isYoloReady()) return;

      isDetectingRef.current = true;

      try {
        // Résolution maximale pour meilleure détection (Full HD)
        const processWidth = Math.min(1920, video.videoWidth);
        const scale = video.videoWidth / processWidth;
        const processHeight = Math.round(video.videoHeight / scale);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = processWidth;
        tempCanvas.height = processHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, processWidth, processHeight);

        let rawCorners = null;

        // OpenCV en premier: 7 méthodes robustes, résultat immédiat
        if (isOpenCvReady()) {
          const imageData = ctx.getImageData(0, 0, processWidth, processHeight);
          rawCorners = detectDocumentEdges(imageData);
        }

        // YOLO en fallback uniquement si OpenCV n'a rien trouvé
        if (!rawCorners && isYoloReady()) {
          const yoloResult = await detectDocumentYolo(tempCanvas, { confThreshold: 0.15 });
          if (yoloResult?.corners) {
            rawCorners = yoloResult.corners;
            logger.log(`[Detection Live] YOLO fallback: ${yoloResult.method}`);
          }
        }

        // Gestion absence de détection
        if (!rawCorners || rawCorners.length !== 4) {
          noDetectionCountRef.current++;

          if (noDetectionCountRef.current < NO_DETECTION_LIMIT && stableCornerRef.current) {
            setLiveCorners(stableCornerRef.current);
            drawOverlay(overlayCanvas, video, stableCornerRef.current);
            isDetectingRef.current = false;
            return;
          }

          setLiveCorners(null);
          setDetectionConfidence(0);
          stableCornerRef.current = null;
          stableFramesRef.current = 0;
          outlierCountRef.current = 0;
          detectionHistoryRef.current = [];
          overlayCanvas.getContext('2d').clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          isDetectingRef.current = false;
          return;
        }

        noDetectionCountRef.current = 0;

        // Normalisation des coins (en pourcentage 0-100)
        const detected = rawCorners.map(p => ({
          x: (p.x / processWidth) * 100,
          y: (p.y / processHeight) * 100
        }));

        const prev = stableCornerRef.current;

        // Premier verrou: pas encore d'état lissé -> initialisation directe
        if (!prev) {
          stableCornerRef.current = detected;
          stableFramesRef.current = 0;
          outlierCountRef.current = 0;
          setLiveCorners(detected);
          setDetectionConfidence(80);
          drawOverlay(overlayCanvas, video, detected);
          isDetectingRef.current = false;
          return;
        }

        // Rejet d'aberration: un coin qui saute brutalement = fausse détection isolée.
        // On l'ignore... sauf si ça persiste (le document a vraiment bougé d'un coup).
        const maxJump = Math.max(...detected.map((p, i) => {
          const dx = p.x - prev[i].x;
          const dy = p.y - prev[i].y;
          return Math.sqrt(dx * dx + dy * dy);
        }));

        if (maxJump > OUTLIER_THRESHOLD && outlierCountRef.current < OUTLIER_MAX) {
          outlierCountRef.current += 1;
          setLiveCorners(prev);
          drawOverlay(overlayCanvas, video, prev);
          isDetectingRef.current = false;
          return;
        }
        outlierCountRef.current = 0;

        // Mouvement moyen pour piloter le facteur de lissage
        const movement = calculateMovement(detected, prev);

        // Alpha adaptatif: lissage fort si immobile, suivi rapide si grand mouvement
        const t = Math.min(1, movement / MOVE_FAST);
        const alpha = ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * t;

        // Lissage exponentiel (EMA) coin par coin
        const smoothed = detected.map((p, i) => ({
          x: prev[i].x + alpha * (p.x - prev[i].x),
          y: prev[i].y + alpha * (p.y - prev[i].y)
        }));

        // Stabilité mesurée sur le cadre lissé affiché (pas sur le bruit brut),
        // pour que la confiance reste fiable quand le document est immobile.
        const displayMovement = calculateMovement(smoothed, prev);
        stableCornerRef.current = smoothed;

        if (displayMovement < STABILITY_THRESHOLD) {
          stableFramesRef.current += 1;
        } else {
          stableFramesRef.current = 0;
        }
        const confidence = stableFramesRef.current >= 2 ? 90 : 82;

        setLiveCorners(smoothed);
        setDetectionConfidence(confidence);
        drawOverlay(overlayCanvas, video, smoothed);

      } catch (err) {
        logger.error("Erreur détection live:", err);
      } finally {
        isDetectingRef.current = false;
      }
    };

    // Fonction pour dessiner l'overlay
    const drawOverlay = (overlayCanvas, video, corners) => {
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;
      const overlayCtx = overlayCanvas.getContext('2d');
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      const displayCorners = corners.map(p => ({
        x: (p.x / 100) * overlayCanvas.width,
        y: (p.y / 100) * overlayCanvas.height
      }));

      overlayCtx.beginPath();
      overlayCtx.strokeStyle = '#b87333';
      overlayCtx.lineWidth = 4;
      overlayCtx.shadowColor = '#b87333';
      overlayCtx.shadowBlur = 20;
      overlayCtx.moveTo(displayCorners[0].x, displayCorners[0].y);
      for (let i = 1; i < 4; i++) {
        overlayCtx.lineTo(displayCorners[i].x, displayCorners[i].y);
      }
      overlayCtx.closePath();
      overlayCtx.stroke();

      overlayCtx.shadowBlur = 0;
      displayCorners.forEach(p => {
        overlayCtx.beginPath();
        overlayCtx.fillStyle = '#b87333';
        overlayCtx.arc(p.x, p.y, 14, 0, 2 * Math.PI);
        overlayCtx.fill();
        overlayCtx.beginPath();
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.arc(p.x, p.y, 7, 0, 2 * Math.PI);
        overlayCtx.fill();
      });
    };

    detectionIntervalRef.current = setInterval(detectLive, actualInterval);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      setLiveCorners(null);
    };
  }, []);

  // Calcule la distance moyenne entre deux sets de coins
  const calculateMovement = (corners1, corners2) => {
    if (!corners1 || !corners2) return Infinity;
    let totalDist = 0;
    for (let i = 0; i < 4; i++) {
      const dx = corners1[i].x - corners2[i].x;
      const dy = corners1[i].y - corners2[i].y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    return totalDist / 4;
  };

  const stopLiveDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    isDetectingRef.current = false;
    detectionHistoryRef.current = [];
    stableCornerRef.current = null;
    stableFramesRef.current = 0;
    outlierCountRef.current = 0;
    noDetectionCountRef.current = 0;
    setLiveCorners(null);
    setDetectionConfidence(0);
  }, []);

  return {
    detectorType,
    yoloModelLoaded,
    yoloModelLoading,
    yoloIsSegmentation,
    liveCorners,
    detectionConfidence,
    setDetectorType,
    detectDocument,
    startLiveDetection,
    stopLiveDetection
  };
};

export default useDocumentDetection;
