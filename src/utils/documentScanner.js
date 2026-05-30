// src/utils/documentScanner.js
// Utilitaires pour scanner et traiter des documents avec OpenCV.js
// Détection single-function, robuste, style ClearScanner.

/**
 * Vérifie si OpenCV est chargé et prêt
 */
export const isOpenCvReady = () => {
  return !!(window.cv && window.cv.Mat && typeof window.cv.Mat === 'function');
};

// ─── Helpers internes ────────────────────────────────────────────────────────

/**
 * Estime la médiane des valeurs d'une image grayscale (échantillonnage rapide)
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
 * Convertit un cv.Mat en tableau de points {x, y}
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
 * Vérifie qu'un quadrilatère est convexe
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
      if (sign === 0) sign = cross > 0 ? 1 : -1;
      else if ((cross > 0 ? 1 : -1) !== sign) return false;
    }
  }
  return true;
}

/**
 * Calcule l'angle au sommet p2
 */
function calcAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
}

/**
 * Valide qu'une forme ressemble à un document
 */
function isValidDocumentShape(points, imgWidth, imgHeight) {
  if (points.length !== 4) return false;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const bboxW = Math.max(...xs) - Math.min(...xs);
  const bboxH = Math.max(...ys) - Math.min(...ys);
  if (bboxW < imgWidth * 0.05 || bboxH < imgHeight * 0.05) return false;
  const aspect = bboxW / bboxH;
  if (aspect < 0.1 || aspect > 10.0) return false;
  for (let i = 0; i < 4; i++) {
    const angle = calcAngle(points[(i + 3) % 4], points[i], points[(i + 1) % 4]);
    if (angle < 10 || angle > 170) return false;
  }
  // Aire quadrilatère vs bounding box ≥ 40%
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;
  if (area / (bboxW * bboxH) < 0.4) return false;
  return true;
}

/**
 * Extrait les 4 coins extrêmes (méthode jscanify) depuis un ensemble de points.
 * TL = min(x+y), BR = max(x+y), TR = max(x-y), BL = min(x-y)
 */
function extremeCorners(pts) {
  let tl = pts[0], tr = pts[0], br = pts[0], bl = pts[0];
  let tlV = Infinity, brV = -Infinity, trV = -Infinity, blV = Infinity;
  for (const p of pts) {
    const sum = p.x + p.y;
    const diff = p.x - p.y;
    if (sum < tlV) { tlV = sum; tl = p; }
    if (sum > brV) { brV = sum; br = p; }
    if (diff > trV) { trV = diff; tr = p; }
    if (diff < blV) { blV = diff; bl = p; }
  }
  return [tl, tr, br, bl];
}

/**
 * Tente d'extraire un quadrilatère d'un contour avec convexHull + approxPolyDP
 * Returns null si échec.
 * @param {*} cv
 * @param {*} contour
 * @param {number} imgWidth
 * @param {number} imgHeight
 */
function extractQuadFromContour(cv, contour, imgWidth, imgHeight) {
  const hull = new cv.Mat();
  try {
    cv.convexHull(contour, hull);
    if (hull.rows < 4) return null;

    const peri = cv.arcLength(hull, true);
    const approx = new cv.Mat();
    try {
      cv.approxPolyDP(hull, approx, 0.02 * peri, true);
      const n = approx.rows;

      if (n === 4) {
        const pts = matToPoints(approx);
        if (isConvexQuad(pts) && isValidDocumentShape(pts, imgWidth, imgHeight)) {
          return pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
        }
        return null;
      }

      if (n > 4) {
        const pts = matToPoints(approx);
        const corners = extremeCorners(pts);
        if (isConvexQuad(corners) && isValidDocumentShape(corners, imgWidth, imgHeight)) {
          return corners.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
        }
        return null;
      }

      return null;
    } finally {
      approx.delete();
    }
  } finally {
    hull.delete();
  }
}

/**
 * Cherche les meilleurs 4 coins dans un ensemble de contours.
 * Trie par aire décroissante, essaie les 5 plus grands > minArea.
 */
