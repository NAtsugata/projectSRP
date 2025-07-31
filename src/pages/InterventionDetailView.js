import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon } from '../components/SharedUI';

export default function InterventionDetailView({ interventions, onSave, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const signatureCanvasRef = useRef(null);
    const [uploadQueue, setUploadQueue] = useState([]);
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(null);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
        }
    }, [interventions, interventionId]);

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
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            let drawing = false;
            const getPos = (e) => {
                const rect = canvas.getBoundingClientRect();
                return { x: (e.clientX || e.touches[0].clientX) - rect.left, y: (e.clientY || e.touches[0].clientY) - rect.top };
            };
            const startDrawing = (e) => { e.preventDefault(); drawing = true; draw(e); };
            const stopDrawing = (e) => { e.preventDefault(); drawing = false; ctx.beginPath(); };
            const draw = (e) => {
                if (!drawing) return;
                e.preventDefault();
                const pos = getPos(e);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
            };
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('touchstart', startDrawing, { passive: false });
            canvas.addEventListener('touchend', stopDrawing, { passive: false });
            canvas.addEventListener('touchmove', draw, { passive: false });
            return () => {
                canvas.removeEventListener('mousedown', startDrawing);
                canvas.removeEventListener('mouseup', stopDrawing);
                canvas.removeEventListener('mousemove', draw);
                canvas.removeEventListener('touchstart', startDrawing);
                canvas.removeEventListener('touchend', stopDrawing);
                canvas.removeEventListener('touchmove', draw);
            };
        }
    }, [report]); // On relance l'effet si le rapport est chargé

    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));

    const handleFileUpload = async (e) => {
        e.preventDefault();
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0 || !intervention) return;

        const initialQueue = selectedFiles.map(file => ({ name: file.name, status: 'uploading', error: null }));
        setUploadQueue(initialQueue);

        const uploadPromises = selectedFiles.map(file => storageService.uploadInterventionFile(file, intervention.id));
        const results = await Promise.allSettled(uploadPromises);

        const newFiles = [];
        const finalQueue = [...initialQueue];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && !result.value.error) {
                const fileInfo = { name: selectedFiles[index].name, url: result.value.publicURL, type: selectedFiles[index].type };
                newFiles.push(fileInfo);
                finalQueue[index].status = 'success';
            } else {
                finalQueue[index].status = 'error';
                finalQueue[index].error = result.reason?.message || result.value.error?.message || 'Erreur inconnue';
            }
        });

        setUploadQueue(finalQueue);
        if (newFiles.length > 0) {
            handleReportChange('files', [...(report.files || []), ...newFiles]);
        }
        setTimeout(() => setUploadQueue([]), 5000);
    };

    const handleSave = () => {
        if (!intervention) return;
        const finalReport = { ...report };
        if (signatureCanvasRef.current && signatureCanvasRef.current.toDataURL) {
            const dataUrl = signatureCanvasRef.current.toDataURL('image/png');
            if (!dataUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg')) {
                 finalReport.signature = dataUrl;
            }
        }
        window.sessionStorage.removeItem(storageKey);
        onSave(intervention.id, finalReport);
    };

    const cleanupAndGoBack = () => {
        window.sessionStorage.removeItem(storageKey);
        navigate('/planning');
    };

    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR') : 'N/A';

    const isUploading = uploadQueue.some(file => file.status === 'uploading');

    if (!intervention || !report) {
        return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement de l'intervention...</p></div>;
    }

    return (
        <div>
            <style>{`
                .document-list-detailed, .upload-queue-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
                .document-list-detailed li, .upload-queue-list li { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; }
                .document-thumbnail { width: 40px; height: 40px; object-fit: cover; border-radius: 0.25rem; background-color: #e9ecef; }
                .document-icon, .upload-status-icon { width: 24px; height: 24px; flex-shrink: 0; }
                .upload-status-icon.success { color: #28a745; }
                .upload-status-icon.error { color: #dc3545; }
                .document-list-detailed li span, .upload-queue-list li .file-name { flex-grow: 1; font-size: 0.9rem; word-break: break-all; }
                .upload-queue-list li .error-message { font-size: 0.8rem; color: #dc3545; }
                .document-list-detailed li .btn { flex-shrink: 0; }
            `}</style>

            <button onClick={cleanupAndGoBack} className="back-button"><ChevronLeftIcon /> Retour au planning</button>
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
                                        {file.status === 'uploading' && <LoaderIcon className="upload-status-icon animate-spin" />}
                                        {file.status === 'success' && <CheckCircleIcon className="upload-status-icon success" />}
                                        {file.status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}
                                        <div className="flex flex-col">
                                            <span className="file-name">{file.name}</span>
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
                        <img src={report.signature} alt="Signature client" style={{border: '1px solid #ccc', borderRadius: '0.375rem'}} />
                    ) : (
                        <>
                            <canvas ref={signatureCanvasRef} className="signature-canvas"></canvas>
                            {!isAdmin && <button onClick={() => signatureCanvasRef.current.getContext('2d').clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height)} className="text-muted-link">Effacer</button>}
                        </>
                    )}
                </div>

                {!isAdmin && <button onClick={handleSave} disabled={isUploading} className="btn btn-primary w-full mt-4">
                    {isUploading ? 'Veuillez attendre la fin des envois' : 'Sauvegarder et Clôturer le rapport'}
                </button>}
            </div>
        </div>
    );
}
