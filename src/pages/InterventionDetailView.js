import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon } from '../components/SharedUI';

// Le composant SignatureModal reste inchangé, il est bien conçu.
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const modalCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    useEffect(() => {
        const canvas = modalCanvasRef.current; if (!canvas) return;
        const isMobile = window.innerWidth < 768;
        canvas.width = isMobile ? window.innerWidth * 0.95 : window.innerWidth * 0.9;
        canvas.height = isMobile ? window.innerHeight * 0.6 : window.innerHeight * 0.7;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000'; ctx.lineWidth = isMobile ? 4 : 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (existingSignature) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = existingSignature; }
        let drawing = false; let lastPos = null;
        const getPos = (e) => { const rect = canvas.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }; };
        const startDrawing = (e) => { e.preventDefault(); drawing = true; setIsDrawing(true); lastPos = getPos(e); ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); };
        const stopDrawing = (e) => { e.preventDefault(); drawing = false; lastPos = null; };
        const draw = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); if (lastPos) { ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); } lastPos = pos; };
        canvas.addEventListener('mousedown', startDrawing); canvas.addEventListener('mouseup', stopDrawing); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false }); canvas.addEventListener('touchend', stopDrawing, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false });
        return () => { canvas.removeEventListener('mousedown', startDrawing); canvas.removeEventListener('mouseup', stopDrawing); canvas.removeEventListener('mousemove', draw); canvas.removeEventListener('mouseleave', stopDrawing); canvas.removeEventListener('touchstart', startDrawing); canvas.removeEventListener('touchend', stopDrawing); canvas.removeEventListener('touchmove', draw); };
    }, [existingSignature]);
    const handleSaveSignature = () => { if (modalCanvasRef.current) { onSave(modalCanvasRef.current.toDataURL('image/png')); } };
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

