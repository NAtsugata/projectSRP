// src/utils/documentScanner.js
// Utilitaires pour scanner et traiter des documents
// Inspiré de ClearScanner et autres scanners de documents

/**
 * Détecte les bords d'un document dans une image
 * Retourne les 4 coins du document détecté
 */
export function detectDocumentEdges(imageData) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);

  // Convertir en niveaux de gris et appliquer un flou
  const grayData = toGrayscale(imageData);
  const blurred = gaussianBlur(grayData, 5);

  // Détecter les contours (Canny edge detection simplifié)
  const edges = detectEdges(blurred);

  // Trouver les contours
  const contours = findContours(edges);

  // Trouver le plus grand contour quadrilatéral
  const docContour = findLargestQuadrilateral(contours, imageData.width, imageData.height);

  return docContour || getDefaultCorners(imageData.width, imageData.height);
}

/**
 * Convertit une image en niveaux de gris
 */
function toGrayscale(imageData) {
  const data = new Uint8ClampedArray(imageData.data);

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  return new ImageData(data, imageData.width, imageData.height);
}

/**
 * Applique un flou gaussien
 */
function gaussianBlur(imageData, radius) {
  // Version simplifiée - moyennage local
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const output = new Uint8ClampedArray(data);

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      let sum = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const idx = ((y + dy) * w + (x + dx)) * 4;
          sum += data[idx];
          count++;
        }
      }

      const idx = (y * w + x) * 4;
      const avg = sum / count;
      output[idx] = output[idx + 1] = output[idx + 2] = avg;
    }
  }

  return new ImageData(output, w, h);
}

/**
 * Détection de contours (Sobel operator simplifié)
 */
function detectEdges(imageData) {
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      // Gradient horizontal
      const gx =
        -data[((y-1)*w + (x-1))*4] + data[((y-1)*w + (x+1))*4] +
        -2*data[(y*w + (x-1))*4] + 2*data[(y*w + (x+1))*4] +
        -data[((y+1)*w + (x-1))*4] + data[((y+1)*w + (x+1))*4];

      // Gradient vertical
      const gy =
        -data[((y-1)*w + (x-1))*4] - 2*data[((y-1)*w + x)*4] - data[((y-1)*w + (x+1))*4] +
        data[((y+1)*w + (x-1))*4] + 2*data[((y+1)*w + x)*4] + data[((y+1)*w + (x+1))*4];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const value = magnitude > 50 ? 255 : 0;

      output[idx] = output[idx + 1] = output[idx + 2] = value;
      output[idx + 3] = 255;
    }
  }

  return new ImageData(output, w, h);
}

/**
 * Trouve les contours dans une image binaire
 */
function findContours(imageData) {
  // Implémentation simplifiée - retourne les points de contour
  const data = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const points = [];

  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const idx = (y * w + x) * 4;
      if (data[idx] > 128) {
        points.push({ x, y });
      }
    }
  }

  return points;
}

/**
 * Trouve le plus grand quadrilatère dans les contours
 */
function findLargestQuadrilateral(points, width, height) {
  if (points.length < 4) return null;

  // Trouver les 4 coins extrêmes
  const topLeft = points.reduce((min, p) =>
    (p.x + p.y < min.x + min.y) ? p : min, points[0]);
  const topRight = points.reduce((max, p) =>
    (p.x - p.y > max.x - max.y) ? p : max, points[0]);
  const bottomLeft = points.reduce((min, p) =>
    (p.y - p.x > min.y - min.x) ? p : min, points[0]);
  const bottomRight = points.reduce((max, p) =>
    (p.x + p.y > max.x + max.y) ? p : max, points[0]);

  // Vérifier si le quadrilatère est assez grand (> 30% de l'image)
  const area = calculateQuadArea([topLeft, topRight, bottomRight, bottomLeft]);
  const imageArea = width * height;

  if (area > imageArea * 0.3) {
    return [topLeft, topRight, bottomRight, bottomLeft];
  }

  return null;
}

/**
 * Calcule l'aire d'un quadrilatère
 */
