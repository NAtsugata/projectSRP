import { useState, useEffect, useCallback, useRef } from 'react';
import { storageService } from '../lib/supabase';

/**
 * Un hook React complet pour gérer les uploads de fichiers sur mobile,
 * avec gestion de la compression, des tentatives multiples,
 * du mode hors-ligne (détection) et du suivi de la progression par fichier.
 * @param {string} interventionId - L'ID de l'intervention pour l'upload.
 */
export const useMobileUpload = (interventionId) => {
    const [isUploading, setIsUploading] = useState(false);
    const [fileStatuses, setFileStatuses] = useState({});
    const [error, setError] = useState(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const timerIntervalsRef = useRef({}); // Pour gérer les chronomètres de manière sûre

    // S'assure que tous les chronomètres sont arrêtés si le composant est démonté
    useEffect(() => {
        return () => {
            Object.values(timerIntervalsRef.current).forEach(clearInterval);
        };
    }, []);

    // Détection des capacités du device (ex: mobile, caméra, etc.)
    const [capabilities] = useState(() => {
        const userAgent = navigator.userAgent;
        const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        return {
            isMobile,
            isIOS: /iPad|iPhone|iPod/.test(userAgent),
            isAndroid: /Android/.test(userAgent),
            hasCamera: 'mediaDevices' in navigator,
            supportsFileAPI: 'FileReader' in window,
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

    // Fonction de compression d'image optimisée
    const compressImage = useCallback(async (file) => {
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const maxWidth = capabilities.isMobile ? 1280 : 1920;
                const maxHeight = capabilities.isMobile ? 720 : 1080;
                let { width, height } = img;

                const ratio = Math.min(maxWidth / width, maxHeight / height);
                if (ratio < 1) {
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, width, height);

                const quality = capabilities.isMobile ? 0.75 : 0.85;
                canvas.toBlob((blob) => {
                    resolve(blob && blob.size < file.size ? new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }, [capabilities.isMobile]);

    // Upload d'un fichier unique avec tentatives et suivi du temps
    const uploadSingleFile = useCallback(async (file, fileId) => {
        const maxRetries = 2;
        let lastError;
        const startTime = Date.now();

        // Met à jour le temps écoulé toutes les secondes
        const timerInterval = setInterval(() => {
            setFileStatuses(prev => {
                // Vérifie si le fichier est toujours dans la liste avant de mettre à jour
                if (!prev[fileId]) {
                    clearInterval(timerIntervalsRef.current[fileId]);
                    delete timerIntervalsRef.current[fileId];
                    return prev;
                }
                return {
                    ...prev,
                    [fileId]: {
                        ...prev[fileId],
                        elapsedTime: Math.round((Date.now() - startTime) / 1000)
                    }
                };
            });
        }, 1000);
        timerIntervalsRef.current[fileId] = timerInterval;

        try {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await storageService.uploadInterventionFile(file, interventionId, 'report');
                    if (result.error) throw result.error;

                    setFileStatuses(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'completed', progress: 100 } }));
                    return result;
                } catch (uploadError) {
                    lastError = uploadError;
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }
            throw lastError;
        } catch (finalError) {
            setFileStatuses(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error', error: finalError.message } }));
            throw finalError;
        } finally {
            clearInterval(timerIntervalsRef.current[fileId]);
            delete timerIntervalsRef.current[fileId];
        }
    }, [interventionId]);

    // Fonction principale pour gérer l'upload de plusieurs fichiers en parallèle
    const handleFileUpload = useCallback(async (files) => {
        if (!files || files.length === 0) return { results: [], invalidFiles: [] };

        setIsUploading(true);
        setError(null);

        const validFiles = [];
        const invalidFilesInfo = [];
        for (const file of Array.from(files)) {
            const maxSize = 15 * 1024 * 1024; // 15MB
            if (file.size <= maxSize) validFiles.push(file);
            else invalidFilesInfo.push(file);
        }

        const initialStatuses = {};
        validFiles.forEach((file, index) => {
            const fileId = `${file.name}-${file.lastModified}-${index}`;
            initialStatuses[fileId] = { id: fileId, name: file.name, size: file.size, status: 'pending', progress: 0, elapsedTime: 0 };
        });
        setFileStatuses(initialStatuses);

        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const CONCURRENT_UPLOADS = capabilities.isMobile ? 2 : 4;
            const results = [];

            const processFile = async (file, index) => {
                const fileId = `${file.name}-${file.lastModified}-${index}`;
                try {
                    let fileToUpload = file;
                    if (file.type.startsWith('image/')) {
                        setFileStatuses(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'compressing', progress: 25 } }));
                        fileToUpload = await compressImage(file);
                    }
                    setFileStatuses(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'uploading', progress: 50 } }));
                    const result = await uploadSingleFile(fileToUpload, fileId);
                    return { file, fileId, success: true, result };
                } catch (error) {
                    return { file, fileId, success: false, error: error.message };
                }
            };

            for (let i = 0; i < validFiles.length; i += CONCURRENT_UPLOADS) {
                const batch = validFiles.slice(i, i + CONCURRENT_UPLOADS);
                const batchPromises = batch.map((file, batchIndex) => processFile(file, i + batchIndex));
                results.push(...await Promise.all(batchPromises));
            }

            return { results, invalidFiles: invalidFilesInfo };
        } catch (generalError) {
            setError(generalError.message);
            return { results: [], invalidFiles: invalidFilesInfo };
        } finally {
            setIsUploading(false);
        }
    }, [capabilities.isMobile, compressImage, uploadSingleFile]);

    // ✅ NOUVELLE FONCTION pour supprimer un fichier de la liste
    const removeFileFromQueue = useCallback((fileIdToRemove) => {
        setFileStatuses(prev => {
            const newStatuses = { ...prev };
            delete newStatuses[fileIdToRemove];
            return newStatuses;
        });
        // Arrête le chronomètre associé s'il existe
        if (timerIntervalsRef.current[fileIdToRemove]) {
            clearInterval(timerIntervalsRef.current[fileIdToRemove]);
            delete timerIntervalsRef.current[fileIdToRemove];
        }
    }, []);

    const reset = useCallback(() => {
        setIsUploading(false);
        setFileStatuses({});
        setError(null);
        // Arrête tous les chronomètres en cours
        Object.values(timerIntervalsRef.current).forEach(clearInterval);
        timerIntervalsRef.current = {};
    }, []);

    return {
        handleFileUpload,
        capabilities,
        isUploading,
        fileStatuses,
        error,
        reset,
        isOnline,
        removeFileFromQueue // ✅ Exporte la nouvelle fonction
    };
};
