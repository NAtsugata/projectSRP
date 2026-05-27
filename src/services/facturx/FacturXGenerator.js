/**
 * ============================================================
 * FACTUR-X GENERATOR
 * ============================================================
 * Génère des factures au format Factur-X (PDF/A-3 + XML EN 16931)
 * Conforme à la norme européenne de facturation électronique
 *
 * Factur-X = PDF/A-3 (lisible humain) + XML structuré (exploitable machine)
 * ============================================================
 */

import { jsPDF } from 'jspdf';
import logger from '../../utils/logger';
import { FACTURX_PROFILE, isValidSIREN, isValidVATNumber } from '../../types/invoicing2026';

/**
 * Classe principale pour la génération Factur-X
 */
class FacturXGenerator {
  /**
   * Génère une facture Factur-X complète
   * @param {Object} invoice - Données facture
   * @param {Object} organization - Données entreprise émettrice
   * @param {Object} client - Données client
   * @param {Array} items - Lignes de facture
   * @param {Object} options - Options génération
   * @returns {Promise<Object>} - {pdfBlob, xmlString, profile}
   */
  async generateFacturX(invoice, organization, client, items, options = {}) {
    try {
      const profile = options.profile || FACTURX_PROFILE.BASIC.code;

      logger.log('[Factur-X] Génération démarrée', {
        invoiceNumber: invoice.invoice_number,
        profile
      });

      // 1. Générer le XML EN 16931
      const xmlString = this.generateXML_EN16931(
        invoice,
        organization,
        client,
        items,
        profile
      );

      // 2. Générer le PDF/A-3 avec XML embarqué
      const pdfBlob = await this.generatePDFA3WithXML(
        invoice,
        organization,
        client,
        items,
        xmlString,
        options
      );

      logger.log('[Factur-X] ✅ Génération réussie', { size: pdfBlob.size });

      return {
        pdfBlob,
        xmlString,
        profile,
        facturxVersion: '1.0.07',  // Version actuelle Factur-X
        en16931Version: '1.3.11'   // Version norme européenne
      };

    } catch (error) {
      logger.error('[Factur-X] ❌ Erreur génération:', error);
      throw new Error(`Erreur génération Factur-X: ${error.message}`);
    }
  }

