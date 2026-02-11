// src/utils/yoloDocumentDetector.js
// Détection de documents via YOLO Segmentation (ONNX Runtime Web)
// V2: Support YOLOv8-seg pour obtenir les vrais coins du document

import * as ort from 'onnxruntime-web';
import logger from './logger';

const MODEL_PATH = '/models/best.onnx';
const INPUT_SIZE = 640; // YOLO standard input size
const PROTO_SIZE = 160; // Taille des proto masks YOLOv8-seg
const NUM_MASK_COEFFS = 32; // Nombre de coefficients de masque

let session = null;
let isLoading = false;
let loadPromise = null;
let isSegmentationModel = false; // Détecte si c'est un modèle de segmentation

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

            // Détecter si c'est un modèle de segmentation (2 outputs: detection + proto masks)
            isSegmentationModel = session.outputNames.length >= 2;
            logger.log(`[YOLO] Type: ${isSegmentationModel ? 'SEGMENTATION' : 'DETECTION'}`);

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
 * Post-traite la sortie YOLO pour extraire les bounding boxes et coefficients de masque
 * YOLOv8-seg output: [1, 4+nClasses+32, nBoxes]
 * où 32 = coefficients de masque pour la segmentation
 */
function postprocess(output, preInfo, confThreshold = 0.25, extractMaskCoeffs = false) {
    const data = output.data;
    const dims = output.dims;
    const detections = [];

    // YOLOv8 output: [1, 4+nClasses+32, nBoxes] - transposé
    let numBoxes, numFeatures;

    if (dims.length === 3) {
        if (dims[1] < dims[2]) {
            // [1, features, boxes] - YOLOv8 format
            numFeatures = dims[1];
            numBoxes = dims[2];

            // Pour segmentation: features = 4 (bbox) + nClasses + 32 (mask coeffs)
            const numClasses = extractMaskCoeffs ? numFeatures - 4 - NUM_MASK_COEFFS : numFeatures - 4;
            const maskOffset = extractMaskCoeffs ? 4 + numClasses : numFeatures;

            for (let i = 0; i < numBoxes; i++) {
                // x_center, y_center, width, height
                const cx = data[0 * numBoxes + i];
                const cy = data[1 * numBoxes + i];
                const w = data[2 * numBoxes + i];
                const h = data[3 * numBoxes + i];

                // Trouver la classe avec la plus haute confiance
                let maxConf = 0;
                let maxClass = 0;
                for (let c = 4; c < 4 + numClasses; c++) {
                    const conf = data[c * numBoxes + i];
                    if (conf > maxConf) {
                        maxConf = conf;
                        maxClass = c - 4;
                    }
                }

                if (maxConf >= confThreshold) {
                    const detection = {
                        cx, cy, w, h,
                        confidence: maxConf,
                        classId: maxClass
                    };

                    // Extraire les coefficients de masque si demandé
                    if (extractMaskCoeffs) {
                        detection.maskCoeffs = new Float32Array(NUM_MASK_COEFFS);
                        for (let m = 0; m < NUM_MASK_COEFFS; m++) {
                            detection.maskCoeffs[m] = data[(maskOffset + m) * numBoxes + i];
                        }
                    }

                    detections.push(detection);
                }
            }
        } else {
            // [1, boxes, features] - format classique
            numBoxes = dims[1];
            numFeatures = dims[2];

            const numClasses = extractMaskCoeffs ? numFeatures - 4 - NUM_MASK_COEFFS : numFeatures - 4;

            for (let i = 0; i < numBoxes; i++) {
                const offset = i * numFeatures;
                const cx = data[offset + 0];
                const cy = data[offset + 1];
                const w = data[offset + 2];
                const h = data[offset + 3];

                let maxConf = 0;
                let maxClass = 0;
                for (let c = 4; c < 4 + numClasses; c++) {
                    const conf = data[offset + c];
                    if (conf > maxConf) {
                        maxConf = conf;
                        maxClass = c - 4;
                    }
                }

                if (maxConf >= confThreshold) {
                    const detection = {
                        cx, cy, w, h,
                        confidence: maxConf,
                        classId: maxClass
                    };

                    if (extractMaskCoeffs) {
                        detection.maskCoeffs = new Float32Array(NUM_MASK_COEFFS);
                        for (let m = 0; m < NUM_MASK_COEFFS; m++) {
                            detection.maskCoeffs[m] = data[offset + 4 + numClasses + m];
                        }
                    }

                    detections.push(detection);
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

        const result = {
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2),
            confidence: det.confidence,
            classId: det.classId,
            // Garder les coordonnées originales pour le masque
            rawCx: det.cx,
            rawCy: det.cy,
            rawW: det.w,
            rawH: det.h
        };

        if (det.maskCoeffs) {
            result.maskCoeffs = det.maskCoeffs;
        }

        return result;
    });

    // NMS simple: garder la détection avec la plus haute confiance
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
}

/**
 * Génère le masque de segmentation à partir des coefficients et proto masks
 * @param {Float32Array} maskCoeffs - 32 coefficients de masque
 * @param {Float32Array} protoMasks - Proto masks [32, 160, 160]
 * @param {Object} detection - Détection avec bbox
 * @param {Object} preInfo - Informations de prétraitement
 * @returns {Uint8Array} Masque binaire à la taille originale
 */
function generateMask(maskCoeffs, protoMasks, detection, preInfo) {
    const { scale, padX, padY, origWidth, origHeight } = preInfo;

    // 1. Produit matriciel: coeffs (1x32) @ protos (32x160x160) = mask (160x160)
    const maskSize = PROTO_SIZE * PROTO_SIZE;
    const mask160 = new Float32Array(maskSize);

    for (let i = 0; i < maskSize; i++) {
        let sum = 0;
        for (let c = 0; c < NUM_MASK_COEFFS; c++) {
            sum += maskCoeffs[c] * protoMasks[c * maskSize + i];
        }
        // Sigmoid
        mask160[i] = 1 / (1 + Math.exp(-sum));
    }

    // 2. Crop le masque à la bbox (dans l'espace 160x160)
    const scaleToProto = PROTO_SIZE / INPUT_SIZE;
    const bboxX1 = Math.max(0, Math.floor((detection.rawCx - detection.rawW / 2) * scaleToProto));
    const bboxY1 = Math.max(0, Math.floor((detection.rawCy - detection.rawH / 2) * scaleToProto));
    const bboxX2 = Math.min(PROTO_SIZE, Math.ceil((detection.rawCx + detection.rawW / 2) * scaleToProto));
    const bboxY2 = Math.min(PROTO_SIZE, Math.ceil((detection.rawCy + detection.rawH / 2) * scaleToProto));

    // 3. Créer un canvas pour redimensionner à la taille originale
    const canvas = document.createElement('canvas');
    canvas.width = origWidth;
    canvas.height = origHeight;
    const ctx = canvas.getContext('2d');

    // Créer une ImageData temporaire pour le masque 160x160
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = PROTO_SIZE;
    tempCanvas.height = PROTO_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    const tempImageData = tempCtx.createImageData(PROTO_SIZE, PROTO_SIZE);

    for (let i = 0; i < maskSize; i++) {
        const val = mask160[i] > 0.5 ? 255 : 0;
        tempImageData.data[i * 4] = val;
        tempImageData.data[i * 4 + 1] = val;
        tempImageData.data[i * 4 + 2] = val;
        tempImageData.data[i * 4 + 3] = 255;
    }
    tempCtx.putImageData(tempImageData, 0, 0);

    // 4. Redimensionner vers l'image originale (en tenant compte du letterbox)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, origWidth, origHeight);

    // Zone valide dans l'espace proto (sans padding)
    const validX1 = Math.floor(padX * scaleToProto);
    const validY1 = Math.floor(padY * scaleToProto);
    const validW = Math.ceil((INPUT_SIZE - 2 * padX) * scaleToProto);
    const validH = Math.ceil((INPUT_SIZE - 2 * padY) * scaleToProto);

    ctx.drawImage(
        tempCanvas,
        validX1, validY1, validW, validH,
        0, 0, origWidth, origHeight
    );

    // 5. Extraire le masque final
    const finalImageData = ctx.getImageData(0, 0, origWidth, origHeight);
    const finalMask = new Uint8Array(origWidth * origHeight);

    for (let i = 0; i < finalMask.length; i++) {
        finalMask[i] = finalImageData.data[i * 4] > 127 ? 255 : 0;
    }

    return { mask: finalMask, width: origWidth, height: origHeight };
}

/**
 * Trouve les 4 coins du document à partir du masque de segmentation
 * Utilise l'algorithme de Douglas-Peucker pour simplifier le contour
 */
function findCornersFromMask(maskData, width, height) {
    const { mask } = maskData;

    // 1. Trouver les contours du masque (marching squares simplifié)
    const contourPoints = [];

    // Scanner horizontalement pour trouver les bords
    for (let y = 0; y < height; y++) {
        let inMask = false;
        for (let x = 0; x < width; x++) {
            const val = mask[y * width + x];
            if (!inMask && val > 0) {
                contourPoints.push({ x, y });
                inMask = true;
            } else if (inMask && val === 0) {
                contourPoints.push({ x: x - 1, y });
                inMask = false;
            }
        }
        if (inMask) {
            contourPoints.push({ x: width - 1, y });
        }
    }

    // Scanner verticalement aussi
    for (let x = 0; x < width; x++) {
        let inMask = false;
        for (let y = 0; y < height; y++) {
            const val = mask[y * width + x];
            if (!inMask && val > 0) {
                contourPoints.push({ x, y });
                inMask = true;
            } else if (inMask && val === 0) {
                contourPoints.push({ x, y: y - 1 });
                inMask = false;
            }
        }
        if (inMask) {
            contourPoints.push({ x, y: height - 1 });
        }
    }

    if (contourPoints.length < 4) {
        logger.warn('[YOLO-Seg] Pas assez de points de contour');
        return null;
    }

    // 2. Trouver le centre du masque
    let sumX = 0, sumY = 0;
    for (const p of contourPoints) {
        sumX += p.x;
        sumY += p.y;
    }
    const centerX = sumX / contourPoints.length;
    const centerY = sumY / contourPoints.length;

    // 3. Trier les points par angle depuis le centre
    const sortedPoints = contourPoints.map(p => ({
        ...p,
        angle: Math.atan2(p.y - centerY, p.x - centerX)
    })).sort((a, b) => a.angle - b.angle);

    // 4. Convex Hull simplifié - trouver les 4 coins extrêmes
    // Top-Left: min(x+y), Top-Right: max(x-y), Bottom-Right: max(x+y), Bottom-Left: min(x-y)
    let topLeft = null, topRight = null, bottomRight = null, bottomLeft = null;
    let minSum = Infinity, maxSum = -Infinity;
    let minDiff = Infinity, maxDiff = -Infinity;

    for (const p of contourPoints) {
        const sum = p.x + p.y;
        const diff = p.x - p.y;

        if (sum < minSum) {
            minSum = sum;
            topLeft = p;
        }
        if (sum > maxSum) {
            maxSum = sum;
            bottomRight = p;
        }
        if (diff > maxDiff) {
            maxDiff = diff;
            topRight = p;
        }
        if (diff < minDiff) {
            minDiff = diff;
            bottomLeft = p;
        }
    }

    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
        logger.warn('[YOLO-Seg] Impossible de trouver les 4 coins');
        return null;
    }

    // 5. Retourner dans l'ordre: TL, TR, BR, BL
    return [
        { x: topLeft.x, y: topLeft.y },
        { x: topRight.x, y: topRight.y },
        { x: bottomRight.x, y: bottomRight.y },
        { x: bottomLeft.x, y: bottomLeft.y }
    ];
}

