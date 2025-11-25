// src/hooks/useMobileFileManager.js - Hook optimisé pour la gestion des fichiers mobile
// avec détection sécurisée et upload résilient. Cette version ajoute des protections
// contre l'absence de navigator/window (environnements SSR ou tests), compresse
// automatiquement les images selon la qualité de la connexion et gère les uploads
// avec retries et progression.

import { useState, useCallback, useEffect, useRef } from 'react';
import { storageService } from '../lib/supabase';

/**
 * Hook principal pour gérer l'upload de fichiers (photos et documents) dans
 * l'application mobile. Il fournit un état d'upload, une méthode
 * `handleFileUpload` pour lancer l'upload, ainsi que des utilitaires de cache
 * et de reset. Les fichiers images sont compressés automatiquement et les
 * uploads sont effectués avec une politique de retry exponentiel.
 *
 * @param {string|number} interventionId - L'identifiant de l'intervention
 */
export const useMobileFileManager = (interventionId) => {
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    queue: [],
    completed: [],
    errors: [],
    globalProgress: 0
  });
  const [displayState, setDisplayState] = useState({
    loadedImages: new Set(),
    imageLoadErrors: new Set(),
    isRefreshing: false
  });
  const abortController = useRef(null);
  const imageCache = useRef(new Map());

  // Détection device sécurisée: on vérifie l'existence de navigator/window
  const deviceInfoRef = useRef(null);
  if (!deviceInfoRef.current) {
    const isNavigator = typeof navigator !== 'undefined';
    const ua = isNavigator && navigator.userAgent ? navigator.userAgent : '';
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const hasCamera = isNavigator && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
    const supportsWebP = typeof document !== 'undefined' && (() => {
      try {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } catch {
        return false;
      }
    })();
    const connectionType = isNavigator && navigator.connection && navigator.connection.effectiveType ? navigator.connection.effectiveType : '4g';
    const memoryLimit = isNavigator && navigator.deviceMemory ? navigator.deviceMemory : 4;
    deviceInfoRef.current = {
      isMobile,
      isIOS,
      isAndroid,
      hasCamera,
      supportsWebP,
      connectionType,
      memoryLimit
    };
  }
  const deviceInfo = deviceInfoRef.current;

  /**
   * Compresse une image en fonction du device et de la connexion. Les
   * dimensions et la qualité de compression sont réduites sur mobile et
   * connexion lente pour optimiser la taille.
   *
   * @param {File} file - Le fichier image à compresser
   * @returns {Promise<File>} - Un fichier compressé ou le fichier original si la compression n'apporte rien
   */
  const compressFile = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl); // ✅ Nettoyage mémoire
        let maxWidth, maxHeight, quality;
        if (deviceInfo.isMobile) {
          maxWidth = deviceInfo.connectionType === '2g' ? 800 : 1280;
          maxHeight = deviceInfo.connectionType === '2g' ? 600 : 720;
          quality = deviceInfo.connectionType === '2g' ? 0.5 : 0.7;
        } else {
          maxWidth = 1920;
          maxHeight = 1080;
          quality = 0.8;
        }
        let { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        if (ratio < 1) {
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = deviceInfo.memoryLimit >= 4 ? 'high' : 'medium';
        ctx.drawImage(img, 0, 0, width, height);
        const outputFormat = deviceInfo.supportsWebP ? 'image/webp' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, `.${outputFormat.split('/')[1]}`), { type: outputFormat, lastModified: Date.now() });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, outputFormat, quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl); // ✅ Nettoyage mémoire en cas d'erreur
        resolve(file);
      };
      img.src = objectUrl;
    });
  }, [deviceInfo]);

  /**
   * Upload un fichier unique avec suivi de progression et politique de retry.
   * La progression est communiquée via la fonction `onProgress` qui met à
   * jour l'état de la queue et la progression globale.
   */
  const uploadSingleFile = useCallback(async (file, fileId, onProgress) => {
    const maxRetries = deviceInfo.connectionType === '2g' ? 3 : 2;
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        onProgress(fileId, 'uploading', attempt * 20);
        // eslint-disable-next-line no-loop-func
        const result = await storageService.uploadInterventionFile(file, interventionId, 'report', (percent) => {
          // Relaye la progression de l'upload au gestionnaire d'état
          onProgress(fileId, 'uploading', Math.max(percent, attempt * 20));
        });
        if (result.error) throw result.error;
        onProgress(fileId, 'completed', 100);
        return result;
      } catch (error) {
        if (attempt >= maxRetries) {
          onProgress(fileId, 'error', 0, error.message);
          throw error;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, [interventionId, deviceInfo]);

  /**
   * Gère l'upload d'une liste de fichiers. Les fichiers valides sont compressés
   * puis uploadés avec progression. La fonction retourne un tableau de
   * résultats et les fichiers invalides.
   */
  const handleFileUpload = useCallback(async (files, onComplete) => {
    if (!files || files.length === 0) return;
    // Annule tout upload en cours
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();
    setUploadState({ isUploading: true, queue: [], completed: [], errors: [], globalProgress: 0 });
    try {
      const validFiles = [];
      const invalidFiles = [];
      for (const file of Array.from(files)) {
        const maxSize = deviceInfo.connectionType === '2g' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size <= maxSize && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
          validFiles.push(file);
        } else {
          invalidFiles.push({ file, reason: file.size > maxSize ? 'Fichier trop volumineux' : 'Type non supporté' });
        }
      }

      const queueItems = validFiles.map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending',
        progress: 0,
        error: null
      }));

      setUploadState((prev) => ({ ...prev, queue: queueItems }));

      const concurrentUploads = 3; // Augmenté pour éviter les timeouts sur les longues files
      const results = [];

      const updateProgress = (fileId, status, progress, error = null) => {
        setUploadState((prev) => {
          const updatedQueue = prev.queue.map((item) => (item.id === fileId ? { ...item, status, progress, error } : item));
          const globalProgress = Math.round(updatedQueue.reduce((sum, item) => sum + item.progress, 0) / updatedQueue.length);
          return { ...prev, queue: updatedQueue, globalProgress };
        });
      };

      for (let i = 0; i < validFiles.length; i += concurrentUploads) {
        const batch = validFiles.slice(i, i + concurrentUploads);
        const batchPromises = batch.map(async (file, idx) => {
          const fileId = queueItems[i + idx].id;
          try {
            updateProgress(fileId, 'compressing', 5);
            const compressedFile = await compressFile(file);
            updateProgress(fileId, 'uploading', 20);
            const result = await uploadSingleFile(compressedFile, fileId, updateProgress);
            return { fileId, success: true, result, originalFile: file };
          } catch (error) {
            return { fileId, success: false, error: error.message, originalFile: file };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        if (i + concurrentUploads < validFiles.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      setUploadState((prev) => ({ ...prev, isUploading: false, completed: successful, errors: failed, globalProgress: 100 }));

      if (onComplete) {
        const fileInfos = successful.map((r) => ({ name: r.originalFile.name, url: r.result.publicURL, path: r.result.filePath, type: r.originalFile.type }));
        onComplete(fileInfos, invalidFiles);
      }
    } catch (error) {
      console.error('❌ Erreur upload global:', error);
      setUploadState((prev) => ({ ...prev, isUploading: false, errors: [{ error: error.message }], globalProgress: 0 }));
    }
  }, [compressFile, uploadSingleFile, deviceInfo]);

  // Utilitaire pour précharger une image depuis une URL
  const preloadImage = useCallback((url) => {
    return new Promise((resolve) => {
      if (imageCache.current.has(url)) {
        resolve(imageCache.current.get(url));
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current.set(url, img);
        setDisplayState((prev) => ({ ...prev, loadedImages: new Set([...prev.loadedImages, url]) }));
        resolve(img);
      };
      img.onerror = () => {
        setDisplayState((prev) => ({ ...prev, imageLoadErrors: new Set([...prev.imageLoadErrors, url]) }));
        resolve(null);
      };
      img.src = url;
    });
  }, []);

  // Permet de réinitialiser le hook et d'annuler les uploads en cours
  const reset = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
    setUploadState({ isUploading: false, queue: [], completed: [], errors: [], globalProgress: 0 });
    setDisplayState({ loadedImages: new Set(), imageLoadErrors: new Set(), isRefreshing: false });
    imageCache.current.clear();
  }, []);

  // Nettoyage à la désactivation du composant
  useEffect(() => {
    const cache = imageCache.current;
    const controller = abortController.current;
    return () => {
      if (controller) {
        controller.abort();
      }
      if (cache) {
        cache.clear();
      }
    };
  }, []);

  return {
    uploadState,
    handleFileUpload,
    displayState,
    preloadImage,
    deviceInfo,
    reset,
    imageCache: imageCache.current
  };
};

