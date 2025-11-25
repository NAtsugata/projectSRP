// src/pages/MobileUploadPage.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storageService } from '../lib/supabase';
import MobileFileInput from '../components/MobileFileInput';
import { ChevronLeftIcon, CheckCircleIcon, AlertTriangleIcon, LoaderIcon, AlertCircleIcon } from '../components/SharedUI';
import { useMobileNotifications, MobileNotificationContainer } from '../components/mobile/MobileNotifications';
import '../components/mobile/MobileNotifications.css';

// ✅ LOGS DÉTAILLÉS pour diagnostic
const logUpload = (message, data = {}) => {
    const timestamp = new Date().toISOString();
    const userAgent = navigator.userAgent;
    console.log(`[UPLOAD ${timestamp}] ${message}`, {
        ...data,
        userAgent,
        online: navigator.onLine,
    });
};

export default function MobileUploadPage({ interventions, onFilesUploaded }) {
    const { interventionId } = useParams();
    const navigate = useNavigate();
    const notifications = useMobileNotifications();

    // État principal
    const [uploadState, setUploadState] = useState({
        isUploading: false,
        queue: [], // { id, file, name, status: 'pending'|'compressing'|'uploading'|'completed'|'error', progress, error, url }
        error: null
    });
    const [uploadComplete, setUploadComplete] = useState(false);

    // Ref pour éviter les doubles exécutions si le useEffect se déclenche trop vite
    const processingRef = useRef(null);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // 1. Fonction de compression optimisée (inchangée)
    const compressImage = useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        if (window.createImageBitmap) {
            try {
                const maxWidth = 1024;
                const maxHeight = 1024;
                const bitmap = await createImageBitmap(file);
                let { width, height } = bitmap;
                let newWidth = width;
                let newHeight = height;

                if (width > height) {
                    if (width > maxWidth) {
                        newHeight = Math.round(height * (maxWidth / width));
                        newWidth = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        newWidth = Math.round(width * (maxHeight / height));
                        newHeight = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
                bitmap.close();

                return new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file);
                    }, 'image/jpeg', 0.7);
                });
            } catch (e) {
                console.warn('Erreur createImageBitmap, fallback legacy:', e);
            }
        }

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            let objectUrl = null;
            const timeoutId = setTimeout(() => {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                resolve(file);
            }, 10000);

            img.onload = () => {
                try {
                    const maxWidth = 1024;
                    const maxHeight = 1024;
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
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file);
                    }, 'image/jpeg', 0.7);
                } catch (error) {
                    clearTimeout(timeoutId);
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
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

    // 2. Traitement d'un item individuel
    const processItem = useCallback(async (item) => {
        if (processingRef.current === item.id) return; // Déjà en cours
        processingRef.current = item.id;

        logUpload(`🔄 Début traitement item ${item.name}`);

        try {
            // Étape 1: Compression
            setUploadState(prev => ({
                ...prev,
                queue: prev.queue.map(i => i.id === item.id ? { ...i, status: 'compressing', progress: 10 } : i)
            }));

            // Petit délai UI
            await new Promise(r => setTimeout(r, 100));

            const fileToUpload = await compressImage(item.file);

            // Étape 2: Upload
            setUploadState(prev => ({
                ...prev,
                queue: prev.queue.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: 30 } : i)
            }));

            const result = await storageService.uploadInterventionFile(
                fileToUpload,
                interventionId,
                'report',
                (progress) => {
                    const visualProgress = 30 + Math.round(progress * 0.7);
                    setUploadState(prev => ({
                        ...prev,
                        queue: prev.queue.map(i => i.id === item.id ? { ...i, status: 'uploading', progress: visualProgress } : i)
                    }));
                }
            );

            if (result.error) throw result.error;

            // Étape 3: Succès
            setUploadState(prev => ({
                ...prev,
                queue: prev.queue.map(i => i.id === item.id ? { ...i, status: 'completed', progress: 100, url: result.publicURL, type: item.file.type } : i)
            }));
            logUpload(`✅ Item terminé ${item.name}`);

        } catch (error) {
            console.error(error);
            setUploadState(prev => ({
                ...prev,
                queue: prev.queue.map(i => i.id === item.id ? { ...i, status: 'error', error: error.message } : i)
            }));
            notifications.error(`Erreur: ${item.name}`);
        } finally {
            processingRef.current = null;
        }
    }, [interventionId, compressImage, notifications]);

    // 3. Boucle réactive (Queue Processor)
    useEffect(() => {
        if (!uploadState.isUploading) return;

        // Vérifie si un item est déjà en cours de traitement
        const activeItem = uploadState.queue.find(i => ['compressing', 'uploading'].includes(i.status));
        if (activeItem) return;

        // Trouve le prochain item en attente
        const nextItem = uploadState.queue.find(i => i.status === 'pending');

        if (nextItem) {
            // Lance le traitement du prochain item
            processItem(nextItem);
        } else {
            // Plus rien en attente, on termine
            finishUploadSession();
        }
    }, [uploadState.queue, uploadState.isUploading, processItem]);

    // 4. Finalisation
    const finishUploadSession = async () => {
        setUploadState(prev => ({ ...prev, isUploading: false }));
        setUploadComplete(true);

        const completedItems = uploadState.queue.filter(i => i.status === 'completed');
        const failedItems = uploadState.queue.filter(i => i.status === 'error');

        if (completedItems.length > 0 && onFilesUploaded) {
            try {
                const filesData = completedItems.map(i => ({
                    name: i.name,
                    url: i.url,
                    type: i.type
                }));
                await onFilesUploaded(interventionId, filesData);
                notifications.success(`${completedItems.length} fichiers envoyés avec succès !`);
            } catch (err) {
                notifications.error("Erreur lors de l'enregistrement final");
            }
        }

        if (failedItems.length > 0) {
            notifications.warning(`${failedItems.length} fichiers n'ont pas pu être envoyés.`);
        }
    };

    // 5. Sélection des fichiers (Juste ajout à la queue)
    const handleFileSelect = useCallback((event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        logUpload(`📁 Sélection de ${files.length} fichiers`);

        const newQueueItems = files.map((file, index) => ({
            id: `${file.name}-${Date.now()}-${index}`,
            file: file, // On garde la référence du fichier
            name: file.name,
            status: 'pending',
            progress: 0,
            error: null
        }));

        setUploadState(prev => ({
            isUploading: true, // Déclenche le useEffect
            queue: [...prev.queue, ...newQueueItems],
            error: null
        }));

        setUploadComplete(false);
        notifications.info(`${files.length} fichiers ajoutés à la file d'attente`);

    }, [notifications]);

    const handleUploadError = useCallback((errors) => {
        notifications.error(errors[0]);
    }, [notifications]);

    const intervention = interventions.find(i => i.id.toString() === interventionId);

    return (
        <div className="mobile-upload-page">
            <header className="mobile-upload-header">
                <button onClick={() => navigate(-1)} className="back-button">
                    <ChevronLeftIcon />
                </button>
                <h2>Ajouter des fichiers</h2>
                <button onClick={() => navigate('/mobile-diagnostics')} className="diagnostic-btn">
                    <AlertCircleIcon />
                </button>
            </header>

            <main className="mobile-upload-content">
                {intervention && (
                    <div className="intervention-info">
                        <h3>{intervention.client}</h3>
                        <p>{intervention.address}</p>
                    </div>
                )}

                {!uploadComplete && (
                    <div className="upload-dropzone">
                        <MobileFileInput
                            onChange={handleFileSelect}
                            disabled={uploadState.isUploading}
                            multiple
                            accept="image/*,application/pdf"
                            maxFiles={10}
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
                                <div className="status-icon">
                                    {item.status === 'pending' && <span className="icon-pending">⏳</span>}
                                    {(item.status === 'compressing' || item.status === 'uploading') && <LoaderIcon className="animate-spin" />}
                                    {item.status === 'completed' && <CheckCircleIcon style={{ color: '#16a34a' }} />}
                                    {item.status === 'error' && <AlertTriangleIcon style={{ color: '#dc2626' }} />}
                                </div>
                                <div className="file-info">
                                    <div className="file-name">{item.name}</div>
                                    <div className="file-status-text">
                                        {item.status === 'pending' && 'En attente...'}
                                        {item.status === 'compressing' && 'Compression...'}
                                        {item.status === 'uploading' && `Envoi ${item.progress}%`}
                                        {item.status === 'completed' && 'Terminé'}
                                        {item.status === 'error' && item.error}
                                    </div>
                                    {(item.status === 'uploading' || item.status === 'compressing') && (
                                        <div className="upload-progress-bar">
                                            <div className="upload-progress-fill" style={{ width: `${item.progress}%` }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {uploadComplete && (
                    <div className="upload-complete-message">
                        <CheckCircleIcon style={{ color: '#16a34a', width: 48, height: 48 }} />
                        <h3>Terminé !</h3>
                        <p>Les fichiers ont été ajoutés.</p>
                        <button onClick={() => navigate(`/planning/${interventionId}`)} className="btn btn-primary w-full">
                            Retourner à l'intervention
                        </button>
                    </div>
                )}
            </main>

            <MobileNotificationContainer
                notifications={notifications.notifications}
                onDismiss={notifications.removeNotification}
            />
        </div>
    );
}
