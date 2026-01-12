/**
 * Document Detection Utility using OpenCV.js
 *
 * This utility detects document edges in an image and provides
 * automatic cropping and perspective correction.
 *
 * Enhanced with multi-strategy detection for better accuracy.
 */
import logger from './logger';

/**
 * Detection strategies with different parameters
 * Each strategy is optimized for different document/lighting conditions
 */
const DETECTION_STRATEGIES = [
  {
    name: 'standard',
    cannyLow: 30,
    cannyHigh: 100,
    blurSize: 5,
    dilateSize: 3,
    useClosing: true,
    useBilateral: false,
    claheClip: 2.0
  },
  {
    name: 'low_contrast',
    cannyLow: 10,
    cannyHigh: 50,
    blurSize: 5,
    dilateSize: 5,
    useClosing: true,
    useBilateral: false,
    claheClip: 3.0
  },
  {
    name: 'high_contrast',
    cannyLow: 50,
    cannyHigh: 150,
    blurSize: 3,
    dilateSize: 3,
    useClosing: false,
    useBilateral: true,
    claheClip: 2.0
  },
  {
    name: 'adaptive_threshold',
    useAdaptive: true,
    adaptiveBlockSize: 11,
    adaptiveC: 2,
    dilateSize: 5,
    useClosing: true
  },
  {
    name: 'aggressive',
    cannyLow: 5,
    cannyHigh: 30,
    blurSize: 7,
    dilateSize: 7,
    useClosing: true,
    useBilateral: false,
    claheClip: 4.0
  }
];

/**
 * Wait for OpenCV.js to be loaded
 * @returns {Promise<void>}
 */
export const waitForOpenCV = () => {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve();
      return;
    }

    const checkInterval = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error('OpenCV.js failed to load'));
    }, 10000);
  });
};

/**
 * Order points in clockwise order: top-left, top-right, bottom-right, bottom-left
 * @param {Array} points - Array of 4 points
 * @returns {Array} Ordered points
 */
const orderPoints = (points) => {
  // Sort by y-coordinate
  const sorted = points.sort((a, b) => a.y - b.y);

  // Top two points
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  // Bottom two points
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

  return [
    top[0],      // top-left
    top[1],      // top-right
    bottom[1],   // bottom-right
    bottom[0]    // bottom-left
  ];
};

/**
 * Reduce n points to 4 corners by finding extreme points
 * @param {Array} points - Array of n points
 * @returns {Array} 4 corner points
 */
const orderPointsToQuad = (points) => {
  // Trouver les 4 coins extrêmes
  const topLeft = points.reduce((min, p) =>
    (p.x + p.y < min.x + min.y) ? p : min, points[0]);
  const topRight = points.reduce((max, p) =>
    (p.x - p.y > max.x - max.y) ? p : max, points[0]);
  const bottomRight = points.reduce((max, p) =>
    (p.x + p.y > max.x + max.y) ? p : max, points[0]);
  const bottomLeft = points.reduce((min, p) =>
    (p.y - p.x > min.y - min.x) ? p : min, points[0]);

  return [topLeft, topRight, bottomRight, bottomLeft];
};

/**
 * Calculate the perimeter of a contour
 * @param {Object} contour - OpenCV contour
 * @returns {number} Perimeter
 */
const getContourPerimeter = (contour) => {
  return window.cv.arcLength(contour, true);
};

/**
 * Score a contour based on how likely it is to be a document
 * Higher score = more likely to be a document
 * @param {Array} corners - 4 corner points
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @returns {number} Score between 0 and 100
 */
