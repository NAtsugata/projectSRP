// =============================
// FILE: src/pages/AdminInvoicesViewContainer.jsx
// Container for invoices/quotes management
// =============================
import React, { useState, useCallback } from 'react';
import { useInvoices, useQuotes, useInvoiceStats } from '../hooks/useInvoices';
import { useClients } from '../hooks/useClients';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useToast } from '../contexts/ToastContext';
import { invoicingService } from '../services/invoicingService';
import { generateInvoicePDF, generateQuotePDF, downloadInvoicePdf, previewInvoicePdf } from '../utils/invoicePdfGenerator';
import { useAuthStore } from '../store/authStore';
import AdminInvoicesView from './AdminInvoicesView';

function AdminInvoicesViewContainer() {
  const { showToast } = useToast();
  const isOnline = useOnlineStatus();
  const { profile } = useAuthStore();
  const organization = profile?.organization || {};

  // State
  const [activeTab, setActiveTab] = useState('invoices');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filters, setFilters] = useState({
    status: null,
    clientId: null,
    dateFrom: null,
    dateTo: null
  });

  // Hooks
  const {
    invoices,
    isLoading: isLoadingInvoices,
    error: invoicesError,
    refetch: refetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoice,
    markAsPaid,
    cancelInvoice,
    isCreating: isCreatingInvoice,
    isUpdating: isUpdatingInvoice,
    isSending: isSendingInvoice
  } = useInvoices(filters);

  const {
    quotes,
    isLoading: isLoadingQuotes,
    error: quotesError,
    refetch: refetchQuotes,
    createQuote,
    updateQuote,
    deleteQuote,
    sendQuote,
    acceptQuote,
    rejectQuote,
    convertToInvoice,
    isCreating: isCreatingQuote,
    isUpdating: isUpdatingQuote,
    isSending: isSendingQuote
  } = useQuotes(filters);

  const { data: stats, refetch: refetchStats } = useInvoiceStats();

  const { clients } = useClients({ isActive: true, limit: 500 });

  // Handlers
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedDocument(null);
  }, []);

  const handleSelectDocument = useCallback((doc) => {
    setSelectedDocument(doc);
  }, []);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleRefresh = useCallback(() => {
    refetchInvoices();
    refetchQuotes();
    refetchStats();
  }, [refetchInvoices, refetchQuotes, refetchStats]);

  // Invoice handlers
  const handleCreateInvoice = useCallback(async ({ invoiceData, items }) => {
    try {
      const result = await createInvoice({ invoiceData, items });
      if (result.error) throw result.error;
      showToast('Facture creee avec succes', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la creation', 'error');
      throw error;
    }
  }, [createInvoice, showToast]);

  const handleUpdateInvoice = useCallback(async ({ invoiceId, updates, items }) => {
    try {
      const result = await updateInvoice({ invoiceId, updates, items });
      if (result.error) throw result.error;
      showToast('Facture mise a jour', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la mise a jour', 'error');
      throw error;
    }
  }, [updateInvoice, showToast]);

  const handleDeleteInvoice = useCallback(async (invoiceId) => {
    try {
      const result = await deleteInvoice(invoiceId);
      if (result.error) throw result.error;
      setSelectedDocument(null);
      showToast('Facture supprimee', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la suppression', 'error');
      throw error;
    }
  }, [deleteInvoice, showToast]);

  const handleSendInvoice = useCallback(async (invoiceId) => {
    try {
      const result = await sendInvoice(invoiceId);
      if (result.error) throw result.error;
      showToast('Facture marquee comme envoyee', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de l\'envoi', 'error');
      throw error;
    }
  }, [sendInvoice, showToast]);

  const handleMarkAsPaid = useCallback(async ({ invoiceId, paymentData }) => {
    try {
      const result = await markAsPaid({ invoiceId, paymentData });
      if (result.error) throw result.error;
      showToast('Facture marquee comme payee', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
      throw error;
    }
  }, [markAsPaid, showToast]);

  const handleCancelInvoice = useCallback(async (invoiceId) => {
    try {
      const result = await cancelInvoice(invoiceId);
      if (result.error) throw result.error;
      showToast('Facture annulee', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
      throw error;
    }
  }, [cancelInvoice, showToast]);

  // Quote handlers
  const handleCreateQuote = useCallback(async ({ quoteData, items }) => {
    try {
      const result = await createQuote({ quoteData, items });
      if (result.error) throw result.error;
      showToast('Devis cree avec succes', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la creation', 'error');
      throw error;
    }
  }, [createQuote, showToast]);

  const handleUpdateQuote = useCallback(async ({ quoteId, updates, items }) => {
    try {
      const result = await updateQuote({ quoteId, updates, items });
      if (result.error) throw result.error;
      showToast('Devis mis a jour', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la mise a jour', 'error');
      throw error;
    }
  }, [updateQuote, showToast]);

  const handleDeleteQuote = useCallback(async (quoteId) => {
    try {
      const result = await deleteQuote(quoteId);
      if (result.error) throw result.error;
      setSelectedDocument(null);
      showToast('Devis supprime', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur lors de la suppression', 'error');
      throw error;
    }
  }, [deleteQuote, showToast]);

  const handleSendQuote = useCallback(async (quoteId) => {
    try {
      const result = await sendQuote(quoteId);
      if (result.error) throw result.error;
      showToast('Devis marque comme envoye', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
      throw error;
    }
  }, [sendQuote, showToast]);

  const handleAcceptQuote = useCallback(async (quoteId) => {
    try {
      const result = await acceptQuote(quoteId);
      if (result.error) throw result.error;
      showToast('Devis accepte', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
      throw error;
    }
  }, [acceptQuote, showToast]);

  const handleRejectQuote = useCallback(async (quoteId) => {
    try {
      const result = await rejectQuote(quoteId);
      if (result.error) throw result.error;
      showToast('Devis rejete', 'success');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
      throw error;
    }
  }, [rejectQuote, showToast]);

  const handleConvertQuote = useCallback(async (quoteId) => {
    try {
      const result = await convertToInvoice(quoteId);
      if (result.error) throw result.error;
      showToast('Devis converti en facture', 'success');
      setActiveTab('invoices');
      return result;
    } catch (error) {
      showToast(error.message || 'Erreur', 'error');
      throw error;
    }
  }, [convertToInvoice, showToast]);

  // PDF handlers
  const handleGeneratePDF = useCallback((doc, isInvoice) => {
    try {
      const client = doc.client || clients.find(c => c.id === doc.client_id) || {};
      const pdfBlob = isInvoice
        ? generateInvoicePDF(doc, organization, client)
        : generateQuotePDF(doc, organization, client);

      const filename = isInvoice
        ? `${doc.invoice_number || 'facture'}.pdf`
        : `${doc.quote_number || 'devis'}.pdf`;

      downloadInvoicePdf(pdfBlob, filename);
      showToast('PDF telecharge', 'success');
    } catch (error) {
      showToast('Erreur lors de la generation du PDF', 'error');
    }
  }, [clients, organization, showToast]);

  const handlePreviewPDF = useCallback((doc, isInvoice) => {
    try {
      const client = doc.client || clients.find(c => c.id === doc.client_id) || {};
      const pdfBlob = isInvoice
        ? generateInvoicePDF(doc, organization, client)
        : generateQuotePDF(doc, organization, client);

      previewInvoicePdf(pdfBlob);
    } catch (error) {
      showToast('Erreur lors de l\'apercu du PDF', 'error');
    }
  }, [clients, organization, showToast]);

  // Export CSV
  const handleExportCSV = useCallback(async () => {
    try {
      const { data: csv, error } = await invoicingService.exportInvoicesCSV(filters);
      if (error) throw error;

      // Creer et telecharger le fichier
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factures_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Export CSV telecharge', 'success');
    } catch (error) {
      showToast('Erreur lors de l\'export', 'error');
    }
  }, [filters, showToast]);

  const isLoading = isLoadingInvoices || isLoadingQuotes;
  const error = invoicesError || quotesError;
  const isCreating = isCreatingInvoice || isCreatingQuote;
  const isUpdating = isUpdatingInvoice || isUpdatingQuote;
  const isSending = isSendingInvoice || isSendingQuote;

  return (
    <AdminInvoicesView
      invoices={invoices}
      quotes={quotes}
      clients={clients}
      stats={stats}
      selectedDocument={selectedDocument}
      activeTab={activeTab}
      filters={filters}
      isLoading={isLoading}
      isLoadingDocument={false}
      isCreating={isCreating}
      isUpdating={isUpdating}
      isSending={isSending}
      isOnline={isOnline}
      error={error}
      onTabChange={handleTabChange}
      onCreateInvoice={handleCreateInvoice}
      onUpdateInvoice={handleUpdateInvoice}
      onDeleteInvoice={handleDeleteInvoice}
      onSendInvoice={handleSendInvoice}
      onMarkAsPaid={handleMarkAsPaid}
      onCancelInvoice={handleCancelInvoice}
      onCreateQuote={handleCreateQuote}
      onUpdateQuote={handleUpdateQuote}
      onDeleteQuote={handleDeleteQuote}
      onSendQuote={handleSendQuote}
      onAcceptQuote={handleAcceptQuote}
      onRejectQuote={handleRejectQuote}
      onConvertQuote={handleConvertQuote}
      onSelectDocument={handleSelectDocument}
      onFilterChange={handleFilterChange}
      onRefresh={handleRefresh}
      onExportCSV={handleExportCSV}
      onGeneratePDF={handleGeneratePDF}
      onPreviewPDF={handlePreviewPDF}
      showToast={showToast}
    />
  );
}

export default AdminInvoicesViewContainer;
