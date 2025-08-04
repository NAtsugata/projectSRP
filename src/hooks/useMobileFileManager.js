// src/hooks/useMobileFileManager.js - Hook optimisé pour la gestion des fichiers mobile
import { useState, useCallback, useEffect, useRef } from 'react';
import { storageService } from '../lib/supabase';

// ✅ HOOK PRINCIPAL - Gestion optimisée des fichiers mobile
export const useMobileFileManager = (interventionId) => {
    const [uploadState, setUploadState] = useState({
        isUploading: false,
        queue: [],
        completed: [],
        errors: [],
        globalProgress: 0
    });

    const [displayState, setDisplayState] = useState({
        loadedImages: new Set(),
        imageLoadErrors: new Set(),
        isRefreshing: false
    });

    // Référence pour éviter les fuites mémoire
    const abortController = useRef(null);
    const imageCache = useRef(new Map());

    // ✅ DÉTECTION DEVICE OPTIMISÉE
    const deviceInfo = useRef({
        isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        supportsWebP: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0,
        connectionType: navigator.connection?.effectiveType || '4g',
        memoryLimit: navigator.deviceMemory || 4
    }).current;

    // ✅ COMPRESSION ADAPTATIVE selon le device
    const compressFile = useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // ✅ COMPRESSION ADAPTATIVE selon le device et la connexion
                let maxWidth, maxHeight, quality;

                if (deviceInfo.isMobile) {
                    // Mobile : compression plus agressive
                    maxWidth = deviceInfo.connectionType === '2g' ? 800 : 1280;
                    maxHeight = deviceInfo.connectionType === '2g' ? 600 : 720;
                    quality = deviceInfo.connectionType === '2g' ? 0.5 : 0.7;
                } else {
                    // Desktop : compression standard
                    maxWidth = 1920;
                    maxHeight = 1080;
                    quality = 0.8;
                }

                let { width, height } = img;
                const ratio = Math.min(maxWidth / width, maxHeight / height);

                if (ratio < 1) {
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                // ✅ OPTIMISATION RENDU
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = deviceInfo.memoryLimit >= 4 ? 'high' : 'medium';
                ctx.drawImage(img, 0, 0, width, height);

                // ✅ FORMAT ADAPTATIF
                const outputFormat = deviceInfo.supportsWebP ? 'image/webp' : 'image/jpeg';

                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, `.${outputFormat.split('/')[1]}`), {
                            type: outputFormat,
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, outputFormat, quality);
            };

            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }, [deviceInfo]);

    // ✅ UPLOAD AVEC RETRY ET PROGRESSION DÉTAILLÉE
    const uploadSingleFile = useCallback(async (file, fileId, onProgress) => {
        const maxRetries = deviceInfo.connectionType === '2g' ? 3 : 2;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                attempt++;

                // Simulation de progression pour l'UX
                onProgress(fileId, 'uploading', attempt * 20);

                const result = await storageService.uploadInterventionFile(
                    file,
                    interventionId,
                    'report'
                );

                if (result.error) throw result.error;

                onProgress(fileId, 'completed', 100);
                return result;

            } catch (error) {
                if (attempt >= maxRetries) {
                    onProgress(fileId, 'error', 0, error.message);
                    throw error;
                }

                // Backoff exponentiel adaptatif
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }, [interventionId, deviceInfo]);

    // ✅ GESTIONNAIRE D'UPLOAD PRINCIPAL
    const handleFileUpload = useCallback(async (files, onComplete) => {
        if (!files?.length) return;

        // Annuler tout upload en cours
        if (abortController.current) {
            abortController.current.abort();
        }
        abortController.current = new AbortController();

        setUploadState(prev => ({
            ...prev,
            isUploading: true,
            queue: [],
            completed: [],
            errors: [],
            globalProgress: 0
        }));

        try {
            // ✅ VALIDATION ET PRÉPARATION
            const validFiles = [];
            const invalidFiles = [];

            for (const file of Array.from(files)) {
                const maxSize = deviceInfo.connectionType === '2g' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

                if (file.size <= maxSize && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
                    validFiles.push(file);
                } else {
                    invalidFiles.push({ file, reason: file.size > maxSize ? 'Fichier trop volumineux' : 'Type non supporté' });
                }
            }

            // ✅ INITIALISATION DE LA QUEUE
            const queueItems = validFiles.map((file, index) => ({
                id: `${file.name}-${file.lastModified}-${index}`,
                name: file.name,
                size: file.size,
                type: file.type,
                status: 'pending',
                progress: 0,
                error: null
            }));

            setUploadState(prev => ({
                ...prev,
                queue: queueItems
            }));

            // ✅ TRAITEMENT AVEC LIMITATION DE CONCURRENCE
            const concurrentUploads = deviceInfo.isMobile ?
                (deviceInfo.connectionType === '2g' ? 1 : 2) : 3;

            const results = [];
            const updateProgress = (fileId, status, progress, error = null) => {
                setUploadState(prev => {
                    const updatedQueue = prev.queue.map(item =>
                        item.id === fileId ? { ...item, status, progress, error } : item
                    );

                    const globalProgress = Math.round(
                        updatedQueue.reduce((sum, item) => sum + item.progress, 0) / updatedQueue.length
                    );

                    return {
                        ...prev,
                        queue: updatedQueue,
                        globalProgress
                    };
                });
            };

            // ✅ TRAITEMENT PAR LOTS
            for (let i = 0; i < validFiles.length; i += concurrentUploads) {
                const batch = validFiles.slice(i, i + concurrentUploads);
                const batchPromises = batch.map(async (file, batchIndex) => {
                    const fileId = queueItems[i + batchIndex].id;

                    try {
                        // Compression
                        updateProgress(fileId, 'compressing', 10);
                        const compressedFile = await compressFile(file);

                        // Upload
                        updateProgress(fileId, 'uploading', 20);
                        const result = await uploadSingleFile(compressedFile, fileId, updateProgress);

                        return {
                            fileId,
                            success: true,
                            result,
                            originalFile: file
                        };
                    } catch (error) {
                        return {
                            fileId,
                            success: false,
                            error: error.message,
                            originalFile: file
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);

                // Pause entre les lots pour éviter la surcharge
                if (i + concurrentUploads < validFiles.length) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }

            // ✅ FINALISATION
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                completed: successful,
                errors: failed,
                globalProgress: 100
            }));

            // Callback avec résultats
            if (onComplete) {
                const fileInfos = successful.map(result => ({
                    name: result.originalFile.name,
                    url: result.result.publicURL,
                    type: result.originalFile.type
                }));

                onComplete(fileInfos, invalidFiles);
            }

        } catch (error) {
            console.error('❌ Erreur upload global:', error);
            setUploadState(prev => ({
                ...prev,
                isUploading: false,
                errors: [{ error: error.message }]
            }));
        }
    }, [compressFile, uploadSingleFile, deviceInfo, interventionId]);

    // ✅ GESTION OPTIMISÉE DES IMAGES
    const preloadImage = useCallback((url) => {
        return new Promise((resolve) => {
            if (imageCache.current.has(url)) {
                resolve(imageCache.current.get(url));
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                imageCache.current.set(url, img);
                setDisplayState(prev => ({
                    ...prev,
                    loadedImages: new Set([...prev.loadedImages, url])
                }));
                resolve(img);
            };

            img.onerror = () => {
                setDisplayState(prev => ({
                    ...prev,
                    imageLoadErrors: new Set([...prev.imageLoadErrors, url])
                }));
                resolve(null);
            };

            img.src = url;
        });
    }, []);

    // ✅ RESET ET NETTOYAGE
    const reset = useCallback(() => {
        if (abortController.current) {
            abortController.current.abort();
        }

        setUploadState({
            isUploading: false,
            queue: [],
            completed: [],
            errors: [],
            globalProgress: 0
        });

        setDisplayState({
            loadedImages: new Set(),
            imageLoadErrors: new Set(),
            isRefreshing: false
        });

        // Nettoyage du cache
        imageCache.current.clear();
    }, []);

    // ✅ CLEANUP à la désactivation
    useEffect(() => {
        return () => {
            if (abortController.current) {
                abortController.current.abort();
            }
            // Libération mémoire
            imageCache.current.clear();
        };
    }, []);

    return {
        // État d'upload
        uploadState,
        handleFileUpload,

        // État d'affichage
        displayState,
        preloadImage,

        // Utilitaires
        deviceInfo,
        reset,

        // Cache et optimisations
        imageCache: imageCache.current
    };
};

