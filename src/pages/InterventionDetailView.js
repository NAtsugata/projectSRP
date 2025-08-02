// src/pages/InterventionDetailView.js - Version corrigée et nettoyée
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon } from '../components/SharedUI';

// Hook mobile simplifié intégré directement
const useMobileUpload = (interventionId) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Détection des capacités device
    const [capabilities] = useState(() => {
        const userAgent = navigator.userAgent;
        const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);
        const isAndroid = /Android/.test(userAgent);

        return {
            isMobile,
            isIOS,
            isAndroid,
            hasCamera: 'mediaDevices' in navigator,
            supportsFileAPI: 'FileReader' in window,
            supportsDragDrop: 'ondrop' in window && !isMobile
        };
    });

    // Gestion de l'état en ligne/hors ligne
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Fonction de compression d'image simple
    const compressImage = React.useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = img;

                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', 0.8);
            };

            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }, []);

    // Upload avec retry simple
    const uploadWithRetry = React.useCallback(async (file) => {
        const maxRetries = 2;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                setUploadProgress(attempt * 30);

                const result = await storageService.uploadInterventionFile(
                    file,
                    interventionId,
                    'report'
                );

                if (result.error) {
                    throw result.error;
                }

                setUploadProgress(100);
                return result;

            } catch (uploadError) {
                lastError = uploadError;
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        throw lastError;
    }, [interventionId]);

    // Fonction principale d'upload
    const handleFileUpload = React.useCallback(async (files) => {
        if (!files || files.length === 0) return { results: [], invalidFiles: [] };

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        const results = [];
        const validFiles = Array.from(files).filter(file => {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['image/', 'application/pdf'];

            return file.size <= maxSize &&
                   allowedTypes.some(type => file.type.startsWith(type));
        });

        try {
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];

                try {
                    // Compression pour les images sur mobile
                    let fileToUpload = file;
                    if (capabilities.isMobile && file.type.startsWith('image/')) {
                        fileToUpload = await compressImage(file);
                    }

                    const result = await uploadWithRetry(fileToUpload);

                    results.push({
                        file,
                        success: true,
                        result
                    });

                } catch (uploadError) {
                    results.push({
                        file,
                        success: false,
                        error: uploadError.message
                    });
                }

                setUploadProgress(Math.round(((i + 1) / validFiles.length) * 100));
            }

        } catch (generalError) {
            setError(generalError.message);
        } finally {
            setIsUploading(false);
        }

        return {
            results,
            invalidFiles: Array.from(files).filter(file => !validFiles.includes(file))
        };
    }, [capabilities.isMobile, compressImage, uploadWithRetry]);

    const reset = React.useCallback(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setError(null);
    }, []);

    return {
        handleFileUpload,
        capabilities,
        isUploading,
        uploadProgress,
        error,
        reset,
        isOnline
    };
};

