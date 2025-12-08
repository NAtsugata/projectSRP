// =============================
// FILE: src/components/CerfaGeneratorModal.js
// Modal pour générer et télécharger le CERFA 15497-04
// =============================

import React, { useState, useEffect, useCallback } from 'react';
import {
    fillCerfa15497,
    downloadCerfa,
    getCompanyInfo,
    saveCompanyInfo,
    saveEquipmentInfo,
    saveGenerationRecord,
    inspectCerfaFields
} from '../utils/cerfaService';
import './CerfaGeneratorModal.css';

// =============================
// COMPONENT
// =============================

function CerfaGeneratorModal({
    isOpen,
    onClose,
    initialData = {},
    sourceType = 'intervention', // 'intervention' or 'contract'
    sourceId = null,
    showToast
}) {
    const [formData, setFormData] = useState({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [showCompanySettings, setShowCompanySettings] = useState(false);
    const [saveEquipment, setSaveEquipment] = useState(true);

    // Charger les données initiales
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({ ...initialData });
        }
    }, [isOpen, initialData]);

    // Debug: Inspecter les champs du PDF
    useEffect(() => {
        if (isOpen) {
            inspectCerfaFields().then(fields => {
                console.log('Champs CERFA disponibles:', fields);
            });
        }
    }, [isOpen]);

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
            qualification: formData.qualification
        };
        if (saveCompanyInfo(companyData)) {
            showToast?.('Informations entreprise sauvegardées', 'success');
            setShowCompanySettings(false);
        }
    }, [formData, showToast]);

    // Générer le CERFA
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        try {
            // Sauvegarder les infos équipement si demandé
            if (saveEquipment && sourceId) {
                const equipmentData = {
                    type: formData.equipmentType,
                    brand: formData.equipmentBrand,
                    model: formData.equipmentModel,
                    power: formData.equipmentPower,
                    installationYear: formData.installationYear,
                    location: formData.equipmentLocation
                };
                saveEquipmentInfo(sourceId, equipmentData);
            }

            // Générer le PDF
            const pdfBlob = await fillCerfa15497(formData);

            // Créer le nom du fichier
            const clientName = (formData.clientName || 'client').replace(/\s+/g, '_');
            const date = new Date().toISOString().split('T')[0];
            const filename = `CERFA_15497_${clientName}_${date}.pdf`;

            // Télécharger
            downloadCerfa(pdfBlob, filename);

            // Sauvegarder dans l'historique
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
            console.error('Erreur génération CERFA:', error);
            showToast?.(`Erreur: ${error.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [formData, sourceType, sourceId, saveEquipment, showToast, onClose]);

    // Charger les settings entreprise
    const handleLoadCompanySettings = useCallback(() => {
        const companyInfo = getCompanyInfo();
        setFormData(prev => ({
            ...prev,
            companyName: companyInfo.companyName,
            siret: companyInfo.siret,
            companyAddress: companyInfo.address,
            qualification: companyInfo.qualification
        }));
    }, []);

    if (!isOpen) return null;

    return (
        <div className="cerfa-modal-overlay" onClick={onClose}>
            <div className="cerfa-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="cerfa-modal-header">
                    <div className="cerfa-modal-title">
                        <span className="cerfa-icon">📄</span>
                        <div>
                            <h2>Générer CERFA 15497-04</h2>
                            <p>Attestation d'entretien annuel - Chaudière gaz</p>
                        </div>
                    </div>
                    <button className="cerfa-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div className="cerfa-modal-body">
                    {/* Section Client */}
                    <section className="cerfa-section">
                        <h3>👤 Informations Client</h3>
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
                                <label>Nom</label>
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
                                placeholder="123 rue de la Plomberie"
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
                    </section>

                    {/* Section Équipement */}
                    <section className="cerfa-section">
                        <h3>🔧 Équipement</h3>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Type d'appareil</label>
                                <select
                                    value={formData.equipmentType || 'Chaudière gaz'}
                                    onChange={(e) => handleChange('equipmentType', e.target.value)}
                                >
                                    <option value="Chaudière gaz">Chaudière gaz</option>
                                    <option value="Chaudière gaz condensation">Chaudière gaz condensation</option>
                                    <option value="Chaudière gaz basse température">Chaudière gaz basse température</option>
                                    <option value="Chauffe-eau gaz">Chauffe-eau gaz</option>
                                </select>
                            </div>
                            <div className="cerfa-form-group">
                                <label>Marque</label>
                                <input
                                    type="text"
                                    value={formData.equipmentBrand || ''}
                                    onChange={(e) => handleChange('equipmentBrand', e.target.value)}
                                    placeholder="Saunier Duval, De Dietrich..."
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
                                    placeholder="Thema Plus F25E"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Puissance (kW)</label>
                                <input
                                    type="text"
                                    value={formData.equipmentPower || ''}
                                    onChange={(e) => handleChange('equipmentPower', e.target.value)}
                                    placeholder="25"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Année d'installation</label>
                                <input
                                    type="text"
                                    value={formData.installationYear || ''}
                                    onChange={(e) => handleChange('installationYear', e.target.value)}
                                    placeholder="2020"
                                    maxLength={4}
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Emplacement</label>
                                <input
                                    type="text"
                                    value={formData.equipmentLocation || ''}
                                    onChange={(e) => handleChange('equipmentLocation', e.target.value)}
                                    placeholder="Cuisine, Garage..."
                                />
                            </div>
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

                    {/* Section Entretien */}
                    <section className="cerfa-section">
                        <h3>🛠️ Opérations réalisées</h3>
                        <div className="cerfa-form-group">
                            <label>Date de l'entretien</label>
                            <input
                                type="text"
                                value={formData.maintenanceDate || ''}
                                onChange={(e) => handleChange('maintenanceDate', e.target.value)}
                                placeholder="08/12/2024"
                            />
                        </div>
                        <div className="cerfa-checkboxes">
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.cleanedBurner || false}
                                    onChange={() => handleCheckbox('cleanedBurner')}
                                />
                                <span>Nettoyage du brûleur</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.checkedCombustion || false}
                                    onChange={() => handleCheckbox('checkedCombustion')}
                                />
                                <span>Vérification de la combustion</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.checkedSealing || false}
                                    onChange={() => handleCheckbox('checkedSealing')}
                                />
                                <span>Vérification de l'étanchéité</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.checkedVentilation || false}
                                    onChange={() => handleCheckbox('checkedVentilation')}
                                />
                                <span>Vérification de la ventilation</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.checkedExhaust || false}
                                    onChange={() => handleCheckbox('checkedExhaust')}
                                />
                                <span>Vérification de l'évacuation des produits</span>
                            </label>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Taux de CO (ppm)</label>
                                <input
                                    type="text"
                                    value={formData.coLevel || ''}
                                    onChange={(e) => handleChange('coLevel', e.target.value)}
                                    placeholder="< 10"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Rendement (%)</label>
                                <input
                                    type="text"
                                    value={formData.efficiency || ''}
                                    onChange={(e) => handleChange('efficiency', e.target.value)}
                                    placeholder="92"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section Entreprise */}
                    <section className="cerfa-section">
                        <div className="cerfa-section-header">
                            <h3>🏢 Entreprise</h3>
                            <button
                                type="button"
                                className="cerfa-settings-btn"
                                onClick={() => setShowCompanySettings(!showCompanySettings)}
                            >
                                ⚙️ {showCompanySettings ? 'Masquer' : 'Paramètres'}
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
                                        <label>Qualification</label>
                                        <input
                                            type="text"
                                            value={formData.qualification || ''}
                                            onChange={(e) => handleChange('qualification', e.target.value)}
                                            placeholder="Professionnel qualifié gaz"
                                        />
                                    </div>
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Adresse entreprise</label>
                                    <input
                                        type="text"
                                        value={formData.companyAddress || ''}
                                        onChange={(e) => handleChange('companyAddress', e.target.value)}
                                        placeholder="Champtercier, 04660"
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="cerfa-save-company-btn"
                                    onClick={handleSaveCompanyInfo}
                                >
                                    💾 Sauvegarder ces paramètres
                                </button>
                            </>
                        ) : (
                            <div className="cerfa-company-summary">
                                <p><strong>{formData.companyName || 'Non configuré'}</strong></p>
                                {formData.siret && <p>SIRET: {formData.siret}</p>}
                                <button
                                    type="button"
                                    className="cerfa-reload-btn"
                                    onClick={handleLoadCompanySettings}
                                >
                                    🔄 Recharger paramètres sauvegardés
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Section Technicien */}
                    <section className="cerfa-section">
                        <h3>👷 Technicien</h3>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Nom du technicien</label>
                                <input
                                    type="text"
                                    value={formData.technicianName || ''}
                                    onChange={(e) => handleChange('technicianName', e.target.value)}
                                    placeholder="Sébastien"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Date du document</label>
                                <input
                                    type="text"
                                    value={formData.date || ''}
                                    onChange={(e) => handleChange('date', e.target.value)}
                                    placeholder="08/12/2024"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="cerfa-modal-footer">
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
                            <>📥 Générer et Télécharger</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CerfaGeneratorModal;
