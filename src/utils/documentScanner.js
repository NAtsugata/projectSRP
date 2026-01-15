// src/utils/documentScanner.js
// Utilitaires pour scanner et traiter des documents avec OpenCV.js
// Implémente la détection de contours, la correction de perspective et les filtres "Magic"

/**
 * Vérifie si OpenCV est chargé et prêt
 */
export const isOpenCvReady = () => {
  return !!(window.cv && window.cv.Mat && typeof window.cv.Mat === 'function');
};

/**
 * Détecte les bords d'un document dans une image avec OpenCV
 * Version V3 - Multi-stratégies avec fallbacks robustes
 * Retourne les 4 coins du document détecté ou null si non trouvé
 */
export function detectDocumentEdges(imageData) {
  if (!isOpenCvReady()) {
    console.warn('[DETECT] OpenCV not ready');
    return null;
  }

  const cv = window.cv;
  let src = null;
  let smallImg = null;
  let gray = null;
  let blurred = null;

  try {
    // 1. Conversion ImageData -> cv.Mat
    src = cv.matFromImageData(imageData);

    // 2. DOWNSCALE pour performance (max 600px pour garder plus de détails)
    const maxDim = Math.max(src.cols, src.rows);
    const targetSize = 600;
    const scale = maxDim > targetSize ? targetSize / maxDim : 1;

    smallImg = new cv.Mat();
    if (scale < 1) {
      cv.resize(src, smallImg, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
    } else {
      src.copyTo(smallImg);
    }

    const smallArea = smallImg.rows * smallImg.cols;
    // Seuil très bas (2%) pour détecter même les petits documents
    const minAreaThreshold = smallArea * 0.02;

    // 3. Prétraitement de base
    gray = new cv.Mat();
    cv.cvtColor(smallImg, gray, cv.COLOR_RGBA2GRAY);

    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    let bestPoints = null;
    let maxArea = 0;

    // ===== STRATÉGIE 1: Canny avec multiples seuils =====
    const cannyConfigs = [
      { low: 30, high: 100, kernelSize: 7 },   // Très sensible, gros kernel
      { low: 50, high: 150, kernelSize: 5 },   // Standard
      { low: 20, high: 80, kernelSize: 9 },    // Ultra sensible
      { low: 75, high: 200, kernelSize: 5 },   // Pour documents à fort contraste
    ];

    for (const config of cannyConfigs) {
      if (bestPoints && maxArea > smallArea * 0.15) break; // Bon résultat trouvé

      const result = tryCannyDetection(cv, blurred, config, minAreaThreshold, scale);
      if (result && result.area > maxArea) {
        maxArea = result.area;
        bestPoints = result.points;
      }
    }

    // ===== STRATÉGIE 2: Seuillage adaptatif (si Canny échoue) =====
    if (!bestPoints || maxArea < smallArea * 0.1) {
      const adaptiveResult = tryAdaptiveThreshold(cv, gray, minAreaThreshold, scale);
      if (adaptiveResult && adaptiveResult.area > maxArea) {
        maxArea = adaptiveResult.area;
        bestPoints = adaptiveResult.points;
      }
    }

    // ===== STRATÉGIE 3: Détection par couleur/saturation (document blanc) =====
    if (!bestPoints || maxArea < smallArea * 0.1) {
      const colorResult = tryColorBasedDetection(cv, smallImg, minAreaThreshold, scale);
      if (colorResult && colorResult.area > maxArea) {
        maxArea = colorResult.area;
        bestPoints = colorResult.points;
      }
    }

    if (bestPoints) {
      console.log('[DETECT] Document trouvé, area:', (maxArea / smallArea * 100).toFixed(1) + '%');
      return sortCorners(bestPoints);
    }

    console.log('[DETECT] Aucun document détecté');
    return null;

  } catch (err) {
    console.error('[DETECT] OpenCV error:', err);
    return null;
  } finally {
    if (src) src.delete();
    if (smallImg) smallImg.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
  }
}

/**
 * Stratégie 1: Détection par Canny + Morphologie
 */
function tryCannyDetection(cv, blurred, config, minArea, scale) {
  let edges = null, closed = null, kernel = null, contours = null, hierarchy = null;

  try {
    edges = new cv.Mat();
    cv.Canny(blurred, edges, config.low, config.high);

    // Morphologie avec kernel adaptatif
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(config.kernelSize, config.kernelSize));
    closed = new cv.Mat();
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    cv.dilate(closed, closed, kernel);

    return findBestQuadrilateral(cv, closed, minArea, scale);

  } finally {
    if (edges) edges.delete();
    if (closed) closed.delete();
    if (kernel) kernel.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Stratégie 2: Seuillage adaptatif
 */
function tryAdaptiveThreshold(cv, gray, minArea, scale) {
  let thresh = null, kernel = null, morphed = null;

  try {
    thresh = new cv.Mat();
    // Seuillage adaptatif - bon pour les documents avec éclairage inégal
    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

    // Nettoyage morphologique
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    morphed = new cv.Mat();
    cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);

    // Kernel plus gros pour fermer les gaps
    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    return findBestQuadrilateral(cv, morphed, minArea, scale);

  } finally {
    if (thresh) thresh.delete();
    if (kernel) kernel.delete();
    if (morphed) morphed.delete();
  }
}

/**
 * Stratégie 3: Détection basée sur la couleur (documents blancs)
 */
function tryColorBasedDetection(cv, img, minArea, scale) {
  let hsv = null, mask = null, kernel = null, morphed = null;

  try {
    hsv = new cv.Mat();
    cv.cvtColor(img, hsv, cv.COLOR_RGBA2RGB);
    const rgb = hsv.clone();
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    rgb.delete();

    // Masque pour les zones claires (papier blanc/beige)
    mask = new cv.Mat();
    const lowWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 180, 0]);
    const highWhite = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 50, 255, 255]);
    cv.inRange(hsv, lowWhite, highWhite, mask);
    lowWhite.delete();
    highWhite.delete();

    // Nettoyage morphologique agressif
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    morphed = new cv.Mat();
    cv.morphologyEx(mask, morphed, cv.MORPH_OPEN, kernel);  // Supprimer le bruit
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel);  // Fermer les trous

    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(11, 11));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    return findBestQuadrilateral(cv, morphed, minArea, scale);

  } finally {
    if (hsv) hsv.delete();
    if (mask) mask.delete();
    if (kernel) kernel.delete();
    if (morphed) morphed.delete();
  }
}

