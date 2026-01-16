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
 * Version V6 - Ajout détection des zones blanches (papier)
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
  let enhanced = null;
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
    const minAreaThreshold = smallArea * 0.05;

    // 3. Conversion en niveaux de gris
    gray = new cv.Mat();
    cv.cvtColor(smallImg, gray, cv.COLOR_RGBA2GRAY);

    // 4. CLAHE - Amélioration du contraste
    enhanced = new cv.Mat();
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    clahe.apply(gray, enhanced);
    clahe.delete();

    // 5. Flou gaussien
    blurred = new cv.Mat();
    cv.GaussianBlur(enhanced, blurred, new cv.Size(5, 5), 0);

    let bestResult = null;

    // ===== STRATÉGIE 1: Détection des zones BLANCHES (papier) =====
    const whiteResult = detectWhiteRegion(cv, smallImg, minAreaThreshold, scale, smallImg.cols, smallImg.rows);
    if (whiteResult && whiteResult.area > minAreaThreshold) {
      bestResult = whiteResult;
    }

    // ===== STRATÉGIE 2: Canny si blanc insuffisant =====
    if (!bestResult || bestResult.area < smallArea * 0.15) {
      const cannyConfigs = [
        { low: 40, high: 120, kernelSize: 5 },
        { low: 60, high: 180, kernelSize: 5 },
        { low: 25, high: 75, kernelSize: 7 },
      ];

      for (const config of cannyConfigs) {
        if (bestResult && bestResult.area > smallArea * 0.25) break;

        const result = detectWithCanny(cv, blurred, config, minAreaThreshold, scale, smallImg.cols, smallImg.rows);
        if (result && (!bestResult || result.area > bestResult.area)) {
          bestResult = result;
        }
      }
    }

    if (bestResult) {
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
    if (enhanced) enhanced.delete();
    if (blurred) blurred.delete();
  }
}

/**
 * Détecte les zones blanches/claires (papier) dans l'image
 */
function detectWhiteRegion(cv, img, minArea, scale, imgWidth, imgHeight) {
  let hsv = null, lab = null, mask = null, kernel = null, morphed = null;
  let contours = null, hierarchy = null;

  try {
    // Convertir en LAB (meilleur pour détecter la luminosité)
    const rgb = new cv.Mat();
    cv.cvtColor(img, rgb, cv.COLOR_RGBA2RGB);

    lab = new cv.Mat();
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    rgb.delete();

    // Séparer les canaux L, a, b
    const labChannels = new cv.MatVector();
    cv.split(lab, labChannels);
    const L = labChannels.get(0); // Canal de luminosité

    // Seuillage sur la luminosité (papier blanc = haute luminosité)
    // L va de 0 à 255, papier blanc > 180
    mask = new cv.Mat();
    cv.threshold(L, mask, 170, 255, cv.THRESH_BINARY);

    // Cleanup
    labChannels.get(1).delete();
    labChannels.get(2).delete();
    L.delete();
    labChannels.delete();

    // Morphologie pour nettoyer le masque
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    morphed = new cv.Mat();

    // Ouverture pour supprimer le bruit
    cv.morphologyEx(mask, morphed, cv.MORPH_OPEN, kernel);
    // Fermeture pour combler les trous
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel);

    // Kernel plus gros pour mieux connecter
    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    // Trouver les contours
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestResult = null;
    const epsilonFactors = [0.02, 0.03, 0.04, 0.05];

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area < minArea) continue;
      if (bestResult && area <= bestResult.area) continue;

      const peri = cv.arcLength(contour, true);

      for (const epsFactor of epsilonFactors) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsFactor * peri, true);

        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const points = [];
          for (let j = 0; j < 4; j++) {
            points.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1]
            });
          }

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

  } catch (err) {
    console.error('[WHITE DETECT] Error:', err);
    return null;
  } finally {
    if (hsv) hsv.delete();
    if (lab) lab.delete();
    if (mask) mask.delete();
    if (kernel) kernel.delete();
    if (morphed) morphed.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
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
 * Version améliorée avec tolérance pour documents en perspective
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

  // 2. Vérifier le ratio d'aspect (entre 0.2 et 5.0 - plus tolérant pour perspective)
  const aspectRatio = bboxWidth / bboxHeight;
  if (aspectRatio < 0.2 || aspectRatio > 5.0) {
    return false;
  }

  // 3. Rejeter si c'est l'image entière (tous les coins près des bords)
  const margin = Math.min(imgWidth, imgHeight) * 0.03;
  let cornersAtEdge = 0;

  for (const p of points) {
    const atLeft = p.x < margin;
    const atRight = p.x > imgWidth - margin;
    const atTop = p.y < margin;
    const atBottom = p.y > imgHeight - margin;

    if ((atLeft || atRight) && (atTop || atBottom)) {
      cornersAtEdge++;
    }
  }

  // Si 4 coins sont dans les coins de l'image = faux positif
  if (cornersAtEdge >= 4) {
    return false;
  }

  // 4. Vérifier les angles (plus tolérant: 20° à 160° pour perspective)
  for (let i = 0; i < 4; i++) {
    const p1 = points[(i + 3) % 4];
    const p2 = points[i];
    const p3 = points[(i + 1) % 4];

    const angle = calculateAngle(p1, p2, p3);

    // Angle trop aigu ou trop obtus = probablement pas un document
    if (angle < 20 || angle > 160) {
      return false;
    }
  }

  // 5. Vérifier que les côtés opposés ont des longueurs raisonnables
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    sides.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  }

  // Ratio entre côtés opposés (tolérance de 4x pour perspective forte)
  const ratio1 = Math.max(sides[0], sides[2]) / Math.min(sides[0], sides[2]);
  const ratio2 = Math.max(sides[1], sides[3]) / Math.min(sides[1], sides[3]);

  if (ratio1 > 4 || ratio2 > 4) {
    return false;
  }

  // 6. Vérifier que l'aire du quadrilatère est significative par rapport au bbox
  const quadArea = calculateQuadArea(points);
  const bboxArea = bboxWidth * bboxHeight;
  const fillRatio = quadArea / bboxArea;

  // Un vrai document remplit au moins 50% de son bounding box
  if (fillRatio < 0.5) {
    return false;
  }

  return true;
}

/**
 * Calcule l'aire d'un quadrilatère (formule du lacet)
 */
function calculateQuadArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
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