const scoreContour = (corners, imageWidth, imageHeight) => {
  if (!corners || corners.length !== 4) return 0;

  let score = 0;
  const imageArea = imageWidth * imageHeight;

  // 1. Area score (larger = better, but not too large)
  const contourArea = Math.abs(
    (corners[0].x * corners[1].y - corners[1].x * corners[0].y) +
    (corners[1].x * corners[2].y - corners[2].x * corners[1].y) +
    (corners[2].x * corners[3].y - corners[3].x * corners[2].y) +
    (corners[3].x * corners[0].y - corners[0].x * corners[3].y)
  ) / 2;

  const areaRatio = contourArea / imageArea;
  if (areaRatio >= 0.1 && areaRatio <= 0.95) {
    score += 25 * Math.min(areaRatio * 2, 1); // Max 25 points
  }

  // 2. Aspect ratio score (documents are usually rectangular)
  const width1 = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
  const width2 = Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2));
  const height1 = Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2));
  const height2 = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));

  const avgWidth = (width1 + width2) / 2;
  const avgHeight = (height1 + height2) / 2;
  const aspectRatio = Math.max(avgWidth, avgHeight) / Math.min(avgWidth, avgHeight);

  // Common document ratios: A4 (1.41), Letter (1.29), Square (1.0)
  if (aspectRatio >= 1.0 && aspectRatio <= 2.0) {
    score += 25; // Good aspect ratio
  } else if (aspectRatio < 3.0) {
    score += 15; // Acceptable
  }

  // 3. Parallelism score (opposite sides should be similar length)
  const widthDiff = Math.abs(width1 - width2) / Math.max(width1, width2);
  const heightDiff = Math.abs(height1 - height2) / Math.max(height1, height2);
  const parallelScore = (1 - widthDiff) * 12.5 + (1 - heightDiff) * 12.5;
  score += parallelScore;

  // 4. Right angles score (corners should be close to 90 degrees)
  const angles = [];
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const p3 = corners[(i + 2) % 4];

    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 > 0 && mag2 > 0) {
      const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
      angles.push(Math.abs(90 - angle));
    }
  }

  if (angles.length === 4) {
    const avgAngleDeviation = angles.reduce((a, b) => a + b, 0) / 4;
    // Less deviation from 90 degrees = higher score
    const angleScore = Math.max(0, 25 - avgAngleDeviation);
    score += angleScore;
  }

  return Math.min(100, Math.max(0, score));
};

/**
 * Try detection with a specific strategy
 * @param {Object} src - OpenCV Mat source image
 * @param {Object} strategy - Detection strategy parameters
 * @param {number} imageArea - Total image area
 * @param {number} minArea - Minimum area threshold
 * @returns {Object|null} Detection result with corners and score
 */
const tryDetectionStrategy = (src, strategy, imageArea, minArea) => {
  const gray = new window.cv.Mat();
  const processed = new window.cv.Mat();
  const edges = new window.cv.Mat();
  const morphed = new window.cv.Mat();

  try {
    // Convert to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Apply CLAHE if specified
    if (strategy.claheClip) {
      const clahe = new window.cv.CLAHE(strategy.claheClip, new window.cv.Size(8, 8));
      clahe.apply(gray, processed);
      clahe.delete();
    } else {
      gray.copyTo(processed);
    }

    // Apply blur (bilateral or gaussian)
    const blurred = new window.cv.Mat();
    if (strategy.useBilateral) {
      // Bilateral filter preserves edges better
      window.cv.bilateralFilter(processed, blurred, 9, 75, 75);
    } else if (strategy.blurSize) {
      const ksize = new window.cv.Size(strategy.blurSize, strategy.blurSize);
      window.cv.GaussianBlur(processed, blurred, ksize, 0);
    } else {
      processed.copyTo(blurred);
    }

    // Edge detection
    if (strategy.useAdaptive) {
      // Adaptive thresholding for uneven lighting
      window.cv.adaptiveThreshold(
        blurred,
        edges,
        255,
        window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        window.cv.THRESH_BINARY_INV,
        strategy.adaptiveBlockSize || 11,
        strategy.adaptiveC || 2
      );
    } else {
      // Canny edge detection
      window.cv.Canny(blurred, edges, strategy.cannyLow, strategy.cannyHigh);
    }

    blurred.delete();

    // Morphological operations
    const kernel = window.cv.getStructuringElement(
      window.cv.MORPH_RECT,
      new window.cv.Size(strategy.dilateSize || 3, strategy.dilateSize || 3)
    );

    if (strategy.useClosing) {
      // Closing = dilation followed by erosion (closes gaps in contours)
      window.cv.morphologyEx(edges, morphed, window.cv.MORPH_CLOSE, kernel);
    } else {
      // Just dilation
      window.cv.dilate(edges, morphed, kernel);
    }

    kernel.delete();

    // Find contours
    const contours = new window.cv.MatVector();
    const hierarchy = new window.cv.Mat();
    window.cv.findContours(
      morphed,
      contours,
      hierarchy,
      window.cv.RETR_EXTERNAL,
      window.cv.CHAIN_APPROX_SIMPLE
    );

    // Find best document contour
    const documentContour = findDocumentContour(contours, imageArea, minArea);

    let result = null;

    if (documentContour && documentContour.rows === 4) {
      const corners = [];
      for (let i = 0; i < 4; i++) {
        corners.push({
          x: documentContour.data32S[i * 2],
          y: documentContour.data32S[i * 2 + 1]
        });
      }

      const score = scoreContour(corners, src.cols, src.rows);

      result = {
        corners,
        score,
        strategy: strategy.name
      };

      documentContour.delete();
    }

    // Cleanup
    contours.delete();
    hierarchy.delete();

    return result;

  } finally {
    // Always cleanup
    gray.delete();
    processed.delete();
    edges.delete();
    morphed.delete();
  }
};

