// =============================
// FILE: src/pages/AdminCatalogView.jsx
// Admin view for managing catalog items, categories, tax rates, and quote templates
// =============================
import React, { useState, useCallback, useMemo } from 'react';
import { LoadingSpinner } from '../components/ui';
import { ConfirmationModal } from '../components/SharedUI';
import './AdminCatalogView.css';

// Types d'articles
const ITEM_TYPES = [
  { value: 'product', label: 'Fourniture' },
  { value: 'service', label: "Main d'oeuvre" }
];

// Unites
const UNITS = [
  { value: 'unite', label: 'Unite' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'm2', label: 'm2' },
  { value: 'ml', label: 'ml' },
  { value: 'kg', label: 'kg' },
  { value: 'lot', label: 'Lot' }
];

// Formulaire initial article
const INITIAL_ITEM_FORM = {
  item_type: 'product',
  category: '',
  reference: '',
  name: '',
  description: '',
  unit_price: '',
  unit: 'unite',
  tax_rate: 20,
  track_stock: false,
  stock_quantity: 0,
  min_stock_alert: 0,
  is_favorite: false
};

// Formulaire initial categorie
const INITIAL_CATEGORY_FORM = {
  name: '',
  description: '',
  color: '#6366f1',
  icon: '',
  item_type: 'both'
};

// Formulaire initial taux TVA
const INITIAL_TAX_FORM = {
  name: '',
  rate: '',
  description: '',
  is_default: false
};

// Formulaire initial template devis
const INITIAL_TEMPLATE_FORM = {
  name: '',
  header_text: '',
  footer_text: '',
  terms_text: 'Devis gratuit et sans engagement. Validite 30 jours.',
  validity_days: 30,
  show_logo: true,
  show_reference: true,
  show_item_description: true,
  show_discount_column: false,
  primary_color: '#3B82F6',
  is_default: false
};

// Formatage montant
const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount || 0);
};

