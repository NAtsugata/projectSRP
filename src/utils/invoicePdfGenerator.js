// src/utils/invoicePdfGenerator.js
// Generateur de PDF pour factures et devis

import { jsPDF } from 'jspdf';
import logger from './logger';

// Constantes de mise en page
const MARGIN = 15;
const LINE_HEIGHT = 6;
const COLORS = {
  primary: [59, 130, 246], // Bleu
  text: [31, 41, 55],
  gray: [107, 114, 128],
  lightGray: [229, 231, 235],
  success: [34, 197, 94],
  warning: [234, 179, 8],
  danger: [239, 68, 68],
};

/**
 * Formate un montant en euros
 * @param {number} amount - Montant
 * @returns {string} - Montant formate
 */
const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount || 0);
};

/**
 * Formate une date en francais
 * @param {string} date - Date ISO
 * @returns {string} - Date formatee
 */
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Genere un PDF de facture
 * @param {Object} invoice - Donnees de la facture
 * @param {Object} organization - Informations de l'organisation
 * @param {Object} client - Informations du client
 * @returns {Blob} - PDF sous forme de Blob
 */
export function generateInvoicePDF(invoice, organization = {}, client = {}) {
  logger.log('[PDF] Generation de la facture:', invoice?.invoice_number);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  // Fonction utilitaire pour dessiner du texte
  const drawText = (text, x, yPos, options = {}) => {
    const { size = 10, bold = false, color = COLORS.text, align = 'left' } = options;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(text, x, yPos, { align });
    return yPos + LINE_HEIGHT;
  };

  // Fonction pour dessiner une ligne horizontale
  const drawLine = (yPos, color = COLORS.lightGray) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
    return yPos + 3;
  };

  // === EN-TETE ===
  // Titre FACTURE
  y = drawText('FACTURE', pageWidth / 2, y + 5, {
    size: 24,
    bold: true,
    color: COLORS.primary,
    align: 'center',
  });

  // Numero de facture
  y = drawText(invoice?.invoice_number || 'FAC-XXXX', pageWidth / 2, y + 2, {
    size: 14,
    bold: true,
    align: 'center',
  });

  y += 10;

  // === INFORMATIONS EMETTEUR (gauche) ===
  const leftX = MARGIN;
  let leftY = y;

  leftY = drawText(organization?.name || 'Votre entreprise', leftX, leftY, {
    size: 12,
    bold: true,
  });

  if (organization?.address) {
    leftY = drawText(organization.address, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.postal_code || organization?.city) {
    leftY = drawText(
      `${organization.postal_code || ''} ${organization.city || ''}`.trim(),
      leftX,
      leftY,
      { size: 9, color: COLORS.gray }
    );
  }
  if (organization?.phone) {
    leftY = drawText(`Tel: ${organization.phone}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.email) {
    leftY = drawText(organization.email, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.siret) {
    leftY = drawText(`SIRET: ${organization.siret}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.vat_number || organization?.tva_number) {
    leftY = drawText(`TVA: ${organization.vat_number || organization.tva_number}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.rcs) {
    leftY = drawText(`RCS: ${organization.rcs}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.ape_code) {
    leftY = drawText(`APE: ${organization.ape_code}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.legal_form && organization?.share_capital) {
    leftY = drawText(`${organization.legal_form} au capital de ${organization.share_capital}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }

  // === INFORMATIONS CLIENT (droite) ===
  const rightX = pageWidth - MARGIN - 70;
  let rightY = y;

  // Cadre pour le client
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX - 5, rightY - 5, 75, 40, 2, 2, 'F');

  rightY = drawText('FACTURER A:', rightX, rightY, { size: 8, color: COLORS.gray });

  const clientData = client || invoice?.client || {};
  rightY = drawText(clientData.name || clientData.company_name || '-', rightX, rightY, {
    size: 11,
    bold: true,
  });

  if (clientData.company_name && clientData.name !== clientData.company_name) {
    rightY = drawText(clientData.company_name, rightX, rightY, { size: 9 });
  }
  if (clientData.address) {
    rightY = drawText(clientData.address, rightX, rightY, { size: 9, color: COLORS.gray });
  }
  if (clientData.postal_code || clientData.city) {
    rightY = drawText(
      `${clientData.postal_code || ''} ${clientData.city || ''}`.trim(),
      rightX,
      rightY,
      { size: 9, color: COLORS.gray }
    );
  }
  if (clientData.email) {
    rightY = drawText(clientData.email, rightX, rightY, { size: 9, color: COLORS.gray });
  }

  y = Math.max(leftY, rightY) + 10;

  // === DATES ET STATUT ===
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y - 3, pageWidth - MARGIN * 2, 20, 2, 2, 'F');

  const dateY = y + 5;
  drawText('Date emission:', MARGIN + 5, dateY, { size: 9, color: COLORS.gray });
  drawText(formatDate(invoice?.issue_date), MARGIN + 35, dateY, { size: 9, bold: true });

  drawText('Date echeance:', MARGIN + 75, dateY, { size: 9, color: COLORS.gray });
  drawText(formatDate(invoice?.due_date), MARGIN + 105, dateY, { size: 9, bold: true });

  // Statut
  const statusColors = {
    draft: COLORS.gray,
    sent: COLORS.warning,
    paid: COLORS.success,
    overdue: COLORS.danger,
    cancelled: COLORS.gray,
  };
  const statusLabels = {
    draft: 'Brouillon',
    sent: 'Envoyee',
    paid: 'Payee',
    overdue: 'En retard',
    cancelled: 'Annulee',
  };

  const status = invoice?.status || 'draft';
  drawText('Statut:', MARGIN + 145, dateY, { size: 9, color: COLORS.gray });
  drawText(statusLabels[status] || status, MARGIN + 165, dateY, {
    size: 9,
    bold: true,
    color: statusColors[status] || COLORS.gray,
  });

  y += 25;

  // === TABLEAU DES LIGNES ===
  const items = invoice?.invoice_items || [];

  // En-tete du tableau
  const tableY = y;
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, tableY, pageWidth - MARGIN * 2, 8, 'F');

  const cols = {
    description: { x: MARGIN + 2, width: 80 },
    quantity: { x: MARGIN + 85, width: 20 },
    unit: { x: MARGIN + 105, width: 20 },
    unitPrice: { x: MARGIN + 125, width: 25 },
    tva: { x: MARGIN + 150, width: 15 },
    total: { x: MARGIN + 165, width: 20 },
  };

  const headerY = tableY + 5.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Description', cols.description.x, headerY);
  doc.text('Qte', cols.quantity.x, headerY);
  doc.text('Unite', cols.unit.x, headerY);
  doc.text('Prix HT', cols.unitPrice.x, headerY);
  doc.text('TVA', cols.tva.x, headerY);
  doc.text('Total HT', cols.total.x, headerY);

  y = tableY + 10;

  // Lignes du tableau
  items.forEach((item, index) => {
    const lineSubtotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);

    // Fond alternatif
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y - 3, pageWidth - MARGIN * 2, LINE_HEIGHT + 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    // Description (tronquee si trop longue)
    const description = item.description || '-';
    const maxDescLength = 45;
    const truncatedDesc = description.length > maxDescLength
      ? description.substring(0, maxDescLength) + '...'
      : description;
    doc.text(truncatedDesc, cols.description.x, y);

    doc.text(String(item.quantity || 1), cols.quantity.x, y);
    doc.text(item.unit || 'unite', cols.unit.x, y);
    doc.text(formatAmount(item.unit_price).replace('\u00a0', ' '), cols.unitPrice.x, y);
    doc.text(`${item.tax_rate || 20}%`, cols.tva.x, y);
    doc.text(formatAmount(lineSubtotal).replace('\u00a0', ' '), cols.total.x, y);

    y += LINE_HEIGHT + 1;
  });

  // Ligne de separation
  y = drawLine(y + 2);

  // === TOTAUX ===
  const totalsX = pageWidth - MARGIN - 60;
  y += 5;

  // Sous-total HT
  drawText('Sous-total HT:', totalsX - 30, y, { size: 10, color: COLORS.gray });
  drawText(formatAmount(invoice?.subtotal), totalsX + 25, y, { size: 10, bold: true, align: 'right' });
  y += LINE_HEIGHT;

  // TVA
  drawText(`TVA (${invoice?.tax_rate || 20}%):`, totalsX - 30, y, { size: 10, color: COLORS.gray });
  drawText(formatAmount(invoice?.tax_amount), totalsX + 25, y, { size: 10, align: 'right' });
  y += LINE_HEIGHT;

  // Remise (si applicable)
  if (invoice?.discount_amount > 0) {
    drawText('Remise:', totalsX - 30, y, { size: 10, color: COLORS.gray });
    drawText(`-${formatAmount(invoice.discount_amount)}`, totalsX + 25, y, { size: 10, align: 'right' });
    y += LINE_HEIGHT;
  }

  // Total TTC
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(totalsX - 35, y - 3, 65, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TTC:', totalsX - 30, y + 4);
  doc.text(formatAmount(invoice?.total), totalsX + 25, y + 4, { align: 'right' });

  y += 20;

  // === CONDITIONS DE PAIEMENT ===
  if (invoice?.terms || invoice?.notes) {
    y = drawLine(y, COLORS.lightGray);
    y += 3;

    if (invoice?.terms) {
      y = drawText('Conditions de paiement:', MARGIN, y, { size: 9, bold: true, color: COLORS.gray });
      y = drawText(invoice.terms, MARGIN, y, { size: 9 });
      y += 3;
    }

    if (invoice?.notes) {
      y = drawText('Notes:', MARGIN, y, { size: 9, bold: true, color: COLORS.gray });
      // Gerer les notes multi-lignes
      const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - MARGIN * 2 - 10);
      noteLines.forEach((line) => {
        y = drawText(line, MARGIN, y, { size: 9 });
      });
    }
  }

  // === PIED DE PAGE ===
  const footerY = pageHeight - 20;

  // Mentions legales
  const legalText = invoice?.footer ||
    'En cas de retard de paiement, une penalite de 3 fois le taux d\'interet legal sera appliquee, ainsi qu\'une indemnite forfaitaire de 40 EUR pour frais de recouvrement.';

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);

  const legalLines = doc.splitTextToSize(legalText, pageWidth - MARGIN * 2);
  legalLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2, footerY + i * 3, { align: 'center' });
  });

  // Numero de page
  doc.text(`Page 1/1`, pageWidth - MARGIN, pageHeight - 10, { align: 'right' });

  // Metadonnees
  doc.setProperties({
    title: `Facture ${invoice?.invoice_number || ''}`,
    subject: 'Facture',
    creator: 'SRP Portal',
    author: organization?.name || 'SRP',
  });

  logger.log('[PDF] Facture generee avec succes');
  return doc.output('blob');
}

