// src/utils/jscanifyDetector.js
import logger from './logger';

// Utilisation d'un CDN rapide (jsdelivr) au lieu de docs.opencv.org
const OPENCV_CDN = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.2/dist/opencv.min.js';
const OPENCV_SCRIPT_ID = 'opencv-js-script';

let opencvLoadingPromise = null;
let jscanifyInstance = null;

/**
 * Vérifie si OpenCV est chargé et prêt à l'emploi
 */
export const isOpenCVLoaded = () => {
  return !!(window.cv && window.cv.Mat && typeof window.cv.Mat === 'function');
};

/**
 * Charge OpenCV.js de manière robuste
 */
export const preloadOpenCV = () => {
  // 1. Si déjà chargé, on renvoie true immédiatement
  if (isOpenCVLoaded()) {
    return Promise.resolve(true);
  }

  // 2. Si un chargement est déjà en cours, on renvoie la promesse existante
  if (opencvLoadingPromise) {
    return opencvLoadingPromise;
  }

  // 3. Sinon, on lance le chargement
  opencvLoadingPromise = new Promise((resolve, reject) => {
    logger.log('[OpenCV] Initialisation du chargement...');

    // Timeout de sécurité (20 secondes)
    const timeoutId = setTimeout(() => {
      logger.error('[OpenCV] Timeout du chargement');
      reject(new Error('OpenCV load timeout'));
    }, 20000);

    // Préparation de l'objet Module AVANT de charger le script
    window.Module = {
      onRuntimeInitialized: () => {
        clearTimeout(timeoutId);
        logger.log('[OpenCV] Runtime Initialized !');
        resolve(true);
      },
      onAbort: (err) => {
        clearTimeout(timeoutId);
        logger.error('[OpenCV] Module Abort:', err);
        reject(err);
      }
    };

    // Vérification si le script existe déjà (cas de rechargement rapide)
    let script = document.getElementById(OPENCV_SCRIPT_ID);

    if (!script) {
      script = document.createElement('script');
      script.id = OPENCV_SCRIPT_ID;
      script.src = OPENCV_CDN;
      script.async = true;

      script.onerror = (e) => {
        clearTimeout(timeoutId);
        logger.error('[OpenCV] Script Load Error', e);
        reject(new Error('Failed to load OpenCV script'));
      };

      document.body.appendChild(script);
    } else {
      // Si le script est déjà là mais que cv n'est pas prêt,
      // on attend juste que onRuntimeInitialized se déclenche via window.Module
      logger.log('[OpenCV] Script déjà présent dans le DOM');
    }
  });

  return opencvLoadingPromise;
};

/**
 * Classe Scanner interne
 */
class Scanner {
  constructor() {
    this.cv = window.cv;
  }

  findPaperContour(img) {
    const cv = this.cv;
    const gray = new cv.Mat();

    try {
      cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);

      const blurred = new cv.Mat();
      const kSize = new cv.Size(5, 5);
      cv.GaussianBlur(gray, blurred, kSize, 0);

      const edges = new cv.Mat();
      cv.Canny(blurred, edges, 75, 200);

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0;
      let bestContour = null;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        // Filtre de taille minimale (pour éviter le bruit)
        if (area > 1000) {
          const peri = cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.02 * peri, true);

          if (area > maxArea && approx.rows === 4) {
            maxArea = area;
            if (bestContour) bestContour.delete();
            bestContour = approx.clone();
          }
          approx.delete();
        }
      }

      // Nettoyage
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();

      return bestContour;
    } catch (e) {
      logger.error('Error finding contour', e);
      return null;
    } finally {
      gray.delete();
    }
  }

  getCornerPoints(contour) {
    if (!contour) return null;
    const points = [];
    for (let i = 0; i < 4; i++) {
      points.push({
        x: contour.data32S[i * 2],
        y: contour.data32S[i * 2 + 1]
      });
    }
    return points;
  }

  extractPaper(img, resultWidth, resultHeight) {
    const cv = this.cv;
    const contour = this.findPaperContour(img);

    if (!contour) return null;

    const corners = this.getCornerPoints(contour);
    const orderedCorners = orderCorners(corners);

    const srcCoords = [
      orderedCorners[0].x, orderedCorners[0].y,
      orderedCorners[1].x, orderedCorners[1].y,
      orderedCorners[2].x, orderedCorners[2].y,
      orderedCorners[3].x, orderedCorners[3].y
    ];

    const dstCoords = [
      0, 0,
      resultWidth, 0,
      resultWidth, resultHeight,
      0, resultHeight
    ];

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, srcCoords);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, dstCoords);

    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const result = new cv.Mat();
    const dsize = new cv.Size(resultWidth, resultHeight);

    cv.warpPerspective(img, result, M, dsize);

    // Nettoyage
    srcTri.delete();
    dstTri.delete();
    M.delete();
    contour.delete();

    return { result, corners: orderedCorners };
  }
}

