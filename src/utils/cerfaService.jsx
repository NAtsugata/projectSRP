// =============================
// FILE: src/utils/cerfaService.js
// Service pour remplir les formulaires CERFA
// =============================

import { PDFDocument, rgb } from 'pdf-lib';
import logger from './logger';

// Importer les PDF comme assets (Webpack les gère automatiquement)
import cerfaPdfAsset from '../assets/cerfa_15497-04.pdf';
import cerfa15498PdfAsset from '../assets/cerfa_15498.pdf';

// =============================
// CONSTANTS
// =============================

// Utiliser l'asset importé comme chemin principal
const CERFA_PATH = cerfaPdfAsset;

// Informations entreprise par défaut (SRP)
const DEFAULT_COMPANY_INFO = {
    companyName: 'SRP - Services Réparation Plomberie',
    siret: '',
    address: 'Champtercier, 04660',
    phone: '06 27 68 10 22',
    qualification: 'Professionnel qualifié gaz',
    attestationNumber: ''
};

// =============================
// LOCAL STORAGE KEYS
// =============================

const STORAGE_KEY_COMPANY = 'cerfa_company_info';
const STORAGE_KEY_HISTORY = 'cerfa_generation_history';
const STORAGE_KEY_COUNTER = 'cerfa_fiche_counter';

// =============================
// NUMÉROTATION DES FICHES
// =============================

/**
 * Récupère le prochain numéro de fiche CERFA
 * Format: CERFA-YYYY-NNNN (ex: CERFA-2026-0001)
 * @returns {string} Numéro de fiche formaté
 */
export const getNextFicheNumber = () => {
    try {
        const currentYear = new Date().getFullYear();
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNTER) || '{}');

        // Réinitialiser le compteur si on change d'année
        if (stored.year !== currentYear) {
            stored.year = currentYear;
            stored.count = 0;
        }

        // Incrémenter le compteur
        stored.count = (stored.count || 0) + 1;
        localStorage.setItem(STORAGE_KEY_COUNTER, JSON.stringify(stored));

        // Formater le numéro (CERFA-2026-0001)
        const paddedCount = String(stored.count).padStart(4, '0');
        return `CERFA-${currentYear}-${paddedCount}`;
    } catch (e) {
        logger.error('Erreur génération numéro fiche:', e);
        return `CERFA-${Date.now()}`;
    }
};

/**
 * Récupère le numéro actuel sans incrémenter
 * @returns {Object} { year, count, formatted }
 */
export const getCurrentFicheInfo = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNTER) || '{}');
        const year = stored.year || new Date().getFullYear();
        const count = stored.count || 0;
        const paddedCount = String(count).padStart(4, '0');
        return {
            year,
            count,
            formatted: `CERFA-${year}-${paddedCount}`,
            nextNumber: count + 1
        };
    } catch (e) {
        return { year: new Date().getFullYear(), count: 0, formatted: 'CERFA-0000', nextNumber: 1 };
    }
};

/**
 * Réinitialise le compteur de fiches (admin uniquement)
 * @param {number} startNumber - Numéro de départ (défaut: 0)
 * @returns {boolean} Succès
 */
export const resetFicheCounter = (startNumber = 0) => {
    try {
        const currentYear = new Date().getFullYear();
        localStorage.setItem(STORAGE_KEY_COUNTER, JSON.stringify({
            year: currentYear,
            count: startNumber
        }));
        return true;
    } catch (e) {
        logger.error('Erreur réinitialisation compteur:', e);
        return false;
    }
};

// =============================
// COMPANY INFO MANAGEMENT
// =============================

/**
 * Récupère les informations entreprise sauvegardées
 * @returns {Object} Informations entreprise
 */
export const getCompanyInfo = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_COMPANY);
        if (saved) {
            return { ...DEFAULT_COMPANY_INFO, ...JSON.parse(saved) };
        }
    } catch (e) {
        logger.error('Erreur lecture company info:', e);
    }
    return { ...DEFAULT_COMPANY_INFO };
};

/**
 * Sauvegarde les informations entreprise
 * @param {Object} info - Informations à sauvegarder
 */
export const saveCompanyInfo = (info) => {
    try {
        localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(info));
        return true;
    } catch (e) {
        logger.error('Erreur sauvegarde company info:', e);
        return false;
    }
};

// =============================
// EQUIPMENT INFO DEFAULTS
// =============================

/**
 * Récupère les informations équipement pré-enregistrées pour un client
 * @param {string} clientId - ID du client ou contrat
 * @returns {Object|null} Informations équipement
 */
