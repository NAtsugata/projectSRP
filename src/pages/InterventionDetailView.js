// src/pages/InterventionDetailView.js - VERSION FINALE CORRIGÉE
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';

// --- Import des composants UI ---
import MobileFileInput from '../components/MobileFileInput';
import InterventionChecklist from '../components/InterventionChecklist'; // <-- INTÉGRATION
import {
    ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon,
    AlertTriangleIcon, LoaderIcon, ExpandIcon, RefreshCwIcon,
    XCircleIcon, ImageIcon
} from '../components/SharedUI';

// --- Import des hooks et configurations pour la checklist ---
import { useChecklistPDFGenerator } from '../hooks/useChecklistPDFGenerator'; // <-- INTÉGRATION
import { CHECKLIST_TEMPLATES } from '../config/checklistTemplates'; // <-- INTÉGRATION

// =================================================================================
// COMPOSANT D'IMAGE OPTIMISÉ (Lazy loading)
// =================================================================================
const OptimizedImage = ({ src, alt, className, style, onClick }) => {
    const [loadState, setLoadState] = useState('loading');
    const imgRef = useRef(null);

    useEffect(() => {
        if (!src) {
            setLoadState('error');
            return;
        }
        const img = new Image();
        img.onload = () => setLoadState('loaded');
        img.onerror = () => setLoadState('error');

        // Intersection Observer pour le lazy loading
        if ('IntersectionObserver' in window && imgRef.current) {
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    img.src = src;
                    observer.disconnect();
                }
            }, { rootMargin: '50px' });
            observer.observe(imgRef.current);
            return () => observer.disconnect();
        } else { // Fallback pour les anciens navigateurs
            img.src = src;
        }
    }, [src]);

    if (loadState === 'loading') return <div ref={imgRef} className={`${className} flex items-center justify-center bg-gray-100`} style={style}><LoaderIcon className="animate-spin" /></div>;
    if (loadState === 'error') return <div className={`${className} flex items-center justify-center bg-red-100 text-red-600`} style={style}><XCircleIcon /></div>;

    return <img ref={imgRef} src={src} alt={alt} className={className} style={{...style, display: 'block'}} onClick={onClick} loading="lazy" />;
};


// =================================================================================
// MODALE DE SIGNATURE PLEIN ÉCRAN
// =================================================================================
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const canvasRef = useRef(null);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Ajustement de la taille du canvas à la fenêtre
        const isMobile = window.innerWidth < 768;
        canvas.width = Math.min(window.innerWidth * 0.9, 600);
        canvas.height = isMobile ? window.innerHeight * 0.5 : 300;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Charger la signature existante si elle existe
        if (existingSignature) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setHasDrawn(true);
            };
            img.src = existingSignature;
        }

        let drawing = false;
        let lastPos = null;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        const startDrawing = (e) => { e.preventDefault(); drawing = true; setHasDrawn(true); lastPos = getPos(e); ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); };
        const stopDrawing = (e) => { e.preventDefault(); drawing = false; lastPos = null; };
        const draw = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); if(lastPos) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); } lastPos = pos; };

        // Listeners pour souris et tactile
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchend', stopDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchend', stopDrawing);
            canvas.removeEventListener('touchmove', draw);
        };
    }, [existingSignature]);

    const handleSave = () => { if (canvasRef.current) { onSave(canvasRef.current.toDataURL('image/png')); } };
    const handleClear = () => { const canvas = canvasRef.current; if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); setHasDrawn(false); } };

    return (
        <div className="modal-overlay">
            <div className="modal-content signature-modal-content">
                <h3>✍️ Signature du client</h3>
                <p style={{fontSize: '0.875rem', color: '#6c757d', marginBottom: '1rem'}}>
                    Veuillez faire signer le client ci-dessous
                </p>
                <canvas ref={canvasRef} className="signature-canvas-fullscreen" />
                <div className="modal-footer" style={{marginTop: '1rem'}}>
                    <button type="button" onClick={handleClear} className="btn btn-secondary">Effacer</button>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                    <button type="button" onClick={handleSave} className="btn btn-primary" disabled={!hasDrawn}>Valider</button>
                </div>
            </div>
        </div>
    );
};