function findQuadInContours(cv, contours, minArea, imgWidth, imgHeight) {
  // Collecter (area, index)
  const candidates = [];
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const a = cv.contourArea(c);
    if (a >= minArea) candidates.push({ idx: i, area: a });
  }
  // Trier par aire décroissante
  candidates.sort((a, b) => b.area - a.area);

  for (let k = 0; k < Math.min(5, candidates.length); k++) {
    const contour = contours.get(candidates[k].idx);
    const quad = extractQuadFromContour(cv, contour, imgWidth, imgHeight);
    if (quad) return quad;
  }
  return null;
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Détecte le contour d'un document dans une ImageData.
 * Stratégie unique (remplace les 7 méthodes de l'ancienne version) :
 *   1. Grayscale → GaussianBlur(5,5)
 *   2. Canny adaptatif (sigma=0.33 sur médiane) → dilate 5×5
 *   3. findContours RETR_LIST → 5 plus grands > 8% de l'image
 *   4. convexHull → approxPolyDP (ε=0.02*périmètre)
 *      • 4 pts  → validation → retourne
 *      • >4 pts → 4 coins extrêmes → validation → retourne
 *   5. Fallback : adaptiveThreshold → même pipeline
 *   6. Last resort : coins complets (5% de marge)
 *
 * @param {ImageData} imageData
 * @returns {Array<{x,y}>|null} 4 coins triés TL, TR, BR, BL
 */
export function detectDocumentContour(imageData) {
  if (!isOpenCvReady()) return null;

  const cv = window.cv;
  const mats = [];
  const t = m => { mats.push(m); return m; };

  try {
    const src = t(cv.matFromImageData(imageData));
    const w = src.cols;
    const h = src.rows;
    const imgArea = w * h;
    const minArea = imgArea * 0.08; // 8% minimum

    // 1. Grayscale
    const gray = t(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 2. Blur
    const blurred = t(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // ── Tentative 1 : Canny adaptatif ──────────────────────────────────────
    const median = estimateMedian(blurred);
    const sigma = 0.33;
    const low  = Math.max(0,   (1.0 - sigma) * median);
    const high = Math.min(255, (1.0 + sigma) * median);

    const edges = t(new cv.Mat());
    cv.Canny(blurred, edges, low, high);

    // Dilate 5×5 pour fermer les brèches
    const kernel5 = t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
    const morphed = t(new cv.Mat());
    cv.dilate(edges, morphed, kernel5);

    let contours  = t(new cv.MatVector());
    let hierarchy = t(new cv.Mat());
    cv.findContours(morphed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let quad = findQuadInContours(cv, contours, minArea, w, h);
    if (quad) return sortCorners(quad);

    // ── Tentative 2 : adaptiveThreshold ────────────────────────────────────
    const thresh = t(new cv.Mat());
    cv.adaptiveThreshold(blurred, thresh, 255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 7);
    // Inverser si fond clair (texte sombre → bords sur fond clair)
    if (cv.mean(thresh)[0] > 127) cv.bitwise_not(thresh, thresh);

    const morphed2  = t(new cv.Mat());
    cv.dilate(thresh, morphed2, kernel5);

    const contours2  = t(new cv.MatVector());
    const hierarchy2 = t(new cv.Mat());
    cv.findContours(morphed2, contours2, hierarchy2, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    quad = findQuadInContours(cv, contours2, minArea, w, h);
    if (quad) return sortCorners(quad);

    // ── Last resort : coins pleine image avec 5% de marge ──────────────────
    const mx = Math.round(w * 0.05);
    const my = Math.round(h * 0.05);
    return sortCorners([
      { x: mx,     y: my },
      { x: w - mx, y: my },
      { x: w - mx, y: h - my },
      { x: mx,     y: h - my },
    ]);

  } catch (err) {
    return null;
  } finally {
    mats.forEach(m => { try { m.delete(); } catch (_) { /* déjà libéré */ } });
  }
}

// Alias de compatibilité ascendante
export const detectDocumentEdges = detectDocumentContour;
export const detectDocumentFast  = detectDocumentContour;

// ─── sortCorners ──────────────────────────────────────────────────────────────

/**
 * Trie les 4 coins en ordre TL, TR, BR, BL
 */
function sortCorners(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;

  const sorted = points.map(p => ({
    ...p,
    angle: Math.atan2(p.y - cy, p.x - cx)
  })).sort((a, b) => a.angle - b.angle);

  let tlIndex = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) { minSum = sum; tlIndex = i; }
  }

  const result = [];
  for (let i = 0; i < 4; i++) {
    const p = sorted[(tlIndex + i) % 4];
    result.push({ x: p.x, y: p.y });
  }
  return result;
}

// ─── Perspective transform ────────────────────────────────────────────────────

/**
 * Applique une transformation de perspective et retourne un nouveau canvas
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
      const widthTop    = Math.hypot(sourceCorners[1].x - sourceCorners[0].x, sourceCorners[1].y - sourceCorners[0].y);
      const widthBottom = Math.hypot(sourceCorners[2].x - sourceCorners[3].x, sourceCorners[2].y - sourceCorners[3].y);
      const heightLeft  = Math.hypot(sourceCorners[3].x - sourceCorners[0].x, sourceCorners[3].y - sourceCorners[0].y);
      const heightRight = Math.hypot(sourceCorners[2].x - sourceCorners[1].x, sourceCorners[2].y - sourceCorners[1].y);
      outputWidth  = Math.round(Math.max(widthTop,  widthBottom));
      outputHeight = Math.round(Math.max(heightLeft, heightRight));
    }

    if (outputWidth <= 0 || outputHeight <= 0) return canvas;

    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      sourceCorners[0].x, sourceCorners[0].y,
      sourceCorners[1].x, sourceCorners[1].y,
      sourceCorners[2].x, sourceCorners[2].y,
      sourceCorners[3].x, sourceCorners[3].y,
    ]);
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outputWidth, 0,
      outputWidth, outputHeight,
      0, outputHeight,
    ]);

    M   = cv.getPerspectiveTransform(srcTri, dstTri);
    dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(outputWidth, outputHeight));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width  = outputWidth;
    outputCanvas.height = outputHeight;
    cv.imshow(outputCanvas, dst);
    return outputCanvas;

  } catch (err) {
    console.error('Perspective transform error:', err);
    return canvas;
  } finally {
    if (src)    src.delete();
    if (dst)    dst.delete();
    if (M)      M.delete();
    if (srcTri) srcTri.delete();
    if (dstTri) dstTri.delete();
  }
}

// ─── Filtres d'amélioration ───────────────────────────────────────────────────

/**
 * Filtre Noir & Blanc - Binaire pur (aucun gris)
 */
export function enhanceBlackAndWhite(imageData) {
  const data = imageData.data;
  const grayValues = [];
  for (let i = 0; i < data.length; i += 4) {
    grayValues.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
  }
  const sorted = [...grayValues].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.85)];
  let idx = 0;
  for (let i = 0; i < data.length; i += 4) {
    const value = grayValues[idx++] > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  return imageData;
}

/**
 * Filtre Gris Pro - Niveaux de gris optimisés avec contraste et netteté
 */
export function enhanceGrayscale(imageData) {
  if (!isOpenCvReady()) return imageData;
  const cv = window.cv;
  const mats = [];
  const track = m => { mats.push(m); return m; };
  try {
    const src      = track(cv.matFromImageData(imageData));
    const gray     = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const clahe    = new cv.CLAHE(3.0, new cv.Size(8, 8));
    const enhanced = track(new cv.Mat());
    clahe.apply(gray, enhanced);
    clahe.delete();
    const blurred  = track(new cv.Mat());
    cv.GaussianBlur(enhanced, blurred, new cv.Size(0, 0), 1.5);
    const sharp    = track(new cv.Mat());
    cv.addWeighted(enhanced, 1.5, blurred, -0.5, 0, sharp);
    const normalized = track(new cv.Mat());
    cv.normalize(sharp, normalized, 0, 255, cv.NORM_MINMAX);
    const rgbaDst  = track(new cv.Mat());
    cv.cvtColor(normalized, rgbaDst, cv.COLOR_GRAY2RGBA);
    return new ImageData(new Uint8ClampedArray(rgbaDst.data), rgbaDst.cols, rgbaDst.rows);
  } catch (err) {
    console.error('Enhance Gray error:', err);
    return imageData;
  } finally {
    mats.forEach(m => { try { m.delete(); } catch (_e) { /* ignore */ } });
  }
}

/**
 * Filtre Couleur Pro - Couleurs vibrantes avec netteté et contraste améliorés
 */
export function enhanceColor(imageData) {
  if (!isOpenCvReady()) return imageData;
  const cv = window.cv;
  const mats = [];
  const track = m => { mats.push(m); return m; };
  try {
    const src      = track(cv.matFromImageData(imageData));
    const rgb      = track(new cv.Mat());
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    const lab      = track(new cv.Mat());
    cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
    const channels = track(new cv.MatVector());
    cv.split(lab, channels);
    const L = channels.get(0);
    const a = channels.get(1);
    const b = channels.get(2);
    const clahe = new cv.CLAHE(2.5, new cv.Size(8, 8));
    clahe.apply(L, L);
    clahe.delete();
    const boostFactor = 1.15;
    a.convertTo(a, -1, boostFactor, 128 * (1 - boostFactor));
    b.convertTo(b, -1, boostFactor, 128 * (1 - boostFactor));
    cv.merge(channels, lab);
    const enhanced = track(new cv.Mat());
    cv.cvtColor(lab, enhanced, cv.COLOR_Lab2RGB);
    const blurred  = track(new cv.Mat());
    cv.GaussianBlur(enhanced, blurred, new cv.Size(0, 0), 1.5);
    const sharp    = track(new cv.Mat());
    cv.addWeighted(enhanced, 1.4, blurred, -0.4, 0, sharp);
    const rgbaDst  = track(new cv.Mat());
    cv.cvtColor(sharp, rgbaDst, cv.COLOR_RGB2RGBA);
    return new ImageData(new Uint8ClampedArray(rgbaDst.data), rgbaDst.cols, rgbaDst.rows);
  } catch (err) {
    console.error('Enhance Color error:', err);
    return imageData;
  } finally {
    mats.forEach(m => { try { m.delete(); } catch (_e) { /* ignore */ } });
  }
}

/**
 * Détecte le meilleur mode (stub)
 */
export function detectBestMode(_imageData) {
  return 'bw';
}

// ─── ClearScan ───────────────────────────────────────────────────────────────

/**
 * Filtre ClearScan : binarisation adaptative locale + netteté
 */
export function enhanceClearScan(imageData) {
  if (isOpenCvReady()) return _clearScanCV(imageData);
  return _clearScanJS(imageData);
}

function _clearScanCV(imageData) {
  const cv = window.cv;
  const mats = [];
  const t = m => { mats.push(m); return m; };
  try {
    const src       = t(cv.matFromImageData(imageData));
    const gray      = t(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const clahe     = new cv.CLAHE(1.5, new cv.Size(16, 16));
    const equalized = t(new cv.Mat());
    clahe.apply(gray, equalized);
    clahe.delete();
    const blurred   = t(new cv.Mat());
    cv.GaussianBlur(equalized, blurred, new cv.Size(3, 3), 0);
    const thresh    = t(new cv.Mat());
    cv.adaptiveThreshold(blurred, thresh, 255,
      cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 51, 18);
    const blurredThresh = t(new cv.Mat());
    cv.GaussianBlur(thresh, blurredThresh, new cv.Size(0, 0), 0.8);
    const sharp     = t(new cv.Mat());
    cv.addWeighted(thresh, 1.5, blurredThresh, -0.5, 0, sharp);
    const kernel    = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    cv.morphologyEx(sharp, sharp, cv.MORPH_OPEN, kernel);
    kernel.delete();
    const rgba      = t(new cv.Mat());
    cv.cvtColor(sharp, rgba, cv.COLOR_GRAY2RGBA);
    return new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows);
  } catch (err) {
    console.error('ClearScan CV error:', err);
    return imageData;
  } finally {
    mats.forEach(m => { try { m.delete(); } catch (_e) { /* ignore */ } });
  }
}

function _clearScanJS(imageData) {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  const sat = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      sat[y * (width + 1) + x] = gray[(y - 1) * width + (x - 1)]
        + sat[(y - 1) * (width + 1) + x]
        + sat[y * (width + 1) + (x - 1)]
        - sat[(y - 1) * (width + 1) + (x - 1)];
    }
  }
  const S = Math.round(Math.max(width, height) / 16);
  const T = 0.15;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - S);
      const y1 = Math.max(0, y - S);
      const x2 = Math.min(width  - 1, x + S);
      const y2 = Math.min(height - 1, y + S);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = sat[(y2 + 1) * (width + 1) + (x2 + 1)]
                - sat[y1 * (width + 1) + (x2 + 1)]
                - sat[(y2 + 1) * (width + 1) + x1]
                + sat[y1 * (width + 1) + x1];
      const value = (gray[y * width + x] * count <= sum * (1 - T)) ? 0 : 255;
      const idx   = (y * width + x) * 4;
      output.data[idx]     = value;
      output.data[idx + 1] = value;
      output.data[idx + 2] = value;
      output.data[idx + 3] = 255;
    }
  }
  return output;
}