export const getEquipmentInfo = (clientId) => {
    try {
        const allEquipment = localStorage.getItem('cerfa_equipment_info');
        if (allEquipment) {
            const parsed = JSON.parse(allEquipment);
            return parsed[clientId] || null;
        }
    } catch (e) {
        logger.error('Erreur lecture equipment info:', e);
    }
    return null;
};

/**
 * Sauvegarde les informations équipement pour un client
 * @param {string} clientId - ID du client ou contrat
 * @param {Object} info - Informations équipement
 */
export const saveEquipmentInfo = (clientId, info) => {
    try {
        const allEquipment = JSON.parse(localStorage.getItem('cerfa_equipment_info') || '{}');
        allEquipment[clientId] = info;
        localStorage.setItem('cerfa_equipment_info', JSON.stringify(allEquipment));
        return true;
    } catch (e) {
        logger.error('Erreur sauvegarde equipment info:', e);
        return false;
    }
};

// =============================
// PDF FIELD INSPECTION (Debug)
// =============================

/**
 * Inspecte les champs du PDF CERFA pour trouver leurs noms
 * Utile pour le debug/mapping initial
 * @returns {Promise<Array>} Liste des noms de champs
 */
export const inspectCerfaFields = async () => {
    try {
        const response = await fetch(CERFA_PATH);
        const pdfBytes = await response.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        const fieldInfo = fields.map(field => ({
            name: field.getName(),
            type: field.constructor.name
        }));

        logger.log('CERFA Fields:', fieldInfo);
        return fieldInfo;
    } catch (e) {
        logger.error('Erreur inspection CERFA:', e);
        return [];
    }
};

/**
 * Remplit le CERFA 15497-04 (Fiche d'intervention fluides frigorigènes)
 * @param {Object} data - Données pour remplir le formulaire
 * @returns {Promise<Blob>} PDF rempli en Blob
 */
