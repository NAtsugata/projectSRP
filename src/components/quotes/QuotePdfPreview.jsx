// =============================
// FILE: src/components/quotes/QuotePdfPreview.jsx
// Real-time PDF preview for quotes
// =============================
import React, { useMemo, useCallback, useState } from 'react';
import { generateQuotePDF } from '../../utils/invoicePdfGenerator';
import './QuotePdfPreview.css';

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
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

// Labels de statut
const statusLabels = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  expired: 'Expiré',
  converted: 'Converti'
};

function QuotePdfPreview({
  formData,
  items,
  totals,
  organization,
  selectedClient,
  quoteNumber,
  status = 'draft',
  onDownloadPdf
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Préparer les données du devis pour l'aperçu
  const quoteData = useMemo(() => ({
    quote_number: quoteNumber || 'DEV-XXXX',
    issue_date: formData.issue_date,
    valid_until: formData.valid_until,
    notes: formData.notes,
    terms: formData.terms,
    status: status,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
    quote_items: items.filter(item => item.description && parseFloat(item.unit_price) > 0),
    client: selectedClient
  }), [formData, items, totals, selectedClient, quoteNumber, status]);

  // Générer et télécharger le PDF
  const handleDownloadPdf = useCallback(async () => {
    setIsGenerating(true);
    try {
      const blob = await generateQuotePDF(quoteData, organization, selectedClient);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quoteData.quote_number || 'devis'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onDownloadPdf?.();
    } catch (error) {
      console.error('Erreur génération PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [quoteData, organization, selectedClient, onDownloadPdf]);

  return (
    <div className="quote-pdf-preview">
      <div className="preview-toolbar">
        <span className="preview-title">Aperçu du devis</span>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleDownloadPdf}
          disabled={isGenerating}
        >
          {isGenerating ? 'Génération...' : 'Télécharger PDF'}
        </button>
      </div>

      <div className="preview-container">
        <div className="pdf-page">
          {/* En-tête */}
          <header className="pdf-header">
            {/* Logo de l'organisation */}
            {organization?.logo_url && organization?.invoice_settings?.show_logo_on_documents !== false && (
              <div className="pdf-logo">
                <img src={organization.logo_url} alt="Logo" />
              </div>
            )}
            <div className="pdf-header-text">
              <h1 className="pdf-title">DEVIS</h1>
              <p className="pdf-number">{quoteData.quote_number}</p>
            </div>
          </header>

          {/* Informations émetteur et destinataire */}
          <div className="pdf-parties">
            {/* Émetteur (gauche) */}
            <div className="pdf-sender">
              <h3>{organization?.name || 'Votre entreprise'}</h3>
              {organization?.address && (
                <p className="address">{organization.address}</p>
              )}
              {organization?.phone && (
                <p>Tél: {organization.phone}</p>
              )}
              {organization?.email && (
                <p>{organization.email}</p>
              )}
              {organization?.siret && (
                <p>SIRET: {organization.siret}</p>
              )}
              {organization?.vat_number && (
                <p>TVA: {organization.vat_number}</p>
              )}
              {organization?.rcs && (
                <p>RCS: {organization.rcs}</p>
              )}
              {organization?.legal_form && organization?.share_capital && (
                <p>{organization.legal_form} au capital de {organization.share_capital}</p>
              )}
            </div>

            {/* Destinataire (droite) */}
            <div className="pdf-recipient">
              <span className="label">DESTINATAIRE:</span>
              <h3>{selectedClient?.name || selectedClient?.company_name || '-'}</h3>
              {selectedClient?.company_name && selectedClient?.name !== selectedClient?.company_name && (
                <p>{selectedClient.company_name}</p>
              )}
              {selectedClient?.address && (
                <p>{selectedClient.address}</p>
              )}
              {(selectedClient?.postal_code || selectedClient?.city) && (
                <p>{selectedClient?.postal_code} {selectedClient?.city}</p>
              )}
              {selectedClient?.email && (
                <p>{selectedClient.email}</p>
              )}
            </div>
          </div>

          {/* Dates et statut */}
          <div className="pdf-meta">
            <div className="meta-item">
              <span className="meta-label">Date d'émission:</span>
              <span className="meta-value">{formatDate(quoteData.issue_date)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Valable jusqu'au:</span>
              <span className="meta-value">{formatDate(quoteData.valid_until)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Statut:</span>
              <span className={`meta-value status-${status}`}>
                {statusLabels[status] || status}
              </span>
            </div>
          </div>

          {/* Tableau des lignes */}
          <table className="pdf-table">
            <thead>
              <tr>
                <th className="col-desc">Description</th>
                <th className="col-qty">Qté</th>
                <th className="col-unit">Unité</th>
                <th className="col-price">Prix HT</th>
                <th className="col-tax">TVA</th>
                <th className="col-total">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {quoteData.quote_items.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={6}>Aucun article</td>
                </tr>
              ) : (
                quoteData.quote_items.map((item, index) => {
                  const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                  return (
                    <tr key={index} className={index % 2 === 1 ? 'alt' : ''}>
                      <td className="col-desc">{item.description}</td>
                      <td className="col-qty">{item.quantity}</td>
                      <td className="col-unit">{item.unit}</td>
                      <td className="col-price">{formatAmount(item.unit_price)}</td>
                      <td className="col-tax">{item.tax_rate}%</td>
                      <td className="col-total">{formatAmount(lineTotal)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Totaux */}
          <div className="pdf-totals">
            <div className="totals-breakdown">
              {Object.entries(totals.taxBreakdown || {}).map(([rate, data]) => (
                <div key={rate} className="tax-row">
                  <span>TVA {rate}% sur {formatAmount(data.base)}</span>
                  <span>{formatAmount(data.amount)}</span>
                </div>
              ))}
            </div>
            <div className="totals-summary">
              <div className="total-row">
                <span>Sous-total HT</span>
                <span>{formatAmount(totals.subtotal)}</span>
              </div>
              <div className="total-row">
                <span>TVA</span>
                <span>{formatAmount(totals.taxAmount)}</span>
              </div>
              <div className="total-row final">
                <span>Total TTC</span>
                <span>{formatAmount(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes et conditions */}
          {(quoteData.notes || quoteData.terms) && (
            <div className="pdf-footer-content">
              {quoteData.notes && (
                <div className="pdf-notes">
                  <h4>Notes</h4>
                  <p>{quoteData.notes}</p>
                </div>
              )}
              {quoteData.terms && (
                <div className="pdf-terms">
                  <h4>Conditions</h4>
                  <p>{quoteData.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Mentions légales */}
          {organization?.invoice_settings?.legal_mentions && (
            <div className="pdf-legal">
              <p>{organization.invoice_settings.legal_mentions}</p>
            </div>
          )}

          {/* Coordonnées bancaires */}
          {organization?.invoice_settings?.bank_details?.iban && (
            <div className="pdf-bank">
              <h4>Coordonnées bancaires</h4>
              <p>
                {organization.invoice_settings.bank_details.bank_name && (
                  <span>Banque: {organization.invoice_settings.bank_details.bank_name}<br /></span>
                )}
                IBAN: {organization.invoice_settings.bank_details.iban}
                {organization.invoice_settings.bank_details.bic && (
                  <span> - BIC: {organization.invoice_settings.bank_details.bic}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuotePdfPreview;
