// src/utils/yoloDetector.js
// Détection de documents avec YOLO + ONNX Runtime
// Enhanced with edge refinement and scoring

import * as ort from 'onnxruntime-web';
import logger from './logger';

/**
 * Score a detection based on how likely it is to be a document
 * @param {Array} bbox - Bounding box [x1, y1, x2, y2]
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} confidence - YOLO confidence
 * @returns {number} Score 0-100
 */
const scoreYOLODetection = (bbox, imageWidth, imageHeight, confidence) => {
  const [x1, y1, x2, y2] = bbox;
  const width = x2 - x1;
  const height = y2 - y1;

  let score = 0;

  // 1. Confidence score (30 points max)
  score += confidence * 30;

  // 2. Size score - document should be significant portion of image (25 points max)
  const areaRatio = (width * height) / (imageWidth * imageHeight);
  if (areaRatio >= 0.1 && areaRatio <= 0.9) {
    score += 25 * Math.min(areaRatio * 2, 1);
  }

  // 3. Aspect ratio score - documents are rectangular (25 points max)
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  if (aspectRatio >= 1.0 && aspectRatio <= 2.0) {
    score += 25;
  } else if (aspectRatio < 3.0) {
    score += 15;
  }

  // 4. Position score - document should be roughly centered (20 points max)
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const distFromCenterX = Math.abs(centerX - imageWidth / 2) / (imageWidth / 2);
  const distFromCenterY = Math.abs(centerY - imageHeight / 2) / (imageHeight / 2);
  const centerScore = (1 - (distFromCenterX + distFromCenterY) / 2) * 20;
  score += Math.max(0, centerScore);

  return Math.min(100, Math.max(0, score));
};

/**
 * Classe pour la détection de documents avec YOLO
 */
class YOLODocumentDetector {
  constructor() {
    this.session = null;
    this.modelPath = null;
    this.inputShape = [640, 640]; // Taille d'entrée standard YOLOv8
  }

  /**
   * Charge le modèle ONNX
   * @param {string} modelPath - Chemin vers le fichier .onnx
   */
  async loadModel(modelPath) {
    try {
      logger.log('🔄 Chargement du modèle YOLO ONNX...');
      logger.log('📁 Chemin du modèle:', modelPath);

      // Configurer ONNX Runtime pour utiliser WebGL (plus rapide)
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;

      logger.log('⚙️ Configuration ONNX Runtime...');

      // Charger le modèle
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all'
      });

      this.modelPath = modelPath;

      // Récupérer les informations du modèle
      const inputName = this.session.inputNames[0];

      logger.log('✅ Modèle YOLO chargé avec succès !');
      logger.log('📊 Input name:', inputName);
      logger.log('📊 Output names:', this.session.outputNames);
      logger.log('🎯 MODE DEBUG ACTIVÉ - Détectera TOUS les objets');