/**
 * Genere un PDF de devis
 * @param {Object} quote - Donnees du devis
 * @param {Object} organization - Informations de l'organisation
 * @param {Object} client - Informations du client
 * @returns {Blob} - PDF sous forme de Blob
 */
export function generateQuotePDF(quote, organization = {}, client = {}) {
  logger.log('[PDF] Generation du devis:', quote?.quote_number);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  // Fonction utilitaire pour dessiner du texte
  const drawText = (text, x, yPos, options = {}) => {
    const { size = 10, bold = false, color = COLORS.text, align = 'left' } = options;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(text, x, yPos, { align });
    return yPos + LINE_HEIGHT;
  };

  // Fonction pour dessiner une ligne horizontale
  const drawLine = (yPos, color = COLORS.lightGray) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
    return yPos + 3;
  };

  // === EN-TETE ===
  // Titre DEVIS
  y = drawText('DEVIS', pageWidth / 2, y + 5, {
    size: 24,
    bold: true,
    color: COLORS.primary,
    align: 'center',
  });

  // Numero de devis
  y = drawText(quote?.quote_number || 'DEV-XXXX', pageWidth / 2, y + 2, {
    size: 14,
    bold: true,
    align: 'center',
  });

  y += 10;

  // === INFORMATIONS EMETTEUR (gauche) ===
  const leftX = MARGIN;
  let leftY = y;

  leftY = drawText(organization?.name || 'Votre entreprise', leftX, leftY, {
    size: 12,
    bold: true,
  });

  if (organization?.address) {
    leftY = drawText(organization.address, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.postal_code || organization?.city) {
    leftY = drawText(
      `${organization.postal_code || ''} ${organization.city || ''}`.trim(),
      leftX,
      leftY,
      { size: 9, color: COLORS.gray }
    );
  }
  if (organization?.phone) {
    leftY = drawText(`Tel: ${organization.phone}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.email) {
    leftY = drawText(organization.email, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.siret) {
    leftY = drawText(`SIRET: ${organization.siret}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.vat_number) {
    leftY = drawText(`TVA: ${organization.vat_number}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.rcs) {
    leftY = drawText(`RCS: ${organization.rcs}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.ape_code) {
    leftY = drawText(`APE: ${organization.ape_code}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.legal_form && organization?.share_capital) {
    leftY = drawText(`${organization.legal_form} au capital de ${organization.share_capital}`, leftX, leftY, { size: 9, color: COLORS.gray });
  }

  // === INFORMATIONS CLIENT (droite) ===
  const rightX = pageWidth - MARGIN - 70;
  let rightY = y;

  // Cadre pour le client
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX - 5, rightY - 5, 75, 40, 2, 2, 'F');

  rightY = drawText('DESTINATAIRE:', rightX, rightY, { size: 8, color: COLORS.gray });

  const clientData = client || quote?.client || {};
  rightY = drawText(clientData.name || clientData.company_name || '-', rightX, rightY, {
    size: 11,
    bold: true,
  });

  if (clientData.company_name && clientData.name !== clientData.company_name) {
    rightY = drawText(clientData.company_name, rightX, rightY, { size: 9 });
  }
  if (clientData.address) {
    rightY = drawText(clientData.address, rightX, rightY, { size: 9, color: COLORS.gray });
  }
  if (clientData.postal_code || clientData.city) {
    rightY = drawText(
      `${clientData.postal_code || ''} ${clientData.city || ''}`.trim(),
      rightX,
      rightY,
      { size: 9, color: COLORS.gray }
    );
  }
  if (clientData.email) {
    rightY = drawText(clientData.email, rightX, rightY, { size: 9, color: COLORS.gray });
  }

  y = Math.max(leftY, rightY) + 10;

  // === DATES ET VALIDITE ===
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y - 3, pageWidth - MARGIN * 2, 20, 2, 2, 'F');

  const dateY = y + 5;
  drawText('Date emission:', MARGIN + 5, dateY, { size: 9, color: COLORS.gray });
  drawText(formatDate(quote?.issue_date), MARGIN + 35, dateY, { size: 9, bold: true });

  drawText('Valable jusqu\'au:', MARGIN + 75, dateY, { size: 9, color: COLORS.gray });
  drawText(formatDate(quote?.valid_until), MARGIN + 115, dateY, { size: 9, bold: true });

  // Statut
  const statusColors = {
    draft: COLORS.gray,
    sent: COLORS.warning,
    accepted: COLORS.success,
    rejected: COLORS.danger,
    expired: COLORS.gray,
    converted: COLORS.success,
  };
  const statusLabels = {
    draft: 'Brouillon',
    sent: 'Envoye',
    accepted: 'Accepte',
    rejected: 'Refuse',
    expired: 'Expire',
    converted: 'Converti',
  };

  const status = quote?.status || 'draft';
  drawText('Statut:', MARGIN + 150, dateY, { size: 9, color: COLORS.gray });
  drawText(statusLabels[status] || status, MARGIN + 167, dateY, {
    size: 9,
    bold: true,
    color: statusColors[status] || COLORS.gray,
  });

  y += 25;

  // === TABLEAU DES LIGNES ===
  const items = quote?.quote_items || [];

  // En-tete du tableau
  const tableY = y;
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGIN, tableY, pageWidth - MARGIN * 2, 8, 'F');

  const cols = {
    description: { x: MARGIN + 2, width: 80 },
    quantity: { x: MARGIN + 85, width: 20 },
    unit: { x: MARGIN + 105, width: 20 },
    unitPrice: { x: MARGIN + 125, width: 25 },
    tva: { x: MARGIN + 150, width: 15 },
    total: { x: MARGIN + 165, width: 20 },
  };

  const headerY = tableY + 5.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Description', cols.description.x, headerY);
  doc.text('Qte', cols.quantity.x, headerY);
  doc.text('Unite', cols.unit.x, headerY);
  doc.text('Prix HT', cols.unitPrice.x, headerY);
  doc.text('TVA', cols.tva.x, headerY);
  doc.text('Total HT', cols.total.x, headerY);

  y = tableY + 10;

  // Lignes du tableau
  items.forEach((item, index) => {
    const lineSubtotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);

    // Fond alternatif
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y - 3, pageWidth - MARGIN * 2, LINE_HEIGHT + 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    const description = item.description || '-';
    const maxDescLength = 45;
    const truncatedDesc = description.length > maxDescLength
      ? description.substring(0, maxDescLength) + '...'
      : description;
    doc.text(truncatedDesc, cols.description.x, y);

    doc.text(String(item.quantity || 1), cols.quantity.x, y);
    doc.text(item.unit || 'unite', cols.unit.x, y);
    doc.text(formatAmount(item.unit_price).replace('\u00a0', ' '), cols.unitPrice.x, y);
    doc.text(`${item.tax_rate || 20}%`, cols.tva.x, y);
    doc.text(formatAmount(lineSubtotal).replace('\u00a0', ' '), cols.total.x, y);

    y += LINE_HEIGHT + 1;
  });

  // Ligne de separation
  y = drawLine(y + 2);

  // === TOTAUX ===
  const totalsX = pageWidth - MARGIN - 60;
  y += 5;

  // Sous-total HT
  drawText('Sous-total HT:', totalsX - 30, y, { size: 10, color: COLORS.gray });
  drawText(formatAmount(quote?.subtotal), totalsX + 25, y, { size: 10, bold: true, align: 'right' });
  y += LINE_HEIGHT;

  // TVA
  drawText(`TVA (${quote?.tax_rate || 20}%):`, totalsX - 30, y, { size: 10, color: COLORS.gray });
  drawText(formatAmount(quote?.tax_amount), totalsX + 25, y, { size: 10, align: 'right' });
  y += LINE_HEIGHT;

  // Total TTC
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(totalsX - 35, y - 3, 65, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TTC:', totalsX - 30, y + 4);
  doc.text(formatAmount(quote?.total), totalsX + 25, y + 4, { align: 'right' });

  y += 20;

  // === CONDITIONS ===
  if (quote?.terms || quote?.notes) {
    y = drawLine(y, COLORS.lightGray);
    y += 3;

    if (quote?.terms) {
      y = drawText('Conditions:', MARGIN, y, { size: 9, bold: true, color: COLORS.gray });
      y = drawText(quote.terms, MARGIN, y, { size: 9 });
      y += 3;
    }

    if (quote?.notes) {
      y = drawText('Notes:', MARGIN, y, { size: 9, bold: true, color: COLORS.gray });
      const noteLines = doc.splitTextToSize(quote.notes, pageWidth - MARGIN * 2 - 10);
      noteLines.forEach((line) => {
        y = drawText(line, MARGIN, y, { size: 9 });
      });
    }
  }

  // === PIED DE PAGE ===
  const invoiceSettings = organization?.invoice_settings || {};
  const bankDetails = invoiceSettings.bank_details || {};
  let footerY = pageHeight - 35;

  // Coordonnées bancaires si disponibles
  if (bankDetails.iban || bankDetails.bic) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    let bankText = 'Coordonnées bancaires:';
    if (bankDetails.bank_name) bankText += ` ${bankDetails.bank_name}`;
    if (bankDetails.iban) bankText += ` - IBAN: ${bankDetails.iban}`;
    if (bankDetails.bic) bankText += ` - BIC: ${bankDetails.bic}`;
    doc.text(bankText, pageWidth / 2, footerY, { align: 'center' });
    footerY += 5;
  }

  // Mention de validite
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.warning);
  doc.text(
    `Ce devis est valable jusqu'au ${formatDate(quote?.valid_until)}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Mentions legales de l'organisation ou par défaut
  const legalText = invoiceSettings.legal_mentions ||
    'Devis gratuit et sans engagement. Signature et retour valant acceptation des conditions.';
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  const legalLines = doc.splitTextToSize(legalText, pageWidth - MARGIN * 2);
  legalLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2, footerY + 5 + i * 3, { align: 'center' });
  });

  // Espace signature
  const signatureY = footerY + 5 + legalLines.length * 3 + 3;
  doc.text('Bon pour accord, date et signature:', MARGIN, signatureY);
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(MARGIN + 60, signatureY, MARGIN + 130, signatureY);

  // Numero de page
  doc.text(`Page 1/1`, pageWidth - MARGIN, pageHeight - 10, { align: 'right' });

  // Metadonnees
  doc.setProperties({
    title: `Devis ${quote?.quote_number || ''}`,
    subject: 'Devis',
    creator: 'SRP Portal',
    author: organization?.name || 'SRP',
  });

  logger.log('[PDF] Devis genere avec succes');
  return doc.output('blob');
}

/**
 * Telecharge un PDF
 * @param {Blob} pdfBlob - PDF sous forme de Blob
 * @param {string} filename - Nom du fichier
 */
export function downloadInvoicePdf(pdfBlob, filename) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  logger.log('[PDF] Telechargement:', filename);
}