// ✅ COMPOSANT D'IMAGE OPTIMISÉ POUR MOBILE
export const MobileOptimizedImage = ({ src, alt, className, style, onClick, placeholder = true }) => {
    const [loadState, setLoadState] = useState('loading');
    const [imageSrc, setImageSrc] = useState(null);
    const imgRef = useRef(null);

    useEffect(() => {
        if (!src) return;

        setLoadState('loading');
        const img = new Image();

        img.onload = () => {
            setImageSrc(src);
            setLoadState('loaded');
        };

        img.onerror = () => {
            setLoadState('error');
        };

        // Lazy loading avec Intersection Observer
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

    const containerStyle = {
        ...style,
        position: 'relative',
        display: 'inline-block',
        backgroundColor: loadState === 'error' ? '#fee2e2' : '#f3f4f6',
        borderRadius: '0.25rem',
        overflow: 'hidden'
    };

    if (loadState === 'loading' && placeholder) {
        return (
            <div ref={imgRef} style={containerStyle} className={className}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'pulse 1.5s ease-in-out infinite'
                }}>
                    <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #e5e7eb',
                        borderTop: '2px solid #3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                </div>
            </div>
        );
    }

    if (loadState === 'error') {
        return (
            <div style={containerStyle} className={className}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                    fontSize: '0.75rem'
                }}>
                    ❌
                </div>
            </div>
        );
    }

    return (
        <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            className={className}
            style={{
                ...style,
                display: loadState === 'loaded' ? 'block' : 'none'
            }}
            onClick={onClick}
            loading="lazy"
        />
    );
};

