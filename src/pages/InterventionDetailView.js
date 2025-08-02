import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Je présume que storageService est un wrapper que vous avez créé pour le téléversement.
// Si ce n'est pas le cas, il faudra le remplacer par l'appel direct à votre API ou service de stockage.
import { storageService } from '../lib/supabase'; // Assurez-vous que ce chemin d'import est correct
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon, XCircleIcon, RefreshCwIcon } from '../components/SharedUI';

// Le composant SignatureModal reste identique, il est bien conçu.
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const modalCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;
        const isMobile = window.innerWidth < 768;
        canvas.width = isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.9;
        canvas.height = isMobile ? window.innerHeight * 0.6 : window.innerHeight * 0.7;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile ? 4 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (existingSignature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = existingSignature;
        }
        let drawing = false;
        let lastPos = null;
        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
        };
        const startDrawing = (e) => { e.preventDefault(); drawing = true; setIsDrawing(true); lastPos = getPos(e); ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); };
        const stopDrawing = (e) => { e.preventDefault(); drawing = false; lastPos = null; };
        const draw = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); if (lastPos) { ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); } lastPos = pos; };
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

    const handleSaveSignature = () => modalCanvasRef.current && onSave(modalCanvasRef.current.toDataURL('image/png'));
    const handleClear = () => { if (modalCanvasRef.current) { const canvas = modalCanvasRef.current; const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); setIsDrawing(false); } };

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