/**
 * Convertit une bounding box en 4 coins (fallback si pas de segmentation)
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
 * Vérifie si le modèle est un modèle de segmentation
 */
export function isSegmentation() {
    return isSegmentationModel;
}

/**
 * Détecte un document dans une image avec YOLO (Detection ou Segmentation)
 * @param {ImageData|HTMLCanvasElement|HTMLImageElement} input
 * @param {Object} options
 * @returns {Object|null} { corners, confidence, bbox, method }
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

        // 3. Post-traitement selon le type de modèle
        const outputName = session.outputNames[0];
        const output = results[outputName];

        let corners = null;
        let method = 'yolo-detection';
        let maskData = null;

        if (isSegmentationModel && session.outputNames.length >= 2) {
            // Mode Segmentation: extraire les coefficients de masque
            const detections = postprocess(output, preInfo, confThreshold, true);

            if (detections.length > 0) {
                const best = detections[0];

                // Obtenir les proto masks (output1)
                const protoOutput = results[session.outputNames[1]];
                const protoMasks = protoOutput.data;

                logger.log(`[YOLO-Seg] Proto masks dims: ${protoOutput.dims}`);

                if (best.maskCoeffs && protoMasks) {
                    // Générer le masque de segmentation
                    maskData = generateMask(best.maskCoeffs, protoMasks, best, preInfo);

                    // Trouver les 4 coins à partir du masque
                    corners = findCornersFromMask(maskData, preInfo.origWidth, preInfo.origHeight);

                    if (corners) {
                        method = 'yolo-segmentation';
                        logger.log('[YOLO-Seg] Coins trouvés via segmentation!');
                    } else {
                        // Fallback: utiliser la bbox
                        corners = bboxToCorners(best);
                        method = 'yolo-seg-fallback-bbox';
                        logger.log('[YOLO-Seg] Fallback bbox (coins non trouvés)');
                    }
                } else {
                    corners = bboxToCorners(best);
                    method = 'yolo-seg-no-coeffs';
                }

                const elapsed = performance.now() - startTime;
                logger.log(`[YOLO-Seg] Détection en ${elapsed.toFixed(0)}ms`);

                return {
                    corners,
                    confidence: Math.round(best.confidence * 100),
                    bbox: best,
                    processingTime: elapsed,
                    method,
                    isSegmentation: true,
                    maskData,
                    allDetections: detections
                };
            }
        } else {
            // Mode Détection classique (bbox seulement)
            const detections = postprocess(output, preInfo, confThreshold, false);

            if (detections.length > 0) {
                const best = detections[0];
                corners = bboxToCorners(best);

                const elapsed = performance.now() - startTime;
                logger.log(`[YOLO] Détection en ${elapsed.toFixed(0)}ms - ${detections.length} objet(s)`);

                return {
                    corners,
                    confidence: Math.round(best.confidence * 100),
                    bbox: best,
                    processingTime: elapsed,
                    method: 'yolo-detection',
                    isSegmentation: false,
                    allDetections: detections
                };
            }
        }

        const elapsed = performance.now() - startTime;
        logger.log(`[YOLO] Aucune détection en ${elapsed.toFixed(0)}ms`);
        return null;

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
    isSegmentation,
    detectDocumentYolo
};