// Composant SignatureModal
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
            return {
                x: (clientX - rect.left) * (canvas.width / rect.width),
                y: (clientY - rect.top) * (canvas.height / rect.height)
            };
        };

        const startDrawing = (e) => {
            e.preventDefault();
            drawing = true;
            setIsDrawing(true);
            lastPos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
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
            if (lastPos) {
                ctx.beginPath();
                ctx.moveTo(lastPos.x, lastPos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
            lastPos = pos;
        };

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
                    <button type="button" onClick={handleSaveSignature} className="btn btn-primary" disabled={!isDrawing && !existingSignature}>
                        Valider la Signature
                    </button>
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
    const storageKey = 'srp-intervention-report-' + interventionId;
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);

    // Utilisation du hook mobile intégré
    const {
        handleFileUpload,
        capabilities,
        isUploading,
        uploadProgress,
        error: uploadError,
        reset: resetUpload,
        isOnline
    } = useMobileUpload(interventionId);

    // État pour gérer la queue d'upload avec feedback
    const [uploadQueue, setUploadQueue] = useState([]);

    useEffect(() => {
        const foundIntervention = interventions.find(i => i.id.toString() === interventionId);
        if (foundIntervention) {
            setIntervention(foundIntervention);
            setLoading(false);
        } else if (interventions.length > 0) {
            navigate('/planning');
        }
    }, [interventions, interventionId, navigate]);

    useEffect(() => {
        if (intervention) {
            const savedReport = window.sessionStorage.getItem(storageKey);
            if (savedReport) {
                try {
                    setReport(JSON.parse(savedReport));
                } catch (e) {
                    setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null });
                }
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

    // ✅ GESTIONNAIRE DE FICHIERS CORRIGÉ - Sauvegarde immédiate
    const handleFileSelect = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !intervention) return;

        resetUpload();

        try {
            // Mise à jour de la queue avec les nouveaux fichiers
            const newQueueItems = Array.from(files).map(file => ({
                id: `${file.name}-${file.lastModified}-${file.size}`,
                name: file.name,
                size: file.size,
                status: 'pending',
                error: null,
                progress: 0
            }));

            setUploadQueue(prev => [...prev, ...newQueueItems]);

            // Traitement des uploads
            const uploadResults = await handleFileUpload(files);

            // Collecter les uploads réussis
            const successfulUploads = [];

            uploadResults.results.forEach(result => {
                const queueId = `${result.file.name}-${result.file.lastModified}-${result.file.size}`;

                setUploadQueue(prev => prev.map(item =>
                    item.id === queueId
                        ? {
                            ...item,
                            status: result.success ? 'success' : 'error',
                            error: result.error || null,
                            progress: 100
                        }
                        : item
                ));

                if (result.success && !result.stored) {
                    const newFileInfo = {
                        name: result.file.name,
                        url: result.result.publicURL,
                        type: result.file.type
                    };
                    successfulUploads.push(newFileInfo);
                }
            });

            // ✅ CORRECTION PRINCIPALE : Sauvegarder immédiatement après upload
            if (successfulUploads.length > 0) {
                // Mettre à jour le rapport local
                const updatedReport = {
                    ...report,
                    files: [...(report.files || []), ...successfulUploads]
                };

                setReport(updatedReport);

                // ✅ SAUVEGARDER IMMÉDIATEMENT EN BASE DE DONNÉES
                try {
                    await onSave(intervention.id, updatedReport);
                    console.log('✅ Fichiers sauvegardés immédiatement:', successfulUploads);
                } catch (saveError) {
                    console.error('❌ Erreur sauvegarde immédiate:', saveError);
                    // Les fichiers sont quand même sur Supabase Storage
                }
            }

            // Gestion des fichiers invalides
            if (uploadResults.invalidFiles.length > 0) {
                console.warn('Fichiers rejetés:', uploadResults.invalidFiles);
            }

        } catch (error) {
            console.error('Erreur lors de l\'upload:', error);
            setUploadQueue(prev => prev.map(item => ({
                ...item,
                status: 'error',
                error: error.message || 'Erreur inconnue'
            })));
        }
    };

    const handleRetryUpload = async (queueItem) => {
        if (queueItem.status !== 'error') return;

        setUploadQueue(prev => prev.map(item =>
            item.id === queueItem.id
                ? { ...item, status: 'pending', error: null, progress: 0 }
                : item
        ));
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

    const handleClearSignature = () => {
        if (signatureCanvasRef.current) {
            const canvas = signatureCanvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setReport(prev => ({...prev, signature: null}));
        }
    };

    const handleSaveSignatureFromModal = (signatureDataUrl) => {
        setReport(prev => ({...prev, signature: signatureDataUrl}));
        setShowSignatureModal(false);
    };

    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR') : 'N/A';

    if (loading || (!intervention && interventions.length === 0)) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Chargement...</p>
            </div>
        );
    }

    if (!intervention) {
        return (
            <div className="card-white">
                <h2>Intervention non trouvée</h2>
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
                .document-list-detailed, .upload-queue-list, .document-list {
                    list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem;
                }
                .document-list-detailed li, .upload-queue-list li, .document-list li {
                    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem;
                    background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; min-height: 60px;
                }
                .document-list li span { flex-grow: 1; }
                .document-thumbnail {
                    width: 40px; height: 40px; object-fit: cover; border-radius: 0.25rem; background-color: #e9ecef;
                }
                .upload-status-icon { width: 24px; height: 24px; flex-shrink: 0; }
                .upload-status-icon.success { color: #28a745; }
                .upload-status-icon.error { color: #dc3545; }
                .upload-status-icon.loading { color: #007bff; animation: spin 1s linear infinite; }
                .file-info-container { flex-grow: 1; }
                .file-name { font-size: 0.9rem; word-break: break-all; }
                .error-message { font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem; }
                .upload-actions { display: flex; gap: 0.5rem; }
                .upload-actions button { background: none; border: none; cursor: pointer; padding: 0.25rem; }
                .upload-actions .icon { width: 20px; height: 20px; }
                .icon-retry { color: #007bff; }
                .icon-remove { color: #6c757d; }
                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 768px) {
                    .upload-queue-list li, .document-list-detailed li {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.5rem;
                    }
                    .file-info-container {
                        width: 100%;
                    }
                    .upload-actions {
                        justify-content: flex-end;
                        width: 100%;
                    }
                    .document-thumbnail {
                        width: 32px;
                        height: 32px;
                    }
                }
            `}</style>

            <button onClick={handleGoBack} className="back-button">
                <ChevronLeftIcon /> Retour
            </button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                {!isOnline && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        borderRadius: '0.375rem',
                        marginBottom: '1rem',
                        fontSize: '0.875rem',
                        color: '#856404'
                    }}>
                        📡 Mode hors-ligne - Les fichiers seront synchronisés dès le retour de la connexion
                    </div>
                )}

                <div className="section">
                    <h3>Documents de préparation</h3>
                    {(intervention.intervention_briefing_documents && intervention.intervention_briefing_documents.length > 0) ? (
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
                        <button
                            onClick={() => handleReportChange('arrivalTime', new Date().toISOString())}
                            className="btn btn-success"
                            disabled={!!report.arrivalTime || isAdmin}
                        >
                            Arrivée sur site
                        </button>
                        <button
                            onClick={() => handleReportChange('departureTime', new Date().toISOString())}
                            className="btn btn-danger"
                            disabled={!report.arrivalTime || !!report.departureTime || isAdmin}
                        >
                            Départ du site
                        </button>
                    </div>
                    <div className="time-display">
                        <p>Heure d'arrivée: <span>{formatTime(report.arrivalTime)}</span></p>
                        <p>Heure de départ: <span>{formatTime(report.departureTime)}</span></p>
                    </div>
                </div>

                <div className="section">
                    <h3>Rapport de chantier</h3>
                    <textarea
                        value={report.notes || ''}
                        onChange={e => handleReportChange('notes', e.target.value)}
                        placeholder="Détails de l'intervention..."
                        rows="4"
                        className="form-control"
                        readOnly={isAdmin}
                    />
                </div>

                <div className="section">
                    <h3>Photos et Documents du Rapport</h3>

                    {capabilities.isMobile && (
                        <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginBottom: '0.5rem',
                            fontStyle: 'italic'
                        }}>
                            📱 Mode mobile détecté
                            {capabilities.hasCamera && ' - Caméra disponible'}
                            {capabilities.isIOS && ' - iOS'}
                            {capabilities.isAndroid && ' - Android'}
                        </div>
                    )}

                    <ul className="document-list-detailed">
                        {(report.files || []).map((file, idx) => (
                            <li key={idx}>
                                {file.type && file.type.startsWith('image/') ?
                                    <img src={file.url} alt={`Aperçu de ${file.name}`} className="document-thumbnail" /> :
                                    <FileTextIcon className="document-icon" />
                                }
                                <span>{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                    Voir
                                </a>
                            </li>
                        ))}
                    </ul>

                    {uploadQueue.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">Téléchargements</h4>
                            <ul className="upload-queue-list">
                                {uploadQueue.map((item) => (
                                    <li key={item.id}>
                                        {item.status === 'pending' && <LoaderIcon className="upload-status-icon loading" />}
                                        {item.status === 'success' && <CheckCircleIcon className="upload-status-icon success" />}
                                        {item.status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}

                                        <div className="file-info-container">
                                            <span className="file-name">{item.name}</span>
                                            {item.size && (
                                                <span style={{fontSize: '0.75rem', color: '#6b7280'}}>
                                                    {Math.round(item.size / 1024)}KB
                                                </span>
                                            )}
                                            {item.error && <span className="error-message">{item.error}</span>}
                                            {item.progress > 0 && item.progress < 100 && (
                                                <div style={{
                                                    width: '100%',
                                                    height: '4px',
                                                    backgroundColor: '#e5e7eb',
                                                    borderRadius: '2px',
                                                    marginTop: '0.25rem',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        width: `${item.progress}%`,
                                                        height: '100%',
                                                        backgroundColor: '#3b82f6',
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="upload-actions">
                                            {item.status === 'error' && (
                                                <button
                                                    onClick={() => handleRetryUpload(item)}
                                                    title="Réessayer"
                                                >
                                                    <RefreshCwIcon className="icon icon-retry" />
                                                </button>
                                            )}
                                            {item.status !== 'pending' && (
                                                <button
                                                    onClick={() => handleRemoveFromQueue(item.id)}
                                                    title="Retirer"
                                                >
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
                        <CustomFileInput
                            accept="image/*,application/pdf"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                            multiple
                            className="mt-4"
                        >
                            {isUploading ? (
                                <>
                                    <LoaderIcon className="animate-spin" />
                                    Envoi en cours... ({uploadProgress}%)
                                </>
                            ) : (
                                <>
                                    {capabilities.isMobile ? '📷 Prendre une photo ou choisir un fichier' : 'Ajouter des fichiers (Photo/PDF)'}
                                </>
                            )}
                        </CustomFileInput>
                    )}

                    {uploadError && (
                        <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '0.375rem',
                            marginTop: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#b91c1c'
                        }}>
                            ❌ Erreur d'upload: {uploadError}
                            <button
                                onClick={resetUpload}
                                style={{
                                    marginLeft: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#b91c1c',
                                    textDecoration: 'underline',
                                    cursor: 'pointer'
                                }}
                            >
                                Réessayer
                            </button>
                        </div>
                    )}
                </div>

                <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? (
                        <img
                            src={report.signature}
                            alt="Signature client"
                            style={{
                                border: '1px solid #ccc',
                                borderRadius: '0.375rem',
                                maxWidth: '100%'
                            }}
                        />
                    ) : (
                        <div className="signature-container">
                            <canvas
                                ref={signatureCanvasRef}
                                className="signature-canvas"
                                width="300"
                                height="150"
                            />
                            <div className="signature-actions">
                                <button onClick={handleClearSignature} className="text-muted-link">
                                    Effacer
                                </button>
                                <button
                                    onClick={() => setShowSignatureModal(true)}
                                    className="btn btn-secondary btn-sm"
                                >
                                    <ExpandIcon /> Agrandir
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!isAdmin && (
                    <button
                        onClick={handleSave}
                        disabled={isUploading || uploadQueue.some(item => item.status === 'pending')}
                        className="btn btn-primary w-full mt-4"
                    >
                        {isUploading || uploadQueue.some(item => item.status === 'pending') ?
                            'Attendre la fin des envois...' :
                            'Sauvegarder et Clôturer'
                        }
                    </button>
                )}
            </div>
        </div>
    );
}