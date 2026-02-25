// =============================
// FILE: src/pages/QuoteEditorPage.jsx
// Container page for the full-page quote editor
// =============================
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QuoteEditor from '../components/quotes/QuoteEditor';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';

// Fetch clients
async function fetchClients(organizationId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) throw error;
  return data || [];
}

// Fetch single quote with items and attachments
async function fetchQuote(quoteId) {
  if (!quoteId) return null;

  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      quote_items (*),
      quote_attachments (*),
      clients (*)
    `)
    .eq('id', quoteId)
    .single();

  if (error) throw error;
  return data;
}

// Generate quote number
async function generateQuoteNumber(organizationId) {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;

  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .eq('organization_id', organizationId)
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = parseInt(data[0].quote_number.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

function QuoteEditorPage() {
  const navigate = useNavigate();
  const { id: quoteId } = useParams();
  const { showToast } = useToast();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();

  const organizationId = profile?.organization_id;

  // Fetch clients
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['clients', organizationId],
    queryFn: () => fetchClients(organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000
  });

  // Fetch existing quote if editing
  const { data: existingQuote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => fetchQuote(quoteId),
    enabled: !!quoteId
  });

  // Save quote mutation
  const saveMutation = useMutation({
    mutationFn: async ({ quoteData, items, attachments = [], isEdit, quoteId: editId }) => {
      // Create or update quote
      if (isEdit && editId) {
        // Update existing quote
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            client_id: quoteData.client_id,
            issue_date: quoteData.issue_date,
            valid_until: quoteData.valid_until,
            subtotal: quoteData.subtotal,
            tax_amount: quoteData.tax_amount,
            total: quoteData.total,
            notes: quoteData.notes,
            terms: quoteData.terms,
            layout: quoteData.layout,
            updated_at: new Date().toISOString()
          })
          .eq('id', editId);

        if (quoteError) throw quoteError;

        // Delete old items
        await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', editId);

        // Insert new items
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map((item, idx) => ({
            quote_id: editId,
            description: item.description,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            unit_price: parseFloat(item.unit_price) || 0,
            tax_rate: parseFloat(item.tax_rate) || 20,
            discount_percent: parseFloat(item.discount_percent) || 0,
            line_total: (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
            sort_order: idx
          })));

        if (itemsError) throw itemsError;

        // Handle attachments - delete old and insert new
        await supabase
          .from('quote_attachments')
          .delete()
          .eq('quote_id', editId);

        if (attachments.length > 0) {
          const { error: attachError } = await supabase
            .from('quote_attachments')
            .insert(attachments.map((att, idx) => ({
              quote_id: editId,
              file_name: att.file_name,
              file_type: att.file_type,
              file_size: att.file_size,
              storage_path: att.storage_path,
              position: idx,
              display_mode: att.display_mode || 'thumbnail',
              caption: att.caption || '',
              include_in_pdf: att.include_in_pdf !== false,
              pdf_page: att.pdf_page || 'end'
            })));
          if (attachError) throw attachError;
        }

        return { id: editId };
      } else {
        // Create new quote
        const quoteNumber = await generateQuoteNumber(organizationId);

        const { data: newQuote, error: quoteError } = await supabase
          .from('quotes')
          .insert({
            organization_id: organizationId,
            quote_number: quoteNumber,
            client_id: quoteData.client_id,
            issue_date: quoteData.issue_date,
            valid_until: quoteData.valid_until,
            subtotal: quoteData.subtotal,
            tax_amount: quoteData.tax_amount,
            total: quoteData.total,
            notes: quoteData.notes,
            terms: quoteData.terms,
            layout: quoteData.layout,
            status: 'draft'
          })
          .select()
          .single();

        if (quoteError) throw quoteError;

        // Insert items
        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items.map((item, idx) => ({
            quote_id: newQuote.id,
            description: item.description,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit,
            unit_price: parseFloat(item.unit_price) || 0,
            tax_rate: parseFloat(item.tax_rate) || 20,
            discount_percent: parseFloat(item.discount_percent) || 0,
            line_total: (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
            sort_order: idx
          })));

        if (itemsError) throw itemsError;

        // Insert attachments
        if (attachments.length > 0) {
          const { error: attachError } = await supabase
            .from('quote_attachments')
            .insert(attachments.map((att, idx) => ({
              quote_id: newQuote.id,
              file_name: att.file_name,
              file_type: att.file_type,
              file_size: att.file_size,
              storage_path: att.storage_path,
              position: idx,
              display_mode: att.display_mode || 'thumbnail',
              caption: att.caption || '',
              include_in_pdf: att.include_in_pdf !== false,
              pdf_page: att.pdf_page || 'end'
            })));
          if (attachError) throw attachError;
        }

        return newQuote;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      showToast('Devis enregistré avec succès', 'success');
      navigate('/invoices');
    },
    onError: (error) => {
      showToast(`Erreur: ${error.message}`, 'error');
    }
  });

  // Handle client created
  const handleClientCreated = (newClient) => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  // Loading state
  if (loadingClients || (quoteId && loadingQuote)) {
    return (
      <div className="quote-editor-loading">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <QuoteEditor
      clients={clients}
      editingQuote={existingQuote}
      onSave={(data) => saveMutation.mutateAsync(data)}
      onCancel={() => navigate('/invoices')}
      showToast={showToast}
      onClientCreated={handleClientCreated}
      organizationId={organizationId}
    />
  );
}

export default QuoteEditorPage;
