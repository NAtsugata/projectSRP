// src/utils/documentScanner.js
// Utilitaires pour scanner et traiter des documents avec OpenCV.js
// Version améliorée - Détection robuste multi-méthodes

/**
 * Vérifie si OpenCV est chargé et prêt
 */
export const isOpenCvReady = () => {
  return !!(window.cv && window.cv.Mat && typeof window.cv.Mat === 'function');
};

/**
 * Détecte les bords d'un document dans une image avec OpenCV
 * Version V8 - Détection robuste multi-méthodes avec prétraitement amélioré
 */
export function detectDocumentEdges(imageData) {
  if (!isOpenCvReady()) {
    console.warn('[DETECT] OpenCV not ready');
    return null;
  }

  const cv = window.cv;
  let src = null;
  let resized = null;
  let enhanced = null;
  let gray = null;
  let blurred = null;

  try {
    // 1. Conversion ImageData -> cv.Mat
    src = cv.matFromImageData(imageData);

    // 2. Resize pour performance (800px max - plus grand = meilleure détection)
    const maxDim = Math.max(src.cols, src.rows);
    const targetSize = 800;
    const scale = maxDim > targetSize ? targetSize / maxDim : 1;

    resized = new cv.Mat();
    if (scale < 1) {
      cv.resize(src, resized, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
    } else {
      src.copyTo(resized);
    }

    const imgWidth = resized.cols;
    const imgHeight = resized.rows;
    const imgArea = imgWidth * imgHeight;
    const minAreaThreshold = imgArea * 0.03; // 3% minimum

    // 3. Amélioration du contraste (CLAHE)
    gray = new cv.Mat();
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);

    enhanced = new cv.Mat();
    const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    clahe.apply(gray, enhanced);
    clahe.delete();

    // 4. Flou bilatéral (préserve les bords)
    blurred = new cv.Mat();
    cv.bilateralFilter(enhanced, blurred, 9, 75, 75);

    // Collecter tous les candidats de toutes les méthodes
    const candidates = [];

    // ===== MÉTHODE 1: Adaptive Threshold =====
    const adaptiveResult = detectWithAdaptiveThreshold(cv, blurred, minAreaThreshold, scale, imgWidth, imgHeight);
    if (adaptiveResult) {
      adaptiveResult.method = 'adaptive';
      candidates.push(adaptiveResult);
    }

    // ===== MÉTHODE 2: Multi-Canny (plusieurs seuils) =====
    const cannyResults = detectWithMultiCanny(cv, blurred, minAreaThreshold, scale, imgWidth, imgHeight);
    cannyResults.forEach(r => {
      r.method = 'canny';
      candidates.push(r);
    });

    // ===== MÉTHODE 3: Otsu amélioré =====
    const otsuResult = detectWithOtsuEnhanced(cv, blurred, minAreaThreshold, scale, imgWidth, imgHeight);
    if (otsuResult) {
      otsuResult.method = 'otsu';
      candidates.push(otsuResult);
    }

    // ===== MÉTHODE 4: Détection basée sur les gradients (Sobel) =====
    const sobelResult = detectWithSobel(cv, blurred, minAreaThreshold, scale, imgWidth, imgHeight);
    if (sobelResult) {
      sobelResult.method = 'sobel';
      candidates.push(sobelResult);
    }

    // ===== MÉTHODE 5: Détection zones claires (papier blanc/beige) =====
    const lightResult = detectLightRegion(cv, resized, minAreaThreshold, scale, imgWidth, imgHeight);
    if (lightResult) {
      lightResult.method = 'light';
      candidates.push(lightResult);
    }

    // ===== MÉTHODE 6: Détection par contraste de couleur =====
    const colorResult = detectByColorContrast(cv, resized, minAreaThreshold, scale, imgWidth, imgHeight);
    if (colorResult) {
      colorResult.method = 'color';
      candidates.push(colorResult);
    }

    if (candidates.length === 0) {
      console.log('[DETECT] Aucun candidat trouvé');
      return null;
    }

    // Calculer le score pour chaque candidat
    candidates.forEach(c => {
      c.score = calculateDocumentScore(c.points, c.area, imgArea, imgWidth, imgHeight);
    });

    // Trier par score décroissant
    candidates.sort((a, b) => b.score - a.score);

    console.log('[DETECT] Candidats:', candidates.map(c => `${c.method}:${c.score.toFixed(2)}`).join(', '));

    const best = candidates[0];

    // Seuil plus bas pour accepter plus de détections
    if (best.score > 0.15) {
      console.log('[DETECT] Meilleur:', best.method, 'score:', best.score.toFixed(2));
      return sortCorners(best.points);
    }

    console.log('[DETECT] Score trop bas:', best.score.toFixed(2));
    return null;

  } catch (err) {
    console.error('[DETECT] OpenCV error:', err);
    return null;
  } finally {
    if (src) src.delete();
    if (resized) resized.delete();
    if (enhanced) enhanced.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
  }
}