/**
 * Composant d'affichage d'image optimisé pour mobile. Il gère le lazy loading
 * et affiche un spinner en attendant le chargement. Utilisé par les vues de
 * détails d'intervention.
 */
export const MobileOptimizedImage = ({ src, alt, className, style, onClick, placeholder = true }) => {
  const [loadState, setLoadState] = useState('loading');
  const [imageSrc, setImageSrc] = useState(null);
  const imgRef = useRef(null);
  useEffect(() => {
    if (!src) return;
    setLoadState('loading');
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setLoadState('loaded');
    };
    img.onerror = () => {
      setLoadState('error');
    };
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && imgRef.current) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            img.src = src;
            observer.disconnect();
          }
        });
      }, { rootMargin: '50px' });
      observer.observe(imgRef.current);
      return () => observer.disconnect();
    } else {
      img.src = src;
    }
  }, [src]);
  const containerStyle = {
    ...style,
    position: 'relative',
    display: 'inline-block',
    backgroundColor: loadState === 'error' ? '#fee2e2' : '#f3f4f6',
    borderRadius: '0.25rem',
    overflow: 'hidden'
  };
  if (loadState === 'loading' && placeholder) {
    return (
      <div ref={imgRef} style={containerStyle} className={className}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s ease-in-out infinite' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }
  if (loadState === 'error') {
    return (
      <div style={containerStyle} className={className}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: '0.75rem' }}>❌</div>
      </div>
    );
  }
  return (
    <img ref={imgRef} src={imageSrc} alt={alt} className={className} style={{ ...style, display: loadState === 'loaded' ? 'block' : 'none' }} onClick={onClick} loading="lazy" />
  );
};

