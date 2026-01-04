// =============================
// FILE: src/pages/CerfaPage.js
// Formulaire CERFA 15497-04 - Fiche d'intervention fluides frigorigènes
// Optimisé pour mobile
// =============================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    fillCerfa15497,
    downloadCerfa,
    getCompanyInfo,
    saveCompanyInfo,
    saveGenerationRecord
} from '../utils/cerfaService';
import SignaturePad from '../components/SignaturePad';
import '../components/CerfaGeneratorModal.css';

// GWP (Global Warming Potential) des fluides frigorigènes - pour calcul teqCO2
const GWP_VALUES = {
    'R-32': 675,
    'R-410A': 2088,
    'R-407C': 1774,
    'R-134a': 1430,
    'R-22': 1810,
    'R-290': 3,      // Propane
    'R-600a': 3,     // Isobutane
    'R-404A': 3922,
    'R-507A': 3985,
    'R-448A': 1387,
    'R-449A': 1397,
    'R-452A': 2140,
    'R-454B': 466,
    'R-1234yf': 4,
    'R-1234ze': 7,
};

// Classification des fluides par catégorie (HCFC, HFC/PFC, HFO)
const FLUID_CATEGORIES = {
    // HCFC (Hydrochlorofluorocarbures) - basé sur kg
    'R-22': 'HCFC',
    // HFC (Hydrofluorocarbures) - basé sur teqCO2
    'R-32': 'HFC',
    'R-410A': 'HFC',
    'R-407C': 'HFC',
    'R-134a': 'HFC',
    'R-404A': 'HFC',
    'R-507A': 'HFC',
    'R-448A': 'HFC',
    'R-449A': 'HFC',
    'R-452A': 'HFC',
    'R-454B': 'HFC',
    // HFO (Hydrofluorooléfines) - basé sur kg
    'R-1234yf': 'HFO',
    'R-1234ze': 'HFO',
    // Hydrocarbures naturels (considérés comme HFO pour la fréquence)
    'R-290': 'HFO',
    'R-600a': 'HFO',
};

// Calcul de la fréquence minimale de contrôle périodique
const calculateControlFrequency = (fluidType, chargeKg, teqCO2) => {
    const category = FLUID_CATEGORIES[fluidType];
    const charge = parseFloat(chargeKg) || 0;
    const teq = parseFloat(teqCO2) || 0;

    if (!category) return null;

    if (category === 'HCFC') {
        // HCFC basé sur kg
        if (charge >= 300) return { months: 3, label: '3 mois' };
        if (charge >= 30) return { months: 6, label: '6 mois' };
        if (charge >= 2) return { months: 12, label: '12 mois' };
        return null; // Pas de contrôle obligatoire sous 2 kg
    }

    if (category === 'HFC') {
        // HFC/PFC basé sur teqCO2
        if (teq >= 500) return { months: 3, label: '3 mois' };
        if (teq >= 50) return { months: 6, label: '6 mois' };
        if (teq >= 5) return { months: 12, label: '12 mois' };
        return null; // Pas de contrôle obligatoire sous 5 teqCO2
    }

    if (category === 'HFO') {
        // HFO basé sur kg
        if (charge >= 100) return { months: 6, label: '6 mois' };
        if (charge >= 10) return { months: 12, label: '12 mois' };
        if (charge >= 1) return { months: 24, label: '24 mois' };
        return null; // Pas de contrôle obligatoire sous 1 kg
    }

    return null;
};