/**
 * Détection avec seuillage adaptatif (meilleur pour éclairage inégal)
 */
function detectWithAdaptiveThreshold(cv, gray, minArea, scale, imgWidth, imgHeight) {
  let thresh = null, morphed = null, kernel = null;
  let contours = null, hierarchy = null;

  try {
    thresh = new cv.Mat();
    // Seuillage adaptatif - meilleur pour les documents avec ombres
    cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 5);

    // Inverser si nécessaire (document clair sur fond sombre)
    const mean = cv.mean(thresh);
    if (mean[0] > 127) {
      cv.bitwise_not(thresh, thresh);
    }

    // Morphologie agressive pour connecter les bords
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    morphed = new cv.Mat();
    cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);

    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    return findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight);

  } finally {
    if (thresh) thresh.delete();
    if (morphed) morphed.delete();
    if (kernel) kernel.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Détection Canny avec plusieurs configurations de seuils
 */
function detectWithMultiCanny(cv, gray, minArea, scale, imgWidth, imgHeight) {
  const results = [];

  // Calculer la médiane pour les seuils adaptatifs
  const median = estimateMedian(gray);

  // Plusieurs configurations de seuils
  const configs = [
    { low: Math.max(0, median * 0.3), high: Math.min(255, median * 1.0) },
    { low: Math.max(0, median * 0.5), high: Math.min(255, median * 1.5) },
    { low: 30, high: 100 },
    { low: 50, high: 150 },
    { low: 75, high: 200 }
  ];

  for (const config of configs) {
    let edges = null, morphed = null, kernel = null;
    let contours = null, hierarchy = null;

    try {
      edges = new cv.Mat();
      cv.Canny(gray, edges, config.low, config.high);

      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      morphed = new cv.Mat();
      cv.dilate(edges, morphed, kernel);
      cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel);

      const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
      cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
      bigKernel.delete();

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const result = findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight);
      if (result) {
        results.push(result);
      }

    } finally {
      if (edges) edges.delete();
      if (morphed) morphed.delete();
      if (kernel) kernel.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
    }
  }

  return results;
}

/**
 * Détection Otsu améliorée avec morphologie
 */
function detectWithOtsuEnhanced(cv, gray, minArea, scale, imgWidth, imgHeight) {
  let thresh = null, morphed = null, kernel = null;
  let contours = null, hierarchy = null;

  try {
    thresh = new cv.Mat();
    cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    // Essayer les deux polarités
    const results = [];

    for (let invert = 0; invert <= 1; invert++) {
      const workImg = new cv.Mat();
      if (invert) {
        cv.bitwise_not(thresh, workImg);
      } else {
        thresh.copyTo(workImg);
      }

      kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      morphed = new cv.Mat();
      cv.morphologyEx(workImg, morphed, cv.MORPH_CLOSE, kernel);

      const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(11, 11));
      cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
      bigKernel.delete();

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const result = findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight);
      if (result) {
        results.push(result);
      }

      workImg.delete();
      if (morphed) morphed.delete();
      if (kernel) kernel.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
    }

    // Retourner le meilleur résultat
    if (results.length > 0) {
      results.sort((a, b) => b.area - a.area);
      return results[0];
    }
    return null;

  } finally {
    if (thresh) thresh.delete();
  }
}