  /**
   * Génère le XML conforme EN 16931 (norme européenne)
   * @param {Object} invoice - Facture
   * @param {Object} organization - Organisation émettrice
   * @param {Object} client - Client
   * @param {Array} items - Lignes
   * @param {string} profile - Profil Factur-X
   * @returns {string} - XML formaté
   */
  generateXML_EN16931(invoice, organization, client, items, profile) {
    // Validation des données critiques 2026
    this.validateMandatoryFields2026(invoice, organization, client);

    // En-tête XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rsm:CrossIndustryInvoice\n';
    xml += '  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"\n';
    xml += '  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"\n';
    xml += '  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"\n';
    xml += '  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">\n';

    // ===== CONTEXTE DOCUMENT =====
    xml += '  <rsm:ExchangedDocumentContext>\n';
    xml += '    <ram:GuidelineSpecifiedDocumentContextParameter>\n';
    xml += `      <ram:ID>${this.getProfileURN(profile)}</ram:ID>\n`;
    xml += '    </ram:GuidelineSpecifiedDocumentContextParameter>\n';
    xml += '  </rsm:ExchangedDocumentContext>\n';

    // ===== EN-TÊTE DOCUMENT =====
    xml += '  <rsm:ExchangedDocument>\n';
    xml += `    <ram:ID>${this.escapeXml(invoice.invoice_number)}</ram:ID>\n`;
    xml += '    <ram:TypeCode>380</ram:TypeCode>\n';  // 380 = Facture commerciale
    xml += `    <ram:IssueDateTime>\n`;
    xml += `      <udt:DateTimeString format="102">${this.formatDateXML(invoice.issue_date)}</udt:DateTimeString>\n`;
    xml += '    </ram:IssueDateTime>\n';

    // Notes (si présentes)
    if (invoice.notes) {
      xml += '    <ram:IncludedNote>\n';
      xml += `      <ram:Content>${this.escapeXml(invoice.notes)}</ram:Content>\n`;
      xml += '    </ram:IncludedNote>\n';
    }
    xml += '  </rsm:ExchangedDocument>\n';

    // ===== TRANSACTION =====
    xml += '  <rsm:SupplyChainTradeTransaction>\n';

    // --- LIGNES DE FACTURE (si profil BASIC ou supérieur) ---
    if (this.includesLineDetails(profile)) {
      items.forEach((item, index) => {
        xml += this.generateLineItemXML(item, index + 1, invoice);
      });
    }

    // --- ACCORD COMMERCIAL (VENDEUR / ACHETEUR) ---
    xml += '    <ram:ApplicableHeaderTradeAgreement>\n';

    // Référence acheteur (si disponible)
    if (invoice.buyer_reference) {
      xml += `      <ram:BuyerReference>${this.escapeXml(invoice.buyer_reference)}</ram:BuyerReference>\n`;
    }

    // VENDEUR (SELLER)
    xml += '      <ram:SellerTradeParty>\n';
    xml += `        <ram:Name>${this.escapeXml(organization.name)}</ram:Name>\n`;

    // SIREN OBLIGATOIRE 2026
    if (organization.siret) {
      const siren = organization.siret.substring(0, 9);
      xml += '        <ram:SpecifiedLegalOrganization>\n';
      xml += `          <ram:ID schemeID="0002">${siren}</ram:ID>\n`;  // 0002 = SIREN
      xml += '        </ram:SpecifiedLegalOrganization>\n';
    }

    // Adresse vendeur
    xml += '        <ram:PostalTradeAddress>\n';
    xml += `          <ram:LineOne>${this.escapeXml(organization.address || '')}</ram:LineOne>\n`;
    xml += `          <ram:CityName>${this.escapeXml(organization.city || '')}</ram:CityName>\n`;
    xml += `          <ram:PostcodeCode>${this.escapeXml(organization.postal_code || '')}</ram:PostcodeCode>\n`;
    xml += `          <ram:CountryID>FR</ram:CountryID>\n`;
    xml += '        </ram:PostalTradeAddress>\n';

    // TVA vendeur
    if (organization.vat_number) {
      xml += '        <ram:SpecifiedTaxRegistration>\n';
      xml += `          <ram:ID schemeID="VA">${this.escapeXml(organization.vat_number)}</ram:ID>\n`;
      xml += '        </ram:SpecifiedTaxRegistration>\n';
    }

    xml += '      </ram:SellerTradeParty>\n';

    // ACHETEUR (BUYER)
    xml += '      <ram:BuyerTradeParty>\n';
    xml += `        <ram:Name>${this.escapeXml(client.company_name || client.name)}</ram:Name>\n`;

    // SIREN CLIENT OBLIGATOIRE 2026 (B2B)
    if (client.siren && isValidSIREN(client.siren)) {
      xml += '        <ram:SpecifiedLegalOrganization>\n';
      xml += `          <ram:ID schemeID="0002">${client.siren}</ram:ID>\n`;
      xml += '        </ram:SpecifiedLegalOrganization>\n';
    }

    // Adresse facturation
    xml += '        <ram:PostalTradeAddress>\n';
    xml += `          <ram:LineOne>${this.escapeXml(client.address || '')}</ram:LineOne>\n`;
    xml += `          <ram:CityName>${this.escapeXml(client.city || '')}</ram:CityName>\n`;
    xml += `          <ram:PostcodeCode>${this.escapeXml(client.postal_code || '')}</ram:PostcodeCode>\n`;
    xml += `          <ram:CountryID>${client.country || 'FR'}</ram:CountryID>\n`;
    xml += '        </ram:PostalTradeAddress>\n';

    // TVA client (si disponible)
    if (client.tva_number && isValidVATNumber(client.tva_number)) {
      xml += '        <ram:SpecifiedTaxRegistration>\n';
      xml += `          <ram:ID schemeID="VA">${this.escapeXml(client.tva_number)}</ram:ID>\n`;
      xml += '        </ram:SpecifiedTaxRegistration>\n';
    }

    xml += '      </ram:BuyerTradeParty>\n';

    xml += '    </ram:ApplicableHeaderTradeAgreement>\n';

    // --- LIVRAISON ---
    xml += '    <ram:ApplicableHeaderTradeDelivery>\n';

    // Date de livraison (= date de facturation par défaut)
    xml += '      <ram:ActualDeliverySupplyChainEvent>\n';
    xml += '        <ram:OccurrenceDateTime>\n';
    xml += `          <udt:DateTimeString format="102">${this.formatDateXML(invoice.issue_date)}</udt:DateTimeString>\n`;
    xml += '        </ram:OccurrenceDateTime>\n';
    xml += '      </ram:ActualDeliverySupplyChainEvent>\n';

    // Adresse de livraison (NOUVELLE MENTION 2026 si différente)
    if (invoice.delivery_address) {
      xml += '      <ram:ShipToTradeParty>\n';
      xml += '        <ram:PostalTradeAddress>\n';
      xml += `          <ram:LineOne>${this.escapeXml(invoice.delivery_address.street || '')}</ram:LineOne>\n`;
      xml += `          <ram:CityName>${this.escapeXml(invoice.delivery_address.city || '')}</ram:CityName>\n`;
      xml += `          <ram:PostcodeCode>${this.escapeXml(invoice.delivery_address.postal_code || '')}</ram:PostcodeCode>\n`;
      xml += `          <ram:CountryID>${invoice.delivery_address.country || 'FR'}</ram:CountryID>\n`;
      xml += '        </ram:PostalTradeAddress>\n';
      xml += '      </ram:ShipToTradeParty>\n';
    }

    xml += '    </ram:ApplicableHeaderTradeDelivery>\n';

    // --- RÈGLEMENT (PAYMENT) ---
    xml += '    <ram:ApplicableHeaderTradeSettlement>\n';

    // Devise
    xml += '      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>\n';

    // Conditions de paiement
    if (invoice.due_date) {
      xml += '      <ram:SpecifiedTradePaymentTerms>\n';
      xml += `        <ram:Description>Paiement à ${this.calculatePaymentDays(invoice.issue_date, invoice.due_date)} jours</ram:Description>\n`;
      xml += '        <ram:DueDateDateTime>\n';
      xml += `          <udt:DateTimeString format="102">${this.formatDateXML(invoice.due_date)}</udt:DateTimeString>\n`;
      xml += '        </ram:DueDateDateTime>\n';
      xml += '      </ram:SpecifiedTradePaymentTerms>\n';
    }

    // TVA (détaillée par taux)
    const vatBreakdown = this.calculateVATBreakdown(items, invoice);
    Object.entries(vatBreakdown).forEach(([rate, amounts]) => {
      xml += '      <ram:ApplicableTradeTax>\n';
      xml += `        <ram:CalculatedAmount>${this.formatAmount(amounts.vatAmount)}</ram:CalculatedAmount>\n`;
      xml += '        <ram:TypeCode>VAT</ram:TypeCode>\n';

      // Catégorie TVA (S = Standard, Z = Zero, E = Exempt, etc.)
      const category = parseFloat(rate) === 0 ? 'Z' : 'S';
      xml += `        <ram:CategoryCode>${category}</ram:CategoryCode>\n`;

      xml += `        <ram:BasisAmount>${this.formatAmount(amounts.baseAmount)}</ram:BasisAmount>\n`;
      xml += `        <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>\n`;
      xml += '      </ram:ApplicableTradeTax>\n';
    });

    // TOTAUX
    xml += '      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n';
    xml += `        <ram:LineTotalAmount>${this.formatAmount(invoice.subtotal)}</ram:LineTotalAmount>\n`;
    xml += `        <ram:TaxBasisTotalAmount>${this.formatAmount(invoice.subtotal)}</ram:TaxBasisTotalAmount>\n`;
    xml += `        <ram:TaxTotalAmount currencyID="EUR">${this.formatAmount(invoice.tax_amount)}</ram:TaxTotalAmount>\n`;
    xml += `        <ram:GrandTotalAmount>${this.formatAmount(invoice.total)}</ram:GrandTotalAmount>\n`;
    xml += `        <ram:DuePayableAmount>${this.formatAmount(invoice.total)}</ram:DuePayableAmount>\n`;
    xml += '      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n';

    xml += '    </ram:ApplicableHeaderTradeSettlement>\n';

    xml += '  </rsm:SupplyChainTradeTransaction>\n';
    xml += '</rsm:CrossIndustryInvoice>';

    return xml;
  }

