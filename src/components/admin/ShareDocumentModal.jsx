// src/components/admin/ShareDocumentModal.jsx
// Modal pour partager un document du coffre-fort avec des employes

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ShareDocumentModal.css';

// Icones
const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export default function ShareDocumentModal({
  isOpen,
  onClose,
  document,
  employees = [],
  currentShares = [],
  onSave,
  isLoading = false
}) {
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialiser les utilisateurs deja selectionnes
  useEffect(() => {
    if (currentShares && currentShares.length > 0) {
      const userIds = currentShares.map(s => s.shared_with_user_id);
      setSelectedUsers(new Set(userIds.filter(Boolean)));
    } else {
      setSelectedUsers(new Set());
    }
    setSearchTerm('');
  }, [currentShares, isOpen]);

  // Filtrer les employes par recherche
  const filteredEmployees = useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      emp.full_name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  // Toggle un utilisateur
  const toggleUser = useCallback((userId) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Selectionner/deselectionner tous
  const toggleAll = useCallback(() => {
    if (selectedUsers.size === filteredEmployees.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredEmployees.map(e => e.id)));
    }
  }, [filteredEmployees, selectedUsers.size]);

  // Sauvegarder
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(document.id, Array.from(selectedUsers));
      onClose();
    } catch (error) {
      console.error('Erreur sauvegarde partage:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-modal-title">
            <ShareIcon />
            <div>
              <h3>Partager le document</h3>
              <p className="share-document-name">{document?.file_name || 'Document'}</p>
            </div>
          </div>
          <button className="share-close-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="share-modal-body">
          {/* Barre de recherche */}
          <div className="share-search">
            <SearchIcon className="share-search-icon" />
            <input
              type="text"
              placeholder="Rechercher un employe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="share-search-input"
            />
          </div>

          {/* Actions rapides */}
          <div className="share-quick-actions">
            <button
              className="share-select-all"
              onClick={toggleAll}
            >
              {selectedUsers.size === filteredEmployees.length && filteredEmployees.length > 0
                ? 'Tout deselectionner'
                : 'Tout selectionner'}
            </button>
            <span className="share-count">
              {selectedUsers.size} selectionne{selectedUsers.size !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Liste des employes */}
          {isLoading ? (
            <div className="share-loading">
              <div className="loading-spinner"></div>
              <p>Chargement...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="share-empty">
              <UserIcon />
              <p>Aucun employe trouve</p>
            </div>
          ) : (
            <div className="share-users-list">
              {filteredEmployees.map(emp => (
                <label
                  key={emp.id}
                  className={`share-user-item ${selectedUsers.has(emp.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(emp.id)}
                    onChange={() => toggleUser(emp.id)}
                  />
                  <span className="share-user-checkbox">
                    {selectedUsers.has(emp.id) && <CheckIcon />}
                  </span>
                  <div className="share-user-avatar">
                    {(emp.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="share-user-info">
                    <span className="share-user-name">{emp.full_name}</span>
                    <span className="share-user-email">{emp.email}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="share-modal-footer">
          <p className="share-info-text">
            Les employes selectionnes pourront voir et telecharger ce document dans leur coffre-fort.
          </p>
          <div className="share-actions">
            <button
              className="btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Annuler
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Sauvegarde...' : 'Partager'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
