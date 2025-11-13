// src/pages/MobileUploadPage.js
import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import MobileFileInput from '../components/MobileFileInput';
import { ChevronLeftIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon } from '../components/SharedUI';

// =================================================================================
// COMPOSANT PRINCIPAL DE LA PAGE D'UPLOAD
// =================================================================================
export default function MobileUploadPage({ interventions, onFilesUploaded }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const [uploadState, setUploadState] = useState({
        isUploading: false,
        queue: [],
        error: null
    });
    const [uploadComplete, setUploadComplete] = useState(false); // Pour afficher le message de succès

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const compressImage = useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            let objectUrl = null;

            // ✅ CORRECTION iOS/Android : Timeout pour éviter blocages sur Android ancien
            const timeoutId = setTimeout(() => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                console.warn('Timeout compression image, utilisation du fichier original');
                resolve(file);
            }, 30000); // 30 secondes max

            img.onload = () => {
                try {
                    const maxWidth = 1280;
                    const maxHeight = 720;
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        clearTimeout(timeoutId);
                        // ✅ CORRECTION : Nettoyage URL.createObjectURL pour éviter fuite mémoire
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file);
                    }, 'image/jpeg', 0.8);
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    console.error('Erreur compression:', error);
                    resolve(file);
                }
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                resolve(file);
            };

            objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
        });
    }, []);

    const handleFileSelect = useCallback(async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        const queueItems = files.map((file, index) => ({
            id: `${file.name}-${Date.now()}-${index}`,
            name: file.name,
            status: 'pending',
            progress: 0,
            error: null
        }));

        setUploadState({ isUploading: true, queue: queueItems, error: null });
        setUploadComplete(false);

        const successfulUploads = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const queueItem = queueItems[i];
            try {
                let fileToUpload = await compressImage(file);

                const result = await storageService.uploadInterventionFile(
                    fileToUpload,
                    interventionId,
                    'report',
                    (progress) => {
                        setUploadState(prev => ({
                            ...prev,
                            queue: prev.queue.map(item =>
                                item.id === queueItem.id ? { ...item, status: 'uploading', progress } : item
                            )
                        }));
                    }
                );

                if (result.error) throw result.error;

                successfulUploads.push({ name: file.name, url: result.publicURL, type: file.type });
                setUploadState(prev => ({
                    ...prev,
                    queue: prev.queue.map(item =>
                        item.id === queueItem.id ? { ...item, status: 'completed', progress: 100 } : item
                    )
                }));

            } catch (error) {
                setUploadState(prev => ({
                    ...prev,
                    queue: prev.queue.map(item =>
                        item.id === queueItem.id ? { ...item, status: 'error', error: error.message } : item
                    )
                }));
            }
        }

        // ✅ CORRECTION : Vérification que onFilesUploaded existe avant appel
        if (successfulUploads.length > 0 && onFilesUploaded) {
            try {
                await onFilesUploaded(interventionId, successfulUploads);
            } catch (error) {
                console.error('Erreur lors de la sauvegarde des fichiers:', error);
                setUploadState(prev => ({
                    ...prev,
                    error: 'Les fichiers ont été uploadés mais pas enregistrés dans la base de données'
                }));
            }
        }

        setUploadState(prev => ({...prev, isUploading: false}));
        setUploadComplete(true); // Affiche le message de succès

    }, [interventionId, compressImage, onFilesUploaded]);

    const handleUploadError = useCallback((errors) => {
        setUploadState(prev => ({ ...prev, error: errors.join(' • ') }));
    }, []);

    const intervention = interventions.find(i => i.id.toString() === interventionId);

    return (
        <div className="mobile-upload-page">
            <header className="mobile-upload-header">
                <button onClick={() => navigate(-1)} className="back-button">
                    <ChevronLeftIcon />
                </button>
                <h2>Ajouter des fichiers</h2>
                <div style={{width: 24}}></div>
            </header>

            <main className="mobile-upload-content">
                {intervention && (
                    <div className="intervention-info">
                        <h3>{intervention.client}</h3>
                        <p>{intervention.address}</p>
                    </div>
                )}

                {/* ✅ CORRECTION : Cache le bouton d'upload une fois terminé */}
                {!uploadComplete && (
                    <div className="upload-dropzone">
                        <MobileFileInput
                            onChange={handleFileSelect}
                            disabled={uploadState.isUploading}
                            multiple
                            accept="image/*,application/pdf"
                            maxFiles={10}
                            maxSize={isMobile ? 5 * 1024 * 1024 : 10 * 1024 * 1024}
                            onError={handleUploadError}
                        >
                            {uploadState.isUploading ? 'Envoi en cours...' : 'Appuyez pour choisir'}
                        </MobileFileInput>
                    </div>
                )}

                {uploadState.queue.length > 0 && (
                    <div className="upload-queue-container">
                        {uploadState.queue.map(item => (
                            <div key={item.id} className={`upload-queue-item status-${item.status}`}>
                                <div style={{width: '24px', flexShrink: 0}}>
                                    {item.status === 'pending' && <LoaderIcon className="animate-spin" />}
                                    {item.status === 'uploading' && <LoaderIcon className="animate-spin" />}
                                    {item.status === 'completed' && <CheckCircleIcon style={{ color: '#16a34a' }} />}
                                    {item.status === 'error' && <AlertTriangleIcon style={{ color: '#dc2626' }} />}
                                </div>
                                <div style={{flexGrow: 1, minWidth: 0}}>
                                    <div className="file-name">{item.name}</div>
                                    {item.status === 'uploading' && (
                                        <div className="upload-progress-bar">
                                            <div className="upload-progress-fill" style={{width: `${item.progress}%`}} />
                                        </div>
                                    )}
                                    {item.error && <div className="error-message">{item.error}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ✅ CORRECTION : Affiche un message de succès et un bouton de retour */}
                {uploadComplete && (
                    <div className="upload-complete-message">
                        <CheckCircleIcon style={{ color: '#16a34a', width: 48, height: 48 }} />
                        <h3>Terminé !</h3>
                        <p>Les fichiers ont été ajoutés à votre rapport.</p>
                        <button
                            onClick={() => navigate(`/planning/${interventionId}`)}
                            className="btn btn-primary w-full"
                        >
                            Retourner à l'intervention
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
