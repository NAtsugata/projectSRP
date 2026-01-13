// src/utils/jscanifyDetector.js
// Document detection using jscanify + OpenCV.js
// Runs entirely in browser, no native dependencies

import logger from './logger';

let opencvLoaded = false;
let opencvLoading = false;
let jscanifyInstance = null;

const OPENCV_CDN = 'https://docs.opencv.org/4.7.0/opencv.js';

/**
 * Load OpenCV.js dynamically
 */
const loadOpenCV = () => {
  return new Promise((resolve, reject) => {
    if (opencvLoaded && window.cv) {
      resolve(window.cv);
      return;
    }

    if (opencvLoading) {
      // Wait for existing load
      const checkInterval = setInterval(() => {
        if (opencvLoaded && window.cv) {
          clearInterval(checkInterval);
          resolve(window.cv);
        }
      }, 100);
      return;
    }

    opencvLoading = true;
    logger.log('[jscanify] Loading OpenCV.js...');

    const script = document.createElement('script');
    script.src = OPENCV_CDN;
    script.async = true;

    script.onload = () => {
      // OpenCV.js needs time to initialize
      const checkReady = setInterval(() => {
        if (window.cv && window.cv.Mat) {
          clearInterval(checkReady);
          opencvLoaded = true;
          opencvLoading = false;
          logger.log('[jscanify] OpenCV.js loaded successfully');
          resolve(window.cv);
        }
      }, 50);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (!opencvLoaded) {
          opencvLoading = false;
          reject(new Error('OpenCV.js initialization timeout'));
        }
      }, 10000);
    };

    script.onerror = () => {
      opencvLoading = false;
      reject(new Error('Failed to load OpenCV.js'));
    };

    document.head.appendChild(script);
  });
};

/**
 * jscanify Scanner class (inline implementation)
 */
class Scanner {
  constructor() {
    this.cv = window.cv;
  }

  /**
   * Find document contour in image
   */
  findPaperContour(img) {
    const cv = this.cv;

    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur
    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // Apply Canny edge detection
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 75, 200);

    // Dilate to close gaps
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
    const dilated = new cv.Mat();
    cv.dilate(edges, dilated, kernel);

    // Find contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Find the largest 4-corner contour
    let maxArea = 0;
    let bestContour = null;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      if (area > maxArea) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          maxArea = area;
          if (bestContour) bestContour.delete();
          bestContour = approx.clone();
        }
        approx.delete();
      }
    }

    // Cleanup
    gray.delete();
    blurred.delete();
    edges.delete();
    kernel.delete();
    dilated.delete();
    hierarchy.delete();
    for (let i = 0; i < contours.size(); i++) {
      contours.get(i).delete();
    }
    contours.delete();

    return bestContour;
  }

  /**
   * Get corner points from contour
   */
  getCornerPoints(contour) {
    if (!contour || contour.rows !== 4) return null;

    const points = [];
    for (let i = 0; i < 4; i++) {
      points.push({
        x: contour.data32S[i * 2],
        y: contour.data32S[i * 2 + 1]
      });
    }

    // Sort points: top-left, top-right, bottom-right, bottom-left
    const sorted = this.orderPoints(points);
    return sorted;
  }

  /**
   * Order points clockwise starting from top-left
   */
  orderPoints(points) {
    // Find center
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / 4;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / 4;

    // Separate into top and bottom
    const top = points.filter(p => p.y < centerY).sort((a, b) => a.x - b.x);
    const bottom = points.filter(p => p.y >= centerY).sort((a, b) => b.x - a.x);

    // If not exactly 2 in each, use angle-based sorting
    if (top.length !== 2 || bottom.length !== 2) {
      return points.sort((a, b) => {
        const angleA = Math.atan2(a.y - centerY, a.x - centerX);
        const angleB = Math.atan2(b.y - centerY, b.x - centerX);
        return angleA - angleB;
      });
    }

    // TL, TR, BR, BL
    return [top[0], top[1], bottom[0], bottom[1]];
  }

  /**
   * Extract and correct perspective of document
   */
  extractPaper(img, resultWidth, resultHeight) {
    const cv = this.cv;
    const contour = this.findPaperContour(img);

    if (!contour) {
      return null;
    }

    const corners = this.getCornerPoints(contour);
    contour.delete();

    if (!corners || corners.length !== 4) {
      return null;
    }

    // Source points
    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y
    ]);

    // Destination points
    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      resultWidth, 0,
      resultWidth, resultHeight,
      0, resultHeight
    ]);

    // Get perspective transform
    const M = cv.getPerspectiveTransform(srcPoints, dstPoints);

    // Apply transform
    const result = new cv.Mat();
    const dsize = new cv.Size(resultWidth, resultHeight);
    cv.warpPerspective(img, result, M, dsize);

    // Cleanup
    srcPoints.delete();
    dstPoints.delete();
    M.delete();

    return { result, corners };
  }

  /**
   * Highlight paper in image (draw contour)
   */
  highlightPaper(img) {
    const cv = this.cv;
    const contour = this.findPaperContour(img);

    if (!contour) {
      return { canvas: null, corners: null, detected: false };
    }

    const corners = this.getCornerPoints(contour);

    // Draw on canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.cols;
    canvas.height = img.rows;

    // Copy original image
    const output = img.clone();

    // Draw contour
    const contourVec = new cv.MatVector();
    contourVec.push_back(contour);
    cv.drawContours(output, contourVec, 0, new cv.Scalar(0, 255, 0, 255), 3);

    // Draw corner points
    for (const corner of corners) {
      cv.circle(output, new cv.Point(corner.x, corner.y), 10, new cv.Scalar(255, 0, 0, 255), -1);
    }

    cv.imshow(canvas, output);

    // Cleanup
    contour.delete();
    contourVec.delete();
    output.delete();

    return { canvas, corners, detected: true };
  }
}

