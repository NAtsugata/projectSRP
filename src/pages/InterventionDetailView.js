import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon } from '../components/SharedUI';

// Composant pour la signature en plein écran - OPTIMISÉ MOBILE
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const modalCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;

        // ✅ NOUVEAU : Dimensions responsives
        const isMobile = window.innerWidth < 768;
        canvas.width = isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.9;
        canvas.height = isMobile ? window.innerHeight * 0.6 : window.innerHeight * 0.7;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile ? 4 : 3; // ✅ Trait plus épais sur mobile
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (existingSignature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = existingSignature;
        }

        let drawing = false;
        let lastPos = null;

        // ✅ NOUVEAU : Fonction de position unifiée mobile/desktop
        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        // ✅ NOUVEAU : Amélioration du dessin pour mobile
        const startDrawing = (e) => {
            e.preventDefault();
            drawing = true;
            setIsDrawing(true);
            const pos = getPos(e);
            lastPos = pos;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const stopDrawing = (e) => {
            e.preventDefault();
            drawing = false;
            lastPos = null;
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();

            const pos = getPos(e);

            // ✅ NOUVEAU : Lissage pour mobile
            if (lastPos) {
                ctx.beginPath();
                ctx.moveTo(lastPos.x, lastPos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }

            lastPos = pos;
        };

        // ✅ Events desktop
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', stopDrawing); // ✅ NOUVEAU

        // ✅ Events mobile avec passive: false pour preventDefault
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

    const handleSaveSignature = () => {
        if (modalCanvasRef.current) {
            onSave(modalCanvasRef.current.toDataURL('image/png'));
        }
    };

    const handleClear = () => {
        if (modalCanvasRef.current) {
            const canvas = modalCanvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setIsDrawing(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content signature-modal-content">
                <h3>Veuillez signer ci-dessous</h3>
                <canvas ref={modalCanvasRef} className="signature-canvas-fullscreen"></canvas>
                <div className="modal-footer">
                    <button type="button" onClick={handleClear} className="btn btn-secondary">Effacer</button>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                    <button type="button" onClick={handleSaveSignature} className="btn btn-primary" disabled={!isDrawing && !existingSignature}>Valider la Signature</button>
                </div>
            </div>
        </div>
    );
};

export default function InterventionDetailView({ interventions, onSave, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true); // ✅ AJOUT d'un état de chargement
    const signatureCanvasRef = useRef(null);
    const [uploadQueue, setUploadQueue] = useState([]);
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    // ✅ CORRECTION : Gestion améliorée du chargement et des erreurs
    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            setLoading(false);
        } else if (interventions.length > 0) {
            // Si les interventions sont chargées mais qu'on ne trouve pas l'ID
            console.error('Intervention non trouvée:', interventionId);
            navigate('/planning');
        }
        // Si interventions.length === 0, on attend qu'elles se chargent
    }, [interventions, interventionId, navigate]);

    useEffect(() => {
        if (intervention) {
            const savedReport = window.sessionStorage.getItem(storageKey);
            if (savedReport) {
                setReport(JSON.parse(savedReport));
            } else {
                setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null });
            }
        }
    }, [intervention, storageKey]);

    useEffect(() => {
        if (report) {
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(report));
            } catch (error) {
                console.error("Failed to save report to sessionStorage", error);
            }
        }
    }, [report, storageKey]);

    useEffect(() => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        if (report && report.signature) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = report.signature;
        } else {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

    }, [report, report?.signature]);

    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));

    // ✅ CORRECTION : Gestion mobile améliorée des fichiers
    const handleFileUpload = (event) => {
        const filesToUpload = Array.from(event.target.files);

        if (filesToUpload.length === 0 || !intervention) return;

        // ✅ NOUVEAU : Validation spécifique mobile
        const maxFileSize = 10 * 1024 * 1024; // 10MB limite pour mobile
        const oversizedFiles = filesToUpload.filter(file => file.size > maxFileSize);

        if (oversizedFiles.length > 0) {
            alert(`Certains fichiers sont trop volumineux (limite: 10MB):\n${oversizedFiles.map(f => f.name).join('\n')}`);
            return;
        }

        // ✅ IMPORTANT : Reset de l'input après sélection (crucial pour mobile)
        if (event.target) {
            event.target.value = "";
        }

        processUploadQueue(filesToUpload);
    };

    // ✅ NOUVEAU : Upload séquentiel optimisé mobile
    const processUploadQueue = async (filesToUpload) => {
        const initialQueue = filesToUpload.map(file => ({
            name: file.name,
            status: 'uploading',
            error: null,
            progress: 0
        }));
        setUploadQueue(initialQueue);

        // Upload séquentiel pour éviter la surcharge sur mobile
        const uploadResults = [];
        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            try {
                // Mise à jour du progrès
                setUploadQueue(prev => prev.map((item, idx) =>
                    idx === i ? { ...item, progress: 50 } : item
                ));

                const result = await storageService.uploadInterventionFile(file, intervention.id);

                setUploadQueue(prev => prev.map((item, idx) =>
                    idx === i ? {
                        ...item,
                        status: result.error ? 'error' : 'success',
                        error: result.error?.message || null,
                        progress: 100
                    } : item
                ));

                uploadResults.push(result);
            } catch (error) {
                setUploadQueue(prev => prev.map((item, idx) =>
                    idx === i ? {
                        ...item,
                        status: 'error',
                        error: error.message,
                        progress: 0
                    } : item
                ));
                uploadResults.push({ error });
            }
        }

        // Traitement des résultats
        const newFiles = [];
        uploadResults.forEach((result, index) => {
            if (!result.error) {
                const fileInfo = {
                    name: filesToUpload[index].name,
                    url: result.publicURL,
                    type: filesToUpload[index].type
                };
                newFiles.push(fileInfo);
            }
        });

        if (newFiles.length > 0) {
            handleReportChange('files', [...(report.files || []), ...newFiles]);
        }

        // Nettoyage après délai plus court sur mobile
        setTimeout(() => setUploadQueue([]), 3000);
    };

    const handleSave = () => {
        if (!intervention) return;
        const finalReport = { ...report };
        window.sessionStorage.removeItem(storageKey);
        onSave(intervention.id, finalReport);
    };

    const handleGoBack = () => {
        navigate('/planning');
    };

    const handleClearSignature = () => {
        if (signatureCanvasRef.current) {
            const canvas = signatureCanvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setReport(prevReport => ({...prevReport, signature: null}));
        }
    };

    const handleSaveSignatureFromModal = (signatureDataUrl) => {
        setReport(prevReport => ({...prevReport, signature: signatureDataUrl}));
        setShowSignatureModal(false);
    };

    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR') : 'N/A';

    const isUploading = uploadQueue.some(file => file.status === 'uploading');

    // ✅ CORRECTION : Condition de chargement améliorée
    if (loading || (!intervention && interventions.length === 0)) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement de l'intervention...</p>
            </div>
        );
    }

    // ✅ NOUVEAU : Gestion du cas où l'intervention n'existe pas
    if (!intervention) {
        return (
            <div className="card-white">
                <h2>Intervention non trouvée</h2>
                <p>L'intervention demandée n'existe pas ou a été supprimée.</p>
                <button onClick={() => navigate('/planning')} className="btn btn-primary">
                    Retour au planning
                </button>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement du rapport...</p>
            </div>
        );
    }

    return (
        <div>
            {showSignatureModal && (
                <SignatureModal
                    onSave={handleSaveSignatureFromModal}
                    onCancel={() => setShowSignatureModal(false)}
                    existingSignature={report.signature}
                />
            )}

            <style>{`
                .document-list-detailed, .upload-queue-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
                .document-list-detailed li, .upload-queue-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; min-height: 60px; }
                .document-thumbnail { width: 40px; height: 40px; object-fit: cover; border-radius: 0.25rem; background-color: #e9ecef; }
                .document-icon, .upload-status-icon { width: 24px; height: 24px; flex-shrink: 0; }
                .upload-status-icon.success { color: #28a745; }
                .upload-status-icon.error { color: #dc3545; }
                .upload-status-icon.loading { color: #007bff; animation: spin 1s linear infinite; }
                .document-list-detailed li span, .upload-queue-list li .file-name { flex-grow: 1; font-size: 0.9rem; word-break: break-all; }
                .upload-queue-list li .error-message { font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem; }
                .document-list-detailed li .btn { flex-shrink: 0; }
                .signature-container { position: relative; }
                .signature-canvas { border: 1px solid #ccc; border-radius: 0.375rem; cursor: crosshair; touch-action: none; }
                .signature-canvas-fullscreen { border: 2px dashed #ccc; border-radius: 0.5rem; touch-action: none; width: 100%; }
                .signature-modal-content { max-width: 95vw; width: auto; padding: 1rem; }
                .signature-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; }
                .upload-progress { width: 100%; height: 4px; background-color: #e5e7eb; border-radius: 2px; overflow: hidden; margin-top: 0.5rem; }
                .upload-progress-bar { height: 100%; background-color: #3b82f6; transition: width 0.3s ease; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    .signature-modal-content { width: 95vw !important; max-width: none !important; padding: 0.5rem !important; }
                    .signature-canvas-fullscreen { height: 60vh; border-radius: 0.25rem; }
                    .upload-queue-list li { align-items: flex-start; padding: 1rem; }
                }
            `}</style>

            <button onClick={handleGoBack} className="back-button"><ChevronLeftIcon /> Retour au planning</button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                <div className="section">
                    <h3>Documents de préparation</h3>
                    {(intervention.intervention_briefing_documents && intervention.intervention_briefing_documents.length > 0) ? (
                        <ul className="document-list">
                            {intervention.intervention_briefing_documents.map(doc => (
                                <li key={doc.id}>
                                    <span>{doc.file_name}</span>
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary"><DownloadIcon/> Voir</a>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-muted">Aucun document de préparation.</p>}
                </div>

                <div className="section">
                    <h3>Pointage</h3>
                    <div className="grid-2-cols">
                        <button onClick={() => handleReportChange('arrivalTime', new Date().toISOString())} className="btn btn-success" disabled={!!report.arrivalTime || isAdmin}>Arrivée sur site</button>
                        <button onClick={() => handleReportChange('departureTime', new Date().toISOString())} className="btn btn-danger" disabled={!report.arrivalTime || !!report.departureTime || isAdmin}>Départ du site</button>
                    </div>
                    <div className="time-display">
                        <p>Heure d'arrivée: <span>{formatTime(report.arrivalTime)}</span></p>
                        <p>Heure de départ: <span>{formatTime(report.departureTime)}</span></p>
                    </div>
                </div>

                <div className="section">
                    <h3>Rapport de chantier</h3>
                    <textarea value={report.notes || ''} onChange={e => handleReportChange('notes', e.target.value)} placeholder="Détails de l'intervention..." rows="4" className="form-control" readOnly={isAdmin}></textarea>
                </div>

                <div className="section">
                    <h3>Photos et Documents du Rapport</h3>
                    <ul className="document-list-detailed">
                        {(report.files || []).map((file, idx) => (
                            <li key={idx}>
                                {file.type.startsWith('image/') ? (
                                    <img src={file.url} alt={`Aperçu de ${file.name}`} className="document-thumbnail" />
                                ) : (
                                    <FileTextIcon className="document-icon" />
                                )}
                                <span>{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Voir</a>
                            </li>
                        ))}
                    </ul>

                    {uploadQueue.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">Téléchargements en cours...</h4>
                            <ul className="upload-queue-list">
                                {uploadQueue.map((file, idx) => (
                                    <li key={idx}>
                                        {file.status === 'uploading' && <LoaderIcon className="upload-status-icon loading" />}
                                        {file.status === 'success' && <CheckCircleIcon className="upload-status-icon success" />}
                                        {file.status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}
                                        <div className="flex flex-col" style={{flex: 1}}>
                                            <span className="file-name">{file.name}</span>
                                            {file.progress > 0 && file.status === 'uploading' && (
                                                <div className="upload-progress">
                                                    <div className="upload-progress-bar" style={{width: `${file.progress}%`}}></div>
                                                </div>
                                            )}
                                            {file.error && <span className="error-message">{file.error}</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!isAdmin && (
                        <CustomFileInput
                            accept="image/*,application/pdf"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            multiple
                            className="mt-4"
                        >
                            {isUploading ? 'Envoi en cours...' : 'Ajouter des fichiers (Photo/PDF)'}
                        </CustomFileInput>
                    )}
                </div>

                <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? (
                        <img src={report.signature} alt="Signature client" style={{border: '1px solid #ccc', borderRadius: '0.375rem', maxWidth: '100%'}} />
                    ) : (
                        <div className="signature-container">
                            <canvas ref={signatureCanvasRef} className="signature-canvas" width="300" height="150"></canvas>
                            <div className="signature-actions">
                                <button onClick={handleClearSignature} className="text-muted-link">Effacer</button>
                                <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary btn-sm">
                                    <ExpandIcon /> Agrandir
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!isAdmin && (
                    <button onClick={handleSave} disabled={isUploading} className="btn btn-primary w-full mt-4">
                        {isUploading ? 'Veuillez attendre la fin des envois' : 'Sauvegarder et Clôturer le rapport'}
                    </button>
                )}
            </div>
        </div>
    );
}