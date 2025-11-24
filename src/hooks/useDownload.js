import { useState, useCallback } from 'react';

/**
 * Hook pour gérer les téléchargements avec progression
 * @returns {Object} { downloads, downloadFile, cancelDownload }
 */
export const useDownload = () => {
    const [downloads, setDownloads] = useState([]);

    /**
     * Télécharge un fichier avec suivi de progression
     * @param {string} url - URL du fichier
     * @param {string} fileName - Nom du fichier
     * @param {Object} options - Options supplémentaires
     */
    const downloadFile = useCallback(async (url, fileName, options = {}) => {
        const downloadId = Date.now() + Math.random();

        try {
            // Ajouter au tracking
            setDownloads(prev => [...prev, {
                id: downloadId,
                fileName,
                progress: 0,
                status: 'downloading'
            }]);

            // Vérifier si c'est une URL Supabase Storage
            const isSupabaseUrl = url.includes('supabase');

            if (isSupabaseUrl) {
                // Pour Supabase, télécharger avec progression
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const contentLength = +response.headers.get('Content-Length') || 0;

                let receivedLength = 0;
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    chunks.push(value);
                    receivedLength += value.length;

                    // Mettre à jour la progression
                    if (contentLength > 0) {
                        const progress = Math.round((receivedLength / contentLength) * 100);
                        setDownloads(prev => prev.map(d =>
                            d.id === downloadId ? { ...d, progress } : d
                        ));
                    }
                }

                // Créer le blob et télécharger
                const blob = new Blob(chunks);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Nettoyer l'URL
                setTimeout(() => URL.revokeObjectURL(link.href), 100);
            } else {
                // Pour les autres URLs, téléchargement direct
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Simuler la progression pour l'UI
                for (let i = 0; i <= 100; i += 20) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    setDownloads(prev => prev.map(d =>
                        d.id === downloadId ? { ...d, progress: i } : d
                    ));
                }
            }

            // Marquer comme terminé
            setDownloads(prev => prev.map(d =>
                d.id === downloadId ? { ...d, progress: 100, status: 'completed' } : d
            ));

            // Retirer après 2 secondes
            setTimeout(() => {
                setDownloads(prev => prev.filter(d => d.id !== downloadId));
            }, 2000);

            return { success: true };

        } catch (error) {
            console.error('Download error:', error);

            // Marquer comme erreur
            setDownloads(prev => prev.map(d =>
                d.id === downloadId ? { ...d, error: true, status: 'error', errorMessage: error.message } : d
            ));

            // Retirer après 5 secondes
            setTimeout(() => {
                setDownloads(prev => prev.filter(d => d.id !== downloadId));
            }, 5000);

            return { success: false, error: error.message };
        }
    }, []);

    /**
     * Annule un téléchargement
     * @param {number} downloadId - ID du téléchargement
     */
    const cancelDownload = useCallback((downloadId) => {
        setDownloads(prev => prev.filter(d => d.id !== downloadId));
    }, []);

    /**
     * Nettoie tous les téléchargements terminés
     */
    const clearCompleted = useCallback(() => {
        setDownloads(prev => prev.filter(d => d.status !== 'completed'));
    }, []);

    return {
        downloads,
        downloadFile,
        cancelDownload,
        clearCompleted
    };
};
