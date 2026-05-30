// src/pages/MyDocumentsView.js
// Mes documents scannés - Chaque utilisateur voit ses propres documents
// Les admins peuvent voir tous les documents de tous les utilisateurs

import React, { useState, useMemo, useCallback, Suspense } from 'react';
import logger from '../utils/logger';
import {
  CameraIcon,
  SearchIcon,
  DownloadIcon,
  TrashIcon,
  EyeIcon,
  FolderIcon,
  CalendarIcon,
  UserIcon
} from '../components/SharedUI';
import { useDownload } from '../hooks/useDownload';
import { storageService } from '../lib/supabase';

// Lazy load DocumentScannerView to avoid loading onnxruntime-web (heavy) on initial load
const DocumentScannerView = React.lazy(() => import('./DocumentScannerView'));

const CATEGORIES = [
  { value: 'facture', label: '💰 Facture', color: '#10b981' },
  { value: 'contrat', label: '📝 Contrat', color: '#3b82f6' },
  { value: 'rapport', label: '📊 Rapport', color: '#8b5cf6' },
  { value: 'personnel', label: '👤 Personnel', color: '#f59e0b' },
  { value: 'administratif', label: '📋 Administratif', color: '#6366f1' },
  { value: 'autre', label: '📄 Autre', color: '#6b7280' }
];

