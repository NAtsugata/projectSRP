// src/components/intervention/VoiceRecorder.js
// Composant d'enregistrement de notes vocales

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../ui';
import { storageService } from '../../lib/supabase';
import { MicIcon, StopCircleIcon, AlertTriangleIcon } from '../SharedUI';
import logger from '../../utils/logger';
import './VoiceRecorder.css';

/**
 * Ajoute timestamp pour éviter le cache
 */
const withCacheBust = (url) => {
  if (!url || typeof url !== 'string') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
};

/**
 * Composant VoiceRecorder
 * @param {string} interventionId - ID de l'intervention
 * @param {Function} onUploaded - Callback avec array des fichiers uploadés
 * @param {Function} onBeginCritical - Callback avant upload
 * @param {Function} onEndCritical - Callback après upload
 */
const VoiceRecorder = ({
  interventionId,
  onUploaded,
  onBeginCritical,
  onEndCritical
}) => {
  const [recorder, setRecorder] = useState(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);

  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Nettoyer le stream au démontage
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer d'enregistrement
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    setError(null);

    // Vérifier support MediaRecorder
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Enregistrement audio non supporté sur ce navigateur');
      return;
    }

    try {
      logger.log('🎤 Demande accès microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Vérifier support format
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Format par défaut
        }
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        logger.log('🎤 Arrêt enregistrement, upload...');

        try {
          setUploading(true);
          onBeginCritical?.();

          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
          const extension = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
          const file = new File([blob], `note-${Date.now()}.${extension}`, {
            type: mediaRecorder.mimeType
          });

          logger.log(`📤 Upload note vocale (${(blob.size / 1024).toFixed(1)} KB)...`);

          const result = await storageService.uploadInterventionFile(
            file,
            interventionId,
            'voice',
            () => {} // Pas de progression pour audio
          );

          if (result.error) throw result.error;

          const publicUrlRaw = result.publicURL?.publicUrl || result.publicURL;
          if (typeof publicUrlRaw !== 'string') {
            throw new Error('URL de fichier invalide');
          }

          const publicUrl = withCacheBust(publicUrlRaw);

          await onUploaded([
            {
              name: file.name,
              url: publicUrl,
              type: file.type
            }
          ]);

          logger.log('✅ Note vocale uploadée');
        } catch (err) {
          logger.error('❌ Erreur upload note vocale:', err);
          setError(`Erreur d'upload: ${err.message}`);
        } finally {
          setUploading(false);
          onEndCritical?.();

          // Arrêter le stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorder.onerror = (e) => {
        logger.error('❌ Erreur MediaRecorder:', e);
        setError('Erreur d\'enregistrement');
        setRecording(false);
      };

      mediaRecorder.start();
      setRecorder(mediaRecorder);
      setRecording(true);
      setDuration(0);

      logger.log('✅ Enregistrement démarré');
    } catch (err) {
      logger.error('❌ Erreur accès microphone:', err);

      let errorMessage = 'Impossible d\'accéder au microphone';

      if (err.name === 'NotAllowedError') {
        errorMessage = 'Permission microphone refusée. Veuillez autoriser l\'accès dans les paramètres.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Aucun microphone détecté sur cet appareil.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone déjà utilisé par une autre application.';
      }

      setError(errorMessage);
    }
  }, [interventionId, onUploaded, onBeginCritical, onEndCritical]);

  const stopRecording = useCallback(() => {
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
        setRecording(false);
      } catch (err) {
        logger.error('Erreur arrêt enregistrement:', err);
      }
    }
  }, [recorder]);

  return (
    <div className="voice-recorder">
      {error && (
        <div className="voice-recorder-error" role="alert">
          <AlertTriangleIcon />
          <span>{error}</span>
        </div>
      )}

      <div className="voice-recorder-controls">
        {!recording && !uploading ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={startRecording}
            icon={<MicIcon />}
          >
            Enregistrer une note
          </Button>
        ) : recording ? (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={stopRecording}
              icon={<StopCircleIcon />}
            >
              Arrêter
            </Button>
            <div className="voice-recorder-duration" aria-live="polite">
              <span className="recording-indicator" aria-label="Enregistrement en cours" />
              {formatDuration(duration)}
            </div>
          </>
        ) : (
          <div className="voice-recorder-uploading">
            Upload en cours...
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceRecorder;
