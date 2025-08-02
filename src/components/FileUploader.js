import React, { useState, useRef } from 'react';

/**
 * Un composant de téléversement de fichiers robuste et réutilisable.
 *
 * @param {object} props
 * @param {(fileInfo: {name: string, url: string, type: string}) => void} [props.onFileUploadSuccess] - Callback pour chaque fichier téléversé avec succès.
 * @param {(errorInfo: {name: string, message: string}) => void} [props.onFileUploadError] - Callback pour chaque fichier qui a échoué.
 * @param {(isUploading: boolean) => void} [props.onQueueStateChange] - Callback qui se déclenche au début et à la fin du traitement de la file d'attente.
 * @param {boolean} [props.multiple=false] - Autorise la sélection de plusieurs fichiers.
 * @param {boolean} [props.disabled=false] - Désactive le bouton.
 * @param {React.ReactNode} [props.children="Choisir un fichier"] - Le contenu du bouton.
 * @param {string} [props.className="btn btn-primary"] - Classes CSS pour styliser le label/bouton.
 */
export default function FileUploader({
    onFileUploadSuccess,
    onFileUploadError,
    onQueueStateChange,
    multiple = false,
    disabled = false,
    children = "Choisir un fichier",
    className = "btn btn-primary"
}) {
    const [isUploading, setIsUploading] = useState(false);
    const inputFileRef = useRef(null);

    const handleFileChange = async (e) => {
        e.preventDefault();
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        if (onQueueStateChange) onQueueStateChange(true);

        // Traiter les fichiers séquentiellement pour plus de robustesse sur mobile
        for (const file of files) {
            try {
                // Utilise l'API /api/upload comme dans la version originale
                const response = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
                    method: 'POST',
                    body: file,
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream'
                    }
                });

                if (!response.ok) {
                    // Tente de récupérer un message d'erreur clair depuis le serveur
                    const errorBody = await response.json().catch(() => ({ message: response.statusText }));
                    throw new Error(errorBody.message || `Erreur serveur: ${response.status}`);
                }

                const result = await response.json();

                // Appelle le callback de succès pour ce fichier spécifique
                if (onFileUploadSuccess) {
                    onFileUploadSuccess({
                        name: file.name,
                        url: result.url,
                        type: file.type
                    });
                }
            } catch (err) {
                console.error(`Échec du téléversement pour ${file.name}:`, err);
                // Appelle le callback d'erreur pour ce fichier spécifique
                if (onFileUploadError) {
                    onFileUploadError({
                        name: file.name,
                        message: err.message
                    });
                }
            }
        }

        // Tous les fichiers ont été traités
        setIsUploading(false);
        if (onQueueStateChange) onQueueStateChange(false);

        // Réinitialise l'input pour permettre de resélectionner le même fichier
        if (inputFileRef.current) {
            inputFileRef.current.value = '';
        }
    };

    // On utilise un label stylisé qui déclenche l'input qui, lui, est caché.
    return (
        <label className={`${className} ${disabled || isUploading ? 'disabled' : ''}`}>
            <input
                type="file"
                multiple={multiple}
                onChange={handleFileChange}
                disabled={disabled || isUploading}
                ref={inputFileRef}
                style={{ display: 'none' }} // L'input est invisible
            />
            {isUploading ? 'Envoi en cours...' : children}
        </label>
    );
}
