// =============================
// FILE: src/pages/CerfaPage.js
// Formulaire CERFA 15497-04 - Fiche d'intervention fluides frigorigènes
// Optimisé pour mobile
// =============================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    fillCerfa15497,
    downloadCerfa,
    getCompanyInfo,
    saveCompanyInfo,
    saveGenerationRecord
} from '../utils/cerfaService';
import '../components/CerfaGeneratorModal.css';

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

        // INTERVENTION
        dateIntervention: new Date().toLocaleDateString('fr-FR'),

        // Nature de l'intervention (cases à cocher)
        natureMiseEnService: false,
        natureControleEtancheite: false,
        natureMaintenance: false,
        natureReparationFuite: false,
        natureDemontage: false,
        natureDemantelement: false,
        natureAutre: false,
        natureAutreTexte: '',

        // Fluide frigorigène
        fluideDesignation: '',
        fluideChargeInitiale: '',
        fluideQuantiteRecuperee: '',
        fluideQuantiteReintroduite: '',
        fluideQuantiteAjoutee: '',
        fluideOrigine: '',

        // Détection de fuite
        fuiteDetectee: '',
        fuiteLocalisation: '',
        fuiteReparation: '',

        // Observations
        observations: '',
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [toast, setToast] = useState(null);

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
            // Passer les données directement au service PDF
            const pdfBlob = await fillCerfa15497(formData);

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
    }, [formData, showToast]);

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
                                    checked={formData.natureMiseEnService}
                                    onChange={() => handleCheckbox('natureMiseEnService')}
                                />
                                <span>Mise en service</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureControleEtancheite}
                                    onChange={() => handleCheckbox('natureControleEtancheite')}
                                />
                                <span>Contrôle d'étanchéité</span>
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
                                    checked={formData.natureReparationFuite}
                                    onChange={() => handleCheckbox('natureReparationFuite')}
                                />
                                <span>Réparation de fuite</span>
                            </label>
                            <label className="cerfa-checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.natureDemontage}
                                    onChange={() => handleCheckbox('natureDemontage')}
                                />
                                <span>Démontage</span>
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
                    </section>

                    {/* Section 5: FLUIDE FRIGORIGÈNE */}
                    <section className="cerfa-section">
                        <h3>💨 5. FLUIDE FRIGORIGÈNE</h3>
                        <div className="cerfa-form-group">
                            <label>Désignation du fluide</label>
                            <select
                                value={formData.fluideDesignation}
                                onChange={(e) => handleChange('fluideDesignation', e.target.value)}
                            >
                                <option value="">-- Sélectionner --</option>
                                <option value="R-32">R-32</option>
                                <option value="R-410A">R-410A</option>
                                <option value="R-407C">R-407C</option>
                                <option value="R-134a">R-134a</option>
                                <option value="R-22">R-22 (interdit)</option>
                                <option value="R-290">R-290 (Propane)</option>
                                <option value="R-600a">R-600a (Isobutane)</option>
                                <option value="Autre">Autre</option>
                            </select>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Charge initiale (kg)</label>
                                <input
                                    type="text"
                                    value={formData.fluideChargeInitiale}
                                    onChange={(e) => handleChange('fluideChargeInitiale', e.target.value)}
                                    placeholder="Ex: 2.5"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Quantité récupérée (kg)</label>
                                <input
                                    type="text"
                                    value={formData.fluideQuantiteRecuperee}
                                    onChange={(e) => handleChange('fluideQuantiteRecuperee', e.target.value)}
                                    placeholder="Ex: 0"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Quantité réintroduite (kg)</label>
                                <input
                                    type="text"
                                    value={formData.fluideQuantiteReintroduite}
                                    onChange={(e) => handleChange('fluideQuantiteReintroduite', e.target.value)}
                                    placeholder="Ex: 0"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Quantité ajoutée (kg)</label>
                                <input
                                    type="text"
                                    value={formData.fluideQuantiteAjoutee}
                                    onChange={(e) => handleChange('fluideQuantiteAjoutee', e.target.value)}
                                    placeholder="Ex: 0.3"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Origine du fluide ajouté</label>
                            <select
                                value={formData.fluideOrigine}
                                onChange={(e) => handleChange('fluideOrigine', e.target.value)}
                            >
                                <option value="">-- Sélectionner --</option>
                                <option value="Neuf">Neuf</option>
                                <option value="Recyclé">Recyclé</option>
                                <option value="Régénéré">Régénéré</option>
                            </select>
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
                                <div className="cerfa-form-group">
                                    <label>Localisation de la fuite</label>
                                    <input
                                        type="text"
                                        value={formData.fuiteLocalisation}
                                        onChange={(e) => handleChange('fuiteLocalisation', e.target.value)}
                                        placeholder="Ex: Raccord haute pression"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Réparation effectuée ?</label>
                                    <div className="cerfa-checkboxes" style={{ flexDirection: 'row', gap: '2rem' }}>
                                        <label className="cerfa-checkbox">
                                            <input
                                                type="radio"
                                                name="fuiteReparation"
                                                checked={formData.fuiteReparation === 'oui'}
                                                onChange={() => handleChange('fuiteReparation', 'oui')}
                                            />
                                            <span>Oui</span>
                                        </label>
                                        <label className="cerfa-checkbox">
                                            <input
                                                type="radio"
                                                name="fuiteReparation"
                                                checked={formData.fuiteReparation === 'non'}
                                                onChange={() => handleChange('fuiteReparation', 'non')}
                                            />
                                            <span>Non</span>
                                        </label>
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
