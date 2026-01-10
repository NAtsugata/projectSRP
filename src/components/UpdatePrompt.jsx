// src/components/UpdatePrompt.js
// Composant qui force la mise à jour de l'app quand une nouvelle version est disponible

import React, { useState, useEffect } from 'react';
import './UpdatePrompt.css';

/**
 * Prompt de mise à jour obligatoire
 * S'affiche quand une nouvelle version est détectée et force le rechargement
 */
const UpdatePrompt = ({ registration }) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (registration) {
            setShowPrompt(true);

            // Démarrer le compte à rebours
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handleUpdate();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [registration]);

    const handleUpdate = async () => {
        if (isUpdating) return;
        setIsUpdating(true);

        try {
            // Dire au nouveau Service Worker de prendre le contrôle
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // Vider tous les caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
                console.log('✅ Cache vidé');
            }

            // Attendre un peu puis recharger
            setTimeout(() => {
                window.location.reload(true);
            }, 500);

        } catch (error) {
            console.error('Erreur mise à jour:', error);
            // Forcer le rechargement quand même
            window.location.reload(true);
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="update-prompt-overlay">
            <div className="update-prompt-card">
                <div className="update-icon">🔄</div>
                <h2>Nouvelle version disponible !</h2>
                <p>L'application va se mettre à jour automatiquement.</p>

                <div className="update-progress">
                    <div
                        className="update-progress-bar"
                        style={{ width: `${(5 - countdown) * 20}%` }}
                    />
                </div>

                <button
                    className="update-btn"
                    onClick={handleUpdate}
                    disabled={isUpdating}
                >
                    {isUpdating ? (
                        <>
                            <span className="spinner" /> Mise à jour...
                        </>
                    ) : (
                        <>Mettre à jour maintenant ({countdown}s)</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default UpdatePrompt;
