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
  const docInputRef = useRef(null); // Input pour documents
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

    console.log('🔍 createLocalPreview:', {
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
        console.log('✅ Blob URL créée:', blobUrl);
        return blobUrl;
      } catch (err) {
        console.error('❌ createObjectURL error:', err);
        return null;
      }
    }

    console.log('⏭️ Pas une image détectée');
    return null;
  }, []);

  // Traiter les uploads en attente (arrière-plan)
  const processUploads = useCallback(async () => {
    if (uploadingRef.current) return; // Déjà en cours
    uploadingRef.current = true;
    setIsProcessing(true);

    try {
      const pending = await getPendingUploads('pending');
      console.log(`📤 Traitement de ${pending.length} fichier(s) en attente...`);

      const uploaded = [];

      for (const item of pending) {
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
              progress += Math.random() * 20;
              progress = Math.min(progress, 90);
              onUploadProgress?.({
                id: item.id,
                progress: Math.round(progress),
                status: 'uploading'
              });
            }
          }, 400);

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

          uploaded.push({
            id: item.id,
            name: item.fileName,
            url: publicUrl,
            type: item.fileType
          });

          // Notifier la complétion
          onUploadProgress?.({
            id: item.id,
            progress: 100,
            status: 'completed',
            url: publicUrl
          });

          console.log(`✅ Upload réussi: ${item.fileName}`);

        } catch (err) {
          console.error(`❌ Échec upload ${item.fileName}:`, err);
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
        }
      }

      // Notifier les uploads terminés
      if (uploaded.length && onUploadComplete) {
        await onUploadComplete(uploaded);
      }

      // Mettre à jour la queue locale
      const remaining = await getPendingUploads('pending');
      setLocalQueue(remaining);

    } catch (err) {
      console.error('❌ Erreur processUploads:', err);
    } finally {
      uploadingRef.current = false;
      setIsProcessing(false);
    }
  }, [compressImage, onUploadComplete, onUploadProgress]);

  // Gestion de la sélection de fichiers - STOCKAGE LOCAL IMMÉDIAT
  const handleFileChange = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      console.log('❌ Aucun fichier sélectionné');
      return;
    }

    // Reset inputs
    if (inputRef.current) inputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
    setError(null);

    const debugInfo = `📸 ${files.length} fichier(s): ${files.map(f => f.name).join(', ')}`;
    console.log(debugInfo);

    // Traiter chaque fichier - PREVIEW D'ABORD, stockage ensuite
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Générer UN SEUL ID utilisé partout
      const fileId = `upload_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

      // TOUJOURS créer un blob URL pour les fichiers d'un input image/*
      let localUrl = null;
      try {
        localUrl = URL.createObjectURL(file);
        console.log(`✅ Blob URL: ${localUrl}`);
      } catch (err) {
        console.error(`❌ Blob URL error:`, err);
      }

      // Envoyer la preview au parent IMMÉDIATEMENT
      if (onLocalPreview) {
        const previewData = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          localUrl,
          status: 'pending',
          progress: 0
        };
        console.log('📤 Envoi preview:', previewData.id, previewData.localUrl ? 'avec URL' : 'SANS URL');
        onLocalPreview(previewData);
      } else {
        console.error('❌ onLocalPreview non défini!');
      }

      // Stocker dans IndexedDB avec le MÊME ID
      try {
        await storeFileForUpload(file, {
          interventionId,
          folder,
          originalName: file.name
        }, fileId);
        console.log(`💾 IndexedDB OK: ${fileId}`);
      } catch (err) {
        console.error(`❌ IndexedDB error:`, err);
        setError(`Erreur: ${err.message}`);
      }
    }

    // Lancer les uploads en arrière-plan
    console.log('🚀 Lancement uploads...');
    processUploads();

  }, [interventionId, folder, onLocalPreview, processUploads]);

  // Charger la queue au montage et lancer les uploads en attente
  useEffect(() => {
    const init = async () => {
      const pending = await getPendingUploads('pending');
      setLocalQueue(pending);

      // Relancer les uploads en attente
      if (pending.length > 0) {
        console.log(`📦 ${pending.length} fichier(s) en attente de reprise`);
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
      {/* Input pour images */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Sélectionner des photos"
      />

      {/* Input pour documents */}
      <input
        ref={docInputRef}
        type="file"
        multiple
        accept="application/pdf,audio/*,.pdf,.mp3,.wav,.m4a,.webm"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Sélectionner des documents"
      />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button
          variant="secondary"
          fullWidth
          onClick={handleButtonClick}
          icon={isProcessing ? <LoaderIcon className="animate-spin" /> : <UploadIcon />}
        >
          {isProcessing
            ? `Envoi (${pendingCount})...`
            : '📷 Photos'}
        </Button>

        <Button
          variant="secondary"
          fullWidth
          onClick={() => docInputRef.current?.click()}
          icon={<UploadIcon />}
          disabled={isProcessing}
        >
          📄 Documents
        </Button>
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