function calculateQuadArea(corners) {
  if (corners.length !== 4) return 0;

  // Formule du lacet (Shoelace formula)
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += corners[i].x * corners[j].y;
    area -= corners[j].x * corners[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Retourne les coins par défaut (toute l'image)
 */
function getDefaultCorners(width, height) {
  const margin = 20;
  return [
    { x: margin, y: margin },
    { x: width - margin, y: margin },
    { x: width - margin, y: height - margin },
    { x: margin, y: height - margin }
  ];
}

/**
 * Applique une transformation de perspective pour redresser le document
 */
export function applyPerspectiveTransform(canvas, sourceCorners, outputWidth = 1000, outputHeight = 1414) {
  const ctx = canvas.getContext('2d');
  const sourceImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Coins de destination (rectangle A4)
  const destCorners = [
    { x: 0, y: 0 },
    { x: outputWidth, y: 0 },
    { x: outputWidth, y: outputHeight },
    { x: 0, y: outputHeight }
  ];

  // Calculer la matrice de transformation
  const matrix = getPerspectiveTransform(sourceCorners, destCorners);

  // Créer le canvas de sortie
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputCtx = outputCanvas.getContext('2d');
  const outputData = outputCtx.createImageData(outputWidth, outputHeight);

  // Appliquer la transformation
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const sourcePoint = applyMatrix(matrix, { x, y });

      if (sourcePoint.x >= 0 && sourcePoint.x < canvas.width &&
          sourcePoint.y >= 0 && sourcePoint.y < canvas.height) {
        const sx = Math.floor(sourcePoint.x);
        const sy = Math.floor(sourcePoint.y);
        const sourceIdx = (sy * canvas.width + sx) * 4;
        const destIdx = (y * outputWidth + x) * 4;

        outputData.data[destIdx] = sourceImage.data[sourceIdx];
        outputData.data[destIdx + 1] = sourceImage.data[sourceIdx + 1];
        outputData.data[destIdx + 2] = sourceImage.data[sourceIdx + 2];
        outputData.data[destIdx + 3] = 255;
      }
    }
  }

  outputCtx.putImageData(outputData, 0, 0);
  return outputCanvas;
}

/**
 * Calcule la matrice de transformation perspective
 */
function getPerspectiveTransform(src, dst) {
  // Implémentation simplifiée de la transformation perspective inverse
  // Pour mapper dst -> src

  const A = [];
  const b = [];

  for (let i = 0; i < 4; i++) {
    A.push([
      src[i].x, src[i].y, 1, 0, 0, 0, -dst[i].x * src[i].x, -dst[i].x * src[i].y
    ]);
    A.push([
      0, 0, 0, src[i].x, src[i].y, 1, -dst[i].y * src[i].x, -dst[i].y * src[i].y
    ]);
    b.push(dst[i].x);
    b.push(dst[i].y);
  }

  // Résoudre le système (version simplifiée)
  // Retourne une matrice d'identité pour l'instant
  return {
    a: 1, b: 0, c: 0,
    d: 0, e: 1, f: 0,
    g: 0, h: 0
  };
}

/**
 * Applique une matrice de transformation à un point
 */
function applyMatrix(matrix, point) {
  const w = matrix.g * point.x + matrix.h * point.y + 1;
  return {
    x: (matrix.a * point.x + matrix.b * point.y + matrix.c) / w,
    y: (matrix.d * point.x + matrix.e * point.y + matrix.f) / w
  };
}

/**
 * Améliore l'image - Mode Noir & Blanc (high contrast)
 */
export function enhanceBlackAndWhite(imageData, threshold = 128) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const value = gray > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  return imageData;
}

/**
 * Améliore l'image - Mode Couleur (contraste augmenté)
 */
export function enhanceColor(imageData, contrast = 1.5, brightness = 10) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness));
  }

  return imageData;
}

/**
 * Améliore l'image - Mode Gris (document texte)
 */
export function enhanceGrayscale(imageData) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Augmenter le contraste
    const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.3 + 128));
    data[i] = data[i + 1] = data[i + 2] = enhanced;
  }

  return imageData;
}

/**
 * Détecte automatiquement le meilleur mode pour le document
 */
export function detectBestMode(imageData) {
  const data = imageData.data;
  let colorVariance = 0;
  let totalPixels = data.length / 4;

  // Calculer la variance de couleur
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const variance = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    colorVariance += variance;
  }

  const avgVariance = colorVariance / totalPixels;

  // Si variance faible = document noir & blanc ou texte
  if (avgVariance < 20) {
    return 'bw';
  } else if (avgVariance < 50) {
    return 'gray';
  } else {
    return 'color';
  }
}