/**
 * Trouve le meilleur quadrilatère dans une image binaire
 */
function findBestQuadrilateral(cv, binaryImg, minArea, scale) {
  let contours = null, hierarchy = null;

  try {
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(binaryImg, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestPoints = null;
    let maxArea = 0;

    // Facteurs d'approximation - du plus précis au plus tolérant
    const epsilonFactors = [0.015, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < minArea) continue;
      if (area <= maxArea) continue; // On veut le plus grand

      const peri = cv.arcLength(contour, true);

      for (const epsFactor of epsilonFactors) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsFactor * peri, true);

        // Accepter 4 points (ou 5 si presque quadrilatère)
        if (approx.rows >= 4 && approx.rows <= 5) {
          // Vérifier si c'est raisonnablement convexe (tolérance pour documents pliés)
          const isValid = approx.rows === 4 ||
            (approx.rows === 5 && tryReduceTo4Points(cv, approx));

          if (isValid && approx.rows === 4) {
            // Vérification de convexité optionnelle (accepter même si pas parfaitement convexe)
            maxArea = area;
            bestPoints = [];
            for (let j = 0; j < 4; j++) {
              bestPoints.push({
                x: Math.round(approx.data32S[j * 2] / scale),
                y: Math.round(approx.data32S[j * 2 + 1] / scale)
              });
            }
          }
        }
        approx.delete();

        if (bestPoints && maxArea === area) break;
      }
    }

    return bestPoints ? { points: bestPoints, area: maxArea } : null;

  } finally {
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Tente de réduire un polygone à 5 points en 4 points
 */
function tryReduceTo4Points(cv, approx) {
  // Si on a 5 points, trouver le plus petit angle et fusionner
  // Pour l'instant, on rejette simplement
  return false;
}

/**
 * Trie les coins dans l'ordre: TL, TR, BR, BL
 */
function sortCorners(points) {
  // Trier par Y pour séparer haut/bas
  points.sort((a, b) => a.y - b.y);

  const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = points.slice(2, 4).sort((a, b) => b.x - a.x); // Note: BR puis BL pour l'ordre horaire

  return [
    top[0],     // Top-Left
    top[1],     // Top-Right
    bottom[0],  // Bottom-Right
    bottom[1]   // Bottom-Left
  ];
}

/**
 * Applique une transformation de perspective pour redresser le document
 */
export function applyPerspectiveTransform(canvas, sourceCorners, outputWidth = null, outputHeight = null) {
  if (!isOpenCvReady()) {
    console.error('OpenCV not ready for perspective transform');
    return canvas;
  }

  const cv = window.cv;
  let src = null;
  let dst = null;
  let M = null;
  let srcTri = null;
  let dstTri = null;

  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    src = cv.matFromImageData(imageData);

    // Définir les dimensions de sortie si non fournies (basées sur la largeur max et hauteur max)
    if (!outputWidth || !outputHeight) {
      const widthTop = Math.hypot(sourceCorners[1].x - sourceCorners[0].x, sourceCorners[1].y - sourceCorners[0].y);
      const widthBottom = Math.hypot(sourceCorners[2].x - sourceCorners[3].x, sourceCorners[2].y - sourceCorners[3].y);
      const heightLeft = Math.hypot(sourceCorners[3].x - sourceCorners[0].x, sourceCorners[3].y - sourceCorners[0].y);
      const heightRight = Math.hypot(sourceCorners[2].x - sourceCorners[1].x, sourceCorners[2].y - sourceCorners[1].y);

      outputWidth = Math.round(Math.max(widthTop, widthBottom));
      outputHeight = Math.round(Math.max(heightLeft, heightRight));
    }

    // Validation des dimensions
    if (outputWidth <= 0 || outputHeight <= 0 || !isFinite(outputWidth) || !isFinite(outputHeight)) {
      console.error('Invalid output dimensions:', outputWidth, outputHeight);
      return canvas;
    }

    // Points source (format OpenCV)
    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      sourceCorners[0].x, sourceCorners[0].y,
      sourceCorners[1].x, sourceCorners[1].y,
      sourceCorners[2].x, sourceCorners[2].y,
      sourceCorners[3].x, sourceCorners[3].y
    ]);

    // Points destination (Rectangle parfait)
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outputWidth, 0,
      outputWidth, outputHeight,
      0, outputHeight
    ]);

    // Calculer la matrice de transformation
    M = cv.getPerspectiveTransform(srcTri, dstTri);

    // Appliquer la transformation
    dst = new cv.Mat();
    const dsize = new cv.Size(outputWidth, outputHeight);
    cv.warpPerspective(src, dst, M, dsize);

    // Créer le canvas de sortie
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    // Afficher le résultat sur le canvas
    cv.imshow(outputCanvas, dst);

    return outputCanvas;

  } catch (err) {
    console.error('Perspective transform error:', err);
    return canvas;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
    if (M) M.delete();
    if (srcTri) srcTri.delete();
    if (dstTri) dstTri.delete();
  }
}

