/**
 * ============================================================
 * E-REPORTING SERVICE
 * ============================================================
 * Gestion de la transmission des données de facturation B2C et internationale
 * conformément aux obligations 2026
 *
 * Flux concernés:
 * - B2C (ventes particuliers)
 * - Exportations (hors UE)
 * - Opérations intracommunautaires
 * - Flux de paiements (TVA encaissement)
 *
 * Fréquences selon régime TVA:
 * - Réel Normal: Tous les 10 jours (décade)
 * - Réel Simplifié: Mensuel
 * - Franchise en base: Bimestriel
 * ============================================================
 */

import { supabase } from '../../lib/supabaseClient';
import logger from '../../utils/logger';
import {
  EREPORTING_TYPE,
  EREPORTING_FREQUENCY,
  requiresEReporting,
  getEReportingType
} from '../../types/invoicing2026';

class EReportingService {
  constructor() {
    this.ppfConnector = null; // Sera initialisé avec PPFConnector si besoin
  }

  // =====================================================
  // DÉTECTION FLUX E-REPORTING
  // =====================================================

  /**
   * Identifie les factures nécessitant e-reporting
   * @param {string} organizationId - ID organisation
   * @param {Date} startDate - Date début période
   * @param {Date} endDate - Date fin période
   * @returns {Promise<Object>} - Factures par type
   */
  async identifyReportableInvoices(organizationId, startDate, endDate) {
    try {
      logger.log('[E-Reporting] Identification factures à rapporter', {
        organizationId,
        period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`
      });

      // Récupérer toutes les factures de la période
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (*)
        `)
        .eq('organization_id', organizationId)
        .gte('issue_date', startDate.toISOString().split('T')[0])
        .lte('issue_date', endDate.toISOString().split('T')[0])
        .in('status', ['sent', 'paid']);

      if (error) throw error;

      // Classifier par type
      const classification = {
        b2c: [],
        export: [],
        intra_eu: [],
        payment_flows: [],
        no_reporting: []
      };

      for (const invoice of invoices || []) {
        if (requiresEReporting(invoice, invoice.client)) {
          const reportType = getEReportingType(invoice, invoice.client);

          if (reportType === EREPORTING_TYPE.B2C.code) {
            classification.b2c.push(invoice);
          } else if (reportType === EREPORTING_TYPE.EXPORT.code) {
            classification.export.push(invoice);
          } else if (reportType === EREPORTING_TYPE.INTRA_EU.code) {
            classification.intra_eu.push(invoice);
          }

          // Marquer pour e-reporting si pas déjà fait
          if (!invoice.ereporting_required) {
            await supabase
              .from('invoices')
              .update({
                ereporting_required: true,
                ereporting_type: reportType,
                ereporting_status: 'PENDING'
              })
              .eq('id', invoice.id);
          }

        } else {
          classification.no_reporting.push(invoice);
        }
      }

      logger.log('[E-Reporting] Classification terminée', {
        b2c: classification.b2c.length,
        export: classification.export.length,
        intra_eu: classification.intra_eu.length
      });

      return classification;

    } catch (error) {
      logger.error('[E-Reporting] ❌ Erreur identification:', error);
      throw error;
    }
  }

  // =====================================================
  // E-REPORTING B2C (PARTICULIERS)
  // =====================================================

  /**
   * Génère et envoie le rapport B2C
   * @param {string} organizationId - ID organisation
   * @param {Date} startDate - Début période
   * @param {Date} endDate - Fin période
   * @returns {Promise<Object>} - Résultat envoi
   */
  async reportB2CTransactions(organizationId, startDate, endDate) {
    try {
      logger.log('[E-Reporting] Rapport B2C', {
        organizationId,
        period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`
      });

      // Récupérer factures B2C de la période
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (*)
        `)
        .eq('organization_id', organizationId)
        .eq('ereporting_type', EREPORTING_TYPE.B2C.code)
        .eq('ereporting_status', 'PENDING')
        .gte('issue_date', startDate.toISOString().split('T')[0])
        .lte('issue_date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        return {
          success: true,
          message: 'Aucune transaction B2C à rapporter',
          count: 0
        };
      }

      // Agréger les données (Z de caisse)
      const aggregatedData = this.aggregateB2CData(invoices);

      // Générer le fichier de reporting
      const reportData = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        reportType: 'B2C',
        transactions: aggregatedData,
        totals: {
          invoiceCount: invoices.length,
          totalHT: aggregatedData.reduce((sum, t) => sum + t.montant_ht, 0),
          totalTVA: aggregatedData.reduce((sum, t) => sum + t.montant_tva, 0),
          totalTTC: aggregatedData.reduce((sum, t) => sum + t.montant_ttc, 0)
        }
      };

      // Envoyer via PPF/PDP
      const result = await this.sendReportToPPF(organizationId, reportData);

      // Marquer factures comme rapportées
      for (const invoice of invoices) {
        await supabase
          .from('invoices')
          .update({
            ereporting_status: 'SENT',
            ereporting_sent_at: new Date().toISOString()
          })
          .eq('id', invoice.id);
      }

      logger.log('[E-Reporting] ✅ Rapport B2C envoyé', {
        invoiceCount: invoices.length,
        totalTTC: reportData.totals.totalTTC
      });

      return {
        success: true,
        count: invoices.length,
        totals: reportData.totals,
        depositId: result.depositId
      };

    } catch (error) {
      logger.error('[E-Reporting] ❌ Erreur rapport B2C:', error);

      // Marquer erreur
      await supabase
        .from('invoices')
        .update({ ereporting_status: 'FAILED' })
        .eq('organization_id', organizationId)
        .eq('ereporting_type', EREPORTING_TYPE.B2C.code)
        .eq('ereporting_status', 'PENDING');

      throw error;
    }
  }

