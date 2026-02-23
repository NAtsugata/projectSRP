// =============================
// FILE: src/pages/AdminInvoicesView.jsx
// Admin view for managing invoices and quotes
// =============================
import React, { useState, useCallback, useMemo } from 'react';
import { LoadingSpinner, SkeletonList } from '../components/ui';
import { ConfirmationModal } from '../components/SharedUI';
import CatalogItemSelector from '../components/catalog/CatalogItemSelector';
import TaxRateSelector from '../components/catalog/TaxRateSelector';
import QuickClientModal from '../components/catalog/QuickClientModal';
import './AdminInvoicesView.css';

// Statuts factures
const INVOICE_STATUSES = {
  draft: { label: 'Brouillon', color: 'gray' },
  sent: { label: 'Envoyee', color: 'warning' },
  paid: { label: 'Payee', color: 'success' },
  overdue: { label: 'En retard', color: 'danger' },
  cancelled: { label: 'Annulee', color: 'gray' }
};

// Statuts devis
const QUOTE_STATUSES = {
  draft: { label: 'Brouillon', color: 'gray' },
  sent: { label: 'Envoye', color: 'warning' },
  accepted: { label: 'Accepte', color: 'success' },
  rejected: { label: 'Refuse', color: 'danger' },
  expired: { label: 'Expire', color: 'gray' },
  converted: { label: 'Converti', color: 'info' }
};

// Unites
const UNITS = [
  { value: 'unite', label: 'Unite' },
  { value: 'heure', label: 'Heure' },
  { value: 'jour', label: 'Jour' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'm2', label: 'm2' },
  { value: 'ml', label: 'ml' }
];

// Modes de paiement
const PAYMENT_METHODS = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'especes', label: 'Especes' },
  { value: 'prelevement', label: 'Prelevement' }
];

// Formulaire initial facture/devis
const INITIAL_DOCUMENT_FORM = {
  client_id: '',
  intervention_id: '',
  issue_date: new Date().toISOString().split('T')[0],
  due_date: '',
  valid_until: '',
  tax_rate: 20,
  notes: '',
  terms: ''
};

// Formulaire initial ligne
const INITIAL_ITEM = {
  description: '',
  quantity: 1,
  unit: 'unite',
  unit_price: 0,
  tax_rate: 20,
  discount_percent: 0
};

// Formatage montant
const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount || 0);
};

// Formatage date
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
};