/**
 * Find the largest contour with 4 corners (likely a document)
 * @param {Object} contours - OpenCV contours
 * @param {number} minArea - Minimum area threshold (percentage of image)
 * @returns {Object|null} Document contour or null
 */
const findDocumentContour = (contours, imageArea, minArea = 0.1) => {
  let maxArea = 0;
  let bestContour = null;
  let bestApprox = null;

  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = window.cv.contourArea(contour);

    // Skip if area is too small (less than 10% of image by default)
    if (area < imageArea * minArea) {
      contour.delete();
      continue;
    }

    // Approximate the contour to a polygon
    // Utiliser une tolérance plus élevée (0.05 au lieu de 0.03) pour être plus flexible
    const perimeter = getContourPerimeter(contour);
    const approx = new window.cv.Mat();
    window.cv.approxPolyDP(contour, approx, 0.05 * perimeter, true);

    // Check if the approximated contour has 4 points (quadrilateral)
    // Accepter aussi 5 ou 6 points si l'aire est grande (souvent causé par des coins légèrement arrondis)
    const isQuadrilateral = approx.rows === 4 || (approx.rows >= 5 && approx.rows <= 8 && area > maxArea);

    if (isQuadrilateral && area > maxArea) {
      // Si on a plus de 4 points, les réduire à 4 en prenant les coins extrêmes
      if (approx.rows > 4) {
        const points = [];
        for (let j = 0; j < approx.rows; j++) {
          points.push({
            x: approx.data32S[j * 2],
            y: approx.data32S[j * 2 + 1]
          });
        }

        // Trouver les 4 coins les plus extrêmes
        const orderedPoints = orderPointsToQuad(points);

        // Créer un nouveau Mat avec 4 points
        const newApprox = new window.cv.Mat(4, 1, window.cv.CV_32SC2);
        for (let j = 0; j < 4; j++) {
          newApprox.data32S[j * 2] = orderedPoints[j].x;
          newApprox.data32S[j * 2 + 1] = orderedPoints[j].y;
        }

        approx.delete();
        if (bestApprox) bestApprox.delete();
        if (bestContour) bestContour.delete();

        maxArea = area;
        bestContour = contour;
        bestApprox = newApprox;
      } else {
        // Exactement 4 points, parfait !
        if (bestApprox) bestApprox.delete();
        if (bestContour) bestContour.delete();

        maxArea = area;
        bestContour = contour;
        bestApprox = approx;
      }
    } else {
      contour.delete();
      approx.delete();
    }
  }

  return bestApprox;
};

/**
 * Apply perspective transform to extract and straighten the document
 * @param {HTMLImageElement} image - Source image
 * @param {Array} corners - Four corner points
 * @returns {string} Data URL of the transformed image
 */
