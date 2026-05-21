// src/components/intervention/FileUploader.js
// Composant d'upload avec cache IndexedDB local - permet photos illimitées
// Les fichiers sont stockés localement puis uploadés en arrière-plan

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../ui';
import { storageService } from '../../lib/supabase';
import { LoaderIcon, CheckCircleIcon, AlertTriangleIcon, UploadIcon } from '../SharedUI';
import {
  storeFileForUpload,
  getPendingUploads,
  updateUploadStatus,
  arrayBufferToFile,
  deleteUpload
} from '../../utils/indexedDBCache.jsx';
import logger from '../../utils/logger';
import { extractPhotoMetadata, getBrowserGeolocation } from '../../services/photoMetadataService';
import './FileUploader.css';

/**
 * Ajoute timestamp pour éviter le cache
 */
const withCacheBust = (url) => {
  if (!url || typeof url !== 'string') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
};

/**
 * Composant FileUploader avec cache IndexedDB
 * - Stockage local immédiat (pas de limite)
 * - Upload en arrière-plan
 * - Bouton toujours disponible
 */
const FileUploader = ({
  interventionId,
  folder = 'report',
  onUploadComplete,
  onLocalPreview,
  onUploadProgress,
  onBeginCritical,
  onEndCritical,
  accept = 'image/*,application/pdf,audio/webm',
  capture = true,
  maxFiles = 50 // Limite augmentée car stockage local
}) => {
  const [localQueue, setLocalQueue] = useState([]); // Files en cache local
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const pdfInputRef = useRef(null); // Input pour PDF
  const audioInputRef = useRef(null); // Input pour audio
  const uploadingRef = useRef(false); // Pour éviter les uploads en double

  // Compression d'image
  const compressImage = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }, []);

  // Créer blob URL pour preview - TOUJOURS essayer pour les fichiers acceptés
  const createLocalPreview = useCallback((file) => {
    // Sur mobile iOS, file.type peut être vide et le nom peut être "IMG_1234" sans extension
    // Donc on crée TOUJOURS une preview si le fichier vient de l'input image/*
    const hasImageType = file.type?.startsWith('image/');
    const hasImageExt = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|tiff?)$/i.test(file.name);
    const looksLikeImage = /^(IMG|image|photo|screenshot|capture)/i.test(file.name);

    logger.log('🔍 createLocalPreview:', {
      name: file.name,
      type: file.type || '(vide)',
      size: file.size,
      hasImageType,
      hasImageExt,
      looksLikeImage
    });

    // Créer la preview si c'est potentiellement une image
    if (hasImageType || hasImageExt || looksLikeImage || !file.type) {
      try {
        const blobUrl = URL.createObjectURL(file);
        logger.log('✅ Blob URL créée:', blobUrl);
        return blobUrl;
      } catch (err) {
        logger.error('❌ createObjectURL error:', err);
        return null;
      }
    }

    logger.log('⏭️ Pas une image détectée');
    return null;
  }, []);

  // Traiter les uploads en attente (arrière-plan) - PARALLEL
  const processUploads = useCallback(async () => {
    if (uploadingRef.current) return; // Déjà en cours
    uploadingRef.current = true;
    setIsProcessing(true);

    try {
      const pending = await getPendingUploads('pending');
      logger.log(`📤 Traitement de ${pending.length} fichier(s) en parallèle...`);

      // Fonction pour uploader un seul fichier
      const uploadSingleFile = async (item) => {
        try {
          await updateUploadStatus(item.id, 'uploading');

          // Notifier le début d'upload
          onUploadProgress?.({
            id: item.id,
            progress: 10,
            status: 'uploading'
          });

          // Reconstruire le fichier depuis IndexedDB
          const file = arrayBufferToFile(item);

          // Compresser si c'est une image
          const fileToUpload = await compressImage(file);

          // Simuler progression
          let progress = 20;
          const progressInterval = setInterval(() => {
            if (progress < 90) {
              progress += Math.random() * 15;
              progress = Math.min(progress, 90);
              onUploadProgress?.({
                id: item.id,
                progress: Math.round(progress),
                status: 'uploading'
              });
            }
          }, 300);

          // Upload vers Supabase
          const result = await storageService.uploadInterventionFile(
            fileToUpload,
            item.metadata.interventionId,
            item.metadata.folder
          );

          clearInterval(progressInterval);

          if (result.error) throw result.error;

          const publicUrl = withCacheBust(result.publicURL?.publicUrl || result.publicURL);

          // Marquer comme complété
          await updateUploadStatus(item.id, 'completed', { uploadedUrl: publicUrl });

          // Supprimer du cache IndexedDB
          await deleteUpload(item.id);

          // Notifier la complétion
          onUploadProgress?.({
            id: item.id,
            progress: 100,
            status: 'completed',
            url: publicUrl
          });

          logger.log(`✅ Upload réussi: ${item.fileName}`);

          return {
            success: true,
            id: item.id,
            name: item.fileName,
            url: publicUrl,
            type: item.fileType,
            metadata: item.metadata?.photoMetadata || null
          };

        } catch (err) {
          logger.error(`❌ Échec upload ${item.fileName}:`, err);
          await updateUploadStatus(item.id, 'failed', {
            lastError: err.message,
            retryCount: (item.retryCount || 0) + 1
          });
          onUploadProgress?.({
            id: item.id,
            progress: 0,
            status: 'error',
            error: err.message
          });
          return { success: false, id: item.id, error: err.message };
        }
      };

      // Upload TOUS les fichiers en parallèle (pas de limite)
      const results = await Promise.all(pending.map(uploadSingleFile));

      // Filtrer les succès
      const uploaded = results
        .filter(r => r.success)
        .map(r => ({ id: r.id, name: r.name, url: r.url, type: r.type, metadata: r.metadata }));

      // Notifier les uploads terminés
      if (uploaded.length && onUploadComplete) {
        await onUploadComplete(uploaded);
      }

      // Mettre à jour la queue locale
      const remaining = await getPendingUploads('pending');
      setLocalQueue(remaining);

    } catch (err) {
      logger.error('❌ Erreur processUploads:', err);
    } finally {
      uploadingRef.current = false;
      setIsProcessing(false);
    }
  }, [compressImage, onUploadComplete, onUploadProgress]);

  // Gestion de la sélection de fichiers - STOCKAGE LOCAL IMMÉDIAT
  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      logger.log('❌ Aucun fichier sélectionné');
      return;
    }

    // Reset inputs
    if (inputRef.current) inputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
    if (audioInputRef.current) audioInputRef.current.value = '';
    setError(null);

    const debugInfo = `📸 ${files.length} fichier(s): ${files.map(f => f.name).join(', ')}`;
    logger.log(debugInfo);

    // Récupérer la position GPS du navigateur une seule fois pour cette série
    // (utilisée en fallback si les photos n'ont pas d'EXIF GPS)
    const hasImage = files.some(f => f.type?.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    const uploadGeo = hasImage ? await getBrowserGeolocation(3000) : null;

    // Traiter chaque fichier - PREVIEW D'ABORD, stockage ensuite
    for (let i = 0; i < files.length; i++) {
      const originalFile = files[i];

      // Générer UN SEUL ID utilisé partout
      const fileId = `upload_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

      // Déterminer le type correct AVANT tout (mobile iOS peut avoir type vide)
      let fileType = originalFile.type;
      const ext = originalFile.name.split('.').pop()?.toLowerCase();

      if (!fileType || fileType === 'application/octet-stream') {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
          fileType = 'image/jpeg';
        } else if (ext === 'pdf') {
          fileType = 'application/pdf';
        } else if (ext === 'mp3') {
          fileType = 'audio/mpeg';
        } else if (ext === 'wav') {
          fileType = 'audio/wav';
        } else if (ext === 'm4a') {
          fileType = 'audio/mp4';
        } else if (ext === 'webm') {
          fileType = 'audio/webm';
        } else if (ext === 'ogg') {
          fileType = 'audio/ogg';
        } else {
          fileType = 'application/octet-stream';
        }
        logger.log(`🔧 Type corrigé: ${originalFile.type || '(vide)'} → ${fileType}`);
      }

      // Créer un nouveau File avec le bon type (fallback pour mobile)
      let file = originalFile;
      try {
        if (originalFile.type !== fileType) {
          file = new File([originalFile], originalFile.name, {
            type: fileType,
            lastModified: originalFile.lastModified || Date.now()
          });
        }
      } catch (err) {
        // Fallback si new File() échoue sur mobile
        logger.warn('⚠️ new File() non supporté, utilisation du fichier original');
        file = originalFile;
      }

      logger.log(`📁 Fichier ${i + 1}/${files.length}: ${file.name}, type: ${fileType}, size: ${file.size}`);

      // Créer blob URL pour preview locale
      let localUrl = null;
      try {
        localUrl = URL.createObjectURL(file);
        logger.log(`✅ Blob URL: ${localUrl}`);
      } catch (err) {
        logger.error(`❌ Blob URL error:`, err);
      }

      // Extraire métadonnées EXIF (date, GPS) pour les images uniquement
      let photoMetadata = null;
      if (fileType.startsWith('image/')) {
        try {
          photoMetadata = await extractPhotoMetadata(file, { uploadGeo });
          logger.log(`📍 EXIF ${file.name}:`, photoMetadata);
        } catch (err) {
          logger.warn('Métadonnées EXIF KO:', err?.message);
        }
      }

      // Envoyer la preview au parent IMMÉDIATEMENT (avant IndexedDB)
      if (onLocalPreview) {
        const previewData = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: fileType,
          localUrl,
          status: 'pending',
          progress: 0,
          metadata: photoMetadata
        };
        logger.log('📤 Envoi preview:', previewData.id, 'type:', previewData.type);
        onLocalPreview(previewData);
      } else {
        logger.error('❌ onLocalPreview non défini!');
      }

      // Stocker dans IndexedDB avec le MÊME ID et le type corrigé
      try {
        await storeFileForUpload(file, {
          interventionId,
          folder,
          originalName: file.name,
          correctedType: fileType, // Passer le type corrigé en metadata
          photoMetadata // EXIF: takenAt, latitude, longitude, source
        }, fileId);
        logger.log(`💾 IndexedDB OK: ${fileId}, type: ${fileType}`);
      } catch (err) {
        logger.error(`❌ IndexedDB error:`, err);
        setError(`Erreur stockage: ${err.message}`);
      }
    }

    // Lancer les uploads en arrière-plan
    logger.log('🚀 Lancement uploads...');
    processUploads();

  }, [interventionId, folder, onLocalPreview, processUploads]);

  // Charger la queue au montage et lancer les uploads en attente
  useEffect(() => {
    const init = async () => {
      const pending = await getPendingUploads('pending');
      setLocalQueue(pending);

      // Relancer les uploads en attente
      if (pending.length > 0) {
        logger.log(`📦 ${pending.length} fichier(s) en attente de reprise`);
        processUploads();
      }
    };
    init();
  }, [processUploads]);

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const pendingCount = localQueue.length;

  return (
    <div className="file-uploader">
      {/* Input pour images - caché, déclenché par click() */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Sélectionner des photos"
      />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Bouton Photos - fonctionne avec click() sur iOS */}
        <Button
          variant="secondary"
          fullWidth
          onClick={handleButtonClick}
          icon={isProcessing ? <LoaderIcon className="animate-spin" /> : <UploadIcon />}
          style={{ flex: '1 1 45%', minWidth: '120px' }}
        >
          {isProcessing
            ? `Envoi (${pendingCount})...`
            : '📷 Photos'}
        </Button>

        {/* Bouton PDF - input visible transparent pour iOS */}
        <div style={{ flex: '1 1 45%', minWidth: '120px', position: 'relative' }}>
          <Button
            variant="secondary"
            fullWidth
            icon={<UploadIcon />}
            style={{ width: '100%', pointerEvents: 'none' }}
          >
            📄 PDF
          </Button>
          <input
            ref={pdfInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer'
            }}
            aria-label="Sélectionner des PDF"
          />
        </div>

        {/* Bouton Audio - input visible transparent pour iOS */}
        <div style={{ flex: '1 1 45%', minWidth: '120px', position: 'relative' }}>
          <Button
            variant="secondary"
            fullWidth
            icon={<UploadIcon />}
            style={{ width: '100%', pointerEvents: 'none' }}
          >
            🎵 Audio
          </Button>
          <input
            ref={audioInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
            onChange={handleFileChange}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer'
            }}
            aria-label="Sélectionner des fichiers audio"
          />
        </div>
      </div>

      {pendingCount > 0 && !isProcessing && (
        <div className="file-uploader-pending">
          <span>📦 {pendingCount} fichier(s) en attente</span>
          <button
            onClick={processUploads}
            className="btn-retry"
          >
            Relancer
          </button>
        </div>
      )}

      {error && (
        <div className="file-uploader-error" role="alert">
          <AlertTriangleIcon />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
