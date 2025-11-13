// src/utils/mobileDiagnostics.js
// Outil de diagnostic pour identifier les problèmes d'upload sur mobile

/**
 * Vérifie toutes les capacités du navigateur mobile
 */
export const runMobileDiagnostics = () => {
  const diagnostics = {
    timestamp: new Date().toISOString(),

    // Informations de base
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,

    // Détection du device
    deviceInfo: {
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isAndroid: /Android/.test(navigator.userAgent),
      isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
      isChrome: /Chrome/.test(navigator.userAgent),
      isFirefox: /Firefox/.test(navigator.userAgent),
    },

    // Version iOS/Android
    osVersion: getOSVersion(),

    // Capacités du navigateur
    capabilities: {
      fileAPI: typeof window.File !== 'undefined' &&
               typeof window.FileReader !== 'undefined' &&
               typeof window.FileList !== 'undefined' &&
               typeof window.Blob !== 'undefined',
      dataTransfer: typeof DataTransfer !== 'undefined',
      dataTransferItems: typeof DataTransfer !== 'undefined' &&
                         DataTransfer.prototype.hasOwnProperty('items'),
      canvas: typeof document.createElement('canvas').getContext !== 'undefined',
      createObjectURL: typeof URL.createObjectURL !== 'undefined',
      webWorkers: typeof Worker !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      storage: {
        localStorage: checkStorage('localStorage'),
        sessionStorage: checkStorage('sessionStorage'),
        indexedDB: typeof indexedDB !== 'undefined',
      },
    },

    // Permissions
    permissions: {
      camera: 'NotSupported',
      storage: 'NotSupported',
    },

    // Connexion
    connection: {
      online: navigator.onLine,
      type: getConnectionType(),
      effectiveType: getEffectiveType(),
      downlink: getDownlink(),
    },

    // Mémoire et stockage
    memory: {
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    },

    // Stockage disponible
    storage: {
      quota: 'checking...',
      usage: 'checking...',
    },

    // Erreurs potentielles
    errors: [],
    warnings: [],
  };

  // Vérifier les permissions de manière asynchrone
  checkPermissions(diagnostics);

  // Vérifier le stockage
  checkStorageQuota(diagnostics);

  // Vérifier les problèmes connus
  detectKnownIssues(diagnostics);

  return diagnostics;
};

/**
 * Récupère la version de l'OS
 */
function getOSVersion() {
  const ua = navigator.userAgent;

  // iOS version
  const iosMatch = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
  if (iosMatch) {
    return `iOS ${iosMatch[1]}.${iosMatch[2]}${iosMatch[3] ? '.' + iosMatch[3] : ''}`;
  }

  // Android version
  const androidMatch = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (androidMatch) {
    return `Android ${androidMatch[1]}`;
  }

  return 'Unknown';
}

/**
 * Vérifie si le stockage est disponible
 */
