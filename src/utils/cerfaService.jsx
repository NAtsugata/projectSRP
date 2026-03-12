// =============================
// FILE: src/utils/cerfaService.js
// Service pour remplir les formulaires CERFA
// =============================

import { PDFDocument, rgb } from 'pdf-lib';
import logger from './logger';
import { safeStorage } from './safeStorage';

// Importer les PDF comme assets (Webpack les gère automatiquement)
import cerfaPdfAsset from '../assets/cerfa_15497-04.pdf';
import cerfa15498PdfAsset from '../assets/cerfa_15498.pdf';
import cerfa1301PdfAsset from '../assets/cerfa_1301-sd.pdf';

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
const STORAGE_KEY_COUNTERS = 'cerfa_fiche_counters'; // Compteurs multiples par type

// =============================
// NUMÉROTATION DES FICHES
// =============================

/**
 * Récupère le prochain numéro de fiche CERFA
 * Format: CERFA-{type}-YYYY-NNNN (ex: CERFA-15497-2026-0001)
 * Chaque type de CERFA a son propre compteur
 * @param {string} cerfaType - Type de CERFA (15497, 15498, 1301, etc.)
 * @returns {string} Numéro de fiche formaté
 */
export const getNextFicheNumber = (cerfaType = '15497') => {
    try {
        const currentYear = new Date().getFullYear();
        const allCounters = safeStorage.getJSON(STORAGE_KEY_COUNTERS, {});

        // Initialiser le compteur pour ce type s'il n'existe pas
        if (!allCounters[cerfaType]) {
            allCounters[cerfaType] = { year: currentYear, count: 0 };
        }

        const typeCounter = allCounters[cerfaType];

        // Réinitialiser le compteur si on change d'année
        if (typeCounter.year !== currentYear) {
            typeCounter.year = currentYear;
            typeCounter.count = 0;
        }

        // Incrémenter le compteur pour ce type spécifique
        typeCounter.count = (typeCounter.count || 0) + 1;
        allCounters[cerfaType] = typeCounter;
        safeStorage.setJSON(STORAGE_KEY_COUNTERS, allCounters);

        // Formater le numéro (CERFA-15497-2026-0001)
        const paddedCount = String(typeCounter.count).padStart(4, '0');
        return `CERFA-${cerfaType}-${currentYear}-${paddedCount}`;
    } catch (e) {
        logger.error('Erreur génération numéro fiche:', e);
        return `CERFA-${cerfaType || 'UNKN'}-${Date.now()}`;
    }
};

/**
 * Récupère le numéro actuel sans incrémenter
 * @param {string} cerfaType - Type de CERFA (15497, 15498, 1301, etc.)
 * @returns {Object} { year, count, formatted, nextNumber }
 */
export const getCurrentFicheInfo = (cerfaType = '15497') => {
    const allCounters = safeStorage.getJSON(STORAGE_KEY_COUNTERS, {});
    const typeCounter = allCounters[cerfaType] || {};
    const year = typeCounter.year || new Date().getFullYear();
    const count = typeCounter.count || 0;
    const paddedCount = String(count).padStart(4, '0');
    return {
        year,
        count,
        formatted: `CERFA-${cerfaType}-${year}-${paddedCount}`,
        nextNumber: count + 1,
        cerfaType
    };
};

/**
 * Récupère les informations de tous les compteurs CERFA
 * @returns {Object} Tous les compteurs par type
 */
export const getAllCountersInfo = () => {
    const allCounters = safeStorage.getJSON(STORAGE_KEY_COUNTERS, {});
    const result = {};

    for (const [type, data] of Object.entries(allCounters)) {
        const year = data.year || new Date().getFullYear();
        const count = data.count || 0;
        const paddedCount = String(count).padStart(4, '0');
        result[type] = {
            year,
            count,
            formatted: `CERFA-${type}-${year}-${paddedCount}`,
            nextNumber: count + 1
        };
    }

    return result;
};

/**
 * Réinitialise le compteur d'un type de CERFA (admin uniquement)
 * @param {string} cerfaType - Type de CERFA à réinitialiser (ou 'all' pour tous)
 * @param {number} startNumber - Numéro de départ (défaut: 0)
 * @returns {boolean} Succès
 */