/**
 * Get or create scanner instance
 */
const getScanner = async () => {
  await loadOpenCV();

  if (!jscanifyInstance) {
    jscanifyInstance = new Scanner();
  }

  return jscanifyInstance;
};

/**
 * Detect document in image
 */
export const detectDocument = async (input, options = {}) => {
  const {
    outputWidth = 595,  // A4 width at 72 DPI
    outputHeight = 842  // A4 height at 72 DPI
  } = options;

  try {
    const scanner = await getScanner();
    const cv = window.cv;

    // Load image
    let img;
    if (input instanceof HTMLImageElement) {
      img = cv.imread(input);
    } else if (input instanceof HTMLCanvasElement) {
      img = cv.imread(input);
    } else if (input instanceof File || input instanceof Blob) {
      // Convert to image element
      const imageEl = await loadImageFromBlob(input);
      img = cv.imread(imageEl);
    } else if (typeof input === 'string') {
      const imageEl = await loadImageFromUrl(input);
      img = cv.imread(imageEl);
    } else {
      throw new Error('Unsupported input type');
    }

    logger.log('[jscanify] Detecting document...');
    const startTime = performance.now();

    // Try to find and extract paper
    const extraction = scanner.extractPaper(img, outputWidth, outputHeight);

    const elapsed = performance.now() - startTime;
    logger.log(`[jscanify] Detection completed in ${elapsed.toFixed(2)}ms`);

    if (extraction && extraction.corners) {
      // Create canvas for extracted image
      const extractedCanvas = document.createElement('canvas');
      extractedCanvas.width = outputWidth;
      extractedCanvas.height = outputHeight;
      cv.imshow(extractedCanvas, extraction.result);

      // Create preview canvas with highlighted contour
      const previewCanvas = document.createElement('canvas');
      previewCanvas.width = img.cols;
      previewCanvas.height = img.rows;

      const previewImg = img.clone();
      const contourPoints = cv.matFromArray(4, 1, cv.CV_32SC2, [
        extraction.corners[0].x, extraction.corners[0].y,
        extraction.corners[1].x, extraction.corners[1].y,
        extraction.corners[2].x, extraction.corners[2].y,
        extraction.corners[3].x, extraction.corners[3].y
      ]);

      const contourVec = new cv.MatVector();
      contourVec.push_back(contourPoints);
      cv.drawContours(previewImg, contourVec, 0, new cv.Scalar(0, 255, 0, 255), 4);

      // Draw corners
      for (const corner of extraction.corners) {
        cv.circle(previewImg, new cv.Point(corner.x, corner.y), 12, new cv.Scalar(16, 185, 129, 255), -1);
        cv.circle(previewImg, new cv.Point(corner.x, corner.y), 12, new cv.Scalar(255, 255, 255, 255), 3);
      }

      cv.imshow(previewCanvas, previewImg);

      // Get original as data URL
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = img.cols;
      originalCanvas.height = img.rows;
      cv.imshow(originalCanvas, img);

      // Cleanup
      extraction.result.delete();
      previewImg.delete();
      contourPoints.delete();
      contourVec.delete();
      img.delete();

      return {
        detected: true,
        corners: extraction.corners,
        original: originalCanvas.toDataURL('image/jpeg', 0.9),
        preview: previewCanvas.toDataURL('image/jpeg', 0.9),
        transformed: extractedCanvas.toDataURL('image/jpeg', 0.9),
        confidence: 85,
        processingTime: elapsed,
        method: 'jscanify'
      };
    }

    // No document found - return original
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = img.cols;
    originalCanvas.height = img.rows;
    cv.imshow(originalCanvas, img);
    const originalDataUrl = originalCanvas.toDataURL('image/jpeg', 0.9);

    img.delete();

    return {
      detected: false,
      corners: null,
      original: originalDataUrl,
      preview: null,
      transformed: null,
      confidence: 0,
      processingTime: elapsed,
      method: 'jscanify'
    };

  } catch (error) {
    logger.error('[jscanify] Detection error:', error);
    throw error;
  }
};

/**
 * Check if OpenCV is loaded
 */
export const isOpenCVLoaded = () => opencvLoaded;

/**
 * Preload OpenCV (call early to speed up first detection)
 */
export const preloadOpenCV = async () => {
  try {
    await loadOpenCV();
    return true;
  } catch (error) {
    logger.error('[jscanify] Preload failed:', error);
    return false;
  }
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
 * Load image from URL
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

export default {
  detectDocument,
  isOpenCVLoaded,
  preloadOpenCV
};