function AdminInvoicesView({
  invoices = [],
  quotes = [],
  clients = [],
  stats = null,
  selectedDocument = null,
  activeTab = 'invoices',
  filters = {},
  isLoading,
  isLoadingDocument,
  isCreating,
  isUpdating,
  isSending,
  isOnline,
  error,
  onTabChange,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onSendInvoice,
  onMarkAsPaid,
  onCancelInvoice,
  onCreateQuote,
  onUpdateQuote,
  onDeleteQuote,
  onSendQuote,
  onAcceptQuote,
  onRejectQuote,
  onConvertQuote,
  onSelectDocument,
  onFilterChange,
  onRefresh,
  onExportCSV,
  onGeneratePDF,
  onPreviewPDF,
  onClientCreated,
  showToast
}) {
  // States
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [documentType, setDocumentType] = useState('invoice'); // invoice ou quote
  const [editingDocument, setEditingDocument] = useState(null);
  const [formData, setFormData] = useState(INITIAL_DOCUMENT_FORM);
  const [items, setItems] = useState([{ ...INITIAL_ITEM }]);
  const [paymentData, setPaymentData] = useState({
    paid_date: new Date().toISOString().split('T')[0],
    payment_method: 'virement',
    payment_reference: ''
  });
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, number: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Documents selon l'onglet actif
  const documents = activeTab === 'invoices' ? invoices : quotes;
  const statuses = activeTab === 'invoices' ? INVOICE_STATUSES : QUOTE_STATUSES;

  // Filtrage local
  const filteredDocuments = useMemo(() => {
    let result = documents;

    if (localSearch) {
      const term = localSearch.toLowerCase();
      result = result.filter(d =>
        d.invoice_number?.toLowerCase().includes(term) ||
        d.quote_number?.toLowerCase().includes(term) ||
        d.client?.name?.toLowerCase().includes(term) ||
        d.client?.company_name?.toLowerCase().includes(term)
      );
    }

    if (statusFilter) {
      result = result.filter(d => d.status === statusFilter);
    }

    return result;
  }, [documents, localSearch, statusFilter]);

  // Stats calculees
  const computedStats = useMemo(() => {
    if (stats) return stats;

    return {
      total_amount: invoices.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0),
      paid_amount: invoices.filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0),
      pending_amount: invoices.filter(i => i.status === 'sent')
        .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0),
      overdue_amount: invoices.filter(i => i.status === 'overdue')
        .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0)
    };
  }, [invoices, stats]);

  // === HANDLERS ===

  // Ouvrir modale nouvelle facture
  const handleNewInvoice = useCallback(() => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    setDocumentType('invoice');
    setEditingDocument(null);
    setFormData({
      ...INITIAL_DOCUMENT_FORM,
      due_date: dueDate.toISOString().split('T')[0]
    });
    setItems([{ ...INITIAL_ITEM }]);
    setShowModal(true);
  }, []);

  // Ouvrir modale nouveau devis
  const handleNewQuote = useCallback(() => {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    setDocumentType('quote');
    setEditingDocument(null);
    setFormData({
      ...INITIAL_DOCUMENT_FORM,
      valid_until: validUntil.toISOString().split('T')[0]
    });
    setItems([{ ...INITIAL_ITEM }]);
    setShowModal(true);
  }, []);

  // Ouvrir modale edition
  const handleEditDocument = useCallback((doc) => {
    const isInvoice = !!doc.invoice_number;
    setDocumentType(isInvoice ? 'invoice' : 'quote');
    setEditingDocument(doc);
    setFormData({
      client_id: doc.client_id || '',
      intervention_id: doc.intervention_id || '',
      issue_date: doc.issue_date || new Date().toISOString().split('T')[0],
      due_date: doc.due_date || '',
      valid_until: doc.valid_until || '',
      tax_rate: doc.tax_rate || 20,
      notes: doc.notes || '',
      terms: doc.terms || ''
    });
    setItems(
      (isInvoice ? doc.invoice_items : doc.quote_items)?.map(item => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'unite',
        unit_price: item.unit_price || 0,
        tax_rate: item.tax_rate || 20,
        discount_percent: item.discount_percent || 0
      })) || [{ ...INITIAL_ITEM }]
    );
    setShowModal(true);
  }, []);

  // Calculer les totaux
  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const discount = parseFloat(item.discount_percent) || 0;
      const tax = parseFloat(item.tax_rate) || formData.tax_rate || 20;

      const lineSubtotal = qty * price * (1 - discount / 100);
      subtotal += lineSubtotal;
      taxAmount += lineSubtotal * (tax / 100);
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100
    };
  }, [items, formData.tax_rate]);

  const totals = calculateTotals();

  // Ajouter une ligne
  const handleAddItem = useCallback(() => {
    setItems(prev => [...prev, { ...INITIAL_ITEM }]);
  }, []);

  // Supprimer une ligne
  const handleRemoveItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Modifier une ligne
  const handleItemChange = useCallback((index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Soumettre le formulaire
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validItems = items.filter(item =>
        item.description && parseFloat(item.unit_price) > 0
      );

      if (validItems.length === 0) {
        showToast?.('Ajoutez au moins une ligne valide', 'error');
        return;
      }

      const documentData = {
        ...formData,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total
      };

      if (editingDocument) {
        // Mise a jour
        if (documentType === 'invoice') {
          await onUpdateInvoice?.({
            invoiceId: editingDocument.id,
            updates: documentData,
            items: validItems
          });
        } else {
          await onUpdateQuote?.({
            quoteId: editingDocument.id,
            updates: documentData,
            items: validItems
          });
        }
        showToast?.(`${documentType === 'invoice' ? 'Facture' : 'Devis'} mis a jour`, 'success');
      } else {
        // Creation
        if (documentType === 'invoice') {
          await onCreateInvoice?.({ invoiceData: documentData, items: validItems });
        } else {
          await onCreateQuote?.({ quoteData: documentData, items: validItems });
        }
        showToast?.(`${documentType === 'invoice' ? 'Facture' : 'Devis'} cree`, 'success');
      }

      setShowModal(false);
    } catch (error) {
      showToast?.(error.message || 'Erreur lors de l\'enregistrement', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, items, totals, editingDocument, documentType, onCreateInvoice, onCreateQuote, onUpdateInvoice, onUpdateQuote, showToast]);

  // Envoyer
  const handleSend = useCallback(async (doc) => {
    try {
      const isInvoice = !!doc.invoice_number;
      if (isInvoice) {
        await onSendInvoice?.(doc.id);
      } else {
        await onSendQuote?.(doc.id);
      }
      showToast?.(`${isInvoice ? 'Facture' : 'Devis'} envoye`, 'success');
    } catch (error) {
      showToast?.(error.message || 'Erreur lors de l\'envoi', 'error');
    }
  }, [onSendInvoice, onSendQuote, showToast]);

  // Marquer comme paye
  const handleOpenPaymentModal = useCallback((doc) => {
    setEditingDocument(doc);
    setPaymentData({
      paid_date: new Date().toISOString().split('T')[0],
      payment_method: 'virement',
      payment_reference: ''
    });
    setShowPaymentModal(true);
  }, []);

  const handleMarkAsPaid = useCallback(async () => {
    if (!editingDocument) return;

    try {
      await onMarkAsPaid?.({
        invoiceId: editingDocument.id,
        paymentData
      });
      showToast?.('Facture marquee comme payee', 'success');
      setShowPaymentModal(false);
    } catch (error) {
      showToast?.(error.message || 'Erreur', 'error');
    }
  }, [editingDocument, paymentData, onMarkAsPaid, showToast]);

  // Annuler facture
  const handleCancel = useCallback(async (doc) => {
    try {
      await onCancelInvoice?.(doc.id);
      showToast?.('Facture annulee', 'success');
    } catch (error) {
      showToast?.(error.message || 'Erreur', 'error');
    }
  }, [onCancelInvoice, showToast]);

  // Accepter devis
  const handleAccept = useCallback(async (doc) => {
    try {
      await onAcceptQuote?.(doc.id);
      showToast?.('Devis accepte', 'success');
    } catch (error) {
      showToast?.(error.message || 'Erreur', 'error');
    }
  }, [onAcceptQuote, showToast]);

  // Rejeter devis
  const handleReject = useCallback(async (doc) => {
    try {
      await onRejectQuote?.(doc.id);
      showToast?.('Devis rejete', 'success');
    } catch (error) {
      showToast?.(error.message || 'Erreur', 'error');
    }
  }, [onRejectQuote, showToast]);

  // Convertir devis en facture
  const handleConvert = useCallback(async (doc) => {
    try {
      await onConvertQuote?.(doc.id);
      showToast?.('Devis converti en facture', 'success');
      onTabChange?.('invoices');
    } catch (error) {
      showToast?.(error.message || 'Erreur', 'error');
    }
  }, [onConvertQuote, onTabChange, showToast]);

  // Supprimer
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm.id) return;

    try {
      if (activeTab === 'invoices') {
        await onDeleteInvoice?.(deleteConfirm.id);
      } else {
        await onDeleteQuote?.(deleteConfirm.id);
      }
      showToast?.('Document supprime', 'success');
      setDeleteConfirm({ show: false, id: null, number: '' });
    } catch (error) {
      showToast?.(error.message || 'Erreur lors de la suppression', 'error');
    }
  }, [deleteConfirm, activeTab, onDeleteInvoice, onDeleteQuote, showToast]);

  // Generer PDF
  const handleGeneratePDF = useCallback((doc) => {
    onGeneratePDF?.(doc, !!doc.invoice_number);
  }, [onGeneratePDF]);

  // Apercu PDF
  const handlePreviewPDF = useCallback((doc) => {
    onPreviewPDF?.(doc, !!doc.invoice_number);
  }, [onPreviewPDF]);

  // === RENDER ===

  if (error) {
    return (
      <div className="admin-invoices-view">
        <div className="error-state">
          <p>Erreur: {error.message || 'Impossible de charger les donnees'}</p>
          <button onClick={onRefresh} className="btn btn-primary">Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-invoices-view">
      {/* Header */}
      <header className="invoices-header">
        <div className="header-left">
          <h1>Facturation</h1>
          {!isOnline && (
            <span className="offline-badge">Mode hors ligne</span>
          )}
        </div>
        <div className="header-actions">
          <button
            onClick={handleNewQuote}
            className="btn btn-secondary"
            disabled={!isOnline}
          >
            + Nouveau devis
          </button>
          <button
            onClick={handleNewInvoice}
            className="btn btn-primary"
            disabled={!isOnline}
          >
            + Nouvelle facture
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="invoices-stats">
        <div className="stat-card">
          <span className="stat-label">Total facture</span>
          <span className="stat-value">{formatAmount(computedStats.total_amount)}</span>
        </div>
        <div className="stat-card stat-success">
          <span className="stat-label">Payees</span>
          <span className="stat-value">{formatAmount(computedStats.paid_amount)}</span>
        </div>
        <div className="stat-card stat-warning">
          <span className="stat-label">En attente</span>
          <span className="stat-value">{formatAmount(computedStats.pending_amount)}</span>
        </div>
        <div className="stat-card stat-danger">
          <span className="stat-label">En retard</span>
          <span className="stat-value">{formatAmount(computedStats.overdue_amount)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="invoices-tabs">
        <button
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => onTabChange?.('invoices')}
        >
          Factures ({invoices.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'quotes' ? 'active' : ''}`}
          onClick={() => onTabChange?.('quotes')}
        >
          Devis ({quotes.length})
        </button>
      </div>

      {/* Filters */}
      <div className="invoices-filters">
        <div className="search-wrapper">
          <input
            type="text"
            placeholder="Rechercher..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(statuses).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <button onClick={onRefresh} className="btn btn-icon" title="Actualiser">
          <RefreshIcon />
        </button>

        <button onClick={onExportCSV} className="btn btn-icon" title="Exporter CSV">
          <DownloadIcon />
        </button>
      </div>

      {/* Content */}
      <div className="invoices-content">
        {isLoading ? (
          <SkeletonList count={5} />
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <p>
              {localSearch || statusFilter
                ? 'Aucun resultat pour cette recherche'
                : activeTab === 'invoices'
                  ? 'Aucune facture. Creez votre premiere facture !'
                  : 'Aucun devis. Creez votre premier devis !'
              }
            </p>
          </div>
        ) : (
          <div className="invoices-layout">
            {/* Liste */}
            <div className="invoices-list">
              {filteredDocuments.map(doc => {
                const isInvoice = !!doc.invoice_number;
                const number = isInvoice ? doc.invoice_number : doc.quote_number;
                const statusInfo = statuses[doc.status] || { label: doc.status, color: 'gray' };

                return (
                  <div
                    key={doc.id}
                    className={`invoice-card ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                    onClick={() => onSelectDocument?.(doc)}
                  >
                    <div className="invoice-card-header">
                      <span className="invoice-number">{number}</span>
                      <span className={`status-badge status-${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="invoice-card-client">
                      {doc.client?.name || doc.client?.company_name || 'Client non defini'}
                    </div>

                    <div className="invoice-card-amount">
                      {formatAmount(doc.total)}
                    </div>

                    <div className="invoice-card-footer">
                      <span className="invoice-date">
                        {formatDate(doc.issue_date)}
                      </span>
                      {isInvoice && doc.due_date && (
                        <span className={`invoice-due ${doc.status === 'overdue' ? 'overdue' : ''}`}>
                          Ech. {formatDate(doc.due_date)}
                        </span>
                      )}
                      {!isInvoice && doc.valid_until && (
                        <span className="invoice-due">
                          Valide jusqu'au {formatDate(doc.valid_until)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail Panel */}
            {selectedDocument && (
              <div className="invoice-detail-panel">
                <div className="detail-header">
                  <h2>
                    {selectedDocument.invoice_number || selectedDocument.quote_number}
                  </h2>
                  <button
                    className="btn-close"
                    onClick={() => onSelectDocument?.(null)}
                  >
                    &times;
                  </button>
                </div>

                <div className="detail-section">
                  <h3>Client</h3>
                  <p className="detail-client-name">
                    {selectedDocument.client?.name || '-'}
                  </p>
                  {selectedDocument.client?.company_name && (
                    <p className="detail-text">{selectedDocument.client.company_name}</p>
                  )}
                  {selectedDocument.client?.address && (
                    <p className="detail-text-small">{selectedDocument.client.address}</p>
                  )}
                  {(selectedDocument.client?.postal_code || selectedDocument.client?.city) && (
                    <p className="detail-text-small">
                      {selectedDocument.client.postal_code} {selectedDocument.client.city}
                    </p>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Montants</h3>
                  <div className="detail-amounts">
                    <div className="amount-row">
                      <span>Sous-total HT</span>
                      <span>{formatAmount(selectedDocument.subtotal)}</span>
                    </div>
                    <div className="amount-row">
                      <span>TVA ({selectedDocument.tax_rate || 20}%)</span>
                      <span>{formatAmount(selectedDocument.tax_amount)}</span>
                    </div>
                    <div className="amount-row total">
                      <span>Total TTC</span>
                      <span>{formatAmount(selectedDocument.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                {(selectedDocument.invoice_items?.length > 0 || selectedDocument.quote_items?.length > 0) && (
                  <div className="detail-section">
                    <h3>Lignes</h3>
                    <div className="detail-items">
                      {(selectedDocument.invoice_items || selectedDocument.quote_items || []).map((item, idx) => (
                        <div key={idx} className="detail-item">
                          <span className="item-desc">{item.description}</span>
                          <span className="item-qty">{item.quantity} x {formatAmount(item.unit_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="detail-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => handlePreviewPDF(selectedDocument)}
                  >
                    Apercu PDF
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleGeneratePDF(selectedDocument)}
                  >
                    Telecharger PDF
                  </button>

                  {selectedDocument.status === 'draft' && (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEditDocument(selectedDocument)}
                        disabled={!isOnline}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-success"
                        onClick={() => handleSend(selectedDocument)}
                        disabled={!isOnline || isSending}
                      >
                        {isSending ? 'Envoi...' : 'Envoyer'}
                      </button>
                      <button
                        className="btn btn-danger-outline"
                        onClick={() => setDeleteConfirm({
                          show: true,
                          id: selectedDocument.id,
                          number: selectedDocument.invoice_number || selectedDocument.quote_number
                        })}
                        disabled={!isOnline}
                      >
                        Supprimer
                      </button>
                    </>
                  )}

                  {selectedDocument.invoice_number && selectedDocument.status === 'sent' && (
                    <>
                      <button
                        className="btn btn-success"
                        onClick={() => handleOpenPaymentModal(selectedDocument)}
                        disabled={!isOnline}
                      >
                        Marquer payee
                      </button>
                      <button
                        className="btn btn-danger-outline"
                        onClick={() => handleCancel(selectedDocument)}
                        disabled={!isOnline}
                      >
                        Annuler
                      </button>
                    </>
                  )}

                  {selectedDocument.quote_number && selectedDocument.status === 'sent' && (
                    <>
                      <button
                        className="btn btn-success"
                        onClick={() => handleAccept(selectedDocument)}
                        disabled={!isOnline}
                      >
                        Accepter
                      </button>
                      <button
                        className="btn btn-danger-outline"
                        onClick={() => handleReject(selectedDocument)}
                        disabled={!isOnline}
                      >
                        Rejeter
                      </button>
                    </>
                  )}

                  {selectedDocument.quote_number && selectedDocument.status === 'accepted' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleConvert(selectedDocument)}
                      disabled={!isOnline}
                    >
                      Convertir en facture
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Creation/Edition */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingDocument
                  ? `Modifier ${documentType === 'invoice' ? 'la facture' : 'le devis'}`
                  : `Nouvelle ${documentType === 'invoice' ? 'facture' : 'devis'}`
                }
              </h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body">
              {/* Client et dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Client *</label>
                  <div className="client-select-row">
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                      required
                      className="client-select"
                    >
                      <option value="">Selectionner un client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name}{client.company_name ? ` (${client.company_name})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary btn-new-client"
                      onClick={() => setShowQuickClient(true)}
                      title="Nouveau client"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Date d'emission</label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                  />
                </div>

                {documentType === 'invoice' ? (
                  <div className="form-group">
                    <label>Date d'echeance</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Valide jusqu'au</label>
                    <input
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {/* Lignes */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Lignes</h3>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={handleAddItem}>
                    + Ajouter une ligne
                  </button>
                </div>

                {/* Catalog Item Selector */}
                <CatalogItemSelector
                  onSelect={(catalogItem) => {
                    setItems(prev => [...prev, catalogItem]);
                  }}
                  placeholder="Ajouter depuis le catalogue..."
                />

                <div className="items-table">
                  <div className="items-header">
                    <span className="col-desc">Description</span>
                    <span className="col-qty">Qte</span>
                    <span className="col-unit">Unite</span>
                    <span className="col-price">Prix HT</span>
                    <span className="col-tax">TVA %</span>
                    <span className="col-total">Total HT</span>
                    <span className="col-actions"></span>
                  </div>

                  {items.map((item, index) => (
                    <div key={index} className="items-row">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="col-desc"
                        required
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="col-qty"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                        className="col-unit"
                      >
                        {UNITS.map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="col-price"
                        required
                      />
                      <div className="col-tax">
                        <TaxRateSelector
                          value={item.tax_rate}
                          onChange={(val) => handleItemChange(index, 'tax_rate', val)}
                          size="sm"
                        />
                      </div>
                      <span className="col-total">
                        {formatAmount((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                      </span>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => handleRemoveItem(index)}
                        disabled={items.length === 1}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totaux */}
                <div className="totals-section">
                  <div className="total-row">
                    <span>Sous-total HT</span>
                    <span>{formatAmount(totals.subtotal)}</span>
                  </div>
                  <div className="total-row">
                    <span>TVA</span>
                    <span>{formatAmount(totals.taxAmount)}</span>
                  </div>
                  <div className="total-row total-final">
                    <span>Total TTC</span>
                    <span>{formatAmount(totals.total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="form-row">
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Notes internes ou pour le client..."
                  />
                </div>
                <div className="form-group">
                  <label>Conditions</label>
                  <textarea
                    value={formData.terms}
                    onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
                    rows={3}
                    placeholder="Conditions de paiement..."
                  />
                </div>
              </div>
            </form>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Paiement */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enregistrer le paiement</h2>
              <button className="btn-close" onClick={() => setShowPaymentModal(false)}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Date de paiement</label>
                <input
                  type="date"
                  value={paymentData.paid_date}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, paid_date: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Mode de paiement</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, payment_method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Reference (optionnel)</label>
                <input
                  type="text"
                  value={paymentData.payment_reference}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, payment_reference: e.target.value }))}
                  placeholder="Numero de cheque, virement..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPaymentModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleMarkAsPaid}
              >
                Confirmer le paiement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression */}
      {deleteConfirm.show && (
        <ConfirmationModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm({ show: false, id: null, number: '' })}
          title="Confirmer la suppression"
          message={`Etes-vous sur de vouloir supprimer ${deleteConfirm.number} ? Cette action est irreversible.`}
        />
      )}

      {/* Modal Quick Client */}
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
    </div>
  );
}

// Icons
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

export default AdminInvoicesView;
