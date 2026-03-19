/**
 * ============================================================
 * CONNECTEUR PPF (PORTAIL PUBLIC DE FACTURATION)
 * ============================================================
 * Interface avec le Portail Public de Facturation (Chorus Pro étendu)
 * pour l'envoi et le suivi des factures électroniques
 *
 * Endpoints API: https://portail-facture.fr/api/v1
 * Documentation: https://developer.chorus-pro.gouv.fr
 * ============================================================
 */

import logger from '../../utils/logger';
import { EINVOICING_STATUS, EINVOICING_PLATFORM } from '../../types/invoicing2026';
import { supabase } from '../../lib/supabaseClient';

/**
 * Configuration PPF par environnement
 */
const PPF_CONFIG = {
  production: {
    baseURL: 'https://portail-facture.fr/api/v1',
    authURL: 'https://portail-facture.fr/oauth/token',
    webURL: 'https://portail-facture.fr'
  },
  sandbox: {
    baseURL: 'https://sandbox.portail-facture.fr/api/v1',
    authURL: 'https://sandbox.portail-facture.fr/oauth/token',
    webURL: 'https://sandbox.portail-facture.fr'
  }
};

class PPFConnector {
  constructor() {
    this.env = process.env.REACT_APP_PPF_ENV || 'sandbox';
    this.config = PPF_CONFIG[this.env];
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // =====================================================
  // AUTHENTIFICATION OAUTH2
  // =====================================================

  /**
   * Obtient un access token OAuth2 pour le PPF
   * @param {string} organizationId - ID organisation
   * @returns {Promise<string>} - Access token
   */
  async authenticate(organizationId) {
    try {
      // Vérifier si token valide existe
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      // Récupérer credentials depuis settings organisation
      const { data: org, error } = await supabase
        .from('organizations')
        .select('einvoicing_settings')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      const settings = org?.einvoicing_settings || {};

      if (!settings.api_key_encrypted || !settings.api_endpoint) {
        throw new Error('Credentials PPF non configurés. Configurer dans Paramètres > E-invoicing');
      }

      // Décrypter API key (en production, utiliser vraie encryption)
      const clientId = settings.api_key_encrypted;
      const clientSecret = settings.api_secret_encrypted;

      logger.log('[PPF] Authentification OAuth2...');

      // Requête OAuth2 Client Credentials
      const response = await fetch(this.config.authURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'facture:write facture:read'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Authentification PPF échouée: ${error.error_description || error.error}`);
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // -1min sécurité

      logger.log('[PPF] ✅ Authentification réussie', {
        expiresIn: data.expires_in
      });

      return this.accessToken;

    } catch (error) {
      logger.error('[PPF] ❌ Erreur authentification:', error);
      throw error;
    }
  }

  // =====================================================
  // ENVOI FACTURE
  // =====================================================

  /**
   * Envoie une facture au PPF
   * @param {string} invoiceId - ID facture
   * @param {Blob} facturxBlob - Fichier Factur-X (PDF/A-3 + XML)
   * @param {Object} metadata - Métadonnées additionnelles
   * @returns {Promise<Object>} - Résultat dépôt
   */
  async sendInvoice(invoiceId, facturxBlob, metadata = {}) {
    try {
      logger.log('[PPF] Envoi facture', { invoiceId });

      // 1. Récupérer la facture complète
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (*),
          organization:organizations!organization_id (*)
        `)
        .eq('id', invoiceId)
        .single();

      if (invError) throw invError;

      // 2. Authentification
      const token = await this.authenticate(invoice.organization_id);

      // 3. Préparer FormData
      const formData = new FormData();
      formData.append('file', facturxBlob, `${invoice.invoice_number}.pdf`);
      formData.append('invoice_number', invoice.invoice_number);
      formData.append('seller_siret', invoice.organization.siret);
      formData.append('buyer_siret', invoice.client.siret || invoice.client.siren);
      formData.append('total_ttc', invoice.total);
      formData.append('issue_date', invoice.issue_date);

      if (metadata.priority) {
        formData.append('priority', metadata.priority);
      }

      // 4. Envoi HTTP POST
      const response = await fetch(`${this.config.baseURL}/invoices/deposit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Pas de Content-Type (laissé à FormData)
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Dépôt PPF échoué: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      logger.log('[PPF] ✅ Facture déposée', {
        depositId: result.deposit_id,
        status: result.status
      });

      // 5. Mettre à jour statut dans la BDD
      await this.updateInvoiceEInvoicingStatus(invoiceId, {
        einvoicing_status: EINVOICING_STATUS.DEPOSITED.code,
        einvoicing_platform: EINVOICING_PLATFORM.PPF.code,
        einvoicing_sent_at: new Date().toISOString(),
        einvoicing_deposited_at: new Date().toISOString(),
        einvoicing_deposit_id: result.deposit_id
      });

      return {
        success: true,
        depositId: result.deposit_id,
        status: result.status,
        message: 'Facture déposée sur le PPF avec succès'
      };

    } catch (error) {
      logger.error('[PPF] ❌ Erreur envoi facture:', error);

      // Mettre à jour statut erreur
      await this.updateInvoiceEInvoicingStatus(invoiceId, {
        einvoicing_status: EINVOICING_STATUS.REJECTED.code,
        einvoicing_rejected_reason: error.message
      });

      throw error;
    }
  }

  // =====================================================
  // SUIVI STATUT FACTURE
  // =====================================================

  /**
   * Récupère le statut d'une facture sur le PPF
   * @param {string} depositId - ID dépôt PPF
   * @returns {Promise<Object>} - Statut détaillé
   */
  async getInvoiceStatus(depositId, organizationId) {
    try {
      const token = await this.authenticate(organizationId);

      const response = await fetch(`${this.config.baseURL}/invoices/${depositId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Récupération statut échouée: ${response.statusText}`);
      }

      const status = await response.json();

      logger.log('[PPF] Statut facture', { depositId, status: status.status });

      return {
        depositId,
        status: status.status,              // DEPOSITED, REJECTED, ACCEPTED, PAID
        statusDate: status.status_date,
        rejectionReason: status.rejection_reason,
        acceptedDate: status.accepted_date,
        paidDate: status.paid_date
      };

    } catch (error) {
      logger.error('[PPF] ❌ Erreur récupération statut:', error);
      throw error;
    }
  }

  /**
   * Synchronise le statut PPF → BDD locale
   * @param {string} invoiceId - ID facture local
   * @param {string} depositId - ID dépôt PPF
   * @returns {Promise<void>}
   */
  async syncInvoiceStatus(invoiceId, depositId) {
    try {
      // Récupérer organisation
      const { data: invoice } = await supabase
        .from('invoices')
        .select('organization_id')
        .eq('id', invoiceId)
        .single();

      const ppfStatus = await this.getInvoiceStatus(depositId, invoice.organization_id);

      // Mapper statut PPF → statut local
      const updates = {
        einvoicing_status: ppfStatus.status
      };

      if (ppfStatus.status === 'REJECTED') {
        updates.einvoicing_rejected_reason = ppfStatus.rejectionReason;
      }

      if (ppfStatus.status === 'ACCEPTED') {
        updates.status = 'sent';  // Facture acceptée par client
      }

      if (ppfStatus.status === 'PAID') {
        updates.status = 'paid';
        updates.paid_date = ppfStatus.paidDate;
      }

      await this.updateInvoiceEInvoicingStatus(invoiceId, updates);

      logger.log('[PPF] Statut synchronisé', { invoiceId, status: ppfStatus.status });

    } catch (error) {
      logger.error('[PPF] ❌ Erreur sync statut:', error);
      throw error;
    }
  }

  // =====================================================
  // WEBHOOK (RÉCEPTION NOTIFICATIONS PPF)
  // =====================================================

  /**
   * Traite un webhook reçu du PPF
   * @param {Object} webhookPayload - Données webhook
   * @returns {Promise<void>}
   */
  async handleWebhook(webhookPayload) {
    try {
      logger.log('[PPF] Webhook reçu', { event: webhookPayload.event_type });

      const { event_type, deposit_id, invoice_number, status, data } = webhookPayload;

      // Retrouver la facture locale
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('id, organization_id')
        .eq('invoice_number', invoice_number)
        .eq('einvoicing_deposit_id', deposit_id)
        .single();

      if (error || !invoice) {
        logger.warn('[PPF] Facture introuvable pour webhook', { invoice_number, deposit_id });
        return;
      }

      // Traiter selon type d'événement
      switch (event_type) {
        case 'invoice.deposited':
          await this.updateInvoiceEInvoicingStatus(invoice.id, {
            einvoicing_status: EINVOICING_STATUS.DEPOSITED.code,
            einvoicing_deposited_at: data.deposited_at
          });
          break;

        case 'invoice.rejected':
          await this.updateInvoiceEInvoicingStatus(invoice.id, {
            einvoicing_status: EINVOICING_STATUS.REJECTED.code,
            einvoicing_rejected_reason: data.rejection_reason
          });
          break;

        case 'invoice.accepted':
          await this.updateInvoiceEInvoicingStatus(invoice.id, {
            einvoicing_status: EINVOICING_STATUS.ACCEPTED.code,
            status: 'sent'
          });
          break;

        case 'invoice.paid':
          await this.updateInvoiceEInvoicingStatus(invoice.id, {
            einvoicing_status: EINVOICING_STATUS.PAID.code,
            status: 'paid',
            paid_date: data.paid_date
          });
          break;

        default:
          logger.warn('[PPF] Type événement inconnu:', event_type);
      }

      logger.log('[PPF] ✅ Webhook traité', { event_type, invoiceId: invoice.id });

    } catch (error) {
      logger.error('[PPF] ❌ Erreur traitement webhook:', error);
      throw error;
    }
  }

  // =====================================================
  // HELPERS BDD
  // =====================================================

  /**
   * Met à jour le statut e-invoicing d'une facture
   * @param {string} invoiceId - ID facture
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<void>}
   */
  async updateInvoiceEInvoicingStatus(invoiceId, updates) {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      if (error) throw error;

    } catch (error) {
      logger.error('[PPF] ❌ Erreur mise à jour statut:', error);
      throw error;
    }
  }

  // =====================================================
  // ANNUAIRE ENTREPRISES
  // =====================================================

  /**
   * Recherche une entreprise dans l'annuaire PPF
   * (Utilise l'annuaire central des entreprises XP Z12-013)
   * @param {string} sirenOrName - SIREN ou nom entreprise
   * @returns {Promise<Array>} - Liste entreprises
   */
  async searchCompany(sirenOrName, organizationId) {
    try {
      const token = await this.authenticate(organizationId);

      const response = await fetch(`${this.config.baseURL}/directory/search?q=${encodeURIComponent(sirenOrName)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Recherche annuaire échouée: ${response.statusText}`);
      }

      const results = await response.json();

      logger.log('[PPF] Résultats annuaire', { count: results.length });

      return results.map(company => ({
        siren: company.siren,
        siret: company.siret,
        name: company.name,
        address: company.address,
        postalCode: company.postal_code,
        city: company.city,
        country: company.country || 'FR',
        vatNumber: company.vat_number,
        active: company.active
      }));

    } catch (error) {
      logger.error('[PPF] ❌ Erreur recherche annuaire:', error);
      throw error;
    }
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================

  /**
   * Teste la connexion au PPF
   * @param {string} organizationId - ID organisation
   * @returns {Promise<Object>} - Résultat test
   */
  async testConnection(organizationId) {
    try {
      const token = await this.authenticate(organizationId);

      const response = await fetch(`${this.config.baseURL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('PPF inaccessible');
      }

      return {
        success: true,
        message: 'Connexion au PPF réussie',
        env: this.env,
        endpoint: this.config.baseURL
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
        env: this.env
      };
    }
  }
}

export default new PPFConnector();