/**
 * FILTRE "MAGIC" / "DOCS" - Style ClearScanner
 * Supprime les ombres et blanchit le fond tout en gardant le texte net (antialiasing)
 */
export function enhanceBlackAndWhite(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  let src = null, gray = null, dilated = null, bg = null, diff = null, norm = null, kernel = null;

  try {
    src = cv.matFromImageData(imageData);
    gray = new cv.Mat();

    // 1. Conversion en Gris
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 2. Estimation du fond (Background)
    // On dilate l'image pour supprimer le texte (garder que le papier) puis on floute
    dilated = new cv.Mat();
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
    cv.morphologyEx(gray, dilated, cv.MORPH_DILATE, kernel);

    bg = new cv.Mat();
    // Gros flou pour lisser le fond
    cv.GaussianBlur(dilated, bg, new cv.Size(21, 21), 0, 0);

    // 3. Division : (Image / Fond) * 255
    // Cela "aplatit" l'éclairage. Les zones d'ombre disparaissent.
    diff = new cv.Mat();
    cv.divide(gray, bg, diff, 255.0, -1);

    // 4. Augmenter le contraste final
    // On ne fait pas un binaire pur, on garde une transition pour l'antialiasing
    norm = new cv.Mat();
    cv.threshold(diff, norm, 200, 255, cv.THRESH_TRUNC);
    cv.normalize(norm, norm, 0, 255, cv.NORM_MINMAX);

    // Retour en RGBA
    const rgbaDst = new cv.Mat();
    cv.cvtColor(norm, rgbaDst, cv.COLOR_GRAY2RGBA);

    const result = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    rgbaDst.delete();

    return result;

  } catch (err) {
    console.error('Magic Filter Error:', err);
    return imageData;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (dilated) dilated.delete();
    if (bg) bg.delete();
    if (diff) diff.delete();
    if (norm) norm.delete();
    if (kernel) kernel.delete();
  }
}

