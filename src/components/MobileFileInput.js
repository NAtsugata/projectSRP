// ✅ VERSION PATCHÉE - MobileFileInput.js
import React, { useRef, useState } from 'react';

const MobileFileInput = ({
    onChange,
    accept = "image/*,application/pdf",
    multiple = false,
    disabled = false,
    children,
    className = "",
    maxFiles = 10,
    maxSize = 10 * 1024 * 1024, // 10MB
    onError
}) => {
    const inputRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const handleFileChange = (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const validFiles = [];
        const errors = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (file.size > maxSize) {
                errors.push(`${file.name} : trop volumineux (max: ${Math.round(maxSize / 1024 / 1024)}MB)`);
                continue;
            }

            if (multiple && validFiles.length >= maxFiles) {
                errors.push(`Limite de ${maxFiles} fichiers atteinte`);
                break;
            }

            validFiles.push(file);
            if (!multiple) break;
        }

        if (errors.length > 0 && onError) onError(errors);

        if (validFiles.length > 0 && onChange) {
            const dt = new DataTransfer();
            validFiles.forEach(f => dt.items.add(f));
            const newEvent = {
                target: { files: dt.files },
                preventDefault: () => {},
                stopPropagation: () => {}
            };
            onChange(newEvent);
        }

        // ✅ FIX MOBILE : délai pour éviter perte de fichier sélectionné
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }, 100);
    };

    const handleDragEnter = (e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDragOver = (e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        if (disabled || isMobile) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const mockEvent = { target: { files } };
            handleFileChange(mockEvent);
        }
    };

    return (
        <label
            className={`btn btn-secondary w-full flex-center ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''} ${className}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '1rem',
                border: `2px dashed ${disabled ? '#dee2e6' : (isDragOver ? '#3b82f6' : '#cbd5e1')}`,
                borderRadius: '0.5rem',
                backgroundColor: disabled ? '#f8f9fa' : (isDragOver ? '#f0f9ff' : 'white'),
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '16px',
                fontWeight: '500',
                color: disabled ? '#6c757d' : (isDragOver ? '#3b82f6' : '#495057'),
                textAlign: 'center',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'rgba(0, 0, 0, 0.1)',
                touchAction: 'manipulation'
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={handleFileChange}
                disabled={disabled}
                capture={isMobile ? "environment" : undefined} // ✅ Ajouté pour mobile
                style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '100%',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    left: 0,
                    top: 0
                }}
            />
            {children || 'Ajouter un fichier'}
        </label>
    );
};

export default MobileFileInput;
