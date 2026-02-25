// =============================
// FILE: src/components/quotes/QuoteAttachments.jsx
// Composant pour gérer les pièces jointes des devis (images/PDF)
// =============================
import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import logger from '../../utils/logger';
import './QuoteAttachments.css';

// Types de fichiers acceptés
const ACCEPTED_TYPES = {
  'image/jpeg': { ext: 'jpg', icon: '🖼️' },
  'image/png': { ext: 'png', icon: '🖼️' },
  'image/webp': { ext: 'webp', icon: '🖼️' },
  'application/pdf': { ext: 'pdf', icon: '📄' }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Formatage taille fichier
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

function QuoteAttachments({
  attachments = [],
  onAttachmentsChange,
  quoteId,
  organizationId,
  showToast,
  readOnly = false
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Upload fichier vers Supabase Storage
  const uploadFile = useCallback(async (file) => {
    if (!ACCEPTED_TYPES[file.type]) {
      showToast?.('Type de fichier non supporté. Utilisez JPG, PNG, WebP ou PDF.', 'error');
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast?.(`Fichier trop volumineux (max ${formatFileSize(MAX_FILE_SIZE)})`, 'error');
      return null;
    }

    const ext = ACCEPTED_TYPES[file.type].ext;
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `${organizationId}/quotes/${quoteId || 'draft'}/${fileName}`;

    try {
      setUploading(true);
      setUploadProgress(0);

      const { data, error } = await supabase.storage
        .from('quote-attachments')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Obtenir l'URL signée
      const { data: urlData } = await supabase.storage
        .from('quote-attachments')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 jours

      setUploadProgress(100);

      return {
        id: crypto.randomUUID(),
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        signed_url: urlData?.signedUrl,
        position: attachments.length,
        display_mode: 'thumbnail',
        include_in_pdf: true,
        pdf_page: 'end',
        caption: ''
      };
    } catch (error) {
      logger.error('[QuoteAttachments] Upload error:', error);
      showToast?.(`Erreur upload: ${error.message}`, 'error');
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [organizationId, quoteId, attachments.length, showToast]);

  // Gérer l'upload de plusieurs fichiers
  const handleFilesUpload = useCallback(async (files) => {
    const newAttachments = [];

    for (const file of files) {
      const attachment = await uploadFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange?.([...attachments, ...newAttachments]);
      showToast?.(`${newAttachments.length} fichier(s) ajouté(s)`, 'success');
    }
  }, [uploadFile, attachments, onAttachmentsChange, showToast]);

  // Gérer l'input file
  const handleFileInput = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFilesUpload]);

  // Drag & Drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleFilesUpload(files);
    }
  }, [handleFilesUpload]);

  // Supprimer une pièce jointe
  const handleRemove = useCallback(async (index) => {
    const attachment = attachments[index];

    // Supprimer du storage si on a le path
    if (attachment.storage_path) {
      try {
        await supabase.storage
          .from('quote-attachments')
          .remove([attachment.storage_path]);
      } catch (error) {
        logger.warn('[QuoteAttachments] Could not delete from storage:', error);
      }
    }

    const updated = attachments.filter((_, i) => i !== index);
    // Recalculer les positions
    updated.forEach((att, i) => { att.position = i; });
    onAttachmentsChange?.(updated);
  }, [attachments, onAttachmentsChange]);

  // Modifier une pièce jointe
  const handleUpdate = useCallback((index, field, value) => {
    const updated = [...attachments];
    updated[index] = { ...updated[index], [field]: value };
    onAttachmentsChange?.(updated);
  }, [attachments, onAttachmentsChange]);

  // Réordonner (monter/descendre)
  const handleMove = useCallback((index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= attachments.length) return;

    const updated = [...attachments];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    // Recalculer les positions
    updated.forEach((att, i) => { att.position = i; });
    onAttachmentsChange?.(updated);
  }, [attachments, onAttachmentsChange]);

  // Obtenir l'URL de prévisualisation
  const getPreviewUrl = useCallback(async (attachment) => {
    if (attachment.signed_url) return attachment.signed_url;

    if (attachment.storage_path) {
      const { data } = await supabase.storage
        .from('quote-attachments')
        .createSignedUrl(attachment.storage_path, 60 * 60); // 1h
      return data?.signedUrl;
    }

    return null;
  }, []);

  // Ouvrir la prévisualisation
  const openPreview = useCallback(async (attachment) => {
    const url = await getPreviewUrl(attachment);
    if (url) {
      setPreviewAttachment({ ...attachment, previewUrl: url });
    }
  }, [getPreviewUrl]);

  const isImage = (type) => type?.startsWith('image/');

  return (
    <div className="quote-attachments">
      <div className="attachments-header">
        <h4>Pièces jointes</h4>
        <span className="attachments-count">{attachments.length} fichier(s)</span>
      </div>

      {/* Zone d'upload */}
      {!readOnly && (
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />

          {uploading ? (
            <div className="upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span>Upload en cours...</span>
            </div>
          ) : (
            <>
              <span className="upload-icon">📎</span>
              <span className="upload-text">
                Glissez vos images/PDF ici ou cliquez pour sélectionner
              </span>
              <span className="upload-hint">
                JPG, PNG, WebP, PDF - Max {formatFileSize(MAX_FILE_SIZE)}
              </span>
            </>
          )}
        </div>
      )}

      {/* Liste des pièces jointes */}
      {attachments.length > 0 && (
        <div className="attachments-list">
          {attachments.map((attachment, index) => (
            <div key={attachment.id || index} className="attachment-item">
              {/* Miniature */}
              <div
                className="attachment-thumbnail"
                onClick={() => openPreview(attachment)}
              >
                {isImage(attachment.file_type) ? (
                  <img
                    src={attachment.signed_url || attachment.previewUrl}
                    alt={attachment.file_name}
                    onError={(e) => { e.target.src = ''; e.target.className = 'broken'; }}
                  />
                ) : (
                  <span className="file-icon">📄</span>
                )}
              </div>

              {/* Infos */}
              <div className="attachment-info">
                <span className="attachment-name" title={attachment.file_name}>
                  {attachment.file_name}
                </span>
                <span className="attachment-size">
                  {formatFileSize(attachment.file_size)}
                </span>

                {!readOnly && (
                  <input
                    type="text"
                    className="attachment-caption"
                    placeholder="Légende (optionnel)"
                    value={attachment.caption || ''}
                    onChange={(e) => handleUpdate(index, 'caption', e.target.value)}
                  />
                )}
              </div>

              {/* Options */}
              {!readOnly && (
                <div className="attachment-options">
                  <label className="option-checkbox">
                    <input
                      type="checkbox"
                      checked={attachment.include_in_pdf}
                      onChange={(e) => handleUpdate(index, 'include_in_pdf', e.target.checked)}
                    />
                    <span>Inclure PDF</span>
                  </label>

                  <select
                    value={attachment.display_mode}
                    onChange={(e) => handleUpdate(index, 'display_mode', e.target.value)}
                    className="display-mode-select"
                  >
                    <option value="thumbnail">Miniature</option>
                    <option value="full">Taille réelle</option>
                    <option value="hidden">Masqué</option>
                  </select>
                </div>
              )}

              {/* Actions */}
              {!readOnly && (
                <div className="attachment-actions">
                  <button
                    className="action-btn move-btn"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    title="Monter"
                  >
                    ↑
                  </button>
                  <button
                    className="action-btn move-btn"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === attachments.length - 1}
                    title="Descendre"
                  >
                    ↓
                  </button>
                  <button
                    className="action-btn remove-btn"
                    onClick={() => handleRemove(index)}
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de prévisualisation */}
      {previewAttachment && (
        <div className="preview-modal" onClick={() => setPreviewAttachment(null)}>
          <div className="preview-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="preview-close"
              onClick={() => setPreviewAttachment(null)}
            >
              ×
            </button>

            {isImage(previewAttachment.file_type) ? (
              <img
                src={previewAttachment.previewUrl}
                alt={previewAttachment.file_name}
                className="preview-image"
              />
            ) : (
              <iframe
                src={previewAttachment.previewUrl}
                title={previewAttachment.file_name}
                className="preview-pdf"
              />
            )}

            <div className="preview-info">
              <span>{previewAttachment.file_name}</span>
              {previewAttachment.caption && (
                <p className="preview-caption">{previewAttachment.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuoteAttachments;