/**
 * Détection basée sur les gradients (Sobel)
 */
function detectWithSobel(cv, gray, minArea, scale, imgWidth, imgHeight) {
  let gradX = null, gradY = null, absX = null, absY = null;
  let grad = null, thresh = null, morphed = null, kernel = null;
  let contours = null, hierarchy = null;

  try {
    gradX = new cv.Mat();
    gradY = new cv.Mat();
    cv.Sobel(gray, gradX, cv.CV_16S, 1, 0);
    cv.Sobel(gray, gradY, cv.CV_16S, 0, 1);

    absX = new cv.Mat();
    absY = new cv.Mat();
    cv.convertScaleAbs(gradX, absX);
    cv.convertScaleAbs(gradY, absY);

    grad = new cv.Mat();
    cv.addWeighted(absX, 0.5, absY, 0.5, 0, grad);

    // Seuillage
    thresh = new cv.Mat();
    cv.threshold(grad, thresh, 30, 255, cv.THRESH_BINARY);

    // Morphologie pour connecter
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    morphed = new cv.Mat();
    cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);
    cv.dilate(morphed, morphed, kernel);

    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    return findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight);

  } finally {
    if (gradX) gradX.delete();
    if (gradY) gradY.delete();
    if (absX) absX.delete();
    if (absY) absY.delete();
    if (grad) grad.delete();
    if (thresh) thresh.delete();
    if (morphed) morphed.delete();
    if (kernel) kernel.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Détection des zones claires (papier blanc, beige, jaune clair)
 */
function detectLightRegion(cv, img, minArea, scale, imgWidth, imgHeight) {
  let lab = null, mask = null, kernel = null, morphed = null;
  let contours = null, hierarchy = null;

  try {
    // Convertir en LAB
    const rgb = new cv.Mat();
    cv.cvtColor(img, rgb, cv.COLOR_RGBA2RGB);

    lab = new cv.Mat();
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    rgb.delete();

    // Extraire le canal L (luminosité)
    const labChannels = new cv.MatVector();
    cv.split(lab, labChannels);
    const L = labChannels.get(0);
    const a = labChannels.get(1);
    const b = labChannels.get(2);

    // Créer un masque pour les zones claires (L > 150)
    mask = new cv.Mat();
    cv.threshold(L, mask, 140, 255, cv.THRESH_BINARY);

    // Nettoyer
    a.delete();
    b.delete();
    L.delete();
    labChannels.delete();

    // Morphologie
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    morphed = new cv.Mat();
    cv.morphologyEx(mask, morphed, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel);

    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    return findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight);

  } finally {
    if (lab) lab.delete();
    if (mask) mask.delete();
    if (kernel) kernel.delete();
    if (morphed) morphed.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Détection par contraste de couleur (document vs fond)
 */
function detectByColorContrast(cv, img, minArea, scale, imgWidth, imgHeight) {
  let hsv = null, mask = null, kernel = null, morphed = null;
  let contours = null, hierarchy = null;

  try {
    // Convertir en HSV
    const rgb = new cv.Mat();
    cv.cvtColor(img, rgb, cv.COLOR_RGBA2RGB);

    hsv = new cv.Mat();
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
    rgb.delete();

    // Extraire les canaux
    const hsvChannels = new cv.MatVector();
    cv.split(hsv, hsvChannels);
    const S = hsvChannels.get(1);
    const V = hsvChannels.get(2);

    // Masque pour les zones peu saturées et claires (papier typique)
    const lowSat = new cv.Mat();
    const highVal = new cv.Mat();
    cv.threshold(S, lowSat, 50, 255, cv.THRESH_BINARY_INV);
    cv.threshold(V, highVal, 120, 255, cv.THRESH_BINARY);

    mask = new cv.Mat();
    cv.bitwise_and(lowSat, highVal, mask);

    hsvChannels.get(0).delete();
    S.delete();
    V.delete();
    hsvChannels.delete();
    lowSat.delete();
    highVal.delete();

    // Morphologie
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
    morphed = new cv.Mat();
    cv.morphologyEx(mask, morphed, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel);

    const bigKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(13, 13));
    cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, bigKernel);
    bigKernel.delete();

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    return findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight);

  } finally {
    if (hsv) hsv.delete();
    if (mask) mask.delete();
    if (kernel) kernel.delete();
    if (morphed) morphed.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Estime la médiane d'une image grayscale
 */
function estimateMedian(gray) {
  const data = gray.data;
  const step = Math.max(1, Math.floor(data.length / 1000));
  const samples = [];
  for (let i = 0; i < data.length; i += step) {
    samples.push(data[i]);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * Trouve le meilleur contour quadrilatéral parmi une liste
 */
function findBestQuadContour(cv, contours, minArea, scale, imgWidth, imgHeight) {
  let bestResult = null;
  let bestScore = 0;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if (area < minArea) continue;

    const points = extractQuadrilateral(cv, contour);
    if (!points) continue;

    // Validation plus souple
    if (!isValidDocumentShape(points, imgWidth, imgHeight)) continue;

    const score = calculateQuickScore(points, area, imgWidth * imgHeight);

    if (score > bestScore) {
      bestScore = score;
      bestResult = {
        area: area,
        points: points.map(p => ({
          x: Math.round(p.x / scale),
          y: Math.round(p.y / scale)
        }))
      };
    }
  }

  return bestResult;
}

/**
 * Score rapide pour comparer les contours
 */
function calculateQuickScore(points, area, totalArea) {
  const areaRatio = area / totalArea;
  // Favoriser les grandes zones mais pas trop grandes
  if (areaRatio < 0.05 || areaRatio > 0.95) return 0;
  return areaRatio * (1 - Math.abs(areaRatio - 0.5));
}

/**
 * Score de qualité complet pour un candidat document
 */
function calculateDocumentScore(points, area, totalArea, imgWidth, imgHeight) {
  if (!points || points.length !== 4) return 0;

  let score = 0;

  // 1. Score de taille (5-95% de l'image) - 30%
  const areaRatio = area / totalArea;
  if (areaRatio >= 0.05 && areaRatio <= 0.95) {
    // Favoriser les tailles moyennes à grandes
    const sizeScore = areaRatio < 0.5 ? areaRatio * 2 : 1;
    score += 0.30 * sizeScore;
  }

  // 2. Score de rectangularité (côtés opposés similaires) - 25%
  const sides = [];
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    sides.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  }
  const ratio1 = Math.min(sides[0], sides[2]) / Math.max(sides[0], sides[2]);
  const ratio2 = Math.min(sides[1], sides[3]) / Math.max(sides[1], sides[3]);
  score += 0.25 * ((ratio1 + ratio2) / 2);

  // 3. Score d'angles (proches de 90°) - 25%
  let angleScore = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = points[(i + 3) % 4];
    const p2 = points[i];
    const p3 = points[(i + 1) % 4];
    const angle = calculateAngle(p1, p2, p3);
    const deviation = Math.abs(90 - angle);
    // Plus tolérant: jusqu'à 45° de déviation
    angleScore += Math.max(0, 1 - deviation / 45);
  }
  score += 0.25 * (angleScore / 4);

  // 4. Score de position (pas collé aux bords) - 20%
  const margin = Math.min(imgWidth, imgHeight) * 0.02;
  let edgeCount = 0;
  for (const p of points) {
    if (p.x < margin || p.x > imgWidth - margin ||
        p.y < margin || p.y > imgHeight - margin) {
      edgeCount++;
    }
  }
  score += 0.20 * (1 - edgeCount / 4);

  return Math.max(0, Math.min(1, score));
}