export const resetFicheCounter = (cerfaType = '15497', startNumber = 0) => {
    try {
        const currentYear = new Date().getFullYear();
        const allCounters = safeStorage.getJSON(STORAGE_KEY_COUNTERS, {});

        if (cerfaType === 'all') {
            // Réinitialiser tous les compteurs
            Object.keys(allCounters).forEach(type => {
                allCounters[type] = { year: currentYear, count: startNumber };
            });
        } else {
            // Réinitialiser un type spécifique
            allCounters[cerfaType] = { year: currentYear, count: startNumber };
        }

        const success = safeStorage.setJSON(STORAGE_KEY_COUNTERS, allCounters);
        if (!success) {
            logger.error('Erreur réinitialisation compteur');
        }
        return success;
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
    const saved = safeStorage.getJSON(STORAGE_KEY_COMPANY, null);
    if (saved) {
        return { ...DEFAULT_COMPANY_INFO, ...saved };
    }
    return { ...DEFAULT_COMPANY_INFO };
};

/**
 * Sauvegarde les informations entreprise
 * @param {Object} info - Informations à sauvegarder
 */
export const saveCompanyInfo = (info) => {
    const success = safeStorage.setJSON(STORAGE_KEY_COMPANY, info);
    if (!success) {
        logger.error('Erreur sauvegarde company info');
    }
    return success;
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
    const allEquipment = safeStorage.getJSON('cerfa_equipment_info', {});
    return allEquipment[clientId] || null;
};

/**
 * Sauvegarde les informations équipement pour un client
 * @param {string} clientId - ID du client ou contrat
 * @param {Object} info - Informations équipement
 */
export const saveEquipmentInfo = (clientId, info) => {
    const allEquipment = safeStorage.getJSON('cerfa_equipment_info', {});
    allEquipment[clientId] = info;
    const success = safeStorage.setJSON('cerfa_equipment_info', allEquipment);
    if (!success) {
        logger.error('Erreur sauvegarde equipment info');
    }
    return success;
};

// =============================
// PDF FIELD INSPECTION (Debug)
// =============================

/**
 * Inspecte les champs du PDF CERFA pour trouver leurs noms
 * Utile pour le debug/mapping initial
 * @param {string} pdfAsset - Asset PDF à inspecter (optionnel, défaut: CERFA_PATH)
 * @returns {Promise<Array>} Liste des noms de champs
 */
export const inspectCerfaFields = async (pdfAsset = null) => {
    try {
        const assetPath = pdfAsset || CERFA_PATH;
        const response = await fetch(assetPath);
        const pdfBytes = await response.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        const fieldInfo = fields.map(field => ({
            name: field.getName(),
            type: field.constructor.name
        }));

        logger.log('CERFA Fields:', fieldInfo);
        console.log('=== CERFA PDF FIELDS ===');
        fieldInfo.forEach(f => console.log(`${f.type}: "${f.name}"`));
        console.log('========================');
        return fieldInfo;
    } catch (e) {
        logger.error('Erreur inspection CERFA:', e);
        return [];
    }
};

/**
 * Inspecte les champs du CERFA 1301-SD
 * @returns {Promise<Array>} Liste des noms de champs
 */
export const inspectCerfa1301Fields = async () => {
    return inspectCerfaFields(cerfa1301PdfAsset);
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
export const downloadCerfa = async (pdfBlob, filename = 'cerfa_15497_entretien.pdf') => {
    try {
        // Créer un nouveau Blob avec le type MIME correct
        const pdfFile = new File([pdfBlob], filename, {
            type: 'application/pdf',
            lastModified: Date.now()
        });

        // Détecter si on est sur mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Sur mobile, essayer d'utiliser l'API Web Share pour ouvrir dans l'app native
        if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            logger.log('[CERFA] 📱 Mobile: Partage via Web Share API');
            try {
                await navigator.share({
                    files: [pdfFile],
                    title: 'CERFA PDF',
                    text: 'Télécharger le PDF CERFA'
                });
                logger.log('[CERFA] ✅ PDF partagé avec succès');
                return;
            } catch (shareError) {
                // Si l'utilisateur annule le partage ou si ça échoue, continuer avec la méthode classique
                logger.warn('[CERFA] Partage annulé ou erreur:', shareError);
            }
        }

        // Méthode classique : téléchargement direct
        // Sur mobile, window.open() ouvre le PDF dans le lecteur natif
        // Sur desktop, download attribute force le téléchargement
        const url = URL.createObjectURL(pdfFile);

        if (isMobile) {
            // Sur mobile : ouvrir dans un nouvel onglet (qui ouvrira l'app PDF native)
            logger.log('[CERFA] 📱 Mobile: Ouverture dans lecteur PDF natif');
            const newWindow = window.open(url, '_blank');

            // Si le popup est bloqué, fallback sur le téléchargement
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                logger.warn('[CERFA] Popup bloqué, fallback sur téléchargement');
                downloadFallback(url, filename);
            } else {
                // Libérer l'URL après 5 secondes (temps pour que le lecteur PDF se lance)
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
        } else {
            // Sur desktop : téléchargement direct
            logger.log('[CERFA] 💻 Desktop: Téléchargement direct');
            downloadFallback(url, filename);
        }
    } catch (error) {
        logger.error('[CERFA] ❌ Erreur téléchargement:', error);
        throw new Error('Erreur lors du téléchargement du PDF');
    }
};

/**
 * Fonction helper pour téléchargement classique
 * @param {string} url - URL du blob
 * @param {string} filename - Nom du fichier
 */
const downloadFallback = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    // Certains navigateurs nécessitent que le lien soit dans le DOM
    document.body.appendChild(link);
    link.click();

    // Nettoyer
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
};