export default function InterventionDetailView({ interventions, onSave, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const signatureCanvasRef = useRef(null);
    const [uploadQueue, setUploadQueue] = useState([]);
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    const fileInputRef = useRef(null);

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
                try { setReport(JSON.parse(savedReport)); } catch (e) { setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null }); }
            } else {
                setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null });
            }
        }
    }, [intervention, storageKey]);

    useEffect(() => {
        if (report) {
            try { window.sessionStorage.setItem(storageKey, JSON.stringify(report)); } catch (error) { console.error("Failed to save report to sessionStorage", error); }
        }
    }, [report, storageKey]);

    useEffect(() => {
        const canvas = signatureCanvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        if (report && report.signature) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); }; img.src = report.signature; }
        else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }, [report, report?.signature]);

    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));

    const handleFileSelect = (event) => {
        const filesToUpload = Array.from(event.target.files);
        if (filesToUpload.length === 0 || !intervention) return;

        const maxFileSize = 10 * 1024 * 1024;
        const newQueueItems = filesToUpload
            .filter(file => file.size <= maxFileSize)
            .map(file => ({
                id: `${file.name}-${file.lastModified}-${file.size}`,
                name: file.name,
                status: 'pending',
                error: null,
                fileObject: file,
            }));

        if (newQueueItems.length > 0) {
            setUploadQueue(prev => [...prev, ...newQueueItems]);
            processUploadQueue(newQueueItems);
        }
    };

    const processUploadQueue = async (itemsToProcess) => {
        for (const item of itemsToProcess) {
            setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));
            try {
                const result = await storageService.uploadInterventionFile(item.fileObject, intervention.id);
                if (result.error) throw result.error;
                const newFileInfo = { name: item.name, url: result.publicURL, type: item.fileObject.type };
                setReport(prevReport => ({
                    ...prevReport,
                    files: [...(prevReport.files || []), newFileInfo]
                }));
                setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
            } catch (error) {
                console.error("Échec du téléversement pour", item.name, error);
                setUploadQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: error.message || 'Une erreur est survenue' } : q));
            }
        }
    };

    const handleRetryUpload = (item) => {
        if (item.status === 'error') {
            processUploadQueue([item]);
        }
    };

    const handleRemoveFromQueue = (idToRemove) => {
        setUploadQueue(prev => prev.filter(item => item.id !== idToRemove));
    };

    const handleSave = () => {
        if (!intervention) return;
        const finalReport = { ...report };
        window.sessionStorage.removeItem(storageKey);
        onSave(intervention.id, finalReport);
    };

    const handleGoBack = () => navigate('/planning');
    const handleClearSignature = () => { if (signatureCanvasRef.current) { const canvas = signatureCanvasRef.current; const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); setReport(prev => ({...prev, signature: null})); } };
    const handleSaveSignatureFromModal = (signatureDataUrl) => { setReport(prev => ({...prev, signature: signatureDataUrl})); setShowSignatureModal(false); };
    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR') : 'N/A';
    const isUploading = uploadQueue.some(file => file.status === 'uploading');

    if (loading || (!intervention && interventions.length === 0)) return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>;
    if (!intervention) return <div className="card-white"><h2>Intervention non trouvée</h2><button onClick={() => navigate('/planning')} className="btn btn-primary">Retour au planning</button></div>;
    if (!report) return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement du rapport...</p></div>;

    return (
        <div>
            {showSignatureModal && <SignatureModal onSave={handleSaveSignatureFromModal} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}
            <style>{`
                .document-list-detailed, .upload-queue-list, .document-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
                .document-list-detailed li, .upload-queue-list li, .document-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; min-height: 60px; }
                .document-list li span { flex-grow: 1; }
                .document-thumbnail { width: 40px; height: 40px; object-fit: cover; border-radius: 0.25rem; background-color: #e9ecef; }
                .upload-status-icon { width: 24px; height: 24px; flex-shrink: 0; }
                .upload-status-icon.success { color: #28a745; } .upload-status-icon.error { color: #dc3545; }
                .upload-status-icon.loading { color: #007bff; animation: spin 1s linear infinite; }
                .file-info-container { flex-grow: 1; } .file-name { font-size: 0.9rem; word-break: break-all; }
                .error-message { font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem; }
                .upload-actions { display: flex; gap: 0.5rem; }
                .upload-actions button { background: none; border: none; cursor: pointer; padding: 0.25rem; }
                .upload-actions .icon { width: 20px; height: 20px; } .icon-retry { color: #007bff; } .icon-remove { color: #6c757d; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
            <button onClick={handleGoBack} className="back-button"><ChevronLeftIcon /> Retour</button>
            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                {/* ✅ AFFICHAGE RESTAURÉ */}
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
                                {file.type.startsWith('image/') ? <img src={file.url} alt={`Aperçu de ${file.name}`} className="document-thumbnail" /> : <FileTextIcon className="document-icon" />}
                                <span>{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Voir</a>
                            </li>
                        ))}
                    </ul>
                    {uploadQueue.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">Téléchargements</h4>
                            <ul className="upload-queue-list">
                                {uploadQueue.map((item) => (
                                    <li key={item.id}>
                                        {item.status === 'uploading' && <LoaderIcon className="upload-status-icon loading" />}
                                        {item.status === 'success' && <CheckCircleIcon className="upload-status-icon success" />}
                                        {item.status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}
                                        <div className="file-info-container">
                                            <span className="file-name">{item.name}</span>
                                            {item.error && <span className="error-message">{item.error}</span>}
                                        </div>
                                        <div className="upload-actions">
                                            {item.status === 'error' && <button onClick={() => handleRetryUpload(item)} title="Réessayer"><RefreshCwIcon className="icon icon-retry" /></button>}
                                            {item.status !== 'uploading' && <button onClick={() => handleRemoveFromQueue(item.id)} title="Retirer"><XCircleIcon className="icon icon-remove" /></button>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!isAdmin && (
                        <div className="mt-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                multiple
                                accept="image/*,application/pdf"
                                style={{ display: 'none' }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="btn btn-secondary w-full flex items-center justify-center gap-2"
                                style={{minHeight: '56px'}}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                {isUploading ? 'Envoi en cours...' : 'Ajouter des fichiers (Photo/PDF)'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? <img src={report.signature} alt="Signature client" style={{border: '1px solid #ccc', borderRadius: '0.375rem', maxWidth: '100%'}} /> : (
                        <div className="signature-container">
                            <canvas ref={signatureCanvasRef} className="signature-canvas" width="300" height="150"></canvas>
                            <div className="signature-actions">
                                <button onClick={handleClearSignature} className="text-muted-link">Effacer</button>
                                <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary btn-sm"><ExpandIcon /> Agrandir</button>
                            </div>
                        </div>
                    )}
                </div>
                {!isAdmin && <button onClick={handleSave} disabled={isUploading} className="btn btn-primary w-full mt-4">{isUploading ? 'Attendre la fin des envois' : 'Sauvegarder et Clôturer'}</button>}
            </div>
        </div>
    );
}
