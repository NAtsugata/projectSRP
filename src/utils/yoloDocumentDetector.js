// src/utils/yoloDocumentDetector.js
// Détection de documents via YOLO (ONNX Runtime Web)

import * as ort from 'onnxruntime-web';
import logger from './logger';

const MODEL_PATH = '/models/best.onnx';
const INPUT_SIZE = 640; // YOLO standard input size

let session = null;
let isLoading = false;
let loadPromise = null;

/**
 * Charge le modèle YOLO ONNX
 */
export async function loadYoloModel() {
    if (session) return true;
    if (loadPromise) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
        try {
            logger.log('[YOLO] Chargement du modèle...');

            // Configurer ONNX Runtime pour utiliser WASM
            ort.env.wasm.numThreads = 1;
            ort.env.wasm.simd = true;

            session = await ort.InferenceSession.create(MODEL_PATH, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
            });

            logger.log('[YOLO] Modèle chargé avec succès');
            logger.log('[YOLO] Inputs:', session.inputNames);
            logger.log('[YOLO] Outputs:', session.outputNames);
            isLoading = false;
            return true;
        } catch (e) {
            logger.error('[YOLO] Erreur chargement modèle:', e);
            isLoading = false;
            loadPromise = null;
            return false;
        }
    })();

    return loadPromise;
}

/**
 * Vérifie si le modèle est chargé
 */
export function isYoloReady() {
    return !!session;
}

/**
 * Vérifie si le modèle est en cours de chargement
 */
export function isYoloLoading() {
    return isLoading;
}

/**
 * Prétraite une image pour YOLO (redimensionner + normaliser)
 * @param {ImageData|HTMLCanvasElement|HTMLImageElement} input
 * @returns {Float32Array} Tensor de taille [1, 3, 640, 640]
 */
function preprocessImage(input) {
    // Obtenir un canvas à partir de l'input
    let canvas;
    if (input instanceof HTMLCanvasElement) {
        canvas = input;
    } else if (input instanceof HTMLImageElement) {
        canvas = document.createElement('canvas');
        canvas.width = input.naturalWidth || input.width;
        canvas.height = input.naturalHeight || input.height;
        canvas.getContext('2d').drawImage(input, 0, 0);
    } else if (input instanceof ImageData) {
        canvas = document.createElement('canvas');
        canvas.width = input.width;
        canvas.height = input.height;
        canvas.getContext('2d').putImageData(input, 0, 0);
    } else {
        throw new Error('Input type not supported');
    }

    // Redimensionner à INPUT_SIZE x INPUT_SIZE en gardant le ratio (letterbox)
    const resized = document.createElement('canvas');
    resized.width = INPUT_SIZE;
    resized.height = INPUT_SIZE;
    const ctx = resized.getContext('2d');

    // Fond gris (128/255 = 0.5) comme YOLO le recommande
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

    // Calculer le ratio pour garder les proportions
    const scale = Math.min(INPUT_SIZE / canvas.width, INPUT_SIZE / canvas.height);
    const newW = Math.round(canvas.width * scale);
    const newH = Math.round(canvas.height * scale);
    const padX = Math.round((INPUT_SIZE - newW) / 2);
    const padY = Math.round((INPUT_SIZE - newH) / 2);

    ctx.drawImage(canvas, padX, padY, newW, newH);

    // Extraire les pixels et convertir en tensor [1, 3, H, W] normalisé 0-1
    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = imgData.data;
    const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        tensor[i] = pixels[i * 4] / 255.0;                          // R
        tensor[INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 1] / 255.0;     // G
        tensor[2 * INPUT_SIZE * INPUT_SIZE + i] = pixels[i * 4 + 2] / 255.0; // B
    }

    return {
        tensor,
        scale,
        padX,
        padY,
        origWidth: canvas.width,
        origHeight: canvas.height
    };
}

/**
 * Post-traite la sortie YOLO pour extraire les bounding boxes
 * Output shape: [1, N, 5+classes] ou [1, 5+classes, N] (transposé dans YOLOv8)
 */