/**
 * Composant de queue d'upload pour afficher l'avancement de chaque fichier.
 * Affiche une barre de progression et les éventuelles erreurs. Permet
 * éventuellement de supprimer un élément de la liste une fois l'upload terminé.
 */
export const UploadQueue = ({ uploadState, onRemoveItem }) => {
  if (!uploadState.queue.length) return null;
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Upload en cours</h4>
        {uploadState.isUploading && <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{uploadState.globalProgress}%</span>}
      </div>
      {uploadState.isUploading && (
        <div style={{ width: '100%', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ width: `${uploadState.globalProgress}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.3s ease', borderRadius: '2px' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
        {uploadState.queue.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '0.375rem', border: '1px solid #dee2e6' }}>
            <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
              {item.status === 'pending' && '⏳'}
              {item.status === 'compressing' && ''}
              {item.status === 'uploading' && ''}
              {item.status === 'completed' && '✅'}
              {item.status === 'error' && '❌'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                {Math.round(item.size / 1024)}KB
                {item.status === 'uploading' && ` • ${item.progress}%`}
                {item.status === 'compressing' && ' • Compression...'}
                {item.error && ` • ${item.error}`}
              </div>
              {(item.status === 'uploading' || item.status === 'compressing') && (
                <div style={{ width: '100%', height: '2px', backgroundColor: '#e5e7eb', borderRadius: '1px', marginTop: '0.25rem', overflow: 'hidden' }}>
                  <div style={{ width: `${item.progress}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.3s ease' }} />
                </div>
              )}
            </div>
            {item.status !== 'uploading' && item.status !== 'compressing' && onRemoveItem && (
              <button onClick={() => onRemoveItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#6b7280', fontSize: '1.25rem' }}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default useMobileFileManager;