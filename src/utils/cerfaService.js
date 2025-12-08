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

// =============================
// CERFA 15497-04 FILLING
// =============================

/**
 * Remplit le CERFA 15497-04 (Attestation entretien chaudière gaz)
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

        // Mapper les données vers les champs du PDF
        // Note: Les noms de champs doivent correspondre au PDF fillable
        const fieldMappings = {
            // === PARTIE A - OCCUPANT ===
            'Nom occupant': data.clientName || '',
            'Prénom occupant': data.clientFirstName || '',
            'Adresse occupant': data.clientAddress || '',
            'Code postal occupant': data.clientPostalCode || '',
            'Ville occupant': data.clientCity || '',

            // === PARTIE B - APPAREIL ===
            'Type appareil': data.equipmentType || 'Chaudière gaz',
            'Marque': data.equipmentBrand || '',
            'Modèle': data.equipmentModel || '',
            'Puissance nominale': data.equipmentPower || '',
            'Année installation': data.installationYear || '',
            'Emplacement': data.equipmentLocation || '',

            // === PARTIE C - ENTRETIEN ===
            'Date entretien': data.maintenanceDate || new Date().toLocaleDateString('fr-FR'),
            'Nettoyage brûleur': data.cleanedBurner ? 'Oui' : 'Non',
            'Vérification combustion': data.checkedCombustion ? 'Oui' : 'Non',
            'Mesure CO': data.coLevel || '',
            'Rendement': data.efficiency || '',

            // === PARTIE D - PROFESSIONNEL ===
            'Raison sociale': data.companyName || '',
            'SIRET': data.siret || '',
            'Adresse entreprise': data.companyAddress || '',
            'Qualification': data.qualification || '',
            'Nom technicien': data.technicianName || '',
            'Date': data.date || new Date().toLocaleDateString('fr-FR'),
        };

        // Remplir les champs texte
        for (const [fieldName, value] of Object.entries(fieldMappings)) {
            try {
                const field = form.getTextField(fieldName);
                if (field) {
                    field.setText(String(value));
                }
            } catch {
                // Le champ n'existe pas ou n'est pas du bon type, on ignore
                console.debug(`Champ non trouvé ou incompatible: ${fieldName}`);
            }
        }

        // Gérer les cases à cocher si présentes
        const checkboxMappings = {
            'CB_Nettoyage': data.cleanedBurner,
            'CB_Combustion': data.checkedCombustion,
            'CB_Etancheite': data.checkedSealing,
            'CB_Ventilation': data.checkedVentilation,
            'CB_Evacuation': data.checkedExhaust,
        };

        for (const [fieldName, checked] of Object.entries(checkboxMappings)) {
            try {
                const checkbox = form.getCheckBox(fieldName);
                if (checkbox) {
                    if (checked) {
                        checkbox.check();
                    } else {
                        checkbox.uncheck();
                    }
                }
            } catch {
                // Case à cocher non trouvée, on ignore
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
