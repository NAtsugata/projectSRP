// =============================
// FILE: src/components/CerfaGeneratorModal.js
// Modal pour générer et télécharger le CERFA 15497-04
// Fiche d'intervention sur équipements contenant des fluides frigorigènes
// =============================

import React, { useState, useEffect, useCallback } from 'react';
import logger from '../utils/logger';
import {
    fillCerfa15497,
    downloadCerfa,
    getCompanyInfo,
    saveCompanyInfo,
    saveEquipmentInfo,
    saveGenerationRecord,
    mapOrganizationToCompanyInfo
} from '../utils/cerfaService';
import './CerfaGeneratorModal.css';

// =============================
// COMPONENT
// =============================

function CerfaGeneratorModal({
    isOpen,
    onClose,
    initialData = {},
    sourceType = 'intervention',
    sourceId = null,
    showToast,
    organization = null
}) {
    const [formData, setFormData] = useState({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [showCompanySettings, setShowCompanySettings] = useState(false);
    const [saveEquipment, setSaveEquipment] = useState(true);
    const [activeTab, setActiveTab] = useState('general');

    // Charger les données initiales
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                ...initialData,
                fuiteDetectee: initialData.fuiteDetectee || 'non'
            });
        }
    }, [isOpen, initialData]);

    // Gérer les changements de formulaire
    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Gérer les checkboxes
    const handleCheckbox = useCallback((field) => {
        setFormData(prev => ({ ...prev, [field]: !prev[field] }));
    }, []);

    // Sauvegarder les infos entreprise
    const handleSaveCompanyInfo = useCallback(() => {
        const companyData = {
            companyName: formData.companyName,
            siret: formData.siret,
            address: formData.companyAddress,
            qualification: formData.qualification,
            attestationNumber: formData.attestationNumber
        };
        if (saveCompanyInfo(companyData)) {
            showToast?.('Informations entreprise sauvegardées', 'success');
            setShowCompanySettings(false);
        }
    }, [formData, showToast]);

    // Générer le CERFA
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);

        // Debug: Log form data before generation
        logger.log('[CERFA Modal] === formData avant génération ===');
        logger.log('[CERFA Modal] fluide:', formData.fluide);
        logger.log('[CERFA Modal] denominationFluide:', formData.denominationFluide);
        logger.log('[CERFA Modal] charge:', formData.charge);
        logger.log('[CERFA Modal] technicianName:', formData.technicianName);
        logger.log('[CERFA Modal] clientName:', formData.clientName);
        logger.log('[CERFA Modal] clientSignatureName:', formData.clientSignatureName);
        logger.log('[CERFA Modal] date:', formData.date);
        logger.log('[CERFA Modal] Full formData:', JSON.stringify(formData, null, 2));

        try {
            if (saveEquipment && sourceId) {
                const equipmentData = {
                    type: formData.equipmentType,
                    brand: formData.equipmentBrand,
                    model: formData.equipmentModel,
                    fluide: formData.fluide,
                    charge: formData.charge,
                    location: formData.equipmentLocation
                };
                saveEquipmentInfo(sourceId, equipmentData);
            }

            const pdfBlob = await fillCerfa15497(formData);
            const clientName = (formData.clientName || 'client').replace(/\s+/g, '_');
            const date = new Date().toISOString().split('T')[0];
            const filename = `CERFA_15497_${clientName}_${date}.pdf`;

            await downloadCerfa(pdfBlob, filename);

            saveGenerationRecord({
                type: 'cerfa_15497',
                sourceType,
                sourceId,
                clientName: formData.clientName,
                filename
            });

            showToast?.('CERFA généré avec succès !', 'success');
            onClose();
        } catch (error) {
            logger.error('Erreur génération CERFA:', error);
            showToast?.(`Erreur: ${error.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [formData, sourceType, sourceId, saveEquipment, showToast, onClose]);

    // Charger les settings entreprise (Supabase en priorité, localStorage en fallback)
    const handleLoadCompanySettings = useCallback(() => {
        const companyInfo = organization
            ? mapOrganizationToCompanyInfo(organization)
            : getCompanyInfo();
        setFormData(prev => ({
            ...prev,
            companyName: companyInfo.companyName,
            siret: companyInfo.siret,
            companyAddress: companyInfo.address,
            qualification: companyInfo.qualification,
            attestationNumber: companyInfo.attestationNumber
        }));
    }, [organization]);

    // Charger automatiquement les données entreprise à l'ouverture
    useEffect(() => {
        if (isOpen && organization) {
            handleLoadCompanySettings();
        }
    }, [isOpen, organization, handleLoadCompanySettings]);

    if (!isOpen) return null;

    const tabs = [
        { id: 'general', label: '📋 Général', icon: '📋' },
        { id: 'equipement', label: '🔧 Équipement', icon: '🔧' },
        { id: 'intervention', label: '🛠️ Intervention', icon: '🛠️' },
        { id: 'fluides', label: '💨 Fluides', icon: '💨' },
        { id: 'signatures', label: '✍️ Signatures', icon: '✍️' }
    ];

    return (
        <div className="cerfa-modal-overlay" onClick={onClose}>
            <div className="cerfa-modal cerfa-modal-large" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="cerfa-modal-header">
                    <div className="cerfa-modal-title">
                        <span className="cerfa-icon">📄</span>
                        <div>
                            <h2>CERFA 15497-04</h2>
                            <p>Fiche d'intervention - Fluides frigorigènes</p>
                        </div>
                    </div>
                    <button className="cerfa-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div className="cerfa-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`cerfa-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="cerfa-modal-body">

                    {/* TAB: Général */}
                    {activeTab === 'general' && (
                        <>
                            {/* Numéro de fiche */}
                            <section className="cerfa-section">
                                <h3>📋 Identification</h3>
                                <div className="cerfa-form-row">
                                    <div className="cerfa-form-group">
                                        <label>N° de fiche</label>
                                        <input
                                            type="text"
                                            value={formData.ficheNo || ''}
                                            onChange={(e) => handleChange('ficheNo', e.target.value)}
                                            placeholder="2024-001"
                                        />
                                    </div>
                                    <div className="cerfa-form-group">
                                        <label>Date d'intervention</label>
                                        <input
                                            type="text"
                                            value={formData.dateIntervention || ''}
                                            onChange={(e) => handleChange('dateIntervention', e.target.value)}
                                            placeholder="04/01/2026"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Opérateur / Entreprise */}
                            <section className="cerfa-section">
                                <div className="cerfa-section-header">
                                    <h3>🏢 Opérateur (Entreprise)</h3>
                                    <button
                                        type="button"
                                        className="cerfa-settings-btn"
                                        onClick={() => setShowCompanySettings(!showCompanySettings)}
                                    >
                                        ⚙️ {showCompanySettings ? 'Masquer' : 'Modifier'}
                                    </button>
                                </div>

                                {showCompanySettings ? (
                                    <>
                                        <div className="cerfa-form-group">
                                            <label>Raison sociale</label>
                                            <input
                                                type="text"
                                                value={formData.companyName || ''}
                                                onChange={(e) => handleChange('companyName', e.target.value)}
                                                placeholder="SRP - Services Réparation Plomberie"
                                            />
                                        </div>
                                        <div className="cerfa-form-group">
                                            <label>Adresse</label>
                                            <input
                                                type="text"
                                                value={formData.companyAddress || ''}
                                                onChange={(e) => handleChange('companyAddress', e.target.value)}
                                                placeholder="Champtercier, 04660"
                                            />
                                        </div>
                                        <div className="cerfa-form-row">
                                            <div className="cerfa-form-group">
                                                <label>SIRET</label>
                                                <input
                                                    type="text"
                                                    value={formData.siret || ''}
                                                    onChange={(e) => handleChange('siret', e.target.value)}
                                                    placeholder="123 456 789 00012"
                                                />
                                            </div>
                                            <div className="cerfa-form-group">
                                                <label>N° Attestation capacité</label>
                                                <input
                                                    type="text"
                                                    value={formData.attestationNumber || ''}
                                                    onChange={(e) => handleChange('attestationNumber', e.target.value)}
                                                    placeholder="AC-XXXX-XXXX"
                                                />
                                            </div>
                                        </div>
                                        <div className="cerfa-form-group">
                                            <label>Qualification</label>
                                            <input
                                                type="text"
                                                value={formData.qualification || ''}
                                                onChange={(e) => handleChange('qualification', e.target.value)}
                                                placeholder="Catégorie I"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="cerfa-save-company-btn"
                                            onClick={handleSaveCompanyInfo}
                                        >
                                            💾 Sauvegarder
                                        </button>
                                    </>
                                ) : (
                                    <div className="cerfa-company-summary">
                                        <p><strong>{formData.companyName || 'Non configuré'}</strong></p>
                                        {formData.companyAddress && <p>{formData.companyAddress}</p>}
                                        {formData.siret && <p>SIRET: {formData.siret}</p>}
                                        {formData.attestationNumber && <p>Attestation: {formData.attestationNumber}</p>}
                                        <button
                                            type="button"
                                            className="cerfa-reload-btn"
                                            onClick={handleLoadCompanySettings}
                                        >
                                            🔄 Charger paramètres
                                        </button>
                                    </div>
                                )}
                            </section>

                            {/* Détenteur / Client */}
                            <section className="cerfa-section">
                                <h3>👤 Détenteur de l'équipement</h3>
                                <div className="cerfa-form-row">
                                    <div className="cerfa-form-group">
                                        <label>Prénom</label>
                                        <input
                                            type="text"
                                            value={formData.clientFirstName || ''}
                                            onChange={(e) => handleChange('clientFirstName', e.target.value)}
                                            placeholder="Jean"
                                        />
                                    </div>
                                    <div className="cerfa-form-group">
                                        <label>Nom / Raison sociale</label>
                                        <input
                                            type="text"
                                            value={formData.clientName || ''}
                                            onChange={(e) => handleChange('clientName', e.target.value)}
                                            placeholder="Dupont"
                                        />
                                    </div>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Adresse</label>
                                    <input
                                        type="text"
                                        value={formData.clientAddress || ''}
                                        onChange={(e) => handleChange('clientAddress', e.target.value)}
                                        placeholder="123 rue de la Climatisation"
                                    />
                                </div>
                                <div className="cerfa-form-row">
                                    <div className="cerfa-form-group" style={{ flex: '0 0 120px' }}>
                                        <label>Code postal</label>
                                        <input
                                            type="text"
                                            value={formData.clientPostalCode || ''}
                                            onChange={(e) => handleChange('clientPostalCode', e.target.value)}
                                            placeholder="04000"
                                            maxLength={5}
                                        />
                                    </div>
                                    <div className="cerfa-form-group">
                                        <label>Ville</label>
                                        <input
                                            type="text"
                                            value={formData.clientCity || ''}
                                            onChange={(e) => handleChange('clientCity', e.target.value)}
                                            placeholder="Digne-les-Bains"
                                        />
                                    </div>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>SIRET (si professionnel)</label>
                                    <input
                                        type="text"
                                        value={formData.detenteurSiret || ''}
                                        onChange={(e) => handleChange('detenteurSiret', e.target.value)}
                                        placeholder="Optionnel"
                                    />
                                </div>
                            </section>
                        </>
                    )}

                    {/* TAB: Équipement */}
                    {activeTab === 'equipement' && (
                        <section className="cerfa-section">
                            <h3>🔧 Identification de l'équipement</h3>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Type d'équipement</label>
                                    <select
                                        value={formData.equipmentType || ''}
                                        onChange={(e) => handleChange('equipmentType', e.target.value)}
                                    >
                                        <option value="">Sélectionner...</option>
                                        <option value="Climatisation">Climatisation</option>
                                        <option value="Pompe à chaleur">Pompe à chaleur</option>
                                        <option value="Chambre froide">Chambre froide</option>
                                        <option value="Groupe froid">Groupe froid</option>
                                        <option value="Réfrigérateur">Réfrigérateur</option>
                                        <option value="Congélateur">Congélateur</option>
                                        <option value="Autre">Autre</option>
                                    </select>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Marque</label>
                                    <input
                                        type="text"
                                        value={formData.equipmentBrand || ''}
                                        onChange={(e) => handleChange('equipmentBrand', e.target.value)}
                                        placeholder="Daikin, Mitsubishi..."
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Modèle</label>
                                    <input
                                        type="text"
                                        value={formData.equipmentModel || ''}
                                        onChange={(e) => handleChange('equipmentModel', e.target.value)}
                                        placeholder="Modèle"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>N° de série</label>
                                    <input
                                        type="text"
                                        value={formData.numeroSerie || ''}
                                        onChange={(e) => handleChange('numeroSerie', e.target.value)}
                                        placeholder="Numéro de série"
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Type de fluide frigorigène</label>
                                    <select
                                        value={formData.fluide || ''}
                                        onChange={(e) => handleChange('fluide', e.target.value)}
                                    >
                                        <option value="">Sélectionner...</option>
                                        <optgroup label="HFC">
                                            <option value="R-32">R-32</option>
                                            <option value="R-134a">R-134a</option>
                                            <option value="R-404A">R-404A</option>
                                            <option value="R-407C">R-407C</option>
                                            <option value="R-410A">R-410A</option>
                                            <option value="R-507A">R-507A</option>
                                        </optgroup>
                                        <optgroup label="HFO">
                                            <option value="R-1234yf">R-1234yf</option>
                                            <option value="R-1234ze">R-1234ze</option>
                                        </optgroup>
                                        <optgroup label="HCFC (interdit)">
                                            <option value="R-22">R-22</option>
                                        </optgroup>
                                        <optgroup label="Naturels">
                                            <option value="R-290">R-290 (Propane)</option>
                                            <option value="R-600a">R-600a (Isobutane)</option>
                                            <option value="R-744">R-744 (CO2)</option>
                                            <option value="R-717">R-717 (Ammoniac)</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Charge nominale (kg)</label>
                                    <input
                                        type="text"
                                        value={formData.charge || ''}
                                        onChange={(e) => handleChange('charge', e.target.value)}
                                        placeholder="Ex: 2.5"
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Tonnes équivalent CO2</label>
                                    <input
                                        type="text"
                                        value={formData.teqCO2 || ''}
                                        onChange={(e) => handleChange('teqCO2', e.target.value)}
                                        placeholder="Ex: 5.2"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Emplacement</label>
                                    <input
                                        type="text"
                                        value={formData.equipmentLocation || ''}
                                        onChange={(e) => handleChange('equipmentLocation', e.target.value)}
                                        placeholder="Local technique, toiture..."
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-group">
                                <label>N° détecteur de fuite (si applicable)</label>
                                <input
                                    type="text"
                                    value={formData.detecteurId || ''}
                                    onChange={(e) => handleChange('detecteurId', e.target.value)}
                                    placeholder="Numéro du détecteur"
                                />
                            </div>

                            <h4>Catégorie de fluide (seuils de charge)</h4>
                            <div className="cerfa-form-group">
                                <label>Catégorie</label>
                                <select
                                    value={formData.categorie || ''}
                                    onChange={(e) => handleChange('categorie', e.target.value)}
                                >
                                    <option value="">Sélectionner la catégorie...</option>
                                    <optgroup label="HCFC (interdit depuis 2015)">
                                        <option value="HCFC_2">HCFC ≥ 2 kg</option>
                                        <option value="HCFC_30">HCFC ≥ 30 kg</option>
                                        <option value="HCFC_300">HCFC ≥ 300 kg</option>
                                    </optgroup>
                                    <optgroup label="HFC">
                                        <option value="HFC_5">HFC ≥ 5 t éq. CO2</option>
                                        <option value="HFC_50">HFC ≥ 50 t éq. CO2</option>
                                        <option value="HFC_500">HFC ≥ 500 t éq. CO2</option>
                                    </optgroup>
                                    <optgroup label="HFO">
                                        <option value="HFO_1">HFO ≥ 1 kg</option>
                                        <option value="HFO_10">HFO ≥ 10 kg</option>
                                        <option value="HFO_100">HFO ≥ 100 kg</option>
                                    </optgroup>
                                </select>
                            </div>

                            <h4>Fréquence de contrôle d'étanchéité</h4>
                            <div className="cerfa-form-group">
                                <label>Périodicité</label>
                                <select
                                    value={formData.frequenceControle || ''}
                                    onChange={(e) => handleChange('frequenceControle', e.target.value)}
                                >
                                    <option value="">Sélectionner...</option>
                                    <optgroup label="Sans système de détection">
                                        <option value="sans_12m">Tous les 12 mois</option>
                                        <option value="sans_6m">Tous les 6 mois</option>
                                        <option value="sans_3m">Tous les 3 mois</option>
                                    </optgroup>
                                    <optgroup label="Avec système de détection">
                                        <option value="avec_24m">Tous les 24 mois</option>
                                        <option value="avec_12m">Tous les 12 mois</option>
                                        <option value="avec_6m">Tous les 6 mois</option>
                                    </optgroup>
                                </select>
                            </div>

                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={saveEquipment}
                                    onChange={() => setSaveEquipment(!saveEquipment)}
                                />
                                <span>Mémoriser ces informations pour ce client</span>
                            </label>
                        </section>
                    )}

                    {/* TAB: Intervention */}
                    {activeTab === 'intervention' && (
                        <>
                            {/* Nature de l'intervention */}
                            <section className="cerfa-section">
                                <h3>📝 Nature de l'intervention</h3>
                                <div className="cerfa-checkboxes-grid">
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.assemblage || false}
                                            onChange={() => handleCheckbox('assemblage')}
                                        />
                                        <span>Assemblage</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.natureMiseEnService || false}
                                            onChange={() => handleCheckbox('natureMiseEnService')}
                                        />
                                        <span>Mise en service</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.modification || false}
                                            onChange={() => handleCheckbox('modification')}
                                        />
                                        <span>Modification</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.natureMaintenance || false}
                                            onChange={() => handleCheckbox('natureMaintenance')}
                                        />
                                        <span>Maintenance / Entretien</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.natureControleEtancheite || false}
                                            onChange={() => handleCheckbox('natureControleEtancheite')}
                                        />
                                        <span>Contrôle d'étanchéité périodique</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.controleNonPeriodique || false}
                                            onChange={() => handleCheckbox('controleNonPeriodique')}
                                        />
                                        <span>Contrôle d'étanchéité non périodique</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.natureDemantelement || false}
                                            onChange={() => handleCheckbox('natureDemantelement')}
                                        />
                                        <span>Démantèlement</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.natureAutre || false}
                                            onChange={() => handleCheckbox('natureAutre')}
                                        />
                                        <span>Autre</span>
                                    </label>
                                </div>
                                {formData.natureAutre && (
                                    <div className="cerfa-form-group">
                                        <label>Précisez</label>
                                        <input
                                            type="text"
                                            value={formData.autreNature || ''}
                                            onChange={(e) => handleChange('autreNature', e.target.value)}
                                            placeholder="Autre nature d'intervention"
                                        />
                                    </div>
                                )}
                            </section>

                            {/* Détection de fuite */}
                            <section className="cerfa-section">
                                <h3>🔍 Contrôle d'étanchéité</h3>
                                <div className="cerfa-form-group">
                                    <label>Fuite détectée ?</label>
                                    <div className="cerfa-radio-group">
                                        <label className="cerfa-radio">
                                            <input
                                                type="radio"
                                                name="fuiteDetectee"
                                                checked={formData.fuiteDetectee === 'oui'}
                                                onChange={() => handleChange('fuiteDetectee', 'oui')}
                                            />
                                            <span>Oui</span>
                                        </label>
                                        <label className="cerfa-radio">
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
                                        <h4>Localisation des fuites</h4>
                                        <div className="cerfa-form-row">
                                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                                <label>Fuite 1 - Localisation</label>
                                                <input
                                                    type="text"
                                                    value={formData.fuiteLoca1 || ''}
                                                    onChange={(e) => handleChange('fuiteLoca1', e.target.value)}
                                                    placeholder="Ex: Raccord haute pression"
                                                />
                                            </div>
                                            <div className="cerfa-form-group" style={{ flex: 1 }}>
                                                <label>Réparation</label>
                                                <select
                                                    value={formData.reparationFuite1Realisee ? 'realisee' : formData.reparationFuite1AFaire ? 'afaire' : ''}
                                                    onChange={(e) => {
                                                        handleChange('reparationFuite1Realisee', e.target.value === 'realisee');
                                                        handleChange('reparationFuite1AFaire', e.target.value === 'afaire');
                                                    }}
                                                >
                                                    <option value="">-</option>
                                                    <option value="realisee">Réalisée</option>
                                                    <option value="afaire">À faire</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="cerfa-form-row">
                                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                                <label>Fuite 2 - Localisation</label>
                                                <input
                                                    type="text"
                                                    value={formData.fuiteLoca2 || ''}
                                                    onChange={(e) => handleChange('fuiteLoca2', e.target.value)}
                                                    placeholder="Optionnel"
                                                />
                                            </div>
                                            <div className="cerfa-form-group" style={{ flex: 1 }}>
                                                <label>Réparation</label>
                                                <select
                                                    value={formData.reparationFuite2Realisee ? 'realisee' : formData.reparationFuite2AFaire ? 'afaire' : ''}
                                                    onChange={(e) => {
                                                        handleChange('reparationFuite2Realisee', e.target.value === 'realisee');
                                                        handleChange('reparationFuite2AFaire', e.target.value === 'afaire');
                                                    }}
                                                >
                                                    <option value="">-</option>
                                                    <option value="realisee">Réalisée</option>
                                                    <option value="afaire">À faire</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="cerfa-form-row">
                                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                                <label>Fuite 3 - Localisation</label>
                                                <input
                                                    type="text"
                                                    value={formData.fuiteLoca3 || ''}
                                                    onChange={(e) => handleChange('fuiteLoca3', e.target.value)}
                                                    placeholder="Optionnel"
                                                />
                                            </div>
                                            <div className="cerfa-form-group" style={{ flex: 1 }}>
                                                <label>Réparation</label>
                                                <select
                                                    value={formData.reparationFuite3Realisee ? 'realisee' : formData.reparationFuite3AFaire ? 'afaire' : ''}
                                                    onChange={(e) => {
                                                        handleChange('reparationFuite3Realisee', e.target.value === 'realisee');
                                                        handleChange('reparationFuite3AFaire', e.target.value === 'afaire');
                                                    }}
                                                >
                                                    <option value="">-</option>
                                                    <option value="realisee">Réalisée</option>
                                                    <option value="afaire">À faire</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>

                            {/* Observations */}
                            <section className="cerfa-section">
                                <h3>📝 Observations</h3>
                                <div className="cerfa-form-group">
                                    <label>Observations / Remarques</label>
                                    <textarea
                                        value={formData.observations || ''}
                                        onChange={(e) => handleChange('observations', e.target.value)}
                                        placeholder="Observations sur l'intervention..."
                                        rows={4}
                                    />
                                </div>
                            </section>
                        </>
                    )}

                    {/* TAB: Fluides */}
                    {activeTab === 'fluides' && (
                        <section className="cerfa-section">
                            <h3>💨 Mouvements de fluides frigorigènes</h3>
                            <p className="cerfa-section-info">
                                Indiquez les quantités de fluide manipulées lors de l'intervention (en kg)
                            </p>

                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>Quantité initiale dans l'équipement</label>
                                    <input
                                        type="text"
                                        value={formData.quantiteFluide || ''}
                                        onChange={(e) => handleChange('quantiteFluide', e.target.value)}
                                        placeholder="kg"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Dénomination du fluide</label>
                                    <input
                                        type="text"
                                        value={formData.denominationFluide || formData.fluide || ''}
                                        onChange={(e) => handleChange('denominationFluide', e.target.value)}
                                        placeholder="R-410A"
                                    />
                                </div>
                            </div>

                            <h4>Quantités manipulées</h4>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>QA - Récupérée (kg)</label>
                                    <input
                                        type="text"
                                        value={formData.quantiteRecuperee || ''}
                                        onChange={(e) => handleChange('quantiteRecuperee', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>QB - Chargée (neuve) (kg)</label>
                                    <input
                                        type="text"
                                        value={formData.quantiteChargee || ''}
                                        onChange={(e) => handleChange('quantiteChargee', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>QC - Rechargée (récupérée) (kg)</label>
                                    <input
                                        type="text"
                                        value={formData.quantiteAjoutee || ''}
                                        onChange={(e) => handleChange('quantiteAjoutee', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>QD - À traiter (kg)</label>
                                    <input
                                        type="text"
                                        value={formData.quantiteD || ''}
                                        onChange={(e) => handleChange('quantiteD', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-row">
                                <div className="cerfa-form-group">
                                    <label>QE - À réutiliser (kg)</label>
                                    <input
                                        type="text"
                                        value={formData.quantiteE || ''}
                                        onChange={(e) => handleChange('quantiteE', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>N° BSFF (bordereau)</label>
                                    <input
                                        type="text"
                                        value={formData.bsffNumber || ''}
                                        onChange={(e) => handleChange('bsffNumber', e.target.value)}
                                        placeholder="N° du bordereau de suivi"
                                    />
                                </div>
                            </div>
                            <div className="cerfa-form-group">
                                <label>N° contenant / bouteille</label>
                                <input
                                    type="text"
                                    value={formData.contenantId || ''}
                                    onChange={(e) => handleChange('contenantId', e.target.value)}
                                    placeholder="Identification du contenant"
                                />
                            </div>

                            <h4>Classification des déchets (Section 12)</h4>
                            <p className="cerfa-section-info">
                                Classification du fluide récupéré selon le règlement ADR
                            </p>

                            <div className="cerfa-form-group">
                                <label>Fluides NON inflammables</label>
                                <div className="cerfa-checkboxes">
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.dechetUN1078 || false}
                                            onChange={() => handleCheckbox('dechetUN1078')}
                                        />
                                        <span>UN 1078 - Gaz frigorifique NSA</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.dechetAutre140601 || false}
                                            onChange={() => handleCheckbox('dechetAutre140601')}
                                        />
                                        <span>Autre (code 14 06 01*)</span>
                                    </label>
                                </div>
                                {formData.dechetAutre140601 && (
                                    <input
                                        type="text"
                                        value={formData.autreDechetNonInflammable || ''}
                                        onChange={(e) => handleChange('autreDechetNonInflammable', e.target.value)}
                                        placeholder="Préciser le code déchet"
                                        style={{ marginTop: '0.5rem' }}
                                    />
                                )}
                            </div>

                            <div className="cerfa-form-group">
                                <label>Fluides inflammables</label>
                                <div className="cerfa-checkboxes">
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.dechetUN3161 || false}
                                            onChange={() => handleCheckbox('dechetUN3161')}
                                        />
                                        <span>UN 3161 - Gaz liquéfié inflammable NSA</span>
                                    </label>
                                    <label className="cerfa-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.dechetAutre160504 || false}
                                            onChange={() => handleCheckbox('dechetAutre160504')}
                                        />
                                        <span>Autre (code 16 05 04*)</span>
                                    </label>
                                </div>
                                {formData.dechetAutre160504 && (
                                    <input
                                        type="text"
                                        value={formData.autreDechetInflammable || ''}
                                        onChange={(e) => handleChange('autreDechetInflammable', e.target.value)}
                                        placeholder="Préciser le code déchet"
                                        style={{ marginTop: '0.5rem' }}
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    {/* TAB: Signatures */}
                    {activeTab === 'signatures' && (
                        <>
                            <section className="cerfa-section">
                                <h3>👷 Signature Opérateur</h3>
                                <div className="cerfa-form-row">
                                    <div className="cerfa-form-group">
                                        <label>Nom</label>
                                        <input
                                            type="text"
                                            value={formData.technicianName || ''}
                                            onChange={(e) => handleChange('technicianName', e.target.value)}
                                            placeholder="Nom du technicien"
                                        />
                                    </div>
                                    <div className="cerfa-form-group">
                                        <label>Qualité</label>
                                        <input
                                            type="text"
                                            value={formData.technicianQualite || ''}
                                            onChange={(e) => handleChange('technicianQualite', e.target.value)}
                                            placeholder="Technicien frigoriste"
                                        />
                                    </div>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Date</label>
                                    <input
                                        type="text"
                                        value={formData.date || formData.dateIntervention || ''}
                                        onChange={(e) => handleChange('date', e.target.value)}
                                        placeholder="04/01/2026"
                                    />
                                </div>
                            </section>

                            <section className="cerfa-section">
                                <h3>👤 Signature Détenteur</h3>
                                <div className="cerfa-form-row">
                                    <div className="cerfa-form-group">
                                        <label>Nom</label>
                                        <input
                                            type="text"
                                            value={formData.clientSignatureName || `${formData.clientFirstName || ''} ${formData.clientName || ''}`.trim()}
                                            onChange={(e) => handleChange('clientSignatureName', e.target.value)}
                                            placeholder="Nom du client"
                                        />
                                    </div>
                                    <div className="cerfa-form-group">
                                        <label>Qualité</label>
                                        <input
                                            type="text"
                                            value={formData.clientQualite || ''}
                                            onChange={(e) => handleChange('clientQualite', e.target.value)}
                                            placeholder="Propriétaire, Gérant..."
                                        />
                                    </div>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Date</label>
                                    <input
                                        type="text"
                                        value={formData.clientSignatureDate || formData.date || formData.dateIntervention || ''}
                                        onChange={(e) => handleChange('clientSignatureDate', e.target.value)}
                                        placeholder="04/01/2026"
                                    />
                                </div>
                            </section>

                            <section className="cerfa-section">
                                <h3>📍 Installation</h3>
                                <div className="cerfa-form-group">
                                    <label>Adresse de l'installation (si différente)</label>
                                    <input
                                        type="text"
                                        value={formData.installationInfo || ''}
                                        onChange={(e) => handleChange('installationInfo', e.target.value)}
                                        placeholder="Laisser vide si identique à l'adresse du détenteur"
                                    />
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="cerfa-modal-footer">
                    <div className="cerfa-footer-nav">
                        {activeTab !== 'general' && (
                            <button
                                type="button"
                                className="cerfa-btn-nav"
                                onClick={() => {
                                    const idx = tabs.findIndex(t => t.id === activeTab);
                                    if (idx > 0) setActiveTab(tabs[idx - 1].id);
                                }}
                            >
                                ← Précédent
                            </button>
                        )}
                        {activeTab !== 'signatures' && (
                            <button
                                type="button"
                                className="cerfa-btn-nav"
                                onClick={() => {
                                    const idx = tabs.findIndex(t => t.id === activeTab);
                                    if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].id);
                                }}
                            >
                                Suivant →
                            </button>
                        )}
                    </div>
                    <div className="cerfa-footer-actions">
                        <button
                            type="button"
                            className="cerfa-btn-secondary"
                            onClick={onClose}
                            disabled={isGenerating}
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            className="cerfa-btn-primary"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <span className="cerfa-spinner"></span>
                                    Génération...
                                </>
                            ) : (
                                <>📥 Générer PDF</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CerfaGeneratorModal;