/**
 * Extrait un quadrilatère d'un contour
 */
function extractQuadrilateral(cv, contour) {
  const peri = cv.arcLength(contour, true);

  // Stratégie 1: approxPolyDP avec epsilon progressif
  const epsilonFactors = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1];

  for (const epsFactor of epsilonFactors) {
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, epsFactor * peri, true);

    if (approx.rows === 4) {
      const points = matToPoints(approx);
      approx.delete();
      if (isConvexQuad(points)) {
        return points;
      }
    } else if (approx.rows > 4 && approx.rows <= 10) {
      const allPoints = matToPoints(approx);
      approx.delete();
      const best4 = findBest4Corners(allPoints);
      if (best4 && isConvexQuad(best4)) {
        return best4;
      }
    } else {
      approx.delete();
    }
  }

  // Stratégie 2: Convex Hull
  const hull = new cv.Mat();
  cv.convexHull(contour, hull);

  if (hull.rows >= 4) {
    const hullPoints = matToPoints(hull);
    hull.delete();

    if (hullPoints.length === 4) {
      return hullPoints;
    } else if (hullPoints.length > 4) {
      const best4 = findBest4Corners(hullPoints);
      if (best4 && isConvexQuad(best4)) {
        return best4;
      }
    }
  } else {
    hull.delete();
  }

  // Stratégie 3: Min Area Rect
  const rect = cv.minAreaRect(contour);
  const vertices = cv.RotatedRect.points(rect);

  if (vertices && vertices.length === 4) {
    const rectPoints = vertices.map(v => ({ x: v.x, y: v.y }));
    if (isConvexQuad(rectPoints)) {
      return rectPoints;
    }
  }

  return null;
}

