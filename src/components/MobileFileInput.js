// src/components/MobileFileInput.js - Composant d'upload optimisé pour mobile et desktop
import React, { useRef, useState, useCallback } from 'react';

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
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    // ✅ GESTION OPTIMISÉE DES FICHIERS
    const processFiles = useCallback((fileList) => {
        if (!fileList || fileList.length === 0) return;

        setIsProcessing(true);

        try {
            const files = Array.from(fileList);
            const validFiles = [];
            const errors = [];

            // Validation
            for (const file of files) {
                // Vérification taille
                if (file.size > maxSize) {
                    errors.push(`${file.name}: Fichier trop volumineux (max: ${Math.round(maxSize / 1024 / 1024)}MB)`);
                    continue;
                }

                // Vérification nombre max
                if (multiple && validFiles.length >= maxFiles) {
                    errors.push(`Nombre maximum de fichiers atteint (${maxFiles})`);
                    break;
                }

                validFiles.push(file);
            }

            // Rapport d'erreurs
            if (errors.length > 0 && onError) {
                onError(errors);
            }

            // Callback avec fichiers valides
            if (validFiles.length > 0 && onChange) {
                // Créer un événement simulé compatible
                const dataTransfer = new DataTransfer();
                validFiles.forEach(file => dataTransfer.items.add(file));

                const mockEvent = {
                    target: {
                        files: dataTransfer.files,
                        value: ''
                    },
                    preventDefault: () => {},
                    stopPropagation: () => {}
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
            // Reset de l'input
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    }, [accept, maxFiles, maxSize, multiple, onChange, onError]);

    // ✅ GESTION DU CHANGEMENT DE FICHIER
    const handleFileChange = useCallback((event) => {
        processFiles(event.target.files);
    }, [processFiles]);

    // ✅ GESTION DRAG & DROP (DESKTOP)
    const handleDragEnter = useCallback((e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, [disabled, isMobile]);

    const handleDragLeave = useCallback((e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, [disabled, isMobile]);

    const handleDragOver = useCallback((e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
    }, [disabled, isMobile]);

    const handleDrop = useCallback((e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        processFiles(e.dataTransfer.files);
    }, [disabled, isMobile, processFiles]);

    // ✅ CLICK SUR LE LABEL
    const handleClick = useCallback(() => {
        if (!disabled && inputRef.current) {
            inputRef.current.click();
        }
    }, [disabled]);

    // ✅ ADAPTATION MOBILE
    const getOptimizedAccept = useCallback(() => {
        if (!accept) return undefined;

        // Sur iOS, simplifier pour éviter les bugs
        if (isIOS && accept.includes('image')) {
            return 'image/*';
        }

        return accept;
    }, [accept, isIOS]);

    // ✅ TEXTE ADAPTATIF
    const getButtonText = () => {
        if (isProcessing) return 'Traitement...';
        if (disabled) return 'Upload désactivé';

        if (children) return children;

        if (isMobile) {
            if (accept?.includes('image')) {
                return multiple ? '📷 Prendre ou choisir des photos' : '📷 Prendre ou choisir une photo';
            }
            return multiple ? '📁 Sélectionner des fichiers' : '📁 Sélectionner un fichier';
        }

        return multiple ? '📂 Glisser des fichiers ici ou cliquer' : '📂 Glisser un fichier ici ou cliquer';
    };

    return (
        <div
            className={`mobile-file-input-wrapper ${className}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClick}
            style={{
                position: 'relative',
                width: '100%',
                minHeight: isMobile ? '60px' : '56px',
                padding: '1rem',
                border: `2px dashed ${disabled ? '#dee2e6' : (isDragOver ? '#3b82f6' : '#cbd5e1')}`,
                borderRadius: '0.5rem',
                backgroundColor: disabled ? '#f8f9fa' : (isDragOver ? '#f0f9ff' : 'white'),
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: disabled ? '#6c757d' : (isDragOver ? '#3b82f6' : '#495057'),
                textAlign: 'center',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'rgba(0, 0, 0, 0.1)',
                touchAction: 'manipulation',
                transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isDragOver ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept={getOptimizedAccept()}
                multiple={multiple}
                onChange={handleFileChange}
                disabled={disabled || isProcessing}
                capture={isMobile && accept?.includes('image') ? 'environment' : undefined}
                style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '16px', // Évite le zoom iOS
                    pointerEvents: 'none'
                }}
                onClick={(e) => e.stopPropagation()}
            />

            {/* Icône */}
            {isProcessing ? (
                <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #e5e7eb',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
            ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {accept?.includes('image') && isMobile ? (
                        <>
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </>
                    ) : (
                        <>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </>
                    )}
                </svg>
            )}

            {/* Texte */}
            <span style={{ flexGrow: 1, minWidth: 0, wordWrap: 'break-word' }}>
                {getButtonText()}
            </span>
        </div>
    );
};

export default MobileFileInput;