export const fillCerfa15497 = async (data) => {
    try {
        // Utiliser le numéro de fiche fourni (ne pas incrémenter ici, c'est fait dans CerfaPage)
        const ficheNumber = data.ficheNo || data.ficheNumber || '';
        logger.log('[CERFA] Numéro de fiche:', ficheNumber);

        // Debug: Log all input data
        logger.log('[CERFA] === Données reçues ===');
        logger.log('[CERFA] fluide:', data.fluide);
        logger.log('[CERFA] denominationFluide:', data.denominationFluide);
        logger.log('[CERFA] charge:', data.charge);
        logger.log('[CERFA] technicianName:', data.technicianName);
        logger.log('[CERFA] clientSignatureName:', data.clientSignatureName);
        logger.log('[CERFA] date:', data.date);
        logger.log('[CERFA] dateIntervention:', data.dateIntervention);

        // Charger le PDF template (importé comme asset webpack)
        logger.log('[CERFA] Chargement du PDF depuis:', CERFA_PATH);

        let pdfResponse = await fetch(CERFA_PATH);

        if (!pdfResponse.ok) {
            // Fallback: essayer depuis le dossier public
            logger.warn('[CERFA] Asset non trouvé, tentative depuis /cerfa/...');
            const fallbackPath = `${window.location.origin}/cerfa/cerfa_15497-04.pdf`;
            pdfResponse = await fetch(fallbackPath);
            if (!pdfResponse.ok) {
                throw new Error(`Impossible de charger le formulaire CERFA (${pdfResponse.status})`);
            }
        }

        logger.log('[CERFA] PDF chargé avec succès');
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();

        // Helper pour remplir un champ texte de manière sécurisée
        const fillTextField = (fieldName, value) => {
            try {
                const field = form.getTextField(fieldName);
                if (field) {
                    // Toujours écrire, même si vide (pour debug)
                    const textValue = value ? String(value) : '';
                    field.setText(textValue);
                    if (textValue) {
                        logger.log(`[CERFA] ✓ Rempli: ${fieldName} = "${textValue}"`);
                    }
                } else {
                    logger.log(`[CERFA] ✗ Champ introuvable: ${fieldName}`);
                }
            } catch (e) {
                logger.log(`[CERFA] ✗ Erreur ${fieldName}: ${e.message}`);
            }
        };

        // Helper pour cocher une case
        const checkBox = (fieldName, shouldCheck) => {
            try {
                if (shouldCheck) {
                    const field = form.getCheckBox(fieldName);
                    if (field) {
                        field.check();
                        logger.log(`[CERFA] ✓ Coché: ${fieldName}`);
                    }
                }
            } catch (e) {
                logger.log(`[CERFA] ✗ Checkbox non trouvée: ${fieldName}`);
            }
        };

        // Helper pour sélectionner un bouton radio
        const selectRadio = (groupName, optionValue) => {
            try {
                const radioGroup = form.getRadioGroup(groupName);
                if (radioGroup && optionValue) {
                    radioGroup.select(optionValue);
                    logger.log(`[CERFA] ✓ Radio: ${groupName} = "${optionValue}"`);
                }
            } catch (e) {
                logger.log(`[CERFA] ✗ Radio non trouvé: ${groupName} - ${e.message}`);
            }
        };

        // ===== REMPLISSAGE DES CHAMPS =====

        // Numéro de fiche
        fillTextField('Fiche_no', ficheNumber);

        // Opérateur / Intervenant - Support CerfaPage (intervenantXxx) et CerfaGeneratorModal (companyXxx)
        const operateurInfo = [
            data.companyName || data.intervenantNom || 'SRP - Services Réparation Plomberie',
            data.companyAddress || data.intervenantAdresse || '',
            (data.siret || data.intervenantSiret) ? `SIRET: ${data.siret || data.intervenantSiret}` : '',
            data.qualification || ''
        ].filter(Boolean).join('\n');
        fillTextField('Operateur', operateurInfo);
        fillTextField('Attestation_no', data.attestationNumber || data.intervenantAttestation || '');

        // Détenteur / Client - Support CerfaPage (detenteurXxx) et CerfaGeneratorModal (clientXxx)
        const detenteurInfo = [
            data.detenteurNom || (data.clientName ? `${data.clientFirstName || ''} ${data.clientName}`.trim() : ''),
            data.detenteurAdresse || data.clientAddress || '',
            data.clientPostalCode && data.clientCity ? `${data.clientPostalCode} ${data.clientCity}` : '',
            data.detenteurSiret ? `SIRET: ${data.detenteurSiret}` : ''
        ].filter(Boolean).join('\n');
        fillTextField('Detenteur', detenteurInfo);

        // Équipement
        const equipementId = [
            data.equipmentType || data.typeEquipement || '',
            data.equipmentBrand || data.marque || '',
            data.equipmentModel || data.modele || '',
            data.numeroSerie || ''
        ].filter(Boolean).join(' - ');
        fillTextField('Equipement_ID', equipementId);
        // Support des deux formats: CerfaGeneratorModal (fluide) et CerfaPage (fluideDesignation)
        fillTextField('Equipement_Fluide', data.fluide || data.fluideDesignation || data.typeFluide || '');
        fillTextField('Equipement_Charge', data.charge || data.fluideChargeInitiale || data.chargeInitiale || '');
        fillTextField('Equipement_teqCO2', data.teqCO2 || '');

        // Nature de l'intervention (cases à cocher)
        checkBox('Case_MiseService', data.natureMiseEnService);
        checkBox('Case_Maintenance', data.natureMaintenance);
        checkBox('Case_CtrlPerio', data.natureControleEtancheite || data.controlePeriodicite);
        checkBox('Case_CtrlNonPerio', data.controleNonPeriodique);
        checkBox('Case_Demantel', data.natureDemantelement || data.natureDemontage);
        checkBox('Case_Modif', data.modification);
        checkBox('Case_Assemblage', data.assemblage);
        checkBox('Case_Autre', data.natureAutre);
        fillTextField('Autre', data.autreNature || '');

        // Détecteur
        fillTextField('Detecteur_ID', data.detecteurId || '');

        // Système permanent de détection de fuites (radio Bouton_Oui: "1" = OUI, "2" = NON)
        if (data.systemeDetectionPermanent === 'oui') {
            selectRadio('Bouton_Oui', '1');
        } else if (data.systemeDetectionPermanent === 'non') {
            selectRadio('Bouton_Oui', '2');
        }

        // Date du contrôle
        const dateIntervention = data.dateIntervention || data.maintenanceDate || new Date().toLocaleDateString('fr-FR');
        const dateParts = dateIntervention.split('/');
        if (dateParts.length === 3) {
            fillTextField('Controle_Jour', dateParts[0]);
            fillTextField('Controle_Mois', dateParts[1]);
            fillTextField('Controle_Annee', dateParts[2]);
        }

        // Fuite détectée
        checkBox('Case_Fuite_Oui', data.fuiteDetectee === 'oui' || data.fuiteDetectee === true);
        checkBox('Case_Fuite_Non', data.fuiteDetectee === 'non' || data.fuiteDetectee === false || !data.fuiteDetectee);

        // Catégorie de fluide et seuils (cases à cocher section 6)
        // Déterminer automatiquement la catégorie basée sur le fluide et les quantités
        const fluideType = data.fluideDesignation || data.fluide || '';
        const chargeKg = parseFloat(data.fluideChargeInitiale || data.charge || 0);
        const teqCO2Value = parseFloat(data.teqCO2 || 0);

        // Classification des fluides
        const HCFC_FLUIDS = ['R-22'];
        const HFC_FLUIDS = ['R-32', 'R-410A', 'R-407C', 'R-134a', 'R-404A', 'R-507A', 'R-448A', 'R-449A', 'R-452A', 'R-454B'];
        const HFO_FLUIDS = ['R-1234yf', 'R-1234ze', 'R-290', 'R-600a'];

        let fluidCategory = null;
        let frequencyMonths = null;

        if (HCFC_FLUIDS.includes(fluideType)) {
            fluidCategory = 'HCFC';
            // HCFC basé sur kg
            if (chargeKg >= 300) {
                checkBox('Case_HCFC_300', true);
                frequencyMonths = 3;
            } else if (chargeKg >= 30) {
                checkBox('Case_HCFC_30', true);
                frequencyMonths = 6;
            } else if (chargeKg >= 2) {
                checkBox('Case_HCFC_2', true);
                frequencyMonths = 12;
            }
        } else if (HFC_FLUIDS.includes(fluideType)) {
            fluidCategory = 'HFC';
            // HFC/PFC basé sur teqCO2
            if (teqCO2Value >= 500) {
                checkBox('Case_HFC_500', true);
                frequencyMonths = 3;
            } else if (teqCO2Value >= 50) {
                checkBox('Case_HFC_50', true);
                frequencyMonths = 6;
            } else if (teqCO2Value >= 5) {
                checkBox('Case_HFC_5', true);
                frequencyMonths = 12;
            }
        } else if (HFO_FLUIDS.includes(fluideType)) {
            fluidCategory = 'HFO';
            // HFO basé sur kg
            if (chargeKg >= 100) {
                checkBox('Case_HFO_100', true);
                frequencyMonths = 6;
            } else if (chargeKg >= 10) {
                checkBox('Case_HFO_10', true);
                frequencyMonths = 12;
            } else if (chargeKg >= 1) {
                checkBox('Case_HFO_1', true);
                frequencyMonths = 24;
            }
        }

        // Fréquence de contrôle d'étanchéité (section 7)
        // Cocher automatiquement en fonction de la présence d'un système de détection
        const hasDetectionSystem = data.systemeDetectionPermanent === 'oui';

        if (frequencyMonths) {
            if (hasDetectionSystem) {
                // Avec système de détection permanent (fréquence doublée)
                if (frequencyMonths === 3) checkBox('Case_Avec_6m', true);
                else if (frequencyMonths === 6) checkBox('Case_Avec_12m', true);
                else if (frequencyMonths === 12) checkBox('Case_Avec_24m', true);
                else if (frequencyMonths === 24) checkBox('Case_Avec_24m', true); // Max 24 mois
            } else {
                // Sans système de détection
                if (frequencyMonths === 3) checkBox('Case_Sans_3m', true);
                else if (frequencyMonths === 6) checkBox('Case_Sans_6m', true);
                else if (frequencyMonths === 12) checkBox('Case_Sans_12m', true);
                else if (frequencyMonths === 24) checkBox('Case_Sans_24m', true);
            }
        }

        // Localisation des fuites - Support CerfaPage (fuiteLocalisation, fuiteLocalisation2, fuiteLocalisation3) et CerfaGeneratorModal
        // Fuite 1
        fillTextField('Fuite_Loca_1', data.fuiteLoca1 || data.fuiteLocalisation || data.localisationFuite1 || '');
        checkBox('Case_Rep_Fuite1_realisee', data.reparationFuite1Realisee || data.fuiteReparation === 'oui');
        checkBox('Case_Rep_Fuite1_AFaire', data.reparationFuite1AFaire || data.fuiteReparation === 'non');

        // Fuite 2
        fillTextField('Fuite_Loca_2', data.fuiteLoca2 || data.fuiteLocalisation2 || data.localisationFuite2 || '');
        checkBox('Case_Rep_Fuite2_realisee', data.reparationFuite2Realisee || data.fuiteReparation2 === 'oui');
        checkBox('Case_Rep_Fuite2_AFaire', data.reparationFuite2AFaire || data.fuiteReparation2 === 'non');

        // Fuite 3
        fillTextField('Fuite_Loca_3', data.fuiteLoca3 || data.fuiteLocalisation3 || data.localisationFuite3 || '');
        checkBox('Case_Rep_Fuite3_realisee', data.reparationFuite3Realisee || data.fuiteReparation3 === 'oui');
        checkBox('Case_Rep_Fuite3_AFaire', data.reparationFuite3AFaire || data.fuiteReparation3 === 'non');

        // Quantités de fluide (section 11) - Manipulation du fluide frigorigène
        // Quantité chargée totale (A+B+C)
        fillTextField('11_Quantite', data.quantiteChargeeTotal || data.quantiteFluide || '');
        // A - Fluide vierge
        fillTextField('11_QA', data.fluideVierge || data.quantiteRecuperee || data.fluideQuantiteRecuperee || '');
        // B - Fluide recyclé (récupéré et réintroduit)
        fillTextField('11_QB', data.fluideRecycle || data.quantiteChargee || '');
        // C - Fluide régénéré
        fillTextField('11_QC', data.fluideRegenere || data.quantiteAjoutee || data.fluideQuantiteAjoutee || '');
        // D - Fluide destiné au traitement
        fillTextField('11_QD', data.fluideTraitement || data.quantiteD || '');
        // D+E total (quantité récupérée totale)
        fillTextField('11_QDE', data.quantiteRecupereeTotal || data.quantiteDE || data.fluideQuantiteReintroduite || '');
        // E - Fluide conservé pour réutilisation
        fillTextField('11_QE', data.fluideConserve || data.quantiteE || '');
        // Dénomination du fluide si changement
        fillTextField('11_Denom', data.denominationChangement || data.denominationFluide || data.fluide || data.fluideDesignation || '');
        // N° BSFF (Trackdéchets)
        fillTextField('11_BSFF', data.bsffNumber || '');
        // Identification du/des contenants
        fillTextField('11_Contenant_ID', data.contenantId || '');

        // Classification des déchets (section 12)
        // Fluides non inflammables
        checkBox('Case_12_UN1078', data.dechetUN1078);
        checkBox('Case_12_Autre140601', data.dechetAutre140601);
        fillTextField('Autre-FF-NON-inflammable', data.autreDechetNonInflammable || '');
        // Fluides inflammables
        checkBox('Case_12_UN3161', data.dechetUN3161);
        checkBox('Case_12_Autre160504', data.dechetAutre160504);
        fillTextField('Autre-FF-inflammable', data.autreDechetInflammable || '');

        // Installation (section 13)
        fillTextField('13_Instal', data.installationInfo || data.emplacement || data.equipmentLocation || '');

        // Observations (section 14)
        fillTextField('14_Observations', data.observations || data.notes || '');

        // Signatures - Support CerfaPage (intervenantNom, detenteurNom) et CerfaGeneratorModal
        // Signature opérateur
        const operateurNom = data.technicianName || data.intervenantNom || data.companyName || '';
        fillTextField('Sign_Operateur_Nom', operateurNom);
        fillTextField('Sign_Operateur_Qualite', data.technicianQualite || data.intervenantQualite || data.qualification || 'Technicien');
        fillTextField('Sign_Operateur_Date', data.date || dateIntervention);

        // Signature détenteur/client
        const detenteurNom = data.clientSignatureName || data.detenteurNom || `${data.clientFirstName || ''} ${data.clientName || ''}`.trim();
        fillTextField('Sign_Detenteur_Nom', detenteurNom);
        fillTextField('Sign_Detenteur_Qualite', data.clientQualite || data.detenteurQualite || 'Propriétaire');
        fillTextField('Sign_Detenteur_Date', data.clientSignatureDate || data.date || dateIntervention);

        // Aplatir le formulaire pour figer les données
        form.flatten();

        // ===== INTÉGRATION DES SIGNATURES (après flatten) =====
        // Les signatures sont des images base64 dessinées sur le PDF
        const pages = pdfDoc.getPages();
        const page = pages[0]; // Le CERFA est sur une seule page
        const { width } = page.getSize();

        // Helper pour intégrer une signature image
        const embedSignature = async (signatureDataUrl, x, y, maxWidth, maxHeight) => {
            if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/png')) {
                return;
            }
            try {
                // Extraire les données base64
                const base64Data = signatureDataUrl.split(',')[1];
                const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                // Intégrer l'image PNG
                const signatureImage = await pdfDoc.embedPng(imageBytes);
                const { width: imgWidth, height: imgHeight } = signatureImage;

                // Calculer les dimensions pour s'adapter à la zone
                const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;

                // Dessiner l'image sur la page
                page.drawImage(signatureImage, {
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight,
                });
                logger.log(`[CERFA] ✓ Signature intégrée à x=${x}, y=${y}`);
            } catch (e) {
                logger.warn('[CERFA] ✗ Erreur intégration signature:', e.message);
            }
        };

        // Position des signatures dans le PDF CERFA 15497-04
        // Basé sur les positions réelles des champs:
        // Sign_Operateur_Date: x=127.5, y=44.9, width=209.8, height=18.5
        // Sign_Detenteur_Date: x=345.2, y=43.7, width=208.3, height=19.7
        // La signature va à droite du texte de date (après "04/01/2026")

        // Signature opérateur (dans le champ date, à droite du texte)
        // Zone plus large pour meilleure lisibilité
        if (data.signatureOperateur) {
            await embedSignature(data.signatureOperateur, 180, 43, 155, 20);
        }

        // Signature détenteur (dans le champ date détenteur, à droite du texte)
        if (data.signatureDetenteur) {
            await embedSignature(data.signatureDetenteur, 400, 42, 155, 20);
        }

        // Générer le PDF
        const filledPdfBytes = await pdfDoc.save();

        // Créer et retourner le Blob
        return new Blob([filledPdfBytes], { type: 'application/pdf' });
    } catch (e) {
        logger.error('Erreur remplissage CERFA:', e);
        throw e;
    }
};