// =================================================================================
// COMPOSANT PRINCIPAL
// =================================================================================
export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, showToast }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();

    // --- États ---
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadState, setUploadState] = useState({ isUploading: false, queue: [], globalProgress: 0, error: null });
    const [fileListKey, setFileListKey] = useState(Date.now());
    const storageKey = `srp-intervention-report-${interventionId}`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // --- NOUVEAUX ÉTATS POUR LA CHECKLIST ---
    const [selectedChecklistId, setSelectedChecklistId] = useState('');
    const [checklistState, setChecklistState] = useState({});
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const { generateChecklistPDF } = useChecklistPDFGenerator();

    // --- Initialisation et restauration depuis la session ---
    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            const savedReport = window.sessionStorage.getItem(storageKey);
            const initialReport = savedReport
                ? JSON.parse(savedReport)
                : (foundIntervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null, checklist: null });

            setReport(initialReport);

            // Restauration de l'état de la checklist
            if (initialReport.checklist) {
                setSelectedChecklistId(initialReport.checklist.id || '');
                setChecklistState(initialReport.checklist.data || {});
            }
            setLoading(false);
        } else if (interventions.length > 0) {
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate, storageKey]);

    // --- Sauvegarde automatique en session à chaque changement ---
    useEffect(() => {
        if (report && intervention) {
            // On inclut la checklist dans la sauvegarde de session
            const reportToSave = { ...report, checklist: { id: selectedChecklistId, data: checklistState } };
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(reportToSave));
            } catch (error) {
                console.warn("Impossible de sauvegarder le rapport en session :", error);
            }
        }
    }, [report, checklistState, selectedChecklistId, storageKey, intervention]);

    // --- Fonctions de mise à jour et de formatage ---
    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));
    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    // --- Compression d'image ---
    const compressImage = useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const img = new Image();
            img.onload = () => {
                const maxWidth = isMobile ? 1280 : 1920;
                const maxHeight = isMobile ? 720 : 1080;
                let { width, height } = img;
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                if (ratio < 1) { width *= ratio; height *= ratio; }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    const compressedFile = blob && blob.size < file.size ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file;
                    resolve(compressedFile);
                }, 'image/jpeg', 0.8);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }, [isMobile]);

    // --- Logique d'upload réutilisable (pour photos et PDF de checklist) ---
    const processAndUploadFiles = useCallback(async (filesToUpload) => {
        if (!filesToUpload || filesToUpload.length === 0 || !intervention) return [];

        setUploadState(prev => ({ ...prev, isUploading: true, error: null }));

        const successfulUploads = [];
        for (const file of filesToUpload) {
            try {
                const fileToUpload = await compressImage(file);
                const result = await storageService.uploadInterventionFile(fileToUpload, interventionId, 'report');
                if (result.error) throw result.error;
                successfulUploads.push({ name: file.name, url: result.publicURL, type: file.type });
            } catch (error) {
                console.error(`❌ Erreur upload ${file.name}:`, error);
                showToast(`Erreur d'upload: ${error.message}`, 'error');
                setUploadState(prev => ({ ...prev, error: error.message }));
            }
        }

        if (successfulUploads.length > 0) {
            setReport(prev => {
                const updatedReport = { ...prev, files: [...(prev.files || []), ...successfulUploads] };
                onSaveSilent(interventionId, updatedReport);
                return updatedReport;
            });
            setFileListKey(Date.now());
        }

        setUploadState(prev => ({ ...prev, isUploading: false }));
        return successfulUploads;
    }, [intervention, interventionId, compressImage, onSaveSilent, showToast]);

    const handleFileSelect = (event) => processAndUploadFiles(event.target.files);
    const handleUploadError = useCallback((errors) => showToast(errors.join(' • '), 'error'), [showToast]);

    // --- HANDLERS SPÉCIFIQUES À LA CHECKLIST ---
    const handleChecklistSelection = (e) => {
        const newId = e.target.value;
        setSelectedChecklistId(newId);
        setChecklistState({}); // Réinitialise les données si on change de modèle
    };

    const handleGenerateAndUploadChecklist = async () => {
        if (!selectedChecklistId) {
            showToast("Veuillez d'abord sélectionner un type de checklist.", "error");
            return;
        }
        setIsGeneratingPDF(true);
        try {
            const template = CHECKLIST_TEMPLATES.find(t => t.id === selectedChecklistId);
            const pdfFile = await generateChecklistPDF(template, checklistState, intervention);
            await processAndUploadFiles([pdfFile]); // Réutilise la logique d'upload
            showToast("Checklist PDF ajoutée au rapport.", "success");
        } catch (error) {
            console.error("Erreur génération/upload checklist:", error);
            showToast("Erreur lors de la création de la checklist.", "error");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // --- Signature et sauvegarde finale ---
    const handleClearSignature = () => handleReportChange('signature', null);
    const handleSaveSignatureFromModal = (signatureDataUrl) => { handleReportChange('signature', signatureDataUrl); setShowSignatureModal(false); };

    const handleSave = async () => {
        if (!intervention) return;
        setIsSaving(true);
        try {
            const finalReport = { ...report, checklist: { id: selectedChecklistId, data: checklistState } };
            await onSave(intervention.id, finalReport);
            window.sessionStorage.removeItem(storageKey);
        } catch (error) {
            console.error('❌ Erreur sauvegarde finale:', error);
            showToast('La sauvegarde a échoué.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // --- Rendu ---
    if (loading || !report) return <div className="loading-container"><LoaderIcon className="animate-spin" /><p>Chargement...</p></div>;

    return (
        <div>
            {showSignatureModal && <SignatureModal onSave={handleSaveSignatureFromModal} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}

            <button onClick={() => navigate('/planning')} className="back-button"><ChevronLeftIcon /> Retour</button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service}</p>
                <p className="text-muted">{intervention.address}</p>
                <div className="section">
                    <h3>📋 Documents de préparation</h3>
                    {intervention.intervention_briefing_documents?.length > 0 ? (
                        <ul className="document-list-optimized">
                            {intervention.intervention_briefing_documents.map(doc => (
                                <li key={doc.id} className="document-item-optimized">
                                    <FileTextIcon />
                                    <span className="file-name">{doc.file_name}</span>
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary"><DownloadIcon /> Voir</a>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-muted">Aucun document de préparation.</p>}
                </div>
            </div>

            {/* --- SECTION CHECKLIST INTÉGRÉE --- */}
            <div className="card-white">
                <h3 className="section-title">Checklist d'Intervention</h3>
                <div className="form-group">
                    <label htmlFor="checklist-select">Type de checklist :</label>
                    <select id="checklist-select" className="form-control" value={selectedChecklistId} onChange={handleChecklistSelection} disabled={isAdmin}>
                        <option value="">-- Sélectionnez une checklist --</option>
                        {Object.values(CHECKLIST_TEMPLATES).map(opt => <option key={opt.id} value={opt.id}>{opt.title}</option>)}
                    </select>
                </div>
                {selectedChecklistId && (
                    <div className="mt-4">
                        <InterventionChecklist
                            template={CHECKLIST_TEMPLATES.find(t => t.id === selectedChecklistId)}
                            checklistState={checklistState}
                            onStateChange={setChecklistState}
                            readOnly={isAdmin}
                        />
                        {!isAdmin && (
                            <button className="btn btn-success w-full mt-4 flex-center" onClick={handleGenerateAndUploadChecklist} disabled={isGeneratingPDF || uploadState.isUploading}>
                                {isGeneratingPDF ? <><LoaderIcon className="animate-spin" /> Génération...</> : <><CheckCircleIcon /> Valider et Joindre la Checklist</>}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="card-white">
                <div className="section">
                    <h3>⏱️ Pointage</h3>
                    <div className="grid-2-cols">
                        <button onClick={() => handleReportChange('arrivalTime', new Date().toISOString())} className="btn btn-success" disabled={!!report.arrivalTime || isAdmin}>
                            {report.arrivalTime ? `✅ Arrivé: ${formatTime(report.arrivalTime)}` : '🕐 Arrivée sur site'}
                        </button>
                        <button onClick={() => handleReportChange('departureTime', new Date().toISOString())} className="btn btn-danger" disabled={!report.arrivalTime || !!report.departureTime || isAdmin}>
                            {report.departureTime ? `✅ Parti: ${formatTime(report.departureTime)}` : '🚪 Départ du site'}
                        </button>
                    </div>
                </div>

                <div className="section">
                    <h3>📝 Rapport de chantier</h3>
                    <textarea value={report.notes || ''} onChange={e => handleReportChange('notes', e.target.value)} rows="5" className="form-control" placeholder="Détails, matériel utilisé, observations..." readOnly={isAdmin} />
                </div>

                <div className="section">
                    <h3>📷 Photos et Documents</h3>
                    {report.files && report.files.length > 0 && (
                        <ul key={fileListKey} className="document-list-optimized" style={{marginBottom: '1rem'}}>
                            {report.files.map((file, idx) => (
                                <li key={`${file.url}-${idx}`} className="document-item-optimized">
                                    {file.type?.startsWith('image/') ? <OptimizedImage src={file.url} alt={file.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '0.25rem' }} /> : <FileTextIcon />}
                                    <span className="file-name">{file.name}</span>
                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary"><DownloadIcon /> Voir</a>
                                </li>
                            ))}
                        </ul>
                    )}
                    {!isAdmin && <MobileFileInput onChange={handleFileSelect} disabled={uploadState.isUploading} multiple accept="image/*,application/pdf" onError={handleUploadError}>
                        {uploadState.isUploading ? '⏳ Envoi en cours...' : '📷 Ajouter photos/documents'}
                    </MobileFileInput>}
                </div>

                <div className="section">
                    <h3>✍️ Signature du client</h3>
                    {report.signature ? (
                        <div>
                            <img src={report.signature} alt="Signature" style={{ width: '100%', maxWidth: '300px', border: '2px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f8f9fa' }} />
                            {!isAdmin && <button onClick={handleClearSignature} className="btn btn-sm btn-secondary" style={{marginTop: '0.5rem'}}>Effacer</button>}
                        </div>
                    ) : (
                        <div>
                            <p className="text-muted">Aucune signature.</p>
                            {!isAdmin && <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon /> Signer</button>}
                        </div>
                    )}
                </div>

                {!isAdmin && (
                    <button onClick={handleSave} disabled={uploadState.isUploading || isSaving || isGeneratingPDF} className="btn btn-primary w-full mt-4">
                        {isSaving ? <><LoaderIcon className="animate-spin" /> Sauvegarde...</> : "🔒 Sauvegarder et Clôturer"}
                    </button>
                )}
                {isAdmin && <div className="mobile-admin-notice">ℹ️ Mode consultation (administrateur)</div>}
            </div>
        </div>
    );
}
