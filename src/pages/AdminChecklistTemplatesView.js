// src/pages/AdminChecklistTemplatesView.js - GESTION DES TEMPLATES DE CHECKLIST
import React, { useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  CameraIcon,
  SaveIcon
} from '../components/SharedUI';

export default function AdminChecklistTemplatesView({ templates = [], onCreateTemplate, onUpdateTemplate, onDeleteTemplate }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'installation',
    items: []
  });
  const [newItem, setNewItem] = useState({
    text: '',
    required: false,
    photoRequired: false,
    category: ''
  });

  // Catégories d'interventions plomberie
  const categories = [
    { value: 'installation', label: '🔧 Installation' },
    { value: 'reparation', label: '🛠️ Réparation' },
    { value: 'entretien', label: '🔍 Entretien' },
    { value: 'depannage', label: '🚨 Dépannage' },
    { value: 'diagnostic', label: '📋 Diagnostic' },
    { value: 'mise_service', label: '✅ Mise en service' }
  ];

  // Réinitialiser formulaire
  const resetForm = () => {
    setFormData({ name: '', description: '', category: 'installation', items: [] });
    setNewItem({ text: '', required: false, photoRequired: false, category: '' });
    setIsCreating(false);
    setEditingId(null);
  };

  // Éditer un template
  const startEdit = (template) => {
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      items: [...template.items]
    });
    setEditingId(template.id);
    setIsCreating(true);
  };

  // Ajouter un item à la liste
  const addItem = () => {
    if (!newItem.text.trim()) {
      alert('Le texte de l\'item est obligatoire');
      return;
    }

    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: newItem.text.trim(),
      required: newItem.required,
      photoRequired: newItem.photoRequired,
      category: newItem.category.trim()
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    setNewItem({ text: '', required: false, photoRequired: false, category: '' });
  };

  // Supprimer un item
  const removeItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    }));
  };

  // Déplacer un item
  const moveItem = (index, direction) => {
    const newItems = [...formData.items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newItems.length) return;

    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];

    setFormData(prev => ({ ...prev, items: newItems }));
  };

  // Sauvegarder template
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Le nom du template est obligatoire');
      return;
    }

    if (formData.items.length === 0) {
      alert('Ajoutez au moins un item à la checklist');
      return;
    }

    try {
      if (editingId) {
        await onUpdateTemplate({ id: editingId, ...formData });
      } else {
        await onCreateTemplate(formData);
      }
      resetForm();
    } catch (error) {
      console.error('Erreur sauvegarde template:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  // Supprimer template
  const handleDelete = async (templateId) => {
    if (!window.confirm('Supprimer ce template ? Les checklists existantes ne seront pas affectées.')) {
      return;
    }

    try {
      await onDeleteTemplate(templateId);
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  return (
    <div>
      <style>{`
        .template-card {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 1.5rem;
          margin-bottom: 1rem;
          transition: all 0.2s;
        }
        .template-card:hover {
          border-color: var(--copper-main, #CD7F32);
          box-shadow: 0 4px 12px rgba(205, 127, 50, 0.2);
        }
        .template-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .template-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1f2937;
          margin: 0;
        }
        .template-meta {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
          flex-wrap: wrap;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .badge-category {
          background: #dbeafe;
          color: #1e40af;
        }
        .badge-items {
          background: #f3f4f6;
          color: #374151;
        }
        .item-list {
          margin-top: 1rem;
          border-top: 1px solid #e5e7eb;
          padding-top: 1rem;
        }
        .item-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: #f9fafb;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .item-text {
          flex: 1;
          font-size: 0.875rem;
          color: #1f2937;
        }
        .item-badges {
          display: flex;
          gap: 0.25rem;
        }
        .form-builder {
          background: linear-gradient(145deg, #FFFAF0 0%, #FFF8DC 100%);
          border: 2px solid var(--copper-main, #CD7F32);
          border-radius: 0.75rem;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .add-item-section {
          background: white;
          border: 2px dashed #cbd5e1;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-top: 1rem;
        }
      `}</style>

      <h2 className="view-title">📋 Templates de Checklist</h2>

      {/* Bouton créer */}
      {!isCreating && (
        <button
          className="btn btn-primary w-full"
          onClick={() => setIsCreating(true)}
          style={{ marginBottom: '1.5rem' }}
        >
          <PlusIcon /> Nouveau Template
        </button>
      )}

      {/* Formulaire création/édition */}
      {isCreating && (
        <div className="form-builder">
          <h3 style={{ marginBottom: '1rem', color: 'var(--copper-dark, #A0522D)' }}>
            {editingId ? '✏️ Modifier le Template' : '➕ Nouveau Template'}
          </h3>

          <div className="form-group">
            <label htmlFor="template-name">Nom du template *</label>
            <input
              id="template-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Installation chauffe-eau"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="template-category">Catégorie *</label>
            <select
              id="template-category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="form-control"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="template-description">Description (optionnel)</label>
            <textarea
              id="template-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du template..."
              className="form-control"
              rows="2"
            />
          </div>

          {/* Liste des items */}
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Items de la checklist ({formData.items.length})</h4>

            {formData.items.length > 0 && (
              <div className="item-list">
                {formData.items.map((item, index) => (
                  <div key={item.id} className="item-row">
                    <span style={{ fontWeight: 700, color: '#6b7280', minWidth: '24px' }}>
                      {index + 1}.
                    </span>
                    <div className="item-text">{item.text}</div>
                    <div className="item-badges">
                      {item.required && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem' }}>
                          ⚠️ Obligatoire
                        </span>
                      )}
                      {item.photoRequired && (
                        <span className="badge" style={{ background: '#dbeafe', color: '#2563eb', fontSize: '0.7rem' }}>
                          📷 Photo
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === formData.items.length - 1}
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="btn btn-sm btn-danger"
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ajouter un item */}
            <div className="add-item-section">
              <h5 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
                ➕ Ajouter un item
              </h5>

              <div className="form-group">
                <input
                  type="text"
                  value={newItem.text}
                  onChange={(e) => setNewItem(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Ex: Vérifier l'étanchéité des raccords"
                  className="form-control"
                  onKeyPress={(e) => e.key === 'Enter' && addItem()}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={newItem.required}
                    onChange={(e) => setNewItem(prev => ({ ...prev, required: e.target.checked }))}
                  />
                  <span>⚠️ Item obligatoire</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={newItem.photoRequired}
                    onChange={(e) => setNewItem(prev => ({ ...prev, photoRequired: e.target.checked }))}
                  />
                  <span>📷 Photo obligatoire</span>
                </label>
              </div>

              <div className="form-group">
                <input
                  type="text"
                  value={newItem.category}
                  onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Catégorie (optionnel, ex: Sécurité)"
                  className="form-control"
                  style={{ fontSize: '0.875rem' }}
                />
              </div>

              <button
                onClick={addItem}
                className="btn btn-secondary btn-sm w-full"
              >
                <PlusIcon /> Ajouter cet item
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              onClick={handleSave}
              className="btn btn-success"
              style={{ flex: 1 }}
              disabled={!formData.name.trim() || formData.items.length === 0}
            >
              <SaveIcon /> {editingId ? 'Mettre à jour' : 'Créer le template'}
            </button>
            <button
              onClick={resetForm}
              className="btn btn-secondary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des templates */}
      <div className="card-white">
        <h3 style={{ marginBottom: '1rem' }}>📚 Bibliothèque de Templates</h3>

        {templates.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">Aucun template</p>
            <p className="empty-state-subtitle">Créez votre premier template de checklist</p>
          </div>
        ) : (
          <div>
            {templates.map(template => {
              const category = categories.find(c => c.value === template.category);

              return (
                <div key={template.id} className="template-card">
                  <div className="template-header">
                    <div style={{ flex: 1 }}>
                      <h4 className="template-title">{template.name}</h4>
                      {template.description && (
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          {template.description}
                        </p>
                      )}
                      <div className="template-meta">
                        <span className="badge badge-category">
                          {category?.label || template.category}
                        </span>
                        <span className="badge badge-items">
                          📋 {template.items.length} items
                        </span>
                        {template.items.filter(i => i.required).length > 0 && (
                          <span className="badge" style={{ background: '#fee2e2', color: '#dc2626' }}>
                            ⚠️ {template.items.filter(i => i.required).length} obligatoires
                          </span>
                        )}
                        {template.items.filter(i => i.photoRequired).length > 0 && (
                          <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }}>
                            📷 {template.items.filter(i => i.photoRequired).length} photos
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => startEdit(template)}
                        className="btn btn-sm btn-secondary"
                      >
                        <EditIcon width={16} height={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="btn btn-sm btn-danger"
                      >
                        <TrashIcon width={16} height={16} />
                      </button>
                    </div>
                  </div>

                  {/* Aperçu des items */}
                  <details style={{ marginTop: '1rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#6b7280' }}>
                      Voir les {template.items.length} items →
                    </summary>
                    <div style={{ marginTop: '0.75rem' }}>
                      {template.items.map((item, index) => (
                        <div key={item.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
                          <span style={{ color: '#6b7280', marginRight: '0.5rem' }}>{index + 1}.</span>
                          {item.text}
                          {item.required && <span style={{ marginLeft: '0.5rem', color: '#dc2626' }}>⚠️</span>}
                          {item.photoRequired && <span style={{ marginLeft: '0.25rem', color: '#2563eb' }}>📷</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
