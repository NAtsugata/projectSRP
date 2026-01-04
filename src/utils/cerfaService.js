// =============================
// FILE: src/utils/cerfaService.js
// Service pour remplir les formulaires CERFA
// =============================

import { PDFDocument } from 'pdf-lib';
import logger from './logger';

// Importer le PDF comme asset (Webpack le gère automatiquement)
import cerfaPdfAsset from '../assets/cerfa_15497-04.pdf';

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
        console.error('Erreur lecture company info:', e);
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
        console.error('Erreur sauvegarde company info:', e);
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
        console.error('Erreur lecture equipment info:', e);
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
        console.error('Erreur sauvegarde equipment info:', e);
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
        console.error('Erreur inspection CERFA:', e);
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
        // Debug: Log all input data
        console.log('[CERFA] === Données reçues ===');
        console.log('[CERFA] fluide:', data.fluide);
        console.log('[CERFA] denominationFluide:', data.denominationFluide);
        console.log('[CERFA] charge:', data.charge);
        console.log('[CERFA] technicianName:', data.technicianName);
        console.log('[CERFA] clientSignatureName:', data.clientSignatureName);
        console.log('[CERFA] date:', data.date);
        console.log('[CERFA] dateIntervention:', data.dateIntervention);

        // Charger le PDF template (importé comme asset webpack)
        console.log('[CERFA] Chargement du PDF depuis:', CERFA_PATH);

        let pdfResponse = await fetch(CERFA_PATH);

        if (!pdfResponse.ok) {
            // Fallback: essayer depuis le dossier public
            console.warn('[CERFA] Asset non trouvé, tentative depuis /cerfa/...');
            const fallbackPath = `${window.location.origin}/cerfa/cerfa_15497-04.pdf`;
            pdfResponse = await fetch(fallbackPath);
            if (!pdfResponse.ok) {
                throw new Error(`Impossible de charger le formulaire CERFA (${pdfResponse.status})`);
            }
        }

        console.log('[CERFA] PDF chargé avec succès');
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
                        console.log(`[CERFA] ✓ Rempli: ${fieldName} = "${textValue}"`);
                    }
                } else {
                    console.log(`[CERFA] ✗ Champ introuvable: ${fieldName}`);
                }
            } catch (e) {
                console.log(`[CERFA] ✗ Erreur ${fieldName}: ${e.message}`);
            }
        };

        // Helper pour cocher une case
        const checkBox = (fieldName, shouldCheck) => {
            try {
                if (shouldCheck) {
                    const field = form.getCheckBox(fieldName);
                    if (field) {
                        field.check();
                        logger.log(`[CERFA] Coché: ${fieldName}`);
                    }
                }
            } catch (e) {
                logger.log(`[CERFA] Checkbox non trouvée: ${fieldName}`);
            }
        };

        // ===== REMPLISSAGE DES CHAMPS =====

        // Numéro de fiche
        fillTextField('Fiche_no', data.ficheNo || '');

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
        // HCFC
        checkBox('Case_HCFC_2', data.categorie === 'HCFC_2');
        checkBox('Case_HCFC_30', data.categorie === 'HCFC_30');
        checkBox('Case_HCFC_300', data.categorie === 'HCFC_300');
        // HFC
        checkBox('Case_HFC_5', data.categorie === 'HFC_5');
        checkBox('Case_HFC_50', data.categorie === 'HFC_50');
        checkBox('Case_HFC_500', data.categorie === 'HFC_500');
        // HFO
        checkBox('Case_HFO_1', data.categorie === 'HFO_1');
        checkBox('Case_HFO_10', data.categorie === 'HFO_10');
        checkBox('Case_HFO_100', data.categorie === 'HFO_100');

        // Fréquence de contrôle d'étanchéité (section 7)
        // Sans système de détection
        checkBox('Case_Sans_12m', data.frequenceControle === 'sans_12m');
        checkBox('Case_Sans_6m', data.frequenceControle === 'sans_6m');
        checkBox('Case_Sans_3m', data.frequenceControle === 'sans_3m');
        // Avec système de détection
        checkBox('Case_Avec_24m', data.frequenceControle === 'avec_24m');
        checkBox('Case_Avec_12m', data.frequenceControle === 'avec_12m');
        checkBox('Case_Avec_6m', data.frequenceControle === 'avec_6m');

        // Localisation des fuites - Support CerfaPage (fuiteLocalisation) et CerfaGeneratorModal
        fillTextField('Fuite_Loca_1', data.fuiteLoca1 || data.fuiteLocalisation || data.localisationFuite1 || '');
        checkBox('Case_Rep_Fuite1_realisee', data.reparationFuite1Realisee || data.fuiteReparation === 'oui');
        checkBox('Case_Rep_Fuite1_AFaire', data.reparationFuite1AFaire || data.fuiteReparation === 'non');

        fillTextField('Fuite_Loca_2', data.fuiteLoca2 || data.localisationFuite2 || '');
        checkBox('Case_Rep_Fuite2_realisee', data.reparationFuite2Realisee);
        checkBox('Case_Rep_Fuite2_AFaire', data.reparationFuite2AFaire);

        fillTextField('Fuite_Loca_3', data.fuiteLoca3 || data.localisationFuite3 || '');
        checkBox('Case_Rep_Fuite3_realisee', data.reparationFuite3Realisee);
        checkBox('Case_Rep_Fuite3_AFaire', data.reparationFuite3AFaire);

        // Quantités de fluide (section 11) - Support CerfaPage (fluideXxx) et CerfaGeneratorModal
        fillTextField('11_Quantite', data.quantiteFluide || data.fluideChargeInitiale || '');
        fillTextField('11_QA', data.quantiteRecuperee || data.fluideQuantiteRecuperee || '');
        // Dénomination du fluide - support des deux formats
        fillTextField('11_Denom', data.denominationFluide || data.fluide || data.fluideDesignation || '');
        fillTextField('11_QB', data.quantiteChargee || '');
        fillTextField('11_QC', data.quantiteAjoutee || data.fluideQuantiteAjoutee || '');
        fillTextField('11_QDE', data.quantiteDE || data.fluideQuantiteReintroduite || '');
        fillTextField('11_QD', data.quantiteD || '');
        fillTextField('11_BSFF', data.bsffNumber || '');
        fillTextField('11_QE', data.quantiteE || '');
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
        fillTextField('Sign_Operateur_Qualite', data.technicianQualite || data.qualification || 'Technicien');
        fillTextField('Sign_Operateur_Date', data.date || dateIntervention);

        // Signature détenteur/client
        const detenteurNom = data.clientSignatureName || data.detenteurNom || `${data.clientFirstName || ''} ${data.clientName || ''}`.trim();
        fillTextField('Sign_Detenteur_Nom', detenteurNom);
        fillTextField('Sign_Detenteur_Qualite', data.clientQualite || 'Propriétaire');
        fillTextField('Sign_Detenteur_Date', data.clientSignatureDate || data.date || dateIntervention);

        // Aplatir le formulaire pour figer les données
        form.flatten();

        // Générer le PDF
        const filledPdfBytes = await pdfDoc.save();

        // Créer et retourner le Blob
        return new Blob([filledPdfBytes], { type: 'application/pdf' });
    } catch (e) {
        console.error('Erreur remplissage CERFA:', e);
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
        console.error('Erreur sauvegarde historique:', e);
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