const applyPerspectiveTransform = (src, corners) => {
  const ordered = orderPoints(corners);

  // Calculate width and height of the new image
  const widthTop = Math.sqrt(
    Math.pow(ordered[1].x - ordered[0].x, 2) +
    Math.pow(ordered[1].y - ordered[0].y, 2)
  );
  const widthBottom = Math.sqrt(
    Math.pow(ordered[2].x - ordered[3].x, 2) +
    Math.pow(ordered[2].y - ordered[3].y, 2)
  );
  const maxWidth = Math.max(widthTop, widthBottom);

  const heightLeft = Math.sqrt(
    Math.pow(ordered[3].x - ordered[0].x, 2) +
    Math.pow(ordered[3].y - ordered[0].y, 2)
  );
  const heightRight = Math.sqrt(
    Math.pow(ordered[2].x - ordered[1].x, 2) +
    Math.pow(ordered[2].y - ordered[1].y, 2)
  );
  const maxHeight = Math.max(heightLeft, heightRight);

  // Define destination points
  const dst = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
    0, 0,
    maxWidth - 1, 0,
    maxWidth - 1, maxHeight - 1,
    0, maxHeight - 1
  ]);

  // Define source points
  const srcPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
    ordered[0].x, ordered[0].y,
    ordered[1].x, ordered[1].y,
    ordered[2].x, ordered[2].y,
    ordered[3].x, ordered[3].y
  ]);

  // Get perspective transform matrix
  const M = window.cv.getPerspectiveTransform(srcPoints, dst);

  // Apply perspective transform
  const dsize = new window.cv.Size(maxWidth, maxHeight);
  const transformed = new window.cv.Mat();
  window.cv.warpPerspective(
    src,
    transformed,
    M,
    dsize,
    window.cv.INTER_LINEAR,
    window.cv.BORDER_CONSTANT,
    new window.cv.Scalar()
  );

  // Convert to canvas
  const canvas = document.createElement('canvas');
  window.cv.imshow(canvas, transformed);

  // Get data URL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

  // Cleanup
  dst.delete();
  srcPoints.delete();
  M.delete();
  transformed.delete();

  return dataUrl;
};

/**
 * Detect document in an image
 * @param {File|string} input - Image file or data URL
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Detection result
 */