/**
 * Convertit un cv.Mat en tableau de points
 */
function matToPoints(mat) {
  const points = [];
  for (let i = 0; i < mat.rows; i++) {
    points.push({
      x: mat.data32S[i * 2],
      y: mat.data32S[i * 2 + 1]
    });
  }
  return points;
}

/**
 * Vérifie si 4 points forment un quadrilatère convexe
 */
function isConvexQuad(points) {
  if (points.length !== 4) return false;

  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    const p3 = points[(i + 2) % 4];

    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);

    if (cross !== 0) {
      if (sign === 0) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Trouve les 4 meilleurs coins parmi N points
 */
function findBest4Corners(points) {
  if (points.length < 4) return null;
  if (points.length === 4) return points;

  const n = points.length;
  const angles = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const angle = calculateAngle(prev, curr, next);
    angles.push({ index: i, angle: angle, point: curr });
  }

  // Les coins les plus marqués ont les angles les plus aigus
  angles.sort((a, b) => a.angle - b.angle);
  const best4Indices = angles.slice(0, 4).map(a => a.index).sort((a, b) => a - b);

  return best4Indices.map(i => points[i]);
}

/**
 * Calcule l'angle au point p2
 */
function calculateAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);

  if (mag1 === 0 || mag2 === 0) return 180;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/**
 * Valide qu'une forme est bien un document
 */
function isValidDocumentShape(points, imgWidth, imgHeight) {
  if (points.length !== 4) return false;

  // Bounding box
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const bboxWidth = maxX - minX;
  const bboxHeight = maxY - minY;

  // Taille minimum
  if (bboxWidth < imgWidth * 0.1 || bboxHeight < imgHeight * 0.1) {
    return false;
  }

  // Ratio d'aspect raisonnable (0.15 à 6.0)
  const aspectRatio = bboxWidth / bboxHeight;
  if (aspectRatio < 0.15 || aspectRatio > 6.0) {
    return false;
  }

  // Vérifier les angles (15° à 165°)
  for (let i = 0; i < 4; i++) {
    const p1 = points[(i + 3) % 4];
    const p2 = points[i];
    const p3 = points[(i + 1) % 4];
    const angle = calculateAngle(p1, p2, p3);

    if (angle < 15 || angle > 165) {
      return false;
    }
  }

  // Aire vs bounding box (au moins 40%)
  const quadArea = calculateQuadArea(points);
  const bboxArea = bboxWidth * bboxHeight;
  if (quadArea / bboxArea < 0.4) {
    return false;
  }

  return true;
}

/**
 * Calcule l'aire d'un quadrilatère
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
 * Trie les coins: TL, TR, BR, BL
 */
function sortCorners(points) {
  // Calculer le centre
  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;

  // Trier par angle depuis le centre
  const sorted = points.map(p => ({
    ...p,
    angle: Math.atan2(p.y - cy, p.x - cx)
  })).sort((a, b) => a.angle - b.angle);

  // Trouver le coin top-left (le plus en haut à gauche)
  let tlIndex = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIndex = i;
    }
  }

  // Réordonner pour que TL soit en premier
  const result = [];
  for (let i = 0; i < 4; i++) {
    const p = sorted[(tlIndex + i) % 4];
    result.push({ x: p.x, y: p.y });
  }

  return result;
}

