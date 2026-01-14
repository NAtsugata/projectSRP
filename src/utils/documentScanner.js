// src/utils/documentScanner.js
// Utilitaires pour scanner et traiter des documents avec OpenCV.js
// Implémente la détection de contours, la correction de perspective et les filtres "Magic"

/**
 * Vérifie si OpenCV est chargé
 */
export const isOpenCvReady = () => {
  return !!(window.cv && window.cv.Mat);
};

/**
 * Détecte les bords d'un document dans une image avec OpenCV
 * Retourne les 4 coins du document détecté ou null
 *
 * Version améliorée avec:
 * - Downscaling pour réduire le bruit et améliorer les performances
 * - Morphologie (Close) pour stabiliser les contours
 * - RETR_EXTERNAL pour ne garder que les contours extérieurs
 */
export function detectDocumentEdges(imageData) {
  if (!isOpenCvReady()) {
    console.warn('OpenCV not ready, fallback to default corners');
    return getDefaultCorners(imageData.width, imageData.height);
  }

  const cv = window.cv;
  let src = null;
  let smallSrc = null;
  let gray = null;
  let blurred = null;
  let edges = null;
  let closed = null;
  let contours = null;
  let hierarchy = null;
  let kernel = null;

  try {
    // 1. Conversion ImageData -> cv.Mat
    src = cv.matFromImageData(imageData);

    // 2. Downscale (CRUCIAL pour la performance et pour réduire le bruit)
    // Travailler sur une image trop grande rend la détection instable
    const maxDim = Math.max(src.cols, src.rows);
    const targetDim = 500; // Redimensionner max dim à 500px
    const scale = targetDim / maxDim;

    smallSrc = new cv.Mat();
    if (scale < 1) {
      const dsize = new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale));
      cv.resize(src, smallSrc, dsize, 0, 0, cv.INTER_AREA);
    } else {
      src.copyTo(smallSrc);
    }

    // 3. Prétraitement
    gray = new cv.Mat();
    cv.cvtColor(smallSrc, gray, cv.COLOR_RGBA2GRAY, 0);

    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    // 4. Détection de bords (Canny)
    edges = new cv.Mat();
    cv.Canny(blurred, edges, 75, 200);

    // 5. MORPHOLOGIE (Le secret de la stabilité)
    // On "ferme" les trous. Si le contour du papier est interrompu, ça le reconnecte.
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    closed = new cv.Mat();
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

    // 6. Trouver les contours sur l'image 'closed'
    // RETR_EXTERNAL: on veut seulement les contours extérieurs
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 7. Trouver le plus grand quadrilatère
    let maxArea = 0;
    let bestContour = null;
    const minArea = (smallSrc.cols * smallSrc.rows) * 0.1; // Au moins 10% de l'image réduite

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);

      if (area > minArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4 && area > maxArea) {
          maxArea = area;
          // Copier le contour car approx sera supprimé
          if (bestContour) bestContour.delete();
          bestContour = approx.clone();
        }
        approx.delete();
      }
    }

    if (bestContour) {
      // Convertir en format {x, y} standard
      // IMPORTANT: Remettre les coordonnées à l'échelle originale
      const points = [];
      for (let i = 0; i < 4; i++) {
        points.push({
          x: Math.round(bestContour.data32S[i * 2] / scale),
          y: Math.round(bestContour.data32S[i * 2 + 1] / scale)
        });
      }
      bestContour.delete();
      return sortCorners(points);
    }

    return getDefaultCorners(imageData.width, imageData.height);

  } catch (err) {
    console.error('OpenCV detection error:', err);
    return getDefaultCorners(imageData.width, imageData.height);
  } finally {
    // Nettoyage mémoire CRITIQUE avec OpenCV.js
    if (src) src.delete();
    if (smallSrc) smallSrc.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (edges) edges.delete();
    if (closed) closed.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
    if (kernel) kernel.delete();
  }
}

/**
 * Trie les coins dans l'ordre: TL, TR, BR, BL
 */