function AdminCatalogView({
  items = [],
  categories = [],
  taxRates = [],
  templates = [],
  stats = null,
  activeTab = 'items',
  isLoading,
  isCreating,
  isUpdating,
  isOnline,
  error,
  onTabChange,
  // Items
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onToggleFavorite,
  onImportCSV,
  onExportCSV,
  // Categories
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  // Tax rates
  onCreateTaxRate,
  onUpdateTaxRate,
  onDeleteTaxRate,
  onSetDefaultTaxRate,
  onInitializeTaxRates,
  // Templates
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onSetDefaultTemplate,
  onDuplicateTemplate,
  // General
  onRefresh,
  showToast
}) {
  // States
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingTax, setEditingTax] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [itemForm, setItemForm] = useState(INITIAL_ITEM_FORM);
  const [categoryForm, setCategoryForm] = useState(INITIAL_CATEGORY_FORM);
  const [taxForm, setTaxForm] = useState(INITIAL_TAX_FORM);
  const [templateForm, setTemplateForm] = useState(INITIAL_TEMPLATE_FORM);
  const [localSearch, setLocalSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrage articles
  const filteredItems = useMemo(() => {
    let result = items;

    if (localSearch) {
      const term = localSearch.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(term) ||
        (i.reference && i.reference.toLowerCase().includes(term)) ||
        (i.description && i.description.toLowerCase().includes(term))
      );
    }

    if (typeFilter) {
      result = result.filter(i => i.item_type === typeFilter);
    }

    if (categoryFilter) {
      result = result.filter(i => i.category === categoryFilter);
    }

    return result;
  }, [items, localSearch, typeFilter, categoryFilter]);

  // Stats calculees
  const computedStats = useMemo(() => {
    if (stats) return stats;
    return {
      total_items: items.length,
      product_count: items.filter(i => i.item_type === 'product').length,
      service_count: items.filter(i => i.item_type === 'service').length,
      favorite_count: items.filter(i => i.is_favorite).length,
    };
  }, [items, stats]);

  // Categories uniques pour filtre
  const uniqueCategories = useMemo(() => {
    const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
    return cats.sort();
  }, [items]);

  // === HANDLERS ARTICLES ===

  const handleNewItem = useCallback(() => {
    setEditingItem(null);
    setItemForm(INITIAL_ITEM_FORM);
    setShowItemModal(true);
  }, []);

  const handleEditItem = useCallback((item) => {
    setEditingItem(item);
    setItemForm({
      item_type: item.item_type || 'product',
      category: item.category || '',
      reference: item.reference || '',
      name: item.name || '',
      description: item.description || '',
      unit_price: item.unit_price || '',
      unit: item.unit || 'unite',
      tax_rate: item.tax_rate ?? 20,
      track_stock: item.track_stock || false,
      stock_quantity: item.stock_quantity || 0,
      min_stock_alert: item.min_stock_alert || 0,
      is_favorite: item.is_favorite || false
    });
    setShowItemModal(true);
  }, []);

  const handleSubmitItem = useCallback(async (e) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.unit_price) {
      showToast?.('Nom et prix sont obligatoires', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        ...itemForm,
        unit_price: parseFloat(itemForm.unit_price) || 0,
        tax_rate: parseFloat(itemForm.tax_rate) || 20,
        stock_quantity: parseInt(itemForm.stock_quantity) || 0,
        min_stock_alert: parseInt(itemForm.min_stock_alert) || 0
      };

      if (editingItem) {
        await onUpdateItem?.({ itemId: editingItem.id, updates: data });
        showToast?.('Article mis a jour', 'success');
      } else {
        await onCreateItem?.(data);
        showToast?.('Article cree', 'success');
      }
      setShowItemModal(false);
    } catch (err) {
      showToast?.(`Erreur: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [itemForm, editingItem, onCreateItem, onUpdateItem, showToast]);

  // === HANDLERS CATEGORIES ===

  const handleNewCategory = useCallback(() => {
    setEditingCategory(null);
    setCategoryForm(INITIAL_CATEGORY_FORM);
    setShowCategoryModal(true);
  }, []);

  const handleEditCategory = useCallback((cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      description: cat.description || '',
      color: cat.color || '#6366f1',
      icon: cat.icon || '',
      item_type: cat.item_type || 'both'
    });
    setShowCategoryModal(true);
  }, []);

  const handleSubmitCategory = useCallback(async (e) => {
    e.preventDefault();
    if (!categoryForm.name) {
      showToast?.('Le nom est obligatoire', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await onUpdateCategory?.({ categoryId: editingCategory.id, updates: categoryForm });
        showToast?.('Categorie mise a jour', 'success');
      } else {
        await onCreateCategory?.(categoryForm);
        showToast?.('Categorie creee', 'success');
      }
      setShowCategoryModal(false);
    } catch (err) {
      showToast?.(`Erreur: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [categoryForm, editingCategory, onCreateCategory, onUpdateCategory, showToast]);

  // === HANDLERS TAUX TVA ===

  const handleNewTax = useCallback(() => {
    setEditingTax(null);
    setTaxForm(INITIAL_TAX_FORM);
    setShowTaxModal(true);
  }, []);

  const handleEditTax = useCallback((tax) => {
    setEditingTax(tax);
    setTaxForm({
      name: tax.name || '',
      rate: tax.rate ?? '',
      description: tax.description || '',
      is_default: tax.is_default || false
    });
    setShowTaxModal(true);
  }, []);

  const handleSubmitTax = useCallback(async (e) => {
    e.preventDefault();
    if (!taxForm.name || taxForm.rate === '') {
      showToast?.('Nom et taux sont obligatoires', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = { ...taxForm, rate: parseFloat(taxForm.rate) };
      if (editingTax) {
        await onUpdateTaxRate?.({ rateId: editingTax.id, updates: data });
        showToast?.('Taux TVA mis a jour', 'success');
      } else {
        await onCreateTaxRate?.(data);
        showToast?.('Taux TVA cree', 'success');
      }
      setShowTaxModal(false);
    } catch (err) {
      showToast?.(`Erreur: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [taxForm, editingTax, onCreateTaxRate, onUpdateTaxRate, showToast]);

  // === HANDLERS TEMPLATES ===

  const handleNewTemplate = useCallback(() => {
    setEditingTemplate(null);
    setTemplateForm(INITIAL_TEMPLATE_FORM);
    setShowTemplateModal(true);
  }, []);

  const handleEditTemplate = useCallback((tpl) => {
    setEditingTemplate(tpl);
    setTemplateForm({
      name: tpl.name || '',
      header_text: tpl.header_text || '',
      footer_text: tpl.footer_text || '',
      terms_text: tpl.terms_text || '',
      validity_days: tpl.validity_days || 30,
      show_logo: tpl.show_logo ?? true,
      show_reference: tpl.show_reference ?? true,
      show_item_description: tpl.show_item_description ?? true,
      show_discount_column: tpl.show_discount_column ?? false,
      primary_color: tpl.primary_color || '#3B82F6',
      is_default: tpl.is_default || false
    });
    setShowTemplateModal(true);
  }, []);

  const handleSubmitTemplate = useCallback(async (e) => {
    e.preventDefault();
    if (!templateForm.name) {
      showToast?.('Le nom est obligatoire', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTemplate) {
        await onUpdateTemplate?.({ templateId: editingTemplate.id, updates: templateForm });
        showToast?.('Modele mis a jour', 'success');
      } else {
        await onCreateTemplate?.(templateForm);
        showToast?.('Modele cree', 'success');
      }
      setShowTemplateModal(false);
    } catch (err) {
      showToast?.(`Erreur: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [templateForm, editingTemplate, onCreateTemplate, onUpdateTemplate, showToast]);

  // === HANDLER SUPPRESSION ===

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm.id) return;
    try {
      switch (deleteConfirm.type) {
        case 'item':
          await onDeleteItem?.(deleteConfirm.id);
          break;
        case 'category':
          await onDeleteCategory?.(deleteConfirm.id);
          break;
        case 'tax':
          await onDeleteTaxRate?.(deleteConfirm.id);
          break;
        case 'template':
          await onDeleteTemplate?.(deleteConfirm.id);
          break;
      }
      showToast?.('Element supprime', 'success');
    } catch (err) {
      showToast?.(`Erreur: ${err.message}`, 'error');
    }
    setDeleteConfirm({ show: false, id: null, name: '', type: '' });
  }, [deleteConfirm, onDeleteItem, onDeleteCategory, onDeleteTaxRate, onDeleteTemplate, showToast]);

  // === RENDER ===

  if (isLoading && items.length === 0) {
    return (
      <div className="admin-catalog-view">
        <div className="catalog-loading">
          <LoadingSpinner size="lg" text="Chargement du catalogue..." />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-catalog-view">
      {/* Header */}
      <div className="catalog-header">
        <div className="header-left">
          <h1>Catalogue</h1>
          {!isOnline && <span className="offline-badge">Hors ligne</span>}
        </div>
        <div className="header-actions">
          {activeTab === 'items' && (
            <>
              <button className="btn-export" onClick={onExportCSV}>
                Exporter CSV
              </button>
              <button className="btn-primary" onClick={handleNewItem} disabled={!isOnline}>
                + Nouvel Article
              </button>
            </>
          )}
          {activeTab === 'categories' && (
            <button className="btn-primary" onClick={handleNewCategory} disabled={!isOnline}>
              + Nouvelle Categorie
            </button>
          )}
          {activeTab === 'tax_rates' && (
            <>
              {taxRates.length === 0 && (
                <button className="btn-export" onClick={onInitializeTaxRates} disabled={!isOnline}>
                  Initialiser par defaut
                </button>
              )}
              <button className="btn-primary" onClick={handleNewTax} disabled={!isOnline}>
                + Nouveau Taux
              </button>
            </>
          )}
          {activeTab === 'templates' && (
            <button className="btn-primary" onClick={handleNewTemplate} disabled={!isOnline}>
              + Nouveau Modele
            </button>
          )}
          <button className="btn-icon" onClick={onRefresh} title="Rafraichir">
            &#x21bb;
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="catalog-error">
          Erreur: {error.message || 'Une erreur est survenue'}
          <button onClick={onRefresh}>Reessayer</button>
        </div>
      )}

      {/* Stats */}
      {activeTab === 'items' && (
        <div className="catalog-stats">
          <div className="stat-card">
            <span className="stat-label">Total articles</span>
            <span className="stat-value">{computedStats.total_items}</span>
          </div>
          <div className="stat-card stat-info">
            <span className="stat-label">Fournitures</span>
            <span className="stat-value">{computedStats.product_count}</span>
          </div>
          <div className="stat-card stat-success">
            <span className="stat-label">Services</span>
            <span className="stat-value">{computedStats.service_count}</span>
          </div>
          <div className="stat-card stat-warning">
            <span className="stat-label">Favoris</span>
            <span className="stat-value">{computedStats.favorite_count}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="catalog-tabs">
        <button
          className={`catalog-tab ${activeTab === 'items' ? 'active' : ''}`}
          onClick={() => onTabChange?.('items')}
        >
          Articles ({items.length})
        </button>
        <button
          className={`catalog-tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => onTabChange?.('categories')}
        >
          Categories ({categories.length})
        </button>
        <button
          className={`catalog-tab ${activeTab === 'tax_rates' ? 'active' : ''}`}
          onClick={() => onTabChange?.('tax_rates')}
        >
          Taux TVA ({taxRates.length})
        </button>
        <button
          className={`catalog-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => onTabChange?.('templates')}
        >
          Modeles Devis ({templates.length})
        </button>
      </div>

      {/* Tab: Articles */}
      {activeTab === 'items' && (
        <div className="catalog-content">
          {/* Toolbar */}
          <div className="catalog-toolbar">
            <div className="search-box">
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">Tous les types</option>
              {ITEM_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">Toutes categories</option>
              {uniqueCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Items Table */}
          {filteredItems.length === 0 ? (
            <div className="catalog-empty">
              <p>Aucun article trouve</p>
              {items.length === 0 && (
                <button className="btn-primary" onClick={handleNewItem}>
                  Creer votre premier article
                </button>
              )}
            </div>
          ) : (
            <div className="catalog-table-wrapper">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Ref</th>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Categorie</th>
                    <th>Prix HT</th>
                    <th>Unite</th>
                    <th>TVA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id} className={item.is_favorite ? 'row-favorite' : ''}>
                      <td>
                        <button
                          className={`btn-star ${item.is_favorite ? 'active' : ''}`}
                          onClick={() => onToggleFavorite?.(item.id)}
                          title="Favori"
                        >
                          {item.is_favorite ? '\u2605' : '\u2606'}
                        </button>
                      </td>
                      <td className="cell-ref">{item.reference || '-'}</td>
                      <td>
                        <div className="item-name">{item.name}</div>
                        {item.description && (
                          <div className="item-description">{item.description}</div>
                        )}
                      </td>
                      <td>
                        <span className={`type-badge ${item.item_type}`}>
                          {item.item_type === 'product' ? 'Fourniture' : 'Service'}
                        </span>
                      </td>
                      <td>{item.category || '-'}</td>
                      <td className="cell-price">{formatAmount(item.unit_price)}</td>
                      <td>{item.unit}</td>
                      <td>{item.tax_rate}%</td>
                      <td className="cell-actions">
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleEditItem(item)}
                          title="Modifier"
                        >
                          Modifier
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => setDeleteConfirm({
                            show: true,
                            id: item.id,
                            name: item.name,
                            type: 'item'
                          })}
                          title="Supprimer"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Categories */}
      {activeTab === 'categories' && (
        <div className="catalog-content">
          {categories.length === 0 ? (
            <div className="catalog-empty">
              <p>Aucune categorie</p>
              <button className="btn-primary" onClick={handleNewCategory}>
                Creer votre premiere categorie
              </button>
            </div>
          ) : (
            <div className="categories-grid">
              {categories.map(cat => (
                <div key={cat.id} className="category-card" style={{ borderLeftColor: cat.color || '#6366f1' }}>
                  <div className="category-header">
                    <h3>{cat.name}</h3>
                    <span className="category-type">
                      {cat.item_type === 'product' ? 'Fournitures' : cat.item_type === 'service' ? 'Services' : 'Tous'}
                    </span>
                  </div>
                  {cat.description && <p className="category-description">{cat.description}</p>}
                  <div className="category-actions">
                    <button className="btn-action btn-edit" onClick={() => handleEditCategory(cat)}>
                      Modifier
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => setDeleteConfirm({
                        show: true,
                        id: cat.id,
                        name: cat.name,
                        type: 'category'
                      })}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Taux TVA */}
      {activeTab === 'tax_rates' && (
        <div className="catalog-content">
          {taxRates.length === 0 ? (
            <div className="catalog-empty">
              <p>Aucun taux TVA configure</p>
              <button className="btn-primary" onClick={onInitializeTaxRates} disabled={!isOnline}>
                Initialiser les taux par defaut (20%, 10%, 5.5%, 0%)
              </button>
            </div>
          ) : (
            <div className="tax-rates-grid">
              {taxRates.map(tax => (
                <div key={tax.id} className={`tax-card ${tax.is_default ? 'is-default' : ''}`}>
                  <div className="tax-header">
                    <span className="tax-rate">{tax.rate}%</span>
                    <span className="tax-name">{tax.name}</span>
                    {tax.is_default && <span className="default-badge">Par defaut</span>}
                  </div>
                  {tax.description && <p className="tax-description">{tax.description}</p>}
                  <div className="tax-actions">
                    {!tax.is_default && (
                      <button
                        className="btn-action btn-default"
                        onClick={() => onSetDefaultTaxRate?.(tax.id)}
                      >
                        Par defaut
                      </button>
                    )}
                    <button className="btn-action btn-edit" onClick={() => handleEditTax(tax)}>
                      Modifier
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => setDeleteConfirm({
                        show: true,
                        id: tax.id,
                        name: tax.name,
                        type: 'tax'
                      })}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Modeles Devis */}
      {activeTab === 'templates' && (
        <div className="catalog-content">
          {templates.length === 0 ? (
            <div className="catalog-empty">
              <p>Aucun modele de devis</p>
              <button className="btn-primary" onClick={handleNewTemplate}>
                Creer votre premier modele
              </button>
            </div>
          ) : (
            <div className="templates-grid">
              {templates.map(tpl => (
                <div key={tpl.id} className={`template-card ${tpl.is_default ? 'is-default' : ''}`}>
                  <div className="template-preview" style={{ borderTopColor: tpl.primary_color || '#3B82F6' }}>
                    <h3>{tpl.name}</h3>
                    {tpl.is_default && <span className="default-badge">Par defaut</span>}
                    <div className="template-options">
                      <span>{tpl.validity_days}j validite</span>
                      {tpl.show_logo && <span>Logo</span>}
                      {tpl.show_discount_column && <span>Remise</span>}
                    </div>
                  </div>
                  <div className="template-actions">
                    {!tpl.is_default && (
                      <button
                        className="btn-action btn-default"
                        onClick={() => onSetDefaultTemplate?.(tpl.id)}
                      >
                        Par defaut
                      </button>
                    )}
                    <button
                      className="btn-action"
                      onClick={() => onDuplicateTemplate?.({ templateId: tpl.id, newName: `${tpl.name} (copie)` })}
                    >
                      Dupliquer
                    </button>
                    <button className="btn-action btn-edit" onClick={() => handleEditTemplate(tpl)}>
                      Modifier
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => setDeleteConfirm({
                        show: true,
                        id: tpl.id,
                        name: tpl.name,
                        type: 'template'
                      })}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Article */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? 'Modifier l\'article' : 'Nouvel article'}</h2>
              <button className="modal-close" onClick={() => setShowItemModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitItem}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={itemForm.item_type}
                      onChange={(e) => setItemForm(p => ({ ...p, item_type: e.target.value }))}
                    >
                      {ITEM_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Reference</label>
                    <input
                      type="text"
                      value={itemForm.reference}
                      onChange={(e) => setItemForm(p => ({ ...p, reference: e.target.value }))}
                      placeholder="REF-001"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Nom *</label>
                  <input
                    type="text"
                    value={itemForm.name}
                    onChange={(e) => setItemForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nom de l'article"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={itemForm.description}
                    onChange={(e) => setItemForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description optionnelle"
                    rows={2}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Prix unitaire HT *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemForm.unit_price}
                      onChange={(e) => setItemForm(p => ({ ...p, unit_price: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unite</label>
                    <select
                      value={itemForm.unit}
                      onChange={(e) => setItemForm(p => ({ ...p, unit: e.target.value }))}
                    >
                      {UNITS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>TVA %</label>
                    <select
                      value={itemForm.tax_rate}
                      onChange={(e) => setItemForm(p => ({ ...p, tax_rate: parseFloat(e.target.value) }))}
                    >
                      {taxRates.length > 0 ? (
                        taxRates.map(tr => (
                          <option key={tr.id} value={tr.rate}>{tr.name} ({tr.rate}%)</option>
                        ))
                      ) : (
                        <>
                          <option value="20">20%</option>
                          <option value="10">10%</option>
                          <option value="5.5">5.5%</option>
                          <option value="0">0%</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Categorie</label>
                    <input
                      type="text"
                      value={itemForm.category}
                      onChange={(e) => setItemForm(p => ({ ...p, category: e.target.value }))}
                      placeholder="Categorie"
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {categories.map(c => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {itemForm.item_type === 'product' && (
                  <div className="form-row">
                    <div className="form-group form-checkbox">
                      <label>
                        <input
                          type="checkbox"
                          checked={itemForm.track_stock}
                          onChange={(e) => setItemForm(p => ({ ...p, track_stock: e.target.checked }))}
                        />
                        Suivre le stock
                      </label>
                    </div>
                    {itemForm.track_stock && (
                      <>
                        <div className="form-group">
                          <label>Quantite en stock</label>
                          <input
                            type="number"
                            min="0"
                            value={itemForm.stock_quantity}
                            onChange={(e) => setItemForm(p => ({ ...p, stock_quantity: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Alerte stock min</label>
                          <input
                            type="number"
                            min="0"
                            value={itemForm.min_stock_alert}
                            onChange={(e) => setItemForm(p => ({ ...p, min_stock_alert: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="form-group form-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={itemForm.is_favorite}
                      onChange={(e) => setItemForm(p => ({ ...p, is_favorite: e.target.checked }))}
                    />
                    Marquer comme favori
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowItemModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : editingItem ? 'Mettre a jour' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Categorie */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Modifier la categorie' : 'Nouvelle categorie'}</h2>
              <button className="modal-close" onClick={() => setShowCategoryModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitCategory}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nom *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nom de la categorie"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Couleur</label>
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm(p => ({ ...p, color: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>S'applique a</label>
                    <select
                      value={categoryForm.item_type}
                      onChange={(e) => setCategoryForm(p => ({ ...p, item_type: e.target.value }))}
                    >
                      <option value="both">Tous</option>
                      <option value="product">Fournitures</option>
                      <option value="service">Services</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowCategoryModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : editingCategory ? 'Mettre a jour' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Taux TVA */}
      {showTaxModal && (
        <div className="modal-overlay" onClick={() => setShowTaxModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTax ? 'Modifier le taux TVA' : 'Nouveau taux TVA'}</h2>
              <button className="modal-close" onClick={() => setShowTaxModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitTax}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Nom *</label>
                    <input
                      type="text"
                      value={taxForm.name}
                      onChange={(e) => setTaxForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="ex: TVA 20%"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Taux (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={taxForm.rate}
                      onChange={(e) => setTaxForm(p => ({ ...p, rate: e.target.value }))}
                      placeholder="20"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={taxForm.description}
                    onChange={(e) => setTaxForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description optionnelle"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowTaxModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : editingTax ? 'Mettre a jour' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Template Devis */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTemplate ? 'Modifier le modele' : 'Nouveau modele de devis'}</h2>
              <button className="modal-close" onClick={() => setShowTemplateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitTemplate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nom du modele *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="ex: Modele standard"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Texte en-tete</label>
                  <textarea
                    value={templateForm.header_text}
                    onChange={(e) => setTemplateForm(p => ({ ...p, header_text: e.target.value }))}
                    placeholder="Texte affiche en haut du devis"
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label>Texte pied de page</label>
                  <textarea
                    value={templateForm.footer_text}
                    onChange={(e) => setTemplateForm(p => ({ ...p, footer_text: e.target.value }))}
                    placeholder="Texte affiche en bas du devis"
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label>Conditions</label>
                  <textarea
                    value={templateForm.terms_text}
                    onChange={(e) => setTemplateForm(p => ({ ...p, terms_text: e.target.value }))}
                    placeholder="Conditions generales"
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Validite (jours)</label>
                    <input
                      type="number"
                      min="1"
                      value={templateForm.validity_days}
                      onChange={(e) => setTemplateForm(p => ({ ...p, validity_days: parseInt(e.target.value) || 30 }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Couleur principale</label>
                    <input
                      type="color"
                      value={templateForm.primary_color}
                      onChange={(e) => setTemplateForm(p => ({ ...p, primary_color: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-options">
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={templateForm.show_logo}
                      onChange={(e) => setTemplateForm(p => ({ ...p, show_logo: e.target.checked }))}
                    />
                    Afficher le logo
                  </label>
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={templateForm.show_reference}
                      onChange={(e) => setTemplateForm(p => ({ ...p, show_reference: e.target.checked }))}
                    />
                    Afficher les references
                  </label>
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={templateForm.show_item_description}
                      onChange={(e) => setTemplateForm(p => ({ ...p, show_item_description: e.target.checked }))}
                    />
                    Afficher les descriptions
                  </label>
                  <label className="form-checkbox-label">
                    <input
                      type="checkbox"
                      checked={templateForm.show_discount_column}
                      onChange={(e) => setTemplateForm(p => ({ ...p, show_discount_column: e.target.checked }))}
                    />
                    Colonne remise
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowTemplateModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : editingTemplate ? 'Mettre a jour' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteConfirm.show && (
        <ConfirmationModal
          title="Confirmer la suppression"
          message={`Etes-vous sur de vouloir supprimer "${deleteConfirm.name}" ?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ show: false, id: null, name: '', type: '' })}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          variant="danger"
        />
      )}
    </div>
  );
}

export default AdminCatalogView;
