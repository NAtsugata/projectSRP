// src/utils/jscanifyDetector.js
// Document detection - Pure JavaScript implementation
// No external dependencies, works offline

import logger from './logger';

/**
 * Detect document edges in an image using pure JavaScript
 * Uses Canny-like edge detection and contour finding
 */
export const detectDocument = async (input, options = {}) => {
  const {
    outputWidth = 595,
    outputHeight = 842,
    edgeThreshold = 50,
    minAreaRatio = 0.1
  } = options;

  try {
    logger.log('[DocumentDetector] Starting detection...');
    const startTime = performance.now();

    // Load image
    const img = await loadImage(input);
    const { width, height } = img;

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);

    // Convert to grayscale
    const gray = toGrayscale(imageData);

    // Apply Gaussian blur
    const blurred = gaussianBlur(gray, width, height);

    // Detect edges using Sobel
    const edges = sobelEdgeDetection(blurred, width, height, edgeThreshold);

    // Find contours (simplified - find largest quadrilateral)
    const corners = findDocumentCorners(edges, width, height, minAreaRatio);

    const elapsed = performance.now() - startTime;
    logger.log(`[DocumentDetector] Detection completed in ${elapsed.toFixed(2)}ms`);

    // Get original as data URL
    const original = canvas.toDataURL('image/jpeg', 0.9);

    if (corners && corners.length === 4) {
      // Create preview with corners highlighted
      const preview = drawCornersPreview(canvas, corners);

      // Apply perspective correction
      const transformed = perspectiveTransform(img, corners, outputWidth, outputHeight);

      return {
        detected: true,
        corners,
        original,
        preview,
        transformed,
        confidence: 80,
        processingTime: elapsed,
        method: 'pure-js'
      };
    }

    return {
      detected: false,
      corners: null,
      original,
      preview: null,
      transformed: null,
      confidence: 0,
      processingTime: elapsed,
      method: 'pure-js'
    };

  } catch (error) {
    logger.error('[DocumentDetector] Error:', error);
    throw error;
  }
};

/**
 * Load image from various sources
 */
const loadImage = (input) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = reject;

    if (input instanceof File || input instanceof Blob) {
      img.src = URL.createObjectURL(input);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
    } else if (typeof input === 'string') {
      img.src = input;
    } else if (input instanceof HTMLImageElement) {
      resolve(input);
    } else if (input instanceof HTMLCanvasElement) {
      img.src = input.toDataURL();
    } else {
      reject(new Error('Unsupported input type'));
    }
  });
};

/**
 * Convert image data to grayscale
 */
const toGrayscale = (imageData) => {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  return gray;
};

/**
 * Apply Gaussian blur (3x3 kernel)
 */
const gaussianBlur = (gray, width, height) => {
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ];
  const kernelSum = 16;
  const result = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kidx = (ky + 1) * 3 + (kx + 1);
          sum += gray[idx] * kernel[kidx];
        }
      }
      result[y * width + x] = sum / kernelSum;
    }
  }

  return result;
};

/**
 * Sobel edge detection
 */
const sobelEdgeDetection = (gray, width, height, threshold) => {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kidx = (ky + 1) * 3 + (kx + 1);
          gx += gray[idx] * sobelX[kidx];
          gy += gray[idx] * sobelY[kidx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude > threshold ? 255 : 0;
    }
  }

  return edges;
};

/**
 * Find document corners from edge image
 */
const findDocumentCorners = (edges, width, height, minAreaRatio) => {
  // Find edge points
  const edgePoints = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] > 0) {
        edgePoints.push({ x, y });
      }
    }
  }

  if (edgePoints.length < 100) {
    return null;
  }

  // Find convex hull
  const hull = convexHull(edgePoints);

  if (hull.length < 4) {
    return null;
  }

  // Simplify to 4 corners using Douglas-Peucker
  const simplified = douglasPeucker(hull, Math.max(width, height) * 0.02);

  // If we don't have exactly 4 corners, try to find the best 4
  let corners;
  if (simplified.length === 4) {
    corners = simplified;
  } else if (simplified.length > 4) {
    corners = findBest4Corners(simplified);
  } else {
    return null;
  }

  // Check minimum area
  const area = polygonArea(corners);
  const imageArea = width * height;
  if (area < imageArea * minAreaRatio) {
    return null;
  }

  // Order corners: TL, TR, BR, BL
  return orderCorners(corners);
};

/**
 * Convex hull using Graham scan
 */
