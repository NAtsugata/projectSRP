import React from 'react';
import { DownloadIcon, XIcon, CheckCircleIcon, AlertTriangleIcon } from '../SharedUI';

/**
 * Composant d'affichage de la progression des téléchargements
 * @param {Array} downloads - Liste des téléchargements en cours
 * @param {Function} onCancel - Fonction pour annuler un téléchargement
 */
export const DownloadProgress = ({ downloads, onCancel }) => {
    if (!downloads || downloads.length === 0) return null;

    return (
        <div className="download-progress-container">
            {downloads.map((download) => (
                <div
                    key={download.id}
                    className={`download-progress-toast ${download.status === 'completed' ? 'completed' : ''} ${download.error ? 'error' : ''}`}
                >
                    <div className="download-info">
                        {download.status === 'completed' ? (
                            <CheckCircleIcon style={{ width: 20, height: 20, color: '#10b981' }} />
                        ) : download.error ? (
                            <AlertTriangleIcon style={{ width: 20, height: 20, color: '#ef4444' }} />
                        ) : (
                            <DownloadIcon style={{ width: 20, height: 20, color: '#3b82f6' }} />
                        )}
                        <span className="download-filename" title={download.fileName}>
                            {download.fileName}
                        </span>
                    </div>

                    {!download.error && (
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${download.progress}%` }}
                            />
                        </div>
                    )}

                    <div className="download-footer">
                        {download.error ? (
                            <span className="error-text">{download.errorMessage || 'Erreur de téléchargement'}</span>
                        ) : download.status === 'completed' ? (
                            <span className="success-text">Téléchargement terminé</span>
                        ) : (
                            <span className="progress-text">{download.progress}%</span>
                        )}

                        {onCancel && download.status !== 'completed' && (
                            <button
                                onClick={() => onCancel(download.id)}
                                className="btn-icon-sm"
                                aria-label="Annuler"
                            >
                                <XIcon style={{ width: 16, height: 16 }} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default DownloadProgress;
