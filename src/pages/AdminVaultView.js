// src/pages/AdminVaultView.js - VERSION OPTIMISÉE POUR MOBILE
import React, { useState, useMemo, useCallback } from 'react';
import MobileFileInput from '../components/MobileFileInput';
import { DownloadIcon, TrashIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon } from '../components/SharedUI';

export default function AdminVaultView({ users = [], vaultDocuments = [], onSendDocument, onDeleteDocument }) {
  const [file, setFile] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // On ne garde que les employés qui ne sont pas administrateurs
  const employees = useMemo(() => users.filter(u => !u.is_admin), [users]);

  // On regroupe les documents par employé pour l'affichage
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

  // ✅ NOUVELLE FONCTION - Gestion optimisée de la sélection de fichier
  const handleFileSelect = useCallback((event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Pré-remplir le nom du document avec le nom du fichier (sans extension)
      const nameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
      setDocumentName(nameWithoutExt);
      setError(null);
      setSuccess(false);
    }
  }, []);

  // ✅ Gestion des erreurs d'upload
  const handleUploadError = useCallback((errors) => {
    setError(errors.join(' • '));
    console.error('Erreurs upload:', errors);
  }, []);

  // ✅ Fonction de soumission optimisée
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Validation
    if (!file || !selectedUserId || !documentName.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    try {
      // Simulation de progression pour l'UX
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
      
      // Reset du formulaire après succès
      setFile(null);
      setDocumentName('');
      setSelectedUserId('');
      setSuccess(true);
      
      // Masquer le message de succès après 3 secondes
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

  // ✅ Fonction pour formater la taille des fichiers
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
  };

  // ✅ Fonction pour obtenir la date de création formatée
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
        .vault-form-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1.5rem;
          border-radius: 0.75rem;
          color: white;
          margin-bottom: 2rem;
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
          border: 1px solid #3b82f6;
          padding: 0.75rem;
          border-radius: 0.375rem;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .upload-progress-container {
          margin-top: 1rem;
        }
        .upload-progress-bar {
          width: 100%;
          height: 8px;
          background-color: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }
        .upload-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s ease;
          border-radius: 4px;
        }
        .success-message {
          background-color: #dcfce7;
          color: #166534;
          padding: 0.75rem;
          border-radius: 0.375rem;
          margin-top: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          animation: slideIn 0.3s ease;
        }
        .error-message {
          background-color: #fee2e2;
          color: #b91c1c;
          padding: 0.75rem;
          border-radius: 0.375rem;
          margin-top: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .document-user-section {
          margin-bottom: 2rem;
          background: white;
          padding: 1.5rem;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .document-user-header {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e5e7eb;
        }
        .document-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background-color: #f8f9fa;
          border-radius: 0.375rem;
          margin-bottom: 0.5rem;
          transition: all 0.2s ease;
        }
        .document-item:hover {
          background-color: #e9ecef;
          transform: translateX(2px);
        }
        .document-info {
          flex-grow: 1;
          min-width: 0;
        }
        .document-name {
          font-weight: 500;
          word-break: break-all;
          display: block;
        }
        .document-date {
          font-size: 0.75rem;
          color: #6c757d;
          margin-top: 0.25rem;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          .vault-form-section {
            padding: 1rem;
          }
          .document-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>

      <h2 className="view-title">Coffre-fort numérique - Administration</h2>

      <div className="vault-form-section">
        <h3>📤 Envoyer un document à un employé</h3>
        <div className="vault-form-card">
          <form onSubmit={handleSubmit}>
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
              <label>Fichier à envoyer *</label>
              <MobileFileInput
                onChange={handleFileSelect}
                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                multiple={false}
                disabled={isUploading}
                maxSize={20 * 1024 * 1024} // 20MB max
                onError={handleUploadError}
              >
                {file ? `📄 ${file.name}` : '📎 Sélectionner un document'}
              </MobileFileInput>

              {file && !isUploading && (
                <div className="file-selected-info">
                  <FileTextIcon />
                  <div style={{flexGrow: 1}}>
                    <strong>{file.name}</strong>
                    <div style={{fontSize: '0.875rem', color: '#6c757d'}}>
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setFile(null);
                      setDocumentName('');
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    Changer
                  </button>
                </div>
              )}
            </div>

            {/* Barre de progression */}
            {isUploading && (
              <div className="upload-progress-container">
                <div style={{fontSize: '0.875rem', marginBottom: '0.5rem'}}>
                  Envoi en cours... {uploadProgress}%
                </div>
                <div className="upload-progress-bar">
                  <div 
                    className="upload-progress-fill" 
                    style={{width: `${uploadProgress}%`}}
                  />
                </div>
              </div>
            )}

            {/* Message de succès */}
            {success && (
              <div className="success-message">
                <CheckCircleIcon />
                Document envoyé avec succès !
              </div>
            )}

            {/* Message d'erreur */}
            {error && (
              <div className="error-message">
                <AlertTriangleIcon />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary w-full mt-4" 
              disabled={isUploading || !file || !selectedUserId || !documentName.trim()}
            >
              {isUploading ? `Envoi en cours... ${uploadProgress}%` : '📤 Envoyer le document'}
            </button>
          </form>
        </div>
      </div>

      <div className="card-white">
        <h3 style={{marginBottom: '1.5rem'}}>📁 Documents envoyés</h3>
        
        {Object.keys(documentsByUser).length > 0 ? (
          <div>
            {Object.entries(documentsByUser).map(([userId, data]) => (
              <div key={userId} className="document-user-section">
                <div className="document-user-header">
                  👤 {data.userName}
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6c757d',
                    fontWeight: 'normal'
                  }}>
                    ({data.documents.length} document{data.documents.length > 1 ? 's' : ''})
                  </span>
                </div>
                
                {data.documents.map(doc => (
                  <div key={doc.id} className="document-item">
                    <div className="document-info">
                      <span className="document-name">
                        <FileTextIcon style={{display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle'}} />
                        {doc.file_name}
                      </span>
                      {doc.created_at && (
                        <span className="document-date">
                          Envoyé le {formatDate(doc.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <a 
                        href={doc.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn-icon" 
                        title="Télécharger"
                      >
                        <DownloadIcon />
                      </a>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${doc.file_name}" ?`)) {
                            onDeleteDocument(doc.id);
                          }
                        }} 
                        className="btn-icon-danger" 
                        title="Supprimer"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6c757d',
            backgroundColor: '#f8f9fa',
            borderRadius: '0.5rem'
          }}>
            <p style={{fontSize: '1.125rem', marginBottom: '0.5rem'}}>
              Aucun document envoyé
            </p>
            <p style={{fontSize: '0.875rem'}}>
              Commencez par envoyer un document à un employé
            </p>
          </div>
        )}
      </div>
    </div>
  );
}