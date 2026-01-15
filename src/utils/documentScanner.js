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
 * Version V4 - Détection stricte avec validation géométrique
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

    // 2. DOWNSCALE pour performance (max 500px)
    const maxDim = Math.max(src.cols, src.rows);
    const targetSize = 500;
    const scale = maxDim > targetSize ? targetSize / maxDim : 1;

    smallImg = new cv.Mat();
    if (scale < 1) {
      cv.resize(src, smallImg, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
    } else {
      src.copyTo(smallImg);
    }

    const smallArea = smallImg.rows * smallImg.cols;
    // Seuil minimum: 8% de l'image (évite les petits faux positifs)
    const minAreaThreshold = smallArea * 0.08;

    // 3. Prétraitement
    gray = new cv.Mat();
    cv.cvtColor(smallImg, gray, cv.COLOR_RGBA2GRAY);

    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    let bestResult = null;

    // ===== Détection Canny avec plusieurs seuils =====
    const cannyConfigs = [
      { low: 50, high: 150, kernelSize: 5 },   // Standard
      { low: 75, high: 200, kernelSize: 5 },   // Fort contraste
      { low: 30, high: 100, kernelSize: 7 },   // Sensible
    ];

    for (const config of cannyConfigs) {
      // Si on a déjà un bon résultat (>20% de l'image), on arrête
      if (bestResult && bestResult.area > smallArea * 0.20) break;

      const result = detectWithCanny(cv, blurred, config, minAreaThreshold, scale, smallImg.cols, smallImg.rows);
      if (result && (!bestResult || result.area > bestResult.area)) {
        bestResult = result;
      }
    }

    if (bestResult) {
      console.log('[DETECT] Document trouvé, area:', (bestResult.area / smallArea * 100).toFixed(1) + '%');
      return sortCorners(bestResult.points);
    }

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
 * Détection par Canny + Morphologie avec validation stricte
 */
function detectWithCanny(cv, blurred, config, minArea, scale, imgWidth, imgHeight) {
  let edges = null, closed = null, kernel = null, contours = null, hierarchy = null;

  try {
    // 1. Canny edge detection
    edges = new cv.Mat();
    cv.Canny(blurred, edges, config.low, config.high);

    // 2. Morphologie pour fermer les gaps
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(config.kernelSize, config.kernelSize));
    closed = new cv.Mat();
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    cv.dilate(closed, closed, kernel);

    // 3. Trouver les contours
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestResult = null;

    // Facteurs d'approximation (du plus précis au plus tolérant)
    const epsilonFactors = [0.02, 0.03, 0.04, 0.05];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Filtre par aire minimum
      if (area < minArea) continue;
      if (bestResult && area <= bestResult.area) continue;

      const peri = cv.arcLength(contour, true);

      for (const epsFactor of epsilonFactors) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsFactor * peri, true);

        // Doit être exactement 4 points et convexe
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          // Extraire les points
          const points = [];
          for (let j = 0; j < 4; j++) {
            points.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1]
            });
          }

          // Validation géométrique stricte
          if (isValidDocumentShape(points, imgWidth, imgHeight)) {
            bestResult = {
              area: area,
              points: points.map(p => ({
                x: Math.round(p.x / scale),
                y: Math.round(p.y / scale)
              }))
            };
          }
        }
        approx.delete();

        if (bestResult && bestResult.area === area) break;
      }
    }

    return bestResult;

  } finally {
    if (edges) edges.delete();
    if (closed) closed.delete();
    if (kernel) kernel.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Valide qu'une forme est bien un document (pas un faux positif)
 */
function isValidDocumentShape(points, imgWidth, imgHeight) {
  if (points.length !== 4) return false;

  // 1. Calculer le bounding box
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const bboxWidth = maxX - minX;
  const bboxHeight = maxY - minY;

  // 2. Vérifier le ratio d'aspect (entre 0.3 et 3.0 - documents standards)
  const aspectRatio = bboxWidth / bboxHeight;
  if (aspectRatio < 0.3 || aspectRatio > 3.0) {
    return false;
  }

  // 3. Vérifier que ce n'est pas trop près des bords (probable faux positif)
  const margin = Math.min(imgWidth, imgHeight) * 0.02;
  const tooCloseToEdge = points.some(p =>
    p.x < margin || p.x > imgWidth - margin ||
    p.y < margin || p.y > imgHeight - margin
  );

  // Si TOUS les points sont au bord, c'est un faux positif (détection de l'image entière)
  const allAtEdge = points.every(p =>
    p.x < margin * 2 || p.x > imgWidth - margin * 2 ||
    p.y < margin * 2 || p.y > imgHeight - margin * 2
  );
  if (allAtEdge) {
    return false;
  }

  // 4. Vérifier les angles (pas trop aigus - min 30°)
  const angles = [];
  for (let i = 0; i < 4; i++) {
    const p1 = points[(i + 3) % 4];
    const p2 = points[i];
    const p3 = points[(i + 1) % 4];

    const angle = calculateAngle(p1, p2, p3);
    angles.push(angle);

    // Angle trop aigu = probablement pas un document
    if (angle < 30 || angle > 150) {
      return false;
    }
  }

  // 5. Vérifier que les côtés opposés ont des longueurs similaires
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    sides.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  }

  // Ratio entre côtés opposés (tolérance de 3x max)
  const ratio1 = Math.max(sides[0], sides[2]) / Math.min(sides[0], sides[2]);
  const ratio2 = Math.max(sides[1], sides[3]) / Math.min(sides[1], sides[3]);

  if (ratio1 > 3 || ratio2 > 3) {
    return false;
  }

  return true;
}

/**
 * Calcule l'angle au point p2 (en degrés)
 */
function calculateAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
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