      return true;
    } catch (error) {
      console.error('❌ Erreur lors du chargement du modèle YOLO:', error);
      console.error('📄 Détails de l\'erreur:', error.message);
      console.error('📄 Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Prétraite l'image pour YOLO
   * @param {HTMLImageElement|HTMLCanvasElement} image
   * @returns {Float32Array} Tensor d'entrée
   */
  preprocessImage(image) {
    // Créer un canvas pour redimensionner l'image
    const canvas = document.createElement('canvas');
    canvas.width = this.inputShape[0];
    canvas.height = this.inputShape[1];
    const ctx = canvas.getContext('2d');

    // Dessiner l'image redimensionnée
    ctx.drawImage(image, 0, 0, this.inputShape[0], this.inputShape[1]);

    // Récupérer les pixels
    const imageData = ctx.getImageData(0, 0, this.inputShape[0], this.inputShape[1]);
    const { data } = imageData;

    // Convertir en format YOLO: [1, 3, 640, 640] avec normalisation [0, 1]
    const inputSize = this.inputShape[0] * this.inputShape[1];
    const float32Data = new Float32Array(3 * inputSize);

    // Séparer les canaux RGB et normaliser
    for (let i = 0; i < inputSize; i++) {
      float32Data[i] = data[i * 4] / 255.0;                    // R
      float32Data[inputSize + i] = data[i * 4 + 1] / 255.0;    // G
      float32Data[inputSize * 2 + i] = data[i * 4 + 2] / 255.0; // B
    }

    return float32Data;
  }

  /**
   * Détecte un document dans l'image
   * Enhanced with multi-threshold detection and scoring
   * @param {HTMLImageElement|HTMLCanvasElement|Blob} input
   * @param {Object} options - Options de détection
   * @returns {Promise<Object>} Résultat de la détection
   */
  async detectDocument(input, options = {}) {
    if (!this.session) {
      throw new Error('Modèle non chargé. Appelez loadModel() d\'abord.');
    }

    const {
      confidenceThreshold = 0.3, // Lowered default for better recall
      iouThreshold = 0.45,
      maxDetections = 10,
      minScore = 40 // Minimum score to accept detection
    } = options;

    try {
      // Convertir l'entrée en image si nécessaire
      let image = input;
      if (input instanceof Blob) {
        image = await this.blobToImage(input);
      }

      // Sauvegarder les dimensions originales
      const originalWidth = image.width || image.videoWidth;
      const originalHeight = image.height || image.videoHeight;

      // Prétraiter l'image
      const inputData = this.preprocessImage(image);

      // Créer le tensor d'entrée
      const inputName = this.session.inputNames[0];
      const tensor = new ort.Tensor('float32', inputData, [1, 3, ...this.inputShape]);

      // Exécuter l'inférence
      logger.log('[YOLO] Running inference...');
      const startTime = performance.now();

      const feeds = { [inputName]: tensor };
      const results = await this.session.run(feeds);

      const inferenceTime = performance.now() - startTime;
      logger.log(`[YOLO] Inference completed in ${inferenceTime.toFixed(2)}ms`);

      // Traiter les résultats
      const outputName = this.session.outputNames[0];
      const output = results[outputName];

      // Try multiple confidence thresholds for better detection
      const CONFIDENCE_THRESHOLDS = [0.5, 0.3, 0.15, 0.1];
      let bestDetections = [];
      let usedThreshold = confidenceThreshold;

      for (const threshold of CONFIDENCE_THRESHOLDS) {
        const detections = this.decodeYOLOOutput(
          output.data,
          output.dims,
          threshold,
          iouThreshold,
          maxDetections
        );

        if (detections.length > 0) {
          bestDetections = detections;
          usedThreshold = threshold;
          break;
        }
      }

      // Convertir les coordonnées à l'échelle originale et scorer
      const scaledDetections = bestDetections.map(det => {
        const scaledBbox = this.scaleCoordinates(
          det.bbox,
          this.inputShape[0],
          this.inputShape[1],
          originalWidth,
          originalHeight
        );

        const score = scoreYOLODetection(
          scaledBbox,
          originalWidth,
          originalHeight,
          det.confidence
        );

        return {
          ...det,
          bbox: scaledBbox,
          score
        };
      });

      // Sort by score and filter
      scaledDetections.sort((a, b) => b.score - a.score);
      const validDetections = scaledDetections.filter(d => d.score >= minScore);

      if (validDetections.length > 0) {
        logger.log(`[YOLO] Best detection: score=${validDetections[0].score.toFixed(1)}, conf=${validDetections[0].confidence.toFixed(2)}, threshold=${usedThreshold}`);
      } else if (scaledDetections.length > 0) {
        logger.log(`[YOLO] Low confidence: best score=${scaledDetections[0].score.toFixed(1)}`);
      } else {
        logger.log('[YOLO] No detection');
      }

      // Return best result even if low confidence (let caller decide)
      const allDetections = validDetections.length > 0 ? validDetections : scaledDetections;

      return {
        detected: allDetections.length > 0,
        detections: allDetections,
        inferenceTime,
        originalSize: { width: originalWidth, height: originalHeight },
        confidence: allDetections.length > 0 ? allDetections[0].confidence : 0,
        score: allDetections.length > 0 ? allDetections[0].score : 0,
        lowConfidence: validDetections.length === 0 && scaledDetections.length > 0
      };

    } catch (error) {
      logger.error('[YOLO] Detection error:', error);
      return {
        detected: false,
        detections: [],
        error: error.message
      };
    }
  }

  /**
   * Décode la sortie YOLO en détections
   * Format YOLOv8: [1, 84, 8400] où 84 = [x, y, w, h, ...80 classes]
   *
   * Enhanced: Accept any large rectangular object as potential document
   */
  decodeYOLOOutput(data, dims, confThreshold, iouThreshold, maxDetections) {
    const detections = [];

    // Classes COCO commonly detected as documents
    const DOCUMENT_LIKE_CLASSES = new Set([
      73,  // book
      63,  // laptop
      67,  // cell phone
      84,  // book (alternate)
      0,   // person holding document
      39,  // bottle (receipt)
      41,  // cup
      64,  // mouse
      66,  // keyboard
    ]);

    // YOLOv8 output format: [batch, features, anchors]
    const numAnchors = dims[2] || 8400;
    const numClasses = (dims[1] || 84) - 4;

    // Parcourir toutes les ancres
    for (let i = 0; i < numAnchors; i++) {
      const x = data[i];
      const y = data[numAnchors + i];
      const w = data[2 * numAnchors + i];
      const h = data[3 * numAnchors + i];

      // Skip invalid boxes
      if (w <= 0 || h <= 0) continue;

      // Find max confidence class
      let maxConf = 0;
      let maxClassId = 0;

      for (let c = 0; c < numClasses; c++) {
        const conf = data[(4 + c) * numAnchors + i];
        if (conf > maxConf) {
          maxConf = conf;
          maxClassId = c;
        }
      }

      // Accept detection based on multiple criteria
      const isDocumentLike = DOCUMENT_LIKE_CLASSES.has(maxClassId);
      const isLargeEnough = w > 30 && h > 30;
      const hasGoodAspectRatio = Math.max(w, h) / Math.min(w, h) < 4;

      // Adaptive threshold: lower for document-like classes
      const effectiveThreshold = isDocumentLike ? confThreshold * 0.5 : confThreshold;

      if (maxConf >= effectiveThreshold && isLargeEnough && hasGoodAspectRatio) {
        detections.push({
          bbox: [
            Math.max(0, x - w / 2),
            Math.max(0, y - h / 2),
            Math.min(this.inputShape[0], x + w / 2),
            Math.min(this.inputShape[1], y + h / 2)
          ],
          confidence: maxConf,
          classId: maxClassId,
          isDocumentLike
        });
      }
    }

    // Apply NMS
    const nmsDetections = this.nonMaxSuppression(detections, iouThreshold);

    return nmsDetections.slice(0, maxDetections);
  }

  /**
   * Non-Maximum Suppression pour éliminer les détections dupliquées
   */
  nonMaxSuppression(detections, iouThreshold) {
    // Trier par confiance décroissante
    detections.sort((a, b) => b.confidence - a.confidence);

    const keep = [];
    const suppressed = new Set();

    for (let i = 0; i < detections.length; i++) {
      if (suppressed.has(i)) continue;

      keep.push(detections[i]);

      for (let j = i + 1; j < detections.length; j++) {
        if (suppressed.has(j)) continue;

        const iou = this.calculateIOU(detections[i].bbox, detections[j].bbox);
        if (iou > iouThreshold) {
          suppressed.add(j);
        }
      }
    }

    return keep;
  }

  /**
   * Calcule l'Intersection over Union entre deux bounding boxes
   */
  calculateIOU(box1, box2) {
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;

    const intersectionX1 = Math.max(x1_1, x1_2);
    const intersectionY1 = Math.max(y1_1, y1_2);
    const intersectionX2 = Math.min(x2_1, x2_2);
    const intersectionY2 = Math.min(y2_1, y2_2);

    const intersectionArea = Math.max(0, intersectionX2 - intersectionX1) *
                            Math.max(0, intersectionY2 - intersectionY1);

    const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
    const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);

    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / unionArea;
  }

  /**
   * Convertit les coordonnées à l'échelle originale
   */
  scaleCoordinates(bbox, modelW, modelH, origW, origH) {
    const scaleX = origW / modelW;
    const scaleY = origH / modelH;

    return [
      bbox[0] * scaleX,
      bbox[1] * scaleY,
      bbox[2] * scaleX,
      bbox[3] * scaleY
    ];
  }

  /**
   * Convertit une bounding box en 4 coins (pour compatibilité avec le scanner)
   */
  bboxToCorners(bbox, width, height) {
    const [x1, y1, x2, y2] = bbox;

    // Convertir en pourcentage pour l'affichage
    return [
      { x: (x1 / width) * 100, y: (y1 / height) * 100 },      // Top-left
      { x: (x2 / width) * 100, y: (y1 / height) * 100 },      // Top-right
      { x: (x2 / width) * 100, y: (y2 / height) * 100 },      // Bottom-right
      { x: (x1 / width) * 100, y: (y2 / height) * 100 }       // Bottom-left
    ];
  }

  /**
   * Convertit un Blob en Image
   */
  blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = reject;
      img.src = url;
    });
  }
}

// Instance singleton
let detectorInstance = null;

/**
 * Obtient l'instance du détecteur YOLO
 */
export function getYOLODetector() {
  if (!detectorInstance) {
    detectorInstance = new YOLODocumentDetector();
  }
  return detectorInstance;
}

/**
 * Fonction helper pour détecter un document
 */
export async function detectDocumentWithYOLO(image, options = {}) {
  const detector = getYOLODetector();

  // Si le modèle n'est pas chargé, essayer de le charger
  if (!detector.session && options.modelPath) {
    await detector.loadModel(options.modelPath);
  }

  return detector.detectDocument(image, options);
}

const yoloDetectorExports = {
  getYOLODetector,
  detectDocumentWithYOLO
};

export default yoloDetectorExports;