function CerfaPage() {
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        // INTERVENANT
        intervenantNom: '',
        intervenantAdresse: '',
        intervenantTel: '',
        intervenantAttestation: '',
        intervenantSiret: '',

        // DÉTENTEUR DE L'ÉQUIPEMENT
        detenteurNom: '',
        detenteurAdresse: '',
        detenteurTel: '',
        detenteurSiret: '',

        // IDENTIFICATION DE L'ÉQUIPEMENT
        typeEquipement: '',
        marque: '',
        modele: '',
        numeroSerie: '',
        dateMiseService: '',
        emplacement: '',
        detecteurId: '', // N° détecteur manuel de fuites

        // INTERVENTION
        dateIntervention: new Date().toLocaleDateString('fr-FR'),

        // Nature de l'intervention (cases à cocher)
        assemblage: false, // Assemblage de l'équipement
        natureMiseEnService: false,
        modification: false, // Modification de l'équipement
        natureControleEtancheite: false,
        controleNonPeriodique: false, // Contrôle d'étanchéité non périodique
        natureMaintenance: false,
        natureReparationFuite: false,
        natureDemontage: false,
        natureDemantelement: false,
        natureAutre: false,
        natureAutreTexte: '',

        // Système permanent de détection de fuites
        systemeDetectionPermanent: '', // 'oui' ou 'non'

        // Fluide frigorigène
        fluideDesignation: '',
        fluideChargeInitiale: '',

        // Section 11 - Manipulation du fluide frigorigène
        // Quantités chargées (A+B+C)
        fluideVierge: '',           // A - Fluide vierge
        fluideRecycle: '',          // B - Fluide recyclé (récupéré et réintroduit)
        fluideRegenere: '',         // C - Fluide régénéré
        // Quantités récupérées (D+E)
        fluideTraitement: '',       // D - Fluide destiné au traitement
        fluideConserve: '',         // E - Fluide conservé pour réutilisation
        // Autres champs section 11
        denominationChangement: '', // Dénomination si changement de fluide
        bsffNumber: '',             // Numéro BSFF (Trackdéchets)
        contenantId: '',            // Identification du contenant

        // Section 12 - Classification déchets ADR/RID
        dechetUN1078: false,        // UN 1078 - Gaz non inflammable
        dechetUN3161: false,        // UN 3161 - Gaz inflammable
        autreDechetNonInflammable: '',
        autreDechetInflammable: '',

        // Legacy fields (pour compatibilité)
        fluideQuantiteRecuperee: '',
        fluideQuantiteReintroduite: '',
        fluideQuantiteAjoutee: '',
        fluideOrigine: '',

        // Détection de fuite
        fuiteDetectee: '',
        fuiteLocalisation: '',
        fuiteLocalisation2: '',
        fuiteLocalisation3: '',
        fuiteReparation: '',
        fuiteReparation2: '',
        fuiteReparation3: '',

        // Observations
        observations: '',

        // Signatures
        signatureOperateur: null,
        signatureDetenteur: null,
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [toast, setToast] = useState(null);

    // Calcul automatique du teqCO2 basé sur le fluide et la charge
    const calculatedTeqCO2 = useMemo(() => {
        const gwp = GWP_VALUES[formData.fluideDesignation] || 0;
        const charge = parseFloat(formData.fluideChargeInitiale) || 0;
        if (gwp && charge) {
            // teqCO2 = charge (kg) * GWP / 1000
            return ((charge * gwp) / 1000).toFixed(2);
        }
        return '';
    }, [formData.fluideDesignation, formData.fluideChargeInitiale]);

    // Calcul des totaux chargés (A+B+C) et récupérés (D+E)
    const totaux = useMemo(() => {
        const a = parseFloat(formData.fluideVierge) || 0;
        const b = parseFloat(formData.fluideRecycle) || 0;
        const c = parseFloat(formData.fluideRegenere) || 0;
        const d = parseFloat(formData.fluideTraitement) || 0;
        const e = parseFloat(formData.fluideConserve) || 0;
        return {
            charge: (a + b + c).toFixed(2),
            recupere: (d + e).toFixed(2)
        };
    }, [formData.fluideVierge, formData.fluideRecycle, formData.fluideRegenere, formData.fluideTraitement, formData.fluideConserve]);

    // Calcul automatique de la fréquence de contrôle périodique
    const controlFrequency = useMemo(() => {
        return calculateControlFrequency(
            formData.fluideDesignation,
            formData.fluideChargeInitiale,
            calculatedTeqCO2
        );
    }, [formData.fluideDesignation, formData.fluideChargeInitiale, calculatedTeqCO2]);

    // Catégorie du fluide (HCFC, HFC, HFO)
    const fluidCategory = useMemo(() => {
        return FLUID_CATEGORIES[formData.fluideDesignation] || null;
    }, [formData.fluideDesignation]);

    // Charger les données depuis les paramètres URL ou localStorage
    useEffect(() => {
        const data = searchParams.get('data');
        if (data) {
            try {
                const parsedData = JSON.parse(decodeURIComponent(data));
                setFormData(prev => ({ ...prev, ...parsedData }));
            } catch (e) {
                console.error('Erreur de parsing des données CERFA:', e);
            }
        }

        // Charger les infos entreprise sauvegardées
        const companyInfo = getCompanyInfo();
        if (companyInfo) {
            setFormData(prev => ({
                ...prev,
                intervenantNom: companyInfo.companyName || prev.intervenantNom,
                intervenantAdresse: companyInfo.address || prev.intervenantAdresse,
                intervenantSiret: companyInfo.siret || prev.intervenantSiret,
            }));
        }
    }, [searchParams]);

    // Gérer les changements de formulaire
    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Gérer les checkboxes
    const handleCheckbox = useCallback((field) => {
        setFormData(prev => ({ ...prev, [field]: !prev[field] }));
    }, []);

    // Afficher un toast
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Sauvegarder les infos intervenant
    const handleSaveIntervenant = useCallback(() => {
        const companyData = {
            companyName: formData.intervenantNom,
            address: formData.intervenantAdresse,
            siret: formData.intervenantSiret,
        };
        if (saveCompanyInfo(companyData)) {
            showToast('Informations intervenant sauvegardées', 'success');
        }
    }, [formData, showToast]);

    // Générer le CERFA
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        try {
            // Enrichir les données avec les calculs automatiques
            const enrichedData = {
                ...formData,
                teqCO2: calculatedTeqCO2,
                quantiteChargeeTotal: totaux.charge,
                quantiteRecupereeTotal: totaux.recupere,
                // Fréquence de contrôle périodique
                frequenceControle: controlFrequency ? controlFrequency.label : '',
                categorieFluid: fluidCategory || '',
            };

            // Passer les données au service PDF
            const pdfBlob = await fillCerfa15497(enrichedData);

            const clientName = (formData.detenteurNom || 'client').replace(/\s+/g, '_');
            const date = new Date().toISOString().split('T')[0];
            const filename = `CERFA_15497_${clientName}_${date}.pdf`;

            downloadCerfa(pdfBlob, filename);

            saveGenerationRecord({
                type: 'cerfa_15497',
                sourceType: 'manual',
                clientName: formData.detenteurNom,
                filename
            });

            showToast('CERFA généré avec succès !', 'success');
        } catch (error) {
            console.error('Erreur génération CERFA:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [formData, calculatedTeqCO2, totaux, controlFrequency, fluidCategory, showToast]);

    return (
        <div className="cerfa-page">
            {/* Toast notification */}
            {toast && (
                <div className={`cerfa-toast cerfa-toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}

            <div className="cerfa-page-container">
                {/* Header */}
                <div className="cerfa-page-header">
                    <div className="cerfa-modal-title">
                        <span className="cerfa-icon">📄</span>
                        <div>
                            <h1>CERFA 15497-04</h1>
                            <p>Fiche d'intervention - Fluides frigorigènes</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="cerfa-page-body">

                    {/* Section 1: INTERVENANT */}
                    <section className="cerfa-section">
                        <h3>🔧 1. INTERVENANT</h3>
                        <div className="cerfa-form-group">
                            <label>Nom et prénom ou raison sociale *</label>
                            <input
                                type="text"
                                value={formData.intervenantNom}
                                onChange={(e) => handleChange('intervenantNom', e.target.value)}
                                placeholder="SRP - Services Réparation Plomberie"
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>Adresse</label>
                            <input
                                type="text"
                                value={formData.intervenantAdresse}
                                onChange={(e) => handleChange('intervenantAdresse', e.target.value)}
                                placeholder="Champtercier, 04660"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>N° de téléphone</label>
                                <input
                                    type="tel"
                                    value={formData.intervenantTel}
                                    onChange={(e) => handleChange('intervenantTel', e.target.value)}
                                    placeholder="06 27 68 10 22"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>N° SIRET</label>
                                <input
                                    type="text"
                                    value={formData.intervenantSiret}
                                    onChange={(e) => handleChange('intervenantSiret', e.target.value)}
                                    placeholder="123 456 789 00012"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>N° d'attestation de capacité</label>
                            <input
                                type="text"
                                value={formData.intervenantAttestation}
                                onChange={(e) => handleChange('intervenantAttestation', e.target.value)}
                                placeholder="Numéro d'attestation"
                            />
                        </div>
                        <button
                            type="button"
                            className="cerfa-reload-btn"
                            onClick={handleSaveIntervenant}
                        >
                            💾 Sauvegarder ces infos intervenant
                        </button>
                    </section>

                    {/* Section 2: DÉTENTEUR DE L'ÉQUIPEMENT */}
                    <section className="cerfa-section">
                        <h3>👤 2. DÉTENTEUR DE L'ÉQUIPEMENT</h3>
                        <div className="cerfa-form-group">
                            <label>Nom et prénom ou raison sociale *</label>
                            <input
                                type="text"
                                value={formData.detenteurNom}
                                onChange={(e) => handleChange('detenteurNom', e.target.value)}
                                placeholder="Nom du client"
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>Adresse</label>
                            <input
                                type="text"
                                value={formData.detenteurAdresse}
                                onChange={(e) => handleChange('detenteurAdresse', e.target.value)}
                                placeholder="Adresse complète"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>N° de téléphone</label>
                                <input
                                    type="tel"
                                    value={formData.detenteurTel}
                                    onChange={(e) => handleChange('detenteurTel', e.target.value)}
                                    placeholder="06 XX XX XX XX"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>N° SIRET (si personne morale)</label>
                                <input
                                    type="text"
                                    value={formData.detenteurSiret}
                                    onChange={(e) => handleChange('detenteurSiret', e.target.value)}
                                    placeholder="Optionnel"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 3: IDENTIFICATION DE L'ÉQUIPEMENT */}
                    <section className="cerfa-section">
                        <h3>❄️ 3. IDENTIFICATION DE L'ÉQUIPEMENT</h3>
                        <div className="cerfa-form-group">
                            <label>Type d'équipement *</label>
                            <select
                                value={formData.typeEquipement}
                                onChange={(e) => handleChange('typeEquipement', e.target.value)}
                            >
                                <option value="">-- Sélectionner --</option>
                                <option value="Climatiseur fixe">Climatiseur fixe</option>
                                <option value="Climatiseur mobile">Climatiseur mobile</option>
                                <option value="Pompe à chaleur air/air">Pompe à chaleur air/air</option>
                                <option value="Pompe à chaleur air/eau">Pompe à chaleur air/eau</option>
                                <option value="Pompe à chaleur eau/eau">Pompe à chaleur eau/eau</option>
                                <option value="Système réfrigération">Système réfrigération</option>
                                <option value="Groupe froid">Groupe froid</option>
                                <option value="Autre">Autre</option>
                            </select>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Marque</label>
                                <input
                                    type="text"
                                    value={formData.marque}
                                    onChange={(e) => handleChange('marque', e.target.value)}
                                    placeholder="Daikin, Mitsubishi..."
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Modèle</label>
                                <input
                                    type="text"
                                    value={formData.modele}
                                    onChange={(e) => handleChange('modele', e.target.value)}
                                    placeholder="Modèle"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>N° de série</label>
                                <input
                                    type="text"
                                    value={formData.numeroSerie}
                                    onChange={(e) => handleChange('numeroSerie', e.target.value)}
                                    placeholder="Numéro de série"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Date mise en service</label>
                                <input
                                    type="text"
                                    value={formData.dateMiseService}
                                    onChange={(e) => handleChange('dateMiseService', e.target.value)}
                                    placeholder="JJ/MM/AAAA"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Emplacement</label>
                            <input
                                type="text"
                                value={formData.emplacement}
                                onChange={(e) => handleChange('emplacement', e.target.value)}
                                placeholder="Ex: Local technique, Extérieur..."
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>N° détecteur manuel de fuites</label>
                            <input
                                type="text"
                                value={formData.detecteurId}
                                onChange={(e) => handleChange('detecteurId', e.target.value)}
                                placeholder="Identification du détecteur"
                            />
                        </div>
                    </section>

                    {/* Section 4: INTERVENTION */}
                    <section className="cerfa-section">
                        <h3>🛠️ 4. INTERVENTION</h3>
                        <div className="cerfa-form-group">
                            <label>Date de l'intervention *</label>
                            <input
                                type="text"
                                value={formData.dateIntervention}
                                onChange={(e) => handleChange('dateIntervention', e.target.value)}
                                placeholder={new Date().toLocaleDateString('fr-FR')}
                            />
                        </div>

                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'rgba(255,255,255,0.7)' }}>
                            Nature de l'intervention (cocher) :
                        </label>
                        <div className="cerfa-checkboxes">
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.assemblage}
                                    onChange={() => handleCheckbox('assemblage')}
                                />
                                <span>Assemblage de l'équipement</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureMiseEnService}
                                    onChange={() => handleCheckbox('natureMiseEnService')}
                                />
                                <span>Mise en service</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.modification}
                                    onChange={() => handleCheckbox('modification')}
                                />
                                <span>Modification de l'équipement</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureControleEtancheite}
                                    onChange={() => handleCheckbox('natureControleEtancheite')}
                                />
                                <span>Contrôle d'étanchéité périodique</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.controleNonPeriodique}
                                    onChange={() => handleCheckbox('controleNonPeriodique')}
                                />
                                <span>Contrôle d'étanchéité non périodique</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureMaintenance}
                                    onChange={() => handleCheckbox('natureMaintenance')}
                                />
                                <span>Maintenance / Entretien</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureDemantelement}
                                    onChange={() => handleCheckbox('natureDemantelement')}
                                />
                                <span>Démantèlement</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureAutre}
                                    onChange={() => handleCheckbox('natureAutre')}
                                />
                                <span>Autre</span>
                            </label>
                        </div>
                        {formData.natureAutre && (
                            <div className="cerfa-form-group">
                                <label>Préciser :</label>
                                <input
                                    type="text"
                                    value={formData.natureAutreTexte}
                                    onChange={(e) => handleChange('natureAutreTexte', e.target.value)}
                                    placeholder="Précisez la nature de l'intervention"
                                />
                            </div>
                        )}

                        <div className="cerfa-form-group" style={{ marginTop: '1rem' }}>
                            <label>Présence d'un système permanent de détection de fuites :</label>
                            <div className="cerfa-checkboxes" style={{ flexDirection: 'row', gap: '2rem' }}>
                                <label className="cerfa-checkbox">
                                    <input
                                        type="radio"
                                        name="systemeDetection"
                                        checked={formData.systemeDetectionPermanent === 'oui'}
                                        onChange={() => handleChange('systemeDetectionPermanent', 'oui')}
                                    />
                                    <span>OUI</span>
                                </label>
                                <label className="cerfa-checkbox">
                                    <input
                                        type="radio"
                                        name="systemeDetection"
                                        checked={formData.systemeDetectionPermanent === 'non'}
                                        onChange={() => handleChange('systemeDetectionPermanent', 'non')}
                                    />
                                    <span>NON</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Section 5: ÉQUIPEMENT - FLUIDE */}
                    <section className="cerfa-section">
                        <h3>💨 5. ÉQUIPEMENT - FLUIDE</h3>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Désignation du fluide *</label>
                                <select
                                    value={formData.fluideDesignation}
                                    onChange={(e) => handleChange('fluideDesignation', e.target.value)}
                                >
                                    <option value="">-- Sélectionner --</option>
                                    <option value="R-32">R-32 (GWP: 675)</option>
                                    <option value="R-410A">R-410A (GWP: 2088)</option>
                                    <option value="R-407C">R-407C (GWP: 1774)</option>
                                    <option value="R-134a">R-134a (GWP: 1430)</option>
                                    <option value="R-404A">R-404A (GWP: 3922)</option>
                                    <option value="R-507A">R-507A (GWP: 3985)</option>
                                    <option value="R-448A">R-448A (GWP: 1387)</option>
                                    <option value="R-449A">R-449A (GWP: 1397)</option>
                                    <option value="R-22">R-22 (interdit)</option>
                                    <option value="R-290">R-290 Propane (GWP: 3)</option>
                                    <option value="R-600a">R-600a Isobutane (GWP: 3)</option>
                                    <option value="R-1234yf">R-1234yf (GWP: 4)</option>
                                    <option value="Autre">Autre</option>
                                </select>
                            </div>
                            <div className="cerfa-form-group">
                                <label>Charge (kg) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.fluideChargeInitiale}
                                    onChange={(e) => handleChange('fluideChargeInitiale', e.target.value)}
                                    placeholder="2.5"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>teqCO2 (auto)</label>
                                <input
                                    type="text"
                                    value={calculatedTeqCO2 ? `${calculatedTeqCO2} t` : ''}
                                    readOnly
                                    style={{ background: 'rgba(255,255,255,0.1)', fontWeight: 'bold' }}
                                    placeholder="Calculé auto"
                                />
                            </div>
                        </div>

                        {/* Affichage de la fréquence de contrôle périodique */}
                        {controlFrequency && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: 'rgba(33, 150, 243, 0.15)',
                                borderRadius: '0.5rem',
                                borderLeft: '4px solid #2196F3'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📅</span>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#2196F3' }}>
                                            Fréquence minimale de contrôle périodique
                                        </div>
                                        <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.9)' }}>
                                            <strong>{controlFrequency.label}</strong>
                                            {fluidCategory && (
                                                <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem', opacity: 0.7 }}>
                                                    ({fluidCategory} - {fluidCategory === 'HFC' ? `${calculatedTeqCO2} teqCO2` : `${formData.fluideChargeInitiale} kg`})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tableau récapitulatif des seuils */}
                        {formData.fluideDesignation && !controlFrequency && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '0.5rem',
                                fontSize: '0.85rem',
                                color: 'rgba(255,255,255,0.6)'
                            }}>
                                ℹ️ Quantité insuffisante pour contrôle périodique obligatoire
                                {fluidCategory === 'HCFC' && ' (seuil: 2 kg min)'}
                                {fluidCategory === 'HFC' && ' (seuil: 5 teqCO2 min)'}
                                {fluidCategory === 'HFO' && ' (seuil: 1 kg min)'}
                            </div>
                        )}
                    </section>

                    {/* Section 11: MANIPULATION DU FLUIDE */}
                    <section className="cerfa-section">
                        <h3>🔄 11. MANIPULATION DU FLUIDE FRIGORIGÈNE</h3>

                        {/* Quantités chargées */}
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(76, 175, 80, 0.1)', borderRadius: '0.5rem', borderLeft: '3px solid #4CAF50' }}>
                            <label style={{ fontWeight: 'bold', color: '#4CAF50', marginBottom: '0.5rem', display: 'block' }}>
                                📥 Quantités CHARGÉES (A+B+C) = {totaux.charge} kg
                            </label>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>A - Fluide vierge (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fluideVierge}
                                        onChange={(e) => handleChange('fluideVierge', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>B - Fluide recyclé (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fluideRecycle}
                                        onChange={(e) => handleChange('fluideRecycle', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>C - Fluide régénéré (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fluideRegenere}
                                        onChange={(e) => handleChange('fluideRegenere', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quantités récupérées */}
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '0.5rem', borderLeft: '3px solid #FF9800' }}>
                            <label style={{ fontWeight: 'bold', color: '#FF9800', marginBottom: '0.5rem', display: 'block' }}>
                                📤 Quantités RÉCUPÉRÉES (D+E) = {totaux.recupere} kg
                            </label>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>D - Destiné au traitement (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fluideTraitement}
                                        onChange={(e) => handleChange('fluideTraitement', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>E - Conservé réutilisation (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.fluideConserve}
                                        onChange={(e) => handleChange('fluideConserve', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Autres informations section 11 */}
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Dénomination si changement fluide</label>
                                <input
                                    type="text"
                                    value={formData.denominationChangement}
                                    onChange={(e) => handleChange('denominationChangement', e.target.value)}
                                    placeholder="Si fluide différent"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>N° BSFF (Trackdéchets)</label>
                                <input
                                    type="text"
                                    value={formData.bsffNumber}
                                    onChange={(e) => handleChange('bsffNumber', e.target.value)}
                                    placeholder="Numéro BSFF"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Identification du/des contenants</label>
                            <input
                                type="text"
                                value={formData.contenantId}
                                onChange={(e) => handleChange('contenantId', e.target.value)}
                                placeholder="N° bouteille, contenant..."
                            />
                        </div>
                    </section>

                    {/* Section 12: CLASSIFICATION DÉCHETS ADR/RID */}
                    <section className="cerfa-section">
                        <h3>⚠️ 12. CLASSIFICATION DÉCHETS ADR/RID</h3>
                        <div className="cerfa-checkboxes">
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.dechetUN1078}
                                    onChange={() => handleCheckbox('dechetUN1078')}
                                />
                                <span>UN 1078 - Gaz frigorigène NSA 2.2 (non inflammable)</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.dechetUN3161}
                                    onChange={() => handleCheckbox('dechetUN3161')}
                                />
                                <span>UN 3161 - Gaz liquéfié inflammable NSA 2.1</span>
                            </label>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Autres fluides non inflammables</label>
                                <input
                                    type="text"
                                    value={formData.autreDechetNonInflammable}
                                    onChange={(e) => handleChange('autreDechetNonInflammable', e.target.value)}
                                    placeholder="Préciser..."
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Autres fluides inflammables</label>
                                <input
                                    type="text"
                                    value={formData.autreDechetInflammable}
                                    onChange={(e) => handleChange('autreDechetInflammable', e.target.value)}
                                    placeholder="Préciser..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 6: DÉTECTION DE FUITE */}
                    <section className="cerfa-section">
                        <h3>🔍 6. DÉTECTION DE FUITE</h3>
                        <div className="cerfa-form-group">
                            <label>Fuite détectée ?</label>
                            <div className="cerfa-checkboxes" style={{ flexDirection: 'row', gap: '2rem' }}>
                                <label className="cerfa-checkbox">
                                    <input
                                        type="radio"
                                        name="fuiteDetectee"
                                        checked={formData.fuiteDetectee === 'oui'}
                                        onChange={() => handleChange('fuiteDetectee', 'oui')}
                                    />
                                    <span>Oui</span>
                                </label>
                                <label className="cerfa-checkbox">
                                    <input
                                        type="radio"
                                        name="fuiteDetectee"
                                        checked={formData.fuiteDetectee === 'non'}
                                        onChange={() => handleChange('fuiteDetectee', 'non')}
                                    />
                                    <span>Non</span>
                                </label>
                            </div>
                        </div>
                        {formData.fuiteDetectee === 'oui' && (
                            <>
                                {/* Fuite 1 */}
                                <div className="cerfa-form-row" style={{ alignItems: 'flex-end' }}>
                                    <div className="cerfa-form-group" style={{ flex: 2 }}>
                                        <label>Fuite n°1 - Localisation</label>
                                        <input
                                            type="text"
                                            value={formData.fuiteLocalisation}
                                            onChange={(e) => handleChange('fuiteLocalisation', e.target.value)}
                                            placeholder="Ex: Raccord haute pression"
                                        />
                                    </div>
                                    <div className="cerfa-form-group" style={{ flex: 1 }}>
                                        <label>Réparation</label>
                                        <select
                                            value={formData.fuiteReparation}
                                            onChange={(e) => handleChange('fuiteReparation', e.target.value)}
                                        >
                                            <option value="">--</option>
                                            <option value="oui">Réalisée</option>
                                            <option value="non">À faire</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Fuite 2 */}
                                <div className="cerfa-form-row" style={{ alignItems: 'flex-end' }}>
                                    <div className="cerfa-form-group" style={{ flex: 2 }}>
                                        <label>Fuite n°2 - Localisation (optionnel)</label>
                                        <input
                                            type="text"
                                            value={formData.fuiteLocalisation2}
                                            onChange={(e) => handleChange('fuiteLocalisation2', e.target.value)}
                                            placeholder="Optionnel"
                                        />
                                    </div>
                                    <div className="cerfa-form-group" style={{ flex: 1 }}>
                                        <label>Réparation</label>
                                        <select
                                            value={formData.fuiteReparation2}
                                            onChange={(e) => handleChange('fuiteReparation2', e.target.value)}
                                        >
                                            <option value="">--</option>
                                            <option value="oui">Réalisée</option>
                                            <option value="non">À faire</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Fuite 3 */}
                                <div className="cerfa-form-row" style={{ alignItems: 'flex-end' }}>
                                    <div className="cerfa-form-group" style={{ flex: 2 }}>
                                        <label>Fuite n°3 - Localisation (optionnel)</label>
                                        <input
                                            type="text"
                                            value={formData.fuiteLocalisation3}
                                            onChange={(e) => handleChange('fuiteLocalisation3', e.target.value)}
                                            placeholder="Optionnel"
                                        />
                                    </div>
                                    <div className="cerfa-form-group" style={{ flex: 1 }}>
                                        <label>Réparation</label>
                                        <select
                                            value={formData.fuiteReparation3}
                                            onChange={(e) => handleChange('fuiteReparation3', e.target.value)}
                                        >
                                            <option value="">--</option>
                                            <option value="oui">Réalisée</option>
                                            <option value="non">À faire</option>
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    {/* Section 7: OBSERVATIONS */}
                    <section className="cerfa-section">
                        <h3>📝 7. OBSERVATIONS</h3>
                        <div className="cerfa-form-group">
                            <textarea
                                value={formData.observations}
                                onChange={(e) => handleChange('observations', e.target.value)}
                                placeholder="Observations, remarques, recommandations..."
                                rows={4}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                    </section>

                    {/* Section 8: SIGNATURES */}
                    <section className="cerfa-section">
                        <h3>✍️ 8. SIGNATURES</h3>

                        {/* Signature Opérateur */}
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <h4 style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.9)' }}>👷 Opérateur / Intervenant</h4>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Nom</label>
                                    <input
                                        type="text"
                                        value={formData.intervenantNom}
                                        onChange={(e) => handleChange('intervenantNom', e.target.value)}
                                        placeholder="Nom de l'intervenant"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Qualité</label>
                                    <input
                                        type="text"
                                        value={formData.intervenantQualite || ''}
                                        onChange={(e) => handleChange('intervenantQualite', e.target.value)}
                                        placeholder="Technicien frigoriste"
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-group">
                                <label>Date</label>
                                <input
                                    type="text"
                                    value={formData.dateIntervention}
                                    readOnly
                                    style={{ opacity: 0.7 }}
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Signature de l'opérateur</label>
                                <SignaturePad
                                    onSave={(dataUrl) => handleChange('signatureOperateur', dataUrl)}
                                    initialValue={formData.signatureOperateur}
                                    width={300}
                                    height={120}
                                />
                            </div>
                        </div>

                        {/* Signature Détenteur */}
                        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                            <h4 style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.9)' }}>👤 Détenteur / Client</h4>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Nom</label>
                                    <input
                                        type="text"
                                        value={formData.detenteurNom}
                                        onChange={(e) => handleChange('detenteurNom', e.target.value)}
                                        placeholder="Nom du client"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Qualité</label>
                                    <input
                                        type="text"
                                        value={formData.detenteurQualite || ''}
                                        onChange={(e) => handleChange('detenteurQualite', e.target.value)}
                                        placeholder="Propriétaire, Gérant..."
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-group">
                                <label>Date</label>
                                <input
                                    type="text"
                                    value={formData.dateIntervention}
                                    readOnly
                                    style={{ opacity: 0.7 }}
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Signature du client</label>
                                <SignaturePad
                                    onSave={(dataUrl) => handleChange('signatureDetenteur', dataUrl)}
                                    initialValue={formData.signatureDetenteur}
                                    width={300}
                                    height={120}
                                />
                            </div>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="cerfa-page-footer">
                    <button
                        type="button"
                        className="cerfa-btn-primary cerfa-btn-large"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <span className="cerfa-spinner"></span>
                                Génération...
                            </>
                        ) : (
                            <>📥 Générer et Télécharger le CERFA</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CerfaPage;