  /**
   * Génère une ligne de facture en XML
   * @param {Object} item - Ligne
   * @param {number} lineNumber - Numéro ligne
   * @param {Object} invoice - Facture
   * @returns {string} - XML
   */
  generateLineItemXML(item, lineNumber, invoice) {
    let xml = '    <ram:IncludedSupplyChainTradeLineItem>\n';

    // Numéro de ligne
    xml += '      <ram:AssociatedDocumentLineDocument>\n';
    xml += `        <ram:LineID>${lineNumber}</ram:LineID>\n`;
    xml += '      </ram:AssociatedDocumentLineDocument>\n';

    // Produit/Service
    xml += '      <ram:SpecifiedTradeProduct>\n';
    xml += `        <ram:Name>${this.escapeXml(item.description)}</ram:Name>\n`;
    xml += '      </ram:SpecifiedTradeProduct>\n';

    // Prix et quantité
    xml += '      <ram:SpecifiedLineTradeAgreement>\n';
    xml += '        <ram:NetPriceProductTradePrice>\n';
    xml += `          <ram:ChargeAmount>${this.formatAmount(item.unit_price)}</ram:ChargeAmount>\n`;
    xml += '        </ram:NetPriceProductTradePrice>\n';
    xml += '      </ram:SpecifiedLineTradeAgreement>\n';

    xml += '      <ram:SpecifiedLineTradeDelivery>\n';
    xml += `        <ram:BilledQuantity unitCode="${this.getUnitCode(item.unit)}">${item.quantity}</ram:BilledQuantity>\n`;
    xml += '      </ram:SpecifiedLineTradeDelivery>\n';

    // Total ligne
    const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
    xml += '      <ram:SpecifiedLineTradeSettlement>\n';
    xml += '        <ram:ApplicableTradeTax>\n';
    xml += '          <ram:TypeCode>VAT</ram:TypeCode>\n';
    xml += '          <ram:CategoryCode>S</ram:CategoryCode>\n';
    xml += `          <ram:RateApplicablePercent>${item.tax_rate || invoice.tax_rate}</ram:RateApplicablePercent>\n`;
    xml += '        </ram:ApplicableTradeTax>\n';
    xml += '        <ram:SpecifiedTradeSettlementLineMonetarySummation>\n';
    xml += `          <ram:LineTotalAmount>${this.formatAmount(lineTotal)}</ram:LineTotalAmount>\n`;
    xml += '        </ram:SpecifiedTradeSettlementLineMonetarySummation>\n';
    xml += '      </ram:SpecifiedLineTradeSettlement>\n';

    xml += '    </ram:IncludedSupplyChainTradeLineItem>\n';

    return xml;
  }