function sortCorners(points) {
  // Trier par Y pour séparer haut/bas
  points.sort((a, b) => a.y - b.y);

  const top = points.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = points.slice(2, 4).sort((a, b) => b.x - a.x); // Note: BR puis BL pour l'ordre horaire

  return [
    top[0],     // Top-Left
    top[1],     // Top-Right
    bottom[0],  // Bottom-Right
    bottom[1]   // Bottom-Left
  ];
}

/**
 * Applique une transformation de perspective pour redresser le document
 */
export function applyPerspectiveTransform(canvas, sourceCorners, outputWidth = null, outputHeight = null) {
  if (!isOpenCvReady()) return canvas;

  const cv = window.cv;
  let src = null;
  let dst = null;
  let M = null;
  let dsize = null;

  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    src = cv.matFromImageData(imageData);

    // Définir les dimensions de sortie si non fournies (basées sur la largeur max et hauteur max)
    if (!outputWidth || !outputHeight) {
      const widthTop = Math.hypot(sourceCorners[1].x - sourceCorners[0].x, sourceCorners[1].y - sourceCorners[0].y);
      const widthBottom = Math.hypot(sourceCorners[2].x - sourceCorners[3].x, sourceCorners[2].y - sourceCorners[3].y);
      const heightLeft = Math.hypot(sourceCorners[3].x - sourceCorners[0].x, sourceCorners[3].y - sourceCorners[0].y);
      const heightRight = Math.hypot(sourceCorners[2].x - sourceCorners[1].x, sourceCorners[2].y - sourceCorners[1].y);

      outputWidth = Math.max(widthTop, widthBottom);
      outputHeight = Math.max(heightLeft, heightRight);
    }

    // Points source (format OpenCV)
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      sourceCorners[0].x, sourceCorners[0].y,
      sourceCorners[1].x, sourceCorners[1].y,
      sourceCorners[2].x, sourceCorners[2].y,
      sourceCorners[3].x, sourceCorners[3].y
    ]);

    // Points destination (Rectangle parfait)
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outputWidth, 0,
      outputWidth, outputHeight,
      0, outputHeight
    ]);

    // Calculer la matrice de transformation
    M = cv.getPerspectiveTransform(srcTri, dstTri);

    // Appliquer la transformation
    dst = new cv.Mat();
    dsize = new cv.Size(outputWidth, outputHeight);
    cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    // Créer le canvas de sortie
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    // Afficher le résultat sur le canvas
    cv.imshow(outputCanvas, dst);

    // Nettoyage intermédiaire
    srcTri.delete();
    dstTri.delete();

    return outputCanvas;

  } catch (err) {
    console.error('Perspective transform error:', err);
    return canvas;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
    if (M) M.delete();
  }
}

/**
 * REPLIQUE DU FILTRE "MAGIC" / "DOCS"
 * Supprime les ombres et blanchit le fond tout en gardant le texte net (pas juste du noir pur)
 * Utilise la technique de division par le fond (Shadow Removal)
 */
