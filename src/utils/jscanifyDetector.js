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
 * Classe Scanner interne - Détection stable avec Downscale + Morphologie
 */
class Scanner {
  constructor() {
    this.cv = window.cv;
  }

  /**
   * Trouve le contour du document - Version stable avec downscale
   */
  findPaperContour(img) {
    const cv = this.cv;

    // Variables pour cleanup
    let smallImg = null, gray = null, blurred = null, edges = null, closed = null;
    let kernel = null, contours = null, hierarchy = null;

    try {
      // 1. DOWNSCALE - Crucial pour la stabilité et la performance
      const maxDim = Math.max(img.cols, img.rows);
      const targetSize = 500;
      const scale = maxDim > targetSize ? targetSize / maxDim : 1;

      smallImg = new cv.Mat();
      if (scale < 1) {
        cv.resize(img, smallImg, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
      } else {
        img.copyTo(smallImg);
      }

      const smallArea = smallImg.rows * smallImg.cols;
      const minAreaThreshold = smallArea * 0.08; // Au moins 8% de l'image réduite

      // 2. Pré-traitement
      gray = new cv.Mat();
      cv.cvtColor(smallImg, gray, cv.COLOR_RGBA2GRAY);

      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      // 3. Canny Edge Detection
      edges = new cv.Mat();
      cv.Canny(blurred, edges, 75, 200);

      // 4. MORPHOLOGIE - Le secret de la stabilité !
      // Fermeture pour reconnecter les bords interrompus
      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      closed = new cv.Mat();
      cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

      // 5. Trouver les contours - RETR_EXTERNAL seulement
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // 6. Trouver le meilleur quadrilatère
      let maxArea = 0;
      let bestContour = null;
      const epsilonFactors = [0.02, 0.03, 0.04];

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area < minAreaThreshold) continue;

        const peri = cv.arcLength(contour, true);

        for (const epsFactor of epsilonFactors) {
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, epsFactor * peri, true);

          if (approx.rows === 4 && area > maxArea && cv.isContourConvex(approx)) {
            maxArea = area;
            if (bestContour) bestContour.delete();
            // IMPORTANT: Remettre à l'échelle originale
            bestContour = this.scaleContour(approx, 1 / scale);
          }
          approx.delete();

          if (bestContour && maxArea === area) break;
        }
      }

      // Cleanup
      smallImg.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      closed.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();

      return bestContour;

    } catch (e) {
      logger.error('Detection error:', e);
      // Cleanup on error
      if (smallImg) smallImg.delete();
      if (gray) gray.delete();
      if (blurred) blurred.delete();
      if (edges) edges.delete();
      if (closed) closed.delete();
      if (kernel) kernel.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
      return null;
    }
  }

  /**
   * Remet le contour à l'échelle originale
   */
  scaleContour(contour, scaleFactor) {
    const cv = this.cv;
    const scaled = new cv.Mat(4, 1, cv.CV_32SC2);

    for (let i = 0; i < 4; i++) {
      const x = Math.round(contour.data32S[i * 2] * scaleFactor);
      const y = Math.round(contour.data32S[i * 2 + 1] * scaleFactor);
      scaled.data32S[i * 2] = x;
      scaled.data32S[i * 2 + 1] = y;
    }

    contour.delete();
    return scaled;
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

/**
 * Ordonne les coins: Top-Left, Top-Right, Bottom-Right, Bottom-Left
 */
const orderCorners = (corners) => {
  if (!corners || corners.length !== 4) return corners;

  // Trouver le centre
  const cx = corners.reduce((sum, c) => sum + c.x, 0) / 4;
  const cy = corners.reduce((sum, c) => sum + c.y, 0) / 4;

  // Séparer en haut/bas basé sur Y par rapport au centre
  const top = corners.filter(c => c.y < cy);
  const bottom = corners.filter(c => c.y >= cy);

  // S'assurer qu'on a 2 points en haut et 2 en bas
  if (top.length !== 2 || bottom.length !== 2) {
    // Fallback: utiliser l'angle depuis le centre
    return corners.slice().sort((a, b) => {
      const angleA = Math.atan2(a.y - cy, a.x - cx);
      const angleB = Math.atan2(b.y - cy, b.x - cx);
      return angleA - angleB;
    });
  }

  // Trier par X
  top.sort((a, b) => a.x - b.x);
  bottom.sort((a, b) => b.x - a.x); // Inverse pour avoir BR puis BL

  return [
    top[0],     // Top-Left
    top[1],     // Top-Right
    bottom[0],  // Bottom-Right
    bottom[1]   // Bottom-Left
  ];
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