/**
 * Applique une transformation de perspective
 */
export function applyPerspectiveTransform(canvas, sourceCorners, outputWidth = null, outputHeight = null) {
  if (!isOpenCvReady()) {
    console.error('OpenCV not ready');
    return canvas;
  }

  const cv = window.cv;
  let src = null, dst = null, M = null, srcTri = null, dstTri = null;

  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    src = cv.matFromImageData(imageData);

    if (!outputWidth || !outputHeight) {
      const widthTop = Math.hypot(sourceCorners[1].x - sourceCorners[0].x, sourceCorners[1].y - sourceCorners[0].y);
      const widthBottom = Math.hypot(sourceCorners[2].x - sourceCorners[3].x, sourceCorners[2].y - sourceCorners[3].y);
      const heightLeft = Math.hypot(sourceCorners[3].x - sourceCorners[0].x, sourceCorners[3].y - sourceCorners[0].y);
      const heightRight = Math.hypot(sourceCorners[2].x - sourceCorners[1].x, sourceCorners[2].y - sourceCorners[1].y);

      outputWidth = Math.round(Math.max(widthTop, widthBottom));
      outputHeight = Math.round(Math.max(heightLeft, heightRight));
    }

    if (outputWidth <= 0 || outputHeight <= 0) {
      return canvas;
    }

    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      sourceCorners[0].x, sourceCorners[0].y,
      sourceCorners[1].x, sourceCorners[1].y,
      sourceCorners[2].x, sourceCorners[2].y,
      sourceCorners[3].x, sourceCorners[3].y
    ]);

    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outputWidth, 0,
      outputWidth, outputHeight,
      0, outputHeight
    ]);

    M = cv.getPerspectiveTransform(srcTri, dstTri);
    dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(outputWidth, outputHeight));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
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
 * Filtre Noir & Blanc - Style scanner naturel
 * Approche douce : suppression ombres + contraste subtil
 */