const convexHull = (points) => {
  if (points.length < 3) return points;

  // Find lowest point
  let lowest = points[0];
  for (const p of points) {
    if (p.y > lowest.y || (p.y === lowest.y && p.x < lowest.x)) {
      lowest = p;
    }
  }

  // Sort by polar angle
  const sorted = points.slice().sort((a, b) => {
    const angleA = Math.atan2(a.y - lowest.y, a.x - lowest.x);
    const angleB = Math.atan2(b.y - lowest.y, b.x - lowest.x);
    return angleA - angleB;
  });

  // Build hull
  const hull = [];
  for (const p of sorted) {
    while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }

  return hull;
};

/**
 * Cross product for convex hull
 */
const cross = (o, a, b) => {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
};

/**
 * Douglas-Peucker line simplification
 */
const douglasPeucker = (points, epsilon) => {
  if (points.length < 3) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
};

/**
 * Perpendicular distance from point to line
 */
const perpendicularDistance = (point, lineStart, lineEnd) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
};

/**
 * Find best 4 corners from a polygon with more vertices
 */
const findBest4Corners = (points) => {
  // Find 4 points that maximize the enclosed area
  let bestArea = 0;
  let bestCorners = null;

  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const quad = [points[i], points[j], points[k], points[l]];
          const area = polygonArea(quad);
          if (area > bestArea) {
            bestArea = area;
            bestCorners = quad;
          }
        }
      }
    }
  }

  return bestCorners;
};

/**
 * Calculate polygon area using shoelace formula
 */
const polygonArea = (points) => {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
};

/**
 * Order corners: top-left, top-right, bottom-right, bottom-left
 */
const orderCorners = (corners) => {
  // Find center
  const cx = corners.reduce((sum, c) => sum + c.x, 0) / 4;
  const cy = corners.reduce((sum, c) => sum + c.y, 0) / 4;

  // Sort by angle from center
  const sorted = corners.slice().sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Find top-left (minimum x + y)
  let minSum = Infinity;
  let tlIdx = 0;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      tlIdx = i;
    }
  }

  // Rotate to start with top-left
  const result = [];
  for (let i = 0; i < 4; i++) {
    result.push(sorted[(tlIdx + i) % 4]);
  }

  return result;
};

/**
 * Draw corners preview on canvas
 */
const drawCornersPreview = (canvas, corners) => {
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;
  const ctx = previewCanvas.getContext('2d');

  // Copy original
  ctx.drawImage(canvas, 0, 0);

  // Draw polygon
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = Math.max(3, canvas.width / 200);
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw corner points
  const radius = Math.max(8, canvas.width / 80);
  corners.forEach(corner => {
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  return previewCanvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Apply perspective transform to extract document
 */
const perspectiveTransform = (img, corners, outputWidth, outputHeight) => {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');

  // Source corners
  const [tl, tr, br, bl] = corners;

  // Use canvas transforms for a simpler perspective correction
  // This is an approximation but works well for most documents

  // Calculate source dimensions
  const srcWidth = Math.max(
    Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2),
    Math.sqrt((br.x - bl.x) ** 2 + (br.y - bl.y) ** 2)
  );
  const srcHeight = Math.max(
    Math.sqrt((bl.x - tl.x) ** 2 + (bl.y - tl.y) ** 2),
    Math.sqrt((br.x - tr.x) ** 2 + (br.y - tr.y) ** 2)
  );

  // Draw using bilinear interpolation approximation
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const u0 = i / steps;
      const v0 = j / steps;
      const u1 = (i + 1) / steps;
      const v1 = (j + 1) / steps;

      // Bilinear interpolation for source points
      const srcX0 = bilinearInterp(tl.x, tr.x, bl.x, br.x, u0, v0);
      const srcY0 = bilinearInterp(tl.y, tr.y, bl.y, br.y, u0, v0);
      const srcX1 = bilinearInterp(tl.x, tr.x, bl.x, br.x, u1, v1);
      const srcY1 = bilinearInterp(tl.y, tr.y, bl.y, br.y, u1, v1);

      // Destination points
      const dstX0 = u0 * outputWidth;
      const dstY0 = v0 * outputHeight;
      const dstW = outputWidth / steps;
      const dstH = outputHeight / steps;

      // Draw tile
      try {
        ctx.drawImage(
          img,
          srcX0, srcY0,
          srcX1 - srcX0 + 1, srcY1 - srcY0 + 1,
          dstX0, dstY0,
          dstW, dstH
        );
      } catch (e) {
        // Skip invalid tiles
      }
    }
  }

  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Bilinear interpolation helper
 */
const bilinearInterp = (tl, tr, bl, br, u, v) => {
  const top = tl + (tr - tl) * u;
  const bottom = bl + (br - bl) * u;
  return top + (bottom - top) * v;
};

/**
 * Check if detector is ready (always true for pure JS)
 */
export const isOpenCVLoaded = () => true;

/**
 * Preload (no-op for pure JS)
 */
export const preloadOpenCV = async () => true;

export default {
  detectDocument,
  isOpenCVLoaded,
  preloadOpenCV
};
