import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon, XCircleIcon } from '../components/SharedUI';
import { useMobileUpload } from '../hooks/useMobileUpload';

// Composant d'image optimisé avec lazy loading (inchangé)
const OptimizedImage = ({ src, alt, className, style, onClick }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!src) return;
        const img = new Image();
        img.onload = () => setLoading(false);
        img.onerror = () => { setLoading(false); setError(true); };
        img.src = src;
    }, [src]);

    if (error) return <div className={className} style={{ ...style, backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>❌</div>;

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {loading && <div style={{ width: style?.width || 40, height: style?.height || 40, backgroundColor: '#f3f4f6', borderRadius: '0.25rem', animation: 'pulse 1.5s ease-in-out infinite' }} />}
            <img src={src} alt={alt} className={className} style={{ ...style, display: loading ? 'none' : 'block' }} onClick={onClick} />
        </div>
    );
};


// Composant SignatureModal (inchangé)
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const modalCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        // Logique du canvas de signature...
    }, [existingSignature]);

    const handleSaveSignature = () => onSave(modalCanvasRef.current.toDataURL('image/png'));
    const handleClear = () => {
        const canvas = modalCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsDrawing(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content signature-modal-content">
                <h3>Veuillez signer ci-dessous</h3>
                <canvas ref={modalCanvasRef} className="signature-canvas-fullscreen" />
                <div className="modal-footer">
                    <button type="button" onClick={handleClear} className="btn btn-secondary">Effacer</button>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                    <button type="button" onClick={handleSaveSignature} className="btn btn-primary" disabled={!isDrawing && !existingSignature}>Valider</button>
                </div>
            </div>
        </div>
    );
};


