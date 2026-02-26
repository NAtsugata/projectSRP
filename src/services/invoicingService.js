// src/services/invoicingService.js
// Service de gestion des factures et devis

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { withOrgId, getOrgId } from '../utils/orgHelper';

export const invoicingService = {
  // =====================================================
  // FACTURES (INVOICES)
  // =====================================================

  /**
   * Recuperer toutes les factures de l'organisation
   * @param {Object} options - Options de filtrage
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getInvoices(options = {}) {
    const {
      status = null,
      clientId = null,
      dateFrom = null,
      dateTo = null,
      limit = 100,
      offset = 0
    } = options;

    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            postal_code,
            city
          ),
          intervention:interventions!intervention_id (
            id,
            client,
            service,
            status
          ),
          invoice_items (
            id,
            position,
            description,
            quantity,
            unit,
            unit_price,
            tax_rate,
            discount_percent
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      if (dateFrom) {
        query = query.gte('issue_date', dateFrom);
      }

      if (dateTo) {
        query = query.lte('issue_date', dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.log('📄 getInvoices:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getInvoices:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer une facture par son ID
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getInvoiceById(invoiceId) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            address_complement,
            postal_code,
            city,
            country,
            siret,
            tva_number,
            payment_terms
          ),
          intervention:interventions!intervention_id (
            id,
            client,
            service,
            status,
            address
          ),
          invoice_items (
            id,
            position,
            description,
            quantity,
            unit,
            unit_price,
            tax_rate,
            discount_percent
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      // Trier les items par position
      if (data?.invoice_items) {
        data.invoice_items.sort((a, b) => a.position - b.position);
      }

      logger.log('📄 getInvoiceById:', invoiceId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getInvoiceById:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer une nouvelle facture avec ses lignes
   * @param {Object} invoiceData - Donnees de la facture
   * @param {Array} items - Lignes de la facture
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createInvoice(invoiceData, items = []) {
    try {
      // Calculer les totaux
      const totals = this.calculateTotals(items, invoiceData.tax_rate || 20);

      const invoiceToCreate = withOrgId({
        ...invoiceData,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        status: invoiceData.status || 'draft',
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

      // Creer la facture (le trigger auto-genere le numero)
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceToCreate])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Creer les lignes
      if (items.length > 0) {
        const itemsToCreate = items.map((item, index) => ({
          invoice_id: invoice.id,
          position: index,
          description: item.description,
          quantity: item.quantity || 1,
          unit: item.unit || 'unite',
          unit_price: item.unit_price,
          tax_rate: item.tax_rate ?? invoiceData.tax_rate ?? 20,
          discount_percent: item.discount_percent || 0
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToCreate);

        if (itemsError) throw itemsError;
      }

      logger.log('✅ createInvoice:', invoice.invoice_number);
      return { data: invoice, error: null };
    } catch (error) {
      logger.error('❌ Erreur createInvoice:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour une facture
   * @param {string} invoiceId - ID de la facture
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateInvoice(invoiceId, updates) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ updateInvoice:', invoiceId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateInvoice:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer une facture (seulement si brouillon)
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteInvoice(invoiceId) {
    try {
      // Verifier que la facture existe et est en brouillon
      const { data: invoices, error: fetchError } = await supabase
        .from('invoices')
        .select('status')
        .eq('id', invoiceId);

      if (fetchError) throw fetchError;

      // Si aucune facture trouvée, c'est qu'elle n'existe pas ou RLS bloque
      if (!invoices || invoices.length === 0) {
        throw new Error('Facture introuvable ou accès refusé');
      }

      const invoice = invoices[0];

      if (invoice.status !== 'draft') {
        throw new Error('Seules les factures en brouillon peuvent etre supprimees');
      }

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      logger.log('🗑️ deleteInvoice:', invoiceId);
      return { data: { id: invoiceId }, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteInvoice:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // WORKFLOW FACTURES
  // =====================================================

  /**
   * Marquer une facture comme envoyee
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async sendInvoice(invoiceId) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;

      logger.log('📤 sendInvoice:', invoiceId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur sendInvoice:', error);
      return { data: null, error };
    }
  },

  /**
   * Marquer une facture comme payee
   * @param {string} invoiceId - ID de la facture
   * @param {Object} paymentData - Donnees de paiement
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async markAsPaid(invoiceId, paymentData = {}) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: paymentData.paid_date || new Date().toISOString().split('T')[0],
          payment_method: paymentData.payment_method || null,
          payment_reference: paymentData.payment_reference || null
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;

      logger.log('💰 markAsPaid:', invoiceId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur markAsPaid:', error);
      return { data: null, error };
    }
  },

  /**
   * Annuler une facture
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async cancelInvoice(invoiceId) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;

      logger.log('❌ cancelInvoice:', invoiceId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur cancelInvoice:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // INVOICE ITEMS
  // =====================================================

  /**
   * Ajouter une ligne a une facture
   * @param {string} invoiceId - ID de la facture
   * @param {Object} itemData - Donnees de la ligne
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async addInvoiceItem(invoiceId, itemData) {
    try {
      // Obtenir la position max actuelle
      const { data: existingItems } = await supabase
        .from('invoice_items')
        .select('position')
        .eq('invoice_id', invoiceId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingItems?.length > 0 ? existingItems[0].position + 1 : 0;

      const { data, error } = await supabase
        .from('invoice_items')
        .insert([{
          invoice_id: invoiceId,
          position: nextPosition,
          ...itemData
        }])
        .select()
        .single();

      if (error) throw error;

      // Recalculer les totaux
      await this.recalculateInvoiceTotals(invoiceId);

      logger.log('➕ addInvoiceItem:', invoiceId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur addInvoiceItem:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour une ligne de facture
   * @param {string} itemId - ID de la ligne
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateInvoiceItem(itemId, updates) {
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .update(updates)
        .eq('id', itemId)
        .select('*, invoice_id')
        .single();

      if (error) throw error;

      // Recalculer les totaux
      await this.recalculateInvoiceTotals(data.invoice_id);

      logger.log('✏️ updateInvoiceItem:', itemId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateInvoiceItem:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer une ligne de facture
   * @param {string} itemId - ID de la ligne
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteInvoiceItem(itemId) {
    try {
      // Obtenir l'invoice_id avant de supprimer
      const { data: items } = await supabase
        .from('invoice_items')
        .select('invoice_id')
        .eq('id', itemId);

      const item = items?.[0];

      const { error } = await supabase
        .from('invoice_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Recalculer les totaux
      if (item?.invoice_id) {
        await this.recalculateInvoiceTotals(item.invoice_id);
      }

      logger.log('🗑️ deleteInvoiceItem:', itemId);
      return { data: { id: itemId }, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteInvoiceItem:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour toutes les lignes d'une facture
   * @param {string} invoiceId - ID de la facture
   * @param {Array} items - Nouvelles lignes
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateInvoiceItems(invoiceId, items) {
    try {
      // Supprimer les anciennes lignes
      await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      // Creer les nouvelles lignes
      if (items.length > 0) {
        const itemsToCreate = items.map((item, index) => ({
          invoice_id: invoiceId,
          position: index,
          description: item.description,
          quantity: item.quantity || 1,
          unit: item.unit || 'unite',
          unit_price: item.unit_price,
          tax_rate: item.tax_rate ?? 20,
          discount_percent: item.discount_percent || 0
        }));

        const { error } = await supabase
          .from('invoice_items')
          .insert(itemsToCreate);

        if (error) throw error;
      }

      // Recalculer les totaux
      await this.recalculateInvoiceTotals(invoiceId);

      logger.log('✅ updateInvoiceItems:', invoiceId);
      return { data: { invoiceId }, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateInvoiceItems:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // CALCULS
  // =====================================================

  /**
   * Calculer les totaux a partir des lignes
   * @param {Array} items - Lignes
   * @param {number} defaultTaxRate - Taux TVA par defaut
   * @returns {Object} - {subtotal, taxAmount, total}
   */
  calculateTotals(items, defaultTaxRate = 20) {
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const quantity = parseFloat(item.quantity) || 1;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const discountPercent = parseFloat(item.discount_percent) || 0;
      const taxRate = parseFloat(item.tax_rate) ?? defaultTaxRate;

      const lineSubtotal = quantity * unitPrice * (1 - discountPercent / 100);
      const lineTax = lineSubtotal * (taxRate / 100);

      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100
    };
  },

  /**
   * Recalculer et mettre a jour les totaux d'une facture
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async recalculateInvoiceTotals(invoiceId) {
    try {
      // Recuperer les lignes
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      if (itemsError) throw itemsError;

      // Recuperer le taux TVA de la facture
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('tax_rate')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Calculer les totaux
      const totals = this.calculateTotals(items || [], invoice.tax_rate || 20);

      // Mettre a jour la facture
      const { data, error } = await supabase
        .from('invoices')
        .update({
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur recalculateInvoiceTotals:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // DEVIS (QUOTES)
  // =====================================================

  /**
   * Recuperer tous les devis de l'organisation
   * @param {Object} options - Options de filtrage
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getQuotes(options = {}) {
    const {
      status = null,
      clientId = null,
      dateFrom = null,
      dateTo = null,
      limit = 100,
      offset = 0
    } = options;

    try {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          client:clients!client_id (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            postal_code,
            city
          ),
          intervention:interventions!intervention_id (
            id,
            client,
            service,
            status
          ),
          quote_items (
            id,
            position,
            description,
            quantity,
            unit,
            unit_price,
            tax_rate,
            discount_percent
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      if (dateFrom) {
        query = query.gte('issue_date', dateFrom);
      }

      if (dateTo) {
        query = query.lte('issue_date', dateTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.log('📋 getQuotes:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getQuotes:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer un devis par son ID
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getQuoteById(quoteId) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients!client_id (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            address_complement,
            postal_code,
            city,
            country,
            siret,
            tva_number,
            payment_terms
          ),
          intervention:interventions!intervention_id (
            id,
            client,
            service,
            status,
            address
          ),
          converted_invoice:invoices (
            id,
            invoice_number,
            status
          ),
          quote_items (
            id,
            position,
            description,
            quantity,
            unit,
            unit_price,
            tax_rate,
            discount_percent
          )
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;

      // Trier les items par position
      if (data?.quote_items) {
        data.quote_items.sort((a, b) => a.position - b.position);
      }

      logger.log('📋 getQuoteById:', quoteId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getQuoteById:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer un nouveau devis avec ses lignes
   * @param {Object} quoteData - Donnees du devis
   * @param {Array} items - Lignes du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createQuote(quoteData, items = []) {
    try {
      // Calculer les totaux
      const totals = this.calculateTotals(items, quoteData.tax_rate || 20);

      // Date de validite par defaut: 30 jours
      const validUntil = quoteData.valid_until ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const quoteToCreate = withOrgId({
        ...quoteData,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total: totals.total,
        valid_until: validUntil,
        status: quoteData.status || 'draft',
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

      // Creer le devis (le trigger auto-genere le numero)
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([quoteToCreate])
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Creer les lignes
      if (items.length > 0) {
        const itemsToCreate = items.map((item, index) => ({
          quote_id: quote.id,
          position: index,
          description: item.description,
          quantity: item.quantity || 1,
          unit: item.unit || 'unite',
          unit_price: item.unit_price,
          tax_rate: item.tax_rate ?? quoteData.tax_rate ?? 20,
          discount_percent: item.discount_percent || 0
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsToCreate);

        if (itemsError) throw itemsError;
      }

      logger.log('✅ createQuote:', quote.quote_number);
      return { data: quote, error: null };
    } catch (error) {
      logger.error('❌ Erreur createQuote:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour un devis
   * @param {string} quoteId - ID du devis
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateQuote(quoteId, updates) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', quoteId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ updateQuote:', quoteId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateQuote:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un devis (seulement si brouillon)
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteQuote(quoteId) {
    try {
      // Verifier que le devis existe et est en brouillon
      const { data: quotes, error: fetchError } = await supabase
        .from('quotes')
        .select('status')
        .eq('id', quoteId);

      if (fetchError) throw fetchError;

      // Si aucun devis trouvé, c'est qu'il n'existe pas ou RLS bloque
      if (!quotes || quotes.length === 0) {
        throw new Error('Devis introuvable ou accès refusé');
      }

      const quote = quotes[0];

      if (quote.status !== 'draft') {
        throw new Error('Seuls les devis en brouillon peuvent etre supprimes');
      }

      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      logger.log('🗑️ deleteQuote:', quoteId);
      return { data: { id: quoteId }, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteQuote:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour les lignes d'un devis
   * @param {string} quoteId - ID du devis
   * @param {Array} items - Nouvelles lignes
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateQuoteItems(quoteId, items) {
    try {
      // Supprimer les anciennes lignes
      await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', quoteId);

      // Creer les nouvelles lignes
      if (items.length > 0) {
        const itemsToCreate = items.map((item, index) => ({
          quote_id: quoteId,
          position: index,
          description: item.description,
          quantity: item.quantity || 1,
          unit: item.unit || 'unite',
          unit_price: item.unit_price,
          tax_rate: item.tax_rate ?? 20,
          discount_percent: item.discount_percent || 0
        }));

        const { error } = await supabase
          .from('quote_items')
          .insert(itemsToCreate);

        if (error) throw error;
      }

      // Recalculer les totaux
      await this.recalculateQuoteTotals(quoteId);

      logger.log('✅ updateQuoteItems:', quoteId);
      return { data: { quoteId }, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateQuoteItems:', error);
      return { data: null, error };
    }
  },

  /**
   * Recalculer et mettre a jour les totaux d'un devis
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async recalculateQuoteTotals(quoteId) {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId);

      if (itemsError) throw itemsError;

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('tax_rate')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      const totals = this.calculateTotals(items || [], quote.tax_rate || 20);

      const { data, error } = await supabase
        .from('quotes')
        .update({
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total: totals.total
        })
        .eq('id', quoteId)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur recalculateQuoteTotals:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // WORKFLOW DEVIS
  // =====================================================

  /**
   * Marquer un devis comme envoye
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async sendQuote(quoteId) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update({
          status: 'sent',
          sent_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', quoteId)
        .select()
        .single();

      if (error) throw error;

      logger.log('📤 sendQuote:', quoteId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur sendQuote:', error);
      return { data: null, error };
    }
  },

  /**
   * Marquer un devis comme accepte
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async acceptQuote(quoteId) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update({
          status: 'accepted',
          accepted_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', quoteId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ acceptQuote:', quoteId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur acceptQuote:', error);
      return { data: null, error };
    }
  },

  /**
   * Rejeter un devis
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async rejectQuote(quoteId) {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .update({ status: 'rejected' })
        .eq('id', quoteId)
        .select()
        .single();

      if (error) throw error;

      logger.log('❌ rejectQuote:', quoteId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur rejectQuote:', error);
      return { data: null, error };
    }
  },

  /**
   * Convertir un devis en facture
   * @param {string} quoteId - ID du devis
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async convertQuoteToInvoice(quoteId) {
    try {
      // Recuperer le devis complet
      const { data: quote, error: quoteError } = await this.getQuoteById(quoteId);
      if (quoteError) throw quoteError;

      if (quote.status === 'converted') {
        throw new Error('Ce devis a deja ete converti en facture');
      }

      // Preparer les donnees de la facture
      const invoiceData = {
        client_id: quote.client_id,
        intervention_id: quote.intervention_id,
        tax_rate: quote.tax_rate,
        notes: quote.notes,
        terms: quote.terms,
        due_date: quote.client?.payment_terms
          ? new Date(Date.now() + quote.client.payment_terms * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      // Preparer les lignes
      const items = (quote.quote_items || []).map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        discount_percent: item.discount_percent
      }));

      // Creer la facture
      const { data: invoice, error: invoiceError } = await this.createInvoice(invoiceData, items);
      if (invoiceError) throw invoiceError;

      // Mettre a jour le devis
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'converted',
          converted_invoice_id: invoice.id,
          converted_at: new Date().toISOString()
        })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      logger.log('🔄 convertQuoteToInvoice:', { quoteId, invoiceId: invoice.id });
      return { data: invoice, error: null };
    } catch (error) {
      logger.error('❌ Erreur convertQuoteToInvoice:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // INTEGRATION INTERVENTIONS
  // =====================================================

  /**
   * Creer une facture a partir d'une intervention
   * @param {string} interventionId - ID de l'intervention
   * @param {Array} items - Lignes (optionnel)
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createInvoiceFromIntervention(interventionId, items = []) {
    try {
      // Recuperer l'intervention
      const { data: intervention, error: intError } = await supabase
        .from('interventions')
        .select(`
          *,
          client:clients!client_id (
            id,
            payment_terms
          )
        `)
        .eq('id', interventionId)
        .single();

      if (intError) throw intError;

      // Calculer la date d'echeance
      const paymentTerms = intervention.client?.payment_terms || 30;
      const dueDate = new Date(Date.now() + paymentTerms * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      const invoiceData = {
        client_id: intervention.client_id || intervention.client?.id,
        intervention_id: interventionId,
        due_date: dueDate,
        notes: `Facture pour intervention: ${intervention.client} - ${intervention.service}`
      };

      return await this.createInvoice(invoiceData, items);
    } catch (error) {
      logger.error('❌ Erreur createInvoiceFromIntervention:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer un devis a partir d'une intervention
   * @param {string} interventionId - ID de l'intervention
   * @param {Array} items - Lignes (optionnel)
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createQuoteFromIntervention(interventionId, items = []) {
    try {
      const { data: intervention, error: intError } = await supabase
        .from('interventions')
        .select('*, client:clients!client_id (id)')
        .eq('id', interventionId)
        .single();

      if (intError) throw intError;

      const quoteData = {
        client_id: intervention.client_id || intervention.client?.id,
        intervention_id: interventionId,
        notes: `Devis pour intervention: ${intervention.client} - ${intervention.service}`
      };

      return await this.createQuote(quoteData, items);
    } catch (error) {
      logger.error('❌ Erreur createQuoteFromIntervention:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // STATISTIQUES
  // =====================================================

  /**
   * Obtenir les statistiques des factures
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getInvoiceStats() {
    try {
      // Essayer d'utiliser la fonction RPC
      const { data, error } = await supabase.rpc('get_invoice_stats');

      if (error) {
        // Fallback: calcul cote client
        const { data: invoices } = await this.getInvoices({ limit: 1000 });

        const stats = {
          total_invoices: invoices?.length || 0,
          draft_count: invoices?.filter(i => i.status === 'draft').length || 0,
          sent_count: invoices?.filter(i => i.status === 'sent').length || 0,
          paid_count: invoices?.filter(i => i.status === 'paid').length || 0,
          overdue_count: invoices?.filter(i => i.status === 'overdue').length || 0,
          cancelled_count: invoices?.filter(i => i.status === 'cancelled').length || 0,
          total_amount: invoices?.reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0) || 0,
          paid_amount: invoices?.filter(i => i.status === 'paid')
            .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0) || 0,
          pending_amount: invoices?.filter(i => i.status === 'sent')
            .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0) || 0,
          overdue_amount: invoices?.filter(i => i.status === 'overdue')
            .reduce((sum, i) => sum + (parseFloat(i.total) || 0), 0) || 0
        };

        return { data: stats, error: null };
      }

      return { data: data?.[0] || data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getInvoiceStats:', error);
      return { data: null, error };
    }
  },

  /**
   * Obtenir le chiffre d'affaires par mois
   * @param {number} year - Annee
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getRevenueByMonth(year = new Date().getFullYear()) {
    try {
      const { data, error } = await supabase.rpc('get_revenue_by_month', { p_year: year });

      if (error) {
        // Fallback: calcul cote client
        const { data: invoices } = await this.getInvoices({
          dateFrom: `${year}-01-01`,
          dateTo: `${year}-12-31`,
          limit: 1000
        });

        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          month_name: new Date(year, i).toLocaleString('fr-FR', { month: 'long' }),
          invoiced_amount: 0,
          paid_amount: 0,
          invoice_count: 0
        }));

        invoices?.forEach(invoice => {
          const month = new Date(invoice.issue_date).getMonth();
          monthlyData[month].invoiced_amount += parseFloat(invoice.total) || 0;
          monthlyData[month].invoice_count += 1;
          if (invoice.status === 'paid') {
            monthlyData[month].paid_amount += parseFloat(invoice.total) || 0;
          }
        });

        return { data: monthlyData, error: null };
      }

      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getRevenueByMonth:', error);
      return { data: null, error };
    }
  },

  /**
   * Obtenir les factures en retard
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getOverdueInvoices() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('status', 'sent')
        .lt('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Ajouter le nombre de jours de retard
      const enrichedData = data?.map(invoice => ({
        ...invoice,
        days_overdue: Math.floor(
          (new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24)
        )
      }));

      logger.log('⚠️ getOverdueInvoices:', { count: data?.length || 0 });
      return { data: enrichedData, error: null };
    } catch (error) {
      logger.error('❌ Erreur getOverdueInvoices:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // EXPORT
  // =====================================================

  /**
   * Exporter les factures en CSV
   * @param {Object} filters - Filtres
   * @returns {Promise<{data: string, error: Object}>}
   */
  async exportInvoicesCSV(filters = {}) {
    try {
      const { data: invoices, error } = await this.getInvoices({ ...filters, limit: 10000 });
      if (error) throw error;

      const headers = [
        'Numero',
        'Date emission',
        'Date echeance',
        'Client',
        'Statut',
        'HT',
        'TVA',
        'TTC',
        'Date paiement',
        'Mode paiement'
      ];

      const rows = invoices.map(invoice => [
        invoice.invoice_number,
        invoice.issue_date,
        invoice.due_date || '',
        invoice.client?.name || '',
        invoice.status,
        invoice.subtotal,
        invoice.tax_amount,
        invoice.total,
        invoice.paid_date || '',
        invoice.payment_method || ''
      ]);

      const csv = [
        headers.join(';'),
        ...rows.map(row => row.map(cell =>
          typeof cell === 'string' && cell.includes(';') ? `"${cell}"` : cell
        ).join(';'))
      ].join('\n');

      logger.log('📊 exportInvoicesCSV:', { count: invoices.length });
      return { data: csv, error: null };
    } catch (error) {
      logger.error('❌ Erreur exportInvoicesCSV:', error);
      return { data: null, error };
    }
  }
};

export default invoicingService;
