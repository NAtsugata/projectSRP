import React, { useState, useEffect } from 'react';
import { UploadIcon, XIcon } from '../SharedUI';
import { getUploadStats, getPendingUploads } from '../../utils/indexedDBCache';

/**
 * Composant d'affichage de la queue d'upload
 * Montre les fichiers en attente d'upload dans le cache IndexedDB
 */
export const UploadQueue = ({ onClearCache }) => {
    const [stats, setStats] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        // Charger les stats du cache
        const loadStats = async () => {
            try {
                const cacheStats = await getUploadStats();
                setStats(cacheStats);

                if (cacheStats && cacheStats.count > 0) {
                    const pendingUploads = await getPendingUploads();
                    setUploads(pendingUploads);
                }
            } catch (error) {
                console.error('Erreur chargement stats upload:', error);
            }
        };

        loadStats();

        // Rafraîchir toutes les 5 secondes
        const interval = setInterval(loadStats, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!stats || stats.count === 0) return null;

    return (
        <>
            {/* Indicateur compact */}
            <div
                className="upload-queue-indicator"
                onClick={() => setIsExpanded(!isExpanded)}
                role="button"
                tabIndex={0}
                aria-label="Afficher la queue d'upload"
            >
                <div className="upload-icon-badge">
                    <UploadIcon style={{ width: 20, height: 20 }} />
                    {stats.pending > 0 && (
                        <span className="badge">{stats.pending}</span>
                    )}
                </div>
                <div className="upload-info">
                    <span>{stats.pending} fichier(s) en attente</span>
                    <span className="upload-size">{stats.totalSizeMB} MB</span>
                </div>
            </div>

            {/* Liste détaillée (expandable) */}
            {isExpanded && (
                <div className="upload-queue-modal">
                    <div className="upload-queue-header">
                        <h3>Files en attente d'upload</h3>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="btn-icon"
                            aria-label="Fermer"
                        >
                            <XIcon style={{ width: 20, height: 20 }} />
                        </button>
                    </div>

                    <div className="upload-queue-body">
                        {uploads.length === 0 ? (
                            <p className="text-muted">Aucun fichier en attente</p>
                        ) : (
                            <ul className="upload-list">
                                {uploads.map((upload) => (
                                    <li key={upload.id} className="upload-item">
                                        <div className="upload-item-info">
                                            <span className="upload-item-name">{upload.fileName}</span>
                                            <span className="upload-item-size">
                                                {(upload.fileSize / (1024 * 1024)).toFixed(2)} MB
                                            </span>
                                        </div>
                                        <div className="upload-item-status">
                                            <span className={`status-badge status-badge-${upload.status === 'pending' ? 'yellow' : upload.status === 'failed' ? 'red' : 'blue'}`}>
                                                {upload.status === 'pending' ? 'En attente' :
                                                    upload.status === 'uploading' ? 'Upload...' :
                                                        upload.status === 'failed' ? 'Échec' : 'Terminé'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {stats.count > 0 && onClearCache && (
                        <div className="upload-queue-footer">
                            <button
                                onClick={onClearCache}
                                className="btn btn-secondary btn-sm"
                            >
                                Vider le cache
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default UploadQueue;