/**
 * Améliore l'image - Mode Gris (Contraste amélioré)
 */
export function enhanceGrayscale(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  let src = null;
  let dst = null;

  try {
    src = cv.matFromImageData(imageData);
    dst = new cv.Mat();

    // Convertir en gris
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

    // Normaliser / Égaliser l'histogramme pour le contraste
    // CLAHE (Contrast Limited Adaptive Histogram Equalization) est mieux que equalizeHist global
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    clahe.apply(dst, dst);
    clahe.delete();

    // Retour en RGBA
    const rgbaDst = new cv.Mat();
    cv.cvtColor(dst, rgbaDst, cv.COLOR_GRAY2RGBA, 0);

    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    rgbaDst.delete();
    return imgData;

  } catch (err) {
    console.error('Enhance Gray error:', err);
    return imageData;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
  }
}

/**
 * Améliore l'image - Mode Couleur (Denoise + Sharpen)
 */
export function enhanceColor(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  let src = null;
  let dst = null;

  try {
    src = cv.matFromImageData(imageData);
    dst = new cv.Mat();

    // Convertir en RGB
    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);

    // Denoising (peut être lent en JS, on utilise un flou bilatéral léger à la place)
    // cv.bilateralFilter(src, dst, 9, 75, 75); // Trop lent en WASM souvent

    // Simple Sharpening kernel
    const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ]);

    cv.filter2D(src, dst, -1, kernel);
    kernel.delete();

    // Retour en RGBA
    const rgbaDst = new cv.Mat();
    cv.cvtColor(dst, rgbaDst, cv.COLOR_RGB2RGBA, 0);

    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    rgbaDst.delete();
    return imgData;

  } catch (err) {
    console.error('Enhance Color error:', err);
    return imageData;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
  }
}

/**
 * Retourne les coins par défaut (toute l'image avec marge)
 */
function getDefaultCorners(width, height) {
  const margin = Math.min(width, height) * 0.1;
  return [
    { x: margin, y: margin },
    { x: width - margin, y: margin },
    { x: width - margin, y: height - margin },
    { x: margin, y: height - margin }
  ];
}

/**
 * Détecte automatiquement le meilleur mode
 */
export function detectBestMode(imageData) {
  // Logique simple basée sur la saturation
  // Si saturation moyenne faible -> BW ou Gray
  // Sinon -> Color
  return 'bw'; // Par défaut pour les documents administratifs
}
