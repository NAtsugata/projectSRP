// src/pages/InterventionDetailView.js - VERSION CORRIGÉE ET FONCTIONNELLE
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon } from '../components/SharedUI';

// ✅ COMPOSANT D'IMAGE OPTIMISÉ MOBILE
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

        // ✅ LAZY LOADING avec Intersection Observer
        if ('IntersectionObserver' in window && imgRef.current) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            img.src = src;
                            observer.disconnect();
                        }
                    });
                },
                { rootMargin: '50px' }
            );

            observer.observe(imgRef.current);
            return () => observer.disconnect();
        } else {
            // Fallback pour navigateurs anciens
            img.src = src;
        }
    }, [src]);

    if (loading) {
        return (
            <div
                ref={imgRef}
                className={className}
                style={{
                    ...style,
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '0.25rem'
                }}
            >
                <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #e5e7eb',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
            </div>
        );
    }

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
            loading="lazy"
        />
    );
};

// ✅ COMPOSANT DE SIGNATURE OPTIMISÉ
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

// ✅ COMPOSANT PRINCIPAL CORRIGÉ
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

    // ✅ ÉTAT D'UPLOAD SIMPLIFIÉ ET FONCTIONNEL
    const [uploadState, setUploadState] = useState({
        isUploading: false,
        uploadQueue: [],
        uploadProgress: 0,
        uploadError: null
    });

    const [fileListKey, setFileListKey] = useState(0);

    // ✅ DÉTECTION DEVICE SIMPLE
    const deviceInfo = {
        isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices
    };

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

    // ✅ SAUVEGARDE SILENCIEUSE CORRIGÉE
    const saveReportSilently = async (updatedReport) => {
        try {
            const result = await onSaveSilent(interventionId, updatedReport);
            if (!result?.success) {
                throw result?.error || new Error('Sauvegarde silencieuse échouée');
            }
            return true;
        } catch (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
            return false;
        }
    };

    // ✅ COMPRESSION D'IMAGE SIMPLE ET EFFICACE
    const compressImage = async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // ✅ COMPRESSION ADAPTÉE AU MOBILE
                const maxWidth = deviceInfo.isMobile ? 1280 : 1920;
                const maxHeight = deviceInfo.isMobile ? 720 : 1080;
                let { width, height } = img;

                const ratio = Math.min(maxWidth / width, maxHeight / height);
                if (ratio < 1) {
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const quality = deviceInfo.isMobile ? 0.7 : 0.8;
                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        console.log(`✅ Image compressée: ${Math.round(file.size/1024)}KB → ${Math.round(blob.size/1024)}KB`);
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            };

            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    };

    // ✅ GESTIONNAIRE D'UPLOAD CORRIGÉ ET FONCTIONNEL
    const handleFileSelect = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !intervention) return;

        console.log(`🚀 Début upload de ${files.length} fichier(s)`);

        setUploadState({
            isUploading: true,
            uploadQueue: Array.from(files).map((file, index) => ({
                id: `${file.name}-${index}`,
                name: file.name,
                size: file.size,
                status: 'pending',
                progress: 0,
                error: null
            })),
            uploadProgress: 0,
            uploadError: null
        });

        try {
            // ✅ VALIDATION DES FICHIERS
            const validFiles = [];
            const invalidFiles = [];

            for (const file of Array.from(files)) {
                const maxSize = 10 * 1024 * 1024; // 10MB
                const allowedTypes = ['image/', 'application/pdf'];

                if (file.size <= maxSize && allowedTypes.some(type => file.type.startsWith(type))) {
                    validFiles.push(file);
                } else {
                    invalidFiles.push({ file, reason: file.size > maxSize ? 'Trop volumineux' : 'Type non supporté' });
                }
            }

            if (invalidFiles.length > 0) {
                console.warn('❌ Fichiers rejetés:', invalidFiles);
                setUploadState(prev => ({
                    ...prev,
                    uploadError: `${invalidFiles.length} fichier(s) rejeté(s): ${invalidFiles.map(f => f.reason).join(', ')}`
                }));
            }

            console.log(`✅ ${validFiles.length} fichier(s) valide(s) à traiter`);

            // ✅ TRAITEMENT SÉQUENTIEL FIABLE
            const successfulUploads = [];
            let processedCount = 0;

            for (const file of validFiles) {
                const fileIndex = processedCount;

                try {
                    // Mise à jour de l'état: compression
                    setUploadState(prev => ({
                        ...prev,
                        uploadQueue: prev.uploadQueue.map((item, i) =>
                            i === fileIndex ? { ...item, status: 'compressing', progress: 10 } : item
                        ),
                        uploadProgress: Math.round((processedCount / validFiles.length) * 100)
                    }));

                    // ✅ COMPRESSION
                    let fileToUpload = file;
                    if (file.type.startsWith('image/')) {
                        fileToUpload = await compressImage(file);
                    }

                    // Mise à jour de l'état: upload
                    setUploadState(prev => ({
                        ...prev,
                        uploadQueue: prev.uploadQueue.map((item, i) =>
                            i === fileIndex ? { ...item, status: 'uploading', progress: 50 } : item
                        )
                    }));

                    // ✅ UPLOAD
                    const result = await storageService.uploadInterventionFile(
                        fileToUpload,
                        interventionId,
                        'report'
                    );

                    if (result.error) {
                        throw result.error;
                    }

                    // ✅ SUCCÈS
                    const newFileInfo = {
                        name: file.name,
                        url: result.publicURL,
                        type: file.type
                    };
                    successfulUploads.push(newFileInfo);

                    // Mise à jour de l'état: terminé
                    setUploadState(prev => ({
                        ...prev,
                        uploadQueue: prev.uploadQueue.map((item, i) =>
                            i === fileIndex ? { ...item, status: 'completed', progress: 100 } : item
                        )
                    }));

                    console.log(`✅ Fichier ${fileIndex + 1}/${validFiles.length} uploadé: ${file.name}`);

                } catch (error) {
                    console.error(`❌ Erreur upload ${file.name}:`, error);

                    // Mise à jour de l'état: erreur
                    setUploadState(prev => ({
                        ...prev,
                        uploadQueue: prev.uploadQueue.map((item, i) =>
                            i === fileIndex ? { ...item, status: 'error', progress: 0, error: error.message } : item
                        )
                    }));
                }

                processedCount++;

                // Mise à jour du progrès global
                setUploadState(prev => ({
                    ...prev,
                    uploadProgress: Math.round((processedCount / validFiles.length) * 100)
                }));
            }

            // ✅ FINALISATION
            if (successfulUploads.length > 0) {
                const updatedReport = {
                    ...report,
                    files: [...(report.files || []), ...successfulUploads]
                };

                setReport(updatedReport);

                // Sauvegarde silencieuse en arrière-plan
                saveReportSilently(updatedReport);

                setFileListKey(prev => prev + 1);

                console.log(`🎉 Upload terminé: ${successfulUploads.length}/${validFiles.length} fichier(s) réussi(s)`);
            }

            // ✅ NETTOYAGE
            setTimeout(() => {
                setUploadState(prev => ({
                    ...prev,
                    isUploading: false
                }));
            }, 1000);

            // Reset de l'input
            event.target.value = '';

        } catch (error) {
            console.error('❌ Erreur générale upload:', error);
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                uploadError: `Erreur générale: ${error.message}`
            }));
        }
    };

    const handleRemoveFromQueue = (idToRemove) => {
        setUploadState(prev => ({
            ...prev,
            uploadQueue: prev.uploadQueue.filter(item => item.id !== idToRemove)
        }));
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
                @keyframes spin { to { transform: rotate(360deg); } }

                .document-list-optimized {
                    list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem;
                }

                .document-item-optimized {
                    display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem;
                    background-color: #f8f9fa; border-radius: 0.375rem; border: 1px solid #dee2e6; min-height: 60px;
                }

                .upload-queue-container {
                    margin-top: 1rem; padding: 1rem; background-color: #f8f9fa; border-radius: 0.5rem;
                }

                .upload-queue-item {
                    display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem;
                    margin-bottom: 0.5rem; background-color: white; border-radius: 0.25rem;
                }

                .upload-progress-bar {
                    width: 100%; height: 4px; background-color: #e5e7eb; border-radius: 2px; overflow: hidden;
                }

                .upload-progress-fill {
                    height: 100%; background-color: #3b82f6; transition: width 0.3s ease;
                }

                @media (max-width: 768px) {
                    .document-item-optimized { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
                }
            `}</style>

            <button onClick={handleGoBack} className="back-button">
                <ChevronLeftIcon /> Retour
            </button>

            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                {/* ✅ INDICATEUR MOBILE */}
                {deviceInfo.isMobile && (
                    <div style={{
                        padding: '0.5rem',
                        backgroundColor: '#e0f7fa',
                        border: '1px solid #b2ebf2',
                        borderRadius: '0.375rem',
                        marginBottom: '1rem',
                        fontSize: '0.875rem',
                        color: '#00695c',
                        textAlign: 'center'
                    }}>
                        📱 Mode mobile optimisé
                        {deviceInfo.hasCamera && ' • 📷 Caméra disponible'}
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
                        style={{ fontSize: deviceInfo.isMobile ? '16px' : '14px' }}
                    />
                </div>

                <div className="section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3>Photos et Documents du Rapport</h3>
                        <button onClick={handleRefreshFiles} className="refresh-button" disabled={uploadState.isUploading}>
                            🔄 Actualiser
                        </button>
                    </div>

                    {/* ✅ LISTE DES FICHIERS */}
                    <ul key={fileListKey} className="document-list-optimized">
                        {(report.files || []).map((file, idx) => (
                            <li key={`${file.url}-${idx}-${fileListKey}`} className="document-item-optimized">
                                {file.type && file.type.startsWith('image/') ? (
                                    <OptimizedImage
                                        src={file.url}
                                        alt={`Aperçu de ${file.name}`}
                                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '0.25rem', cursor: 'pointer' }}
                                        onClick={() => window.open(file.url, '_blank')}
                                    />
                                ) : (
                                    <FileTextIcon style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                                )}
                                <span style={{
                                    flex: 1,
                                    fontSize: '0.9rem',
                                    wordBreak: 'break-word',
                                    lineHeight: '1.3'
                                }}>
                                    {file.name}
                                </span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                    Voir
                                </a>
                            </li>
                        ))}
                        {(report.files || []).length === 0 && (
                            <li style={{
                                fontStyle: 'italic',
                                color: '#6b7280',
                                textAlign: 'center',
                                padding: '1rem'
                            }}>
                                Aucun fichier ajouté pour le moment
                            </li>
                        )}
                    </ul>

                    {/* ✅ QUEUE D'UPLOAD AMÉLIORÉE */}
                    {uploadState.uploadQueue.length > 0 && (
                        <div className="upload-queue-container">
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '1rem'
                            }}>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                                    {uploadState.isUploading ? 'Upload en cours' : 'Upload terminé'}
                                </h4>
                                {uploadState.isUploading && (
                                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                        {uploadState.uploadProgress}%
                                    </span>
                                )}
                            </div>

                            {/* Barre de progression globale */}
                            {uploadState.isUploading && (
                                <div className="upload-progress-bar" style={{ marginBottom: '1rem' }}>
                                    <div
                                        className="upload-progress-fill"
                                        style={{ width: `${uploadState.uploadProgress}%` }}
                                    />
                                </div>
                            )}

                            {/* Liste des fichiers en cours d'upload */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {uploadState.uploadQueue.map((item, index) => (
                                    <div key={item.id} className="upload-queue-item">
                                        {/* Icône de statut */}
                                        <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                                            {item.status === 'pending' && '⏳'}
                                            {item.status === 'compressing' && (
                                                <LoaderIcon style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                                            )}
                                            {item.status === 'uploading' && (
                                                <LoaderIcon style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                                            )}
                                            {item.status === 'completed' && <CheckCircleIcon style={{ width: '20px', height: '20px', color: '#22c55e' }} />}
                                            {item.status === 'error' && <AlertTriangleIcon style={{ width: '20px', height: '20px', color: '#ef4444' }} />}
                                        </div>

                                        {/* Info fichier */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {item.name}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: '#6b7280',
                                                marginTop: '0.25rem'
                                            }}>
                                                {Math.round(item.size / 1024)}KB
                                                {item.status === 'compressing' && ' • Compression...'}
                                                {item.status === 'uploading' && ` • Upload... ${item.progress}%`}
                                                {item.status === 'completed' && ' • ✅ Terminé'}
                                                {item.error && ` • ❌ ${item.error}`}
                                            </div>

                                            {/* Barre de progression individuelle */}
                                            {(item.status === 'uploading' || item.status === 'compressing') && item.progress > 0 && (
                                                <div style={{
                                                    width: '100%',
                                                    height: '3px',
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

                                        {/* Bouton de suppression */}
                                        {!uploadState.isUploading && (
                                            <button
                                                onClick={() => handleRemoveFromQueue(item.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem',
                                                    color: '#6b7280',
                                                    fontSize: '1.25rem'
                                                }}
                                            >
                                                <XCircleIcon style={{ width: '16px', height: '16px' }} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ✅ MESSAGE D'ERREUR D'UPLOAD */}
                    {uploadState.uploadError && (
                        <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '0.375rem',
                            marginTop: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#b91c1c'
                        }}>
                            ❌ {uploadState.uploadError}
                            <button
                                onClick={() => setUploadState(prev => ({ ...prev, uploadError: null }))}
                                style={{
                                    marginLeft: '0.5rem',
                                    background: 'none',
                                    border: 'none',
                                    color: '#b91c1c',
                                    textDecoration: 'underline',
                                    cursor: 'pointer'
                                }}
                            >
                                Masquer
                            </button>
                        </div>
                    )}

                    {/* ✅ INPUT DE FICHIERS OPTIMISÉ */}
                    {!isAdmin && (
                        <CustomFileInput
                            accept="image/*,application/pdf"
                            onChange={handleFileSelect}
                            disabled={uploadState.isUploading}
                            multiple
                            className="mt-4"
                        >
                            {uploadState.isUploading ? (
                                <>
                                    <LoaderIcon style={{ animation: 'spin 1s linear infinite' }} />
                                    Upload en cours... ({uploadState.uploadProgress}%)
                                </>
                            ) : (
                                <>
                                    {deviceInfo.isMobile ?
                                        '📷 Prendre/Sélectionner plusieurs photos' :
                                        '📁 Sélectionner plusieurs fichiers (Photo/PDF)'
                                    }
                                </>
                            )}
                        </CustomFileInput>
                    )}

                    {/* ✅ INFORMATIONS DE DEBUG (DEV UNIQUEMENT) */}
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
                            Queue: {uploadState.uploadQueue.length} |
                            Device: {deviceInfo.isMobile ? 'Mobile' : 'Desktop'} |
                            Caméra: {deviceInfo.hasCamera ? 'Oui' : 'Non'} |
                            Upload: {uploadState.isUploading ? 'En cours' : 'Arrêté'}
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
                                height: 'auto',
                                minHeight: '150px'
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
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '0.75rem'
                            }}>
                                <button onClick={handleClearSignature} className="text-muted-link">
                                    Effacer
                                </button>
                                <button
                                    onClick={() => setShowSignatureModal(true)}
                                    className="btn btn-secondary"
                                    disabled={isSaving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <ExpandIcon /> Agrandir
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ✅ BOUTON DE SAUVEGARDE FINAL */}
                {!isAdmin && (
                    <button
                        onClick={handleSave}
                        disabled={uploadState.isUploading || isSaving}
                        className="btn btn-primary w-full mt-4"
                        style={{
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            padding: '1rem',
                            position: 'relative',
                            minHeight: '56px'
                        }}
                    >
                        {isSaving ? (
                            <>
                                <LoaderIcon style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
                                Sauvegarde en cours...
                            </>
                        ) : uploadState.isUploading ? (
                            <>
                                <LoaderIcon style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
                                Upload en cours ({uploadState.uploadProgress}%)...
                            </>
                        ) : (
                            '🔒 Sauvegarder et Clôturer l\'intervention'
                        )}
                    </button>
                )}

                {/* ✅ BARRE DE PROGRESSION GLOBALE FIXE */}
                {(uploadState.isUploading || isSaving) && (
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
                            width: isSaving ? '100%' : `${uploadState.uploadProgress}%`,
                            transition: 'width 0.3s ease',
                            animation: isSaving ? 'pulse 1s infinite' : 'none'
                        }} />
                    </div>
                )}

                {/* ✅ OVERLAY DE CHARGEMENT MOBILE */}
                {(uploadState.isUploading || isSaving) && deviceInfo.isMobile && (
                    <div style={{
                        position: 'fixed',
                        bottom: '1rem',
                        left: '1rem',
                        right: '1rem',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        zIndex: 9998,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.875rem'
                    }}>
                        <LoaderIcon style={{
                            width: '20px',
                            height: '20px',
                            animation: 'spin 1s linear infinite',
                            flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                            {isSaving ?
                                'Sauvegarde finale en cours...' :
                                `Upload en cours... ${uploadState.uploadProgress}%`
                            }
                            <div style={{
                                fontSize: '0.75rem',
                                opacity: 0.8,
                                marginTop: '0.25rem'
                            }}>
                                {uploadState.uploadQueue.length > 0 &&
                                    `${uploadState.uploadQueue.filter(q => q.status === 'completed').length}/${uploadState.uploadQueue.length} fichiers traités`
                                }
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}