// src/pages/InterventionDetailView.js - Version optimisée mobile
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMobileFileManager, MobileOptimizedImage, UploadQueue } from '../hooks/useMobileFileManager';
import MobileFileInput from '../components/MobileFileInput';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, ExpandIcon, RefreshCwIcon } from '../components/SharedUI';

// ✅ COMPOSANT DE SIGNATURE OPTIMISÉ
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
    const modalCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    useEffect(() => {
        const canvas = modalCanvasRef.current;
        if (!canvas) return;

        // ✅ ADAPTATION MOBILE-FIRST
        const isMobile = window.innerWidth < 768;
        const rect = canvas.getBoundingClientRect();

        // Dimensions optimisées pour mobile
        canvas.width = isMobile ? window.innerWidth * 0.95 : Math.min(window.innerWidth * 0.8, 800);
        canvas.height = isMobile ? window.innerHeight * 0.5 : Math.min(window.innerHeight * 0.6, 400);

        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Chargement signature existante
        if (existingSignature) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = existingSignature;
        }

        let drawing = false;
        let lastPos = null;

        // ✅ FONCTION UNIFIÉE POUR OBTENIR LA POSITION
        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };

        // ✅ GESTION UNIFIÉE DU DÉBUT DE TRACÉ
        const startDrawing = (e) => {
            e.preventDefault();
            drawing = true;
            setIsDrawing(true);
            setHasInteracted(true);
            lastPos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
        };

        // ✅ GESTION UNIFIÉE DE LA FIN DE TRACÉ
        const stopDrawing = (e) => {
            e.preventDefault();
            drawing = false;
            lastPos = null;
        };

        // ✅ GESTION UNIFIÉE DU TRACÉ
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

        // ✅ ÉVÉNEMENTS SOURIS (DESKTOP)
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', stopDrawing);

        // ✅ ÉVÉNEMENTS TACTILES (MOBILE)
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchend', stopDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });

        // ✅ PRÉVENTION DU SCROLL SUR MOBILE
        const preventScroll = (e) => {
            if (e.target === canvas) {
                e.preventDefault();
            }
        };
        document.addEventListener('touchmove', preventScroll, { passive: false });

        return () => {
            // Nettoyage des événements
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchend', stopDrawing);
            canvas.removeEventListener('touchmove', draw);
            document.removeEventListener('touchmove', preventScroll);
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
            setHasInteracted(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 50,
            padding: '1rem'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                padding: '1rem',
                width: '100%',
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <h3 style={{ margin: 0, textAlign: 'center' }}>
                    Signature du client
                </h3>

                <div style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '200px'
                }}>
                    <canvas
                        ref={modalCanvasRef}
                        style={{
                            border: '2px dashed #cbd5e1',
                            borderRadius: '0.5rem',
                            backgroundColor: '#fafafa',
                            cursor: 'crosshair',
                            touchAction: 'none',
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                    />
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: window.innerWidth < 768 ? 'column' : 'row',
                    gap: '0.75rem',
                    justifyContent: 'center'
                }}>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="btn btn-secondary"
                        style={{ minWidth: '100px' }}
                    >
                        Effacer
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="btn btn-secondary"
                        style={{ minWidth: '100px' }}
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveSignature}
                        className="btn btn-primary"
                        disabled={!hasInteracted && !existingSignature}
                        style={{ minWidth: '100px' }}
                    >
                        Valider
                    </button>
                </div>
            </div>
        </div>
    );
};

