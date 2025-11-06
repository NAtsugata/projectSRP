// src/hooks/useMobileUpload.js - Hook central pour l'upload mobile avec détection sécurisée
import { useState, useCallback, useEffect } from 'react';
import { storageService } from '../lib/supabase';
import {
  storeFileForUpload,
  getPendingUploads,
  updateUploadStatus,
  deleteUpload,
  clearAllUploads,
  arrayBufferToFile,
  getCacheStats
} from '../utils/indexedDBCache';

// ✅ HOOK POUR DÉTECTER LES CAPACITÉS DU DEVICE
export const useDeviceCapabilities = () => {
  const [capabilities, setCapabilities] = useState({
    hasCamera: false,
    supportsFileAPI: false,
    supportsDragDrop: false,
    isMobile: false,
    isIOS: false,
    isAndroid: false,
    supportsCapture: false
  });

  useEffect(() => {
    const checkCapabilities = async () => {
      const isNavigator = typeof navigator !== 'undefined';
      const ua = isNavigator && navigator.userAgent ? navigator.userAgent : '';
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isAndroid = /Android/.test(ua);

      let hasCamera = false;
      if (
        isNavigator &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.enumerateDevices === 'function'
      ) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasCamera = devices.some((d) => d.kind === 'videoinput');
        } catch {
          hasCamera = true;
        }
      }

      setCapabilities({
        hasCamera,
        supportsFileAPI:
          typeof window !== 'undefined' && 'FileReader' in window && 'File' in window,
        supportsDragDrop: typeof window !== 'undefined' && 'ondrop' in window && !isMobile,
        isMobile,
        isIOS,
        isAndroid,
        supportsCapture:
          isMobile &&
          typeof document !== 'undefined' &&
          'capture' in document.createElement('input')
      });
    };

    checkCapabilities();
  }, []);

  return capabilities;
};

