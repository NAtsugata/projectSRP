// src/components/FileUploader.js
import React, { useState, useRef } from 'react';

export default function FileUploader({ onUploadComplete, multiple = false, disabled = false, children = "Choisir un fichier" }) {
    const [isUploading, setIsUploading] = useState(false);
    const inputFileRef = useRef(null);

    const handleFileChange = async (e) => {
        e.preventDefault();
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);

        const uploadPromises = Array.from(files).map(file => {
            return fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
                method: 'POST',
                body: file,
            }).then(response => {
                if (!response.ok) {
                    console.error('API Response:', response);
                    throw new Error(`Échec pour ${file.name}`);
                }
                return response.json();
            });
        });

        try {
            const uploadedBlobs = await Promise.all(uploadPromises);
            const newUrls = uploadedBlobs.map(blob => blob.url);
            if (onUploadComplete) {
                onUploadComplete(newUrls);
            }
        } catch (err) {
            console.error("Erreur lors de l'upload:", err);
        } finally {
            setIsUploading(false);
            if (inputFileRef.current) {
                inputFileRef.current.value = '';
            }
        }
    };

    // On utilise un label stylisé qui déclenche l'input caché
    return (
        <label className={`btn btn-primary ${disabled || isUploading ? 'disabled' : ''}`}>
            <input
                type="file"
                multiple={multiple}
                onChange={handleFileChange}
                disabled={disabled || isUploading}
                ref={inputFileRef}
                style={{ display: 'none' }} // L'input est caché
            />
            {isUploading ? 'Envoi en cours...' : children}
        </label>
    );
}