export function enhanceBlackAndWhite(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  const mats = [];
  const track = (mat) => { mats.push(mat); return mat; };

  try {
    const src = track(cv.matFromImageData(imageData));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // === ÉTAPE 1: Suppression douce des ombres ===
    // Morphologie pour estimer le fond (zones claires = papier)
    const kernel = track(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(31, 31)));
    const background = track(new cv.Mat());
    cv.morphologyEx(gray, background, cv.MORPH_CLOSE, kernel);

    // Flou large pour fond uniforme
    const bgSmooth = track(new cv.Mat());
    cv.GaussianBlur(background, bgSmooth, new cv.Size(101, 101), 0);

    // Division pour normaliser l'éclairage
    const normalized = track(new cv.Mat());
    cv.divide(gray, bgSmooth, normalized, 255.0, -1);

    // === ÉTAPE 2: Contraste local doux avec CLAHE ===
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    const enhanced = track(new cv.Mat());
    clahe.apply(normalized, enhanced);
    clahe.delete();

    // === ÉTAPE 3: Légère netteté ===
    const blurred = track(new cv.Mat());
    cv.GaussianBlur(enhanced, blurred, new cv.Size(0, 0), 1.0);

    const sharp = track(new cv.Mat());
    cv.addWeighted(enhanced, 1.3, blurred, -0.3, 0, sharp);

    // === ÉTAPE 4: Étirement des niveaux (blanc pur, noir profond) ===
    // Trouver min/max pour étirer
    const minMax = cv.minMaxLoc(sharp);
    const minVal = minMax.minVal;
    const maxVal = minMax.maxVal;

    const stretched = track(new cv.Mat());
    const alpha = 255.0 / Math.max(1, maxVal - minVal);
    const beta = -minVal * alpha;
    sharp.convertTo(stretched, -1, alpha, beta);

    // === ÉTAPE 5: Courbe de gamma pour blancs plus blancs ===
    // Appliquer un gamma < 1 pour éclaircir les tons moyens
    const gammaLUT = new Uint8Array(256);
    const gamma = 0.85;
    for (let i = 0; i < 256; i++) {
      gammaLUT[i] = Math.min(255, Math.round(255 * Math.pow(i / 255, gamma)));
    }

    const final = track(new cv.Mat());
    stretched.copyTo(final);

    // Appliquer le LUT manuellement
    const data = final.data;
    for (let i = 0; i < data.length; i++) {
      data[i] = gammaLUT[data[i]];
    }

    // Convertir en RGBA
    const rgbaDst = track(new cv.Mat());
    cv.cvtColor(final, rgbaDst, cv.COLOR_GRAY2RGBA);

    return new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

  } catch (err) {
    console.error('B&W Filter Error:', err);
    return imageData;
  } finally {
    mats.forEach(mat => {
      try { mat.delete(); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * Filtre Gris Pro - Niveaux de gris optimisés avec contraste et netteté
 */
export function enhanceGrayscale(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  const mats = [];
  const track = (mat) => { mats.push(mat); return mat; };

  try {
    const src = track(cv.matFromImageData(imageData));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // CLAHE pour améliorer le contraste local
    const clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    const enhanced = track(new cv.Mat());
    clahe.apply(gray, enhanced);
    clahe.delete();

    // Unsharp masking pour la netteté
    const blurred = track(new cv.Mat());
    cv.GaussianBlur(enhanced, blurred, new cv.Size(0, 0), 1.5);

    const sharp = track(new cv.Mat());
    cv.addWeighted(enhanced, 1.5, blurred, -0.5, 0, sharp);

    // Étirement des niveaux pour utiliser toute la plage dynamique
    const normalized = track(new cv.Mat());
    cv.normalize(sharp, normalized, 0, 255, cv.NORM_MINMAX);

    const rgbaDst = track(new cv.Mat());
    cv.cvtColor(normalized, rgbaDst, cv.COLOR_GRAY2RGBA);

    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    return imgData;

  } catch (err) {
    console.error('Enhance Gray error:', err);
    return imageData;
  } finally {
    mats.forEach(mat => {
      try { mat.delete(); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * Filtre Couleur Pro - Couleurs vibrantes avec netteté et contraste améliorés
 */
export function enhanceColor(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  const mats = [];
  const track = (mat) => { mats.push(mat); return mat; };

  try {
    const src = track(cv.matFromImageData(imageData));
    const rgb = track(new cv.Mat());
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

    // Convertir en LAB pour traiter luminosité et couleurs séparément
    const lab = track(new cv.Mat());
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);

    // Séparer les canaux
    const channels = track(new cv.MatVector());
    cv.split(lab, channels);
    const L = channels.get(0);
    const a = channels.get(1);
    const b = channels.get(2);

    // CLAHE sur le canal L (luminosité)
    const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
    clahe.apply(L, L);
    clahe.delete();

    // Saturation boost sur a et b
    const boostFactor = 1.15;
    a.convertTo(a, -1, boostFactor, 128 * (1 - boostFactor));
    b.convertTo(b, -1, boostFactor, 128 * (1 - boostFactor));

    // Reconstruire l'image
    cv.merge(channels, lab);
    const enhanced = track(new cv.Mat());
    cv.cvtColor(lab, enhanced, cv.COLOR_Lab2RGB);

    // Sharpening avec kernel Unsharp
    const blurred = track(new cv.Mat());
    cv.GaussianBlur(enhanced, blurred, new cv.Size(0, 0), 1.5);

    const sharp = track(new cv.Mat());
    cv.addWeighted(enhanced, 1.4, blurred, -0.4, 0, sharp);

    // Convertir en RGBA
    const rgbaDst = track(new cv.Mat());
    cv.cvtColor(sharp, rgbaDst, cv.COLOR_RGB2RGBA);

    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    return imgData;

  } catch (err) {
    console.error('Enhance Color error:', err);
    return imageData;
  } finally {
    mats.forEach(mat => {
      try { mat.delete(); } catch (e) { /* ignore */ }
    });
  }
}

/**
 * Détecte le meilleur mode
 */
export function detectBestMode(imageData) {
  return 'bw';
}