// ✅ HOOK POUR COMPRESSION D'IMAGES OPTIMISÉE MOBILE
export const useImageCompression = () => {
  const compressImage = useCallback(async (file, options = {}) => {
    if (!file || !file.type.startsWith('image/')) {
      return file;
    }

    const {
      maxSizeMB = 1,
      maxWidthOrHeight = 1920,
      quality = 0.8,
      outputFormat = 'jpeg'
    } = options;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calcul des nouvelles dimensions
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = (height * maxWidthOrHeight) / width;
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = (width * maxWidthOrHeight) / height;
            height = maxWidthOrHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Dessin de l'image redimensionnée
        ctx.drawImage(img, 0, 0, width, height);

        // Conversion en Blob
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size <= maxSizeMB * 1024 * 1024) {
              const compressedFile = new File([blob], file.name, {
                type: `image/${outputFormat}`,
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              // Si toujours trop gros, réduire la qualité
              canvas.toBlob(
                (smallerBlob) => {
                  const finalFile = new File([smallerBlob], file.name, {
                    type: `image/${outputFormat}`,
                    lastModified: Date.now()
                  });
                  resolve(finalFile);
                },
                `image/${outputFormat}`,
                quality * 0.7
              );
            }
          },
          `image/${outputFormat}`,
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  return { compressImage };
};

// ✅ HOOK POUR UPLOADS RÉSILIENTS AVEC RETRY
export const useResilientUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadWithRetry = useCallback(async (file, interventionId, options = {}) => {
    const {
      maxRetries = 3,
      folder = 'report',
      compressionOptions = {}
    } = options;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Compression si c'est une image
    let fileToUpload = file;
    if (file.type.startsWith('image/') && compressionOptions.enabled !== false) {
      try {
        const { compressImage } = useImageCompression();
        fileToUpload = await compressImage(file, compressionOptions);
      } catch (compressionError) {
        console.warn('Compression failed, using original file:', compressionError);
      }
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setUploadProgress(attempt === 1 ? 10 : (attempt - 1) * 25);

        const result = await storageService.uploadInterventionFile(
          fileToUpload,
          interventionId,
          folder
        );

        if (result.error) {
          throw result.error;
        }

        setUploadProgress(100);
        setIsUploading(false);
        return result;
      } catch (uploadError) {
        console.error(`Upload attempt ${attempt} failed:`, uploadError);

        if (attempt === maxRetries) {
          setError(uploadError.message || "Échec de l'upload après plusieurs tentatives");
          setIsUploading(false);
          throw uploadError;
        }

        // Backoff exponentiel avec jitter
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        const jitter = Math.random() * 0.1 * baseDelay;
        const delay = baseDelay + jitter;

        setUploadProgress(attempt * 20);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
  }, []);

  return {
    uploadWithRetry,
    isUploading,
    uploadProgress,
    error,
    reset
  };
};

// ✅ HOOK POUR STOCKAGE HORS LIGNE AVEC INDEXEDDB
export const useOfflineUpload = () => {
  const [pendingUploads, setPendingUploads] = useState([]);
  const [cacheStats, setCacheStats] = useState({
    count: 0,
    totalSizeMB: '0.00',
    pending: 0,
    uploading: 0,
    failed: 0,
    completed: 0
  });
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Charger les uploads en attente au montage
  useEffect(() => {
    const loadPendingUploads = async () => {
      try {
        const uploads = await getPendingUploads('pending');
        setPendingUploads(uploads);

        const stats = await getCacheStats();
        setCacheStats(stats);
      } catch (error) {
        console.error('Erreur chargement uploads:', error);
      }
    };

    loadPendingUploads();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const storeForLaterUpload = useCallback(async (file, metadata) => {
    try {
      const uploadId = await storeFileForUpload(file, metadata);

      // Recharger la liste
      const uploads = await getPendingUploads('pending');
      setPendingUploads(uploads);

      const stats = await getCacheStats();
      setCacheStats(stats);

      console.log(`✅ Fichier ${file.name} mis en cache (${uploadId})`);
      return uploadId;
    } catch (err) {
      console.error('Failed to store file for later upload:', err);
      throw err;
    }
  }, []);

  const processPendingUploads = useCallback(async () => {
    if (!isOnline) {
      console.log('⚠️ Hors ligne - uploads en attente');
      return;
    }

    try {
      const pending = await getPendingUploads('pending');
      console.log(`📤 Traitement de ${pending.length} upload(s) en attente...`);

      for (const item of pending) {
        try {
          // Marquer comme "uploading"
          await updateUploadStatus(item.id, 'uploading');

          // Convertir ArrayBuffer en File
          const file = arrayBufferToFile(item);

          // Upload
          const result = await storageService.uploadInterventionFile(
            file,
            item.metadata.interventionId,
            item.metadata.folder
          );

          if (result && !result.error) {
            // Upload réussi - marquer comme completed
            await updateUploadStatus(item.id, 'completed', {
              uploadedUrl: result.url,
              completedAt: new Date().toISOString()
            });
            console.log(`✅ Upload réussi: ${item.fileName}`);
          } else {
            // Échec - marquer comme failed
            await updateUploadStatus(item.id, 'failed', {
              retryCount: (item.retryCount || 0) + 1,
              lastError: result?.error?.message || 'Upload failed'
            });
            console.error(`❌ Upload échoué: ${item.fileName}`);
          }
        } catch (err) {
          console.error('Failed to upload pending file:', err);

          // Marquer comme failed
          await updateUploadStatus(item.id, 'failed', {
            retryCount: (item.retryCount || 0) + 1,
            lastError: err.message
          });
        }
      }

      // Recharger la liste
      const updatedUploads = await getPendingUploads('pending');
      setPendingUploads(updatedUploads);

      const stats = await getCacheStats();
      setCacheStats(stats);

    } catch (error) {
      console.error('Erreur processPendingUploads:', error);
    }
  }, [isOnline]);

  const clearPendingUploads = useCallback(async () => {
    try {
      await clearAllUploads();
      setPendingUploads([]);
      setCacheStats({
        count: 0,
        totalSizeMB: '0.00',
        pending: 0,
        uploading: 0,
        failed: 0,
        completed: 0
      });
    } catch (error) {
      console.error('Erreur clearPendingUploads:', error);
    }
  }, []);

  const retryFailedUpload = useCallback(async (uploadId) => {
    try {
      await updateUploadStatus(uploadId, 'pending');
      const uploads = await getPendingUploads('pending');
      setPendingUploads(uploads);
    } catch (error) {
      console.error('Erreur retryFailedUpload:', error);
    }
  }, []);

  // Auto-traitement quand on revient en ligne
  useEffect(() => {
    if (isOnline && pendingUploads.length > 0) {
      processPendingUploads();
    }
  }, [isOnline, pendingUploads.length, processPendingUploads]);

  return {
    storeForLaterUpload,
    processPendingUploads,
    clearPendingUploads,
    retryFailedUpload,
    pendingUploads,
    cacheStats,
    isOnline
  };
};

// ✅ HOOK POUR VALIDATION ET PRÉPARATION DES FICHIERS
export const useFileValidation = () => {
  const validateFile = useCallback((file, options = {}) => {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB par défaut
      allowedTypes = ['image/*', 'application/pdf'],
      maxFiles = 10
    } = options;

    const errors = [];

    // Vérification de la taille
    if (file.size > maxSize) {
      errors.push(
        `Le fichier est trop volumineux (max: ${Math.round(maxSize / 1024 / 1024)}MB)`
      );
    }

    // Vérification du type
    const isAllowed = allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      errors.push(`Type de fichier non autorisé: ${file.type}`);
    }

    // Vérification du nom de fichier
    if (file.name.length > 255) {
      errors.push('Nom de fichier trop long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  const prepareFiles = useCallback(
    (fileList, options = {}) => {
      const files = Array.from(fileList);
      const validated = files.map((file) => ({
        file,
        validation: validateFile(file, options)
      }));

      const validFiles = validated.filter((item) => item.validation.isValid).map((item) => item.file);
      const invalidFiles = validated.filter((item) => !item.validation.isValid);

      return {
        validFiles,
        invalidFiles,
        totalSize: validFiles.reduce((sum, file) => sum + file.size, 0)
      };
    },
    [validateFile]
  );

  return {
    validateFile,
    prepareFiles
  };
};

// ✅ HOOK PRINCIPAL QUI COMBINE TOUT
export const useMobileUpload = (interventionId, options = {}) => {
  const capabilities = useDeviceCapabilities();
  const { compressImage } = useImageCompression();
  const { uploadWithRetry, isUploading, uploadProgress, error, reset } = useResilientUpload();
  const { storeForLaterUpload, isOnline } = useOfflineUpload();
  const { prepareFiles } = useFileValidation();

  const handleFileUpload = useCallback(
    async (files, uploadOptions = {}) => {
      if (!files || files.length === 0) return;

      const { validFiles, invalidFiles } = prepareFiles(files, options);

      if (invalidFiles.length > 0) {
        console.warn('Some files were rejected:', invalidFiles);
      }

      const results = [];

      for (const file of validFiles) {
        try {
          if (isOnline) {
            const result = await uploadWithRetry(file, interventionId, uploadOptions);
            results.push({
              file,
              success: true,
              result
            });
          } else {
            const id = await storeForLaterUpload(file, {
              interventionId,
              folder: uploadOptions.folder || 'report'
            });
            results.push({
              file,
              success: true,
              stored: true,
              id
            });
          }
        } catch (uploadError) {
          results.push({
            file,
            success: false,
            error: uploadError.message
          });
        }
      }

      return {
        results,
        invalidFiles
      };
    },
    [prepareFiles, isOnline, uploadWithRetry, storeForLaterUpload, interventionId, options]
  );

  return {
    capabilities,
    compressImage,
    uploadWithRetry,
    isUploading,
    uploadProgress,
    error,
    reset,
    handleFileUpload
  };
};