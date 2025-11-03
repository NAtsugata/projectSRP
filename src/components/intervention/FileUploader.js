// src/components/intervention/FileUploader.js
// Composant d'upload de fichiers avec compression, queue et retry

import React, { useState, useRef, useCallback } from 'react';
import { Button, LoadingSpinner } from '../ui';
import { storageService } from '../../lib/supabase';
import { LoaderIcon, CheckCircleIcon, AlertTriangleIcon, UploadIcon } from '../SharedUI';
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
 * Composant FileUploader
 * @param {string} interventionId - ID de l'intervention
 * @param {string} folder - Dossier de destination ('report', 'briefing', 'voice')
 * @param {Function} onUploadComplete - Callback avec array des fichiers uploadés
 * @param {Function} onBeginCritical - Callback avant ouverture picker (scroll lock)
 * @param {Function} onEndCritical - Callback après fermeture picker
 * @param {string} accept - Types de fichiers acceptés
 * @param {boolean} capture - Ouvrir directement la caméra sur mobile
 * @param {number} maxFiles - Nombre max de fichiers (défaut: 10)
 */
const FileUploader = ({
  interventionId,
  folder = 'report',
  onUploadComplete,
  onBeginCritical,
  onEndCritical,
  accept = 'image/*,application/pdf,audio/webm',
  capture = true,
  maxFiles = 10
}) => {
  const [state, setState] = useState({
    uploading: false,
    queue: [],
    error: null
  });

  const inputRef = useRef(null);
  const cancelUnlockTimerRef = useRef(null);

  // Lock de sécurité: débloquer après 12s si le picker ne répond pas (iOS)
  const startCriticalWithFallback = useCallback(() => {
    onBeginCritical?.();

    // Fallback pour débloquer si annulation sans event
    if (cancelUnlockTimerRef.current) {
      clearTimeout(cancelUnlockTimerRef.current);
    }

    cancelUnlockTimerRef.current = setTimeout(() => {
      onEndCritical?.();
    }, 12000);
  }, [onBeginCritical, onEndCritical]);

  const clearCriticalFallback = useCallback(() => {
    if (cancelUnlockTimerRef.current) {
      clearTimeout(cancelUnlockTimerRef.current);
      cancelUnlockTimerRef.current = null;
    }
  }, []);

  // Compression d'image
  const compressImage = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 720;

        // Redimensionnement
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
          0.8
        );
      };

      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Gestion de la sélection de fichiers
  const handleFileChange = useCallback(
    async (e) => {
      clearCriticalFallback();

      const files = Array.from(e.target.files || []);

      // Annulation du picker
      if (!files.length) {
        onEndCritical?.();
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      // Limite de fichiers
      if (files.length > maxFiles) {
        setState((s) => ({
          ...s,
          error: `Maximum ${maxFiles} fichiers autorisés`
        }));
        onEndCritical?.();
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      // Reset input
      if (inputRef.current) inputRef.current.value = '';

      // Initialisation de la queue
      const queue = files.map((f, i) => ({
        id: `${f.name}-${Date.now()}-${i}`,
        name: f.name,
        size: f.size,
        status: 'pending',
        progress: 0,
        error: null
      }));

      setState({ uploading: true, queue, error: null });

      const uploaded = [];

      // Upload séquentiel
      for (let i = 0; i < files.length; i++) {
        try {
          // Compression si image
          const fileToUpload = await compressImage(files[i]);

          // Upload avec suivi de progression
          const result = await storageService.uploadInterventionFile(
            fileToUpload,
            interventionId,
            folder,
            (progress) => {
              setState((s) => ({
                ...s,
                queue: s.queue.map((item, idx) =>
                  idx === i
                    ? { ...item, status: 'uploading', progress }
                    : item
                )
              }));
            }
          );

          if (result.error) throw result.error;

          const publicUrlRaw = result.publicURL?.publicUrl || result.publicURL;
          if (typeof publicUrlRaw !== 'string') {
            throw new Error('URL de fichier invalide');
          }

          const publicUrl = withCacheBust(publicUrlRaw);

          uploaded.push({
            name: files[i].name,
            url: publicUrl,
            type: files[i].type
          });

          setState((s) => ({
            ...s,
            queue: s.queue.map((item, idx) =>
              idx === i ? { ...item, status: 'completed', progress: 100 } : item
            )
          }));
        } catch (err) {
          setState((s) => ({
            ...s,
            queue: s.queue.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'error',
                    error: String(err.message || err)
                  }
                : item
            )
          }));
        }
      }

      // Callback avec fichiers uploadés
      if (uploaded.length) {
        try {
          await onUploadComplete(uploaded);
        } catch (err) {
          setState((s) => ({
            ...s,
            error: 'La sauvegarde des fichiers a échoué.'
          }));
        }
      }

      setState((s) => ({ ...s, uploading: false }));
      onEndCritical?.();
    },
    [
      compressImage,
      interventionId,
      folder,
      onUploadComplete,
      onEndCritical,
      clearCriticalFallback,
      maxFiles
    ]
  );

  const handleButtonClick = () => {
    startCriticalWithFallback();
    inputRef.current?.click();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="file-uploader">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        capture={capture ? 'environment' : undefined}
        onChange={handleFileChange}
        disabled={state.uploading}
        style={{ display: 'none' }}
        aria-label="Sélectionner des fichiers"
      />

      <Button
        variant="secondary"
        fullWidth
        onClick={handleButtonClick}
        disabled={state.uploading}
        loading={state.uploading}
        icon={<UploadIcon />}
      >
        {state.uploading ? 'Envoi en cours…' : 'Choisir des fichiers'}
      </Button>

      {state.error && (
        <div className="file-uploader-error" role="alert">
          <AlertTriangleIcon />
          <span>{state.error}</span>
        </div>
      )}

      {state.queue.length > 0 && (
        <div className="upload-queue" role="status" aria-live="polite">
          {state.queue.map((item) => (
            <div
              key={item.id}
              className={`upload-queue-item upload-status-${item.status}`}
            >
              <div className="upload-queue-icon">
                {item.status === 'uploading' && (
                  <LoaderIcon className="animate-spin" aria-hidden="true" />
                )}
                {item.status === 'completed' && (
                  <CheckCircleIcon
                    style={{ color: '#16a34a' }}
                    aria-label="Uploadé avec succès"
                  />
                )}
                {item.status === 'error' && (
                  <AlertTriangleIcon
                    style={{ color: '#dc2626' }}
                    aria-label="Erreur d'upload"
                  />
                )}
              </div>

              <div className="upload-queue-content">
                <div className="upload-queue-name">{item.name}</div>
                {item.size && (
                  <div className="upload-queue-size">
                    {formatFileSize(item.size)}
                  </div>
                )}

                {item.status === 'uploading' && (
                  <div className="upload-progress-bar">
                    <div
                      className="upload-progress-fill"
                      style={{ width: `${item.progress}%` }}
                      role="progressbar"
                      aria-valuenow={item.progress}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    />
                  </div>
                )}

                {item.error && (
                  <div className="upload-queue-error">{item.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
