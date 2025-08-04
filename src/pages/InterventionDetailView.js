// src/pages/InterventionDetailView.js - VERSION FINALE BASÉE SUR L'ÉTUDE DE ROBUSTESSE MOBILE
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

// =================================================================================
// MOCK DES COMPOSANTS UI (à remplacer par vos vrais composants)
// =================================================================================
const Icon = ({ name, className = '',...props }) => <span className={className} style={{ marginRight: '8px' }} {...props}>{name}</span>;
const ChevronLeftIcon = () => <Icon name="⬅️" />;
const DownloadIcon = () => <Icon name="⬇️" />;
const FileTextIcon = (props) => <Icon name="📄" {...props} />;
const CheckCircleIcon = (props) => <Icon name="✅" {...props} />;
const AlertTriangleIcon = (props) => <Icon name="⚠️" {...props} />;
const LoaderIcon = (props) => <Icon name="🔄" {...props} />;
const ExpandIcon = () => <Icon name="↔️" />;
const RefreshCwIcon = () => <Icon name="🔄" />;
const XCircleIcon = (props) => <Icon name="❌" {...props} />;
const CameraIcon = () => <Icon name="📷" />;
const LibraryIcon = () => <Icon name="🖼️" />;


// =================================================================================
// COMPOSANT D'IMAGE OPTIMISÉ POUR MOBILE (avec Lazy Loading)
// =================================================================================
const OptimizedImage = ({ src, alt, className, style, onClick }) => {
    const = useState('loading');
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
                    if (entries.isIntersecting) {
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
        return <div ref={imgRef} className={className} style={{...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}><LoaderIcon className="spinning" /></div>;
    }
    if (loadState === 'error') {
        return <div className={className} style={{...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fee2e2' }}><XCircleIcon /></div>;
    }
    return <img ref={imgRef} src={src} alt={alt} className={className} style={{...style, display: 'block' }} onClick={onClick} loading="lazy" />;
};

// =================================================================================
// MODALE DE SIGNATURE (Plein écran sur mobile)
// =================================================================================
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const canvasRef = useRef(null);
    const = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const isMobile = window.innerWidth < 768;
        canvas.width = window.innerWidth * 0.95;
        canvas.height = window.innerHeight * 0.7;

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (existingSignature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = existingSignature;
        }

        let drawing = false;
        let lastPos = null;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches? e.touches.clientX : e.clientX;
            const clientY = e.touches? e.touches.clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDrawing = (e) => { e.preventDefault(); drawing = true; setIsDrawing(true); lastPos = getPos(e); ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); };
        const stopDrawing = (e) => { e.preventDefault(); drawing = false; lastPos = null; };
        const draw = (e) => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); if (lastPos) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); } lastPos = pos; };

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
    },);

    const handleSave = () => onSave(canvasRef.current.toDataURL('image/png'));
    const handleClear = () => { const ctx = canvasRef.current.getContext('2d'); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setIsDrawing(false); };

    return (
        <div className="modal-overlay">
            <div className="modal-content signature-modal-content">
                <h3>Veuillez signer ci-dessous</h3>
                <canvas ref={canvasRef} className="signature-canvas-fullscreen" />
                <div className="modal-footer">
                    <button type="button" onClick={handleClear} className="btn btn-secondary">Effacer</button>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
                    <button type="button" onClick={handleSave} className="btn btn-primary" disabled={!isDrawing &&!existingSignature}>Valider</button>
                </div>
            </div>
        </div>
    );
};