// ✅ COMPOSANT DE QUEUE D'UPLOAD OPTIMISÉ
export const UploadQueue = ({ uploadState, onRemoveItem }) => {
    if (!uploadState.queue.length) return null;

    return (
        <div style={{ marginTop: '1rem' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
            }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                    Upload en cours
                </h4>
                {uploadState.isUploading && (
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {uploadState.globalProgress}%
                    </span>
                )}
            </div>

            {/* Barre de progression globale */}
            {uploadState.isUploading && (
                <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '2px',
                    marginBottom: '1rem',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${uploadState.globalProgress}%`,
                        height: '100%',
                        backgroundColor: '#3b82f6',
                        transition: 'width 0.3s ease',
                        borderRadius: '2px'
                    }} />
                </div>
            )}

            {/* Liste des fichiers */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto'
            }}>
                {uploadState.queue.map((item) => (
                    <div key={item.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '0.375rem',
                        border: '1px solid #dee2e6'
                    }}>
                        {/* Icône de statut */}
                        <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                            {item.status === 'pending' && '⏳'}
                            {item.status === 'compressing' && '🔄'}
                            {item.status === 'uploading' && '📤'}
                            {item.status === 'completed' && '✅'}
                            {item.status === 'error' && '❌'}
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
                                {item.status === 'uploading' && ` • ${item.progress}%`}
                                {item.status === 'compressing' && ' • Compression...'}
                                {item.error && ` • ${item.error}`}
                            </div>

                            {/* Barre de progression individuelle */}
                            {(item.status === 'uploading' || item.status === 'compressing') && (
                                <div style={{
                                    width: '100%',
                                    height: '2px',
                                    backgroundColor: '#e5e7eb',
                                    borderRadius: '1px',
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

                        {/* Action de suppression */}
                        {item.status !== 'uploading' && item.status !== 'compressing' && onRemoveItem && (
                            <button
                                onClick={() => onRemoveItem(item.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0.25rem',
                                    color: '#6b7280',
                                    fontSize: '1.25rem'
                                }}
                            >
                                ×
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default useMobileFileManager;