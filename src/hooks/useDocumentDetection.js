// src/hooks/useDocumentDetection.js
// Hook pour la détection de documents avec OpenCV.js
// Fonctionne entièrement dans le navigateur

import { useState, useCallback, useRef, useEffect } from 'react';
import { detectDocument, preloadOpenCV, isOpenCVLoaded } from '../utils/jscanifyDetector';
import logger from '../utils/logger';

/**
 * Hook pour gérer la détection de documents
 *
 * @param {Object} options - Options de configuration
 * @returns {Object} - API de détection et état
 */
export const useDocumentDetection = (options = {}) => {
  const {
    outputWidth = 595,
    outputHeight = 842,
    preload = true
  } = options;

  const [liveCorners, setLiveCorners] = useState(null);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectorType, setDetectorType] = useState('opencv');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const detectionHistoryRef = useRef([]);
  const detectionIntervalRef = useRef(null);
  const isDetectingRef = useRef(false);

  // Précharger OpenCV au montage
  useEffect(() => {
    if (preload && !isReady && !isLoading) {
      setIsLoading(true);
      setLoadError(null);

      preloadOpenCV()
        .then((success) => {
          setIsReady(success);
          setIsLoading(false);
          if (success) {
            logger.log('[useDocumentDetection] OpenCV.js ready');
          } else {
            setLoadError('Échec du chargement d\'OpenCV.js');
          }
        })
        .catch((error) => {
          setIsLoading(false);
          setLoadError(error.message);
          logger.error('[useDocumentDetection] Load error:', error);
        });
    }
  }, [preload, isReady, isLoading]);

  // Détection de document
  const detectDocumentMethod = useCallback(async (file, extraOptions = {}) => {
    try {
      const result = await detectDocument(file, {
        outputWidth,
        outputHeight,
        ...extraOptions
      });

      return {
        detected: result.detected,
        contour: result.corners,
        corners: result.corners,
        original: result.original,
        preview: result.preview,
        transformed: result.transformed,
        confidence: result.confidence || 0,
        score: result.confidence || 0,
        method: 'opencv',
        processingTime: result.processingTime
      };
    } catch (error) {
      logger.error('[Detection] error:', error);
      return {
        detected: false,
        contour: null,
        corners: null,
        method: 'opencv',
        score: 0,
        error: error.message
      };
    }
  }, [outputWidth, outputHeight]);

  // Démarrer la détection en temps réel sur un flux vidéo
  const startLiveDetection = useCallback((videoRef, overlayCanvasRef, interval = 500) => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    detectionHistoryRef.current = [];

    const detectLive = async () => {
      // Éviter les détections simultanées
      if (isDetectingRef.current) return;

      const video = videoRef.current;
      const overlayCanvas = overlayCanvasRef.current;

      if (!video || !overlayCanvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      if (!isOpenCVLoaded()) {
        return;
      }

      isDetectingRef.current = true;

      try {
        // Réduire la résolution pour la performance (480px = plus rapide)
        const detectionWidth = 480;
        const scaleFactor = video.videoWidth / detectionWidth;
        const detectionHeight = Math.round(video.videoHeight / scaleFactor);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = detectionWidth;
        tempCanvas.height = detectionHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, detectionWidth, detectionHeight);

        const blob = await new Promise(resolve => {
          tempCanvas.toBlob(resolve, 'image/jpeg', 0.7);
        });

        const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
        const result = await detectDocumentMethod(file);

        // Ajouter à l'historique
        detectionHistoryRef.current.push({
          detected: result.detected,
          contour: result.contour,
          timestamp: Date.now()
        });

        if (detectionHistoryRef.current.length > 3) {
          detectionHistoryRef.current.shift();
        }

        // Calculer le taux de succès
        const recentDetections = detectionHistoryRef.current;
        const successCount = recentDetections.filter(d => d.detected && d.contour?.length === 4).length;
        const successRate = successCount / recentDetections.length;

        if (successRate >= 0.66 && result.detected && result.contour?.length === 4) {
          const successfulDetections = recentDetections.filter(d => d.detected && d.contour?.length === 4);
          const smoothedCorners = [];

          for (let i = 0; i < 4; i++) {
            let sumX = 0, sumY = 0;
            successfulDetections.forEach(detection => {
              sumX += detection.contour[i].x;
              sumY += detection.contour[i].y;
            });
            smoothedCorners.push({
              x: (sumX / successfulDetections.length) / detectionWidth * 100,
              y: (sumY / successfulDetections.length) / detectionHeight * 100
            });
          }

          setLiveCorners(smoothedCorners);
          setDetectionConfidence(100);

          // Dessiner l'overlay
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
          const overlayCtx = overlayCanvas.getContext('2d');
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

          const cornersInPixels = smoothedCorners.map(corner => ({
            x: (corner.x / 100) * video.videoWidth,
            y: (corner.y / 100) * video.videoHeight
          }));

          // Polygone vert
          overlayCtx.strokeStyle = '#10b981';
          overlayCtx.lineWidth = 4;
          overlayCtx.shadowColor = '#10b981';
          overlayCtx.shadowBlur = 15;
          overlayCtx.beginPath();
          overlayCtx.moveTo(cornersInPixels[0].x, cornersInPixels[0].y);
          for (let i = 1; i < cornersInPixels.length; i++) {
            overlayCtx.lineTo(cornersInPixels[i].x, cornersInPixels[i].y);
          }
          overlayCtx.closePath();
          overlayCtx.stroke();

          // Points aux coins
          cornersInPixels.forEach(corner => {
            overlayCtx.fillStyle = '#10b981';
            overlayCtx.shadowBlur = 10;
            overlayCtx.beginPath();
            overlayCtx.arc(corner.x, corner.y, 10, 0, Math.PI * 2);
            overlayCtx.fill();
            overlayCtx.strokeStyle = '#ffffff';
            overlayCtx.lineWidth = 2;
            overlayCtx.stroke();
          });
        } else {
          setLiveCorners(null);
          setDetectionConfidence(Math.round(successRate * 100));
          if (overlayCanvas.getContext) {
            const overlayCtx = overlayCanvas.getContext('2d');
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }
        }
      } catch (error) {
        logger.error('[LIVE DETECTION] Error:', error);
      } finally {
        isDetectingRef.current = false;
      }
    };

    detectionIntervalRef.current = setInterval(detectLive, interval);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [detectDocumentMethod]);

  // Arrêter la détection en temps réel
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

  // Réinitialiser l'état
  const resetDetection = useCallback(() => {
    stopLiveDetection();
  }, [stopLiveDetection]);

  return {
    // État
    detectorType,
    yoloModelLoaded: false, // Compatibilité - toujours false maintenant
    isReady,
    isLoading,
    loadError,
    liveCorners,
    detectionConfidence,
    lastDetectionMethod: 'opencv',

    // Actions
    setDetectorType, // Compatibilité - garde juste l'état
    detectDocument: detectDocumentMethod,
    startLiveDetection,
    stopLiveDetection,
    resetDetection,
    preloadOpenCV
  };
};

export default useDocumentDetection;
