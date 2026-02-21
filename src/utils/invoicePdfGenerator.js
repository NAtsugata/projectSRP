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
  if (organization?.tva_number) {
    leftY = drawText(`TVA: ${organization.tva_number}`, leftX, leftY, { size: 9, color: COLORS.gray });
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
  const footerY = pageHeight - 25;

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

  // Mentions legales
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(
    'Devis gratuit et sans engagement. Signature et retour valant acceptation des conditions.',
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  );

  // Espace signature
  doc.text('Bon pour accord, date et signature:', MARGIN, footerY + 12);
  doc.setDrawColor(...COLORS.lightGray);
  doc.line(MARGIN + 60, footerY + 12, MARGIN + 130, footerY + 12);

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

export default {
  generateInvoicePDF,
  generateQuotePDF,
  downloadInvoicePdf,
  previewInvoicePdf,
};
