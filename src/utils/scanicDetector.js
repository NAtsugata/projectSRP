// src/utils/scanicDetector.js
// Document detection using Scanic library
// Lightweight (~100KB) and fast alternative to OpenCV

import { scanDocument } from 'scanic';
import logger from './logger';

/**
 * Detect document in an image using Scanic
 * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} input - Image source
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Detection result
 */
export const detectWithScanic = async (input, options = {}) => {
  const {
    mode = 'detect', // 'detect' or 'extract'
    maxProcessingDimension = 800,
    outputFormat = 'canvas' // 'canvas', 'imagedata', 'dataurl'
  } = options;

  try {
    // Convert input to image element if needed
    let imageElement = input;

    if (typeof input === 'string') {
      // Data URL or image URL
      imageElement = await loadImageFromUrl(input);
    } else if (input instanceof Blob || input instanceof File) {
      imageElement = await loadImageFromBlob(input);
    }

    logger.log('[Scanic] Starting detection...');
    const startTime = performance.now();

    // Run Scanic detection
    const result = await scanDocument(imageElement, {
      mode,
      output: outputFormat,
      maxProcessingDimension
    });

    const elapsed = performance.now() - startTime;
    logger.log(`[Scanic] Detection completed in ${elapsed.toFixed(2)}ms`);

    if (result.success) {
      // Convert corners to our format (percentage-based)
      const corners = result.corners.map(corner => ({
        x: corner.x,
        y: corner.y
      }));

      // Order corners: top-left, top-right, bottom-right, bottom-left
      const orderedCorners = orderCorners(corners);

      logger.log(`[Scanic] Document detected with ${corners.length} corners`);

      return {
        detected: true,
        contour: orderedCorners,
        corners: orderedCorners,
        confidence: 85, // Scanic doesn't provide confidence, use reasonable default
        method: 'scanic',
        processingTime: elapsed,
        output: result.output || null,
        originalWidth: imageElement.width || imageElement.naturalWidth,
        originalHeight: imageElement.height || imageElement.naturalHeight
      };
    } else {
      logger.log('[Scanic] No document detected');
      return {
        detected: false,
        contour: null,
        corners: null,
        method: 'scanic',
        processingTime: elapsed,
        error: result.error || 'No document found'
      };
    }
  } catch (error) {
    logger.error('[Scanic] Detection error:', error);
    return {
      detected: false,
      contour: null,
      method: 'scanic',
      error: error.message
    };
  }
};

/**
 * Extract and straighten document from image
 * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} input
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export const extractWithScanic = async (input, options = {}) => {
  return detectWithScanic(input, {
    ...options,
    mode: 'extract'
  });
};

/**
 * Load image from URL or data URL
 */
const loadImageFromUrl = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Load image from Blob/File
 */
const loadImageFromBlob = (blob) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
};

/**
 * Order corners in clockwise order: TL, TR, BR, BL
 */
const orderCorners = (corners) => {
  if (!corners || corners.length !== 4) return corners;

  // Find center point
  const centerX = corners.reduce((sum, c) => sum + c.x, 0) / 4;
  const centerY = corners.reduce((sum, c) => sum + c.y, 0) / 4;

  // Sort by angle from center
  const sorted = corners.map(c => ({
    ...c,
    angle: Math.atan2(c.y - centerY, c.x - centerX)
  })).sort((a, b) => a.angle - b.angle);

  // Find top-left (smallest x + y sum)
  let minSum = Infinity;
  let tlIndex = 0;
  sorted.forEach((c, i) => {
    const sum = c.x + c.y;
    if (sum < minSum) {
      minSum = sum;
      tlIndex = i;
    }
  });

  // Rotate array to start with top-left
  const result = [];
  for (let i = 0; i < 4; i++) {
    const idx = (tlIndex + i) % 4;
    result.push({ x: sorted[idx].x, y: sorted[idx].y });
  }

  return result;
};

/**
 * Convert pixel corners to percentage (for overlay display)
 */
export const cornersToPercent = (corners, width, height) => {
  return corners.map(c => ({
    x: (c.x / width) * 100,
    y: (c.y / height) * 100
  }));
};

/**
 * Convert percentage corners to pixels
 */
export const cornersToPixels = (corners, width, height) => {
  return corners.map(c => ({
    x: (c.x / 100) * width,
    y: (c.y / 100) * height
  }));
};

const scanicDetector = {
  detectWithScanic,
  extractWithScanic,
  cornersToPercent,
  cornersToPixels
};

export default scanicDetector;