function checkStorage(type) {
  try {
    const storage = window[type];
    const test = '__storage_test__';
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Récupère le type de connexion
 */
function getConnectionType() {
  if (!navigator.connection) return 'unknown';
  return navigator.connection.type || 'unknown';
}

/**
 * Récupère le type effectif de connexion
 */
function getEffectiveType() {
  if (!navigator.connection) return 'unknown';
  return navigator.connection.effectiveType || 'unknown';
}

/**
 * Récupère la vitesse de téléchargement
 */
function getDownlink() {
  if (!navigator.connection) return 'unknown';
  return navigator.connection.downlink || 'unknown';
}

/**
 * Vérifie les permissions
 */
async function checkPermissions(diagnostics) {
  if (!navigator.permissions) {
    diagnostics.permissions.camera = 'API non disponible';
    diagnostics.permissions.storage = 'API non disponible';
    return;
  }

  try {
    // Vérifier permission caméra
    const cameraPermission = await navigator.permissions.query({ name: 'camera' });
    diagnostics.permissions.camera = cameraPermission.state;
  } catch (e) {
    diagnostics.permissions.camera = `Erreur: ${e.message}`;
  }

  // Note: 'storage' permission n'existe pas sur tous les navigateurs
}

/**
 * Vérifie le quota de stockage
 */
async function checkStorageQuota(diagnostics) {
  if (!navigator.storage || !navigator.storage.estimate) {
    diagnostics.storage.quota = 'API non disponible';
    diagnostics.storage.usage = 'API non disponible';
    return;
  }

  try {
    const estimate = await navigator.storage.estimate();
    diagnostics.storage.quota = formatBytes(estimate.quota);
    diagnostics.storage.usage = formatBytes(estimate.usage);
    diagnostics.storage.available = formatBytes(estimate.quota - estimate.usage);
    diagnostics.storage.percentUsed = ((estimate.usage / estimate.quota) * 100).toFixed(2) + '%';
  } catch (e) {
    diagnostics.storage.error = e.message;
  }
}

/**
 * Détecte les problèmes connus
 */
function detectKnownIssues(diagnostics) {
  const { deviceInfo, capabilities, osVersion, connection } = diagnostics;

  // iOS < 13 + Safari : Problèmes avec DataTransfer
  if (deviceInfo.isIOS && deviceInfo.isSafari && !capabilities.dataTransferItems) {
    diagnostics.warnings.push('iOS Safari ancien détecté - DataTransfer limité');
  }

  // Android < 7 : Problèmes potentiels avec canvas.toBlob
  if (deviceInfo.isAndroid && osVersion.includes('Android') && parseFloat(osVersion.replace('Android ', '')) < 7) {
    diagnostics.warnings.push('Android ancien - compression d\'images peut être lente');
  }

  // Connexion lente
  if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
    diagnostics.warnings.push('Connexion très lente détectée (2G)');
  }

  // Pas d'API File
  if (!capabilities.fileAPI) {
    diagnostics.errors.push('CRITIQUE: API File non disponible - upload impossible');
  }

  // Pas de canvas
  if (!capabilities.canvas) {
    diagnostics.errors.push('CRITIQUE: Canvas non disponible - compression impossible');
  }

  // Mode navigation privée iOS
  if (deviceInfo.isIOS && !capabilities.storage.localStorage) {
    diagnostics.warnings.push('Mode navigation privée détecté sur iOS - fonctionnalités limitées');
  }

  // Quota de stockage faible
  if (diagnostics.storage.percentUsed && parseFloat(diagnostics.storage.percentUsed) > 90) {
    diagnostics.errors.push('CRITIQUE: Espace de stockage presque plein (' + diagnostics.storage.percentUsed + ')');
  }

  // Offline
  if (!connection.online) {
    diagnostics.errors.push('CRITIQUE: Appareil hors ligne');
  }
}

/**
 * Formate les bytes en format lisible
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Génère un rapport lisible
 */
export const generateDiagnosticReport = (diagnostics) => {
  let report = '=== DIAGNOSTIC MOBILE ===\n\n';

  report += `Date: ${new Date(diagnostics.timestamp).toLocaleString('fr-FR')}\n\n`;

  report += `Appareil: ${diagnostics.deviceInfo.isIOS ? 'iOS' : diagnostics.deviceInfo.isAndroid ? 'Android' : 'Desktop'}\n`;
  report += `OS Version: ${diagnostics.osVersion}\n`;
  report += `Navigateur: ${diagnostics.deviceInfo.isSafari ? 'Safari' : diagnostics.deviceInfo.isChrome ? 'Chrome' : diagnostics.deviceInfo.isFirefox ? 'Firefox' : 'Autre'}\n`;
  report += `User Agent: ${diagnostics.userAgent}\n\n`;

  report += '=== CAPACITÉS ===\n';
  report += `API File: ${diagnostics.capabilities.fileAPI ? '✅' : '❌'}\n`;
  report += `DataTransfer: ${diagnostics.capabilities.dataTransfer ? '✅' : '❌'}\n`;
  report += `Canvas: ${diagnostics.capabilities.canvas ? '✅' : '❌'}\n`;
  report += `IndexedDB: ${diagnostics.capabilities.storage.indexedDB ? '✅' : '❌'}\n\n`;

  report += '=== CONNEXION ===\n';
  report += `Statut: ${diagnostics.connection.online ? '✅ En ligne' : '❌ Hors ligne'}\n`;
  report += `Type: ${diagnostics.connection.effectiveType}\n`;
  report += `Vitesse: ${diagnostics.connection.downlink} Mbps\n\n`;

  report += '=== STOCKAGE ===\n';
  report += `Quota: ${diagnostics.storage.quota}\n`;
  report += `Utilisé: ${diagnostics.storage.usage}\n`;
  report += `Disponible: ${diagnostics.storage.available}\n`;
  report += `Pourcentage: ${diagnostics.storage.percentUsed}\n\n`;

  if (diagnostics.errors.length > 0) {
    report += '=== ❌ ERREURS CRITIQUES ===\n';
    diagnostics.errors.forEach((error, i) => {
      report += `${i + 1}. ${error}\n`;
    });
    report += '\n';
  }

  if (diagnostics.warnings.length > 0) {
    report += '=== ⚠️ AVERTISSEMENTS ===\n';
    diagnostics.warnings.forEach((warning, i) => {
      report += `${i + 1}. ${warning}\n`;
    });
    report += '\n';
  }

  report += '=== RECOMMANDATIONS ===\n';

  if (diagnostics.errors.length > 0) {
    report += '1. Résoudre les erreurs critiques ci-dessus\n';
  }

  if (diagnostics.storage.percentUsed && parseFloat(diagnostics.storage.percentUsed) > 80) {
    report += '2. Libérer de l\'espace de stockage sur l\'appareil\n';
  }

  if (diagnostics.connection.effectiveType === '2g' || diagnostics.connection.effectiveType === 'slow-2g') {
    report += '3. Se connecter à un réseau WiFi pour de meilleurs uploads\n';
  }

  if (diagnostics.deviceInfo.isIOS && !diagnostics.capabilities.dataTransferItems) {
    report += '4. Mettre à jour iOS vers la dernière version\n';
  }

  return report;
};

/**
 * Test d'upload de fichier simulé
 */
export const testFileUpload = async (file) => {
  const test = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    canRead: false,
    canCompress: false,
    errors: [],
  };

  try {
    // Test lecture du fichier
    const reader = new FileReader();
    await new Promise((resolve, reject) => {
      reader.onload = () => {
        test.canRead = true;
        resolve();
      };
      reader.onerror = () => {
        test.errors.push('Impossible de lire le fichier');
        reject();
      };
      reader.readAsDataURL(file);
    });
  } catch (e) {
    test.canRead = false;
    test.errors.push(`Erreur lecture: ${e.message}`);
  }

  // Test compression (si image)
  if (file.type.startsWith('image/')) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          test.errors.push('Timeout compression (30s)');
          reject(new Error('Timeout'));
        }, 30000);

        img.onload = () => {
          clearTimeout(timeout);
          canvas.width = 100;
          canvas.height = 100;
          ctx.drawImage(img, 0, 0, 100, 100);

          canvas.toBlob((blob) => {
            if (blob) {
              test.canCompress = true;
              test.compressedSize = blob.size;
            } else {
              test.errors.push('canvas.toBlob a retourné null');
            }
            resolve();
          }, 'image/jpeg', 0.8);
        };

        img.onerror = () => {
          clearTimeout(timeout);
          test.errors.push('Impossible de charger l\'image');
          reject();
        };

        img.src = URL.createObjectURL(file);
      });
    } catch (e) {
      test.canCompress = false;
      test.errors.push(`Erreur compression: ${e.message}`);
    }
  }

  return test;
};

export default {
  runMobileDiagnostics,
  generateDiagnosticReport,
  testFileUpload,
};