// ─── Magic Color ──────────────────────────────────────────────────────────────

/**
 * Filtre Magic Color : suppression des ombres + couleurs préservées
 */
export function enhanceMagicColor(imageData) {
  if (!isOpenCvReady()) return enhanceColor(imageData);
  const cv = window.cv;
  const mats = [];
  const t = m => { mats.push(m); return m; };
  try {
    const src        = t(cv.matFromImageData(imageData));
    const rgb        = t(new cv.Mat());
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    const f32        = t(new cv.Mat());
    rgb.convertTo(f32, cv.CV_32F);
    const sigma      = Math.max(src.cols, src.rows) / 20;
    const bg         = t(new cv.Mat());
    cv.GaussianBlur(f32, bg, new cv.Size(0, 0), sigma);
    const normalized = t(new cv.Mat());
    cv.divide(f32, bg, normalized, 200.0);
    cv.threshold(normalized, normalized, 255, 255, cv.THRESH_TRUNC);
    cv.threshold(normalized, normalized, 0,   0,   cv.THRESH_TOZERO);
    const u8         = t(new cv.Mat());
    normalized.convertTo(u8, cv.CV_8U);
    const blurSharp  = t(new cv.Mat());
    cv.GaussianBlur(u8, blurSharp, new cv.Size(0, 0), 1.0);
    const sharp      = t(new cv.Mat());
    cv.addWeighted(u8, 1.3, blurSharp, -0.3, 0, sharp);
    const lab        = t(new cv.Mat());
    cv.cvtColor(sharp, lab, cv.COLOR_RGB2Lab);
    const channels   = t(new cv.MatVector());
    cv.split(lab, channels);
    const a          = t(channels.get(1));
    const b          = t(channels.get(2));
    a.convertTo(a, -1, 1.1, 128 * (1 - 1.1));
    b.convertTo(b, -1, 1.1, 128 * (1 - 1.1));
    channels.set(1, a);
    channels.set(2, b);
    cv.merge(channels, lab);
    const colorResult = t(new cv.Mat());
    cv.cvtColor(lab, colorResult, cv.COLOR_Lab2RGB);
    const rgba        = t(new cv.Mat());
    cv.cvtColor(colorResult, rgba, cv.COLOR_RGB2RGBA);
    return new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows);
  } catch (err) {
    console.error('MagicColor error:', err);
    return imageData;
  } finally {
    mats.forEach(m => { try { m.delete(); } catch (_e) { /* ignore */ } });
  }
}
