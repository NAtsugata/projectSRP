// src/pages/InterventionDetailView.js - Version optimisée pour uploads multiples et performance
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon } from '../components/SharedUI';

// Composant d'image optimisé avec lazy loading
const OptimizedImage = ({ src, alt, className, style, onClick }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        if (!src) return;

        const img = new Image();
        img.onload = () => setLoading(false);
        img.onerror = () => {
            setLoading(false);
            setError(true);
        };

        // Démarrer le chargement
        img.src = src;
    }, [src]);

    if (error) {
        return (
            <div
                className={className}
                style={{
                    ...style,
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                    fontSize: '0.75rem'
                }}
            >
                ❌
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {loading && (
                <div
                    style={{
                        width: style?.width || 40,
                        height: style?.height || 40,
                        backgroundColor: '#f3f4f6',
                        borderRadius: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 1.5s ease-in-out infinite'
                    }}
                >
                    <LoaderIcon style={{ width: '16px', height: '16px', opacity: 0.5 }} />
                </div>
            )}
            <img
                ref={imgRef}
                src={src}
                alt={alt}
                className={className}
                style={{
                    ...style,
                    display: loading ? 'none' : 'block'
                }}
                onClick={onClick}
            />
        </div>
    );
};

// Hook mobile optimisé pour uploads parallèles
const useMobileUpload = (interventionId) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
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

    // ✅ COMPRESSION OPTIMISÉE - Plus rapide et efficace
    const compressImage = React.useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // ✅ OPTIMISATION: Dimensions plus petites pour mobile
                const maxWidth = capabilities.isMobile ? 1280 : 1920;
                const maxHeight = capabilities.isMobile ? 720 : 1080;
                let { width, height } = img;

                // Calcul plus efficace des proportions
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                if (ratio < 1) {
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                // ✅ Optimisation de la qualité de rendu
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, width, height);

                // ✅ Compression plus agressive pour mobile
                const quality = capabilities.isMobile ? 0.7 : 0.8;
                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            };

            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }, [capabilities.isMobile]);

    // ✅ UPLOAD INDIVIDUEL optimisé
    const uploadSingleFile = React.useCallback(async (file, fileId) => {
        const maxRetries = 2;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Mise à jour du progrès individuel
                setUploadProgress(prev => ({
                    ...prev,
                    [fileId]: { status: 'uploading', progress: attempt * 25 }
                }));

                const result = await storageService.uploadInterventionFile(
                    file,
                    interventionId,
                    'report'
                );

                if (result.error) {
                    throw result.error;
                }

                // Succès
                setUploadProgress(prev => ({
                    ...prev,
                    [fileId]: { status: 'completed', progress: 100 }
                }));

                return result;

            } catch (uploadError) {
                lastError = uploadError;
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
            }
        }

        // Échec final
        setUploadProgress(prev => ({
            ...prev,
            [fileId]: { status: 'error', progress: 0, error: lastError.message }
        }));

        throw lastError;
    }, [interventionId]);

    // ✅ FONCTION PRINCIPALE - UPLOADS PARALLÈLES
    const handleFileUpload = React.useCallback(async (files) => {
        if (!files || files.length === 0) return { results: [], invalidFiles: [] };

        setIsUploading(true);
        setError(null);

        // Validation des fichiers
        const validFiles = [];
        const invalidFiles = [];

        for (const file of Array.from(files)) {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['image/', 'application/pdf'];

            if (file.size <= maxSize && allowedTypes.some(type => file.type.startsWith(type))) {
                validFiles.push(file);
            } else {
                invalidFiles.push(file);
            }
        }

        console.log(`🚀 Upload parallèle de ${validFiles.length} fichier(s)`);

        // Initialiser le progrès pour tous les fichiers
        const initialProgress = {};
        validFiles.forEach((file, index) => {
            const fileId = `${file.name}-${file.lastModified}-${index}`;
            initialProgress[fileId] = { status: 'preparing', progress: 0 };
        });
        setUploadProgress(initialProgress);

        try {
            // ✅ TRAITEMENT PARALLÈLE avec limitation de concurrence
            const CONCURRENT_UPLOADS = capabilities.isMobile ? 2 : 4;
            const results = [];

            // Fonction pour traiter un fichier
            const processFile = async (file, index) => {
                const fileId = `${file.name}-${file.lastModified}-${index}`;

                try {
                    // Compression si nécessaire
                    let fileToUpload = file;
                    if (file.type.startsWith('image/')) {
                        setUploadProgress(prev => ({
                            ...prev,
                            [fileId]: { status: 'compressing', progress: 10 }
                        }));

                        fileToUpload = await compressImage(file);
                    }

                    // Upload
                    const result = await uploadSingleFile(fileToUpload, fileId);

                    return {
                        file,
                        fileId,
                        success: true,
                        result
                    };

                } catch (error) {
                    return {
                        file,
                        fileId,
                        success: false,
                        error: error.message
                    };
                }
            };

            // ✅ Traitement par lots pour éviter la surcharge
            for (let i = 0; i < validFiles.length; i += CONCURRENT_UPLOADS) {
                const batch = validFiles.slice(i, i + CONCURRENT_UPLOADS);
                const batchPromises = batch.map((file, batchIndex) =>
                    processFile(file, i + batchIndex)
                );

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                // Petit délai entre les lots pour éviter de surcharger
                if (i + CONCURRENT_UPLOADS < validFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log(`✅ Upload parallèle terminé: ${results.filter(r => r.success).length}/${results.length} réussis`);

            return {
                results,
                invalidFiles
            };

        } catch (generalError) {
            console.error('❌ Erreur générale upload parallèle:', generalError);
            setError(generalError.message);
            return { results: [], invalidFiles };
        } finally {
            setIsUploading(false);
        }
    }, [capabilities.isMobile, compressImage, uploadSingleFile]);

    const reset = React.useCallback(() => {
        setIsUploading(false);
        setUploadProgress({});
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

// Composant SignatureModal simplifié
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
                <canvas ref={modalCanvasRef} className="signature-canvas-fullscreen" />
                <div className="modal-footer">
                    <button type="button" onClick={handleClear} className="btn btn-secondary">
                        Effacer
                    </button>
                    <button type="button" onClick={onCancel} className="btn btn-secondary">
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveSignature}
                        className="btn btn-primary"
                        disabled={!isDrawing && !existingSignature}
                    >
                        Valider la Signature
                    </button>
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

    // Hook mobile optimisé
    const {
        handleFileUpload,
        capabilities,
        isUploading,
        uploadProgress,
        error: uploadError,
        reset: resetUpload,
        isOnline
    } = useMobileUpload(interventionId);

    // État pour gérer la queue d'upload
    const [uploadQueue, setUploadQueue] = useState([]);
    const [fileListKey, setFileListKey] = useState(0);

    // ✅ CHARGEMENT OPTIMISÉ
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
                    const parsedReport = JSON.parse(savedReport);
                    setReport(parsedReport);
                } catch (e) {
                    setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null });
                }
            } else {
                setReport(intervention.report || { notes: '', files: [], arrivalTime: null, departureTime: null, signature: null });
            }
        }
    }, [intervention, storageKey]);

    useEffect(() => {
        if (report && intervention) {
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(report));
                setFileListKey(prev => prev + 1);
            } catch (error) {
                console.error("Failed to save report to sessionStorage", error);
            }
        }
    }, [report, storageKey, intervention]);

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

    // Sauvegarde silencieuse
    const saveReportSilently = async (updatedReport) => {
        try {
            const result = await onSaveSilent(interventionId, updatedReport);
            if (!result.success) {
                throw result.error;
            }
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
            return false;
        }
    };

    // ✅ GESTIONNAIRE D'UPLOAD PARALLÈLE OPTIMISÉ
    const handleFileSelect = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !intervention) return;

        resetUpload();

        try {
            console.log(`🚀 Début de l'upload parallèle de ${files.length} fichier(s)`);

            // Créer la queue immédiatement
            const newQueueItems = Array.from(files).map((file, index) => ({
                id: `${file.name}-${file.lastModified}-${index}`,
                name: file.name,
                size: file.size,
                status: 'pending',
                error: null,
                progress: 0
            }));

            setUploadQueue(newQueueItems);

            // Lancer l'upload parallèle
            const uploadResults = await handleFileUpload(files);

            // Traiter les résultats
            const successfulUploads = [];

            uploadResults.results.forEach(result => {
                const queueId = result.fileId;

                // Mettre à jour la queue
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

                if (result.success && result.result && result.result.publicURL) {
                    const newFileInfo = {
                        name: result.file.name,
                        url: result.result.publicURL,
                        type: result.file.type
                    };
                    successfulUploads.push(newFileInfo);
                }
            });

            // Mise à jour du rapport si des uploads ont réussi
            if (successfulUploads.length > 0) {
                const updatedReport = {
                    ...report,
                    files: [...(report.files || []), ...successfulUploads]
                };

                setReport(updatedReport);

                // Sauvegarde silencieuse en arrière-plan
                saveReportSilently(updatedReport);

                setFileListKey(prev => prev + 1);

                console.log(`✅ ${successfulUploads.length} fichier(s) ajouté(s) avec succès`);
            }

            // Reset de l'input
            event.target.value = '';

        } catch (error) {
            console.error('❌ Erreur upload parallèle:', error);
            setUploadQueue(prev => prev.map(item => ({
                ...item,
                status: 'error',
                error: error.message || 'Erreur inconnue'
            })));
        }
    };

    const handleRemoveFromQueue = (idToRemove) => {
        setUploadQueue(prev => prev.filter(item => item.id !== idToRemove));
    };

    const handleSave = async () => {
        if (!intervention) return;

        setIsSaving(true);
        try {
            const finalReport = { ...report };
            window.sessionStorage.removeItem(storageKey);
            await onSave(intervention.id, finalReport);
        } catch (error) {
            console.error('❌ Erreur sauvegarde finale:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRefreshFiles = () => {
        setFileListKey(prev => prev + 1);
        if (intervention && intervention.report) {
            setReport(prev => ({
                ...prev,
                files: intervention.report.files || []
            }));
        }
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

    // ✅ Calcul du progrès global
    const globalProgress = React.useMemo(() => {
        const progressValues = Object.values(uploadProgress);
        if (progressValues.length === 0) return 0;

        const totalProgress = progressValues.reduce((sum, p) => sum + (p.progress || 0), 0);
        return Math.round(totalProgress / progressValues.length);
    }, [uploadProgress]);

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
                    cursor: pointer; transition: transform 0.2s ease;
                }
                .document-thumbnail:hover { transform: scale(1.1); }
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
                .icon-remove { color: #6c757d; }
                .refresh-button {
                    background: none; border: none; cursor: pointer; color: #007bff;
                    font-size: 0.875rem; text-decoration: underline; margin-left: 1rem;
                }

                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

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
                        📡 Mode hors-ligne
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
                            {report.arrivalTime ? '✅ Arrivé' : '🕐 Arrivée sur site'}
                        </button>
                        <button
                            onClick={() => handleReportChange('departureTime', new Date().toISOString())}
                            className="btn btn-danger"
                            disabled={!report.arrivalTime || !!report.departureTime || isAdmin}
                        >
                            {report.departureTime ? '✅ Parti' : '🚪 Départ du site'}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3>Photos et Documents du Rapport</h3>
                        <button onClick={handleRefreshFiles} className="refresh-button" disabled={isUploading}>
                            🔄 Actualiser
                        </button>
                    </div>

                    {capabilities.isMobile && (
                        <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginBottom: '0.5rem',
                            fontStyle: 'italic'
                        }}>
                            📱 Mode mobile - Upload parallèle optimisé
                            {capabilities.hasCamera && ' - Caméra disponible'}
                        </div>
                    )}

                    {/* Message d'info */}
                    {!isAdmin && (
                        <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#e0f7fa',
                            border: '1px solid #b2ebf2',
                            borderRadius: '0.375rem',
                            marginBottom: '1rem',
                            fontSize: '0.875rem',
                            color: '#00695c'
                        }}>
                            💡 Upload parallèle activé - Sélectionnez plusieurs fichiers simultanément !
                        </div>
                    )}

                    {/* Liste des fichiers optimisée */}
                    <ul key={fileListKey} className="document-list-detailed">
                        {(report.files || []).map((file, idx) => (
                            <li key={`${file.url}-${idx}-${fileListKey}`}>
                                {file.type && file.type.startsWith('image/') ? (
                                    <OptimizedImage
                                        src={file.url}
                                        alt={`Aperçu de ${file.name}`}
                                        className="document-thumbnail"
                                        style={{ width: 40, height: 40 }}
                                        onClick={() => window.open(file.url, '_blank')}
                                    />
                                ) : (
                                    <FileTextIcon className="document-icon" />
                                )}
                                <span>{file.name}</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                    Voir
                                </a>
                            </li>
                        ))}
                        {(report.files || []).length === 0 && (
                            <li style={{ fontStyle: 'italic', color: '#6b7280' }}>
                                Aucun fichier ajouté pour le moment
                            </li>
                        )}
                    </ul>

                    {/* Queue d'upload parallèle optimisée */}
                    {uploadQueue.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2">
                                Upload parallèle en cours
                                {isUploading && (
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                                        ({globalProgress}%)
                                    </span>
                                )}
                            </h4>

                            {/* Barre de progression globale */}
                            {isUploading && (
                                <div style={{
                                    width: '100%',
                                    height: '6px',
                                    backgroundColor: '#e5e7eb',
                                    borderRadius: '3px',
                                    marginBottom: '1rem',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${globalProgress}%`,
                                        height: '100%',
                                        backgroundColor: '#3b82f6',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '3px'
                                    }} />
                                </div>
                            )}

                            <ul className="upload-queue-list">
                                {uploadQueue.map((item) => {
                                    const fileProgress = uploadProgress[item.id];
                                    const status = fileProgress?.status || 'pending';
                                    const progress = fileProgress?.progress || 0;
                                    const error = fileProgress?.error;

                                    return (
                                        <li key={item.id}>
                                            {status === 'pending' && <LoaderIcon className="upload-status-icon loading" />}
                                            {status === 'preparing' && <LoaderIcon className="upload-status-icon loading" />}
                                            {status === 'compressing' && <LoaderIcon className="upload-status-icon loading" />}
                                            {status === 'uploading' && <LoaderIcon className="upload-status-icon loading" />}
                                            {status === 'completed' && <CheckCircleIcon className="upload-status-icon success" />}
                                            {status === 'error' && <AlertTriangleIcon className="upload-status-icon error" />}

                                            <div className="file-info-container">
                                                <span className="file-name">{item.name}</span>
                                                {item.size && (
                                                    <span style={{fontSize: '0.75rem', color: '#6b7280'}}>
                                                        {Math.round(item.size / 1024)}KB
                                                    </span>
                                                )}

                                                {/* États détaillés */}
                                                {status === 'preparing' && (
                                                    <span style={{fontSize: '0.75rem', color: '#3b82f6'}}>
                                                        Préparation...
                                                    </span>
                                                )}
                                                {status === 'compressing' && (
                                                    <span style={{fontSize: '0.75rem', color: '#3b82f6'}}>
                                                        Compression...
                                                    </span>
                                                )}
                                                {status === 'uploading' && (
                                                    <span style={{fontSize: '0.75rem', color: '#3b82f6'}}>
                                                        Upload... {progress}%
                                                    </span>
                                                )}
                                                {status === 'completed' && (
                                                    <span style={{fontSize: '0.75rem', color: '#16a34a'}}>
                                                        ✅ Terminé
                                                    </span>
                                                )}
                                                {error && <span className="error-message">{error}</span>}

                                                {/* Barre de progression individuelle */}
                                                {(status === 'uploading' || status === 'compressing') && progress > 0 && (
                                                    <div style={{
                                                        width: '100%',
                                                        height: '3px',
                                                        backgroundColor: '#e5e7eb',
                                                        borderRadius: '2px',
                                                        marginTop: '0.25rem',
                                                        overflow: 'hidden'
                                                    }}>
                                                        <div style={{
                                                            width: `${progress}%`,
                                                            height: '100%',
                                                            backgroundColor: '#3b82f6',
                                                            transition: 'width 0.3s ease'
                                                        }} />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="upload-actions">
                                                {status !== 'pending' && status !== 'uploading' && status !== 'compressing' && (
                                                    <button
                                                        onClick={() => handleRemoveFromQueue(item.id)}
                                                        title="Retirer"
                                                    >
                                                        <XCircleIcon className="icon icon-remove" />
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Input de fichiers optimisé */}
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
                                    Upload parallèle... ({globalProgress}%)
                                </>
                            ) : (
                                <>
                                    {capabilities.isMobile ?
                                        '📷 Sélectionner plusieurs photos/fichiers' :
                                        '📁 Sélectionner plusieurs fichiers (Photo/PDF)'
                                    }
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
                                Réinitialiser
                            </button>
                        </div>
                    )}

                    {/* Info de performance */}
                    {process.env.NODE_ENV === 'development' && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.5rem',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            color: '#6b7280'
                        }}>
                            🔧 Debug: {(report.files || []).length} fichier(s) |
                            Queue: {uploadQueue.length} |
                            Upload parallèle: {capabilities.isMobile ? '2 simultanés' : '4 simultanés'} |
                            Compression: {capabilities.isMobile ? 'Activée' : 'Standard'}
                        </div>
                    )}
                </div>

                <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? (
                        <OptimizedImage
                            src={report.signature}
                            alt="Signature client"
                            style={{
                                border: '1px solid #ccc',
                                borderRadius: '0.375rem',
                                maxWidth: '100%',
                                height: 'auto'
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
                                    disabled={isSaving}
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
                        disabled={isUploading || isSaving}
                        className="btn btn-primary w-full mt-4"
                        style={{
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            padding: '1rem',
                            position: 'relative'
                        }}
                    >
                        {isSaving ? (
                            <>
                                <LoaderIcon className="animate-spin" style={{ marginRight: '0.5rem' }} />
                                Sauvegarde en cours...
                            </>
                        ) : isUploading ? (
                            <>
                                <LoaderIcon className="animate-spin" style={{ marginRight: '0.5rem' }} />
                                Upload en cours ({globalProgress}%)...
                            </>
                        ) : (
                            '🔒 Sauvegarder et Clôturer l\'intervention'
                        )}
                    </button>
                )}

                {/* Barre de progression globale fixe */}
                {(isUploading || isSaving) && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        backgroundColor: '#e5e7eb',
                        zIndex: 9999
                    }}>
                        <div style={{
                            height: '100%',
                            backgroundColor: isSaving ? '#22c55e' : '#3b82f6',
                            width: isSaving ? '100%' : `${globalProgress}%`,
                            transition: 'width 0.3s ease',
                            animation: isSaving ? 'pulse 1s infinite' : 'none'
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
}