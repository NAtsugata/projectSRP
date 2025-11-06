// src/hooks/useIndexedDBUpload.js - Hook séparé pour uploads avec IndexedDB
// N'affecte pas les hooks existants
import { useState, useCallback, useEffect } from 'react';
import { storageService } from '../lib/supabase';
import {
  storeFileForUpload,
  getPendingUploads,
  updateUploadStatus,
  arrayBufferToFile,
  getCacheStats
} from '../utils/indexedDBCache';

/**
 * Hook pour gérer les uploads avec cache IndexedDB
 * Usage optionnel - ne casse pas les uploads existants
 */
export const useIndexedDBUpload = () => {
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
  const [loading, setLoading] = useState(false);

  // Charger les uploads en attente
  const loadPendingUploads = useCallback(async () => {
    try {
      setLoading(true);
      const uploads = await getPendingUploads('pending');
      setPendingUploads(uploads);

      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Erreur chargement uploads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Détecter online/offline
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

  // Stocker fichier pour upload ultérieur
  const storeForLaterUpload = useCallback(async (file, metadata) => {
    try {
      const uploadId = await storeFileForUpload(file, metadata);
      await loadPendingUploads();
      console.log(`✅ Fichier ${file.name} mis en cache (${uploadId})`);
      return uploadId;
    } catch (err) {
      console.error('Failed to store file for later upload:', err);
      throw err;
    }
  }, [loadPendingUploads]);

  // Uploader les fichiers en attente
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
          await updateUploadStatus(item.id, 'uploading');

          const file = arrayBufferToFile(item);
          const result = await storageService.uploadInterventionFile(
            file,
            item.metadata.interventionId,
            item.metadata.folder
          );

          if (result && !result.error) {
            await updateUploadStatus(item.id, 'completed', {
              uploadedUrl: result.url,
              completedAt: new Date().toISOString()
            });
            console.log(`✅ Upload réussi: ${item.fileName}`);
          } else {
            await updateUploadStatus(item.id, 'failed', {
              retryCount: (item.retryCount || 0) + 1,
              lastError: result?.error?.message || 'Upload failed'
            });
            console.error(`❌ Upload échoué: ${item.fileName}`);
          }
        } catch (err) {
          console.error('Failed to upload pending file:', err);
          await updateUploadStatus(item.id, 'failed', {
            retryCount: (item.retryCount || 0) + 1,
            lastError: err.message
          });
        }
      }

      await loadPendingUploads();
    } catch (error) {
      console.error('Erreur processPendingUploads:', error);
    }
  }, [isOnline, loadPendingUploads]);

  // Retry un upload échoué
  const retryFailedUpload = useCallback(async (uploadId) => {
    try {
      await updateUploadStatus(uploadId, 'pending');
      await loadPendingUploads();
    } catch (error) {
      console.error('Erreur retryFailedUpload:', error);
    }
  }, [loadPendingUploads]);

  return {
    storeForLaterUpload,
    processPendingUploads,
    retryFailedUpload,
    loadPendingUploads,
    pendingUploads,
    cacheStats,
    isOnline,
    loading
  };
};

export default useIndexedDBUpload;
