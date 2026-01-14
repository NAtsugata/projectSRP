// src/hooks/useDocumentDetection.js
// Hook corrigé - utilise ImageData directement au lieu de File (plus rapide)
import { useState, useCallback, useRef } from 'react';
import { detectDocumentEdges, isOpenCvReady } from '../utils/documentScanner';
import logger from '../utils/logger';

export const useDocumentDetection = (options = {}) => {
  const [liveCorners, setLiveCorners] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectorType, setDetectorType] = useState('opencv');

  // Historique pour lisser les mouvements (évite le sautillement du cadre vert)
  const detectionHistoryRef = useRef([]);
  const detectionIntervalRef = useRef(null);
  const isDetectingRef = useRef(false);

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

  // Démarrer la détection en temps réel (Flux Vidéo)
  const startLiveDetection = useCallback((videoRef, overlayCanvasRef, interval = 150) => {
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    detectionHistoryRef.current = [];

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
        // On travaille sur une image réduite (max 500px) pour la performance
        const processWidth = 500;
        const scale = video.videoWidth / processWidth;
        const processHeight = Math.round(video.videoHeight / scale);

        // 3. Extraction des pixels (ImageData) - DIRECT, pas de File
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = processWidth;
        tempCanvas.height = processHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, processWidth, processHeight);

        const imageData = ctx.getImageData(0, 0, processWidth, processHeight);

        // 4. Détection OpenCV (appel synchrone direct)
        const rawCorners = detectDocumentEdges(imageData);

        if (!rawCorners || rawCorners.length !== 4) {
          // Pas de document détecté
          setLiveCorners(null);
          setDetectionConfidence(0);
          // Clear overlay
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
          overlayCanvas.getContext('2d').clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          return;
        }

        // 5. Normalisation des coins (en pourcentage 0-100)
        const normalizedCorners = rawCorners.map(p => ({
          x: (p.x / processWidth) * 100,
          y: (p.y / processHeight) * 100
        }));

        // 6. Logique de lissage - ajouter à l'historique
        detectionHistoryRef.current.push(normalizedCorners);
        if (detectionHistoryRef.current.length > 4) detectionHistoryRef.current.shift();

        // Calculer la moyenne pour lisser
        const smoothedCorners = [];
        for (let i = 0; i < 4; i++) {
          let sumX = 0, sumY = 0;
          detectionHistoryRef.current.forEach(corners => {
            sumX += corners[i].x;
            sumY += corners[i].y;
          });
          smoothedCorners.push({
            x: sumX / detectionHistoryRef.current.length,
            y: sumY / detectionHistoryRef.current.length
          });
        }

        setLiveCorners(smoothedCorners);
        setDetectionConfidence(80);

        // 7. Dessin de l'overlay (Cadre Vert)
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
        const overlayCtx = overlayCanvas.getContext('2d');
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Conversion % -> Pixels réels pour l'affichage
        const displayCorners = smoothedCorners.map(p => ({
          x: (p.x / 100) * overlayCanvas.width,
          y: (p.y / 100) * overlayCanvas.height
        }));

        // Dessiner le polygone
        overlayCtx.beginPath();
        overlayCtx.strokeStyle = '#10b981';
        overlayCtx.lineWidth = 4;
        overlayCtx.shadowColor = '#10b981';
        overlayCtx.shadowBlur = 10;
        overlayCtx.moveTo(displayCorners[0].x, displayCorners[0].y);
        for (let i = 1; i < 4; i++) {
          overlayCtx.lineTo(displayCorners[i].x, displayCorners[i].y);
        }
        overlayCtx.closePath();
        overlayCtx.stroke();

        // Dessiner les coins
        overlayCtx.fillStyle = '#10b981';
        displayCorners.forEach(p => {
          overlayCtx.beginPath();
          overlayCtx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
          overlayCtx.fill();
          overlayCtx.strokeStyle = '#ffffff';
          overlayCtx.lineWidth = 2;
          overlayCtx.shadowBlur = 0;
          overlayCtx.stroke();
        });

      } catch (err) {
        logger.error("Erreur détection live:", err);
      } finally {
        isDetectingRef.current = false;
      }
    };

    // Lancer la boucle
    detectionIntervalRef.current = setInterval(detectLive, interval);

    // Fonction de nettoyage
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
