// src/utils/pdfGenerator.js
// Utilitaire pour générer des PDFs à partir d'images scannées
import { jsPDF } from 'jspdf';
import logger from './logger';

/**
 * Crée un PDF à partir d'une liste de documents scannés
 * @param {Array} documents - Liste de documents avec url/blob
 * @param {Object} options - Options de génération
 * @returns {Promise<Blob>} - Le PDF généré sous forme de Blob
 */
export async function createPdfFromDocuments(documents, options = {}) {
  const {
    title = 'Document scanné',
    pageSize = 'a4',
    orientation = 'portrait',
    quality = 0.98, // Qualité maximale
    margin = 10 // mm
  } = options;

  if (!documents || documents.length === 0) {
    throw new Error('Aucun document à convertir en PDF');
  }

  logger.log(`[PDF] Création du PDF avec ${documents.length} page(s)...`);

  // Créer le PDF
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize
  });

  // Dimensions de la page
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];

    // Ajouter une nouvelle page (sauf pour la première)
    if (i > 0) {
      pdf.addPage();
    }

    try {
      // Charger l'image
      const imageDataUrl = await getImageDataUrl(doc);

      if (!imageDataUrl) {
        logger.warn(`[PDF] Document ${i + 1} ignoré - pas d'image valide`);
        continue;
      }

      // Obtenir les dimensions de l'image
      const imgDimensions = await getImageDimensions(imageDataUrl);

      // Calculer les dimensions pour maintenir le ratio
      const { width, height, x, y } = calculateFitDimensions(
        imgDimensions.width,
        imgDimensions.height,
        contentWidth,
        contentHeight,
        margin
      );

      // Ajouter l'image au PDF - FAST = meilleure qualité (moins de compression)
      pdf.addImage(imageDataUrl, 'JPEG', x, y, width, height, undefined, 'FAST');

      logger.log(`[PDF] Page ${i + 1}/${documents.length} ajoutée`);
    } catch (err) {
      logger.error(`[PDF] Erreur page ${i + 1}:`, err);
    }
  }

  // Métadonnées du PDF
  pdf.setProperties({
    title: title,
    subject: 'Document scanné',
    creator: 'ClearScanner',
    author: 'SRP Portal'
  });

  // Retourner le blob
  const pdfBlob = pdf.output('blob');
  logger.log(`[PDF] PDF créé avec succès (${(pdfBlob.size / 1024).toFixed(1)} KB)`);

  return pdfBlob;
}

/**
 * Télécharge un PDF généré
 * @param {Blob} pdfBlob - Le PDF sous forme de Blob
 * @param {string} filename - Nom du fichier
 */
export function downloadPdf(pdfBlob, filename = 'scan.pdf') {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  logger.log(`[PDF] Téléchargement: ${link.download}`);
}

/**
 * Crée et télécharge un PDF en une seule opération
 * @param {Array} documents - Liste de documents
 * @param {string} filename - Nom du fichier
 * @param {Object} options - Options de génération
 */
export async function createAndDownloadPdf(documents, filename = 'scan', options = {}) {
  const pdfBlob = await createPdfFromDocuments(documents, options);
  downloadPdf(pdfBlob, filename);
  return pdfBlob;
}

/**
 * Convertit un document en dataURL
 */
async function getImageDataUrl(doc) {
  // Si c'est déjà un dataURL
  if (doc.url && doc.url.startsWith('data:')) {
    return doc.url;
  }

  // Si c'est une URL blob
  if (doc.url && doc.url.startsWith('blob:')) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        // Qualité maximale 0.98 pour export HD
        resolve(canvas.toDataURL('image/jpeg', 0.98));
      };
      img.onerror = reject;
      img.src = doc.url;
    });
  }

  // Si c'est un blob direct
  if (doc.blob instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(doc.blob);
    });
  }

  return null;
}

/**
 * Obtient les dimensions d'une image
 */
function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Calcule les dimensions pour que l'image tienne dans la zone disponible
 */
function calculateFitDimensions(imgWidth, imgHeight, maxWidth, maxHeight, margin) {
  const imgRatio = imgWidth / imgHeight;
  const areaRatio = maxWidth / maxHeight;

  let width, height;

  if (imgRatio > areaRatio) {
    // Image plus large que la zone - ajuster par largeur
    width = maxWidth;
    height = maxWidth / imgRatio;
  } else {
    // Image plus haute que la zone - ajuster par hauteur
    height = maxHeight;
    width = maxHeight * imgRatio;
  }

  // Centrer l'image
  const x = margin + (maxWidth - width) / 2;
  const y = margin + (maxHeight - height) / 2;

  return { width, height, x, y };
}

/**
 * Télécharge les images individuellement en ZIP (alternatif au PDF)
 */
export async function downloadImagesAsZip(documents, baseName = 'scan') {
  // Pour l'instant, télécharger chaque image individuellement
  // Une vraie implémentation utiliserait JSZip
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const dataUrl = await getImageDataUrl(doc);

    if (dataUrl) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${baseName}_${i + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Petit délai entre chaque téléchargement
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

export default {
  createPdfFromDocuments,
  downloadPdf,
  createAndDownloadPdf,
  downloadImagesAsZip
};