/**
 * Ouvre un PDF dans un nouvel onglet
 * @param {Blob} pdfBlob - PDF sous forme de Blob
 */
export function previewInvoicePdf(pdfBlob) {
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
  // Nettoyer l'URL apres un delai
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Calcule les totaux TVA ventiles par taux
 * @param {Array} items - Lignes du document
 * @returns {Array} - Ventilation TVA [{rate, base, amount}]
 */
function calculateTaxBreakdown(items) {
  const taxMap = {};

  (items || []).forEach(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    const discount = parseFloat(item.discount_percent) || 0;
    const rate = parseFloat(item.tax_rate) ?? 20;

    const lineBase = qty * price * (1 - discount / 100);
    const lineAmount = lineBase * (rate / 100);

    if (!taxMap[rate]) {
      taxMap[rate] = { rate, base: 0, amount: 0 };
    }
    taxMap[rate].base += lineBase;
    taxMap[rate].amount += lineAmount;
  });

  return Object.values(taxMap).sort((a, b) => b.rate - a.rate);
}

/**
 * Genere un PDF de devis avec template personnalise
 * @param {Object} quote - Donnees du devis
 * @param {Object} organization - Informations de l'organisation
 * @param {Object} client - Informations du client
 * @param {Object} template - Modele de devis (optionnel)
 * @returns {Blob} - PDF sous forme de Blob
 */