// =============================
// GENERATION HISTORY
// =============================

/**
 * Sauvegarde une génération dans l'historique
 * @param {Object} record - Enregistrement de génération
 */
export const saveGenerationRecord = (record) => {
    const history = safeStorage.getJSON(STORAGE_KEY_HISTORY, []);
    history.unshift({
        ...record,
        generatedAt: new Date().toISOString()
    });
    // Garder les 50 dernières générations
    const success = safeStorage.setJSON(STORAGE_KEY_HISTORY, history.slice(0, 50));
    if (!success) {
        logger.error('Erreur sauvegarde historique');
    }
};

/**
 * Récupère l'historique des générations
 * @returns {Array} Historique des générations
 */
export const getGenerationHistory = () => {
    return safeStorage.getJSON(STORAGE_KEY_HISTORY, []);
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

// =============================
// CERFA 1301-SD - Attestation simplifiée TVA taux réduit (10%)
// =============================

/**
 * Remplit le CERFA 1301-SD (Attestation simplifiée TVA taux réduit 10%)
 * Ce formulaire atteste que les travaux de rénovation sont éligibles à la TVA à 10%
 *
 * Champs du PDF (inspectés):
 * - a1: Nom client | a2: Prénom | a3: Adresse | a5: CP | a4: Ville
 * - cac1: Même adresse | a5a: Adresse immeuble (si différente)
 * - cac2: Attestation propriétaire/locataire
 * - a6: Nature des travaux | a7, a8, a9: Détails | a10: Autre
 * - cac3-cac5: Attestations travaux
 * - cac6-cac10: Éléments second œuvre (planchers, huisseries, etc.)
 * - cac11-cac15: Autres attestations
 * - a11: Lieu | a12: Date
 *
 * @param {Object} data - Données pour remplir le formulaire
 * @returns {Promise<Blob>} PDF rempli en Blob
 */
export const fillCerfa1301 = async (data) => {
    try {
        const ficheNumber = data.ficheNo || data.ficheNumber || '';
        logger.log('[CERFA 1301] Génération attestation TVA 10%:', ficheNumber);

        // Charger le PDF template
        logger.log('[CERFA 1301] Chargement du PDF depuis:', cerfa1301PdfAsset);

        let pdfResponse = await fetch(cerfa1301PdfAsset);

        if (!pdfResponse.ok) {
            // Fallback: essayer depuis le dossier public
            logger.warn('[CERFA 1301] Asset non trouvé, tentative depuis /cerfa/...');
            const fallbackPath = `${window.location.origin}/cerfa/cerfa_1301-sd.pdf`;
            pdfResponse = await fetch(fallbackPath);
            if (!pdfResponse.ok) {
                throw new Error(`Impossible de charger le formulaire CERFA 1301-SD (${pdfResponse.status})`);
            }
        }

        logger.log('[CERFA 1301] PDF chargé avec succès');
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
                        logger.log(`[CERFA 1301] ✓ Rempli: ${fieldName} = "${textValue}"`);
                    }
                } else {
                    logger.log(`[CERFA 1301] ✗ Champ introuvable: ${fieldName}`);
                }
            } catch (e) {
                logger.log(`[CERFA 1301] ✗ Erreur ${fieldName}: ${e.message}`);
            }
        };

        // Helper pour cocher une case
        const checkBox = (fieldName, shouldCheck) => {
            try {
                if (shouldCheck) {
                    const field = form.getCheckBox(fieldName);
                    if (field) {
                        field.check();
                        logger.log(`[CERFA 1301] ✓ Coché: ${fieldName}`);
                    }
                }
            } catch (e) {
                logger.log(`[CERFA 1301] ✗ Checkbox non trouvée: ${fieldName}`);
            }
        };

        // ===== REMPLISSAGE DES CHAMPS =====
        // Noms réels des champs du PDF CERFA 1301-SD

        // --- IDENTITÉ DU CLIENT / DONNEUR D'ORDRE ---
        // a1 (y=680, x=78): Nom
        // a2 (y=680, x=309): Prénom
        // a3 (y=670, x=90): Adresse
        // a5 (y=669, x=324): Code postal
        // a4 (y=669, x=400): Ville
        fillTextField('a1', data.clientNom || '');
        fillTextField('a2', data.clientPrenom || '');
        fillTextField('a3', data.clientAdresse || '');
        fillTextField('a5', data.clientCodePostal || '');
        fillTextField('a4', data.clientVille || '');

        // --- ADRESSE DE L'IMMEUBLE (si différente) ---
        // cac1 (y=621): Case "même adresse"
        // a5a (y=606): Adresse immeuble si différente de l'adresse du client
        // a7 (y=534, x=91): Adresse 2
        // a8 (y=534, x=293): Commune 2
        // a9 (y=534, x=450): Code postal 2
        if (data.memeAdresse) {
            checkBox('cac1', true);
        } else {
            // Adresse différente - remplir les champs a5a, a7, a8, a9
            fillTextField('a5a', data.immeubleAdresse || '');
            fillTextField('a7', data.immeubleAdresse || '');
            fillTextField('a8', data.immeubleVille || '');
            fillTextField('a9', data.immeubleCodePostal || '');
        }

        // --- QUALITÉ DU CLIENT ---
        // cac2 (y=590): Local affecté à l'habitation (toujours coché pour TVA 10%)
        // a10 (y=524): Qualité "autre" si ni propriétaire ni locataire
        checkBox('cac2', true); // Local à usage d'habitation

        // Qualité: propriétaire, locataire ou autre
        if (data.qualiteAutre && data.qualiteAutreTexte) {
            fillTextField('a10', data.qualiteAutreTexte);
        }

        // --- MILLIÈMES (parties communes) ---
        // a6 (y=567): Proportion en millièmes (si applicable)
        if (data.milliemes) {
            fillTextField('a6', data.milliemes);
        }

        // --- ATTESTATIONS OBLIGATOIRES ---
        // cac3 (y=528): Immeuble achevé depuis plus de 2 ans
        // cac4 (y=478): Les travaux n'aboutissent pas à un immeuble neuf
        // cac5 (y=458): Pas plus de 5 des 6 éléments
        checkBox('cac3', data.immeubleplus2ans !== false);
        checkBox('cac4', data.pasImmeubleNeuf !== false);
        checkBox('cac5', data.moins6Elements !== false);

        // --- ÉLÉMENTS DE SECOND ŒUVRE ---
        // cac6-cac10 sont sur la même ligne (y=437-448)
        // cac6 (x=274): Planchers non porteurs
        // cac7 (x=97): Huisseries extérieures
        // cac8 (x=191): Cloisons intérieures
        // cac9 (x=278): Installations sanitaires et plomberie
        // cac10 (x=439): Installations électriques
        checkBox('cac6', data.elemPlanchers);
        checkBox('cac7', data.elemHuisseries);
        checkBox('cac8', data.elemCloisons);
        checkBox('cac9', data.elemSanitaires || data.elemPlomberie);
        checkBox('cac10', data.elemElectriques);

        // cac11 (y=427): Chauffage
        // cac12-cac15: Autres attestations
        checkBox('cac11', data.elemChauffage);
        checkBox('cac12', data.travauxEntretien);
        checkBox('cac13', data.travauxAmelioration);
        checkBox('cac14', data.travauxTransformation);
        checkBox('cac15', data.travauxAmenagement);

        // --- DATE ET LIEU ---
        // a11 (y=160, x=263): Lieu
        // a12 (y=160, x=370): Date
        fillTextField('a11', data.lieu || '');
        fillTextField('a12', data.dateAttestation || new Date().toLocaleDateString('fr-FR'));

        // Aplatir le formulaire pour figer les données
        form.flatten();

        // ===== INTÉGRATION DE LA SIGNATURE (après flatten, comme CERFA 15497) =====
        const pages = pdfDoc.getPages();
        const page = pages[0];

        // Dessiner la signature directement sur la page (même méthode que CERFA 15497)
        if (data.signatureClient && data.signatureClient.startsWith('data:image/png')) {
            try {
                const base64Data = data.signatureClient.split(',')[1];
                const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const signatureImage = await pdfDoc.embedPng(imageBytes);

                const { width: imgWidth, height: imgHeight } = signatureImage;
                const maxWidth = 140;
                const maxHeight = 40;
                const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                const scaledWidth = imgWidth * scale;
                const scaledHeight = imgHeight * scale;

                // Position: en bas à droite, sous le lieu et la date
                // a11 (Lieu) est à y=160, a12 (Date) est à y=160
                // On place la signature juste en dessous, à y=110 (comme CERFA 15497 qui utilise y~42)
                page.drawImage(signatureImage, {
                    x: 420,
                    y: 110,
                    width: scaledWidth,
                    height: scaledHeight,
                });
                logger.log('[CERFA 1301] ✓ Signature dessinée à x=420, y=110');
            } catch (e) {
                logger.warn('[CERFA 1301] ✗ Erreur intégration signature:', e.message);
            }
        }

        // Générer le PDF
        const filledPdfBytes = await pdfDoc.save();

        // Créer et retourner le Blob
        return new Blob([filledPdfBytes], { type: 'application/pdf' });
    } catch (e) {
        logger.error('Erreur remplissage CERFA 1301:', e);
        throw e;
    }
};

