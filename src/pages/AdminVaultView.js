// src/pages/AdminVaultView.js - VERSION AMÉLIORÉE AVEC TRI PAR EMPLOYÉ
import React, { useState, useMemo, useCallback } from 'react';
import MobileFileInput from '../components/MobileFileInput';
import { DownloadIcon, TrashIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, ChevronDownIcon, UserIcon } from '../components/SharedUI';

// Composant Accordion pour chaque employé
const UserAccordion = ({ userName, documents, onDeleteDocument, formatDate }) => {
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
                <span className="document-date">Envoyé le {formatDate(doc.created_at)}</span>
              </div>
              <div className="document-actions">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Télécharger">
                  <DownloadIcon />
                </a>
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


export default function AdminVaultView({ users = [], vaultDocuments = [], onSendDocument, onDeleteDocument }) {
  const [file, setFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

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
    console.error('Erreurs upload:', errors);
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

      await onSendDocument({
        file,
        userId: selectedUserId,
        name: documentName.trim()
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      setFile(null);
      setDocumentName('');
      setSelectedUserId('');
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        setUploadProgress(0);
      }, 3000);

    } catch (err) {
      console.error('Erreur lors de l\'envoi:', err);
      setError(`Erreur lors de l'envoi : ${err.message || 'Erreur inconnue'}`);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div>
      <style>{`
        /* --- Styles du Formulaire --- */
        .vault-form-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1.5rem;
          border-radius: 0.75rem;
          color: white;
          margin-bottom: 2rem;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .vault-form-section h3 {
          color: white;
          margin-bottom: 1.5rem;
          font-size: 1.25rem;
        }
        .vault-form-card {
          background: white;
          padding: 1.5rem;
          border-radius: 0.5rem;
          color: #1f2937;
        }
        .file-selected-info {
          background-color: #f0f9ff;
          border-left: 4px solid #3b82f6;
          padding: 0.75rem 1rem;
          margin-top: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
        }
        .upload-progress-container { margin-top: 1rem; }
        .upload-progress-bar { width: 100%; height: 8px; background-color: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .upload-progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.3s ease; border-radius: 4px; }
        .success-message, .error-message { padding: 0.75rem; border-radius: 0.375rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        .success-message { background-color: #dcfce7; color: #166534; }
        .error-message { background-color: #fee2e2; color: #b91c1c; }

        /* --- Styles de la Liste des Documents (Nouveau) --- */
        .documents-list-section {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 0.5rem;
        }
        .user-accordion {
          background: white;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .accordion-header {
          width: 100%;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          background-color: white;
          border: none;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
        }
        .accordion-header:hover { background-color: #f9fafb; }
        .accordion-title { display: flex; align-items: center; gap: 0.75rem; font-weight: 600; font-size: 1rem; color: #1f2937; }
        .document-count { font-size: 0.875rem; color: #6c757d; font-weight: normal; background-color: #e9ecef; padding: 2px 8px; border-radius: 12px; }
        .accordion-chevron { transition: transform 0.2s ease; color: #6c757d; }
        .accordion-chevron.open { transform: rotate(180deg); }
        .accordion-content { padding: 0.5rem; }
        .document-item-compact { display: flex; align-items: center; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 0.25rem; }
        .document-item-compact:hover { background-color: #f0f3f5; }
        .document-icon { color: #495057; margin-right: 0.75rem; flex-shrink: 0; }
        .document-info { flex-grow: 1; min-width: 0; }
        .document-name { font-weight: 500; color: #343a40; word-break: break-all; font-size: 0.9rem; }
        .document-date { font-size: 0.75rem; color: #6c757d; }
        .document-actions { display: flex; align-items: center; gap: 0.25rem; }
      `}</style>

      <h2 className="view-title">Coffre-fort numérique - Administration</h2>

      {/* --- FORMULAIRE D'ENVOI --- */}
      <div className="vault-form-section">
        <h3>📤 Envoyer un document</h3>
        <div className="vault-form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="employee-select">Destinataire *</label>
              <select id="employee-select" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="form-control" required disabled={isUploading}>
                <option value="">-- Sélectionnez un employé --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="document-name">Nom du document *</label>
              <input id="document-name" type="text" value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Ex: Fiche de paie - Janvier 2025" className="form-control" required disabled={isUploading} />
            </div>

            <div className="form-group">
              <label>Fichier à envoyer *</label>
              <MobileFileInput onChange={handleFileSelect} accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" multiple={false} disabled={isUploading} maxSize={20 * 1024 * 1024} onError={handleUploadError}>
                {file ? `📄 ${file.name}` : '📎 Sélectionner un document'}
              </MobileFileInput>

              {file && !isUploading && (
                <div className="file-selected-info">
                  <FileTextIcon />
                  <div style={{flexGrow: 1}}>
                    <strong>{file.name}</strong> ({formatFileSize(file.size)})
                  </div>
                  <button type="button" onClick={() => { setFile(null); setDocumentName(''); }} className="btn btn-sm btn-secondary">Changer</button>
                </div>
              )}
            </div>

            {isUploading && (
              <div className="upload-progress-container">
                <div style={{fontSize: '0.875rem', marginBottom: '0.5rem'}}>Envoi en cours... {uploadProgress}%</div>
                <div className="upload-progress-bar"><div className="upload-progress-fill" style={{width: `${uploadProgress}%`}}/></div>
              </div>
            )}
            {success && <div className="success-message"><CheckCircleIcon />Document envoyé avec succès !</div>}
            {error && <div className="error-message"><AlertTriangleIcon />{error}</div>}

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={isUploading || !file || !selectedUserId || !documentName.trim()}>
              {isUploading ? `Envoi en cours...` : '📤 Envoyer le document'}
            </button>
          </form>
        </div>
      </div>

      {/* --- LISTE DES DOCUMENTS ENVOYÉS --- */}
      <div className="card-white">
        <h3 style={{marginBottom: '1.5rem'}}>📁 Documents envoyés</h3>

        {Object.keys(documentsByUser).length > 0 ? (
          <div className="documents-list-section">
            {Object.entries(documentsByUser)
              .sort(([_, a], [__, b]) => a.userName.localeCompare(b.userName)) // Trie les employés par ordre alphabétique
              .map(([userId, data]) => (
                <UserAccordion
                  key={userId}
                  userName={data.userName}
                  documents={data.documents}
                  onDeleteDocument={onDeleteDocument}
                  formatDate={formatDate}
                />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-state-title">Aucun document envoyé</p>
            <p className="empty-state-subtitle">Commencez par envoyer un document à un employé</p>
          </div>
        )}
      </div>
    </div>
  );
}
