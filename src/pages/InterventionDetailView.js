// src/pages/InterventionDetailView.js - VERSION OPTIMISÉE MOBILE
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import MobileFileInput from '../components/MobileFileInput';
import {
    ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon,
    AlertTriangleIcon, LoaderIcon, ExpandIcon, RefreshCwIcon,
    XCircleIcon, ImageIcon
} from '../components/SharedUI';

// =================================================================================
// COMPOSANT D'IMAGE OPTIMISÉ POUR MOBILE
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

// =================================================================================
// MODALE DE SIGNATURE
// =================================================================================
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

        // Remplit le fond en blanc pour éviter un canvas noir par défaut
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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
            // Efface le contenu puis remet un fond blanc pour éviter un canevas noir
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
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

// =================================================================================
// COMPOSANT PRINCIPAL
// =================================================================================
export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadState, setUploadState] = useState({
        isUploading: false,
        queue: [],
        globalProgress: 0,
        error: null
    });
    const [fileListKey, setFileListKey] = useState(Date.now());
    const signatureCanvasRef = useRef(null);
    const storageKey = `srp-intervention-report-${interventionId}`;

    // Détection mobile sécurisée (pour éviter les erreurs si navigator n'est pas défini)
    const ua = typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

    // Initialisation
    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            const savedReport = window.sessionStorage.getItem(storageKey);
            const initialReport = savedReport ?
                JSON.parse(savedReport) :
                (foundIntervention.report || {
                    notes: '',
                    files: [],
                    arrivalTime: null,
                    departureTime: null,
                    signature: null
                });
            setReport(initialReport);
            setLoading(false);
        } else if (interventions.length > 0) {
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate, storageKey]);

    // Sauvegarde automatique en session
    useEffect(() => {
        if (report && intervention) {
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(report));
            } catch (error) {
                console.warn("Impossible de sauvegarder le rapport en session :", error);
            }
        }
    }, [report, storageKey, intervention]);

    // Mise à jour du rapport
    const handleReportChange = (field, value) => {
        setReport(prev => ({ ...prev, [field]: value }));
    };

    // Sauvegarde silencieuse
    const saveReportSilently = useCallback(async (updatedReport) => {
        try {
            await onSaveSilent(interventionId, updatedReport);
        } catch (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
        }
    }, [interventionId, onSaveSilent]);

    // ✅ COMPRESSION D'IMAGE OPTIMISÉE
    const compressImage = useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Dimensions max selon le device
                const maxWidth = isMobile ? 1280 : 1920;
                const maxHeight = isMobile ? 720 : 1080;

                let { width, height } = img;
                const ratio = Math.min(maxWidth / width, maxHeight / height);

                if (ratio < 1) {
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        console.log(`✅ Compression: ${Math.round(file.size/1024)}KB → ${Math.round(compressedFile.size/1024)}KB`);
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', 0.8);
            };

            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }, [isMobile]);

    // ✅ GESTION OPTIMISÉE DE L'UPLOAD
    const handleFileSelect = useCallback(async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !intervention) return;

        console.log(`📤 Upload de ${files.length} fichier(s)`);

        const queueItems = Array.from(files).map((file, index) => ({
            id: `${file.name}-${Date.now()}-${index}`,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'pending',
            progress: 0,
            error: null
        }));

        setUploadState({
            isUploading: true,
            queue: queueItems,
            globalProgress: 0,
            error: null
        });

        const successfulUploads = [];

        // Upload séquentiel
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const queueItem = queueItems[i];

            try {
                console.log(`📤 Upload ${i+1}/${files.length}: ${file.name}`);

                // Mise à jour: compression
                setUploadState(prev => ({
                    ...prev,
                    queue: prev.queue.map(item =>
                        item.id === queueItem.id
                            ? { ...item, status: 'compressing', progress: 5 }
                            : item
                    )
                }));

                let fileToUpload = file;
                if (file.type.startsWith('image/')) {
                    fileToUpload = await compressImage(file);
                }

                // Mise à jour: upload
                setUploadState(prev => ({
                    ...prev,
                    queue: prev.queue.map(item =>
                        item.id === queueItem.id
                            ? { ...item, status: 'uploading', progress: 20 }
                            : item
                    )
                }));

                // Upload avec progression
                const result = await storageService.uploadInterventionFile(
                    fileToUpload,
                    interventionId,
                    'report',
                    (progress) => {
                        setUploadState(prev => ({
                            ...prev,
                            queue: prev.queue.map(item =>
                                item.id === queueItem.id
                                    ? { ...item, progress }
                                    : item
                            ),
                            globalProgress: Math.round(
                                prev.queue.reduce((sum, item) => sum + item.progress, 0) / prev.queue.length
                            )
                        }));
                    }
                );

                if (result.error) throw result.error;

                console.log(`✅ Upload réussi: ${file.name} -> ${result.publicURL}`);

                // Succès
                successfulUploads.push({
                    name: file.name,
                    url: result.publicURL,
                    type: file.type
                });

                setUploadState(prev => ({
                    ...prev,
                    queue: prev.queue.map(item =>
                        item.id === queueItem.id
                            ? { ...item, status: 'completed', progress: 100 }
                            : item
                    )
                }));

            } catch (error) {
                console.error(`❌ Erreur upload ${file.name}:`, error);

                setUploadState(prev => ({
                    ...prev,
                    queue: prev.queue.map(item =>
                        item.id === queueItem.id
                            ? { ...item, status: 'error', error: error.message, progress: 0 }
                            : item
                    )
                }));
            }
        }

        // Mise à jour du rapport
        if (successfulUploads.length > 0) {
            console.log(`💾 Ajout de ${successfulUploads.length} fichier(s) au rapport`);
            setReport(prev => {
                const updated = {
                    ...prev,
                    files: [...(prev.files || []), ...successfulUploads]
                };
                saveReportSilently(updated);
                return updated;
            });
            setFileListKey(Date.now());
        }

        // Nettoyage après 3 secondes
        setTimeout(() => {
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                queue: prev.queue.filter(item => item.status === 'error')
            }));
        }, 3000);

    }, [intervention, interventionId, compressImage, saveReportSilently]);

    // Gestion des erreurs d'upload
    const handleUploadError = useCallback((errors) => {
        setUploadState(prev => ({
            ...prev,
            error: errors.join(' • ')
        }));
    }, []);

    // Sauvegarde finale
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

    // Rafraîchir la liste des fichiers
    const handleRefreshFiles = () => {
        setFileListKey(Date.now());
        if (intervention?.report?.files) {
            setReport(prev => ({ ...prev, files: intervention.report.files }));
        }
    };

    // Effacer la signature
    const handleClearSignature = () => {
        if (signatureCanvasRef.current) {
            const canvas = signatureCanvasRef.current;
            const ctx = canvas.getContext('2d');
            // Efface le canvas puis réinitialise le fond en blanc
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // Réinitialise la valeur de signature dans le rapport
        handleReportChange('signature', null);
    };

    // Sauvegarder la signature depuis la modale
    const handleSaveSignatureFromModal = (signatureDataUrl) => {
        handleReportChange('signature', signatureDataUrl);
        setShowSignatureModal(false);
    };

    // Formatage de l'heure
    const formatTime = (iso) => {
        if (!iso) return 'N/A';
        return new Date(iso).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Formatage de la taille
    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return Math.round(bytes / (1024 * 1024) * 10) / 10 + ' MB';
    };

    if (loading) {
        return (
            <div className="loading-container">
                <LoaderIcon className="animate-spin" />
                <p>Chargement de l'intervention...</p>
            </div>
        );
    }

    if (!intervention || !report) {
        return (
            <div className="card-white">
                <h2>Intervention non trouvée</h2>
                <button onClick={() => navigate('/planning')} className="btn btn-primary">
                    Retour au planning
                </button>
            </div>
        );
    }

    return (
        <div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
                .upload-queue-container {
                    margin-top: 1rem;
                    padding: 1rem;
                    background-color: #f8f9fa;
                    border-radius: 0.5rem;
                }
                .upload-queue-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    margin-bottom: 0.5rem;
                    background-color: white;
                    border-radius: 0.375rem;
                    border: 1px solid #e5e7eb;
                    transition: all 0.2s ease;
                }
                .upload-queue-item.status-error {
                    background-color: #fee2e2;
                    border-color: #fecaca;
                }
                .upload-queue-item.status-completed {
                    background-color: #dcfce7;
                    border-color: #bbf7d0;
                }
                .upload-progress-bar {
                    width: 100%;
                    height: 4px;
                    background-color: #e5e7eb;
                    border-radius: 2px;
                    overflow: hidden;
                    margin-top: 0.25rem;
                }
                .upload-progress-fill {
                    height: 100%;
                    background-color: #3b82f6;
                    transition: width 0.3s ease;
                }
                .document-list-optimized {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .document-item-optimized {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background-color: #f8f9fa;
                    border-radius: 0.375rem;
                    transition: all 0.2s ease;
                }
                .document-item-optimized:hover {
                    background-color: #e9ecef;
                    transform: translateX(2px);
                }
                .file-name {
                    flex-grow: 1;
                    font-size: 0.9rem;
                    word-break: break-all;
                }
                @media (max-width: 768px) {
                    .document-item-optimized {
                        flex-wrap: wrap;
                    }
                }
            `}</style>

            {showSignatureModal && (
                <SignatureModal
                    onSave={handleSaveSignatureFromModal}
                    onCancel={() => setShowSignatureModal(false)}
                    existingSignature={report.signature}
                />
            )}

            <button onClick={() => navigate('/planning')} className="back-button">
                <ChevronLeftIcon /> Retour
            </button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service}</p>
                <p className="text-muted">{intervention.address}</p>
                <p className="text-muted">{intervention.date} à {intervention.time}</p>

                {/* Documents de préparation */}
                <div className="section">
                    <h3>📋 Documents de préparation</h3>
                    {(intervention.intervention_briefing_documents && intervention.intervention_briefing_documents.length > 0) ? (
                        <ul className="document-list-optimized">
                            {intervention.intervention_briefing_documents.map(doc => (
                                <li key={doc.id} className="document-item-optimized">
                                    <FileTextIcon />
                                    <span className="file-name">{doc.file_name}</span>
                                    <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-primary"
                                    >
                                        <DownloadIcon /> Voir
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted">Aucun document de préparation</p>
                    )}
                </div>

                {/* Pointage */}
                <div className="section">
                    <h3>⏱️ Pointage</h3>
                    <div className="grid-2-cols">
                        <button
                            onClick={() => handleReportChange('arrivalTime', new Date().toISOString())}
                            className="btn btn-success"
                            disabled={!!report.arrivalTime || isAdmin}
                        >
                            {report.arrivalTime ? `✅ Arrivé: ${formatTime(report.arrivalTime)}` : '🕐 Arrivée sur site'}
                        </button>
                        <button
                            onClick={() => handleReportChange('departureTime', new Date().toISOString())}
                            className="btn btn-danger"
                            disabled={!report.arrivalTime || !!report.departureTime || isAdmin}
                        >
                            {report.departureTime ? `✅ Parti: ${formatTime(report.departureTime)}` : '🚪 Départ du site'}
                        </button>
                    </div>
                </div>

                {/* Rapport */}
                <div className="section">
                    <h3>📝 Rapport de chantier</h3>
                    <textarea
                        value={report.notes || ''}
                        onChange={e => handleReportChange('notes', e.target.value)}
                        placeholder="Détails de l'intervention, matériel utilisé, observations..."
                        rows="5"
                        className="form-control"
                        readOnly={isAdmin}
                    />
                </div>

                {/* Photos et Documents */}
                <div className="section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3>📷 Photos et Documents</h3>
                        <button
                            onClick={handleRefreshFiles}
                            className="btn-icon"
                            disabled={uploadState.isUploading}
                            title="Rafraîchir"
                        >
                            <RefreshCwIcon />
                        </button>
                    </div>

                    {/* Liste des fichiers existants */}
                    {report.files && report.files.length > 0 && (
                        <ul key={fileListKey} className="document-list-optimized" style={{marginBottom: '1rem'}}>
                            {report.files.map((file, idx) => (
                                <li key={`${file.url}-${idx}`} className="document-item-optimized">
                                    {file.type?.startsWith('image/') ? (
                                        <OptimizedImage
                                            src={file.url}
                                            alt={file.name}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                objectFit: 'cover',
                                                borderRadius: '0.25rem'
                                            }}
                                        />
                                    ) : (
                                        <FileTextIcon />
                                    )}
                                    <span className="file-name">{file.name}</span>
                                    <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-secondary"
                                    >
                                        <DownloadIcon /> Voir
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Queue d'upload */}
                    {uploadState.queue.length > 0 && (
                        <div className="upload-queue-container">
                            <h4 style={{marginBottom: '1rem'}}>
                                {uploadState.isUploading ?
                                    `📤 Envoi en cours... ${uploadState.globalProgress}%` :
                                    '✅ Transfert terminé'
                                }
                            </h4>

                            {uploadState.isUploading && (
                                <div className="upload-progress-bar" style={{marginBottom: '1rem'}}>
                                    <div
                                        className="upload-progress-fill"
                                        style={{width: `${uploadState.globalProgress}%`}}
                                    />
                                </div>
                            )}

                            {uploadState.queue.map(item => (
                                <div
                                    key={item.id}
                                    className={`upload-queue-item status-${item.status}`}
                                >
                                    <div style={{width: '24px', height: '24px', flexShrink: 0}}>
                                        {item.status === 'pending' && '⏳'}
                                        {item.status === 'compressing' && <LoaderIcon className="animate-spin" />}
                                        {item.status === 'uploading' && <LoaderIcon className="animate-spin" />}
                                        {item.status === 'completed' && <CheckCircleIcon />}
                                        {item.status === 'error' && <AlertTriangleIcon />}
                                    </div>
                                    <div style={{flexGrow: 1, minWidth: 0}}>
                                        <div style={{fontWeight: 500, fontSize: '0.9rem'}}>
                                            {item.name}
                                        </div>
                                        <div style={{fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem'}}>
                                            {item.status === 'compressing' && 'Compression...'}
                                            {item.status === 'uploading' && `Envoi... ${item.progress}%`}
                                            {item.status === 'completed' && 'Terminé !'}
                                            {item.error && `Erreur: ${item.error}`}
                                        </div>
                                        {(item.status === 'uploading' || item.status === 'compressing') && (
                                            <div className="upload-progress-bar">
                                                <div
                                                    className="upload-progress-fill"
                                                    style={{width: `${item.progress}%`}}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Message d'erreur global */}
                    {uploadState.error && (
                        <div style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            marginTop: '0.5rem',
                            fontSize: '0.875rem'
                        }}>
                            {uploadState.error}
                        </div>
                    )}

                    {/* Input d'upload mobile optimisé */}
                    {!isAdmin && (
                        <MobileFileInput
                            onChange={handleFileSelect}
                            disabled={uploadState.isUploading}
                            multiple
                            accept="image/*,application/pdf"
                            maxFiles={10}
                            maxSize={isMobile ? 5 * 1024 * 1024 : 10 * 1024 * 1024}
                            onError={handleUploadError}
                        >
                            {uploadState.isUploading ?
                                '⏳ Envoi en cours...' :
                                '📷 Ajouter photos/documents'
                            }
                        </MobileFileInput>
                    )}
                </div>

                {/* Signature */}
                <div className="section">
                    <h3>✍️ Signature du client</h3>
                    {report.signature ? (
                        <div style={{position: 'relative'}}>
                            <img
                                src={report.signature}
                                alt="Signature"
                                style={{
                                    width: '100%',
                                    maxWidth: '300px',
                                    height: '150px',
                                    objectFit: 'contain',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    backgroundColor: '#f8f9fa'
                                }}
                            />
                            {!isAdmin && (
                                <button
                                    onClick={handleClearSignature}
                                    className="btn btn-sm btn-secondary"
                                    style={{marginTop: '0.5rem'}}
                                >
                                    Effacer la signature
                                </button>
                            )}
                        </div>
                    ) : (
                        <div>
                            <canvas
                                ref={signatureCanvasRef}
                                className="signature-canvas"
                                width="300"
                                height="150"
                                style={{
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: '0.5rem',
                                    width: '100%',
                                    maxWidth: '300px',
                                    backgroundColor: '#f8fafc',
                                    cursor: isAdmin ? 'not-allowed' : 'crosshair'
                                }}
                            />
                            {!isAdmin && (
                                <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.5rem'}}>
                                    <button
                                        onClick={() => setShowSignatureModal(true)}
                                        className="btn btn-secondary"
                                    >
                                        <ExpandIcon /> Agrandir pour signer
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Bouton de sauvegarde */}
                {!isAdmin && (
                    <button
                        onClick={handleSave}
                        disabled={uploadState.isUploading || isSaving}
                        className="btn btn-primary w-full mt-4"
                        style={{
                            fontSize: '1rem',
                            padding: '1rem',
                            fontWeight: 600
                        }}
                    >
                        {isSaving ? (
                            <>
                                <LoaderIcon className="animate-spin" style={{marginRight: '0.5rem'}} />
                                Sauvegarde en cours...
                            </>
                        ) : (
                            <>
                                🔒 Sauvegarder et Clôturer l'intervention
                            </>
                        )}
                    </button>
                )}

                {/* Statut Admin */}
                {isAdmin && (
                    <div style={{
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        marginTop: '1rem',
                        textAlign: 'center'
                    }}>
                        ℹ️ Mode consultation (administrateur) - Modification désactivée
                    </div>
                )}
            </div>
        </div>
    );
}