// =============================
// FILE: src/components/quotes/QuoteEditor.jsx
// Full-page quote editor with catalog sidebar
// =============================
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useCatalogItems, useCatalogCategories, useTaxRates } from '../../hooks/useCatalog';
import QuickClientModal from '../catalog/QuickClientModal';
import QuoteAttachments from './QuoteAttachments';
import QuoteLayoutEditor, { DEFAULT_LAYOUT } from './QuoteLayoutEditor';
import QuotePdfPreview from './QuotePdfPreview';
import './QuoteEditor.css';

// Unites disponibles
const UNITS = [
  { value: 'unite', label: 'Unité' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'm2', label: 'm²' },
  { value: 'ml', label: 'ml' }
];

// Item initial (tax_rate sera écrasé par le default de l'organisation)
const getInitialItem = (taxRate = 20) => ({
  description: '',
  quantity: 1,
  unit: 'unite',
  unit_price: 0,
  tax_rate: taxRate,
  discount_percent: 0
});

// Formatage montant
const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount || 0);
};

function QuoteEditor({
  clients = [],
  editingQuote = null,
  onSave,
  onCancel,
  showToast,
  onClientCreated,
  organizationId,
  organization = null
}) {
  // Extraire les paramètres de facturation de l'organisation
  const invoiceSettings = organization?.invoice_settings || {};
  const defaultTaxRate = invoiceSettings.default_tax_rate || 20;
  const defaultTerms = invoiceSettings.default_terms || '';
  const quoteValidityDays = invoiceSettings.quote_validity_days || 30;

  // State du formulaire
  const [formData, setFormData] = useState(() => {
    const today = new Date();
    const validUntil = new Date();
    validUntil.setDate(today.getDate() + quoteValidityDays);

    return {
      client_id: '',
      issue_date: today.toISOString().split('T')[0],
      valid_until: validUntil.toISOString().split('T')[0],
      notes: '',
      terms: defaultTerms
    };
  });

  const [items, setItems] = useState([getInitialItem(defaultTaxRate)]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState(false);

  // State pour pièces jointes et mise en page
  const [attachments, setAttachments] = useState([]);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Catalogue
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [catalogTab, setCatalogTab] = useState('all'); // all, fournitures, services, favorites
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('quote_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentItems, setRecentItems] = useState(() => {
    const saved = localStorage.getItem('quote_recent');
    return saved ? JSON.parse(saved) : [];
  });

  // Hooks catalogue
  const { data: catalogItems = [], isLoading: loadingItems } = useCatalogItems();
  const { data: categories = [] } = useCatalogCategories();
  const { data: taxRates = [] } = useTaxRates();

  // Charger devis existant
  useEffect(() => {
    if (editingQuote) {
      setFormData({
        client_id: editingQuote.client_id || '',
        issue_date: editingQuote.issue_date || new Date().toISOString().split('T')[0],
        valid_until: editingQuote.valid_until || '',
        notes: editingQuote.notes || '',
        terms: editingQuote.terms || ''
      });

      if (editingQuote.quote_items?.length > 0) {
        setItems(editingQuote.quote_items.map(item => ({
          description: item.description || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'unite',
          unit_price: item.unit_price || 0,
          tax_rate: item.tax_rate || 20,
          discount_percent: item.discount_percent || 0
        })));
      }

      // Charger les pièces jointes
      if (editingQuote.quote_attachments?.length > 0) {
        setAttachments(editingQuote.quote_attachments);
      }

      // Charger la mise en page
      if (editingQuote.layout) {
        setLayout(editingQuote.layout);
      }
    }
  }, [editingQuote]);

  // Appliquer les paramètres de l'organisation pour les nouveaux devis
  useEffect(() => {
    if (!editingQuote && organization) {
      const settings = organization.invoice_settings || {};
      const validityDays = settings.quote_validity_days || 30;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validityDays);

      setFormData(prev => ({
        ...prev,
        terms: prev.terms || settings.default_terms || '',
        valid_until: validUntil.toISOString().split('T')[0]
      }));

      // Mettre à jour le taux de TVA par défaut des lignes existantes
      const newTaxRate = settings.default_tax_rate || 20;
      setItems(prev => {
        if (prev.length === 1 && !prev[0].description) {
          return [getInitialItem(newTaxRate)];
        }
        return prev;
      });
    }
  }, [organization, editingQuote]);

  // Filtrer articles du catalogue
  const filteredCatalogItems = useMemo(() => {
    let result = catalogItems;

    // Filtre par onglet
    if (catalogTab === 'fournitures') {
      result = result.filter(i => i.type === 'product');
    } else if (catalogTab === 'services') {
      result = result.filter(i => i.type === 'service');
    } else if (catalogTab === 'favorites') {
      result = result.filter(i => favorites.includes(i.id));
    }

    // Filtre par catégorie
    if (selectedCategory !== 'all') {
      result = result.filter(i => i.category_id === selectedCategory);
    }

    // Filtre par recherche
    if (catalogSearch) {
      const term = catalogSearch.toLowerCase();
      result = result.filter(i =>
        i.name?.toLowerCase().includes(term) ||
        i.reference?.toLowerCase().includes(term) ||
        i.description?.toLowerCase().includes(term)
      );
    }

    return result;
  }, [catalogItems, catalogTab, selectedCategory, catalogSearch, favorites]);

  // Calculer les totaux
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    const taxBreakdown = {};

    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const discount = parseFloat(item.discount_percent) || 0;
      const tax = parseFloat(item.tax_rate) || 20;

      const lineSubtotal = qty * price * (1 - discount / 100);
      const lineTax = lineSubtotal * (tax / 100);

      subtotal += lineSubtotal;
      taxAmount += lineTax;

      // Breakdown par taux
      if (!taxBreakdown[tax]) {
        taxBreakdown[tax] = { base: 0, amount: 0 };
      }
      taxBreakdown[tax].base += lineSubtotal;
      taxBreakdown[tax].amount += lineTax;
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
      taxBreakdown
    };
  }, [items]);

  // Ajouter article depuis catalogue
  const handleAddFromCatalog = useCallback((catalogItem) => {
    const newItem = {
      description: catalogItem.name,
      quantity: 1,
      unit: catalogItem.unit || 'unite',
      unit_price: catalogItem.default_price || 0,
      tax_rate: catalogItem.default_tax_rate || 20,
      discount_percent: 0,
      catalog_item_id: catalogItem.id
    };

    setItems(prev => [...prev, newItem]);

    // Ajouter aux récents
    setRecentItems(prev => {
      const updated = [catalogItem, ...prev.filter(i => i.id !== catalogItem.id)].slice(0, 10);
      localStorage.setItem('quote_recent', JSON.stringify(updated));
      return updated;
    });

    showToast?.(`${catalogItem.name} ajouté`, 'success');
  }, [showToast]);

  // Toggle favoris
  const toggleFavorite = useCallback((itemId) => {
    setFavorites(prev => {
      const updated = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      localStorage.setItem('quote_favorites', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Ajouter ligne vide
  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, getInitialItem(defaultTaxRate)]);
  }, [defaultTaxRate]);

  // Supprimer ligne
  const handleRemoveItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Modifier ligne
  const handleItemChange = useCallback((index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Dupliquer ligne
  const handleDuplicateItem = useCallback((index) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems.splice(index + 1, 0, { ...prev[index] });
      return newItems;
    });
  }, []);

  // Déplacer ligne
  const handleMoveItem = useCallback((index, direction) => {
    setItems(prev => {
      const newItems = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newItems.length) return prev;
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      return newItems;
    });
  }, []);

  // Sauvegarder
  const handleSubmit = useCallback(async () => {
    if (!formData.client_id) {
      showToast?.('Sélectionnez un client', 'error');
      return;
    }

    const validItems = items.filter(item =>
      item.description && parseFloat(item.unit_price) > 0
    );

    if (validItems.length === 0) {
      showToast?.('Ajoutez au moins un article valide', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const quoteData = {
        ...formData,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        layout: layout
      };

      await onSave?.({
        quoteData,
        items: validItems,
        attachments: attachments,
        isEdit: !!editingQuote,
        quoteId: editingQuote?.id
      });

      showToast?.('Devis enregistré', 'success');
    } catch (error) {
      showToast?.(error.message || 'Erreur lors de l\'enregistrement', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, items, totals, editingQuote, onSave, showToast, attachments, layout]);

  // Client sélectionné
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === formData.client_id);
  }, [clients, formData.client_id]);

  return (
    <div className={`quote-editor ${showPreview ? 'with-preview' : ''}`}>
      {/* Sidebar Catalogue */}
      <aside className="catalog-sidebar">
        <div className="catalog-header">
          <h2>Catalogue</h2>
          <input
            type="text"
            placeholder="Rechercher..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            className="catalog-search"
          />
        </div>

        {/* Tabs du catalogue */}
        <div className="catalog-tabs">
          <button
            className={`catalog-tab ${catalogTab === 'all' ? 'active' : ''}`}
            onClick={() => setCatalogTab('all')}
          >
            Tout
          </button>
          <button
            className={`catalog-tab ${catalogTab === 'fournitures' ? 'active' : ''}`}
            onClick={() => setCatalogTab('fournitures')}
          >
            Fournitures
          </button>
          <button
            className={`catalog-tab ${catalogTab === 'services' ? 'active' : ''}`}
            onClick={() => setCatalogTab('services')}
          >
            Services
          </button>
          <button
            className={`catalog-tab ${catalogTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setCatalogTab('favorites')}
          >
            ★
          </button>
        </div>

        {/* Filtre catégorie */}
        {catalogTab !== 'favorites' && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-select"
          >
            <option value="all">Toutes catégories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        )}

        {/* Articles récents */}
        {catalogTab === 'all' && recentItems.length > 0 && !catalogSearch && (
          <div className="recent-section">
            <h4>Récents</h4>
            <div className="recent-items">
              {recentItems.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  className="recent-item"
                  onClick={() => handleAddFromCatalog(item)}
                >
                  <span className="recent-name">{item.name}</span>
                  <span className="recent-price">{formatAmount(item.default_price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Liste articles */}
        <div className="catalog-list">
          {loadingItems ? (
            <div className="catalog-loading">Chargement...</div>
          ) : filteredCatalogItems.length === 0 ? (
            <div className="catalog-empty">
              {catalogTab === 'favorites' ? 'Aucun favori' : 'Aucun article trouvé'}
            </div>
          ) : (
            filteredCatalogItems.map(item => (
              <div key={item.id} className="catalog-item">
                <button
                  className="catalog-item-main"
                  onClick={() => handleAddFromCatalog(item)}
                >
                  <span className={`item-type ${item.type}`}>
                    {item.type === 'product' ? 'F' : 'S'}
                  </span>
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    {item.reference && (
                      <span className="item-ref">{item.reference}</span>
                    )}
                  </div>
                  <span className="item-price">{formatAmount(item.default_price)}</span>
                </button>
                <button
                  className={`favorite-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                  onClick={() => toggleFavorite(item.id)}
                >
                  ★
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Zone principale */}
      <main className="quote-main">
        {/* Header avec infos client */}
        <header className="quote-header">
          <div className="quote-title">
            <h1>{editingQuote ? `Modifier devis ${editingQuote.quote_number}` : 'Nouveau devis'}</h1>
          </div>
          <div className="quote-actions">
            <button
              className={`btn btn-icon ${showPreview ? 'active' : ''}`}
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu PDF'}
            >
              {showPreview ? '👁️ Masquer aperçu' : '👁️ Aperçu PDF'}
            </button>
            <button
              className="btn btn-icon"
              onClick={() => setShowLayoutEditor(true)}
              title="Personnaliser la mise en page"
            >
              ⚙️ Mise en page
            </button>
            <button className="btn btn-secondary" onClick={onCancel}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </header>

        {/* Infos client et dates */}
        <section className="quote-info">
          <div className="info-card client-card">
            <h3>Client</h3>
            <div className="client-select-wrapper">
              <select
                value={formData.client_id}
                onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                className="client-select"
              >
                <option value="">Sélectionner un client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}{client.company_name ? ` (${client.company_name})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-add-client"
                onClick={() => setShowQuickClient(true)}
                title="Nouveau client"
              >
                +
              </button>
            </div>
            {selectedClient && (
              <div className="client-details">
                {selectedClient.company_name && <p>{selectedClient.company_name}</p>}
                {selectedClient.address && <p>{selectedClient.address}</p>}
                {(selectedClient.postal_code || selectedClient.city) && (
                  <p>{selectedClient.postal_code} {selectedClient.city}</p>
                )}
                {selectedClient.email && <p className="client-email">{selectedClient.email}</p>}
              </div>
            )}
          </div>

          <div className="info-card dates-card">
            <h3>Dates</h3>
            <div className="date-fields">
              <div className="date-field">
                <label>Émission</label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                />
              </div>
              <div className="date-field">
                <label>Validité</label>
                <input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Table des lignes */}
        <section className="quote-items">
          <div className="items-header-row">
            <h3>Lignes du devis</h3>
            <button className="btn btn-sm btn-secondary" onClick={handleAddItem}>
              + Ligne vide
            </button>
          </div>

          <div className="items-table">
            <div className="table-header">
              <span className="col-actions"></span>
              <span className="col-description">Description</span>
              <span className="col-qty">Qté</span>
              <span className="col-unit">Unité</span>
              <span className="col-price">Prix HT</span>
              <span className="col-tax">TVA</span>
              <span className="col-total">Total HT</span>
              <span className="col-remove"></span>
            </div>

            {items.map((item, index) => {
              const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);

              return (
                <div key={index} className="table-row">
                  <div className="col-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleMoveItem(index, -1)}
                      disabled={index === 0}
                      title="Monter"
                    >
                      ↑
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleMoveItem(index, 1)}
                      disabled={index === items.length - 1}
                      title="Descendre"
                    >
                      ↓
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleDuplicateItem(index)}
                      title="Dupliquer"
                    >
                      ⧉
                    </button>
                  </div>

                  <input
                    type="text"
                    className="col-description"
                    placeholder="Description de l'article..."
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />

                  <input
                    type="number"
                    className="col-qty"
                    step="0.01"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />

                  <select
                    className="col-unit"
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                  >
                    {UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    className="col-price"
                    step="0.01"
                    min="0"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                  />

                  <select
                    className="col-tax"
                    value={item.tax_rate}
                    onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value))}
                  >
                    <option value={20}>20%</option>
                    <option value={10}>10%</option>
                    <option value={5.5}>5.5%</option>
                    <option value={0}>0%</option>
                    {taxRates.filter(t => ![20, 10, 5.5, 0].includes(t.rate)).map(t => (
                      <option key={t.id} value={t.rate}>{t.rate}%</option>
                    ))}
                  </select>

                  <span className="col-total">{formatAmount(lineTotal)}</span>

                  <button
                    className="col-remove"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Totaux */}
          <div className="totals-panel">
            <div className="totals-detail">
              {Object.entries(totals.taxBreakdown).map(([rate, data]) => (
                <div key={rate} className="tax-line">
                  <span>TVA {rate}% sur {formatAmount(data.base)}</span>
                  <span>{formatAmount(data.amount)}</span>
                </div>
              ))}
            </div>
            <div className="totals-summary">
              <div className="total-line">
                <span>Sous-total HT</span>
                <span>{formatAmount(totals.subtotal)}</span>
              </div>
              <div className="total-line">
                <span>TVA</span>
                <span>{formatAmount(totals.taxAmount)}</span>
              </div>
              <div className="total-line final">
                <span>Total TTC</span>
                <span>{formatAmount(totals.total)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notes et conditions */}
        <section className="quote-notes">
          <div className="note-field">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notes internes ou pour le client..."
              rows={3}
            />
          </div>
          <div className="note-field">
            <label>Conditions</label>
            <textarea
              value={formData.terms}
              onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
              placeholder="Conditions de paiement, délais..."
              rows={3}
            />
          </div>
        </section>

        {/* Pièces jointes (images/PDF) */}
        <section className="quote-attachments-section">
          <QuoteAttachments
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            quoteId={editingQuote?.id}
            organizationId={organizationId}
            showToast={showToast}
          />
        </section>
      </main>

      {/* Panneau d'aperçu PDF en temps réel */}
      {showPreview && (
        <aside className="preview-sidebar">
          <QuotePdfPreview
            formData={formData}
            items={items}
            totals={totals}
            organization={organization}
            selectedClient={selectedClient}
            quoteNumber={editingQuote?.quote_number}
            status={editingQuote?.status || 'draft'}
            layout={layout}
            attachments={attachments}
          />
        </aside>
      )}

      {/* Quick Client Modal */}
      {showQuickClient && (
        <QuickClientModal
          onClose={() => setShowQuickClient(false)}
          onClientCreated={(newClient) => {
            setFormData(prev => ({ ...prev, client_id: newClient.id }));
            onClientCreated?.(newClient);
          }}
          showToast={showToast}
        />
      )}

      {/* Layout Editor Modal */}
      <QuoteLayoutEditor
        layout={layout}
        onLayoutChange={setLayout}
        isOpen={showLayoutEditor}
        onClose={() => setShowLayoutEditor(false)}
      />
    </div>
  );
}

export default QuoteEditor;