export default function InterventionDetailView({ interventions, onSave, isAdmin, onAddBriefingDocuments }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const signatureCanvasRef = useRef(null);
    const [uploadQueue, setUploadQueue] = useState([]);
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            setLoading(false);
        } else if (interventions.length > 0) {
            console.error('Intervention non trouvée:', interventionId);
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate]);

    useEffect(() => {
        if (intervention) {
            const savedReport = window.sessionStorage.getItem(storageKey);
            if (savedReport) {
                try { setReport(JSON.parse(savedReport)); } catch (error) { console.error("Erreur parsing du rapport sauvegardé:", error); setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null }); }
            } else { setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null }); }
        }
    }, [intervention, storageKey]);

    useEffect(() => {
        if (report) {
            try { window.sessionStorage.setItem(storageKey, JSON.stringify(report)); } catch (error) { console.error("Failed to save report to sessionStorage", error); }
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
            img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
            img.src = report.signature;
        } else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }, [report, report?.signature]);

    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));

    const handleFileSelect = (event) => {
        const filesToUpload = Array.from(event.target.files);
        if (filesToUpload.length === 0 || !intervention) return;

        const maxFileSize = 10 * 1024 * 1024;
        const validFiles = [];
        const oversizedFiles = [];

        filesToUpload.forEach(file => {
            if (file.size > maxFileSize) {
                oversizedFiles.push(file.name);
            } else {
                validFiles.push(file);
            }
        });

        if (oversizedFiles.length > 0) {
            alert(`Certains fichiers sont trop volumineux (limite: 10MB) et ne seront pas ajoutés:\n${oversizedFiles.join('\n')}`);
        }

        if (validFiles.length > 0) {
            const newQueueItems = validFiles.map(file => ({
                id: `${file.name}-${file.size}-${file.lastModified}`,
                name: file.name,
                status: 'pending',
                error: null,
                progress: 0,
                fileObject: file,
            }));
            setUploadQueue(prev => [...prev, ...newQueueItems]);
            // Déclencher le téléversement automatiquement
            processUploadQueue(newQueueItems);
        }

        if (event.target) event.target.value = "";
    };

    // ✅ CORRECTION MAJEURE : Logique de téléversement robuste et résiliente
    const processUploadQueue = async (itemsToProcess) => {
        for (const item of itemsToProcess) {
            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 10 } : q));
            try {
                const result = await storageService.uploadInterventionFile(item.fileObject, intervention.id);
                setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: 50 } : q));

                if (result.error) throw result.error;

                const newFileInfo = { name: item.name, url: result.publicURL, type: item.fileObject.type };

                // ✅ MISE A JOUR IMMEDIATE: Sauvegarde l'état du rapport après CHAQUE succès
                setReport(prevReport => ({
                    ...prevReport,
                    files: [...(prevReport.files || []), newFileInfo]
                }));

                setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', progress: 100 } : q));

            } catch (error) {
                console.error("Échec du téléversement pour", item.name, error);
                setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: error.message || 'Une erreur est survenue' } : q));
            }
        }
    };

    const handleRetryUpload = (item) => {
        if (item.status === 'error') {
            processUploadQueue([item]); // Relance le processus pour cet item spécifique
        }
    };

    const handleRemoveFromQueue = (id) => {
        setUploadQueue(prev => prev.filter(item => item.id !== id));
    };

    const handleSave = () => {
        if (!intervention) return;
        const finalReport = { ...report };
        window.sessionStorage.removeItem(storageKey);
        onSave(intervention.id, finalReport);
    };

    const isUploading = uploadQueue.some(file => file.status === 'uploading');

    if (loading || (!intervention && interventions.length === 0)) return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement de l'intervention...</p></div>;
    if (!intervention) return <div className="card-white"><h2>Intervention non trouvée</h2><p>L'intervention demandée n'existe pas ou a été supprimée.</p><button onClick={() => navigate('/planning')} className="btn btn-primary">Retour au planning</button></div>;
    if (!report) return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement du rapport...</p></div>;

    return (
        <div>
            {showSignatureModal && <SignatureModal onSave={(sig) => { setReport(p => ({...p, signature: sig})); setShowSignatureModal(false); }} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}

            <style>{`
                /* Vos styles existants ici... */
                .upload-queue-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; min-height: 60px; }
                .upload-status-icon { width: 24px; height: 24px; flex-shrink: 0; }
                .upload-status-icon.success { color: #28a745; }
                .upload-status-icon.error { color: #dc3545; }
                .upload-status-icon.loading { color: #007bff; animation: spin 1s linear infinite; }
                .file-info-container { flex-grow: 1; }
                .file-name { font-size: 0.9rem; word-break: break-all; }
                .error-message { font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem; }
                .upload-actions button { background: none; border: none; cursor: pointer; padding: 0.25rem; }
                .upload-actions .icon { width: 20px; height: 20px; }
                .upload-actions .icon-retry { color: #007bff; }
                .upload-actions .icon-remove { color: #6c757d; }
                .upload-progress { width: 100%; height: 4px; background-color: #e5e7eb; border-radius: 2px; overflow: hidden; margin-top: 0.5rem; }
                .upload-progress-bar { height: 100%; background-color: #3b82f6; transition: width 0.3s ease; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <button onClick={() => navigate('/planning')} className="back-button"><ChevronLeftIcon /> Retour au planning</button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                {/* ... autres sections ... */}

                <div className="section">
                    <h3>Photos et Documents du Rapport</h3>
                    <ul className="document-list-detailed">
                        {(report.files || []).map((file, idx) => (
                            <li key={idx}>
                                {file.type.startsWith('image/') ? <img src={file.url} alt={`Aperçu de ${file.name}`} className="document-thumbnail" /> : <FileTextIcon className="document-icon" />}
                                <span>{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Voir</a>
                            </li>
                        ))}
                    </ul>

                    {uploadQueue.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">File d'attente</h4>
                            <ul className="upload-queue-list">
                                {uploadQueue.map((item) => (
                                    <li key={item.id}>
                                        {item.status === 'uploading' && <LoaderIcon className="upload-status-icon loading" />}
                                        {item.status === 'success' && <CheckCircleIcon className="upload-status-icon success" />}
                                        {item.status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}
                                        {item.status === 'pending' && <LoaderIcon className="upload-status-icon" style={{color: '#6c757d'}}/>}

                                        <div className="file-info-container">
                                            <span className="file-name">{item.name}</span>
                                            {item.status === 'uploading' && <div className="upload-progress"><div className="upload-progress-bar" style={{width: `${item.progress}%`}}></div></div>}
                                            {item.error && <span className="error-message">{item.error}</span>}
                                        </div>

                                        <div className="upload-actions">
                                            {item.status === 'error' && (
                                                <button onClick={() => handleRetryUpload(item)} title="Réessayer">
                                                    <RefreshCwIcon className="icon icon-retry" />
                                                </button>
                                            )}
                                            {item.status !== 'uploading' && (
                                                 <button onClick={() => handleRemoveFromQueue(item.id)} title="Retirer">
                                                    <XCircleIcon className="icon icon-remove" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!isAdmin && (
                        <CustomFileInput accept="image/*,application/pdf" onChange={handleFileSelect} disabled={isUploading} multiple className="mt-4">
                            {isUploading ? 'Envoi en cours...' : 'Ajouter des fichiers (Photo/PDF)'}
                        </CustomFileInput>
                    )}
                </div>

                {/* ... section signature ... */}
                <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? (
                        <img src={report.signature} alt="Signature client" style={{border: '1px solid #ccc', borderRadius: '0.375rem', maxWidth: '100%'}} />
                    ) : (
                        <div className="signature-container">
                            <canvas ref={signatureCanvasRef} className="signature-canvas" width="300" height="150"></canvas>
                            <div className="signature-actions">
                                <button onClick={() => { if (signatureCanvasRef.current) { const ctx = signatureCanvasRef.current.getContext('2d'); ctx.clearRect(0,0,300,150); setReport(p => ({...p, signature: null})); } }} className="text-muted-link">Effacer</button>
                                <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary btn-sm"><ExpandIcon /> Agrandir</button>
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