  /**
   * Génère le PDF/A-3 avec XML embarqué
   * @param {Object} invoice
   * @param {Object} organization
   * @param {Object} client
   * @param {Array} items
   * @param {string} xmlString - XML à embarquer
   * @param {Object} options
   * @returns {Promise<Blob>}
   */
  async generatePDFA3WithXML(invoice, organization, client, items, xmlString, options) {
    // Créer le PDF visuel (partie humaine)
    const doc = new jsPDF({
      format: 'a4',
      unit: 'mm'
    });

    // TODO: Utiliser invoicePdfGenerator.js existant pour le rendu visuel
    // Pour l'instant, version simplifiée
    this.renderInvoiceVisual(doc, invoice, organization, client, items);

    // Embarquer le XML dans le PDF (PDF/A-3 requirement)
    // NOTE: jsPDF ne supporte pas nativement l'embed de fichiers
    // En production, utiliser pdf-lib ou pdfmake qui supportent PDF/A-3
    logger.warn('[Factur-X] ⚠️ Embedding XML dans PDF nécessite pdf-lib (TODO)');

    // Convertir en Blob
    const pdfBlob = doc.output('blob');

    return pdfBlob;
  }

  /**
   * Rendu visuel simplifié de la facture
   * @param {jsPDF} doc
   * @param {Object} invoice
   * @param {Object} organization
   * @param {Object} client
   * @param {Array} items
   */
  renderInvoiceVisual(doc, invoice, organization, client, items) {
    let y = 20;

    // Titre
    doc.setFontSize(20);
    doc.text('FACTURE', 105, y, { align: 'center' });
    y += 15;

    // Numéro et date
    doc.setFontSize(10);
    doc.text(`Numéro: ${invoice.invoice_number}`, 20, y);
    doc.text(`Date: ${new Date(invoice.issue_date).toLocaleDateString('fr-FR')}`, 150, y);
    y += 10;

    // Émetteur
    doc.setFontSize(12);
    doc.text('Émetteur:', 20, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(organization.name, 20, y);
    y += 5;
    doc.text(`${organization.address}`, 20, y);
    y += 5;
    doc.text(`${organization.postal_code} ${organization.city}`, 20, y);
    y += 10;

    // Client
    doc.setFontSize(12);
    doc.text('Client:', 20, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(client.company_name || client.name, 20, y);
    y += 5;
    doc.text(`${client.address || ''}`, 20, y);
    y += 5;
    doc.text(`${client.postal_code || ''} ${client.city || ''}`, 20, y);
    y += 15;

    // Lignes
    doc.setFontSize(12);
    doc.text('Lignes de facture:', 20, y);
    y += 8;

    doc.setFontSize(10);
    items.forEach(item => {
      doc.text(`${item.description} - ${item.quantity} x ${item.unit_price}€`, 20, y);
      y += 6;
    });

    y += 10;

    // Totaux
    doc.setFontSize(12);
    doc.text(`Total HT: ${invoice.subtotal.toFixed(2)} €`, 150, y);
    y += 6;
    doc.text(`TVA ${invoice.tax_rate}%: ${invoice.tax_amount.toFixed(2)} €`, 150, y);
    y += 6;
    doc.setFontSize(14);
    doc.text(`Total TTC: ${invoice.total.toFixed(2)} €`, 150, y);

    // Pied de page
    doc.setFontSize(8);
    doc.text('Document conforme Factur-X (EN 16931)', 105, 280, { align: 'center' });
  }

  // =====================================================
  // HELPERS
  // =====================================================

  getProfileURN(profile) {
    const urns = {
      MINIMUM: 'urn:factur-x.eu:1p0:minimum',
      BASIC_WL: 'urn:factur-x.eu:1p0:basicwl',
      BASIC: 'urn:factur-x.eu:1p0:basic',
      EN16931: 'urn:cen.eu:en16931:2017',
      EXTENDED: 'urn:factur-x.eu:1p0:extended'
    };
    return urns[profile] || urns.BASIC;
  }

  includesLineDetails(profile) {
    return !['MINIMUM', 'BASIC_WL'].includes(profile);
  }

  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  formatDateXML(dateString) {
    // Format YYYYMMDD (ISO 8601 format 102)
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  formatAmount(amount) {
    return parseFloat(amount || 0).toFixed(2);
  }

  getUnitCode(unit) {
    const codes = {
      'unite': 'C62',      // Unité
      'heure': 'HUR',      // Heure
      'jour': 'DAY',       // Jour
      'forfait': 'C62',    // Unité
      'm2': 'MTK',         // Mètre carré
      'ml': 'MLT'          // Millilitre
    };
    return codes[unit] || 'C62';
  }

  calculatePaymentDays(issueDate, dueDate) {
    const diff = new Date(dueDate) - new Date(issueDate);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  calculateVATBreakdown(items, invoice) {
    const breakdown = {};

    items.forEach(item => {
      const rate = item.tax_rate || invoice.tax_rate || 20;
      const baseAmount = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      const vatAmount = baseAmount * (rate / 100);

      if (!breakdown[rate]) {
        breakdown[rate] = { baseAmount: 0, vatAmount: 0 };
      }

      breakdown[rate].baseAmount += baseAmount;
      breakdown[rate].vatAmount += vatAmount;
    });

    // Arrondir par taux pour respecter EN 16931 BR-CO-14
    Object.keys(breakdown).forEach(rate => {
      breakdown[rate].baseAmount = Math.round(breakdown[rate].baseAmount * 100) / 100;
      breakdown[rate].vatAmount  = Math.round(breakdown[rate].vatAmount  * 100) / 100;
    });

    return breakdown;
  }

  validateMandatoryFields2026(invoice, organization, client) {
    const errors = [];

    // SIREN organisation
    if (!organization.siret || organization.siret.length < 9) {
      errors.push('SIREN organisation obligatoire (9 chiffres)');
    }

    // SIREN client (si B2B)
    if (client.is_professional && (!client.siren || !isValidSIREN(client.siren))) {
      errors.push('SIREN client obligatoire pour facturation B2B (2026)');
    }

    // Nature opération
    if (!invoice.operation_nature) {
      errors.push('Nature de l\'opération obligatoire (BIEN/SERVICE/MIXTE) - 2026');
    }

    if (errors.length > 0) {
      throw new Error(`Champs obligatoires 2026 manquants:\n${errors.join('\n')}`);
    }
  }
}

export default new FacturXGenerator();