// =============================
// CERFA 15498 - Attestation d'acquisition de fluides frigorigènes
// =============================

/**
 * Remplit le CERFA 15498 (Attestation d'acquisition de fluides frigorigènes)
 * @param {Object} data - Données pour remplir le formulaire
 * @returns {Promise<Blob>} PDF rempli en Blob
 */
export const fillCerfa15498 = async (data) => {
    try {
        // Utiliser le numéro de fiche fourni
        const ficheNumber = data.ficheNo || data.ficheNumber || '';
        logger.log('[CERFA 15498] Numéro de fiche:', ficheNumber);

        // Charger le PDF template
        logger.log('[CERFA 15498] Chargement du PDF depuis:', cerfa15498PdfAsset);

        let pdfResponse = await fetch(cerfa15498PdfAsset);

        if (!pdfResponse.ok) {
            // Fallback: essayer depuis le dossier public
            logger.warn('[CERFA 15498] Asset non trouvé, tentative depuis /cerfa/...');
            const fallbackPath = `${window.location.origin}/cerfa/CERFA_15498_Interactif_V2_PRO.pdf`;
            pdfResponse = await fetch(fallbackPath);
            if (!pdfResponse.ok) {
                throw new Error(`Impossible de charger le formulaire CERFA 15498 (${pdfResponse.status})`);
            }
        }

        logger.log('[CERFA 15498] PDF chargé avec succès');
        const pdfBytes = await pdfResponse.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();

        // Helper pour remplir un champ texte de manière sécurisée
        const fillTextField = (fieldName, value) => {
            try {
                const field = form.getTextField(fieldName);
                if (field) {
                    const textValue = value ? String(value) : '';
                    field.setText(textValue);
                    if (textValue) {
                        logger.log(`[CERFA 15498] ✓ Rempli: ${fieldName} = "${textValue}"`);
                    }
                } else {
                    logger.log(`[CERFA 15498] ✗ Champ introuvable: ${fieldName}`);
                }
            } catch (e) {
                logger.log(`[CERFA 15498] ✗ Erreur ${fieldName}: ${e.message}`);
            }
        };

        // Helper pour cocher une case
        const checkBox = (fieldName, shouldCheck) => {
            try {
                if (shouldCheck) {
                    const field = form.getCheckBox(fieldName);
                    if (field) {
                        field.check();
                        logger.log(`[CERFA 15498] ✓ Coché: ${fieldName}`);
                    }
                }
            } catch (e) {
                logger.log(`[CERFA 15498] ✗ Checkbox non trouvée: ${fieldName}`);
            }
        };

        // ===== REMPLISSAGE DES CHAMPS =====

        // ACQUÉREUR (Client)
        fillTextField('acq_nom', data.acq_nom || '');
        fillTextField('acq_num', data.acq_num || '');
        fillTextField('acq_voie', data.acq_voie || '');
        fillTextField('acq_compl', data.acq_compl || '');
        fillTextField('acq_lieu', data.acq_lieu || '');
        fillTextField('acq_postal', data.acq_postal || '');
        fillTextField('acq_commune', data.acq_commune || '');
        fillTextField('acq_pays', data.acq_pays || 'France');
        fillTextField('acq_ref', data.acq_ref || '');

        // INSTALLATEUR (Intervenant)
        fillTextField('inst_raison', data.inst_raison || '');
        fillTextField('inst_service', data.inst_service || '');
        fillTextField('inst_num', data.inst_num || '');
        fillTextField('inst_voie', data.inst_voie || '');
        fillTextField('inst_lieu', data.inst_lieu || '');
        fillTextField('inst_postal', data.inst_postal || '');
        fillTextField('inst_commune', data.inst_commune || '');
        fillTextField('inst_pays', data.inst_pays || 'France');
        fillTextField('inst_siret', data.inst_siret || '');
        fillTextField('inst_attestation', data.inst_attestation || '');
        fillTextField('inst_contact', data.inst_contact || '');
        fillTextField('inst_tel', data.inst_tel || '');
        fillTextField('inst_fax', data.inst_fax || '');
        fillTextField('inst_email', data.inst_email || '');
        fillTextField('inst_ref', data.inst_ref || '');

        // DISTRIBUTEUR
        fillTextField('dist_raison', data.dist_raison || '');
        fillTextField('dist_service', data.dist_service || '');
        fillTextField('dist_num', data.dist_num || '');
        fillTextField('dist_voie', data.dist_voie || '');
        fillTextField('dist_lieu', data.dist_lieu || '');
        fillTextField('dist_postal', data.dist_postal || '');
        fillTextField('dist_commune', data.dist_commune || '');
        fillTextField('dist_pays', data.dist_pays || 'France');
        fillTextField('dist_siret', data.dist_siret || '');
        fillTextField('dist_tel', data.dist_tel || '');
        fillTextField('dist_fax', data.dist_fax || '');
        fillTextField('dist_email', data.dist_email || '');

        // Type d'équipement (checkboxes)
        checkBox('climatisation', data.climatisation);
        checkBox('pompe', data.pompe);
        checkBox('hfc', data.hfc);
        checkBox('pfc', data.pfc);

        // Période et détails
        fillTextField('periode', data.periode || '');
        fillTextField('details', data.details || '');

        // Signatures
        fillTextField('sig_acq', data.sig_acq || '');
        fillTextField('sig_inst', data.sig_inst || '');
        fillTextField('sig_dist', data.sig_dist || '');

        // Aplatir le formulaire pour figer les données
        form.flatten();

        // ===== INTÉGRATION DES SIGNATURES (après flatten) =====
        const pages = pdfDoc.getPages();
        const page = pages[0];

        // Helper pour intégrer une signature image
        const embedSignature = async (signatureDataUrl, x, y, maxWidth, maxHeight) => {
            if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/png')) {
                return;
            }
            try {
                const base64Data = signatureDataUrl.split(',')[1];
                const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const signatureImage = await pdfDoc.embedPng(imageBytes);
                const { width: imgWidth, height: imgHeight } = signatureImage;
                const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;
                page.drawImage(signatureImage, {
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight,
                });
                logger.log(`[CERFA 15498] ✓ Signature intégrée à x=${x}, y=${y}`);
            } catch (e) {
                logger.warn('[CERFA 15498] ✗ Erreur intégration signature:', e.message);
            }
        };

        // Intégrer les signatures - positions exactes depuis les champs PDF
        // sig_acq_box: x=90.0, y=64.4, w=119.4, h=25.4
        // sig_inst_box: x=265.6, y=63.2, w=117.5, h=26.6
        // sig_dist_box: x=440.0, y=62.5, w=113.1, h=27.2
        if (data.signatureAcquereur) {
            await embedSignature(data.signatureAcquereur, 90, 64, 119, 25);
        }
        if (data.signatureInstallateur) {
            await embedSignature(data.signatureInstallateur, 266, 63, 117, 27);
        }
        if (data.signatureDistributeur) {
            await embedSignature(data.signatureDistributeur, 440, 62, 113, 27);
        }

        // Générer le PDF
        const filledPdfBytes = await pdfDoc.save();

        // Créer et retourner le Blob
        return new Blob([filledPdfBytes], { type: 'application/pdf' });
    } catch (e) {
        logger.error('Erreur remplissage CERFA 15498:', e);
        throw e;
    }
};