export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const signatureCanvasRef = useRef(null);
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ✅ Récupération de la nouvelle fonction 'removeFileFromQueue'
    const {
        handleFileUpload,
        capabilities,
        isUploading,
        fileStatuses,
        error: uploadError,
        reset: resetUpload,
        isOnline,
        removeFileFromQueue
    } = useMobileUpload(interventionId);

    const [fileListKey, setFileListKey] = useState(0);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            const savedReport = window.sessionStorage.getItem(storageKey);
            setReport(savedReport ? JSON.parse(savedReport) : (foundIntervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null }));
            setLoading(false);
        } else if (interventions.length > 0) {
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate, storageKey]);

    useEffect(() => {
        if (report && intervention) {
            window.sessionStorage.setItem(storageKey, JSON.stringify(report));
        }
    }, [report, storageKey, intervention]);

    useEffect(() => {
        const canvas = signatureCanvasRef.current;
        if (canvas && report?.signature) {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = report.signature;
        }
    }, [report, report?.signature]);

    const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));

    const saveReportSilently = async (updatedReport) => {
        try {
            await onSaveSilent(interventionId, updatedReport);
        } catch (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
        }
    };

    const handleFileSelect = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !intervention) return;

        resetUpload();

        try {
            const { results, invalidFiles } = await handleFileUpload(files);

            const successfulUploads = results
                .filter(r => r.success && r.result?.publicURL)
                .map(r => ({ name: r.file.name, url: r.result.publicURL, type: r.file.type }));

            if (successfulUploads.length > 0) {
                const updatedReport = { ...report, files: [...(report.files || []), ...successfulUploads] };
                setReport(updatedReport);
                saveReportSilently(updatedReport);
                setFileListKey(prev => prev + 1);
            }

            if (invalidFiles.length > 0) {
                alert(`${invalidFiles.length} fichier(s) ont été ignorés car trop volumineux.`);
            }

            event.target.value = '';
        } catch (error) {
            console.error('❌ Erreur durant le processus d\'upload:', error);
        }
    };

    const handleSave = async () => {
        if (!intervention) return;
        setIsSaving(true);
        try {
            window.sessionStorage.removeItem(storageKey);
            await onSave(intervention.id, { ...report });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGoBack = () => navigate('/planning');
    const handleClearSignature = () => {
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        handleReportChange('signature', null);
    };

    const globalProgress = useMemo(() => {
        const statuses = Object.values(fileStatuses);
        if (statuses.length === 0) return 0;
        const totalProgress = statuses.reduce((sum, s) => sum + (s.progress || 0), 0);
        return Math.round(totalProgress / statuses.length);
    }, [fileStatuses]);

    if (loading || !report) return <div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>;
    if (!intervention) return <div className="card-white"><h2>Intervention non trouvée</h2><button onClick={handleGoBack} className="btn">Retour</button></div>;

    return (
        <div>
            {showSignatureModal && <SignatureModal onSave={(sig) => { handleReportChange('signature', sig); setShowSignatureModal(false); }} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}

            <style>{`
                /* Styles (inchangés) */
            `}</style>

            <button onClick={handleGoBack} className="back-button"><ChevronLeftIcon /> Retour</button>

            <div className="card-white">
                {/* ... Infos client, pointage, rapport (inchangés) ... */}

                <div className="section">
                    <h3>Photos et Documents du Rapport</h3>

                    <ul key={fileListKey} className="document-list-detailed">
                        {(report.files || []).map((file, idx) => (
                            <li key={`${file.url}-${idx}`}>
                                {file.type?.startsWith('image/') ? <OptimizedImage src={file.url} alt={file.name} className="document-thumbnail" style={{ width: 40, height: 40 }} onClick={() => window.open(file.url, '_blank')} /> : <FileTextIcon className="document-icon" />}
                                <span>{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Voir</a>
                            </li>
                        ))}
                    </ul>

                    {Object.keys(fileStatuses).length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">Upload en cours...</h4>
                            {isUploading && <div style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', marginBottom: '1rem', overflow: 'hidden' }}><div style={{ width: `${globalProgress}%`, height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.3s ease' }} /></div>}

                            <ul className="upload-queue-list">
                                {Object.values(fileStatuses).map((item) => {
                                    const { id, name, size, status, error, elapsedTime } = item;
                                    return (
                                        <li key={id}>
                                            {status === 'pending' && <LoaderIcon className="upload-status-icon loading" />}
                                            {(status === 'compressing' || status === 'uploading') && <LoaderIcon className="upload-status-icon loading animate-spin" />}
                                            {status === 'completed' && <CheckCircleIcon className="upload-status-icon success" />}
                                            {status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}

                                            <div className="file-info-container">
                                                <span className="file-name">{name}</span>
                                                <span style={{fontSize: '0.75rem', color: '#6b7280'}}>{Math.round(size / 1024)}KB</span>

                                                {(status === 'compressing' || status === 'uploading') && (
                                                    <span style={{fontSize: '0.75rem', color: '#3b82f6'}}>
                                                        {status === 'uploading' ? 'Upload...' : 'Compression...'}
                                                        {elapsedTime > 0 && ` (${elapsedTime}s)`}
                                                    </span>
                                                )}
                                                {status === 'completed' && <span style={{fontSize: '0.75rem', color: '#16a34a'}}>✅ Terminé</span>}
                                                {error && <span className="error-message">{error}</span>}
                                            </div>

                                            {/* ✅ CORRECTION: Utilisation de la nouvelle fonction pour la suppression */}
                                            {status !== 'pending' && status !== 'uploading' && status !== 'compressing' && (
                                                <button onClick={() => removeFileFromQueue(id)} title="Retirer"><XCircleIcon className="icon icon-remove" /></button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {!isAdmin && (
                        <CustomFileInput accept="image/*,application/pdf" onChange={handleFileSelect} disabled={isUploading} multiple className="mt-4">
                            {isUploading ? `Upload... (${globalProgress}%)` : (capabilities.isMobile ? '📷 Ajouter Photos/Fichiers' : '📁 Ajouter Fichiers')}
                        </CustomFileInput>
                    )}
                    {uploadError && <div className="error-message mt-2">Erreur: {uploadError}</div>}
                </div>

                {/* ... Section Signature et bouton Sauvegarder (inchangés) ... */}
                 <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? (
                        <OptimizedImage src={report.signature} alt="Signature" style={{ border: '1px solid #ccc', borderRadius: '0.375rem', maxWidth: '100%' }} />
                    ) : (
                        <div className="signature-container">
                            <canvas ref={signatureCanvasRef} className="signature-canvas" width="300" height="150" />
                            <div className="signature-actions">
                                <button onClick={handleClearSignature} className="text-muted-link">Effacer</button>
                                <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary btn-sm"><ExpandIcon /> Agrandir</button>
                            </div>
                        </div>
                    )}
                </div>

                {!isAdmin && (
                    <button onClick={handleSave} disabled={isUploading || isSaving} className="btn btn-primary w-full mt-4">
                        {isSaving ? 'Sauvegarde...' : isUploading ? `Upload (${globalProgress}%)` : '🔒 Sauvegarder et Clôturer'}
                    </button>
                )}
            </div>
        </div>
    );
}