// ✅ COMPOSANT PRINCIPAL OPTIMISÉ
export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [intervention, setIntervention] = useState(null);
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadErrors, setUploadErrors] = useState([]);

    // ✅ HOOK MOBILE OPTIMISÉ
    const {
        uploadState,
        handleFileUpload,
        displayState,
        preloadImage,
        deviceInfo,
        reset: resetUpload
    } = useMobileFileManager(interventionId);

    const storageKey = `srp-intervention-report-${interventionId}`;
    const signatureCanvasRef = useRef(null);

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

    // ✅ GESTION DU RAPPORT
    useEffect(() => {
        if (intervention) {
            const savedReport = window.sessionStorage.getItem(storageKey);
            if (savedReport) {
                try {
                    const parsedReport = JSON.parse(savedReport);
                    setReport(parsedReport);
                } catch (e) {
                    setReport(intervention.report || {
                        notes: '',
                        files: [],
                        arrivalTime: null,
                        departureTime: null,
                        signature: null
                    });
                }
            } else {
                setReport(intervention.report || {
                    notes: '',
                    files: [],
                    arrivalTime: null,
                    departureTime: null,
                    signature: null
                });
            }
        }
    }, [intervention, storageKey]);

    // ✅ SAUVEGARDE AUTO
    useEffect(() => {
        if (report && intervention) {
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(report));
            } catch (error) {
                console.error("Erreur sauvegarde sessionStorage:", error);
            }
        }
    }, [report, storageKey, intervention]);

    // ✅ PRÉCHARGEMENT DES IMAGES
    useEffect(() => {
        if (report?.files) {
            report.files.forEach(file => {
                if (file.type?.startsWith('image/')) {
                    preloadImage(file.url);
                }
            });
        }
    }, [report?.files, preloadImage]);

    // ✅ GESTION DES CHANGEMENTS DE RAPPORT
    const handleReportChange = (field, value) => {
        setReport(prev => ({ ...prev, [field]: value }));
    };

    // ✅ SAUVEGARDE SILENCIEUSE
    const saveReportSilently = async (updatedReport) => {
        try {
            const result = await onSaveSilent(interventionId, updatedReport);
            return result?.success || false;
        } catch (error) {
            console.error('❌ Erreur sauvegarde silencieuse:', error);
            return false;
        }
    };

    // ✅ GESTION UPLOAD OPTIMISÉE
    const handleFileSelect = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !intervention) return;

        setUploadErrors([]);
        resetUpload();

        try {
            await handleFileUpload(files, (successfulFiles, invalidFiles) => {
                // ✅ MISE À JOUR DU RAPPORT
                if (successfulFiles.length > 0) {
                    const updatedReport = {
                        ...report,
                        files: [...(report.files || []), ...successfulFiles]
                    };

                    setReport(updatedReport);
                    saveReportSilently(updatedReport);
                }

                // ✅ GESTION DES ERREURS
                if (invalidFiles.length > 0) {
                    const errorMessages = invalidFiles.map(item =>
                        `${item.file.name}: ${item.reason}`
                    );
                    setUploadErrors(errorMessages);
                }
            });

        } catch (error) {
            console.error('❌ Erreur upload:', error);
            setUploadErrors(['Erreur lors de l\'upload des fichiers']);
        }
    };

    // ✅ GESTION DES ERREURS D'UPLOAD
    const handleUploadError = (errors) => {
        setUploadErrors(errors);
    };

    // ✅ SUPPRESSION D'ÉLÉMENTS DE LA QUEUE
    const handleRemoveQueueItem = (itemId) => {
        // Cette fonction sera gérée par le hook useMobileFileManager
        console.log('Suppression item queue:', itemId);
    };

    // ✅ SAUVEGARDE FINALE
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

    // ✅ GESTION SIGNATURE
    const handleSaveSignatureFromModal = (signatureDataUrl) => {
        setReport(prev => ({ ...prev, signature: signatureDataUrl }));
        setShowSignatureModal(false);
    };

    const handleClearSignature = () => {
        if (signatureCanvasRef.current) {
            const canvas = signatureCanvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setReport(prev => ({ ...prev, signature: null }));
        }
    };

    // ✅ UTILITAIRES
    const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR') : 'N/A';
    const handleGoBack = () => navigate('/planning');

    // ✅ ÉTATS DE CHARGEMENT
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
            {/* ✅ MODAL SIGNATURE */}
            {showSignatureModal && (
                <SignatureModal
                    onSave={handleSaveSignatureFromModal}
                    onCancel={() => setShowSignatureModal(false)}
                    existingSignature={report.signature}
                />
            )}

            {/* ✅ STYLES CSS */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

                .mobile-file-input-container {
                    width: 100%;
                }

                .document-list-optimized {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .document-item-optimized {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background-color: #f8f9fa;
                    border-radius: 0.375rem;
                    border: 1px solid #dee2e6;
                    min-height: 60px;
                    transition: background-color 0.2s ease;
                }

                .document-item-optimized:hover {
                    background-color: #e9ecef;
                }

                .document-thumbnail-optimized {
                    width: 40px;
                    height: 40px;
                    object-fit: cover;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                    background-color: #e9ecef;
                }

                .document-thumbnail-optimized:hover {
                    transform: scale(1.1);
                }

                .signature-canvas-small {
                    border: 2px dashed #cbd5e1;
                    border-radius: 0.5rem;
                    width: 100%;
                    height: 150px;
                    background-color: #f8fafc;
                    touch-action: none;
                    cursor: crosshair;
                }

                .error-banner {
                    padding: 0.75rem;
                    background-color: #fee2e2;
                    border: 1px solid #fecaca;
                    border-radius: 0.375rem;
                    margin: 0.75rem 0;
                }

                .error-list {
                    list-style: none;
                    padding: 0;
                    margin: 0.5rem 0 0 0;
                }

                .error-item {
                    font-size: 0.875rem;
                    color: #b91c1c;
                    margin-bottom: 0.25rem;
                }

                @media (max-width: 768px) {
                    .document-item-optimized {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.5rem;
                    }

                    .document-thumbnail-optimized {
                        width: 32px;
                        height: 32px;
                    }

                    .signature-canvas-small {
                        height: 120px;
                    }
                }
            `}</style>

            {/* ✅ BOUTON RETOUR */}
            <button onClick={handleGoBack} className="back-button">
                <ChevronLeftIcon /> Retour
            </button>

            {/* ✅ CONTENU PRINCIPAL */}
            <div className="card-white">
                <h2>{intervention.client}</h2>
                <p className="text-muted">{intervention.service} - {intervention.address}</p>

                {/* ✅ INDICATEUR CONNEXION */}
                {!navigator.onLine && (
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        borderRadius: '0.375rem',
                        marginBottom: '1rem',
                        fontSize: '0.875rem',
                        color: '#856404'
                    }}>
                        📡 Mode hors-ligne - Les uploads seront synchronisés au retour de la connexion
                    </div>
                )}

                {/* ✅ INDICATEUR MOBILE */}
                {deviceInfo.isMobile && (
                    <div style={{
                        padding: '0.5rem',
                        backgroundColor: '#e0f7fa',
                        border: '1px solid #b2ebf2',
                        borderRadius: '0.375rem',
                        marginBottom: '1rem',
                        fontSize: '0.75rem',
                        color: '#00695c',
                        textAlign: 'center'
                    }}>
                        📱 Mode mobile optimisé
                        {deviceInfo.hasCamera && ' • Caméra disponible'}
                        {deviceInfo.isIOS && ' • iOS'}
                        {deviceInfo.isAndroid && ' • Android'}
                    </div>
                )}

                {/* ✅ DOCUMENTS DE PRÉPARATION */}
                <div className="section">
                    <h3>Documents de préparation</h3>
                    {(intervention.intervention_briefing_documents?.length > 0) ? (
                        <ul className="document-list-optimized">
                            {intervention.intervention_briefing_documents.map(doc => (
                                <li key={doc.id} className="document-item-optimized">
                                    <FileTextIcon style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                                    <span style={{ flex: 1 }}>{doc.file_name}</span>
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                        <DownloadIcon /> Voir
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted">Aucun document de préparation.</p>
                    )}
                </div>

                {/* ✅ POINTAGE */}
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

                {/* ✅ RAPPORT DE CHANTIER */}
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

                {/* ✅ PHOTOS ET DOCUMENTS */}
                <div className="section">
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem'
                    }}>
                        <h3 style={{ margin: 0 }}>Photos et Documents</h3>
                        <button
                            onClick={() => window.location.reload()}
                            className="refresh-button"
                            disabled={uploadState.isUploading}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#3b82f6',
                                fontSize: '0.875rem',
                                textDecoration: 'underline'
                            }}
                        >
                            <RefreshCwIcon style={{ width: '16px', height: '16px', marginRight: '0.25rem' }} />
                            Actualiser
                        </button>
                    </div>

                    {/* ✅ LISTE DES FICHIERS OPTIMISÉE */}
                    <ul className="document-list-optimized">
                        {(report.files || []).map((file, idx) => (
                            <li key={`${file.url}-${idx}`} className="document-item-optimized">
                                {file.type && file.type.startsWith('image/') ? (
                                    <MobileOptimizedImage
                                        src={file.url}
                                        alt={`Aperçu de ${file.name}`}
                                        className="document-thumbnail-optimized"
                                        style={{ width: 40, height: 40 }}
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
                                <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary"
                                    style={{ flexShrink: 0 }}
                                >
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

                    {/* ✅ QUEUE D'UPLOAD */}
                    <UploadQueue
                        uploadState={uploadState}
                        onRemoveItem={handleRemoveQueueItem}
                    />

                    {/* ✅ ERREURS D'UPLOAD */}
                    {uploadErrors.length > 0 && (
                        <div className="error-banner">
                            <strong>❌ Erreurs de validation :</strong>
                            <ul className="error-list">
                                {uploadErrors.map((error, index) => (
                                    <li key={index} className="error-item">• {error}</li>
                                ))}
                            </ul>
                            <button
                                onClick={() => setUploadErrors([])}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#b91c1c',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    marginTop: '0.5rem'
                                }}
                            >
                                Masquer
                            </button>
                        </div>
                    )}

                    {/* ✅ INPUT DE FICHIERS OPTIMISÉ MOBILE */}
                    {!isAdmin && (
                        <MobileFileInput
                            accept="image/*,application/pdf"
                            onChange={handleFileSelect}
                            onError={handleUploadError}
                            disabled={uploadState.isUploading}
                            multiple
                            maxFiles={10}
                            maxSize={deviceInfo.isMobile ? 8 * 1024 * 1024 : 10 * 1024 * 1024}
                            className="mt-4"
                        >
                            {uploadState.isUploading ? (
                                <>Upload en cours... ({uploadState.globalProgress}%)</>
                            ) : (
                                <>
                                    {deviceInfo.isMobile ?
                                        '📷 Prendre/Sélectionner plusieurs photos' :
                                        '📁 Sélectionner plusieurs fichiers'
                                    }
                                </>
                            )}
                        </MobileFileInput>
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
                            Queue: {uploadState.queue.length} |
                            Device: {deviceInfo.isMobile ? 'Mobile' : 'Desktop'} |
                            Caméra: {deviceInfo.hasCamera ? 'Oui' : 'Non'} |
                            WebP: {deviceInfo.supportsWebP ? 'Oui' : 'Non'}
                        </div>
                    )}
                </div>

                {/* ✅ SIGNATURE DU CLIENT */}
                <div className="section">
                    <h3>Signature du client</h3>
                    {isAdmin && report.signature ? (
                        <MobileOptimizedImage
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
                                className="signature-canvas-small"
                                width="300"
                                height="150"
                            />
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '0.75rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                <button
                                    onClick={handleClearSignature}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#6b7280',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    Effacer
                                </button>
                                <button
                                    onClick={() => setShowSignatureModal(true)}
                                    className="btn btn-secondary"
                                    disabled={isSaving}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    <ExpandIcon />
                                    {deviceInfo.isMobile ? 'Agrandir' : 'Signature plein écran'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ✅ BOUTON DE SAUVEGARDE FINAL */}
                {!isAdmin && (
                    <div style={{ marginTop: '2rem' }}>
                        <button
                            onClick={handleSave}
                            disabled={uploadState.isUploading || isSaving}
                            className="btn btn-primary w-full"
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
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid #ffffff',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        marginRight: '0.5rem'
                                    }} />
                                    Sauvegarde en cours...
                                </>
                            ) : uploadState.isUploading ? (
                                <>
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        border: '2px solid #ffffff',
                                        borderTop: '2px solid transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        marginRight: '0.5rem'
                                    }} />
                                    Upload en cours ({uploadState.globalProgress}%)...
                                </>
                            ) : (
                                <>
                                    🔒 Sauvegarder et Clôturer l'intervention
                                </>
                            )}
                        </button>

                        {/* ✅ INFORMATIONS CONTEXTUELLES */}
                        <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            textAlign: 'center',
                            marginTop: '0.75rem',
                            fontStyle: 'italic'
                        }}>
                            {uploadState.isUploading && 'Veuillez attendre la fin de l\'upload avant de sauvegarder'}
                            {!uploadState.isUploading && !isSaving && deviceInfo.isMobile && 'Sauvegarde optimisée mobile'}
                        </div>
                    </div>
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
                            width: isSaving ? '100%' : `${uploadState.globalProgress}%`,
                            transition: 'width 0.3s ease',
                            animation: isSaving ? 'pulse 1s infinite' : 'none'
                        }} />
                    </div>
                )}

                {/* ✅ OVERLAY DE CHARGEMENT POUR MOBILE */}
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
                        <div style={{
                            width: '20px',
                            height: '20px',
                            border: '2px solid #ffffff',
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            flexShrink: 0
                        }} />
                        <div style={{ flex: 1 }}>
                            {isSaving ?
                                'Sauvegarde finale en cours...' :
                                `Upload en cours... ${uploadState.globalProgress}%`
                            }
                            <div style={{
                                fontSize: '0.75rem',
                                opacity: 0.8,
                                marginTop: '0.25rem'
                            }}>
                                {uploadState.queue.length > 0 &&
                                    `${uploadState.queue.filter(q => q.status === 'completed').length}/${uploadState.queue.length} fichiers traités`
                                }
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}