export function generateQuotePDFWithTemplate(quote, organization = {}, client = {}, template = {}) {
  logger.log('[PDF] Generation devis avec template:', quote?.quote_number);

  // Couleur du template
  const primaryColor = template.primary_color || '#3B82F6';
  const r = parseInt(primaryColor.slice(1, 3), 16);
  const g = parseInt(primaryColor.slice(3, 5), 16);
  const b = parseInt(primaryColor.slice(5, 7), 16);
  const tplColor = [r, g, b];

  const showRef = template.show_reference ?? true;
  const showDesc = template.show_item_description ?? true;
  const showDiscount = template.show_discount_column ?? false;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  const drawText = (text, x, yPos, options = {}) => {
    const { size = 10, bold = false, color = COLORS.text, align = 'left' } = options;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(String(text || ''), x, yPos, { align });
    return yPos + LINE_HEIGHT;
  };

  const drawLine = (yPos, color = COLORS.lightGray) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos, pageWidth - MARGIN, yPos);
    return yPos + 3;
  };

  // === HEADER TEXT (template) ===
  if (template.header_text) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    const headerLines = doc.splitTextToSize(template.header_text, pageWidth - MARGIN * 2);
    headerLines.forEach(line => {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    });
    y += 3;
  }

  // === TITRE ===
  y = drawText('DEVIS', pageWidth / 2, y + 5, {
    size: 24,
    bold: true,
    color: tplColor,
    align: 'center',
  });

  y = drawText(quote?.quote_number || 'DEV-XXXX', pageWidth / 2, y + 2, {
    size: 14,
    bold: true,
    align: 'center',
  });

  y += 10;

  // === EMETTEUR (gauche) ===
  const leftX = MARGIN;
  let leftY = y;
  leftY = drawText(organization?.name || 'Votre entreprise', leftX, leftY, { size: 12, bold: true });
  if (organization?.address) leftY = drawText(organization.address, leftX, leftY, { size: 9, color: COLORS.gray });
  if (organization?.postal_code || organization?.city) {
    leftY = drawText(`${organization.postal_code || ''} ${organization.city || ''}`.trim(), leftX, leftY, { size: 9, color: COLORS.gray });
  }
  if (organization?.phone) leftY = drawText(`Tel: ${organization.phone}`, leftX, leftY, { size: 9, color: COLORS.gray });
  if (organization?.email) leftY = drawText(organization.email, leftX, leftY, { size: 9, color: COLORS.gray });
  if (organization?.siret) leftY = drawText(`SIRET: ${organization.siret}`, leftX, leftY, { size: 9, color: COLORS.gray });

  // === CLIENT (droite) ===
  const rightX = pageWidth - MARGIN - 70;
  let rightY = y;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX - 5, rightY - 5, 75, 40, 2, 2, 'F');
  rightY = drawText('DESTINATAIRE:', rightX, rightY, { size: 8, color: COLORS.gray });
  const clientData = client || quote?.client || {};
  rightY = drawText(clientData.name || clientData.company_name || '-', rightX, rightY, { size: 11, bold: true });
  if (clientData.company_name && clientData.name !== clientData.company_name) {
    rightY = drawText(clientData.company_name, rightX, rightY, { size: 9 });
  }
  if (clientData.address) rightY = drawText(clientData.address, rightX, rightY, { size: 9, color: COLORS.gray });
  if (clientData.postal_code || clientData.city) {
    rightY = drawText(`${clientData.postal_code || ''} ${clientData.city || ''}`.trim(), rightX, rightY, { size: 9, color: COLORS.gray });
  }
  if (clientData.siret) rightY = drawText(`SIRET: ${clientData.siret}`, rightX, rightY, { size: 9, color: COLORS.gray });
  if (clientData.tva_number) rightY = drawText(`TVA: ${clientData.tva_number}`, rightX, rightY, { size: 9, color: COLORS.gray });

  y = Math.max(leftY, rightY) + 10;

  // === DATES ===
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y - 3, pageWidth - MARGIN * 2, 15, 2, 2, 'F');
  const dateY = y + 5;
  drawText('Date:', MARGIN + 5, dateY, { size: 9, color: COLORS.gray });
  drawText(formatDate(quote?.issue_date), MARGIN + 20, dateY, { size: 9, bold: true });
  drawText('Valable jusqu\'au:', MARGIN + 70, dateY, { size: 9, color: COLORS.gray });
  drawText(formatDate(quote?.valid_until), MARGIN + 105, dateY, { size: 9, bold: true });

  y += 20;

  // === TABLEAU ===
  const items = quote?.quote_items || [];
  const tableY = y;
  doc.setFillColor(...tplColor);
  doc.rect(MARGIN, tableY, pageWidth - MARGIN * 2, 8, 'F');

  // Colonnes dynamiques selon template
  let colX = MARGIN + 2;
  const colDef = [];

  colDef.push({ key: 'description', label: 'Description', x: colX, width: showDiscount ? 65 : 80 });
  colX += showDiscount ? 65 : 80;

  colDef.push({ key: 'quantity', label: 'Qte', x: colX, width: 15 });
  colX += 15;

  colDef.push({ key: 'unit', label: 'Unite', x: colX, width: 18 });
  colX += 18;

  colDef.push({ key: 'unitPrice', label: 'Prix HT', x: colX, width: 22 });
  colX += 22;

  if (showDiscount) {
    colDef.push({ key: 'discount', label: 'Remise', x: colX, width: 15 });
    colX += 15;
  }

  colDef.push({ key: 'tva', label: 'TVA', x: colX, width: 15 });
  colX += 15;

  colDef.push({ key: 'total', label: 'Total HT', x: colX, width: 20 });

  // Headers
  const headerTblY = tableY + 5.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  colDef.forEach(col => doc.text(col.label, col.x, headerTblY));

  y = tableY + 10;

  // Rows
  items.forEach((item, index) => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    const discount = parseFloat(item.discount_percent) || 0;
    const lineSubtotal = qty * price * (1 - discount / 100);

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y - 3, pageWidth - MARGIN * 2, LINE_HEIGHT + 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);

    const desc = item.description || '-';
    const maxLen = showDiscount ? 35 : 45;
    doc.text(desc.length > maxLen ? desc.substring(0, maxLen) + '...' : desc, colDef[0].x, y);
    doc.text(String(qty), colDef[1].x, y);
    doc.text(item.unit || 'unite', colDef[2].x, y);
    doc.text(formatAmount(price).replace('\u00a0', ' '), colDef[3].x, y);

    let nextIdx = 4;
    if (showDiscount) {
      doc.text(discount > 0 ? `${discount}%` : '-', colDef[nextIdx].x, y);
      nextIdx++;
    }

    doc.text(`${item.tax_rate ?? 20}%`, colDef[nextIdx].x, y);
    doc.text(formatAmount(lineSubtotal).replace('\u00a0', ' '), colDef[nextIdx + 1].x, y);

    y += LINE_HEIGHT + 1;
  });

  y = drawLine(y + 2);

  // === TOTAUX MULTI-TVA ===
  const totalsX = pageWidth - MARGIN - 60;
  y += 5;

  drawText('Sous-total HT:', totalsX - 30, y, { size: 10, color: COLORS.gray });
  drawText(formatAmount(quote?.subtotal), totalsX + 25, y, { size: 10, bold: true, align: 'right' });
  y += LINE_HEIGHT;

  // Ventilation TVA
  const taxBreakdown = calculateTaxBreakdown(items);

  if (taxBreakdown.length > 1) {
    // Multi-TVA: afficher chaque taux
    taxBreakdown.forEach(tax => {
      drawText(`TVA ${tax.rate}% (base ${formatAmount(tax.base)}):`, totalsX - 40, y, { size: 9, color: COLORS.gray });
      drawText(formatAmount(tax.amount), totalsX + 25, y, { size: 9, align: 'right' });
      y += LINE_HEIGHT - 1;
    });
    y += 1;

    drawText('Total TVA:', totalsX - 30, y, { size: 10, color: COLORS.gray });
    drawText(formatAmount(quote?.tax_amount), totalsX + 25, y, { size: 10, align: 'right' });
    y += LINE_HEIGHT;
  } else {
    // Taux unique
    const singleRate = taxBreakdown[0]?.rate ?? quote?.tax_rate ?? 20;
    drawText(`TVA (${singleRate}%):`, totalsX - 30, y, { size: 10, color: COLORS.gray });
    drawText(formatAmount(quote?.tax_amount), totalsX + 25, y, { size: 10, align: 'right' });
    y += LINE_HEIGHT;
  }

  // Total TTC
  doc.setFillColor(...tplColor);
  doc.roundedRect(totalsX - 35, y - 3, 65, 10, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL TTC:', totalsX - 30, y + 4);
  doc.text(formatAmount(quote?.total), totalsX + 25, y + 4, { align: 'right' });

  y += 20;

  // === CONDITIONS (template) ===
  const termsText = template.terms_text || quote?.terms;
  if (termsText || quote?.notes) {
    y = drawLine(y, COLORS.lightGray);
    y += 3;

    if (termsText) {
      y = drawText('Conditions:', MARGIN, y, { size: 9, bold: true, color: COLORS.gray });
      const termsLines = doc.splitTextToSize(termsText, pageWidth - MARGIN * 2 - 10);
      termsLines.forEach(line => { y = drawText(line, MARGIN, y, { size: 9 }); });
      y += 3;
    }

    if (quote?.notes) {
      y = drawText('Notes:', MARGIN, y, { size: 9, bold: true, color: COLORS.gray });
      const noteLines = doc.splitTextToSize(quote.notes, pageWidth - MARGIN * 2 - 10);
      noteLines.forEach(line => { y = drawText(line, MARGIN, y, { size: 9 }); });
    }
  }

  // === FOOTER ===
  const footerY = pageHeight - 25;

  // Validite
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.warning);
  doc.text(
    `Ce devis est valable jusqu'au ${formatDate(quote?.valid_until)}`,
    pageWidth / 2, footerY, { align: 'center' }
  );

  // Footer text (template)
  if (template.footer_text) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    const footerLines = doc.splitTextToSize(template.footer_text, pageWidth - MARGIN * 2);
    footerLines.forEach((line, i) => {
      doc.text(line, pageWidth / 2, footerY + 5 + i * 3, { align: 'center' });
    });
  } else {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(
      'Devis gratuit et sans engagement. Signature et retour valant acceptation des conditions.',
      pageWidth / 2, footerY + 5, { align: 'center' }
    );
  }

  // Signature
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  doc.text('Bon pour accord, date et signature:', MARGIN, footerY + 12);
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(MARGIN + 60, footerY + 12, MARGIN + 130, footerY + 12);

  doc.text('Page 1/1', pageWidth - MARGIN, pageHeight - 10, { align: 'right' });

  doc.setProperties({
    title: `Devis ${quote?.quote_number || ''}`,
    subject: 'Devis',
    creator: 'SRP Portal',
    author: organization?.name || 'SRP',
  });

  logger.log('[PDF] Devis avec template genere avec succes');
  return doc.output('blob');
}

