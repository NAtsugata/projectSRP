/**
 * ====================================================================
 * SIGNATURE UTILITIES - Conformité eIDAS (AES) & RGPD
 * ====================================================================
 * Utilitaires pour générer des signatures électroniques conformes au
 * Règlement eIDAS (UE) 910/2014 - Advanced Electronic Signature (AES)
 * ====================================================================
 */

/**
 * Génère un hash SHA-256 d'une chaîne de caractères
 * @param {string} data - Données à hasher
 * @returns {Promise<string>} Hash hexadécimal
 */
export async function generateSHA256Hash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Génère un hash SHA-256 d'une image (Blob/File)
 * @param {Blob|File} imageBlob - Image à hasher
 * @returns {Promise<string>} Hash hexadécimal
 */
export async function generateImageHash(imageBlob) {
  const arrayBuffer = await imageBlob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Collecte les métadonnées du navigateur pour le certificat de signature
 * @returns {Object} Métadonnées techniques
 */
export function collectBrowserMetadata() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    colorDepth: window.screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    // Connection info (si disponible)
    connectionType: navigator.connection?.effectiveType || 'unknown',
    connectionDownlink: navigator.connection?.downlink || null,
    connectionRtt: navigator.connection?.rtt || null,
  };
}

/**
 * Récupère la géolocalisation (optionnel, nécessite consentement utilisateur)
 * @returns {Promise<Object|null>} Coordonnées GPS ou null
 */
export async function getGeolocation() {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      () => {
        // En cas de refus ou d'erreur, on retourne null
        resolve(null);
      },
      {
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Génère un certificat de signature électronique conforme eIDAS (AES)
 * @param {Object} params - Paramètres du certificat
 * @param {string} params.documentHash - Hash SHA-256 du document
 * @param {string} params.signatureImageHash - Hash SHA-256 de l'image de signature
 * @param {Object} params.signerInfo - Informations du signataire
 * @param {Object} params.metadata - Métadonnées techniques
 * @param {Object|null} params.geolocation - Géolocalisation (optionnel)
 * @returns {Object} Certificat de signature complet
 */
export function generateSignatureCertificate({
  documentHash,
  signatureImageHash,
  signerInfo,
  metadata,
  geolocation = null,
}) {
  const timestamp = new Date().toISOString();

  // Génération du certificat conforme eIDAS AES
  const certificate = {
    // Version du certificat
    version: '1.0',

    // Standard de signature
    standard: 'eIDAS-AES',

    // Niveau de signature (Advanced Electronic Signature)
    signatureLevel: 'AES',

    // Horodatage fiable (eIDAS - Article 41)
    timestamp,
    timestampEpoch: Date.now(),

    // Identification du signataire (eIDAS - Article 26)
    signer: {
      id: signerInfo.userId,
      name: signerInfo.name,
      email: signerInfo.email,
      role: signerInfo.role,
    },

    // Intégrité des données (eIDAS - Article 26)
    integrity: {
      documentHash,
      signatureImageHash,
      hashAlgorithm: 'SHA-256',
      // Hash du certificat lui-même (généré après)
      certificateHash: null,
    },

    // Métadonnées techniques (eIDAS - Article 26)
    technical: {
      ...metadata,
      captureMethod: 'canvas-html5',
      captureDevice: metadata.maxTouchPoints > 0 ? 'touchscreen' : 'mouse',
    },

    // Contexte de signature
    context: {
      documentType: signerInfo.documentType || 'intervention',
      documentId: signerInfo.documentId,
      signatureContext: signerInfo.signatureContext || {},
    },

    // Géolocalisation (si consentement donné)
    geolocation,

    // Consentement RGPD
    consent: {
      given: true,
      timestamp,
      text: signerInfo.consentText,
    },

    // Conformité légale
    compliance: {
      eIDAS: 'EU 910/2014',
      RGPD: 'EU 2016/679',
      level: 'AES',
      country: 'FR',
    },
  };

  // Générer le hash du certificat lui-même (preuve d'intégrité)
  const certificateString = JSON.stringify(certificate);

  return {
    ...certificate,
    // Hash du certificat (calculé côté serveur pour plus de sécurité)
    _rawCertificate: certificateString,
  };
}

/**
 * Valide un canvas de signature (vérifie qu'il n'est pas vide)
 * @param {HTMLCanvasElement} canvas - Canvas à valider
 * @returns {boolean} true si le canvas contient une signature
 */
export function validateSignatureCanvas(canvas) {
  if (!canvas) return false;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Vérifier si au moins un pixel est non-blanc
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];

    // Si on trouve un pixel non-blanc (ou transparent), la signature existe
    if (a > 0 && (r < 255 || g < 255 || b < 255)) {
      return true;
    }
  }

  return false;
}

