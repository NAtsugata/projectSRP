// src/components/mobile/PendingUploadsPanel.js - Panneau uploads en attente (mobile)
import React, { useState, useEffect } from 'react';
import {
  UploadIcon,
  RefreshCwIcon as RefreshIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertTriangleIcon as AlertCircleIcon,
  CalendarIcon as ClockIcon,
  FileTextIcon
} from '../SharedUI';
import {
  getPendingUploads,
  getCacheStats,
  deleteUpload,
  updateUploadStatus,
  clearCompletedUploads,
  arrayBufferToFile
} from '../../utils/indexedDBCache';
import { storageService } from '../../lib/supabase';

export const PendingUploadsPanel = ({ onUploadComplete }) => {
  const [uploads, setUploads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Charger les uploads
  const loadUploads = async () => {
    try {
      setLoading(true);
      const allUploads = await getPendingUploads();
      setUploads(allUploads);

      const cacheStats = await getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      console.error('Erreur chargement uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUploads();

    // Refresh toutes les 5 secondes si uploads en cours
    const interval = setInterval(() => {
      if (uploads.some(u => u.status === 'uploading' || u.status === 'pending')) {
        loadUploads();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Uploader un fichier spécifique
  const handleUploadFile = async (uploadItem) => {
    try {
      setUploading(true);

      // Marquer comme uploading
      await updateUploadStatus(uploadItem.id, 'uploading');

      // Convertir et upload
      const file = arrayBufferToFile(uploadItem);
      const result = await storageService.uploadInterventionFile(
        file,
        uploadItem.metadata.interventionId,
        uploadItem.metadata.folder
      );

      if (result && !result.error) {
        // Succès
        await updateUploadStatus(uploadItem.id, 'completed', {
          uploadedUrl: result.url,
          completedAt: new Date().toISOString()
        });

        if (onUploadComplete) {
          onUploadComplete(result);
        }

        alert(`✅ ${uploadItem.fileName} uploadé avec succès!`);
      } else {
        // Échec
        await updateUploadStatus(uploadItem.id, 'failed', {
          lastError: result?.error?.message || 'Upload failed'
        });

        alert(`❌ Échec upload: ${result?.error?.message || 'Erreur inconnue'}`);
      }

      await loadUploads();
    } catch (error) {
      console.error('Erreur upload:', error);
      await updateUploadStatus(uploadItem.id, 'failed', {
        lastError: error.message
      });
      alert(`❌ Erreur: ${error.message}`);
      await loadUploads();
    } finally {
      setUploading(false);
    }
  };

  // Uploader tous les fichiers pending
  const handleUploadAll = async () => {
    const pendingUploads = uploads.filter(u => u.status === 'pending');

    if (pendingUploads.length === 0) {
      alert('Aucun upload en attente');
      return;
    }

    if (!window.confirm(`Uploader ${pendingUploads.length} fichier(s)?`)) {
      return;
    }

    for (const upload of pendingUploads) {
      await handleUploadFile(upload);
    }
  };

  // Supprimer un upload
  const handleDelete = async (uploadId) => {
    if (!window.confirm('Supprimer cet upload du cache?')) {
      return;
    }

    try {
      await deleteUpload(uploadId);
      await loadUploads();
      alert('✅ Upload supprimé');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur suppression');
    }
  };

  // Nettoyer complétés
  const handleClearCompleted = async () => {
    try {
      const count = await clearCompletedUploads();
      await loadUploads();
      alert(`✅ ${count} upload(s) complété(s) supprimé(s)`);
    } catch (error) {
      console.error('Erreur nettoyage:', error);
      alert('❌ Erreur nettoyage');
    }
  };

  // Retry un upload échoué
  const handleRetry = async (uploadId) => {
    try {
      await updateUploadStatus(uploadId, 'pending');
      const upload = uploads.find(u => u.id === uploadId);
      if (upload) {
        await handleUploadFile(upload);
      }
    } catch (error) {
      console.error('Erreur retry:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon style={{ color: '#10b981' }} />;
      case 'failed':
        return <AlertCircleIcon style={{ color: '#ef4444' }} />;
      case 'uploading':
        return <UploadIcon style={{ color: '#3b82f6' }} />;
      default:
        return <ClockIcon style={{ color: '#f59e0b' }} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Terminé';
      case 'failed':
        return 'Échoué';
      case 'uploading':
        return 'En cours...';
      default:
        return 'En attente';
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div className="spinner"></div>
        <span>Chargement cache...</span>
      </div>
    );
  }

  if (!stats || stats.count === 0) {
    return null; // Pas d'uploads en cache
  }

  return (
    <div style={styles.panel}>
      {/* HEADER */}
      <button
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.headerLeft}>
          <UploadIcon />
          <span style={styles.title}>
            Uploads en cache ({stats.count})
          </span>
        </div>
        <div style={styles.headerRight}>
          {stats.pending > 0 && (
            <span style={styles.badge}>{stats.pending} en attente</span>
          )}
          {stats.failed > 0 && (
            <span style={{ ...styles.badge, background: '#fee2e2', color: '#991b1b' }}>
              {stats.failed} échoués
            </span>
          )}
          <span style={styles.chevron}>{isExpanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {/* CONTENT */}
      {isExpanded && (
        <div style={styles.content}>
          {/* STATS */}
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span>Taille totale:</span>
              <strong>{stats.totalSizeMB} MB</strong>
            </div>
            <div style={styles.statItem}>
              <span>Pending:</span>
              <strong style={{ color: '#f59e0b' }}>{stats.pending}</strong>
            </div>
            <div style={styles.statItem}>
              <span>Uploading:</span>
              <strong style={{ color: '#3b82f6' }}>{stats.uploading}</strong>
            </div>
            <div style={styles.statItem}>
              <span>Échoués:</span>
              <strong style={{ color: '#ef4444' }}>{stats.failed}</strong>
            </div>
            <div style={styles.statItem}>
              <span>Terminés:</span>
              <strong style={{ color: '#10b981' }}>{stats.completed}</strong>
            </div>
          </div>

          {/* ACTIONS */}
          <div style={styles.actions}>
            <button
              onClick={handleUploadAll}
              disabled={uploading || stats.pending === 0}
              style={styles.btnPrimary}
            >
              <UploadIcon /> Uploader tout ({stats.pending})
            </button>
            <button onClick={loadUploads} style={styles.btnSecondary}>
              <RefreshIcon /> Actualiser
            </button>
            {stats.completed > 0 && (
              <button onClick={handleClearCompleted} style={styles.btnSecondary}>
                <TrashIcon /> Nettoyer terminés
              </button>
            )}
          </div>

          {/* LISTE */}
          <div style={styles.list}>
            {uploads.map((upload) => (
              <div key={upload.id} style={styles.uploadItem}>
                <div style={styles.uploadIcon}>
                  {getStatusIcon(upload.status)}
                </div>
                <div style={styles.uploadInfo}>
                  <div style={styles.uploadName}>
                    <FileTextIcon style={{ width: 16, height: 16 }} />
                    {upload.fileName}
                  </div>
                  <div style={styles.uploadMeta}>
                    <span>{formatSize(upload.fileSize)}</span>
                    <span>•</span>
                    <span style={{
                      color:
                        upload.status === 'completed' ? '#10b981' :
                        upload.status === 'failed' ? '#ef4444' :
                        upload.status === 'uploading' ? '#3b82f6' :
                        '#f59e0b'
                    }}>
                      {getStatusText(upload.status)}
                    </span>
                    {upload.lastError && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                          {upload.lastError}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={styles.uploadActions}>
                  {upload.status === 'pending' && (
                    <button
                      onClick={() => handleUploadFile(upload)}
                      disabled={uploading}
                      style={styles.btnAction}
                      title="Uploader"
                    >
                      <UploadIcon />
                    </button>
                  )}
                  {upload.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(upload.id)}
                      disabled={uploading}
                      style={styles.btnAction}
                      title="Réessayer"
                    >
                      <RefreshIcon />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(upload.id)}
                    style={{ ...styles.btnAction, color: '#ef4444' }}
                    title="Supprimer"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  panel: {
    position: 'fixed',
    bottom: 80,
    left: 0,
    right: 0,
    background: 'white',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
    zIndex: 999,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    cursor: 'pointer'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  title: {
    fontWeight: '600',
    fontSize: '1rem'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  badge: {
    background: '#fef3c7',
    color: '#92400e',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600'
  },
  chevron: {
    fontSize: '0.75rem'
  },
  content: {
    padding: '16px',
    overflowY: 'auto',
    flex: 1
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.875rem'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  btnPrimary: {
    flex: 1,
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: 'pointer',
    minWidth: '120px'
  },
  btnSecondary: {
    padding: '10px 16px',
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  uploadItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  uploadIcon: {
    flexShrink: 0
  },
  uploadInfo: {
    flex: 1,
    minWidth: 0
  },
  uploadName: {
    fontWeight: '500',
    fontSize: '0.9rem',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  uploadMeta: {
    fontSize: '0.75rem',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap'
  },
  uploadActions: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0
  },
  btnAction: {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loading: {
    padding: '16px',
    textAlign: 'center',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  }
};

export default PendingUploadsPanel;