/**
 * Fonction principale de détection
 */
export const detectDocument = async (input, options = {}) => {
  const {
    outputWidth = 595,
    outputHeight = 842
  } = options;

  try {
    // 1. S'assurer qu'OpenCV est chargé
    if (!isOpenCVLoaded()) {
      await preloadOpenCV();
    }

    if (!jscanifyInstance) {
      jscanifyInstance = new Scanner();
    }

    const cv = window.cv;
    let imgMat;

    // Chargement de l'image en Matrice OpenCV
    if (input instanceof HTMLImageElement || input instanceof HTMLCanvasElement) {
      imgMat = cv.imread(input);
    } else if (input instanceof File || input instanceof Blob) {
      const bmp = await createImageBitmap(input);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bmp.width;
      tempCanvas.height = bmp.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      imgMat = cv.imread(tempCanvas);
    } else {
      throw new Error("Format d'entrée non supporté");
    }

    const startTime = performance.now();

    // 2. Extraction
    const extraction = jscanifyInstance.extractPaper(imgMat, outputWidth, outputHeight);

    const elapsed = performance.now() - startTime;

    // 3. Préparation du résultat
    if (extraction) {
      const resultCanvas = document.createElement('canvas');
      cv.imshow(resultCanvas, extraction.result);

      const originalCanvas = document.createElement('canvas');
      cv.imshow(originalCanvas, imgMat);

      // Création preview avec contours
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = imgMat.cols;
      previewCanvas.height = imgMat.rows;
      cv.imshow(previewCanvas, imgMat);
      const ctx = previewCanvas.getContext('2d');
      drawCornersOnContext(ctx, extraction.corners);

      const result = {
        detected: true,
        corners: extraction.corners,
        original: originalCanvas.toDataURL('image/jpeg', 0.8),
        preview: previewCanvas.toDataURL('image/jpeg', 0.8),
        transformed: resultCanvas.toDataURL('image/jpeg', 0.8),
        confidence: 90,
        processingTime: elapsed,
        method: 'opencv-wasm'
      };

      // Nettoyage final des matrices
      extraction.result.delete();
      imgMat.delete();

      return result;
    } else {
      // Pas de document trouvé
      const originalCanvas = document.createElement('canvas');
      cv.imshow(originalCanvas, imgMat);
      imgMat.delete();

      return {
        detected: false,
        original: originalCanvas.toDataURL('image/jpeg', 0.8),
        preview: null,
        transformed: null,
        corners: null,
        confidence: 0,
        processingTime: elapsed,
        method: 'opencv-wasm'
      };
    }

  } catch (error) {
    logger.error('Erreur detection:', error);
    throw error;
  }
};

// --- Utilitaires ---

const orderCorners = (corners) => {
  const cx = corners.reduce((sum, c) => sum + c.x, 0) / 4;
  const cy = corners.reduce((sum, c) => sum + c.y, 0) / 4;

  return corners.slice().sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });
};

const drawCornersOnContext = (ctx, corners) => {
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  corners.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 12, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
  });
};

export default {
  detectDocument,
  preloadOpenCV,
  isOpenCVLoaded
};
