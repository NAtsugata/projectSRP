// src/hooks/useDocumentDetection.js
// Hook corrigé - utilise ImageData directement au lieu de File (plus rapide)
// V2: Amélioration de la stabilité avec lissage avancé
import { useState, useCallback, useRef } from 'react';
import { detectDocumentEdges, isOpenCvReady } from '../utils/documentScanner';
import logger from '../utils/logger';

export const useDocumentDetection = (options = {}) => {
  const [liveCorners, setLiveCorners] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectorType, setDetectorType] = useState('opencv');

  // Historique pour lisser les mouvements
  const detectionHistoryRef = useRef([]);
  const stableCornerRef = useRef(null);  // Coins stables actuels
  const noDetectionCountRef = useRef(0); // Compteur de frames sans détection
  const detectionIntervalRef = useRef(null);
  const isDetectingRef = useRef(false);

  // Configuration de stabilité
  const HISTORY_SIZE = 6;           // Nombre de frames pour la moyenne
  const STABILITY_THRESHOLD = 3;    // % de mouvement max pour considérer stable
  const NO_DETECTION_LIMIT = 5;     // Frames sans détection avant de reset

  // Détection sur un fichier (utilisé pour la capture finale)
  const detectDocument = useCallback(async (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Appel direct à l'utilitaire OpenCV
        const corners = detectDocumentEdges(imageData);

        URL.revokeObjectURL(img.src);
        resolve({
          detected: corners !== null,
          contour: corners,
          corners: corners
        });
      };
      img.onerror = () => {
        resolve({ detected: false, contour: null, corners: null });
      };
      img.src = URL.createObjectURL(file);
    });
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
    return totalDist / 4; // Distance moyenne en %
  };

  // Démarrer la détection en temps réel (Flux Vidéo)
  const startLiveDetection = useCallback((videoRef, overlayCanvasRef, interval = 150) => {
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    detectionHistoryRef.current = [];
    stableCornerRef.current = null;
    noDetectionCountRef.current = 0;

    const detectLive = () => {
      // 1. Vérifications de sécurité
      if (isDetectingRef.current) return;
      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      if (!video || !overlayCanvas || video.readyState < 2 || !isOpenCvReady()) {
        return;
      }

      isDetectingRef.current = true;

      try {
        // 2. Configuration dimensionnelle
        const processWidth = 500;
        const scale = video.videoWidth / processWidth;
        const processHeight = Math.round(video.videoHeight / scale);

        // 3. Extraction des pixels (ImageData)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = processWidth;
        tempCanvas.height = processHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, processWidth, processHeight);

        const imageData = ctx.getImageData(0, 0, processWidth, processHeight);

        // 4. Détection OpenCV
        const rawCorners = detectDocumentEdges(imageData);

        // 5. Gestion de l'absence de détection
        if (!rawCorners || rawCorners.length !== 4) {
          noDetectionCountRef.current++;

          // Garder les coins stables pendant quelques frames
          if (noDetectionCountRef.current < NO_DETECTION_LIMIT && stableCornerRef.current) {
            // Continuer à afficher les derniers coins stables
            // IMPORTANT: Mettre à jour le state aussi pour la capture
            setLiveCorners(stableCornerRef.current);
            drawOverlay(overlayCanvas, video, stableCornerRef.current);
            isDetectingRef.current = false;
            return;
          }

          // Reset après trop de frames sans détection
          setLiveCorners(null);
          setDetectionConfidence(0);
          stableCornerRef.current = null;
          detectionHistoryRef.current = [];
          overlayCanvas.getContext('2d').clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          isDetectingRef.current = false;
          return;
        }

        // Reset du compteur de non-détection
        noDetectionCountRef.current = 0;

        // 6. Normalisation des coins (en pourcentage 0-100)
        const normalizedCorners = rawCorners.map(p => ({
          x: (p.x / processWidth) * 100,
          y: (p.y / processHeight) * 100
        }));

        // 7. Ajouter à l'historique
        detectionHistoryRef.current.push(normalizedCorners);
        if (detectionHistoryRef.current.length > HISTORY_SIZE) {
          detectionHistoryRef.current.shift();
        }

        // 8. Calculer la moyenne lissée (weighted - récent = plus important)
        const smoothedCorners = [];
        const history = detectionHistoryRef.current;
        const weights = history.map((_, i) => i + 1); // 1, 2, 3, 4, 5, 6
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        for (let i = 0; i < 4; i++) {
          let sumX = 0, sumY = 0;
          history.forEach((corners, idx) => {
            sumX += corners[i].x * weights[idx];
            sumY += corners[i].y * weights[idx];
          });
          smoothedCorners.push({
            x: sumX / totalWeight,
            y: sumY / totalWeight
          });
        }

        // 9. Vérifier la stabilité avant de mettre à jour
        const movement = calculateMovement(smoothedCorners, stableCornerRef.current);

        if (movement < STABILITY_THRESHOLD && stableCornerRef.current) {
          // Mouvement minime - garder les coins stables (évite le tremblement)
          // Toujours mettre à jour le state pour la capture
          setLiveCorners(stableCornerRef.current);
          setDetectionConfidence(90);
          drawOverlay(overlayCanvas, video, stableCornerRef.current);
        } else {
          // Mouvement significatif - mettre à jour
          stableCornerRef.current = smoothedCorners;
          setLiveCorners(smoothedCorners);
          setDetectionConfidence(85);
          drawOverlay(overlayCanvas, video, smoothedCorners);
        }

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

      // Conversion % -> Pixels réels
      const displayCorners = corners.map(p => ({
        x: (p.x / 100) * overlayCanvas.width,
        y: (p.y / 100) * overlayCanvas.height
      }));

      // Dessiner le polygone avec effet glow
      overlayCtx.beginPath();
      overlayCtx.strokeStyle = '#10b981';
      overlayCtx.lineWidth = 3;
      overlayCtx.shadowColor = '#10b981';
      overlayCtx.shadowBlur = 15;
      overlayCtx.moveTo(displayCorners[0].x, displayCorners[0].y);
      for (let i = 1; i < 4; i++) {
        overlayCtx.lineTo(displayCorners[i].x, displayCorners[i].y);
      }
      overlayCtx.closePath();
      overlayCtx.stroke();

      // Dessiner les coins
      overlayCtx.shadowBlur = 0;
      displayCorners.forEach(p => {
        // Cercle extérieur
        overlayCtx.beginPath();
        overlayCtx.fillStyle = '#10b981';
        overlayCtx.arc(p.x, p.y, 12, 0, 2 * Math.PI);
        overlayCtx.fill();
        // Cercle intérieur blanc
        overlayCtx.beginPath();
        overlayCtx.fillStyle = '#ffffff';
        overlayCtx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
        overlayCtx.fill();
      });
    };

    // Lancer la boucle
    detectionIntervalRef.current = setInterval(detectLive, interval);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      setLiveCorners(null);
    };
  }, []);

  const stopLiveDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    isDetectingRef.current = false;
    detectionHistoryRef.current = [];
    stableCornerRef.current = null;
    noDetectionCountRef.current = 0;
    setLiveCorners(null);
    setDetectionConfidence(0);
  }, []);

  return {
    detectorType,
    yoloModelLoaded: true, // Compatibilité UI
    liveCorners,
    detectionConfidence,
    setDetectorType,
    detectDocument,
    startLiveDetection,
    stopLiveDetection
  };
};

export default useDocumentDetection;