// =================================================================================
// COMPOSANT PRINCIPAL DE LA VUE DÉTAILLÉE
// =================================================================================
export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const = useState(null);
    const = useState(false);
    const = useState(false);
    const = useState({ isUploading: false, queue:, globalProgress: 0, error: null });
    const [fileListKey, setFileListKey] = useState(Date.now());
    const signatureCanvasRef = useRef(null);
    const storageKey = `srp-intervention-report-${interventionId}`;

    const cameraInputRef = useRef(null);
    const libraryInputRef = useRef(null);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            const savedReport = window.sessionStorage.getItem(storageKey);
            const initialReport = savedReport? JSON.parse(savedReport) : (foundIntervention.report |

| { notes: '', files:, arrivalTime: null, departureTime: null, signature: null });
            setReport(initialReport);
            setLoading(false);
        } else if (interventions.length > 0) {
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate, storageKey]);

    useEffect(() => {
        if (report && intervention) {
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(report));
            } catch (error) {
                console.warn("Impossible de sauvegarder le rapport en session :", error);
            }
        }
    }, [report, storageKey, intervention]);

    useEffect(() => {
        const canvas = signatureCanvasRef.current;
        if (!canvas ||!report) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (report.signature) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            img.src = report.signature;
        }
    }, [report, report?.signature]);

    const handleReportChange = (field, value) => setReport(prev => ({...prev, [field]: value }));

    const saveReportSilently = useCallback(async (updatedReport) => {
        try {
            await onSaveSilent(interventionId, updatedReport);
        } catch (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
        }
    },);

    const processAndUploadFiles = useCallback(async (files) => {
        if (!files.length ||!intervention) return;

        console.log(`[processAndUploadFiles] Démarrage du traitement pour ${files.length} fichier(s).`);

        const queueItems = files.map((file, index) => ({
            id: `${file.name}-${Date.now()}-${index}`,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            error: null
        }));

        setUploadState({ isUploading: true, queue: queueItems, globalProgress: 0, error: null });

        const updateQueueItem = (fileId, updates) => {
            setUploadState(prev => {
                const newQueue = prev.queue.map(item =>
                    item.id === fileId? {...item,...updates } : item
                );
                const totalProgress = newQueue.reduce((sum, item) => sum + (item.progress |

| 0), 0);
                const globalProgress = newQueue.length > 0? Math.round(totalProgress / newQueue.length) : 0;
                return {...prev, queue: newQueue, globalProgress };
            });
        };

        const successfulUploads =;
        for (const [index, file] of files.entries()) {
            const fileId = queueItems[index].id;

            try {
                let fileToProcess = file;

                const isHeic = /\.(heic|heif)$/i.test(file.name) |

| file.type === 'image/heic' |
| file.type === 'image/heif';
                if (isHeic) {
                    updateQueueItem(fileId, { status: 'converting', progress: 2 });
                    const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
                    const finalBlob = Array.isArray(convertedBlob)? convertedBlob : convertedBlob;
                    fileToProcess = new File(, file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
                }

                if (fileToProcess.type.startsWith('image/')) {
                    updateQueueItem(fileId, { status: 'compressing', progress: 5 });
                    fileToProcess = await imageCompression(fileToProcess, {
                        maxSizeMB: 1.5,
                        maxWidthOrHeight: 1920,
                        useWebWorker: true,
                    });
                }

                const onProgress = (percent) => {
                    const uploadProgress = 10 + Math.round(percent * 0.85);
                    updateQueueItem(fileId, { status: 'uploading', progress: uploadProgress });
                };

                const result = await storageService.uploadInterventionFile(fileToProcess, interventionId, 'report', onProgress);

                if (result.error) throw result.error;

                const newFileInfo = { name: file.name, url: result.publicURL, type: fileToProcess.type };
                successfulUploads.push(newFileInfo);

                updateQueueItem(fileId, { status: 'completed', progress: 100 });

            } catch (error) {
                console.error(`❌ Erreur upload ${file.name}:`, error);
                updateQueueItem(fileId, { status: 'error', error: error.message |

| 'Erreur inconnue', progress: 0 });
            }
        }

        if (successfulUploads.length > 0) {
            setReport(prevReport => {
                const updatedReport = {...prevReport, files:),...successfulUploads] };
                saveReportSilently(updatedReport);
                return updatedReport;
            });
            setFileListKey(Date.now());
        }

        setTimeout(() => {
            setUploadState(prev => ({
               ...prev,
                isUploading: false,
                queue: prev.queue.filter(item => item.status === 'error')
            }));
        }, 3000);

    },);

    const handleFileChangeEvent = (event) => {
        processAndUploadFiles(Array.from(event.target.files));
        event.target.value = '';
    };

    const handleSave = async () => {
        if (!intervention) return;
        setIsSaving(true);
        try {
            window.sessionStorage.removeItem(storageKey);
            await onSave(intervention.id, report);
        } catch (error) {
            console.error('❌ Erreur sauvegarde finale:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRefreshFiles = () => {
        setFileListKey(Date.now());
        if (intervention?.report?.files) {
            setReport(prev => ({...prev, files: intervention.report.files }));
        }
    };

    const handleClearSignature = () => {
        if (signatureCanvasRef.current) {
            const canvas = signatureCanvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        handleReportChange('signature', null);
    };

    const handleSaveSignatureFromModal = (signatureDataUrl) => {
        handleReportChange('signature', signatureDataUrl);
        setShowSignatureModal(false);
    };

    const formatTime = (iso) => iso? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    if (loading) return <div className="loading-container"><LoaderIcon className="spinning" /> <p>Chargement de l'intervention...</p></div>;
    if (!intervention ||!report) return <div className="card-white"><h2>Intervention non trouvée ou rapport corrompu.</h2><button onClick={() => navigate('/planning')}>Retour</button></div>;

    return (
        <div>
            {showSignatureModal && <SignatureModal onSave={handleSaveSignatureFromModal} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}

            <style>{`
               .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <button onClick={() => navigate('/planning')} className="back-button"><ChevronLeftIcon /> Retour</button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                <div className="section">
                    <h3>Documents de préparation</h3>
                    {(intervention.intervention_briefing_documents && intervention.intervention_briefing_documents.length > 0)? (
                        <ul className="document-list">
                            {intervention.intervention_briefing_documents.map(doc => (
                                <li key={doc.id}>
                                    <span>{doc.file_name}</span>
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                        <DownloadIcon/> Voir
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted">Aucun document de préparation.</p>
                    )}
                </div>

                <div className="section">
                    <h3>Pointage</h3>
                    <div className="grid-2-cols">
                        <button onClick={() => handleReportChange('arrivalTime', new Date().toISOString())} className="btn btn-success" disabled={!!report.arrivalTime |

| isAdmin}>
                            {report.arrivalTime? `✅ Arrivé: ${formatTime(report.arrivalTime)}` : '🕐 Arrivée sur site'}
                        </button>
                        <button onClick={() => handleReportChange('departureTime', new Date().toISOString())} className="btn btn-danger" disabled={!report.arrivalTime ||!!report.departureTime |

| isAdmin}>
                            {report.departureTime? `✅ Parti: ${formatTime(report.departureTime)}` : '🚪 Départ du site'}
                        </button>
                    </div>
                </div>

                <div className="section">
                    <h3>Rapport de chantier</h3>
                    <textarea value={report.notes |

| ''} onChange={e => handleReportChange('notes', e.target.value)} placeholder="Détails de l'intervention, matériel utilisé, etc." rows="4" className="form-control" readOnly={isAdmin} />
                </div>

                <div className="section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3>Photos et Documents du Rapport</h3>
                        <button onClick={handleRefreshFiles} className="refresh-button" disabled={uploadState.isUploading}><RefreshCwIcon /></button>
                    </div>
                    <ul key={fileListKey} className="document-list-optimized">
                        {(report.files ||).map((file, idx) => (
                            <li key={`${file.url}-${idx}`} className="document-item-optimized">
                                {file.type.startsWith('image/')? <OptimizedImage src={file.url} alt={file.name} style={{ width: 40, height: 40, objectFit: 'cover' }} /> : <FileTextIcon />}
                                <span className="file-name">{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary"><DownloadIcon /> Voir</a>
                            </li>
                        ))}
                    </ul>

                    {uploadState.queue.length > 0 && (
                        <div className="upload-queue-container">
                            <h4>{uploadState.isUploading? `Envoi en cours... ${uploadState.globalProgress}%` : 'Transfert terminé'}</h4>
                            <div className="upload-progress-bar" style={{ marginBottom: '1rem' }}>
                                <div className="upload-progress-fill" style={{ width: `${uploadState.globalProgress}%` }} />
                            </div>
                            {uploadState.queue.map(item => (
                                <div key={item.id} className={`upload-queue-item status-${item.status}`}>
                                    <div className="item-status-icon">
                                        {item.status === 'pending' && <Icon name="⏳" />}
                                        {item.status === 'converting' && <LoaderIcon className="spinning" />}
                                        {item.status === 'compressing' && <LoaderIcon className="spinning" />}
                                        {item.status === 'uploading' && <LoaderIcon className="spinning" />}
                                        {item.status === 'completed' && <CheckCircleIcon />}
                                        {item.status === 'error' && <AlertTriangleIcon />}
                                    </div>
                                    <div className="item-details">
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-status-text">
                                            {item.status === 'converting' && 'Conversion HEIC...'}
                                            {item.status === 'compressing' && 'Compression...'}
                                            {item.status === 'uploading' && `Envoi... ${item.progress}%`}
                                            {item.status === 'completed' && 'Terminé!'}
                                            {item.error && `Erreur: ${item.error}`}
                                        </span>
                                        {(item.status!== 'pending' && item.status!== 'completed' && item.status!== 'error') &&
                                            <div className="upload-progress-bar individual"><div className="upload-progress-fill" style={{ width: `${item.progress}%` }} /></div>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ✅ NOUVELLE ARCHITECTURE D'ENVOI */}
                    {!isAdmin && (
                        <div className="grid-2-cols" style={{ marginTop: '1rem' }}>
                            <input
                                type="file"
                                ref={cameraInputRef}
                                onChange={handleFileChangeEvent}
                                accept="image/*"
                                capture="environment"
                                style={{ display: 'none' }}
                            />
                            <input
                                type="file"
                                ref={libraryInputRef}
                                onChange={handleFileChangeEvent}
                                accept="image/*,application/pdf,text/plain,.heic,.heif"
                                multiple
                                style={{ display: 'none' }}
                            />

                            <button onClick={() => cameraInputRef.current.click()} disabled={uploadState.isUploading} className="btn btn-secondary">
                                <CameraIcon /> Prendre une photo
                            </button>
                            <button onClick={() => libraryInputRef.current.click()} disabled={uploadState.isUploading} className="btn btn-secondary">
                                <LibraryIcon /> Choisir des fichiers
                            </button>
                        </div>
                    )}
                </div>

                <div className="section">
                    <h3>Signature du client</h3>
                    <div className="signature-container">
                        {report.signature?
                            <img src={report.signature} alt="Signature" className="signature-image"/> :
                            <canvas ref={signatureCanvasRef} className="signature-canvas" width="300" height="150" />
                        }
                        <div className="signature-buttons">
                            <button onClick={handleClearSignature} className="text-muted-link" disabled={isAdmin}>Effacer</button>
                            <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary" disabled={isAdmin}><ExpandIcon /> Agrandir</button>
                        </div>
                    </div>
                </div>

                {!isAdmin && <button onClick={handleSave} disabled={uploadState.isUploading |

| isSaving} className="btn btn-primary w-full mt-4">{isSaving? <><LoaderIcon className="spinning" /> Sauvegarde...</> : '🔒 Sauvegarder et Clôturer'}</button>}
            </div>
        </div>
    );
}
