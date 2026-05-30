// src/hooks/useDocumentDetection.js
// Détection live de documents style ClearScanner.
// Boucle rAF throttlée, EMA smoothing, overlay canvas.
// Seuls deux booléens d'état React (active / stable) → re-renders minimaux.
import { useState, useCallback, useRef } from 'react';
import { detectDocumentContour, isOpenCvReady } from '../utils/documentScanner';

export const useDocumentDetection = () => {
  const [detectionActive, setDetectionActive] = useState(false);
  const [detectionStable, setDetectionStable] = useState(false);

  // Refs lues à chaque frame (lecture instantanée, zéro re-render)
  const liveCornersRef = useRef(null);
  const confidenceRef  = useRef(0);

  const smoothedRef      = useRef(null);
  const stableCountRef   = useRef(0);
  const missCountRef     = useRef(0);
  const rafRef           = useRef(null);
  const lastTickRef      = useRef(0);
  const runningRef       = useRef(false);
  const workCanvasRef    = useRef(null);

  // Paramètres
  const THROTTLE_MS   = 100;   // ~10 fps de détection
  const DETECT_WIDTH  = 640;   // largeur de travail (réduite pour perf)
  const STABLE_FRAMES = 3;     // sondages stables consécutifs requis
  const MISS_LIMIT    = 5;     // frames sans détection avant reset
  const STABLE_DIST   = 3.0;   // mouvement max (%) pour "stable"
  const ALPHA         = 0.4;   // coefficient EMA

  // Met à jour les booléens UNIQUEMENT sur transition → évite les re-renders
  const syncState = useCallback((active, stable) => {
    setDetectionActive((p) => (p === active ? p : active));
    setDetectionStable((p) => (p === stable ? p : stable));
  }, []);

  const drawOverlay = (canvas, vw, vh, corners, stable) => {
    if (canvas.width  !== vw) canvas.width  = vw;
    if (canvas.height !== vh) canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, vw, vh);
    if (!corners) return;

    const pts = corners.map((p) => ({
      x: (p.x / 100) * vw,
      y: (p.y / 100) * vh,
    }));

    // Zone remplie
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = stable
      ? 'rgba(184,115,51,0.15)'
      : 'rgba(255,255,255,0.05)';
    ctx.fill();

    // Contour
    ctx.strokeStyle = stable ? '#b87333' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth   = stable ? 4 : 2.5;
    ctx.stroke();

    // Poignées de coins (double cercle)
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, stable ? 14 : 9, 0, Math.PI * 2);
      ctx.fillStyle = stable ? '#b87333' : 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, stable ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });
  };

  /**
   * Démarre la boucle de détection live.
   * Doit être appelé avec les refs vidéo et overlay canvas.
   */
  const startLiveDetection = useCallback(
    (videoRef, overlayCanvasRef) => {
      // Reset complet
      smoothedRef.current    = null;
      stableCountRef.current = 0;
      missCountRef.current   = 0;
      liveCornersRef.current = null;
      confidenceRef.current  = 0;
      runningRef.current     = true;

      if (!workCanvasRef.current) {
        workCanvasRef.current = document.createElement('canvas');
      }

      const tick = (ts) => {
        if (!runningRef.current) return;
        rafRef.current = requestAnimationFrame(tick);

        // Throttle
        if (ts - lastTickRef.current < THROTTLE_MS) return;
        lastTickRef.current = ts;

        const video   = videoRef.current;
        const overlay = overlayCanvasRef.current;
        if (!video || !overlay || video.readyState < 2 || !isOpenCvReady()) return;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;

        try {
          // Réduire la résolution pour la détection
          const scale = DETECT_WIDTH / vw;
          const dw    = DETECT_WIDTH;
          const dh    = Math.round(vh * scale);

          const work = workCanvasRef.current;
          work.width  = dw;
          work.height = dh;
          const wctx = work.getContext('2d', { willReadFrequently: true });
          wctx.drawImage(video, 0, 0, dw, dh);
          const imageData = wctx.getImageData(0, 0, dw, dh);

          // Détection OpenCV
          const raw = detectDocumentContour(imageData);

          // ── Pas de détection ────────────────────────────────────────────
          if (!raw || raw.length !== 4) {
            missCountRef.current++;
            if (missCountRef.current >= MISS_LIMIT) {
              smoothedRef.current    = null;
              stableCountRef.current = 0;
              liveCornersRef.current = null;
              confidenceRef.current  = 0;
              if (overlay.width  !== vw) overlay.width  = vw;
              if (overlay.height !== vh) overlay.height = vh;
              overlay.getContext('2d').clearRect(0, 0, vw, vh);
              syncState(false, false);
            }
            return;
          }
          missCountRef.current = 0;

          // Normaliser en % du frame réduit
          const detected = raw.map((p) => ({
            x: (p.x / dw) * 100,
            y: (p.y / dh) * 100,
          }));

          const prev = smoothedRef.current;

          // ── Premier detection ────────────────────────────────────────────
          if (!prev) {
            smoothedRef.current    = detected;
            stableCountRef.current = 0;
            liveCornersRef.current = detected;
            confidenceRef.current  = 80;
            drawOverlay(overlay, vw, vh, detected, false);
            syncState(true, false);
            return;
          }

          // ── EMA smoothing ────────────────────────────────────────────────
          const smoothed = detected.map((p, i) => ({
            x: prev[i].x + ALPHA * (p.x - prev[i].x),
            y: prev[i].y + ALPHA * (p.y - prev[i].y),
          }));

          // Mouvement moyen entre frame lissée et précédente
          const move =
            smoothed.reduce(
              (s, p, i) => s + Math.hypot(p.x - prev[i].x, p.y - prev[i].y),
              0
            ) / 4;

          if (move < STABLE_DIST) {
            stableCountRef.current = Math.min(
              stableCountRef.current + 1,
              STABLE_FRAMES + 2
            );
          } else {
            stableCountRef.current = 0;
          }

          const stable = stableCountRef.current >= STABLE_FRAMES;

          smoothedRef.current    = smoothed;
          liveCornersRef.current = smoothed;
          confidenceRef.current  = stable ? 90 : 82;

          drawOverlay(overlay, vw, vh, smoothed, stable);
          syncState(true, stable);
        } catch (_e) {
          // Erreur silencieuse (frame corrompue, etc.)
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [syncState]
  );

  /**
   * Arrête la boucle de détection et nettoie l'état.
   */
  const stopLiveDetection = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    smoothedRef.current    = null;
    stableCountRef.current = 0;
    missCountRef.current   = 0;
    liveCornersRef.current = null;
    confidenceRef.current  = 0;
    syncState(false, false);
  }, [syncState]);

  /**
   * Détection statique sur un fichier image (pour upload / fallback).
   */
  const detectDocument = useCallback(async (file) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload  = () => { URL.revokeObjectURL(url); res(i); };
        i.onerror = () => { URL.revokeObjectURL(url); rej(new Error('load failed')); };
        i.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);

      if (isOpenCvReady()) {
        const imageData = canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height);
        const corners = detectDocumentContour(imageData);
        if (corners) {
          return {
            detected:   true,
            corners,
            contour:    corners,
            confidence: 90,
            method:     'opencv',
          };
        }
      }
      return {
        detected:   false,
        contour:    null,
        corners:    null,
        confidence: 0,
        method:     'none',
      };
    } catch (e) {
      return { detected: false, contour: null, corners: null };
    }
  }, []);

  return {
    // Booléens d'état (re-render sur transition uniquement)
    detectionActive,
    detectionStable,
    // Refs (lecture instantanée à chaque frame)
    liveCornersRef,
    confidenceRef,
    // Méthodes
    detectDocument,
    startLiveDetection,
    stopLiveDetection,
  };
};

export default useDocumentDetection;
