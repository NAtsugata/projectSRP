// src/hooks/useOCR.js
// OCR via Tesseract.js (chargé en lazy pour ne pas alourdir le bundle initial)
import { useState, useCallback, useRef } from 'react';
import logger from '../utils/logger';

export function useOCR() {
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const workerRef = useRef(null);
  const initPromiseRef = useRef(null);

  const _initWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    // Une seule initialisation simultanée possible
    if (!initPromiseRef.current) {
      initPromiseRef.current = (async () => {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker(['fra', 'eng'], 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round((m.progress || 0) * 100));
            }
          }
        });
        workerRef.current = worker;
        logger.log('[OCR] Worker Tesseract initialisé (fra+eng)');
        return worker;
      })();
    }
    return initPromiseRef.current;
  }, []);

  const runOCR = useCallback(async (imageBlob) => {
    setIsProcessingOCR(true);
    setOcrProgress(0);
    try {
      const worker = await _initWorker();
      const { data } = await worker.recognize(imageBlob);
      setOcrProgress(100);
      logger.log(`[OCR] Texte reconnu: ${data.text.length} caractères`);
      return data.text || '';
    } catch (err) {
      logger.error('[OCR] Erreur reconnaissance:', err);
      return '';
    } finally {
      setIsProcessingOCR(false);
    }
  }, [_initWorker]);

  const terminateWorker = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
      initPromiseRef.current = null;
      logger.log('[OCR] Worker terminé');
    }
  }, []);

  return { runOCR, isProcessingOCR, ocrProgress, terminateWorker };
}

export default useOCR;