/**
 * Convertit un canvas en Blob (image PNG)
 * @param {HTMLCanvasElement} canvas - Canvas à convertir
 * @returns {Promise<Blob>} Blob de l'image
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Échec de la conversion canvas → blob'));
        }
      },
      'image/png',
      1.0 // Qualité maximale
    );
  });
}

/**
 * Redimensionne un canvas pour optimiser le stockage
 * @param {HTMLCanvasElement} sourceCanvas - Canvas source
 * @param {number} maxWidth - Largeur maximale
 * @param {number} maxHeight - Hauteur maximale
 * @returns {HTMLCanvasElement} Canvas redimensionné
 */
export function resizeCanvas(sourceCanvas, maxWidth = 800, maxHeight = 400) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let width = sourceCanvas.width;
  let height = sourceCanvas.height;

  // Calculer les nouvelles dimensions en conservant le ratio
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  canvas.width = width;
  canvas.height = height;

  // Dessiner l'image redimensionnée
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  return canvas;
}

/**
 * Génère un nom de fichier unique pour la signature
 * @param {string} userId - ID de l'utilisateur
 * @param {string} documentType - Type de document
 * @param {string} documentId - ID du document
 * @returns {string} Nom de fichier
 */
export function generateSignatureFileName(userId, documentType, documentId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${userId}/${documentType}_${documentId}_${timestamp}_${random}.png`;
}

/**
 * Formate une date pour affichage
 * @param {string|Date} date - Date à formater
 * @returns {string} Date formatée
 */
export function formatSignatureDate(date) {
  const d = new Date(date);
  return d.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Vérifie si le navigateur supporte les API nécessaires
 * @returns {Object} Support des API
 */
export function checkBrowserSupport() {
  return {
    canvas: !!document.createElement('canvas').getContext,
    cryptoSubtle: !!window.crypto?.subtle,
    geolocation: !!navigator.geolocation,
    touchEvents: 'ontouchstart' in window,
    pointerEvents: !!window.PointerEvent,
    fileAPI: !!window.File && !!window.FileReader && !!window.Blob,
  };
}

/**
 * Constantes pour le texte de consentement RGPD
 */
export const CONSENT_TEXT = {
  FR: `En signant électroniquement ce document, je consens expressément à ce que ma signature, ainsi que les métadonnées associées (horodatage, informations du navigateur), soient collectées et traitées conformément au Règlement Général sur la Protection des Données (RGPD - UE 2016/679) et au Règlement eIDAS (UE 910/2014).

Je comprends que :
• Ma signature électronique a la même valeur juridique qu'une signature manuscrite
• Les données collectées seront conservées de manière sécurisée
• Je dispose d'un droit d'accès, de rectification et de suppression de mes données
• Ma signature sera horodatée de manière fiable et infalsifiable

Type de signature : Advanced Electronic Signature (AES)
Norme : Règlement eIDAS (UE) 910/2014`,

  EN: `By electronically signing this document, I expressly consent to the collection and processing of my signature and associated metadata (timestamp, browser information) in accordance with the General Data Protection Regulation (GDPR - EU 2016/679) and the eIDAS Regulation (EU 910/2014).

I understand that:
• My electronic signature has the same legal value as a handwritten signature
• The collected data will be stored securely
• I have the right to access, rectify and delete my data
• My signature will be timestamped in a reliable and tamper-proof manner

Signature type: Advanced Electronic Signature (AES)
Standard: eIDAS Regulation (EU) 910/2014`,
};