// =============================
// DOWNLOAD HELPER
// =============================

/**
 * Télécharge le PDF CERFA rempli
 * @param {Blob} pdfBlob - Le PDF en Blob
 * @param {string} filename - Nom du fichier
 */
export const downloadCerfa = (pdfBlob, filename = 'cerfa_15497_entretien.pdf') => {
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// =============================
// GENERATION HISTORY
// =============================

/**
 * Sauvegarde une génération dans l'historique
 * @param {Object} record - Enregistrement de génération
 */
export const saveGenerationRecord = (record) => {
    try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
        history.unshift({
            ...record,
            generatedAt: new Date().toISOString()
        });
        // Garder les 50 dernières générations
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 50)));
    } catch (e) {
        logger.error('Erreur sauvegarde historique:', e);
    }
};

/**
 * Récupère l'historique des générations
 * @returns {Array} Historique des générations
 */
export const getGenerationHistory = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    } catch {
        return [];
    }
};

// =============================
// UTILITY: Prepare data from intervention/contract
// =============================

/**
 * Prépare les données CERFA depuis une intervention
 * @param {Object} intervention - Données de l'intervention
 * @param {Object} profile - Profil du technicien
 * @returns {Object} Données formatées pour CERFA
 */
export const prepareCerfaDataFromIntervention = (intervention, profile = {}) => {
    const companyInfo = getCompanyInfo();
    const equipmentInfo = getEquipmentInfo(intervention.id) || {};

    // Parser le nom client (essayer de séparer prénom/nom)
    const clientParts = (intervention.client || '').split(' ');
    const clientFirstName = clientParts.shift() || '';
    const clientName = clientParts.join(' ') || clientFirstName;

    // Parser l'adresse (essayer d'extraire code postal et ville)
    const addressMatch = (intervention.address || '').match(/^(.+?),?\s*(\d{5})?\s*(.+)?$/);

    return {
        // Client
        clientName: clientName,
        clientFirstName: clientFirstName,
        clientAddress: addressMatch ? addressMatch[1] : intervention.address || '',
        clientPostalCode: addressMatch?.[2] || '',
        clientCity: addressMatch?.[3] || '',

        // Équipement (depuis les infos sauvegardées ou vide)
        equipmentType: equipmentInfo.type || 'Chaudière gaz',
        equipmentBrand: equipmentInfo.brand || '',
        equipmentModel: equipmentInfo.model || '',
        equipmentPower: equipmentInfo.power || '',
        installationYear: equipmentInfo.installationYear || '',
        equipmentLocation: equipmentInfo.location || '',

        // Entretien
        maintenanceDate: intervention.scheduled_date
            ? new Date(intervention.scheduled_date).toLocaleDateString('fr-FR')
            : new Date().toLocaleDateString('fr-FR'),
        cleanedBurner: true,
        checkedCombustion: true,
        checkedSealing: true,
        checkedVentilation: true,
        checkedExhaust: true,
        coLevel: '',
        efficiency: '',

        // Entreprise
        companyName: companyInfo.companyName,
        siret: companyInfo.siret,
        companyAddress: companyInfo.address,
        qualification: companyInfo.qualification,

        // Technicien
        technicianName: profile?.display_name || profile?.name || '',
        date: new Date().toLocaleDateString('fr-FR'),

        // Métadonnées
        interventionId: intervention.id,
        contractId: intervention.contract_id || null
    };
};

