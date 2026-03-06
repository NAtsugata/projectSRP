// src/components/admin/PermissionsModal.jsx
// Modal pour gerer les permissions d'un employe

import React, { useState, useEffect, useMemo } from 'react';
import './PermissionsModal.css';

// Icones
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
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

// Mapping des categories avec icones et couleurs
const categoryConfig = {
  planning: { icon: '📅', label: 'Planning', color: '#3b82f6' },
  clients: { icon: '👥', label: 'Clients', color: '#8b5cf6' },
  expenses: { icon: '💰', label: 'Depenses', color: '#10b981' },
  leave: { icon: '🏖️', label: 'Conges', color: '#f59e0b' },
  vault: { icon: '🔒', label: 'Coffre-fort', color: '#ef4444' },
  invoices: { icon: '📄', label: 'Factures', color: '#6366f1' },
  contracts: { icon: '📋', label: 'Contrats', color: '#14b8a6' },
  catalog: { icon: '📦', label: 'Catalogue', color: '#f97316' },
  reports: { icon: '📊', label: 'Rapports', color: '#ec4899' },
  checklists: { icon: '✅', label: 'Checklists', color: '#06b6d4' },
  general: { icon: '⚙️', label: 'General', color: '#64748b' }
};

export default function PermissionsModal({
  isOpen,
  onClose,
  user,
  availablePermissions = [],
  userPermissions = [],
  onSave,
  isLoading = false
}) {
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Initialiser les permissions selectionnees
  useEffect(() => {
    if (userPermissions && userPermissions.length > 0) {
      const codes = userPermissions.map(p => p.permission_code || p.permission?.code);
      setSelectedPermissions(new Set(codes.filter(Boolean)));
    } else {
      setSelectedPermissions(new Set());
    }
  }, [userPermissions, isOpen]);

  // Grouper les permissions par categorie
  const permissionsByCategory = useMemo(() => {
    const grouped = {};
    availablePermissions.forEach(perm => {
      const cat = perm.category || 'general';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(perm);
    });
    return grouped;
  }, [availablePermissions]);

  // Toggle une permission
  const togglePermission = (code) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  // Selectionner toutes les permissions d'une categorie
  const toggleCategory = (category) => {
    const categoryPerms = permissionsByCategory[category] || [];
    const allSelected = categoryPerms.every(p => selectedPermissions.has(p.code));

    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      categoryPerms.forEach(p => {
        if (allSelected) {
          newSet.delete(p.code);
        } else {
          newSet.add(p.code);
        }
      });
      return newSet;
    });
  };

  // Sauvegarder
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(user.id, Array.from(selectedPermissions));
      onClose();
    } catch (error) {
      console.error('Erreur sauvegarde permissions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="permissions-modal-overlay" onClick={onClose}>
      <div className="permissions-modal" onClick={e => e.stopPropagation()}>
        <div className="permissions-modal-header">
          <div className="permissions-modal-title">
            <ShieldIcon />
            <div>
              <h3>Gestion des permissions</h3>
              <p className="permissions-user-name">{user?.full_name || 'Employe'}</p>
            </div>
          </div>
          <button className="permissions-close-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="permissions-modal-body">
          {isLoading ? (
            <div className="permissions-loading">
              <div className="loading-spinner"></div>
              <p>Chargement des permissions...</p>
            </div>
          ) : (
            <div className="permissions-categories">
              {Object.entries(permissionsByCategory).map(([category, perms]) => {
                const config = categoryConfig[category] || categoryConfig.general;
                const allSelected = perms.every(p => selectedPermissions.has(p.code));
                const someSelected = perms.some(p => selectedPermissions.has(p.code));

                return (
                  <div key={category} className="permission-category">
                    <div
                      className="category-header"
                      onClick={() => toggleCategory(category)}
                      style={{ '--category-color': config.color }}
                    >
                      <div className="category-info">
                        <span className="category-icon">{config.icon}</span>
                        <span className="category-name">{config.label}</span>
                        <span className="category-count">
                          {perms.filter(p => selectedPermissions.has(p.code)).length}/{perms.length}
                        </span>
                      </div>
                      <div className={`category-checkbox ${allSelected ? 'checked' : someSelected ? 'partial' : ''}`}>
                        {allSelected && <CheckIcon />}
                      </div>
                    </div>

                    <div className="category-permissions">
                      {perms.map(perm => (
                        <label
                          key={perm.code}
                          className={`permission-item ${selectedPermissions.has(perm.code) ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.has(perm.code)}
                            onChange={() => togglePermission(perm.code)}
                          />
                          <span className="permission-checkbox">
                            {selectedPermissions.has(perm.code) && <CheckIcon />}
                          </span>
                          <div className="permission-info">
                            <span className="permission-name">{perm.name}</span>
                            {perm.description && (
                              <span className="permission-description">{perm.description}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="permissions-modal-footer">
          <div className="permissions-summary">
            <span className="permissions-count">
              {selectedPermissions.size} permission{selectedPermissions.size !== 1 ? 's' : ''} selectionnee{selectedPermissions.size !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="permissions-actions">
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
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