function postprocess(output, preInfo, confThreshold = 0.25) {
    const data = output.data;
    const dims = output.dims;
    const detections = [];

    // YOLOv8 output: [1, 4+nClasses, nBoxes] - transposé par rapport à v5
    // Ou: [1, nBoxes, 4+nClasses]
    let numBoxes, numFeatures;

    if (dims.length === 3) {
        if (dims[1] < dims[2]) {
            // [1, features, boxes] - YOLOv8 format
            numFeatures = dims[1];
            numBoxes = dims[2];

            for (let i = 0; i < numBoxes; i++) {
                // x_center, y_center, width, height
                const cx = data[0 * numBoxes + i];
                const cy = data[1 * numBoxes + i];
                const w = data[2 * numBoxes + i];
                const h = data[3 * numBoxes + i];

                // Trouver la classe avec la plus haute confiance
                let maxConf = 0;
                let maxClass = 0;
                for (let c = 4; c < numFeatures; c++) {
                    const conf = data[c * numBoxes + i];
                    if (conf > maxConf) {
                        maxConf = conf;
                        maxClass = c - 4;
                    }
                }

                if (maxConf >= confThreshold) {
                    detections.push({
                        cx, cy, w, h,
                        confidence: maxConf,
                        classId: maxClass
                    });
                }
            }
        } else {
            // [1, boxes, features] - classique
            numBoxes = dims[1];
            numFeatures = dims[2];

            for (let i = 0; i < numBoxes; i++) {
                const offset = i * numFeatures;
                const cx = data[offset + 0];
                const cy = data[offset + 1];
                const w = data[offset + 2];
                const h = data[offset + 3];

                let maxConf = 0;
                let maxClass = 0;
                for (let c = 4; c < numFeatures; c++) {
                    const conf = data[offset + c];
                    if (conf > maxConf) {
                        maxConf = conf;
                        maxClass = c - 4;
                    }
                }

                if (maxConf >= confThreshold) {
                    detections.push({
                        cx, cy, w, h,
                        confidence: maxConf,
                        classId: maxClass
                    });
                }
            }
        }
    }

    // Convertir les coordonnées du letterbox vers l'image originale
    const { scale, padX, padY, origWidth, origHeight } = preInfo;

    const results = detections.map(det => {
        // Convertir de xywh center vers xyxy
        let x1 = (det.cx - det.w / 2 - padX) / scale;
        let y1 = (det.cy - det.h / 2 - padY) / scale;
        let x2 = (det.cx + det.w / 2 - padX) / scale;
        let y2 = (det.cy + det.h / 2 - padY) / scale;

        // Clamp
        x1 = Math.max(0, Math.min(origWidth, x1));
        y1 = Math.max(0, Math.min(origHeight, y1));
        x2 = Math.max(0, Math.min(origWidth, x2));
        y2 = Math.max(0, Math.min(origHeight, y2));

        return {
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2),
            confidence: det.confidence,
            classId: det.classId
        };
    });

    // NMS simple: garder la détection avec la plus haute confiance
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
}

/**
 * Convertit une bounding box en 4 coins (pour le scanner de documents)
 */
function bboxToCorners(detection) {
    return [
        { x: detection.x1, y: detection.y1 }, // Top-Left
        { x: detection.x2, y: detection.y1 }, // Top-Right
        { x: detection.x2, y: detection.y2 }, // Bottom-Right
        { x: detection.x1, y: detection.y2 }, // Bottom-Left
    ];
}

/**
 * Détecte un document dans une image avec YOLO
 * @param {ImageData|HTMLCanvasElement|HTMLImageElement} input
 * @param {Object} options
 * @returns {Object|null} { corners, confidence, bbox }
 */
export async function detectDocumentYolo(input, options = {}) {
    const { confThreshold = 0.25 } = options;

    if (!session) {
        const loaded = await loadYoloModel();
        if (!loaded) return null;
    }

    try {
        const startTime = performance.now();

        // 1. Prétraitement
        const preInfo = preprocessImage(input);
        const inputTensor = new ort.Tensor('float32', preInfo.tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);

        // 2. Inférence
        const inputName = session.inputNames[0];
        const feeds = { [inputName]: inputTensor };
        const results = await session.run(feeds);

        // 3. Post-traitement
        const outputName = session.outputNames[0];
        const output = results[outputName];
        const detections = postprocess(output, preInfo, confThreshold);

        const elapsed = performance.now() - startTime;
        logger.log(`[YOLO] Détection en ${elapsed.toFixed(0)}ms - ${detections.length} objet(s) trouvé(s)`);

        if (detections.length === 0) return null;

        // Prendre la meilleure détection
        const best = detections[0];
        const corners = bboxToCorners(best);

        return {
            corners,
            confidence: Math.round(best.confidence * 100),
            bbox: best,
            processingTime: elapsed,
            method: 'yolo-onnx',
            allDetections: detections
        };
    } catch (e) {
        logger.error('[YOLO] Erreur détection:', e);
        return null;
    }
}

/**
 * Détecte un document depuis un ImageData (compatible avec useDocumentDetection)
 * Retourne les coins normalisés en % (0-100)
 */
export function detectDocumentEdgesYolo(imageData) {
    // Version synchrone impossible avec ONNX - retourne null
    // Utiliser detectDocumentYolo (async) à la place
    return null;
}

export default {
    loadYoloModel,
    isYoloReady,
    isYoloLoading,
    detectDocumentYolo
};
