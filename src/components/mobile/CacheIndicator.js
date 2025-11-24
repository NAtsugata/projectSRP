import React, { useState, useEffect } from 'react';

/**
 * Composant d'affichage de l'utilisation du cache
 * Montre l'espace utilisé par le cache de l'application
 */
export const CacheIndicator = ({ showDetails = false }) => {
    const [cacheSize, setCacheSize] = useState(0);
    const [quota, setQuota] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkStorage = async () => {
            try {
                if (navigator.storage && navigator.storage.estimate) {
                    const estimate = await navigator.storage.estimate();
                    setCacheSize(estimate.usage || 0);
                    setQuota(estimate.quota || 0);
                }
            } catch (error) {
                console.error('Erreur estimation stockage:', error);
            } finally {
                setLoading(false);
            }
        };

        checkStorage();

        // Rafraîchir toutes les 30 secondes
        const interval = setInterval(checkStorage, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading || quota === 0) return null;

    const percentUsed = (cacheSize / quota) * 100;
    const sizeMB = (cacheSize / (1024 * 1024)).toFixed(2);
    const quotaMB = (quota / (1024 * 1024)).toFixed(0);

    // Ne pas afficher si moins de 1% utilisé
    if (percentUsed < 1) return null;

    return (
        <div className="cache-indicator">
            <div className="cache-bar">
                <div
                    className="cache-fill"
                    style={{
                        width: `${Math.min(percentUsed, 100)}%`,
                        backgroundColor: percentUsed > 90 ? '#ef4444' : percentUsed > 70 ? '#f59e0b' : '#10b981'
                    }}
                />
            </div>
            <span className="cache-text">
                {showDetails ? (
                    <>Stockage: {sizeMB} MB / {quotaMB} MB ({percentUsed.toFixed(1)}%)</>
                ) : (
                    <>{sizeMB} MB utilisés</>
                )}
            </span>
            {percentUsed > 80 && (
                <span className="cache-warning">
                    ⚠️ Espace de stockage faible
                </span>
            )}
        </div>
    );
};

export default CacheIndicator;