  /**
   * Agrège les données B2C (Z de caisse quotidien)
   * @param {Array} invoices - Factures
   * @returns {Array} - Données agrégées par jour
   */
  aggregateB2CData(invoices) {
    const byDay = {};

    for (const invoice of invoices) {
      const day = invoice.issue_date;

      if (!byDay[day]) {
        byDay[day] = {
          date: day,
          count: 0,
          montant_ht: 0,
          montant_tva: 0,
          montant_ttc: 0
        };
      }

      byDay[day].count++;
      byDay[day].montant_ht += parseFloat(invoice.subtotal || 0);
      byDay[day].montant_tva += parseFloat(invoice.tax_amount || 0);
      byDay[day].montant_ttc += parseFloat(invoice.total || 0);
    }

    return Object.values(byDay);
  }

  // =====================================================
  // E-REPORTING INTERNATIONAL
  // =====================================================

  /**
   * Génère et envoie le rapport pour opérations internationales
   * @param {string} organizationId - ID organisation
   * @param {Date} startDate - Début période
   * @param {Date} endDate - Fin période
   * @returns {Promise<Object>} - Résultat envoi
   */
  async reportInternationalTransactions(organizationId, startDate, endDate) {
    try {
      logger.log('[E-Reporting] Rapport International', {
        organizationId,
        period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`
      });

      // Récupérer factures internationales
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients!client_id (*)
        `)
        .eq('organization_id', organizationId)
        .in('ereporting_type', [EREPORTING_TYPE.EXPORT.code, EREPORTING_TYPE.INTRA_EU.code])
        .eq('ereporting_status', 'PENDING')
        .gte('issue_date', startDate.toISOString().split('T')[0])
        .lte('issue_date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        return {
          success: true,
          message: 'Aucune transaction internationale à rapporter',
          count: 0
        };
      }

      // Séparer par type
      const exports = invoices.filter(i => i.ereporting_type === EREPORTING_TYPE.EXPORT.code);
      const intraEU = invoices.filter(i => i.ereporting_type === EREPORTING_TYPE.INTRA_EU.code);

      const reportData = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        reportType: 'INTERNATIONAL',
        exports: exports.map(inv => ({
          invoice_number: inv.invoice_number,
          date: inv.issue_date,
          client_name: inv.client?.name,
          client_country: inv.client?.country,
          montant_ht: inv.subtotal,
          montant_ttc: inv.total,
          vat_mode: inv.vat_mode || 'EXEMPT'
        })),
        intra_eu: intraEU.map(inv => ({
          invoice_number: inv.invoice_number,
          date: inv.issue_date,
          client_name: inv.client?.company_name || inv.client?.name,
          client_country: inv.client?.country,
          client_vat: inv.client?.tva_number,
          montant_ht: inv.subtotal,
          montant_ttc: inv.total,
          vat_mode: inv.vat_mode || 'AUTOLIQUIDATION'
        })),
        totals: {
          exportCount: exports.length,
          intraEUCount: intraEU.length,
          totalExportHT: exports.reduce((sum, inv) => sum + parseFloat(inv.subtotal || 0), 0),
          totalIntraEUHT: intraEU.reduce((sum, inv) => sum + parseFloat(inv.subtotal || 0), 0)
        }
      };

      // Envoyer via PPF/PDP
      const result = await this.sendReportToPPF(organizationId, reportData);

      // Marquer factures comme rapportées
      for (const invoice of invoices) {
        await supabase
          .from('invoices')
          .update({
            ereporting_status: 'SENT',
            ereporting_sent_at: new Date().toISOString()
          })
          .eq('id', invoice.id);
      }

      logger.log('[E-Reporting] ✅ Rapport International envoyé', {
        exportCount: exports.length,
        intraEUCount: intraEU.length
      });

      return {
        success: true,
        count: invoices.length,
        exports: exports.length,
        intraEU: intraEU.length,
        totals: reportData.totals,
        depositId: result.depositId
      };

    } catch (error) {
      logger.error('[E-Reporting] ❌ Erreur rapport International:', error);
      throw error;
    }
  }

  // =====================================================
  // FLUX DE PAIEMENTS (TVA ENCAISSEMENT)
  // =====================================================

  /**
   * Rapporte les flux de paiements pour TVA sur encaissement
   * @param {string} organizationId - ID organisation
   * @param {Date} startDate - Début période
   * @param {Date} endDate - Fin période
   * @returns {Promise<Object>} - Résultat
   */
  async reportPaymentFlows(organizationId, startDate, endDate) {
    try {
      logger.log('[E-Reporting] Rapport Flux Paiements', {
        organizationId,
        period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`
      });

      // Récupérer factures payées durant la période
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'paid')
        .gte('paid_date', startDate.toISOString().split('T')[0])
        .lte('paid_date', endDate.toISOString().split('T')[0]);

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        return {
          success: true,
          message: 'Aucun paiement à rapporter',
          count: 0
        };
      }

      const paymentFlows = invoices.map(inv => ({
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        paid_date: inv.paid_date,
        payment_method: inv.payment_method,
        payment_reference: inv.payment_reference,
        montant_ht: inv.subtotal,
        montant_tva: inv.tax_amount,
        montant_ttc: inv.total
      }));

      const reportData = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        },
        reportType: 'PAYMENT_FLOWS',
        payments: paymentFlows,
        totals: {
          paymentCount: invoices.length,
          totalPaidHT: invoices.reduce((sum, inv) => sum + parseFloat(inv.subtotal || 0), 0),
          totalPaidTVA: invoices.reduce((sum, inv) => sum + parseFloat(inv.tax_amount || 0), 0),
          totalPaidTTC: invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0)
        }
      };

      // Envoyer via PPF/PDP
      const result = await this.sendReportToPPF(organizationId, reportData);

      logger.log('[E-Reporting] ✅ Flux paiements envoyés', {
        paymentCount: invoices.length,
        totalTVA: reportData.totals.totalPaidTVA
      });

      return {
        success: true,
        count: invoices.length,
        totals: reportData.totals,
        depositId: result.depositId
      };

    } catch (error) {
      logger.error('[E-Reporting] ❌ Erreur rapport paiements:', error);
      throw error;
    }
  }

  // =====================================================
  // ENVOI PPF
  // =====================================================

  /**
   * Envoie un rapport e-reporting au PPF
   * @param {string} organizationId - ID organisation
   * @param {Object} reportData - Données du rapport
   * @returns {Promise<Object>} - Résultat envoi
   */
  async sendReportToPPF(organizationId, reportData) {
    try {
      // TODO: Utiliser PPFConnector pour envoi réel
      // Pour l'instant, simulation

      logger.log('[E-Reporting] Envoi rapport au PPF (SIMULATION)', {
        reportType: reportData.reportType,
        period: reportData.period
      });

      // En production, appel API PPF
      // const ppfConnector = await import('../ppf/PPFConnector');
      // const result = await ppfConnector.default.sendEReport(organizationId, reportData);

      // Simulation
      const depositId = `EREPORT-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      return {
        success: true,
        depositId,
        status: 'SENT'
      };

    } catch (error) {
      logger.error('[E-Reporting] ❌ Erreur envoi PPF:', error);
      throw error;
    }
  }

  // =====================================================
  // PLANIFICATION AUTOMATIQUE
  // =====================================================

  /**
   * Calcule la prochaine période e-reporting selon le régime TVA
   * @param {string} vatRegime - Régime: REAL_NORMAL, REAL_SIMPLIFIED, FRANCHISE
   * @param {Date} lastReportDate - Date dernier rapport (optionnel)
   * @returns {Object} - {startDate, endDate, deadline}
   */
  calculateNextReportingPeriod(vatRegime, lastReportDate = null) {
    const now = new Date();
    const frequency = EREPORTING_FREQUENCY[vatRegime];

    if (!frequency) {
      throw new Error(`Régime TVA inconnu: ${vatRegime}`);
    }

    let startDate, endDate, deadline;

    switch (frequency.frequency) {
      case 'DECADE':  // Tous les 10 jours
        const currentDay = now.getDate();
        if (currentDay <= 10) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 10);
        } else if (currentDay <= 20) {
          startDate = new Date(now.getFullYear(), now.getMonth(), 11);
          endDate = new Date(now.getFullYear(), now.getMonth(), 20);
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 21);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Dernier jour du mois
        }
        deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + frequency.delay);
        break;

      case 'MONTHLY':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Dernier jour mois précédent
        deadline = new Date(now.getFullYear(), now.getMonth(), frequency.delay);
        break;

      case 'BIMONTHLY':
        const currentMonth = now.getMonth();
        const periodStart = currentMonth % 2 === 0 ? currentMonth - 2 : currentMonth - 1;
        startDate = new Date(now.getFullYear(), periodStart, 1);
        endDate = new Date(now.getFullYear(), periodStart + 2, 0);
        deadline = new Date(endDate);
        deadline.setDate(deadline.getDate() + frequency.delay);
        break;

      default:
        throw new Error(`Fréquence inconnue: ${frequency.frequency}`);
    }

    return {
      startDate,
      endDate,
      deadline,
      frequency: frequency.frequency,
      description: frequency.description
    };
  }

  /**
   * Vérifie si un rapport est dû
   * @param {string} organizationId - ID organisation
   * @returns {Promise<Object>} - Rapport dû ou null
   */
  async checkDueReport(organizationId) {
    try {
      // Récupérer régime TVA de l'organisation
      const { data: org, error } = await supabase
        .from('organizations')
        .select('einvoicing_settings')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      const vatRegime = org.einvoicing_settings?.vat_regime || 'REAL_SIMPLIFIED';

      // Calculer prochaine période
      const period = this.calculateNextReportingPeriod(vatRegime);

      // Vérifier si deadline dépassée
      const now = new Date();
      if (now > period.deadline) {
        logger.warn('[E-Reporting] ⚠️ Rapport en retard !', {
          period: `${period.startDate.toISOString().split('T')[0]} - ${period.endDate.toISOString().split('T')[0]}`,
          deadline: period.deadline.toISOString().split('T')[0]
        });

        return {
          due: true,
          overdue: true,
          period,
          daysLate: Math.ceil((now - period.deadline) / (1000 * 60 * 60 * 24))
        };
      } else if (now >= period.endDate && now <= period.deadline) {
        logger.log('[E-Reporting] Rapport à envoyer', {
          period: `${period.startDate.toISOString().split('T')[0]} - ${period.endDate.toISOString().split('T')[0]}`,
          deadline: period.deadline.toISOString().split('T')[0]
        });

        return {
          due: true,
          overdue: false,
          period,
          daysRemaining: Math.ceil((period.deadline - now) / (1000 * 60 * 60 * 24))
        };
      }

      return {
        due: false,
        period,
        nextDeadline: period.deadline
      };

    } catch (error) {
      logger.error('[E-Reporting] ❌ Erreur vérification rapport dû:', error);
      throw error;
    }
  }
}

export default new EReportingService();
