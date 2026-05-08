// =============================
// FILE: src/pages/CerfaPage1301.jsx
// Formulaire CERFA 1301-SD - Attestation simplifiée TVA taux réduit (10%)
// Optimisé pour mobile
// =============================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    fillCerfa1301,
    downloadCerfa,
    getCompanyInfo,
    saveGenerationRecord,
    mapOrganizationToCompanyInfo
} from '../utils/cerfaService';
import { useCerfaCounter } from '../hooks/useCerfaCounter';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import SignaturePad from '../components/SignaturePad';
import '../components/CerfaGeneratorModal.css';
import logger from '../utils/logger';

const DRAFT_KEY = 'cerfa_1301_draft';

function CerfaPage1301() {
    const [searchParams] = useSearchParams();
    const { profile } = useAuthStore();
    const [formData, setFormData] = useState({
        // CLIENT / DONNEUR D'ORDRE
        clientNom: '',
        clientPrenom: '',
        clientAdresse: '',
        clientCodePostal: '',
        clientVille: '',

        // ADRESSE DE L'IMMEUBLE
        immeubleAdresse: '',
        immeubleCodePostal: '',
        immeubleVille: '',
        memeAdresse: true, // Si l'adresse est la même que le client

        // QUALITÉ DU CLIENT
        qualiteProprietaire: true,
        qualiteLocataire: false,
        qualiteAutre: false,
        qualiteAutreTexte: '',

        // NATURE DES LOCAUX
        natureMaison: true,
        natureAppartement: false,
        natureAutreLocal: false,
        autreNatureTexte: '',

        // NATURE DES TRAVAUX
        travauxAmelioration: false,
        travauxTransformation: false,
        travauxAmenagement: false,
        travauxEntretien: true,

        // ATTESTATIONS
        immeubleplus2ans: true,
        pasImmeubleNeuf: true,
        moins6Elements: true,

        // ÉLÉMENTS DE SECOND ŒUVRE touchés
        elemPlanchers: false,
        elemHuisseries: false,
        elemCloisons: false,
        elemSanitaires: true,
        elemPlomberie: true,
        elemElectriques: false,
        elemChauffage: false,

        // ENTREPRISE
        entrepriseNom: '',
        entrepriseAdresse: '',
        entrepriseSiret: '',

        // TRAVAUX
        descriptionTravaux: '',
        montantHT: '',
        montantTVA: '',
        montantTTC: '',

        // DATE ET LIEU
        dateAttestation: new Date().toLocaleDateString('fr-FR'),
        lieu: '',

        // SIGNATURE
        signatureClient: null,
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [toast, setToast] = useState(null);
    const { ficheInfo, getNextNumber, refresh: refreshFicheInfo } = useCerfaCounter('1301');
    const [draftRestored, setDraftRestored] = useState(false);
    const saveTimerRef = useRef(null);

    // Charger les informations entreprise (Supabase en priorité)
    useEffect(() => {
        const loadCompanyInfo = async () => {
            try {
                const orgId = profile?.organization_id;
                if (orgId) {
                    const { data: org, error } = await supabase
                        .from('organizations')
                        .select('name, address, postal_code, city, phone, siret, settings')
                        .eq('id', orgId)
                        .single();
                    if (!error && org) {
                        const companyInfo = mapOrganizationToCompanyInfo(org);
                        setFormData(prev => ({
                            ...prev,
                            entrepriseNom: companyInfo.companyName || prev.entrepriseNom,
                            entrepriseAdresse: companyInfo.address || prev.entrepriseAdresse,
                            entrepriseSiret: companyInfo.siret || prev.entrepriseSiret,
                            entreprisePhone: companyInfo.phone || prev.entreprisePhone,
                            lieu: org.city || org.address?.split(',')[0] || prev.lieu,
                        }));
                        return;
                    }
                }
            } catch (e) {
                logger.warn('[CerfaPage1301] Fallback localStorage:', e);
            }
            const companyInfo = getCompanyInfo();
            setFormData(prev => ({
                ...prev,
                entrepriseNom: companyInfo.companyName || prev.entrepriseNom,
                entrepriseAdresse: companyInfo.address || prev.entrepriseAdresse,
                entrepriseSiret: companyInfo.siret || prev.entrepriseSiret,
            }));
        };
        loadCompanyInfo();
    }, [profile]);

    // Charger depuis intervention si paramètre URL
    useEffect(() => {
        const interventionId = searchParams.get('interventionId');
        if (interventionId) {
            loadFromIntervention(interventionId);
        } else {
            // Essayer de restaurer le brouillon
            restoreDraft();
        }
    }, [searchParams]);

    // Charger les données depuis une intervention
    const loadFromIntervention = async (interventionId) => {
        try {
            const { data, error } = await supabase
                .from('interventions')
                .select('*')
                .eq('id', interventionId)
                .single();

            if (error) throw error;

            // Parser le nom client
            const clientParts = (data.client || '').split(' ');
            const clientPrenom = clientParts.shift() || '';
            const clientNom = clientParts.join(' ') || clientPrenom;

            // Parser l'adresse
            const addressMatch = (data.address || '').match(/^(.+?),?\s*(\d{5})?\s*(.+)?$/);

            setFormData(prev => ({
                ...prev,
                clientNom: clientNom,
                clientPrenom: clientPrenom,
                clientAdresse: addressMatch ? addressMatch[1] : data.address || '',
                clientCodePostal: addressMatch?.[2] || '',
                clientVille: addressMatch?.[3] || '',
                immeubleAdresse: addressMatch ? addressMatch[1] : data.address || '',
                immeubleCodePostal: addressMatch?.[2] || '',
                immeubleVille: addressMatch?.[3] || '',
                descriptionTravaux: data.description || data.notes || '',
            }));

            showToast('Données chargées depuis l\'intervention', 'success');
        } catch (error) {
            logger.error('Erreur chargement intervention:', error);
            showToast('Erreur lors du chargement', 'error');
        }
    };

    // Sauvegarder le brouillon
    const saveDraft = useCallback(() => {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
            logger.log('[CERFA 1301] Brouillon sauvegardé');
        } catch (e) {
            logger.error('Erreur sauvegarde brouillon:', e);
        }
    }, [formData]);

    // Restaurer le brouillon
    const restoreDraft = () => {
        try {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (draft) {
                const parsed = JSON.parse(draft);
                setFormData(prev => ({ ...prev, ...parsed }));
                setDraftRestored(true);
                showToast('Brouillon restauré', 'info');
            }
        } catch (e) {
            logger.error('Erreur restauration brouillon:', e);
        }
    };

    // Effacer le brouillon
    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setDraftRestored(false);
    };

    // Auto-save du brouillon
    useEffect(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(saveDraft, 2000);
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [formData, saveDraft]);

    // Synchroniser l'adresse immeuble si memeAdresse est coché
    useEffect(() => {
        if (formData.memeAdresse) {
            setFormData(prev => ({
                ...prev,
                immeubleAdresse: prev.clientAdresse,
                immeubleCodePostal: prev.clientCodePostal,
                immeubleVille: prev.clientVille,
            }));
        }
    }, [formData.memeAdresse, formData.clientAdresse, formData.clientCodePostal, formData.clientVille]);

    // Calculer automatiquement TVA et TTC
    useEffect(() => {
        const ht = parseFloat(formData.montantHT) || 0;
        if (ht > 0) {
            const tva = ht * 0.10; // TVA 10%
            const ttc = ht + tva;
            setFormData(prev => ({
                ...prev,
                montantTVA: tva.toFixed(2),
                montantTTC: ttc.toFixed(2),
            }));
        }
    }, [formData.montantHT]);

    // Afficher un toast
    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Mettre à jour le formulaire
    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Générer le PDF
    const handleGenerate = async () => {
        // Validation
        if (!formData.clientNom && !formData.clientPrenom) {
            showToast('Veuillez renseigner le nom du client', 'error');
            return;
        }

        if (!formData.immeubleAdresse) {
            showToast('Veuillez renseigner l\'adresse de l\'immeuble', 'error');
            return;
        }

        if (!formData.immeubleplus2ans) {
            showToast('L\'immeuble doit être achevé depuis plus de 2 ans pour bénéficier de la TVA à 10%', 'error');
            return;
        }

        setIsGenerating(true);

        try {
            // Obtenir le prochain numéro de fiche
            const ficheNumber = await getNextNumber();

            // Générer le PDF
            const pdfBlob = await fillCerfa1301({
                ...formData,
                ficheNumber
            });

            // Télécharger
            const clientName = `${formData.clientPrenom} ${formData.clientNom}`.trim() || 'Client';
            const filename = `CERFA_1301_TVA10_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
            await downloadCerfa(pdfBlob, filename);

            // Sauvegarder dans l'historique
            saveGenerationRecord({
                type: 'CERFA_1301',
                ficheNumber,
                clientName,
                address: formData.immeubleAdresse,
                montantTTC: formData.montantTTC
            });

            // Effacer le brouillon après génération réussie
            clearDraft();

            // Rafraîchir le compteur
            refreshFicheInfo();

            showToast('PDF généré avec succès !', 'success');
        } catch (error) {
            logger.error('Erreur génération PDF:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // Réinitialiser le formulaire
    const handleReset = () => {
        if (window.confirm('Réinitialiser le formulaire ? Les données non enregistrées seront perdues.')) {
            const companyInfo = getCompanyInfo();
            setFormData({
                clientNom: '',
                clientPrenom: '',
                clientAdresse: '',
                clientCodePostal: '',
                clientVille: '',
                immeubleAdresse: '',
                immeubleCodePostal: '',
                immeubleVille: '',
                memeAdresse: true,
                qualiteProprietaire: true,
                qualiteLocataire: false,
                qualiteAutre: false,
                qualiteAutreTexte: '',
                natureMaison: true,
                natureAppartement: false,
                natureAutreLocal: false,
                autreNatureTexte: '',
                travauxAmelioration: false,
                travauxTransformation: false,
                travauxAmenagement: false,
                travauxEntretien: true,
                immeubleplus2ans: true,
                pasImmeubleNeuf: true,
                moins6Elements: true,
                elemPlanchers: false,
                elemHuisseries: false,
                elemCloisons: false,
                elemSanitaires: true,
                elemPlomberie: true,
                elemElectriques: false,
                elemChauffage: false,
                entrepriseNom: companyInfo.companyName || '',
                entrepriseAdresse: companyInfo.address || '',
                entrepriseSiret: companyInfo.siret || '',
                descriptionTravaux: '',
                montantHT: '',
                montantTVA: '',
                montantTTC: '',
                dateAttestation: new Date().toLocaleDateString('fr-FR'),
                lieu: 'Champtercier',
                signatureClient: null,
            });
            clearDraft();
            showToast('Formulaire réinitialisé', 'info');
        }
    };

    // Compter les éléments de second œuvre cochés
    const countElements = () => {
        const elements = [
            formData.elemPlanchers,
            formData.elemHuisseries,
            formData.elemCloisons,
            formData.elemSanitaires,
            formData.elemPlomberie,
            formData.elemElectriques,
            formData.elemChauffage
        ];
        return elements.filter(Boolean).length;
    };

    const elementsCount = countElements();
    const tooManyElements = elementsCount > 5;

    return (
        <div className="cerfa-page cerfa-1301">
            {/* Header */}
            <div className="cerfa-header">
                <h1>📋 CERFA 1301-SD</h1>
                <p className="cerfa-subtitle">Attestation simplifiée - TVA taux réduit 10%</p>
                <div className="cerfa-fiche-info">
                    <span>Prochain n°: <strong>{ficheInfo.formatted}</strong></span>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`cerfa-toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}

            {/* Draft restored banner */}
            {draftRestored && (
                <div className="draft-banner">
                    ✏️ Brouillon restauré
                    <button onClick={clearDraft}>Effacer</button>
                </div>
            )}

            {/* Formulaire */}
            <div className="cerfa-form">
                {/* SECTION: Client */}
                <section className="form-section">
                    <h2>👤 Client / Donneur d'ordre</h2>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Prénom</label>
                            <input
                                type="text"
                                value={formData.clientPrenom}
                                onChange={(e) => updateField('clientPrenom', e.target.value)}
                                placeholder="Prénom"
                            />
                        </div>
                        <div className="form-group">
                            <label>Nom *</label>
                            <input
                                type="text"
                                value={formData.clientNom}
                                onChange={(e) => updateField('clientNom', e.target.value)}
                                placeholder="Nom"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Adresse</label>
                        <input
                            type="text"
                            value={formData.clientAdresse}
                            onChange={(e) => updateField('clientAdresse', e.target.value)}
                            placeholder="Numéro et nom de rue"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Code postal</label>
                            <input
                                type="text"
                                value={formData.clientCodePostal}
                                onChange={(e) => updateField('clientCodePostal', e.target.value)}
                                placeholder="04000"
                                maxLength={5}
                            />
                        </div>
                        <div className="form-group">
                            <label>Ville</label>
                            <input
                                type="text"
                                value={formData.clientVille}
                                onChange={(e) => updateField('clientVille', e.target.value)}
                                placeholder="Ville"
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION: Adresse de l'immeuble */}
                <section className="form-section">
                    <h2>🏠 Adresse de l'immeuble</h2>

                    <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.memeAdresse}
                                onChange={(e) => updateField('memeAdresse', e.target.checked)}
                            />
                            <span>Même adresse que le client</span>
                        </label>
                    </div>

                    {!formData.memeAdresse && (
                        <>
                            <div className="form-group">
                                <label>Adresse *</label>
                                <input
                                    type="text"
                                    value={formData.immeubleAdresse}
                                    onChange={(e) => updateField('immeubleAdresse', e.target.value)}
                                    placeholder="Numéro et nom de rue"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Code postal</label>
                                    <input
                                        type="text"
                                        value={formData.immeubleCodePostal}
                                        onChange={(e) => updateField('immeubleCodePostal', e.target.value)}
                                        placeholder="04000"
                                        maxLength={5}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Ville</label>
                                    <input
                                        type="text"
                                        value={formData.immeubleVille}
                                        onChange={(e) => updateField('immeubleVille', e.target.value)}
                                        placeholder="Ville"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Qualité du client */}
                    <h3 style={{marginTop: '1rem', marginBottom: '0.5rem'}}>Qualité</h3>
                    <div className="checkbox-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.qualiteProprietaire}
                                onChange={(e) => {
                                    updateField('qualiteProprietaire', e.target.checked);
                                    if (e.target.checked) {
                                        updateField('qualiteLocataire', false);
                                        updateField('qualiteAutre', false);
                                    }
                                }}
                            />
                            <span>Propriétaire</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.qualiteLocataire}
                                onChange={(e) => {
                                    updateField('qualiteLocataire', e.target.checked);
                                    if (e.target.checked) {
                                        updateField('qualiteProprietaire', false);
                                        updateField('qualiteAutre', false);
                                    }
                                }}
                            />
                            <span>Locataire</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.qualiteAutre}
                                onChange={(e) => {
                                    updateField('qualiteAutre', e.target.checked);
                                    if (e.target.checked) {
                                        updateField('qualiteProprietaire', false);
                                        updateField('qualiteLocataire', false);
                                    }
                                }}
                            />
                            <span>Autre</span>
                        </label>
                    </div>

                    {formData.qualiteAutre && (
                        <div className="form-group">
                            <label>Précisez votre qualité</label>
                            <input
                                type="text"
                                value={formData.qualiteAutreTexte}
                                onChange={(e) => updateField('qualiteAutreTexte', e.target.value)}
                                placeholder="Ex: Mandataire, Syndic..."
                            />
                        </div>
                    )}
                </section>

                {/* SECTION: Nature des locaux */}
                <section className="form-section">
                    <h2>🏢 Nature des locaux</h2>

                    <div className="checkbox-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.natureMaison}
                                onChange={(e) => {
                                    updateField('natureMaison', e.target.checked);
                                    if (e.target.checked) {
                                        updateField('natureAppartement', false);
                                        updateField('natureAutreLocal', false);
                                    }
                                }}
                            />
                            <span>🏡 Maison individuelle</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.natureAppartement}
                                onChange={(e) => {
                                    updateField('natureAppartement', e.target.checked);
                                    if (e.target.checked) {
                                        updateField('natureMaison', false);
                                        updateField('natureAutreLocal', false);
                                    }
                                }}
                            />
                            <span>🏢 Appartement</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.natureAutreLocal}
                                onChange={(e) => {
                                    updateField('natureAutreLocal', e.target.checked);
                                    if (e.target.checked) {
                                        updateField('natureMaison', false);
                                        updateField('natureAppartement', false);
                                    }
                                }}
                            />
                            <span>🏗️ Autre local</span>
                        </label>
                    </div>

                    {formData.natureAutreLocal && (
                        <div className="form-group">
                            <label>Précisez</label>
                            <input
                                type="text"
                                value={formData.autreNatureTexte}
                                onChange={(e) => updateField('autreNatureTexte', e.target.value)}
                                placeholder="Type de local"
                            />
                        </div>
                    )}
                </section>

                {/* SECTION: Attestations obligatoires */}
                <section className="form-section attestations">
                    <h2>✅ Attestations obligatoires</h2>
                    <p className="section-info">Le client atteste que :</p>

                    <div className="attestation-list">
                        <label className={`checkbox-label attestation ${!formData.immeubleplus2ans ? 'invalid' : ''}`}>
                            <input
                                type="checkbox"
                                checked={formData.immeubleplus2ans}
                                onChange={(e) => updateField('immeubleplus2ans', e.target.checked)}
                            />
                            <span>L'immeuble est <strong>achevé depuis plus de 2 ans</strong></span>
                        </label>

                        <label className={`checkbox-label attestation ${!formData.pasImmeubleNeuf ? 'invalid' : ''}`}>
                            <input
                                type="checkbox"
                                checked={formData.pasImmeubleNeuf}
                                onChange={(e) => updateField('pasImmeubleNeuf', e.target.checked)}
                            />
                            <span>Les travaux <strong>n'aboutissent pas à la production d'un immeuble neuf</strong></span>
                        </label>

                        <label className={`checkbox-label attestation ${tooManyElements ? 'invalid' : ''}`}>
                            <input
                                type="checkbox"
                                checked={formData.moins6Elements}
                                onChange={(e) => updateField('moins6Elements', e.target.checked)}
                            />
                            <span>Les travaux ne portent pas sur plus de <strong>5 des 6 éléments</strong> de second œuvre</span>
                        </label>
                    </div>

                    {tooManyElements && (
                        <div className="warning-banner">
                            ⚠️ Attention: {elementsCount} éléments de second œuvre sont cochés.
                            Si plus de 5 éléments sont touchés, la TVA à 10% ne s'applique pas.
                        </div>
                    )}
                </section>

                {/* SECTION: Éléments de second œuvre */}
                <section className="form-section">
                    <h2>🔧 Éléments de second œuvre concernés ({elementsCount}/6)</h2>
                    <p className="section-info">Cochez les éléments touchés par les travaux</p>

                    <div className="checkbox-grid elements-grid">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemPlanchers}
                                onChange={(e) => updateField('elemPlanchers', e.target.checked)}
                            />
                            <span>Planchers non porteurs</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemHuisseries}
                                onChange={(e) => updateField('elemHuisseries', e.target.checked)}
                            />
                            <span>Huisseries extérieures</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemCloisons}
                                onChange={(e) => updateField('elemCloisons', e.target.checked)}
                            />
                            <span>Cloisons intérieures</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemSanitaires}
                                onChange={(e) => updateField('elemSanitaires', e.target.checked)}
                            />
                            <span>🚿 Installations sanitaires</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemPlomberie}
                                onChange={(e) => updateField('elemPlomberie', e.target.checked)}
                            />
                            <span>🔧 Plomberie</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemElectriques}
                                onChange={(e) => updateField('elemElectriques', e.target.checked)}
                            />
                            <span>⚡ Installations électriques</span>
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.elemChauffage}
                                onChange={(e) => updateField('elemChauffage', e.target.checked)}
                            />
                            <span>🔥 Chauffage</span>
                        </label>
                    </div>
                </section>

                {/* SECTION: Description des travaux */}
                <section className="form-section">
                    <h2>📝 Description des travaux</h2>

                    <div className="form-group">
                        <label>Nature des travaux</label>
                        <textarea
                            value={formData.descriptionTravaux}
                            onChange={(e) => updateField('descriptionTravaux', e.target.value)}
                            placeholder="Décrivez les travaux effectués..."
                            rows={4}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Montant HT (€)</label>
                            <input
                                type="number"
                                value={formData.montantHT}
                                onChange={(e) => updateField('montantHT', e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                            />
                        </div>
                        <div className="form-group">
                            <label>TVA 10% (€)</label>
                            <input
                                type="text"
                                value={formData.montantTVA}
                                readOnly
                                className="readonly"
                            />
                        </div>
                        <div className="form-group">
                            <label>Montant TTC (€)</label>
                            <input
                                type="text"
                                value={formData.montantTTC}
                                readOnly
                                className="readonly"
                            />
                        </div>
                    </div>
                </section>

                {/* SECTION: Signature client */}
                <section className="form-section">
                    <h2>✍️ Signature du client</h2>
                    <p className="section-info">Le client certifie l'exactitude des informations</p>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Fait à</label>
                            <input
                                type="text"
                                value={formData.lieu}
                                onChange={(e) => updateField('lieu', e.target.value)}
                                placeholder="Lieu"
                            />
                        </div>
                        <div className="form-group">
                            <label>Le</label>
                            <input
                                type="text"
                                value={formData.dateAttestation}
                                onChange={(e) => updateField('dateAttestation', e.target.value)}
                                placeholder="Date"
                            />
                        </div>
                    </div>

                    <div className="signature-section">
                        <label>Signature du client</label>
                        <SignaturePad
                            onSignatureChange={(sig) => updateField('signatureClient', sig)}
                            initialSignature={formData.signatureClient}
                        />
                    </div>
                </section>

                {/* Actions */}
                <div className="form-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleReset}
                    >
                        🔄 Réinitialiser
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleGenerate}
                        disabled={isGenerating || !formData.immeubleplus2ans || tooManyElements}
                    >
                        {isGenerating ? '⏳ Génération...' : '📄 Générer le PDF'}
                    </button>
                </div>
            </div>

            {/* Footer info */}
            <div className="cerfa-footer">
                <p>
                    <strong>CERFA 1301-SD</strong> - Attestation simplifiée pour bénéficier du taux réduit de TVA (10%)
                    sur les travaux de rénovation de logements de plus de 2 ans.
                </p>
            </div>
        </div>
    );
}

export default CerfaPage1301;