export const detectDocument = async (input, options = {}) => {
  const {
    minArea = 0.1,        // Minimum area as percentage of image
    autoTransform = true,  // Automatically apply perspective transform
    drawContours = true,   // Draw detected contours on preview
    manualCorners = null   // Manual corners [{x, y}, {x, y}, {x, y}, {x, y}]
  } = options;

  try {
    // Wait for OpenCV to load
    await waitForOpenCV();

    // Load image
    const image = await loadImage(input);

    // Create canvas and get image data
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // Convert to OpenCV Mat
    const src = window.cv.imread(canvas);

    let result = {
      detected: false,
      original: canvas.toDataURL('image/jpeg', 0.9),
      preview: null,
      transformed: null,
      contour: null
    };

    let corners = null;

    // If manual corners are provided, use them directly
    if (manualCorners && Array.isArray(manualCorners) && manualCorners.length === 4) {
      result.detected = true;
      corners = manualCorners;
      result.contour = corners;
    } else {
      // Multi-strategy detection: try all strategies and pick the best result
      const imageArea = src.rows * src.cols;
      const effectiveMinArea = minArea < 0.1 ? minArea : 0.05;

      logger.log(`[Scanner] Starting multi-strategy detection (${DETECTION_STRATEGIES.length} strategies)`);
      logger.log(`[Scanner] Image: ${src.cols}x${src.rows}, Min area: ${(effectiveMinArea * 100).toFixed(1)}%`);

      let bestResult = null;

      for (const strategy of DETECTION_STRATEGIES) {
        try {
          const strategyResult = tryDetectionStrategy(src, strategy, imageArea, effectiveMinArea);

          if (strategyResult) {
            logger.log(`[Scanner] Strategy "${strategy.name}": score=${strategyResult.score.toFixed(1)}`);

            if (!bestResult || strategyResult.score > bestResult.score) {
              bestResult = strategyResult;
            }
          } else {
            logger.log(`[Scanner] Strategy "${strategy.name}": no detection`);
          }
        } catch (strategyError) {
          logger.warn(`[Scanner] Strategy "${strategy.name}" failed:`, strategyError.message);
        }
      }

      // Accept result if score is above threshold (40 = reasonable confidence)
      if (bestResult && bestResult.score >= 40) {
        result.detected = true;
        corners = bestResult.corners;
        result.contour = corners;
        result.confidence = bestResult.score;
        result.strategy = bestResult.strategy;

        logger.log(`[Scanner] Best result: strategy="${bestResult.strategy}", score=${bestResult.score.toFixed(1)}`);
      } else if (bestResult) {
        // Low confidence - still return but mark as uncertain
        result.detected = true;
        corners = bestResult.corners;
        result.contour = corners;
        result.confidence = bestResult.score;
        result.strategy = bestResult.strategy;
        result.lowConfidence = true;

        logger.log(`[Scanner] Low confidence result: strategy="${bestResult.strategy}", score=${bestResult.score.toFixed(1)}`);
      } else {
        logger.log('[Scanner] No valid document detected with any strategy');
      }
    }

    if (result.detected && corners) {

      // Draw contours on preview if requested (CCleaner-style overlay)
      if (drawContours) {
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = src.cols;
        previewCanvas.height = src.rows;
        const ctx = previewCanvas.getContext('2d');

        // Draw original image
        window.cv.imshow(previewCanvas, src);

        // Create dark overlay on entire image
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

        // Create path for the document area (to cut it out from overlay)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
          ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();

        // Cut out the document area from the dark overlay (using destination-out)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fill();

        // Add bright green glow effect around the document
        ctx.globalCompositeOperation = 'source-over';

        // Outer glow (larger, more transparent)
        ctx.shadowColor = 'rgba(0, 255, 0, 0.8)';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner bright border
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();

        // Draw corner points with glow effect
        corners.forEach((corner, idx) => {
          // Outer glow
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 15, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fill();

          // Middle circle
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 10, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
          ctx.fill();

          // Inner bright dot
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#ff0000';
          ctx.fill();

          // White center
          ctx.beginPath();
          ctx.arc(corner.x, corner.y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Label corners (optional)
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          const labels = ['TL', 'TR', 'BR', 'BL'];
          ctx.strokeText(labels[idx], corner.x + 18, corner.y + 5);
          ctx.fillText(labels[idx], corner.x + 18, corner.y + 5);
        });

        result.preview = previewCanvas.toDataURL('image/jpeg', 0.95);
      }

      // Apply perspective transform if requested
      if (autoTransform) {
        result.transformed = applyPerspectiveTransform(src, corners);
      }
    }

    // Cleanup
    src.delete();

    return result;

  } catch (error) {
    console.error('Document detection error:', error);
    throw error;
  }
};

/**
 * Load image from File or data URL
 * @param {File|string} input - Image file or data URL
 * @returns {Promise<HTMLImageElement>}
 */
const loadImage = (input) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = reject;

    if (typeof input === 'string') {
      // Data URL
      img.src = input;
    } else if (input instanceof File) {
      // File object
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(input);
    } else {
      reject(new Error('Invalid input type'));
    }
  });
};

/**
 * Manually adjust document corners and apply perspective transform
 * @param {string} imageDataUrl - Original image data URL
 * @param {Array} corners - Four corner points to adjust
 * @returns {Promise<string>} Transformed image data URL
 */
export const transformDocumentWithCorners = async (imageDataUrl, corners) => {
  try {
    await waitForOpenCV();

    const image = await loadImage(imageDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const src = window.cv.imread(canvas);
    const transformed = applyPerspectiveTransform(src, corners);

    src.delete();

    return transformed;
  } catch (error) {
    console.error('Transform error:', error);
    throw error;
  }
};

const documentDetectorUtils = {
  detectDocument,
  transformDocumentWithCorners,
  waitForOpenCV
};

export default documentDetectorUtils;
