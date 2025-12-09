// =============================
// FILE: src/utils/cerfaService.js
// Service pour remplir les formulaires CERFA
// =============================

import { PDFDocument } from 'pdf-lib';

// =============================
// CONSTANTS
// =============================

const CERFA_PATH = '/cerfa/cerfa_15497-04.pdf';

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

        console.log('CERFA Fields:', fieldInfo);
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
        // Charger le PDF template
        const response = await fetch(CERFA_PATH);
        if (!response.ok) {
            throw new Error('Impossible de charger le formulaire CERFA');
        }
        const pdfBytes = await response.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const allFields = form.getFields();

        console.log('[CERFA] Nombre de champs trouvés:', allFields.length);
        console.log('[CERFA] Liste des champs:');
        allFields.forEach((f, i) => console.log(`  [${i}] ${f.getName()} - ${f.constructor.name}`));

        // Préparer les valeurs dans l'ordre des champs du PDF
        // Basé sur l'inspection: les champs sont dans l'ordre XFA
        const textFieldValues = [
            // Index 0-4: Intervenant
            data.intervenantNom || data.companyName || '',      // Intervenant_Nom
            data.intervenantAdresse || data.companyAddress || '', // Intervenant_Adresse
            data.intervenantTel || '',                           // Intervenant_Tel
            data.intervenantAttestation || '',                   // Intervenant_Attestation
            data.intervenantSiret || data.siret || '',           // Intervenant_Siret

            // Index 5-8: Détenteur
            data.detenteurNom || data.clientName || '',          // Detenteur_Nom
            data.detenteurAdresse || data.clientAddress || '',   // Detenteur_Adresse
            data.detenteurTel || '',                             // Detenteur_Tel
            data.detenteurSiret || '',                           // Detenteur_Siret

            // Index 9-14: Équipement
            data.typeEquipement || '',                           // Equipement_Type
            data.marque || '',                                   // Equipement_Marque
            data.modele || '',                                   // Equipement_Modele
            data.numeroSerie || '',                              // Equipement_Serie
            data.dateMiseService || '',                          // Equipement_MiseService
            data.emplacement || '',                              // Equipement_Emplacement

            // Index 15: Intervention
            data.dateIntervention || new Date().toLocaleDateString('fr-FR'), // Intervention_Date
        ];

        // Remplir les champs texte par index
        let textFieldIndex = 0;
        for (const field of allFields) {
            if (field.constructor.name === 'PDFTextField') {
                if (textFieldIndex < textFieldValues.length) {
                    try {
                        field.setText(textFieldValues[textFieldIndex]);
                        console.log(`[CERFA] Rempli champ ${textFieldIndex}: ${field.getName()} = "${textFieldValues[textFieldIndex]}"`);
                    } catch (e) {
                        console.warn(`[CERFA] Erreur remplissage champ ${textFieldIndex}:`, e.message);
                    }
                }
                textFieldIndex++;
            }
        }

        // Gérer les cases à cocher par index
        const checkboxValues = [
            data.natureMiseEnService,      // Nature_MiseService
            data.natureControleEtancheite, // Nature_Controle
            data.natureMaintenance,        // Nature_Maintenance
            data.natureReparationFuite,    // Nature_Reparation
            data.natureDemontage,          // Nature_Demontage
            data.natureDemantelement,      // Nature_Demantelement
            data.natureAutre,              // Nature_Autre
            data.fuiteDetectee === 'oui',  // Fuite_Detect_Oui
            data.fuiteDetectee === 'non',  // Fuite_Detect_Non
            data.fuiteReparation === 'oui',// Fuite_Repar_Oui
            data.fuiteReparation === 'non',// Fuite_Repar_Non
        ];

        let checkboxIndex = 0;
        for (const field of allFields) {
            if (field.constructor.name === 'PDFCheckBox') {
                if (checkboxIndex < checkboxValues.length && checkboxValues[checkboxIndex]) {
                    try {
                        field.check();
                        console.log(`[CERFA] Coché checkbox ${checkboxIndex}: ${field.getName()}`);
                    } catch (e) {
                        console.warn(`[CERFA] Erreur checkbox ${checkboxIndex}:`, e.message);
                    }
                }
                checkboxIndex++;
            }
        }

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
