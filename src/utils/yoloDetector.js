// src/utils/yoloDetector.js
// Détection de documents avec YOLO + ONNX Runtime

import * as ort from 'onnxruntime-web';

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
      console.log('🔄 Chargement du modèle YOLO ONNX...');
      console.log('📁 Chemin du modèle:', modelPath);

      // Configurer ONNX Runtime pour utiliser WebGL (plus rapide)
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.simd = true;

      console.log('⚙️ Configuration ONNX Runtime...');

      // Charger le modèle
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all'
      });

      this.modelPath = modelPath;

      // Récupérer les informations du modèle
      const inputName = this.session.inputNames[0];

      console.log('✅ Modèle YOLO chargé avec succès !');
      console.log('📊 Input name:', inputName);
      console.log('📊 Output names:', this.session.outputNames);
      console.log('🎯 MODE DEBUG ACTIVÉ - Détectera TOUS les objets');

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
   * @param {HTMLImageElement|HTMLCanvasElement|Blob} input
   * @param {Object} options - Options de détection
   * @returns {Promise<Object>} Résultat de la détection
   */
  async detectDocument(input, options = {}) {
    if (!this.session) {
      throw new Error('Modèle non chargé. Appelez loadModel() d\'abord.');
    }

    const {
      confidenceThreshold = 0.5,
      iouThreshold = 0.45,
      maxDetections = 10
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
      console.log('🔍 Exécution de l\'inférence YOLO...');
      const startTime = performance.now();

      const feeds = { [inputName]: tensor };
      const results = await this.session.run(feeds);

      const inferenceTime = performance.now() - startTime;
      console.log(`⚡ Inférence terminée en ${inferenceTime.toFixed(2)}ms`);

      // Traiter les résultats
      const outputName = this.session.outputNames[0];
      const output = results[outputName];

      console.log(`📦 YOLO output name: ${outputName}`);
      console.log(`📏 YOLO output dims: [${output.dims}]`);
      console.log(`📊 YOLO output data size: ${output.data.length}`);
      console.log(`🔢 First 20 values: [${Array.from(output.data.slice(0, 20)).map(v => v.toFixed(3)).join(', ')}]`);

      // Décoder les détections YOLO
      const detections = this.decodeYOLOOutput(
        output.data,
        output.dims,
        confidenceThreshold,
        iouThreshold,
        maxDetections
      );

      // Convertir les coordonnées à l'échelle originale
      const scaledDetections = detections.map(det => ({
        ...det,
        bbox: this.scaleCoordinates(
          det.bbox,
          this.inputShape[0],
          this.inputShape[1],
          originalWidth,
          originalHeight
        )
      }));

      console.log(`📍 ${scaledDetections.length} document(s) détecté(s)`);

      return {
        detected: scaledDetections.length > 0,
        detections: scaledDetections,
        inferenceTime,
        originalSize: { width: originalWidth, height: originalHeight }
      };

    } catch (error) {
      console.error('❌ Erreur lors de la détection:', error);
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
   * Classes COCO acceptées comme "documents" :
   * - 73: book (livre)
   * - 63: laptop (ordinateur)
   * - 67: cell phone (téléphone)
   * - Ou tout objet rectangulaire suffisamment grand
   */
  decodeYOLOOutput(data, dims, confThreshold, iouThreshold, maxDetections) {
    const detections = [];

    // Classes COCO considérées comme des documents potentiels
    const DOCUMENT_LIKE_CLASSES = [73, 63, 67, 84]; // book, laptop, cell phone

    // YOLOv8 output format: [batch, 84, anchors]
    const numAnchors = dims[2] || 8400;
    const numClasses = (dims[1] || 84) - 4; // Soustraire x, y, w, h

    console.log(`📊 YOLO Output dims: [${dims}], anchors: ${numAnchors}, classes: ${numClasses}`);

    // Parcourir toutes les ancres
    for (let i = 0; i < numAnchors; i++) {
      // Récupérer bbox: x_center, y_center, width, height
      const x = data[i];
      const y = data[numAnchors + i];
      const w = data[2 * numAnchors + i];
      const h = data[3 * numAnchors + i];

      // Trouver la classe avec la confiance max
      let maxConf = 0;
      let maxClassId = 0;

      for (let c = 0; c < numClasses; c++) {
        const conf = data[(4 + c) * numAnchors + i];
        if (conf > maxConf) {
          maxConf = conf;
          maxClassId = c;
        }
      }

      // SOLUTION 1: Accepter les classes "document-like"
      // SOLUTION 2: Accepter TOUS les objets rectangulaires avec confiance > seuil bas
      // SOLUTION 3: MODE DEBUG - Accepter TOUT pour tester
      const isDocumentLike = DOCUMENT_LIKE_CLASSES.includes(maxClassId);
      const isLargeRectangle = w > 50 && h > 50; // Suffisamment grand

      // MODE DEBUG: Accepter TOUTES les détections avec confiance > 0.1
      const DEBUG_MODE = true;
      const meetsThreshold = DEBUG_MODE ? maxConf >= 0.1 : maxConf >= (isDocumentLike ? confThreshold : confThreshold * 0.3);

      // Filtrer par seuil de confiance (très permissif en mode debug)
      if (DEBUG_MODE ? meetsThreshold : (meetsThreshold && (isDocumentLike || isLargeRectangle))) {
        detections.push({
          bbox: [
            x - w / 2,  // x1
            y - h / 2,  // y1
            x + w / 2,  // x2
            y + h / 2   // y2
          ],
          confidence: maxConf,
          classId: maxClassId
        });

        if (detections.length <= 5) {
          console.log(`✓ Détection YOLO: classe=${maxClassId}, conf=${maxConf.toFixed(3)}, bbox=[${x.toFixed(1)}, ${y.toFixed(1)}, ${w.toFixed(1)}, ${h.toFixed(1)}]`);
        }
      }
    }

    console.log(`📍 Total détections avant NMS: ${detections.length}`);

    // Appliquer NMS (Non-Maximum Suppression)
    const nmsDetections = this.nonMaxSuppression(detections, iouThreshold);

    // Limiter le nombre de détections
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
