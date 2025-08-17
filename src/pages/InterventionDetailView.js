import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon } from '../components/SharedUI';

// ... (Les composants OptimizedImage et SignatureModal ne changent pas et peuvent être gardés ici)
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

        if ('IntersectionObserver' in window && imgRef.current) {
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        img.src = src;
                        observer.disconnect();
                    }
                },
                { rootMargin: '50px' }
            );
            observer.observe(imgRef.current);
            return () => observer.disconnect();
        } else {
            img.src = src;
        }
    }, [src]);

    if (loadState === 'loading') {
        return (
            <div ref={imgRef} className={className} style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f3f4f6'
            }}>
                <LoaderIcon className="animate-spin" />
            </div>
        );
    }

    if (loadState === 'error') {
        return (
            <div className={className} style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fee2e2',
                color: '#dc2626'
            }}>
                <XCircleIcon />
            </div>
        );
    }

    return (
        <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={className}
            style={{...style, display: 'block'}}
            onClick={onClick}
            loading="lazy"
        />
    );
};
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const isMobile = window.innerWidth < 768;
        canvas.width = Math.min(window.innerWidth * 0.9, 600);
        canvas.height = isMobile ? window.innerHeight * 0.5 : 300;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

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

        const startDrawing = (e) => {
            e.preventDefault();
            drawing = true;
            setIsDrawing(true);
            setHasDrawn(true);
            lastPos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
        };

        const stopDrawing = (e) => {
            e.preventDefault();
            drawing = false;
            setIsDrawing(false);
            lastPos = null;
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();
            const pos = getPos(e);
            if(lastPos) {
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
            lastPos = pos;
        };

        // Event listeners
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

    const handleSave = () => {
        if (canvasRef.current) {
            onSave(canvasRef.current.toDataURL('image/png'));
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content signature-modal-content">
                <h3>✍️ Signature du client</h3>
                <p style={{fontSize: '0.875rem', color: '#6c757d', marginBottom: '1rem'}}>
                    Veuillez faire signer le client ci-dessous
                </p>
                <canvas ref={canvasRef} className="signature-canvas-fullscreen" />
                <div className="modal-footer" style={{marginTop: '1rem'}}>
                    <button type="button" onClick={handleClear} className="btn btn-secondary">
                        Effacer
                    </button>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">
                        Annuler
                    </button>
                    <button type="button" onClick={handleSave} className="btn btn-primary" disabled={!hasDrawn}>
                        Valider la signature
                    </button>
                </div>
            </div>
        </div>
    );
};


export default function InterventionDetailView({ interventions, onSave, isAdmin, dataVersion, refreshData }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const signatureCanvasRef = useRef(null);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            setReport(foundIntervention.report || {
                notes: '', files: [], arrivalTime: null, departureTime: null, signature: null
            });
            setLoading(false);
        } else if (interventions.length > 0) {
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate, dataVersion]);

    const handleReportChange = (field, value) => {
        setReport(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!intervention) return;
        setIsSaving(true);
        try {
            await onSave(intervention.id, report);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearSignature = () => {
        handleReportChange('signature', null);
    };

    const handleSaveSignatureFromModal = (signatureDataUrl) => {
        handleReportChange('signature', signatureDataUrl);
        setShowSignatureModal(false);
    };

    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    if (loading || !intervention || !report) {
        return <div className="loading-container"><LoaderIcon className="animate-spin" /><p>Chargement...</p></div>;
    }

    return (
        <div>
            {showSignatureModal && <SignatureModal onSave={handleSaveSignatureFromModal} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}
            <button onClick={() => navigate('/planning')} className="back-button"><ChevronLeftIcon /> Retour</button>
            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.address}</p>
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
                    <textarea value={report.notes || ''} onChange={e => handleReportChange('notes', e.target.value)} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={isAdmin} />
                </div>
                <div className="section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3>📷 Photos et Documents</h3>
                        <button onClick={refreshData} className="btn-icon" title="Rafraîchir"><RefreshCwIcon /></button>
                    </div>
                    {report.files && report.files.length > 0 ? (
                        <ul className="document-list-optimized" style={{marginBottom: '1rem'}}>
                            {report.files.map((file, idx) => (
                                <li key={`${file.url}-${idx}`} className="document-item-optimized">
                                    {/* ✅ CORRECTION : Affiche une icône si ce n'est pas une image */}
                                    {file.type && file.type.startsWith('image/') ? (
                                        <OptimizedImage src={file.url} alt={file.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '0.25rem' }} />
                                    ) : (
                                        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e9ecef', borderRadius: '0.25rem' }}>
                                            <FileTextIcon />
                                        </div>
                                    )}
                                    <span className="file-name">{file.name}</span>
                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary"><DownloadIcon /></a>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-muted">Aucun fichier pour le moment.</p>}
                    {!isAdmin && (
                        <button onClick={() => navigate(`/planning/${interventionId}/upload`)} className="btn btn-primary w-full">
                            📷 Ajouter photos/documents
                        </button>
                    )}
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
                            <canvas ref={signatureCanvasRef} width="300" height="150" style={{ border: '2px dashed #cbd5e1', borderRadius: '0.5rem', width: '100%', maxWidth: '300px', backgroundColor: '#f8fafc', cursor: isAdmin ? 'not-allowed' : 'crosshair' }} />
                            {!isAdmin && <div style={{marginTop: '0.5rem'}}><button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon /> Agrandir</button></div>}
                        </div>
                    )}
                </div>
                {!isAdmin && (
                    <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{ fontSize: '1rem', padding: '1rem', fontWeight: 600 }}>
                        {isSaving ? <><LoaderIcon className="animate-spin" /> Sauvegarde...</> : '🔒 Sauvegarder et Clôturer'}
                    </button>
                )}
            </div>
        </div>
    );
}
