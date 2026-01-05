// =============================
// FILE: src/pages/CerfaPage15498.js
// Formulaire CERFA 15498 - Attestation d'acquisition de fluides frigorigènes
// =============================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    fillCerfa15498,
    downloadCerfa,
    getCompanyInfo,
    saveCompanyInfo,
    saveGenerationRecord,
    getCurrentFicheInfo,
    resetFicheCounter,
    getNextFicheNumber
} from '../utils/cerfaService';
import { supabase } from '../lib/supabase';
import SignaturePad from '../components/SignaturePad';
import '../components/CerfaGeneratorModal.css';

function CerfaPage15498() {
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        // ACQUÉREUR (Client)
        acq_nom: '',
        acq_num: '',
        acq_voie: '',
        acq_compl: '',
        acq_lieu: '',
        acq_postal: '',
        acq_commune: '',
        acq_pays: 'France',
        acq_ref: '',

        // INSTALLATEUR (Intervenant)
        inst_raison: '',
        inst_service: '',
        inst_num: '',
        inst_voie: '',
        inst_lieu: '',
        inst_postal: '',
        inst_commune: '',
        inst_pays: 'France',
        inst_siret: '',
        inst_attestation: '',
        inst_contact: '',
        inst_tel: '',
        inst_fax: '',
        inst_email: '',
        inst_ref: '',

        // DISTRIBUTEUR
        dist_raison: '',
        dist_service: '',
        dist_num: '',
        dist_voie: '',
        dist_lieu: '',
        dist_postal: '',
        dist_commune: '',
        dist_pays: 'France',
        dist_siret: '',
        dist_tel: '',
        dist_fax: '',
        dist_email: '',

        // ÉQUIPEMENT
        climatisation: false,
        pompe: false,
        hfc: false,
        pfc: false,

        // PÉRIODE ET DÉTAILS
        periode: '',
        details: '',

        // SIGNATURES
        sig_acq: '',
        sig_inst: '',
        sig_dist: '',
        signatureAcquereur: null,
        signatureInstallateur: null,
        signatureDistributeur: null,
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [toast, setToast] = useState(null);
    const [ficheInfo, setFicheInfo] = useState(() => getCurrentFicheInfo());
    const [showAdminReset, setShowAdminReset] = useState(false);

    // Rafraîchir le numéro de fiche après génération
    const refreshFicheInfo = useCallback(() => {
        setFicheInfo(getCurrentFicheInfo());
    }, []);

    // Charger les données depuis les paramètres URL ou localStorage
    useEffect(() => {
        const data = searchParams.get('data');
        if (data) {
            try {
                const parsedData = JSON.parse(decodeURIComponent(data));
                setFormData(prev => ({ ...prev, ...parsedData }));
            } catch (e) {
                console.error('Erreur parsing données URL:', e);
            }
        }

        // Charger les infos entreprise sauvegardées
        const companyInfo = getCompanyInfo();
        if (companyInfo) {
            setFormData(prev => ({
                ...prev,
                inst_raison: companyInfo.name || prev.inst_raison,
                inst_num: companyInfo.address?.split(',')[0] || prev.inst_num,
                inst_voie: companyInfo.address?.split(',')[0] || prev.inst_voie,
                inst_commune: companyInfo.address?.split(',')[1]?.trim() || prev.inst_commune,
                inst_siret: companyInfo.siret || prev.inst_siret,
                inst_tel: companyInfo.phone || prev.inst_tel,
                inst_attestation: companyInfo.attestationNumber || prev.inst_attestation,
            }));
        }
    }, [searchParams]);

    // Toast notification
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Gestion des changements
    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Sauvegarder les infos entreprise
    const saveCompanyData = useCallback(() => {
        const companyData = {
            name: formData.inst_raison,
            address: `${formData.inst_num} ${formData.inst_voie}, ${formData.inst_commune}`,
            phone: formData.inst_tel,
            siret: formData.inst_siret,
            attestationNumber: formData.inst_attestation,
        };
        if (saveCompanyInfo(companyData)) {
            showToast('Informations installateur sauvegardées', 'success');
        }
    }, [formData, showToast]);

    // Générer le CERFA
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        try {
            // Générer le numéro de fiche
            const ficheNumber = getNextFicheNumber();
            const clientName = (formData.acq_nom || 'client').replace(/[^a-zA-Z0-9]/g, '_');
            const date = new Date().toISOString().split('T')[0];

            // Passer les données au service PDF
            const pdfBlob = await fillCerfa15498({
                ...formData,
                ficheNo: ficheNumber,
            });

            // Nom du fichier avec numéro de fiche
            const filename = `${ficheNumber}_15498_${clientName}_${date}.pdf`;

            // Télécharger le PDF
            downloadCerfa(pdfBlob, filename);

            // Enregistrer dans Supabase Storage
            try {
                const filePath = `cerfa/${filename}`;
                const { error: uploadError } = await supabase.storage
                    .from('cerfa-documents')
                    .upload(filePath, pdfBlob, { upsert: true });

                if (!uploadError) {
                    // Enregistrer dans la base de données
                    await supabase
                        .from('cerfa_documents')
                        .insert({
                            numero: ficheNumber,
                            template_name: 'CERFA 15498',
                            file_path: filePath,
                            file_name: filename,
                            client_name: formData.acq_nom || '',
                            intervention_date: null,
                            notes: formData.details || ''
                        });
                    console.log('[CERFA 15498] ✓ Document enregistré dans Supabase');
                }
            } catch (storageError) {
                console.warn('[CERFA 15498] ✗ Erreur enregistrement Supabase:', storageError.message);
            }

            saveGenerationRecord({
                type: 'cerfa_15498',
                sourceType: 'manual',
                clientName: formData.acq_nom,
                filename,
                ficheNumber
            });

            showToast(`CERFA 15498 ${ficheNumber} généré avec succès !`, 'success');
            refreshFicheInfo();
        } catch (error) {
            console.error('Erreur génération CERFA 15498:', error);
            showToast(`Erreur: ${error.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    }, [formData, showToast, refreshFicheInfo]);

    // Réinitialiser le compteur (admin)
    const handleResetCounter = useCallback(() => {
        if (window.confirm('Voulez-vous vraiment réinitialiser le compteur de fiches CERFA à 0 ?')) {
            resetFicheCounter(0);
            refreshFicheInfo();
            showToast('Compteur réinitialisé', 'success');
            setShowAdminReset(false);
        }
    }, [refreshFicheInfo, showToast]);

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
                            <h1>CERFA 15498</h1>
                            <p>Attestation d'acquisition de fluides frigorigènes</p>
                        </div>
                    </div>
                    {/* Numéro de fiche */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '0.25rem'
                    }}>
                        <div style={{
                            background: 'rgba(156, 39, 176, 0.2)',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.9rem'
                        }}>
                            <span style={{ opacity: 0.7 }}>Prochaine fiche: </span>
                            <strong style={{ color: '#9C27B0' }}>
                                CERFA-{ficheInfo.year}-{String(ficheInfo.nextNumber).padStart(4, '0')}
                            </strong>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAdminReset(!showAdminReset)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                padding: '0.25rem'
                            }}
                        >
                            ⚙️ Admin
                        </button>
                    </div>
                </div>

                {/* Admin: Réinitialiser le compteur */}
                {showAdminReset && (
                    <div style={{
                        background: 'rgba(244, 67, 54, 0.1)',
                        border: '1px solid rgba(244, 67, 54, 0.3)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <strong style={{ color: '#f44336' }}>Administration</strong>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                                    Compteur actuel: {ficheInfo.count} fiches générées en {ficheInfo.year}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleResetCounter}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(244, 67, 54, 0.8)',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                🔄 Réinitialiser à 0
                            </button>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="cerfa-page-body">

                    {/* Section: Type d'équipement */}
                    <section className="cerfa-section">
                        <h3>🔧 Type d'équipement</h3>
                        <div className="cerfa-form-row" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.climatisation}
                                    onChange={(e) => handleChange('climatisation', e.target.checked)}
                                />
                                Climatisation
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.pompe}
                                    onChange={(e) => handleChange('pompe', e.target.checked)}
                                />
                                Pompe à chaleur
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.hfc}
                                    onChange={(e) => handleChange('hfc', e.target.checked)}
                                />
                                HFC
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.pfc}
                                    onChange={(e) => handleChange('pfc', e.target.checked)}
                                />
                                PFC
                            </label>
                        </div>
                    </section>

                    {/* Section 1: ACQUÉREUR */}
                    <section className="cerfa-section">
                        <h3>👤 1. ACQUÉREUR (Client)</h3>
                        <div className="cerfa-form-group">
                            <label>Nom / Raison sociale *</label>
                            <input
                                type="text"
                                value={formData.acq_nom}
                                onChange={(e) => handleChange('acq_nom', e.target.value)}
                                placeholder="Nom du client ou société"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>N°</label>
                                <input
                                    type="text"
                                    value={formData.acq_num}
                                    onChange={(e) => handleChange('acq_num', e.target.value)}
                                    placeholder="N°"
                                />
                            </div>
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Voie</label>
                                <input
                                    type="text"
                                    value={formData.acq_voie}
                                    onChange={(e) => handleChange('acq_voie', e.target.value)}
                                    placeholder="Rue, avenue..."
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Complément d'adresse</label>
                            <input
                                type="text"
                                value={formData.acq_compl}
                                onChange={(e) => handleChange('acq_compl', e.target.value)}
                                placeholder="Bâtiment, étage..."
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>Lieu-dit</label>
                            <input
                                type="text"
                                value={formData.acq_lieu}
                                onChange={(e) => handleChange('acq_lieu', e.target.value)}
                                placeholder="Lieu-dit"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Code postal</label>
                                <input
                                    type="text"
                                    value={formData.acq_postal}
                                    onChange={(e) => handleChange('acq_postal', e.target.value)}
                                    placeholder="75000"
                                />
                            </div>
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Commune</label>
                                <input
                                    type="text"
                                    value={formData.acq_commune}
                                    onChange={(e) => handleChange('acq_commune', e.target.value)}
                                    placeholder="Paris"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Pays</label>
                                <input
                                    type="text"
                                    value={formData.acq_pays}
                                    onChange={(e) => handleChange('acq_pays', e.target.value)}
                                    placeholder="France"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Référence</label>
                                <input
                                    type="text"
                                    value={formData.acq_ref}
                                    onChange={(e) => handleChange('acq_ref', e.target.value)}
                                    placeholder="Réf. interne"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: INSTALLATEUR */}
                    <section className="cerfa-section">
                        <h3>🔧 2. INSTALLATEUR / INTERVENANT</h3>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={saveCompanyData}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    background: 'rgba(33, 150, 243, 0.2)',
                                    border: '1px solid rgba(33, 150, 243, 0.5)',
                                    borderRadius: '4px',
                                    color: '#2196F3',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                }}
                            >
                                💾 Sauvegarder ces infos
                            </button>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Raison sociale *</label>
                            <input
                                type="text"
                                value={formData.inst_raison}
                                onChange={(e) => handleChange('inst_raison', e.target.value)}
                                placeholder="SRP - Services Réparation Plomberie"
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>Service</label>
                            <input
                                type="text"
                                value={formData.inst_service}
                                onChange={(e) => handleChange('inst_service', e.target.value)}
                                placeholder="Service technique"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>N°</label>
                                <input
                                    type="text"
                                    value={formData.inst_num}
                                    onChange={(e) => handleChange('inst_num', e.target.value)}
                                    placeholder="N°"
                                />
                            </div>
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Voie</label>
                                <input
                                    type="text"
                                    value={formData.inst_voie}
                                    onChange={(e) => handleChange('inst_voie', e.target.value)}
                                    placeholder="Rue, avenue..."
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Lieu-dit</label>
                            <input
                                type="text"
                                value={formData.inst_lieu}
                                onChange={(e) => handleChange('inst_lieu', e.target.value)}
                                placeholder="Lieu-dit"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Code postal</label>
                                <input
                                    type="text"
                                    value={formData.inst_postal}
                                    onChange={(e) => handleChange('inst_postal', e.target.value)}
                                    placeholder="75000"
                                />
                            </div>
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Commune</label>
                                <input
                                    type="text"
                                    value={formData.inst_commune}
                                    onChange={(e) => handleChange('inst_commune', e.target.value)}
                                    placeholder="Commune"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Pays</label>
                                <input
                                    type="text"
                                    value={formData.inst_pays}
                                    onChange={(e) => handleChange('inst_pays', e.target.value)}
                                    placeholder="France"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>SIRET</label>
                                <input
                                    type="text"
                                    value={formData.inst_siret}
                                    onChange={(e) => handleChange('inst_siret', e.target.value)}
                                    placeholder="123 456 789 00012"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>N° Attestation de capacité</label>
                            <input
                                type="text"
                                value={formData.inst_attestation}
                                onChange={(e) => handleChange('inst_attestation', e.target.value)}
                                placeholder="N° attestation"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Contact</label>
                                <input
                                    type="text"
                                    value={formData.inst_contact}
                                    onChange={(e) => handleChange('inst_contact', e.target.value)}
                                    placeholder="Nom du contact"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Téléphone</label>
                                <input
                                    type="tel"
                                    value={formData.inst_tel}
                                    onChange={(e) => handleChange('inst_tel', e.target.value)}
                                    placeholder="01 23 45 67 89"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Fax</label>
                                <input
                                    type="tel"
                                    value={formData.inst_fax}
                                    onChange={(e) => handleChange('inst_fax', e.target.value)}
                                    placeholder="01 23 45 67 89"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.inst_email}
                                    onChange={(e) => handleChange('inst_email', e.target.value)}
                                    placeholder="contact@srp.fr"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Référence interne</label>
                            <input
                                type="text"
                                value={formData.inst_ref}
                                onChange={(e) => handleChange('inst_ref', e.target.value)}
                                placeholder="Réf. interne"
                            />
                        </div>
                    </section>

                    {/* Section 3: DISTRIBUTEUR */}
                    <section className="cerfa-section">
                        <h3>🏭 3. DISTRIBUTEUR</h3>
                        <div className="cerfa-form-group">
                            <label>Raison sociale</label>
                            <input
                                type="text"
                                value={formData.dist_raison}
                                onChange={(e) => handleChange('dist_raison', e.target.value)}
                                placeholder="Nom du distributeur"
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>Service</label>
                            <input
                                type="text"
                                value={formData.dist_service}
                                onChange={(e) => handleChange('dist_service', e.target.value)}
                                placeholder="Service"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>N°</label>
                                <input
                                    type="text"
                                    value={formData.dist_num}
                                    onChange={(e) => handleChange('dist_num', e.target.value)}
                                    placeholder="N°"
                                />
                            </div>
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Voie</label>
                                <input
                                    type="text"
                                    value={formData.dist_voie}
                                    onChange={(e) => handleChange('dist_voie', e.target.value)}
                                    placeholder="Rue, avenue..."
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Lieu-dit</label>
                            <input
                                type="text"
                                value={formData.dist_lieu}
                                onChange={(e) => handleChange('dist_lieu', e.target.value)}
                                placeholder="Lieu-dit"
                            />
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Code postal</label>
                                <input
                                    type="text"
                                    value={formData.dist_postal}
                                    onChange={(e) => handleChange('dist_postal', e.target.value)}
                                    placeholder="75000"
                                />
                            </div>
                            <div className="cerfa-form-group" style={{ flex: 2 }}>
                                <label>Commune</label>
                                <input
                                    type="text"
                                    value={formData.dist_commune}
                                    onChange={(e) => handleChange('dist_commune', e.target.value)}
                                    placeholder="Commune"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Pays</label>
                                <input
                                    type="text"
                                    value={formData.dist_pays}
                                    onChange={(e) => handleChange('dist_pays', e.target.value)}
                                    placeholder="France"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>SIRET</label>
                                <input
                                    type="text"
                                    value={formData.dist_siret}
                                    onChange={(e) => handleChange('dist_siret', e.target.value)}
                                    placeholder="123 456 789 00012"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-row">
                            <div className="cerfa-form-group">
                                <label>Téléphone</label>
                                <input
                                    type="tel"
                                    value={formData.dist_tel}
                                    onChange={(e) => handleChange('dist_tel', e.target.value)}
                                    placeholder="01 23 45 67 89"
                                />
                            </div>
                            <div className="cerfa-form-group">
                                <label>Fax</label>
                                <input
                                    type="tel"
                                    value={formData.dist_fax}
                                    onChange={(e) => handleChange('dist_fax', e.target.value)}
                                    placeholder="01 23 45 67 89"
                                />
                            </div>
                        </div>
                        <div className="cerfa-form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                value={formData.dist_email}
                                onChange={(e) => handleChange('dist_email', e.target.value)}
                                placeholder="contact@distributeur.fr"
                            />
                        </div>
                    </section>

                    {/* Section: Période et Détails */}
                    <section className="cerfa-section">
                        <h3>📋 4. DÉTAILS</h3>
                        <div className="cerfa-form-group">
                            <label>Période</label>
                            <input
                                type="text"
                                value={formData.periode}
                                onChange={(e) => handleChange('periode', e.target.value)}
                                placeholder="Ex: Janvier 2026"
                            />
                        </div>
                        <div className="cerfa-form-group">
                            <label>Détails / Observations</label>
                            <textarea
                                value={formData.details}
                                onChange={(e) => handleChange('details', e.target.value)}
                                placeholder="Détails supplémentaires..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'inherit',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    </section>

                    {/* Section: SIGNATURES */}
                    <section className="cerfa-section">
                        <h3>✍️ 5. SIGNATURES</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                            {/* Signature Acquéreur */}
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                <h4 style={{ marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>👤 Acquéreur</h4>
                                <div className="cerfa-form-group">
                                    <label>Nom</label>
                                    <input
                                        type="text"
                                        value={formData.sig_acq}
                                        onChange={(e) => handleChange('sig_acq', e.target.value)}
                                        placeholder="Nom du signataire"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Signature</label>
                                    <SignaturePad
                                        onSave={(dataUrl) => handleChange('signatureAcquereur', dataUrl)}
                                        initialValue={formData.signatureAcquereur}
                                        width={250}
                                        height={100}
                                    />
                                </div>
                            </div>

                            {/* Signature Installateur */}
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                <h4 style={{ marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>🔧 Installateur</h4>
                                <div className="cerfa-form-group">
                                    <label>Nom</label>
                                    <input
                                        type="text"
                                        value={formData.sig_inst}
                                        onChange={(e) => handleChange('sig_inst', e.target.value)}
                                        placeholder="Nom du signataire"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Signature</label>
                                    <SignaturePad
                                        onSave={(dataUrl) => handleChange('signatureInstallateur', dataUrl)}
                                        initialValue={formData.signatureInstallateur}
                                        width={250}
                                        height={100}
                                    />
                                </div>
                            </div>

                            {/* Signature Distributeur */}
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
                                <h4 style={{ marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>🏭 Distributeur</h4>
                                <div className="cerfa-form-group">
                                    <label>Nom</label>
                                    <input
                                        type="text"
                                        value={formData.sig_dist}
                                        onChange={(e) => handleChange('sig_dist', e.target.value)}
                                        placeholder="Nom du signataire"
                                    />
                                </div>
                                <div className="cerfa-form-group">
                                    <label>Signature</label>
                                    <SignaturePad
                                        onSave={(dataUrl) => handleChange('signatureDistributeur', dataUrl)}
                                        initialValue={formData.signatureDistributeur}
                                        width={250}
                                        height={100}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="cerfa-page-footer">
                    <button
                        className="cerfa-generate-button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <span className="loading-spinner-small"></span>
                                Génération en cours...
                            </>
                        ) : (
                            <>
                                📄 Générer le CERFA 15498
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CerfaPage15498;
