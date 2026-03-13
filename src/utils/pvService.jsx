// =============================
// FILE: src/utils/pvService.jsx
// Service pour générer les Procès-Verbaux de Réception au format PDF
// =============================

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import logger from './logger';

/**
 * Génère un Procès-Verbal de Réception au format PDF
 * @param {Object} pvData - Données du PV
 * @param {Object} intervention - Données de l'intervention
 * @param {Object} client - Données du client
 * @param {Object} company - Données de l'entreprise
 * @returns {Promise<Uint8Array>} PDF généré
 */
export const generatePVReceptionPDF = async (pvData, intervention, client, company) => {
    try {
        logger.log('[PV PDF] Début génération PDF', { pvData, intervention, client, company });

        // Créer un nouveau document PDF
        const pdfDoc = await PDFDocument.create();

        // Charger les polices standard
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        // Ajouter une page A4
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 en points
        const { width, height } = page.getSize();

        // Couleurs
        const copperColor = rgb(0.72, 0.45, 0.2); // #b87333
        const blackColor = rgb(0, 0, 0);
        const grayColor = rgb(0.4, 0.4, 0.4);
        const lightGrayColor = rgb(0.9, 0.9, 0.9);

        let yPosition = height - 50;
        const marginLeft = 50;
        const marginRight = width - 50;
        const lineHeight = 20;

        // ===== EN-TÊTE =====
        page.drawText('PROCÈS-VERBAL DE RÉCEPTION', {
            x: marginLeft,
            y: yPosition,
            size: 18,
            font: fontBold,
            color: copperColor,
        });

        yPosition -= 10;
        page.drawLine({
            start: { x: marginLeft, y: yPosition },
            end: { x: marginRight, y: yPosition },
            thickness: 2,
            color: copperColor,
        });

        yPosition -= 30;

        // ===== INFORMATIONS DE L'ENTREPRISE =====
        page.drawText('L\'ENTREPRENEUR :', {
            x: marginLeft,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: blackColor,
        });
        yPosition -= lineHeight;

        const companyName = company?.name || company?.companyName || 'Nom de l\'entreprise';
        const companyAddress = company?.address || company?.companyAddress || '';
        const companySiret = company?.siret || company?.companySiret || '';
        const companyPhone = company?.phone || company?.companyPhone || '';
        const companyEmail = company?.email || company?.companyEmail || '';

        page.drawText(`${companyName}`, {
            x: marginLeft + 20,
            y: yPosition,
            size: 10,
            font: fontRegular,
            color: blackColor,
        });
        yPosition -= lineHeight;

        if (companyAddress) {
            page.drawText(`Adresse : ${companyAddress}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        if (companySiret) {
            page.drawText(`SIRET : ${companySiret}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        if (companyPhone || companyEmail) {
            page.drawText(`Contact : ${companyPhone || ''} ${companyEmail || ''}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        yPosition -= 10;

        // ===== INFORMATIONS DU CLIENT =====
        page.drawText('LE MAÎTRE D\'OUVRAGE :', {
            x: marginLeft,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: blackColor,
        });
        yPosition -= lineHeight;

        const clientName = client?.name || intervention?.client || 'Nom du client';
        const clientAddress = client?.address || intervention?.address || '';
        const clientPhone = client?.phone || intervention?.phoneNumber || '';
        const clientEmail = client?.email || '';

        page.drawText(`${clientName}`, {
            x: marginLeft + 20,
            y: yPosition,
            size: 10,
            font: fontRegular,
            color: blackColor,
        });
        yPosition -= lineHeight;

        if (clientAddress) {
            page.drawText(`Adresse : ${clientAddress}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        if (clientPhone || clientEmail) {
            page.drawText(`Contact : ${clientPhone || ''} ${clientEmail || ''}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        yPosition -= 15;

        // ===== OBJET DES TRAVAUX =====
        page.drawText('OBJET DES TRAVAUX :', {
            x: marginLeft,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: blackColor,
        });
        yPosition -= lineHeight;

        const travauxDescription = pvData.travauxDescription || intervention?.description || 'Description des travaux';
        const devisRef = pvData.devisReference || intervention?.id || 'Réf. devis';
        const montantTravaux = pvData.montantTravaux || intervention?.totalPrice || '';

        page.drawText(`${travauxDescription}`, {
            x: marginLeft + 20,
            y: yPosition,
            size: 10,
            font: fontRegular,
            color: blackColor,
        });
        yPosition -= lineHeight;

        page.drawText(`Référence devis/marché : ${devisRef}`, {
            x: marginLeft + 20,
            y: yPosition,
            size: 9,
            font: fontRegular,
            color: grayColor,
        });
        yPosition -= lineHeight;

        if (montantTravaux) {
            page.drawText(`Montant des travaux : ${montantTravaux} €`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        const dateDebut = pvData.dateDebut || intervention?.startDate || '';
        const dateFin = pvData.dateFin || intervention?.date || '';

        if (dateDebut) {
            page.drawText(`Date début travaux : ${new Date(dateDebut).toLocaleDateString('fr-FR')}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        if (dateFin) {
            page.drawText(`Date fin travaux : ${new Date(dateFin).toLocaleDateString('fr-FR')}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 9,
                font: fontRegular,
                color: grayColor,
            });
            yPosition -= lineHeight;
        }

        yPosition -= 15;

        // ===== DÉCLARATION DE RÉCEPTION =====
        page.drawText('DÉCLARATION DE RÉCEPTION :', {
            x: marginLeft,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: blackColor,
        });
        yPosition -= lineHeight;

        const dateReception = pvData.dateReception || new Date().toISOString().split('T')[0];
        page.drawText(`Date de réception : ${new Date(dateReception).toLocaleDateString('fr-FR')}`, {
            x: marginLeft + 20,
            y: yPosition,
            size: 10,
            font: fontRegular,
            color: blackColor,
        });
        yPosition -= lineHeight + 5;

        let typeText = '';
        let typeColor = blackColor;

        if (pvData.type === 'sans_reserve') {
            typeText = '✓ RÉCEPTION SANS RÉSERVE';
            typeColor = rgb(0.2, 0.6, 0.2); // Vert
        } else if (pvData.type === 'avec_reserves') {
            typeText = '⚠ RÉCEPTION AVEC RÉSERVES';
            typeColor = rgb(0.8, 0.5, 0); // Orange
        } else if (pvData.type === 'refuse') {
            typeText = '✖ RÉCEPTION REFUSÉE';
            typeColor = rgb(0.8, 0.2, 0.2); // Rouge
        }

        page.drawRectangle({
            x: marginLeft + 15,
            y: yPosition - 5,
            width: marginRight - marginLeft - 30,
            height: 25,
            color: lightGrayColor,
        });

        page.drawText(typeText, {
            x: marginLeft + 25,
            y: yPosition + 5,
            size: 12,
            font: fontBold,
            color: typeColor,
        });

        yPosition -= 35;

        // ===== LISTE DES RÉSERVES =====
        if (pvData.type !== 'sans_reserve' && pvData.reserves && pvData.reserves.length > 0) {
            page.drawText(pvData.type === 'refuse' ? 'MOTIFS DE REFUS :' : 'LISTE DES RÉSERVES :', {
                x: marginLeft,
                y: yPosition,
                size: 11,
                font: fontBold,
                color: blackColor,
            });
            yPosition -= lineHeight;

            pvData.reserves.forEach((reserve, index) => {
                const maxWidth = marginRight - marginLeft - 40;
                const reserveText = `${index + 1}. ${reserve}`;

                // Découper le texte si trop long
                const words = reserveText.split(' ');
                let currentLine = '';

                words.forEach((word) => {
                    const testLine = currentLine + word + ' ';
                    const testWidth = fontRegular.widthOfTextAtSize(testLine, 9);

                    if (testWidth > maxWidth && currentLine !== '') {
                        page.drawText(currentLine, {
                            x: marginLeft + 20,
                            y: yPosition,
                            size: 9,
                            font: fontRegular,
                            color: blackColor,
                        });
                        yPosition -= lineHeight;
                        currentLine = word + ' ';
                    } else {
                        currentLine = testLine;
                    }
                });

                if (currentLine) {
                    page.drawText(currentLine, {
                        x: marginLeft + 20,
                        y: yPosition,
                        size: 9,
                        font: fontRegular,
                        color: blackColor,
                    });
                    yPosition -= lineHeight;
                }
            });

            yPosition -= 5;

            if (pvData.type === 'avec_reserves' && pvData.dateLeveeReserves) {
                page.drawText(`Délai de levée des réserves : ${new Date(pvData.dateLeveeReserves).toLocaleDateString('fr-FR')}`, {
                    x: marginLeft + 20,
                    y: yPosition,
                    size: 9,
                    font: fontBold,
                    color: copperColor,
                });
                yPosition -= lineHeight;
            }
        }

        yPosition -= 15;

        // ===== MENTIONS LÉGALES =====
        page.drawText('MENTIONS LÉGALES :', {
            x: marginLeft,
            y: yPosition,
            size: 11,
            font: fontBold,
            color: blackColor,
        });
        yPosition -= lineHeight;

        const mentions = [
            'La réception marque le point de départ des garanties légales :',
            '• Garantie de parfait achèvement (1 an) - Article 1792-6 du Code Civil',
            '• Garantie de bon fonctionnement (2 ans) - Article 1792-3 du Code Civil',
            '• Garantie décennale (10 ans) - Article 1792 du Code Civil',
            '',
            'En cas de réception avec réserves, le maître d\'ouvrage peut consigner 5% du montant',
            'total des travaux jusqu\'à la levée complète des réserves.',
        ];

        mentions.forEach((mention) => {
            page.drawText(mention, {
                x: marginLeft + 10,
                y: yPosition,
                size: 7,
                font: fontItalic,
                color: grayColor,
            });
            yPosition -= 12;
        });

        yPosition -= 10;

        // ===== ASSURANCES =====
        if (pvData.assuranceDecennale || company?.assuranceDecennale) {
            page.drawText('ASSURANCE DÉCENNALE :', {
                x: marginLeft,
                y: yPosition,
                size: 10,
                font: fontBold,
                color: blackColor,
            });
            yPosition -= lineHeight;

            const assuranceInfo = pvData.assuranceDecennale || company?.assuranceDecennale || '';
            page.drawText(`${assuranceInfo}`, {
                x: marginLeft + 20,
                y: yPosition,
                size: 8,
                font: fontRegular,
                color: blackColor,
            });
            yPosition -= lineHeight;
        }

        yPosition -= 20;

        // ===== SIGNATURES =====
        page.drawText('SIGNATURES :', {
            x: marginLeft,
            y: yPosition,
            size: 12,
            font: fontBold,
            color: blackColor,
        });
        yPosition -= lineHeight + 10;

        const signatureY = yPosition;
        const signatureWidth = 200;
        const signatureHeight = 80;

        // Signature Entrepreneur
        const entrepreneurX = marginLeft + 20;
        page.drawRectangle({
            x: entrepreneurX,
            y: signatureY - signatureHeight,
            width: signatureWidth,
            height: signatureHeight,
            borderColor: grayColor,
            borderWidth: 1,
        });

        page.drawText('L\'Entrepreneur', {
            x: entrepreneurX + 5,
            y: signatureY - 15,
            size: 9,
            font: fontBold,
            color: blackColor,
        });

        // Intégrer la signature de l'entrepreneur si présente
        if (pvData.signatureEntrepreneur && typeof pvData.signatureEntrepreneur === 'string') {
            try {
                const signatureBytes = await fetch(pvData.signatureEntrepreneur).then(res => res.arrayBuffer());
                const signatureImage = await pdfDoc.embedPng(signatureBytes);
                const signatureDims = signatureImage.scale(0.3);

                page.drawImage(signatureImage, {
                    x: entrepreneurX + (signatureWidth - signatureDims.width) / 2,
                    y: signatureY - signatureHeight + 10,
                    width: signatureDims.width,
                    height: signatureDims.height,
                });
            } catch (e) {
                logger.log('[PV PDF] Erreur chargement signature entrepreneur', e);
            }
        }

        page.drawText(pvData.nomEntrepreneur || companyName, {
            x: entrepreneurX + 5,
            y: signatureY - signatureHeight - 15,
            size: 8,
            font: fontRegular,
            color: blackColor,
        });

        if (pvData.dateSignatureEntrepreneur) {
            page.drawText(`Le ${new Date(pvData.dateSignatureEntrepreneur).toLocaleDateString('fr-FR')}`, {
                x: entrepreneurX + 5,
                y: signatureY - signatureHeight - 28,
                size: 7,
                font: fontItalic,
                color: grayColor,
            });
        }

        // Signature Client
        const clientX = width - marginLeft - signatureWidth - 20;
        page.drawRectangle({
            x: clientX,
            y: signatureY - signatureHeight,
            width: signatureWidth,
            height: signatureHeight,
            borderColor: grayColor,
            borderWidth: 1,
        });

        page.drawText('Le Maître d\'Ouvrage', {
            x: clientX + 5,
            y: signatureY - 15,
            size: 9,
            font: fontBold,
            color: blackColor,
        });

        // Intégrer la signature du client si présente
        if (pvData.signatureClient && typeof pvData.signatureClient === 'string') {
            try {
                const signatureBytes = await fetch(pvData.signatureClient).then(res => res.arrayBuffer());
                const signatureImage = await pdfDoc.embedPng(signatureBytes);
                const signatureDims = signatureImage.scale(0.3);

                page.drawImage(signatureImage, {
                    x: clientX + (signatureWidth - signatureDims.width) / 2,
                    y: signatureY - signatureHeight + 10,
                    width: signatureDims.width,
                    height: signatureDims.height,
                });
            } catch (e) {
                logger.log('[PV PDF] Erreur chargement signature client', e);
            }
        }

        page.drawText(pvData.nomClient || clientName, {
            x: clientX + 5,
            y: signatureY - signatureHeight - 15,
            size: 8,
            font: fontRegular,
            color: blackColor,
        });

        if (pvData.dateSignatureClient) {
            page.drawText(`Le ${new Date(pvData.dateSignatureClient).toLocaleDateString('fr-FR')}`, {
                x: clientX + 5,
                y: signatureY - signatureHeight - 28,
                size: 7,
                font: fontItalic,
                color: grayColor,
            });
        }

        // ===== PIED DE PAGE =====
        page.drawText('Document généré électroniquement - Procès-Verbal de Réception de Travaux', {
            x: marginLeft,
            y: 30,
            size: 7,
            font: fontItalic,
            color: grayColor,
        });

        page.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, {
            x: marginRight - 150,
            y: 30,
            size: 7,
            font: fontItalic,
            color: grayColor,
        });

        // Sauvegarder le PDF
        const pdfBytes = await pdfDoc.save();

        logger.log('[PV PDF] PDF généré avec succès');
        return pdfBytes;

    } catch (error) {
        logger.log('[PV PDF] Erreur génération PDF', error);
        throw error;
    }
};

/**
 * Télécharge le PDF du PV
 * @param {Uint8Array} pdfBytes - Bytes du PDF
 * @param {string} filename - Nom du fichier
 */
export const downloadPVPDF = (pdfBytes, filename = 'PV-Reception.pdf') => {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
