import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon } from '../components/SharedUI';

export default function InterventionDetailView({ interventions, onSave, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
        }
    }, [interventions, interventionId]);
    
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(() => {
        try {
            const savedReport = window.sessionStorage.getItem(storageKey);
            return savedReport ? JSON.parse(savedReport) : (intervention?.report || { notes: '', images: [], arrivalTime: null, departureTime: null, signature: null });
        } catch (error) {
            return intervention?.report || { notes: '', images: [], arrivalTime: null, departureTime: null, signature: null };
        }
    });

    const [isUploading, setIsUploading] = useState(false);
    const signatureCanvasRef = useRef(null);

    useEffect(() => {
        if (intervention) {
            setReport(intervention.report || { notes: '', images: [], arrivalTime: null, departureTime: null, signature: null });
        }
    }, [intervention]);

    useEffect(() => {
        try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(report));
        } catch (error) {
            console.error("Failed to save report to sessionStorage", error);
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
    }, []);

    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));
    const handleImageUpload = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.target.files[0];
        if (!file || !intervention) return;
        setIsUploading(true);
        try {
            const { publicURL, error } = await storageService.uploadInterventionFile(file, intervention.id);
            if (error) console.error("Erreur d'upload:", error);
            else handleReportChange('images', [...(report.images || []), publicURL]);
        } catch (error) {
            console.error("Erreur d'upload:", error);
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
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

    if (!intervention) {
        return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement de l'intervention...</p></div>;
    }

    return (
        <div>
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
                    <h3>Photos</h3>
                    <div className="image-grid">
                        {(report.images || []).map((img, idx) => (
                            <div key={idx}>
                                <img src={img} alt={'report-' + idx} />
                                {isAdmin && <a href={img} download={'intervention-' + intervention.id + '-photo-' + (idx+1) + '.png'} className="btn btn-primary mt-2 w-full"><DownloadIcon/> Télécharger</a>}
                            </div>
                        ))}
                    </div>
                    {!isAdmin && (
                        <CustomFileInput
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={isUploading}
                            className="mt-2"
                        >
                            {isUploading ? 'Téléchargement...' : 'Ajouter une photo'}
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
                {!isAdmin && <button onClick={handleSave} className="btn btn-primary w-full mt-4">Sauvegarder et Clôturer le rapport</button>}
            </div>
        </div>
    );
}