/**
 * Prépare les données CERFA depuis un contrat de maintenance
 * @param {Object} contract - Données du contrat
 * @param {Object} profile - Profil du technicien
 * @returns {Object} Données formatées pour CERFA
 */
export const prepareCerfaDataFromContract = (contract, profile = {}) => {
    const companyInfo = getCompanyInfo();
    const equipmentInfo = getEquipmentInfo(contract.id) || {};

    // Parser le nom client
    const clientParts = (contract.client_name || '').split(' ');
    const clientFirstName = clientParts.shift() || '';
    const clientName = clientParts.join(' ') || clientFirstName;

    // Parser l'adresse
    const addressMatch = (contract.client_address || '').match(/^(.+?),?\s*(\d{5})?\s*(.+)?$/);

    return {
        // Client
        clientName: clientName,
        clientFirstName: clientFirstName,
        clientAddress: addressMatch ? addressMatch[1] : contract.client_address || '',
        clientPostalCode: addressMatch?.[2] || '',
        clientCity: addressMatch?.[3] || '',

        // Équipement
        equipmentType: equipmentInfo.type || 'Chaudière gaz',
        equipmentBrand: equipmentInfo.brand || contract.equipment_details?.split(',')[0] || '',
        equipmentModel: equipmentInfo.model || '',
        equipmentPower: equipmentInfo.power || '',
        installationYear: equipmentInfo.installationYear || '',
        equipmentLocation: equipmentInfo.location || '',

        // Entretien
        maintenanceDate: new Date().toLocaleDateString('fr-FR'),
        cleanedBurner: true,
        checkedCombustion: true,
        checkedSealing: true,
        checkedVentilation: true,
        checkedExhaust: true,
        coLevel: '',
        efficiency: '',

        // Entreprise
        companyName: companyInfo.companyName,
        siret: companyInfo.siret,
        companyAddress: companyInfo.address,
        qualification: companyInfo.qualification,

        // Technicien
        technicianName: profile?.display_name || profile?.name || '',
        date: new Date().toLocaleDateString('fr-FR'),

        // Métadonnées
        contractId: contract.id
    };
};
