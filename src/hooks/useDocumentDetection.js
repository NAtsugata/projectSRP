// src/hooks/useDocumentDetection.js
// Détection de documents légère et fluide (style ClearScanner).
// V6 : OpenCV uniquement, détection sur image réduite (~480px), boucle rAF
//      throttlée. Le tracking visuel se fait sur le canvas (overlay). Les coins
//      vivent dans des REFS mises à jour à chaque frame SANS re-render React.
//      Seuls deux booléens d'état (détection active / stable) déclenchent un
//      re-render, et uniquement sur transition → l'UI ne rame plus.
import { useState, useCallback, useRef } from 'react';
import { detectDocumentFast, detectDocumentEdges, isOpenCvReady } from '../utils/documentScanner';
import logger from '../utils/logger';

export const useDocumentDetection = () => {
  // État React MINIMAL : seulement deux booléens, changés sur transition.
  const [detectionActive, setDetectionActive] = useState(false);
  const [detectionStable, setDetectionStable] = useState(false);

  // Refs mises à jour à chaque frame (lues par la capture / auto-capture)
  const liveCornersRef = useRef(null);       // coins lissés en % (ou null)
  const confidenceRef = useRef(0);           // 0 / 82 / 90

  // État de lissage (EMA) et stabilité
  const stableCornerRef = useRef(null);
  const stableFramesRef = useRef(0);
  const outlierCountRef = useRef(0);
  const noDetectionCountRef = useRef(0);
  const rafRef = useRef(null);
  const lastRunRef = useRef(0);
  const runningRef = useRef(false);
  const workCanvasRef = useRef(null);

  // Configuration
  const DETECT_WIDTH = 480;
  const THROTTLE_MS = 90;          // ~11 fps de détection
  const STABILITY_THRESHOLD = 2.0;
  const NO_DETECTION_LIMIT = 4;
  const OUTLIER_THRESHOLD = 22;
  const OUTLIER_MAX = 3;
  const ALPHA_MIN = 0.18;
  const ALPHA_MAX = 0.75;
  const MOVE_FAST = 8;

  // Met à jour les booléens d'état UNIQUEMENT s'ils changent (évite les re-renders)
  const syncState = (active, stable) => {
    setDetectionActive(prev => (prev === active ? prev : active));
    setDetectionStable(prev => (prev === stable ? prev : stable));
  };

  const calcMovement = (a, b) => {
    if (!a || !b) return Infinity;
    let total = 0;
    for (let i = 0; i < 4; i++) total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    return total / 4;
  };

  const drawOverlay = (overlayCanvas, vw, vh, corners, stable) => {
    if (overlayCanvas.width !== vw) overlayCanvas.width = vw;
    if (overlayCanvas.height !== vh) overlayCanvas.height = vh;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, vw, vh);
    if (!corners) return;

    const pts = corners.map(p => ({ x: (p.x / 100) * vw, y: (p.y / 100) * vh }));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = stable ? 'rgba(184, 115, 51, 0.18)' : 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = stable ? '#b87333' : 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = stable ? 5 : 3;
    ctx.stroke();

    const r1 = stable ? 16 : 11;
    const r2 = stable ? 8 : 5;
    pts.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = stable ? '#b87333' : 'rgba(255,255,255,0.85)';
      ctx.arc(p.x, p.y, r1, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(p.x, p.y, r2, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const clearOverlay = (overlayCanvas) => {
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  };

  // Détection statique (capture finale) — qualité maximale, 7 méthodes
  const detectDocument = useCallback(async (file) => {
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
      canvas.getContext('2d').drawImage(img, 0, 0);

      if (isOpenCvReady()) {
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const corners = detectDocumentEdges(imageData);
        if (corners) {
          return { detected: true, corners, contour: corners, confidence: 90, method: 'opencv' };
        }
      }
      return { detected: false, contour: null, corners: null, confidence: 0, method: 'none' };
    } catch (e) {
      logger.error('[Detection] Erreur:', e);
      return { detected: false, contour: null, corners: null };
    }
  }, []);

  // Boucle de détection live via requestAnimationFrame (throttlée)
  const startLiveDetection = useCallback((videoRef, overlayCanvasRef) => {
    stableCornerRef.current = null;
    stableFramesRef.current = 0;
    outlierCountRef.current = 0;
    noDetectionCountRef.current = 0;
    liveCornersRef.current = null;
    confidenceRef.current = 0;
    runningRef.current = true;

    if (!workCanvasRef.current) workCanvasRef.current = document.createElement('canvas');

    const tick = (ts) => {
      if (!runningRef.current) return;
      rafRef.current = requestAnimationFrame(tick);

      if (ts - lastRunRef.current < THROTTLE_MS) return;
      lastRunRef.current = ts;

      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      if (!video || !overlay || video.readyState < 2 || !isOpenCvReady()) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      try {
        const scale = DETECT_WIDTH / vw;
        const dw = DETECT_WIDTH;
        const dh = Math.round(vh * scale);

        const work = workCanvasRef.current;
        work.width = dw;
        work.height = dh;
        const wctx = work.getContext('2d', { willReadFrequently: true });
        wctx.drawImage(video, 0, 0, dw, dh);
        const imageData = wctx.getImageData(0, 0, dw, dh);

        const raw = detectDocumentFast(imageData);

        // --- Absence de détection ---
        if (!raw || raw.length !== 4) {
          noDetectionCountRef.current++;
          if (noDetectionCountRef.current < NO_DETECTION_LIMIT && stableCornerRef.current) {
            drawOverlay(overlay, vw, vh, stableCornerRef.current, stableFramesRef.current >= 2);
            return;
          }
          stableCornerRef.current = null;
          stableFramesRef.current = 0;
          outlierCountRef.current = 0;
          liveCornersRef.current = null;
          confidenceRef.current = 0;
          clearOverlay(overlay);
          syncState(false, false);   // transition → re-render unique
          return;
        }
        noDetectionCountRef.current = 0;

        const detected = raw.map(p => ({ x: (p.x / dw) * 100, y: (p.y / dh) * 100 }));
        const prev = stableCornerRef.current;

        if (!prev) {
          stableCornerRef.current = detected;
          stableFramesRef.current = 0;
          outlierCountRef.current = 0;
          liveCornersRef.current = detected;
          confidenceRef.current = 80;
          drawOverlay(overlay, vw, vh, detected, false);
          syncState(true, false);
          return;
        }

        const maxJump = Math.max(...detected.map((p, i) =>
          Math.hypot(p.x - prev[i].x, p.y - prev[i].y)
        ));
        if (maxJump > OUTLIER_THRESHOLD && outlierCountRef.current < OUTLIER_MAX) {
          outlierCountRef.current++;
          drawOverlay(overlay, vw, vh, prev, stableFramesRef.current >= 2);
          return;
        }
        outlierCountRef.current = 0;

        const movement = calcMovement(detected, prev);
        const t = Math.min(1, movement / MOVE_FAST);
        const alpha = ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * t;
        const smoothed = detected.map((p, i) => ({
          x: prev[i].x + alpha * (p.x - prev[i].x),
          y: prev[i].y + alpha * (p.y - prev[i].y),
        }));

        const displayMove = calcMovement(smoothed, prev);
        stableCornerRef.current = smoothed;
        if (displayMove < STABILITY_THRESHOLD) stableFramesRef.current++;
        else stableFramesRef.current = 0;

        const stable = stableFramesRef.current >= 2;

        // Refs : MAJ chaque frame (zéro re-render)
        liveCornersRef.current = smoothed;
        confidenceRef.current = stable ? 90 : 82;

        // Canvas : tracking visuel fluide chaque frame
        drawOverlay(overlay, vw, vh, smoothed, stable);

        // State React : seulement sur transition active/stable
        syncState(true, stable);
      } catch (err) {
        logger.error('[Detection live] Erreur:', err);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLiveDetection = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stableCornerRef.current = null;
    stableFramesRef.current = 0;
    outlierCountRef.current = 0;
    noDetectionCountRef.current = 0;
    liveCornersRef.current = null;
    confidenceRef.current = 0;
    syncState(false, false);
  }, []);

  return {
    // Booléens d'état (re-render rare, sur transition uniquement)
    detectionActive,
    detectionStable,
    // Refs (lecture instantanée pour capture / auto-capture)
    liveCornersRef,
    confidenceRef,
    // Méthodes
    detectDocument,
    startLiveDetection,
    stopLiveDetection,
  };
};

export default useDocumentDetection;
