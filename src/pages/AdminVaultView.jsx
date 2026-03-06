// src/pages/AdminVaultView.jsx - Coffre-fort Administration avec Import/Export
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  DownloadIcon,
  TrashIcon,
  FileTextIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  UserIcon,
  FolderIcon,
  UploadIcon,
  CustomFileInput
} from '../components/SharedUI';
import logger from '../utils/logger';
import { storageService } from '../lib/supabase';
import { permissionService } from '../services/permissionService';
import ShareDocumentModal from '../components/admin/ShareDocumentModal';
import './AdminVaultView.css';

// Icone Share
const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

// Icône X pour fermer
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

// Composant Accordion pour chaque employe
const UserAccordion = ({ userName, documents, onDeleteDocument, onDownload, onShare, formatDate }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="user-accordion">
      <button className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="accordion-title">
          <UserIcon />
          <span>{userName}</span>
          <span className="document-count">{documents.length} document{documents.length > 1 ? 's' : ''}</span>
        </div>
        <ChevronDownIcon className={`accordion-chevron ${isOpen ? 'open' : ''}`} />
      </button>
      {isOpen && (
        <div className="accordion-content">
          {documents.map(doc => (
            <div key={doc.id} className="document-item-compact">
              <FileTextIcon className="document-icon" />
              <div className="document-info">
                <span className="document-name">{doc.file_name}</span>
                <span className="document-date">Envoye le {formatDate(doc.created_at)}</span>
              </div>
              <div className="document-actions">
                <button onClick={() => onShare(doc)} className="btn-icon-share" title="Partager avec d'autres employes">
                  <ShareIcon />
                </button>
                <button onClick={() => onDownload(doc)} className="btn-icon" title="Telecharger">
                  <DownloadIcon />
                </button>
                <button onClick={() => onDeleteDocument(doc)} className="btn-icon-danger" title="Supprimer">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Modal d'import
const ImportModal = ({ isOpen, onClose, onImport, users }) => {
  const [importData, setImportData] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Veuillez sélectionner un fichier JSON');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.documents || !Array.isArray(data.documents)) {
          setError('Format de fichier invalide. Le fichier doit contenir un tableau "documents".');
          return;
        }
        setImportData(data);
        setError(null);
      } catch (err) {
        setError('Erreur de lecture du fichier JSON');
        logger.error('Import JSON error:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleConfirmImport = () => {
    if (importData) {
      onImport(importData);
      setImportData(null);
      onClose();
    }
  };

  const handleClose = () => {
    setImportData(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay" onClick={handleClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-modal-header">
          <h3>
            <UploadIcon /> Importer des documents
          </h3>
          <button className="import-modal-close" onClick={handleClose}>
            <XIcon />
          </button>
        </div>

        <div className="import-modal-body">
          <div
            className={`import-dropzone ${dragOver ? 'dragover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <div className="import-dropzone-icon">📥</div>
            <h4>Glissez un fichier JSON ici</h4>
            <p>ou cliquez pour sélectionner un fichier</p>
          </div>

          {error && (
            <div className="vault-message error">
              <AlertTriangleIcon />
              {error}
            </div>
          )}

          {importData && (
            <div className="import-preview">
              <div className="import-preview-header">
                <h4>Aperçu de l'import</h4>
                <span className="import-preview-count">
                  {importData.documents.length} document(s)
                </span>
              </div>
              <div className="import-preview-list">
                {importData.documents.slice(0, 10).map((doc, idx) => {
                  const user = users.find(u => u.id === doc.user_id);
                  const isValid = user && doc.file_name && doc.file_url;
                  return (
                    <div key={idx} className={`import-preview-item ${isValid ? 'valid' : 'invalid'}`}>
                      {isValid ? <CheckCircleIcon /> : <AlertTriangleIcon />}
                      <span>{doc.file_name || 'Sans nom'}</span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                        → {user?.full_name || 'Utilisateur inconnu'}
                      </span>
                    </div>
                  );
                })}
                {importData.documents.length > 10 && (
                  <div className="import-preview-item">
                    ... et {importData.documents.length - 10} autres documents
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="import-modal-footer">
          <button className="import-btn-cancel" onClick={handleClose}>
            Annuler
          </button>
          <button
            className="import-btn-confirm"
            onClick={handleConfirmImport}
            disabled={!importData}
          >
            Importer {importData?.documents?.length || 0} document(s)
          </button>
        </div>
      </div>
    </div>
  );
};


export default function AdminVaultView({
  users = [],
  vaultDocuments = [],
  onSendDocument,
  onDeleteDocument,
  onBulkImport
}) {
  const [file, setFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Etat pour le partage de documents
  const [shareDocument, setShareDocument] = useState(null);
  const [currentShares, setCurrentShares] = useState([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);

  const employees = useMemo(() => users.filter(u => !u.is_admin), [users]);

  const documentsByUser = useMemo(() => {
    return vaultDocuments.reduce((acc, doc) => {
      const userId = doc.user_id;
      if (!acc[userId]) {
        const user = users.find(u => u.id === userId);
        acc[userId] = {
          userName: user ? user.full_name : 'Employé inconnu',
          documents: []
        };
      }
      acc[userId].documents.push(doc);
      return acc;
    }, {});
  }, [vaultDocuments, users]);

  // Statistiques
  const stats = useMemo(() => {
    const totalSize = vaultDocuments.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
    const employeesWithDocs = new Set(vaultDocuments.map(d => d.user_id)).size;
    return {
      totalDocuments: vaultDocuments.length,
      totalEmployees: employeesWithDocs,
      totalSize: totalSize,
      thisMonth: vaultDocuments.filter(d => {
        const date = new Date(d.created_at);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length
    };
  }, [vaultDocuments]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Télécharger un document (avec URL signée fraîche)
  const handleDownload = useCallback(async (doc) => {
    try {
      // Les signed URLs expirent après 1h, on doit en générer une nouvelle
      const filePath = storageService.extractFilePath(doc.file_url, 'vault-files');

      if (filePath) {
        const freshUrl = await storageService.refreshSignedUrl(filePath, 'vault-files');
        logger.log('Fresh signed URL generated for download:', filePath);
        // Ouvrir dans un nouvel onglet pour télécharger
        window.open(freshUrl, '_blank');
      } else {
        // Fallback: essayer avec l'URL stockée
        logger.warn('Could not extract file path, using stored URL');
        window.open(doc.file_url, '_blank');
      }
    } catch (error) {
      logger.error('Download error:', error);
      alert('Erreur lors du téléchargement. Veuillez réessayer.');
    }
  }, []);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      totalDocuments: vaultDocuments.length,
      documents: vaultDocuments.map(doc => ({
        id: doc.id,
        user_id: doc.user_id,
        user_name: users.find(u => u.id === doc.user_id)?.full_name || 'Inconnu',
        file_name: doc.file_name,
        file_url: doc.file_url,
        file_size: doc.file_size,
        description: doc.description,
        tags: doc.tags,
        is_favorite: doc.is_favorite,
        created_at: doc.created_at
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coffre-fort-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.log('Export JSON effectué:', exportData.totalDocuments, 'documents');
  }, [vaultDocuments, users]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['Employé', 'Nom du fichier', 'Taille', 'Description', 'Tags', 'Date d\'ajout'];
    const rows = vaultDocuments.map(doc => {
      const user = users.find(u => u.id === doc.user_id);
      return [
        user?.full_name || 'Inconnu',
        doc.file_name,
        formatFileSize(doc.file_size),
        doc.description || '',
        (doc.tags || []).join(', '),
        formatDate(doc.created_at)
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coffre-fort-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.log('Export CSV effectué:', vaultDocuments.length, 'documents');
  }, [vaultDocuments, users]);

  // Import handler
  const handleImport = useCallback((importData) => {
    if (onBulkImport) {
      onBulkImport(importData.documents);
    } else {
      logger.warn('onBulkImport not provided');
    }
  }, [onBulkImport]);

  const handleFileSelect = useCallback((event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const nameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
      setDocumentName(nameWithoutExt);
      setError(null);
      setSuccess(false);
    }
  }, []);

  const handleUploadError = useCallback((errors) => {
    setError(errors.join(' • '));
    logger.error('Erreurs upload:', errors);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file || !selectedUserId || !documentName.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const tags = tagsInput.trim() ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

      await onSendDocument({
        file,
        userId: selectedUserId,
        name: documentName.trim(),
        fileSize: file.size,
        description: description.trim(),
        tags
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setFile(null);
      setDocumentName('');
      setSelectedUserId('');
      setDescription('');
      setTagsInput('');
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        setUploadProgress(0);
      }, 3000);

    } catch (err) {
      logger.error('Erreur lors de l\'envoi:', err);
      setError(`Erreur lors de l'envoi : ${err.message || 'Erreur inconnue'}`);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Ouvrir le modal de partage
  const handleOpenShare = useCallback(async (doc) => {
    setShareDocument(doc);
    setIsLoadingShares(true);
    try {
      const { data, error: fetchError } = await permissionService.getDocumentShares(doc.id);
      if (!fetchError && data) {
        setCurrentShares(data);
      }
    } catch (err) {
      logger.error('Erreur chargement partages:', err);
    } finally {
      setIsLoadingShares(false);
    }
  }, []);

  // Sauvegarder les partages
  const handleSaveShares = useCallback(async (documentId, userIds) => {
    try {
      await permissionService.updateDocumentShares(documentId, userIds);
      logger.log('Partages mis a jour pour le document:', documentId);
    } catch (err) {
      logger.error('Erreur sauvegarde partages:', err);
      throw err;
    }
  }, []);

  return (
    <div className="admin-vault">
      {/* Modal de partage */}
      {shareDocument && (
        <ShareDocumentModal
          isOpen={!!shareDocument}
          onClose={() => setShareDocument(null)}
          document={shareDocument}
          employees={employees}
          currentShares={currentShares}
          onSave={handleSaveShares}
          isLoading={isLoadingShares}
        />
      )}
      {/* Header avec titre et toolbar */}
      <div className="admin-vault-header">
        <h2 className="admin-vault-title">
          <FolderIcon />
          Coffre-fort numérique
        </h2>

        <div className="vault-toolbar">
          <button
            className="toolbar-btn toolbar-btn-secondary"
            onClick={handleExportCSV}
            disabled={vaultDocuments.length === 0}
            title="Exporter en CSV"
          >
            <DownloadIcon />
            Export CSV
          </button>
          <button
            className="toolbar-btn toolbar-btn-secondary"
            onClick={handleExportJSON}
            disabled={vaultDocuments.length === 0}
            title="Exporter en JSON"
          >
            <DownloadIcon />
            Export JSON
          </button>
          <button
            className="toolbar-btn toolbar-btn-primary"
            onClick={() => setShowImportModal(true)}
            title="Importer des documents"
          >
            <UploadIcon />
            Importer
          </button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="vault-stats">
        <div className="vault-stat-card">
          <div className="vault-stat-icon blue">📄</div>
          <div className="vault-stat-content">
            <div className="vault-stat-value">{stats.totalDocuments}</div>
            <div className="vault-stat-label">Documents total</div>
          </div>
        </div>
        <div className="vault-stat-card">
          <div className="vault-stat-icon green">👥</div>
          <div className="vault-stat-content">
            <div className="vault-stat-value">{stats.totalEmployees}</div>
            <div className="vault-stat-label">Employés avec documents</div>
          </div>
        </div>
        <div className="vault-stat-card">
          <div className="vault-stat-icon purple">💾</div>
          <div className="vault-stat-content">
            <div className="vault-stat-value">{formatFileSize(stats.totalSize)}</div>
            <div className="vault-stat-label">Espace utilisé</div>
          </div>
        </div>
        <div className="vault-stat-card">
          <div className="vault-stat-icon orange">📅</div>
          <div className="vault-stat-content">
            <div className="vault-stat-value">{stats.thisMonth}</div>
            <div className="vault-stat-label">Ce mois-ci</div>
          </div>
        </div>
      </div>

      {/* Formulaire d'envoi */}
      <div className="vault-form-section">
        <div className="vault-form-header">
          <span style={{ fontSize: '1.5rem' }}>📤</span>
          <h3>Envoyer un document</h3>
        </div>

        <div className="vault-form-card">
          <form onSubmit={handleSubmit}>
            <div className="vault-form-grid">
              <div className="form-group">
                <label htmlFor="employee-select">Destinataire *</label>
                <select
                  id="employee-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="form-control"
                  required
                  disabled={isUploading}
                >
                  <option value="">-- Sélectionnez un employé --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="document-name">Nom du document *</label>
                <input
                  id="document-name"
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Ex: Fiche de paie - Janvier 2025"
                  className="form-control"
                  required
                  disabled={isUploading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="document-description">Description (optionnel)</label>
                <textarea
                  id="document-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Fiche de paie incluant les heures supplémentaires"
                  className="form-control"
                  rows="2"
                  disabled={isUploading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="document-tags">Tags (optionnel)</label>
                <input
                  id="document-tags"
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Ex: paie, janvier, 2025"
                  className="form-control"
                  disabled={isUploading}
                />
                <span className="form-hint">Séparez les tags par des virgules</span>
              </div>

              <div className="form-group full-width">
                <label>Fichier à envoyer *</label>
                <CustomFileInput
                  onChange={handleFileSelect}
                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                  multiple={false}
                  disabled={isUploading}
                  maxSize={20 * 1024 * 1024}
                  onError={handleUploadError}
                >
                  {file ? `📄 ${file.name}` : '📎 Sélectionner ou glisser un document'}
                </CustomFileInput>

                {file && !isUploading && (
                  <div className="file-selected-info">
                    <FileTextIcon />
                    <div className="file-selected-content">
                      <span className="file-selected-name">{file.name}</span>
                      <span className="file-selected-size"> ({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setFile(null); setDocumentName(''); }}
                      className="toolbar-btn toolbar-btn-secondary"
                      style={{ padding: '0.25rem 0.75rem' }}
                    >
                      Changer
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isUploading && (
              <div className="upload-progress-container">
                <div className="upload-progress-text">
                  <span>Envoi en cours...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="upload-progress-bar">
                  <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {success && (
              <div className="vault-message success">
                <CheckCircleIcon />
                Document envoyé avec succès !
              </div>
            )}

            {error && (
              <div className="vault-message error">
                <AlertTriangleIcon />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="vault-submit-btn"
              disabled={isUploading || !file || !selectedUserId || !documentName.trim()}
            >
              {isUploading ? 'Envoi en cours...' : '📤 Envoyer le document'}
            </button>
          </form>
        </div>
      </div>

      {/* Liste des documents */}
      <div className="vault-documents-section">
        <div className="vault-documents-header">
          <h3 className="vault-documents-title">
            <FolderIcon />
            Documents envoyés
          </h3>
          <span className="vault-documents-count">{vaultDocuments.length}</span>
        </div>

        <div className="vault-documents-list">
          {Object.keys(documentsByUser).length > 0 ? (
            Object.entries(documentsByUser)
              .sort(([, a], [, b]) => a.userName.localeCompare(b.userName))
              .map(([userId, data]) => (
                <UserAccordion
                  key={userId}
                  userName={data.userName}
                  documents={data.documents}
                  onDeleteDocument={onDeleteDocument}
                  onDownload={handleDownload}
                  onShare={handleOpenShare}
                  formatDate={formatDate}
                />
              ))
          ) : (
            <div className="vault-empty-state">
              <div className="vault-empty-icon">📂</div>
              <h4>Aucun document envoyé</h4>
              <p>Commencez par envoyer un document à un employé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'import */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        users={users}
      />
    </div>
  );
}
