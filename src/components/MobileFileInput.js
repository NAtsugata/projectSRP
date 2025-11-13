// src/components/MobileFileInput.js - Version SIMPLIFIÉE et FIABLE avec correctifs mobiles
// Ce composant gère l'upload de fichiers depuis un appareil mobile ou desktop.
// Il inclut des améliorations pour éviter les erreurs lorsque ``navigator``
// n'existe pas (tests, SSR) et pour nettoyer les fichiers sélectionnés.

import React, { useRef, useState } from 'react';

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

  // Détection du device avec garde pour environnements sans navigator
      const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);

  // Gestion du changement de fichier
  const handleFileChange = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Validation basique
    const validFiles = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Vérification taille
      if (file.size > maxSize) {
        errors.push(`${file.name}: Fichier trop volumineux (max: ${Math.round(maxSize / 1024 / 1024)}MB)`);
        continue;
      }

      // Vérification nombre
      if (multiple && validFiles.length >= maxFiles) {
        errors.push(`Nombre maximum de fichiers atteint (${maxFiles})`);
        break;
      }

      validFiles.push(file);

      if (!multiple) break; // Un seul fichier en mode single
    }

    // Rapport d'erreurs
    if (errors.length > 0 && onError) {
      onError(errors);
    }

         // Si on a des fichiers valides, on appelle onChange
         if (validFiles.length > 0 && onChange) {
           let filesToSend;
           // Certains navigateurs anciens ou mobiles ne supportent pas DataTransfer
           if (typeof DataTransfer !== 'undefined') {
             const dt = new DataTransfer();
             validFiles.forEach(file => dt.items.add(file));
             filesToSend = dt.files;
           } else {
             // Fallback : utiliser directement le tableau
             // eslint-disable-next-line no-undef
             filesToSend = validFiles;
           }

           // On crée un événement simulé
           const newEvent = {
             target: {
               files: filesToSend
             },
             preventDefault: () => {},
             stopPropagation: () => {}
           };

           onChange(newEvent);
         }

    // Reset de l'input pour permettre re-sélection du même fichier
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Drag & Drop pour desktop uniquement
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
      // On utilise la même logique que handleFileChange
      const mockEvent = {
        target: { files }
      };
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
        fontSize: '16px', // Important pour éviter le zoom iOS
        fontWeight: '500',
        color: disabled ? '#6c757d' : (isDragOver ? '#3b82f6' : '#495057'),
        textAlign: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'rgba(0, 0, 0, 0.1)',
        touchAction: 'manipulation'
      }}
    >
          {/*
            ⚠️ IMPORTANT: L'attribut 'capture' ne doit être utilisé que pour l'upload UNIQUE
            car il force l'ouverture de la caméra et est INCOMPATIBLE avec 'multiple'
            sur iOS et certains Android. Pour l'upload multiple, on laisse le navigateur
            ouvrir le sélecteur de fichiers natif qui permet de choisir plusieurs photos.
          */}
          <input
             ref={inputRef}
             type="file"
             accept={accept}
             multiple={multiple}
             onChange={handleFileChange}
             disabled={disabled}
             {...(isMobile && accept && accept.includes('image') && !multiple
               ? (isAndroid
                   ? { capture: 'environment' }
                   : (isIOS ? { capture: true } : {}))
               : {})}
             style={{
               position: 'absolute',
               opacity: 0,
               width: '100%',
               height: '100%',
               cursor: disabled ? 'not-allowed' : 'pointer',
               fontSize: '16px', // Évite le zoom iOS
               left: 0,
               top: 0
             }}
           />

      {/* Contenu du bouton */}
      <span style={{ pointerEvents: 'none' }}>
        {children || (multiple ? ' Sélectionner des fichiers' : ' Sélectionner un fichier')}
      </span>
    </label>
  );
};

export default MobileFileInput;