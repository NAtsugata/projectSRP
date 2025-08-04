// src/components/MobileFileInput.js - Input de fichier optimisé pour mobile
import React, { useRef, useState, useCallback, useEffect } from 'react';

const MobileFileInput = ({
    onChange,
    accept = "image/*,application/pdf",
    multiple = false,
    disabled = false,
    children,
    className = "",
    maxFiles = 10,
    maxSize = 10 * 1024 * 1024, // 10MB par défaut
    onError
}) => {
    const inputRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Détection du device
    const deviceInfo = useRef({
        isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        isAndroid: /Android/.test(navigator.userAgent),
        hasCamera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        supportsFileAPI: 'File' in window && 'FileReader' in window,
        touchDevice: 'ontouchstart' in window
    }).current;

    // ✅ GESTION OPTIMISÉE DES FICHIERS
    const processFiles = useCallback(async (fileList) => {
        if (!fileList || fileList.length === 0) return;

        setIsProcessing(true);

        try {
            const files = Array.from(fileList);
            const validFiles = [];
            const errors = [];

            // ✅ VALIDATION AVANCÉE
            for (const file of files) {
                // Vérification taille
                if (file.size > maxSize) {
                    errors.push(`${file.name}: Fichier trop volumineux (max: ${Math.round(maxSize / 1024 / 1024)}MB)`);
                    continue;
                }

                // Vérification type
                const allowedTypes = accept.split(',').map(t => t.trim());
                const isAllowed = allowedTypes.some(type => {
                    if (type.endsWith('/*')) {
                        return file.type.startsWith(type.slice(0, -1));
                    }
                    return file.type === type;
                });

                if (!isAllowed) {
                    errors.push(`${file.name}: Type de fichier non autorisé`);
                    continue;
                }

                // Vérification nombre max
                if (multiple && validFiles.length >= maxFiles) {
                    errors.push(`Nombre maximum de fichiers atteint (${maxFiles})`);
                    break;
                }

                validFiles.push(file);
            }

            // ✅ RAPPORT D'ERREURS
            if (errors.length > 0 && onError) {
                onError(errors);
            }

            // ✅ CALLBACK AVEC FICHIERS VALIDES UNIQUEMENT
            if (validFiles.length > 0 && onChange) {
                // Créer un événement simulé avec seulement les fichiers valides
                const mockEvent = {
                    target: {
                        files: validFiles,
                        value: ''
                    }
                };
                onChange(mockEvent);
            }

        } catch (error) {
            console.error('Erreur traitement fichier:', error);
            if (onError) {
                onError(['Erreur lors du traitement des fichiers']);
            }
        } finally {
            setIsProcessing(false);
            // Reset de l'input pour permettre re-sélection
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    }, [accept, maxFiles, maxSize, multiple, onChange, onError]);

    // ✅ GESTION DU CHANGEMENT DE FICHIER
    const handleFileChange = useCallback((event) => {
        processFiles(event.target.files);
    }, [processFiles]);

    // ✅ GESTION DRAG & DROP (DESKTOP UNIQUEMENT)
    const handleDragEnter = useCallback((e) => {
        if (disabled || deviceInfo.isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, [disabled, deviceInfo.isMobile]);

    const handleDragLeave = useCallback((e) => {
        if (disabled || deviceInfo.isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, [disabled, deviceInfo.isMobile]);

    const handleDragOver = useCallback((e) => {
        if (disabled || deviceInfo.isMobile) return;
        e.preventDefault();
        e.stopPropagation();
    }, [disabled, deviceInfo.isMobile]);

    const handleDrop = useCallback((e) => {
        if (disabled || deviceInfo.isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        processFiles(files);
    }, [disabled, deviceInfo.isMobile, processFiles]);

    // ✅ ADAPTATION DE L'ATTRIBUT ACCEPT POUR MOBILE
    const getOptimizedAccept = useCallback(() => {
        if (!accept) return undefined;

        // Sur iOS, simplifier pour éviter les bugs
        if (deviceInfo.isIOS && accept.includes('image')) {
            return 'image/*';
        }

        // Sur Android, garder accept mais optimiser
        if (deviceInfo.isAndroid && accept.includes('image')) {
            return accept;
        }

        return accept;
    }, [accept, deviceInfo]);

    // ✅ GESTION DE L'ATTRIBUT CAPTURE POUR MOBILE
    const getCaptureAttribute = useCallback(() => {
        if (!deviceInfo.isMobile || !accept || !accept.includes('image')) {
            return undefined;
        }

        if (deviceInfo.isAndroid) {
            // Sur Android, forcer la caméra arrière
            return 'environment';
        } else if (deviceInfo.isIOS) {
            // Sur iOS, laisser le choix
            return true;
        }

        return undefined;
    }, [deviceInfo, accept]);

    // ✅ STYLES ADAPTATIFS
    const getInputStyles = () => ({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: deviceInfo.isMobile ? '16px' : '14px', // Évite zoom iOS
        zIndex: 1
    });

    const getLabelStyles = () => ({
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        minHeight: deviceInfo.isMobile ? '60px' : '50px',
        padding: deviceInfo.isMobile ? '1rem' : '0.875rem',
        border: `2px dashed ${disabled ? '#dee2e6' : (isDragOver ? '#3b82f6' : '#cbd5e1')}`,
        borderRadius: '0.5rem',
        backgroundColor: disabled ? '#f8f9fa' : (isDragOver ? '#f0f9ff' : 'white'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        fontSize: deviceInfo.isMobile ? '16px' : '14px',
        fontWeight: '500',
        color: disabled ? '#6c757d' : (isDragOver ? '#3b82f6' : '#495057'),
        textAlign: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'rgba(0, 0, 0, 0.1)',
        touchAction: 'manipulation',
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isDragOver ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
    });

    // ✅ ATTRIBUTS OPTIMISÉS POUR L'INPUT
    const inputAttributes = {
        ref: inputRef,
        type: 'file',
        accept: getOptimizedAccept(),
        multiple: multiple,
        onChange: handleFileChange,
        disabled: disabled || isProcessing,
        style: getInputStyles(),
        'aria-label': children || 'Sélectionner des fichiers'
    };

    // Ajout conditionnel de l'attribut capture
    const captureValue = getCaptureAttribute();
    if (captureValue !== undefined) {
        inputAttributes.capture = captureValue;
    }

    // ✅ ICÔNE ADAPTATIVE
    const renderIcon = () => {
        if (isProcessing) {
            return (
                <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #e5e7eb',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
            );
        }

        if (disabled) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            );
        }

        if (deviceInfo.hasCamera && accept?.includes('image')) {
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                </svg>
            );
        }

        return (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
        );
    };

    // ✅ TEXTE ADAPTATIF
    const getButtonText = () => {
        if (isProcessing) return 'Traitement...';
        if (disabled) return 'Upload désactivé';

        if (deviceInfo.isMobile) {
            if (multiple) {
                return deviceInfo.hasCamera && accept?.includes('image')
                    ? '📷 Prendre/Choisir plusieurs photos'
                    : '📁 Sélectionner plusieurs fichiers';
            } else {
                return deviceInfo.hasCamera && accept?.includes('image')
                    ? '📷 Prendre/Choisir une photo'
                    : '📁 Sélectionner un fichier';
            }
        }

        return children || (multiple ? 'Sélectionner des fichiers' : 'Sélectionner un fichier');
    };

    return (
        <div className={`mobile-file-input-container ${className}`}>
            <label
                style={getLabelStyles()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input {...inputAttributes} />
                {renderIcon()}
                <span style={{
                    flexGrow: 1,
                    minWidth: 0,
                    wordWrap: 'break-word',
                    fontSize: deviceInfo.isMobile ? '15px' : '14px'
                }}>
                    {getButtonText()}
                </span>

                {/* Indicateur de device mobile */}
                {deviceInfo.isMobile && (
                    <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '8px',
                        height: '8px',
                        backgroundColor: deviceInfo.hasCamera ? '#22c55e' : '#6b7280',
                        borderRadius: '50%',
                        opacity: 0.6
                    }} />
                )}
            </label>

            {/* Informations contextuelles pour mobile */}
            {deviceInfo.isMobile && !disabled && (
                <div style={{
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginTop: '0.5rem',
                    textAlign: 'center',
                    fontStyle: 'italic'
                }}>
                    {deviceInfo.hasCamera && accept?.includes('image') && '📱 Caméra disponible • '}
                    Max: {Math.round(maxSize / 1024 / 1024)}MB
                    {multiple && ` • ${maxFiles} fichiers max`}
                </div>
            )}
        </div>
    );
};

export default MobileFileInput;