/**
 * Prépare les données CERFA 1301 depuis une intervention
 * @param {Object} intervention - Données de l'intervention
 * @returns {Object} Données formatées pour CERFA 1301
 */
export const prepareCerfa1301DataFromIntervention = (intervention) => {
    const companyInfo = getCompanyInfo();

    // Parser le nom client
    const clientParts = (intervention.client || '').split(' ');
    const clientPrenom = clientParts.shift() || '';
    const clientNom = clientParts.join(' ') || clientPrenom;

    // Parser l'adresse
    const addressMatch = (intervention.address || '').match(/^(.+?),?\s*(\d{5})?\s*(.+)?$/);

    return {
        // Client
        clientNom: clientNom,
        clientPrenom: clientPrenom,
        clientAdresse: addressMatch ? addressMatch[1] : intervention.address || '',
        clientCodePostal: addressMatch?.[2] || '',
        clientVille: addressMatch?.[3] || '',

        // Immeuble (même adresse par défaut)
        immeubleAdresse: addressMatch ? addressMatch[1] : intervention.address || '',
        immeubleCodePostal: addressMatch?.[2] || '',
        immeubleVille: addressMatch?.[3] || '',

        // Nature des locaux
        natureMaison: true,
        natureAppartement: false,
        natureAutreLocal: false,

        // Travaux (plomberie par défaut)
        travauxEntretien: true,
        elemPlomberie: true,
        elemSanitaires: true,

        // Attestations obligatoires
        immeubleplus2ans: true,
        pasImmeubleNeuf: true,
        moins6Elements: true,

        // Entreprise
        entrepriseNom: companyInfo.companyName,
        entrepriseAdresse: companyInfo.address,
        entrepriseSiret: companyInfo.siret,

        // Description
        descriptionTravaux: intervention.description || intervention.notes || '',

        // Date
        dateAttestation: new Date().toLocaleDateString('fr-FR'),
        lieu: 'Champtercier',

        // Métadonnées
        interventionId: intervention.id
    };
};
