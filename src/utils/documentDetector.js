/**
 * Document Detection Utility using OpenCV.js
 *
 * This utility detects document edges in an image and provides
 * automatic cropping and perspective correction.
 */

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
 * Calculate the perimeter of a contour
 * @param {Object} contour - OpenCV contour
 * @returns {number} Perimeter
 */
const getContourPerimeter = (contour) => {
  return window.cv.arcLength(contour, true);
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
    const perimeter = getContourPerimeter(contour);
    const approx = new window.cv.Mat();
    window.cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

    // Check if the approximated contour has 4 points (quadrilateral)
    if (approx.rows === 4 && area > maxArea) {
      if (bestApprox) bestApprox.delete();
      if (bestContour) bestContour.delete();

      maxArea = area;
      bestContour = contour;
      bestApprox = approx;
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
    drawContours = true    // Draw detected contours on preview
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
    const gray = new window.cv.Mat();
    const blurred = new window.cv.Mat();
    const edges = new window.cv.Mat();

    // Convert to grayscale
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

    // Apply Gaussian blur
    const ksize = new window.cv.Size(5, 5);
    window.cv.GaussianBlur(gray, blurred, ksize, 0);

    // Detect edges using Canny
    window.cv.Canny(blurred, edges, 50, 150);

    // Find contours
    const contours = new window.cv.MatVector();
    const hierarchy = new window.cv.Mat();
    window.cv.findContours(
      edges,
      contours,
      hierarchy,
      window.cv.RETR_EXTERNAL,
      window.cv.CHAIN_APPROX_SIMPLE
    );

    // Find document contour
    const imageArea = src.rows * src.cols;
    const documentContour = findDocumentContour(contours, imageArea, minArea);

    let result = {
      detected: false,
      original: canvas.toDataURL('image/jpeg', 0.9),
      preview: null,
      transformed: null,
      corners: null
    };

    if (documentContour && documentContour.rows === 4) {
      result.detected = true;

      // Extract corner points
      const corners = [];
      for (let i = 0; i < 4; i++) {
        corners.push({
          x: documentContour.data32S[i * 2],
          y: documentContour.data32S[i * 2 + 1]
        });
      }
      result.corners = corners;

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

      documentContour.delete();
    }

    // Cleanup
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

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