// Modal de sauvegarde — remplace prompt()/alert() par une vraie UI
function SaveDocumentsModal({ count, onConfirm, onCancel, saving }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('autre');

  return (
    <div className="docs-modal-overlay" onClick={saving ? undefined : onCancel}>
      <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="docs-modal-title">
          Enregistrer {count} document{count > 1 ? 's' : ''}
        </h3>

        <label className="docs-modal-label">Titre</label>
        <input
          className="docs-modal-input"
          type="text"
          autoFocus
          placeholder="Document scanné"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
        />

        <label className="docs-modal-label">Catégorie</label>
        <div className="docs-modal-cats">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              type="button"
              className={`docs-modal-cat ${category === cat.value ? 'active' : ''}`}
              style={category === cat.value ? { background: cat.color, borderColor: cat.color, color: '#fff' } : undefined}
              onClick={() => setCategory(cat.value)}
              disabled={saving}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="docs-modal-actions">
          <button className="docs-modal-btn cancel" onClick={onCancel} disabled={saving}>
            Annuler
          </button>
          <button
            className="docs-modal-btn confirm"
            onClick={() => onConfirm({ title: title.trim() || 'Document scanné', category })}
            disabled={saving}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de confirmation de suppression
function DeleteConfirmModal({ doc, onConfirm, onCancel, deleting }) {
  return (
    <div className="docs-modal-overlay" onClick={deleting ? undefined : onCancel}>
      <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="docs-modal-title">Supprimer ce document ?</h3>
        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          «&nbsp;{doc.title}&nbsp;» sera supprimé définitivement.
        </p>
        <div className="docs-modal-actions">
          <button className="docs-modal-btn cancel" onClick={onCancel} disabled={deleting}>
            Annuler
          </button>
          <button
            className="docs-modal-btn"
            style={{ background: '#ef4444', color: '#fff' }}
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyDocumentsView({
  scannedDocuments = [],
  profile,
  users = [],
  onSaveDocuments,
  onDeleteDocument,
  onUpdateDocument
}) {
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [pendingDocs, setPendingDocs] = useState(null);   // docs en attente de sauvegarde (modal)
  const [savingDocs, setSavingDocs] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // doc en attente de suppression
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type }

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isAdmin = profile?.is_admin === true;

  // Filtrer les documents
  const filteredDocuments = useMemo(() => {
    let docs = scannedDocuments;
    if (!Array.isArray(docs)) {
      logger.error('scannedDocuments is not an array:', docs);
      return [];
    }

    // Filtre par utilisateur (admin seulement)
    if (isAdmin && selectedUser !== 'all') {
      docs = docs.filter(doc => doc.user_id === selectedUser);
    }

    // Filtre par catégorie
    if (selectedCategory !== 'all') {
      docs = docs.filter(doc => doc.category === selectedCategory);
    }

    // Filtre par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      docs = docs.filter(doc =>
        doc.title?.toLowerCase().includes(search) ||
        doc.description?.toLowerCase().includes(search) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    return docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [scannedDocuments, selectedCategory, selectedUser, searchTerm, isAdmin]);

  // Stats
  const stats = useMemo(() => {
    const myDocs = isAdmin ? scannedDocuments : scannedDocuments.filter(d => d.user_id === profile?.id);
    const totalSize = myDocs.reduce((sum, doc) => sum + (doc.file_size || 0), 0);

    return {
      total: myDocs.length,
      thisMonth: myDocs.filter(d => {
        const docDate = new Date(d.created_at);
        const now = new Date();
        return docDate.getMonth() === now.getMonth() && docDate.getFullYear() === now.getFullYear();
      }).length,
      totalSize: (totalSize / (1024 * 1024)).toFixed(1) // MB
    };
  }, [scannedDocuments, profile, isAdmin]);

  // Le scanner remonte les docs → on ouvre le modal de métadonnées
  const handleSaveScannedDocs = useCallback((docs) => {
    if (!docs || docs.length === 0) return;
    setShowScanner(false);
    setPendingDocs(docs);
  }, []);

  // Confirmation du modal → sauvegarde réelle vers Supabase
  const handleConfirmSave = useCallback(async ({ title, category }) => {
    if (!pendingDocs) return;
    setSavingDocs(true);
    try {
      await onSaveDocuments(pendingDocs, { title, category, user_id: profile?.id });
      setPendingDocs(null);
    } catch (error) {
      logger.error('Erreur sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setSavingDocs(false);
    }
  }, [pendingDocs, onSaveDocuments, profile]);

  // Supprimer un document — ouvre le modal de confirmation
  const handleDelete = useCallback((doc) => {
    setDeleteTarget(doc);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletingDoc(true);
    try {
      await onDeleteDocument(deleteTarget.id);
      setDeleteTarget(null);
      showToast('Document supprimé');
    } catch (error) {
      logger.error('Erreur suppression:', error);
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeletingDoc(false);
    }
  }, [deleteTarget, onDeleteDocument, showToast]);

  const { downloadFile } = useDownload();

  // Télécharger un document
  const handleDownload = useCallback(async (doc) => {
    logger.log('Download document:', { url: doc.file_url, title: doc.title });

    try {
      // Les signed URLs expirent après 1h, on doit en générer une nouvelle
      // Extraire le chemin du fichier depuis l'URL stockée
      const filePath = storageService.extractFilePath(doc.file_url, 'vault-files');

      if (filePath) {
        // Générer une nouvelle signed URL valide
        const freshUrl = await storageService.refreshSignedUrl(filePath, 'vault-files');
        logger.log('Fresh signed URL generated for:', filePath);
        await downloadFile(freshUrl, doc.title || doc.file_name || 'document');
      } else {
        // Fallback: essayer avec l'URL stockée directement
        logger.warn('Could not extract file path, using stored URL');
        await downloadFile(doc.file_url, doc.title || doc.file_name || 'document');
      }
    } catch (error) {
      logger.error('Download error:', error);
      alert('Erreur lors du téléchargement. Veuillez réessayer.');
    }
  }, [downloadFile]);

  // Voir un document (génère une nouvelle signed URL)
  const handleView = useCallback(async (doc) => {
    try {
      const filePath = storageService.extractFilePath(doc.file_url, 'vault-files');

      if (filePath) {
        const freshUrl = await storageService.refreshSignedUrl(filePath, 'vault-files');
        window.open(freshUrl, '_blank');
      } else {
        // Fallback
        window.open(doc.file_url, '_blank');
      }
    } catch (error) {
      logger.error('View error:', error);
      alert('Erreur lors de l\'ouverture du document.');
    }
  }, []);

  // Obtenir le nom de l'utilisateur
  const getUserName = useCallback((userId) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Inconnu';
  }, [users]);

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtenir la couleur de la catégorie
  const getCategoryColor = (category) => {
    return CATEGORIES.find(c => c.value === category)?.color || '#6b7280';
  };

  if (showScanner && isAdmin) {
    return (
      <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement du scanner...</p></div>}>
        <DocumentScannerView
          onSave={handleSaveScannedDocs}
          onClose={() => setShowScanner(false)}
        />
      </Suspense>
    );
  }

  return (
    <div>
      <style>{`
        .docs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .docs-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.25rem;
          border-radius: 0.75rem;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }

        .stat-card.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .stat-card.blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .docs-filters {
          background: var(--bg-primary, white);
          padding: 1rem;
          border-radius: 0.75rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          margin-bottom: 1.5rem;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
          color: var(--text-primary, #1f2937);
        }

        .search-box {
          flex: 1;
          min-width: 250px;
          position: relative;
        }

        .search-box input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          transition: border-color 0.2s;
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .filter-select {
          padding: 0.75rem 1rem;
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          background: var(--bg-primary, white);
          color: var(--text-primary, #1f2937);
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .filter-select:focus {
          outline: none;
          border-color: #667eea;
        }

        .docs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .docs-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .doc-card {
          background: var(--bg-primary, white);
          border-radius: 0.75rem;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.2s;
          cursor: pointer;
          color: var(--text-primary, #1f2937);
        }

        .doc-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
        }

        .doc-thumbnail {
          width: 100%;
          aspect-ratio: 1.414;
          object-fit: cover;
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        }

        .doc-content {
          padding: 1rem;
        }

        .doc-title {
          font-weight: 600;
          font-size: 1rem;
          margin-bottom: 0.5rem;
          color: #1f2937;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .doc-meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.75rem;
        }

        .doc-category {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: white;
          width: fit-content;
        }

        .doc-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .doc-btn {
          flex: 1;
          padding: 0.5rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
        }

        .doc-btn.view {
          background: #dbeafe;
          color: #1e40af;
        }

        .doc-btn.download {
          background: #d1fae5;
          color: #065f46;
        }

        .doc-btn.delete {
          background: #fee2e2;
          color: #991b1b;
        }

        .doc-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: var(--bg-primary, white);
          border-radius: 0.75rem;
          color: var(--text-primary, #1f2937);
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          opacity: 0.3;
        }

        .scan-button {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 1000;
        }

        .scan-button:hover {
          transform: scale(1.1);
          box-shadow: 0 12px 32px rgba(102, 126, 234, 0.5);
        }

        .scan-button:active {
          transform: scale(0.95);
        }

        .doc-thumbnail-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
        }

        /* Modal de sauvegarde */
        .docs-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 1rem;
        }

        .docs-modal {
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1f2937);
          border-radius: 1rem;
          padding: 1.5rem;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .docs-modal-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0 0 1.25rem;
        }

        .docs-modal-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 0.4rem;
        }

        .docs-modal-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          font-size: 0.9rem;
          margin-bottom: 1.25rem;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1f2937);
          box-sizing: border-box;
        }

        .docs-modal-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .docs-modal-cats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .docs-modal-cat {
          padding: 0.6rem 0.5rem;
          border: 2px solid var(--border-color, #e5e7eb);
          border-radius: 0.5rem;
          background: var(--bg-primary, #fff);
          color: var(--text-primary, #1f2937);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .docs-modal-cat:hover {
          border-color: #667eea;
        }

        .docs-modal-actions {
          display: flex;
          gap: 0.75rem;
        }

        .docs-modal-btn {
          flex: 1;
          padding: 0.8rem;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.15s;
        }

        .docs-modal-btn.cancel {
          background: var(--bg-secondary, #f3f4f6);
          color: var(--text-primary, #4b5563);
          border-color: var(--border-color, #e5e7eb);
        }

        .docs-modal-btn.confirm {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
        }

        .docs-modal-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Toast */
        .docs-toast {
          position: fixed;
          bottom: 5.5rem;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.75rem 1.5rem;
          border-radius: 2rem;
          font-weight: 600;
          font-size: 0.875rem;
          color: #fff;
          z-index: 3000;
          pointer-events: none;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
          animation: toastIn 0.2s ease;
        }

        .docs-toast.success { background: #10b981; }
        .docs-toast.error   { background: #ef4444; }

        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        @media (max-width: 768px) {
          .docs-grid {
            grid-template-columns: 1fr;
          }

          .scan-button {
            bottom: 1rem;
            right: 1rem;
          }
        }
      `}</style>

      {/* Header */}
      <div className="docs-header">
        <h2 className="view-title">📂 {isAdmin ? 'Tous les Documents' : 'Mes Documents'}</h2>
        {/* TEMPORAIREMENT DÉSACTIVÉ - Scanner de documents hors application */}
        {/*
        <button
          className="btn btn-primary"
          onClick={() => setShowScanner(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <CameraIcon /> Scanner un document
        </button>
        */}
      </div>

      {/* Stats */}
      <div className="docs-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">📄 Documents total</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{stats.thisMonth}</div>
          <div className="stat-label">📅 Ce mois-ci</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-value">{stats.totalSize} MB</div>
          <div className="stat-label">💾 Espace utilisé</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="docs-filters">
        <div className="search-box">
          <SearchIcon className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        {isAdmin && (
          <select
            className="filter-select"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="all">Tous les utilisateurs</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Documents */}
      {filteredDocuments.length === 0 ? (
        <div className="empty-state">
          <FolderIcon className="empty-icon" />
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#1f2937' }}>
            Aucun document
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            {searchTerm || selectedCategory !== 'all'
              ? 'Aucun document ne correspond à vos critères'
              : isAdmin
                ? 'Commencez par scanner un document en cliquant sur le bouton ci-dessous'
                : 'Vous n\'avez aucun document pour le moment'}
          </p>
          {isAdmin && !searchTerm && selectedCategory === 'all' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowScanner(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <CameraIcon /> Scanner maintenant
            </button>
          )}
        </div>
      ) : (
        <div className="docs-grid">
          {filteredDocuments.map(doc => (
            <div key={doc.id} className="doc-card">
              {doc.thumbnail_url ? (
                <img
                  src={doc.thumbnail_url}
                  alt={doc.title}
                  className="doc-thumbnail"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="doc-thumbnail doc-thumbnail-placeholder">
                  <FolderIcon size={32} />
                </div>
              )}

              <div className="doc-content">
                <h3 className="doc-title">{doc.title}</h3>

                <div className="doc-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CalendarIcon size={12} />
                    {formatDate(doc.created_at)}
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <UserIcon size={12} />
                      {getUserName(doc.user_id)}
                    </div>
                  )}

                  {doc.file_size && (
                    <div>{(doc.file_size / 1024).toFixed(1)} KB</div>
                  )}
                </div>

                {doc.category && (
                  <div
                    className="doc-category"
                    style={{ background: getCategoryColor(doc.category) }}
                  >
                    {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                  </div>
                )}

                {doc.tags && doc.tags.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {doc.tags.map((tag, i) => (
                      <span
                        key={i}
                        style={{
                          background: '#f3f4f6',
                          color: '#4b5563',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="doc-actions">
                  <button
                    className="doc-btn view"
                    onClick={() => handleView(doc)}
                  >
                    <EyeIcon size={14} /> Voir
                  </button>
                  <button
                    className="doc-btn download"
                    onClick={() => handleDownload(doc)}
                  >
                    <DownloadIcon size={14} /> DL
                  </button>
                  <button
                    className="doc-btn delete"
                    onClick={() => handleDelete(doc)}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scanner de documents - Admin seulement */}
      {isAdmin && (
        <button
          className="scan-button"
          onClick={() => setShowScanner(true)}
          title="Scanner un document"
        >
          <CameraIcon style={{ width: '32px', height: '32px' }} />
        </button>
      )}

      {/* Modal de sauvegarde des documents scannés */}
      {pendingDocs && (
        <SaveDocumentsModal
          count={pendingDocs.length}
          saving={savingDocs}
          onConfirm={handleConfirmSave}
          onCancel={() => { if (!savingDocs) setPendingDocs(null); }}
        />
      )}

      {/* Modal de confirmation de suppression */}
      {deleteTarget && (
        <DeleteConfirmModal
          doc={deleteTarget}
          deleting={deletingDoc}
          onConfirm={handleConfirmDelete}
          onCancel={() => { if (!deletingDoc) setDeleteTarget(null); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`docs-toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