/**
 * Genere un PDF de devis avec layout personnalise et images
 * @param {Object} quote - Donnees du devis
 * @param {Object} organization - Informations de l'organisation
 * @param {Object} client - Informations du client
 * @param {Object} layout - Configuration de mise en page
 * @param {Array} attachments - Pieces jointes avec URLs
 * @returns {Promise<Blob>} - PDF sous forme de Blob
 */
export async function generateQuotePDFWithLayout(quote, organization = {}, client = {}, layout = {}, attachments = []) {
  logger.log('[PDF] Generation devis avec layout:', quote?.quote_number);

  // Theme colors
  const THEME_COLORS = {
    default: [59, 130, 246],
    modern: [139, 92, 246],
    classic: [5, 150, 105],
    minimal: [107, 114, 128],
    bold: [220, 38, 38]
  };

  const themeColor = THEME_COLORS[layout.theme] || THEME_COLORS.default;

  // Font size based on layout
  const FONT_SIZES = {
    small: { title: 20, subtitle: 12, normal: 8, small: 7 },
    medium: { title: 24, subtitle: 14, normal: 10, small: 8 },
    large: { title: 28, subtitle: 16, normal: 11, small: 9 }
  };
  const fontSize = FONT_SIZES[layout.fontSize] || FONT_SIZES.medium;

  // Margins based on layout
  const MARGINS = {
    narrow: 10,
    normal: 15,
    wide: 20
  };
  const margin = MARGINS[layout.pageMargins] || MARGINS.normal;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;
  let pageNum = 1;

  // Helper functions
  const drawText = (text, x, yPos, options = {}) => {
    const { size = fontSize.normal, bold = false, color = COLORS.text, align = 'left' } = options;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(String(text || ''), x, yPos, { align });
    return yPos + LINE_HEIGHT;
  };

  const drawLine = (yPos, color = COLORS.lightGray) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    return yPos + 3;
  };

  const checkPageBreak = (requiredHeight) => {
    if (y + requiredHeight > pageHeight - 30) {
      doc.addPage();
      pageNum++;
      y = margin;
      return true;
    }
    return false;
  };

  // Get visible sections ordered by their position
  const sections = (layout.sections || [])
    .filter(s => s.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Section renderers
  const renderHeader = () => {
    y = drawText('DEVIS', pageWidth / 2, y + 5, {
      size: fontSize.title,
      bold: true,
      color: themeColor,
      align: 'center',
    });
    y = drawText(quote?.quote_number || 'DEV-XXXX', pageWidth / 2, y + 2, {
      size: fontSize.subtitle,
      bold: true,
      align: 'center',
    });
    y += 10;
  };

  const renderClient = () => {
    const leftX = margin;
    let leftY = y;

    // Organization info (left)
    leftY = drawText(organization?.name || 'Votre entreprise', leftX, leftY, { size: 12, bold: true });
    if (organization?.address) leftY = drawText(organization.address, leftX, leftY, { size: 9, color: COLORS.gray });
    if (organization?.postal_code || organization?.city) {
      leftY = drawText(`${organization.postal_code || ''} ${organization.city || ''}`.trim(), leftX, leftY, { size: 9, color: COLORS.gray });
    }
    if (organization?.phone) leftY = drawText(`Tel: ${organization.phone}`, leftX, leftY, { size: 9, color: COLORS.gray });
    if (organization?.email) leftY = drawText(organization.email, leftX, leftY, { size: 9, color: COLORS.gray });
    if (organization?.siret) leftY = drawText(`SIRET: ${organization.siret}`, leftX, leftY, { size: 9, color: COLORS.gray });

    // Client info (right)
    const rightX = pageWidth - margin - 70;
    let rightY = y;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(rightX - 5, rightY - 5, 75, 40, 2, 2, 'F');
    rightY = drawText('DESTINATAIRE:', rightX, rightY, { size: 8, color: COLORS.gray });
    const clientData = client || quote?.client || {};
    rightY = drawText(clientData.name || clientData.company_name || '-', rightX, rightY, { size: 11, bold: true });
    if (clientData.company_name && clientData.name !== clientData.company_name) {
      rightY = drawText(clientData.company_name, rightX, rightY, { size: 9 });
    }
    if (clientData.address) rightY = drawText(clientData.address, rightX, rightY, { size: 9, color: COLORS.gray });
    if (clientData.postal_code || clientData.city) {
      rightY = drawText(`${clientData.postal_code || ''} ${clientData.city || ''}`.trim(), rightX, rightY, { size: 9, color: COLORS.gray });
    }
    if (clientData.email) rightY = drawText(clientData.email, rightX, rightY, { size: 9, color: COLORS.gray });

    y = Math.max(leftY, rightY) + 10;
  };

  const renderDates = () => {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 3, pageWidth - margin * 2, 15, 2, 2, 'F');
    const dateY = y + 5;
    drawText('Date:', margin + 5, dateY, { size: 9, color: COLORS.gray });
    drawText(formatDate(quote?.issue_date), margin + 20, dateY, { size: 9, bold: true });
    drawText('Valable jusqu\'au:', margin + 70, dateY, { size: 9, color: COLORS.gray });
    drawText(formatDate(quote?.valid_until), margin + 105, dateY, { size: 9, bold: true });
    y += 20;
  };

  const renderItems = () => {
    const items = quote?.quote_items || [];
    const tableY = y;
    doc.setFillColor(...themeColor);
    doc.rect(margin, tableY, pageWidth - margin * 2, 8, 'F');

    const cols = {
      description: { x: margin + 2, width: 80 },
      quantity: { x: margin + 85, width: 20 },
      unit: { x: margin + 105, width: 20 },
      unitPrice: { x: margin + 125, width: 25 },
      tva: { x: margin + 150, width: 15 },
      total: { x: margin + 165, width: 20 },
    };

    const headerY = tableY + 5.5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Description', cols.description.x, headerY);
    doc.text('Qte', cols.quantity.x, headerY);
    doc.text('Unite', cols.unit.x, headerY);
    doc.text('Prix HT', cols.unitPrice.x, headerY);
    doc.text('TVA', cols.tva.x, headerY);
    doc.text('Total HT', cols.total.x, headerY);

    y = tableY + 10;

    items.forEach((item, index) => {
      checkPageBreak(15);
      const lineSubtotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3, pageWidth - margin * 2, LINE_HEIGHT + 2, 'F');
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.text);

      const desc = item.description || '-';
      const maxLen = 45;
      doc.text(desc.length > maxLen ? desc.substring(0, maxLen) + '...' : desc, cols.description.x, y);
      doc.text(String(item.quantity || 1), cols.quantity.x, y);
      doc.text(item.unit || 'unite', cols.unit.x, y);
      doc.text(formatAmount(item.unit_price).replace('\u00a0', ' '), cols.unitPrice.x, y);
      doc.text(`${item.tax_rate || 20}%`, cols.tva.x, y);
      doc.text(formatAmount(lineSubtotal).replace('\u00a0', ' '), cols.total.x, y);

      y += LINE_HEIGHT + 1;
    });

    y = drawLine(y + 2);
  };

  const renderTotals = () => {
    checkPageBreak(40);
    const totalsX = pageWidth - margin - 60;
    y += 5;

    drawText('Sous-total HT:', totalsX - 30, y, { size: 10, color: COLORS.gray });
    drawText(formatAmount(quote?.subtotal), totalsX + 25, y, { size: 10, bold: true, align: 'right' });
    y += LINE_HEIGHT;

    const taxBreakdown = calculateTaxBreakdown(quote?.quote_items || []);
    if (taxBreakdown.length > 1) {
      taxBreakdown.forEach(tax => {
        drawText(`TVA ${tax.rate}% (base ${formatAmount(tax.base)}):`, totalsX - 40, y, { size: 9, color: COLORS.gray });
        drawText(formatAmount(tax.amount), totalsX + 25, y, { size: 9, align: 'right' });
        y += LINE_HEIGHT - 1;
      });
      y += 1;
      drawText('Total TVA:', totalsX - 30, y, { size: 10, color: COLORS.gray });
      drawText(formatAmount(quote?.tax_amount), totalsX + 25, y, { size: 10, align: 'right' });
      y += LINE_HEIGHT;
    } else {
      const singleRate = taxBreakdown[0]?.rate ?? quote?.tax_rate ?? 20;
      drawText(`TVA (${singleRate}%):`, totalsX - 30, y, { size: 10, color: COLORS.gray });
      drawText(formatAmount(quote?.tax_amount), totalsX + 25, y, { size: 10, align: 'right' });
      y += LINE_HEIGHT;
    }

    doc.setFillColor(...themeColor);
    doc.roundedRect(totalsX - 35, y - 3, 65, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL TTC:', totalsX - 30, y + 4);
    doc.text(formatAmount(quote?.total), totalsX + 25, y + 4, { align: 'right' });

    y += 20;
  };

  const renderNotes = () => {
    if (!quote?.notes) return;
    checkPageBreak(30);
    y = drawText('Notes:', margin, y, { size: 9, bold: true, color: COLORS.gray });
    const noteLines = doc.splitTextToSize(quote.notes, pageWidth - margin * 2 - 10);
    noteLines.forEach(line => { y = drawText(line, margin, y, { size: 9 }); });
    y += 5;
  };

  const renderTerms = () => {
    if (!quote?.terms) return;
    checkPageBreak(30);
    y = drawText('Conditions:', margin, y, { size: 9, bold: true, color: COLORS.gray });
    const termsLines = doc.splitTextToSize(quote.terms, pageWidth - margin * 2 - 10);
    termsLines.forEach(line => { y = drawText(line, margin, y, { size: 9 }); });
    y += 5;
  };

  const renderSignature = () => {
    if (!layout.showSignatureZone) return;
    checkPageBreak(25);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text('Bon pour accord, date et signature:', margin, y);
    doc.setDrawColor(...COLORS.lightGray);
    doc.rect(margin, y + 5, 80, 25);
    y += 35;
  };

  const renderAttachments = async () => {
    const visibleAttachments = attachments.filter(a => a.include_in_pdf && a.display_mode !== 'hidden');
    if (visibleAttachments.length === 0) return;

    // Determine placement based on layout
    const placement = layout.attachmentDisplay || 'end';

    if (placement === 'separate') {
      // Each image on separate page
      for (const att of visibleAttachments) {
        if (att.file_type?.startsWith('image/') && att.signed_url) {
          doc.addPage();
          pageNum++;
          y = margin;

          try {
            const imgData = await loadImageAsBase64(att.signed_url);
            if (imgData) {
              const imgWidth = pageWidth - margin * 2;
              const imgHeight = pageHeight - margin * 2 - 20;
              doc.addImage(imgData, 'JPEG', margin, y, imgWidth, imgHeight, undefined, 'MEDIUM');
              y = pageHeight - margin - 15;
              if (att.caption) {
                doc.setFontSize(9);
                doc.setTextColor(...COLORS.gray);
                doc.text(att.caption, pageWidth / 2, y, { align: 'center' });
              }
            }
          } catch (err) {
            logger.warn('[PDF] Could not add image:', err);
          }
        }
      }
    } else {
      // At the end (default) or inline
      checkPageBreak(60);
      y = drawLine(y);
      y = drawText('Pieces jointes:', margin, y + 3, { size: 10, bold: true, color: COLORS.gray });
      y += 5;

      for (const att of visibleAttachments) {
        if (att.file_type?.startsWith('image/') && att.signed_url) {
          try {
            const imgData = await loadImageAsBase64(att.signed_url);
            if (imgData) {
              checkPageBreak(70);

              const maxWidth = att.display_mode === 'full' ? pageWidth - margin * 2 : 60;
              const maxHeight = att.display_mode === 'full' ? 100 : 45;

              doc.addImage(imgData, 'JPEG', margin, y, maxWidth, maxHeight, undefined, 'MEDIUM');

              if (att.caption) {
                doc.setFontSize(8);
                doc.setTextColor(...COLORS.gray);
                doc.text(att.caption, margin, y + maxHeight + 4);
              }

              y += maxHeight + (att.caption ? 10 : 5);
            }
          } catch (err) {
            logger.warn('[PDF] Could not add image:', err);
          }
        } else if (att.file_type === 'application/pdf') {
          // For PDFs, just note the attachment
          doc.setFontSize(9);
          doc.setTextColor(...COLORS.text);
          doc.text(`Piece jointe PDF: ${att.file_name}`, margin, y);
          if (att.caption) {
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.gray);
            doc.text(att.caption, margin + 5, y + 5);
          }
          y += 12;
        }
      }
    }
  };

  // Section mapping
  const sectionRenderers = {
    header: renderHeader,
    client: renderClient,
    dates: renderDates,
    items: renderItems,
    totals: renderTotals,
    notes: renderNotes,
    terms: renderTerms,
    signature: renderSignature,
    attachments: renderAttachments
  };

  // Render sections in order
  for (const section of sections) {
    const renderer = sectionRenderers[section.id];
    if (renderer) {
      if (section.id === 'attachments') {
        await renderer();
      } else {
        renderer();
      }
    }
  }

  // Footer on all pages
  const totalPages = pageNum;
  for (let p = 1; p <= totalPages; p++) {
    if (p > 1) doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text(`Page ${p}/${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  // Reset to last page
  doc.setPage(totalPages);

  // Add validity note at bottom if space
  const footerY = pageHeight - 25;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.warning);
  doc.text(
    `Ce devis est valable jusqu'au ${formatDate(quote?.valid_until)}`,
    pageWidth / 2, footerY, { align: 'center' }
  );

  doc.setProperties({
    title: `Devis ${quote?.quote_number || ''}`,
    subject: 'Devis',
    creator: 'SRP Portal',
    author: organization?.name || 'SRP',
  });

  logger.log('[PDF] Devis avec layout genere avec succes');
  return doc.output('blob');
}

/**
 * Charge une image depuis une URL et la convertit en base64
 * @param {string} url - URL de l'image
 * @returns {Promise<string|null>} - Image en base64 ou null
 */
async function loadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    logger.warn('[PDF] Error loading image:', err);
    return null;
  }
}

export default {
  generateInvoicePDF,
  generateQuotePDF,
  generateQuotePDFWithTemplate,
  generateQuotePDFWithLayout,
  calculateTaxBreakdown,
  downloadInvoicePdf,
  previewInvoicePdf,
  loadImageAsBase64,
};