export function enhanceBlackAndWhite(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  let src = null, gray = null, dilated = null, bg = null, diff = null, norm = null, kernel = null;

  try {
    src = cv.matFromImageData(imageData);
    gray = new cv.Mat();

    // 1. Conversion en Gris
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 2. Estimation du fond (Background)
    // On dilate l'image pour supprimer le texte (garder que le papier) puis on floute
    dilated = new cv.Mat();
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
    cv.morphologyEx(gray, dilated, cv.MORPH_DILATE, kernel); // Dilater pour effacer le texte noir

    bg = new cv.Mat();
    // Gros flou pour lisser le fond
    cv.GaussianBlur(dilated, bg, new cv.Size(21, 21), 0, 0);

    // 3. Division : (Image / Fond) * 255
    // Cela "aplatit" l'éclairage. Les zones d'ombre disparaissent.
    diff = new cv.Mat();
    cv.divide(gray, bg, diff, 255.0, -1);

    // 4. Augmenter le contraste final (Threshold intelligent)
    // On ne fait pas un binaire pur, mais on force le gris clair vers le blanc
    norm = new cv.Mat();
    // Threshold avec dégradé (Style ClearScanner)
    // Tout ce qui est gris foncé devient noir, tout ce qui est gris clair devient blanc
    // mais on garde une transition pour l'antialiasing.
    cv.threshold(diff, norm, 200, 255, cv.THRESH_TRUNC); // Coupe les blancs
    cv.normalize(norm, norm, 0, 255, cv.NORM_MINMAX);

    // Retour en RGBA
    const rgbaDst = new cv.Mat();
    cv.cvtColor(norm, rgbaDst, cv.COLOR_GRAY2RGBA);

    const result = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    // Nettoyage intermédiaire
    rgbaDst.delete();
    kernel.delete();
    kernel = null; // Avoid double delete in finally

    return result;

  } catch (err) {
    console.error('Magic Filter Error:', err);
    return imageData;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (dilated) dilated.delete();
    if (bg) bg.delete();
    if (diff) diff.delete();
    if (norm) norm.delete();
    if (kernel) kernel.delete();
  }
}

/**
 * Améliore l'image - Mode Gris (Contraste amélioré)
 */
export function enhanceGrayscale(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  let src = null;
  let dst = null;

  try {
    src = cv.matFromImageData(imageData);
    dst = new cv.Mat();

    // Convertir en gris
    cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

    // Normaliser / Égaliser l'histogramme pour le contraste
    // CLAHE (Contrast Limited Adaptive Histogram Equalization) est mieux que equalizeHist global
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    clahe.apply(dst, dst);
    clahe.delete();

    // Retour en RGBA
    const rgbaDst = new cv.Mat();
    cv.cvtColor(dst, rgbaDst, cv.COLOR_GRAY2RGBA, 0);

    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    rgbaDst.delete();
    return imgData;

  } catch (err) {
    console.error('Enhance Gray error:', err);
    return imageData;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
  }
}

/**
 * Améliore l'image - Mode Couleur (Denoise + Sharpen)
 */
export function enhanceColor(imageData) {
  if (!isOpenCvReady()) return imageData;

  const cv = window.cv;
  let src = null;
  let dst = null;

  try {
    src = cv.matFromImageData(imageData);
    dst = new cv.Mat();

    // Convertir en RGB
    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB, 0);

    // Denoising (peut être lent en JS, on utilise un flou bilatéral léger à la place)
    // cv.bilateralFilter(src, dst, 9, 75, 75); // Trop lent en WASM souvent

    // Simple Sharpening kernel
    const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ]);

    cv.filter2D(src, dst, -1, kernel);
    kernel.delete();

    // Retour en RGBA
    const rgbaDst = new cv.Mat();
    cv.cvtColor(dst, rgbaDst, cv.COLOR_RGB2RGBA, 0);

    const imgData = new ImageData(
      new Uint8ClampedArray(rgbaDst.data),
      rgbaDst.cols,
      rgbaDst.rows
    );

    rgbaDst.delete();
    return imgData;

  } catch (err) {
    console.error('Enhance Color error:', err);
    return imageData;
  } finally {
    if (src) src.delete();
    if (dst) dst.delete();
  }
}

/**
 * Retourne les coins par défaut (toute l'image avec marge)
 */
function getDefaultCorners(width, height) {
  const margin = Math.min(width, height) * 0.1;
  return [
    { x: margin, y: margin },
    { x: width - margin, y: margin },
    { x: width - margin, y: height - margin },
    { x: margin, y: height - margin }
  ];
}

/**
 * Détecte automatiquement le meilleur mode
 */
export function detectBestMode(imageData) {
  // Logique simple basée sur la saturation
  // Si saturation moyenne faible -> BW ou Gray
  // Sinon -> Color
  return 'bw'; // Par défaut pour les documents administratifs
}
