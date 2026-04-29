// src/components/pwa/PWAInstallPrompt.js
// Composant pour faciliter l'installation de l'app et les mises à jour
import React, { useState, useEffect, useCallback } from 'react';
import logger from '../../utils/logger';
import './PWAInstallPrompt.css';

/**
 * Hook pour gérer l'installation PWA
 */
export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(() => window.__pwaPrompt || null);
    const [isInstallable, setIsInstallable] = useState(() => !!window.__pwaPrompt);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Vérifier si déjà installé
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Restaurer le prompt existant si disponible
        if (window.__pwaPrompt) {
            setDeferredPrompt(window.__pwaPrompt);
            setIsInstallable(true);
        }

        // Écouter l'événement beforeinstallprompt
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            // Stocker globalement pour survie à la navigation
            window.__pwaPrompt = e;
            setDeferredPrompt(e);
            setIsInstallable(true);
            logger.log('📱 Installation PWA disponible');
        };

        // Écouter l'installation réussie
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
            window.__pwaPrompt = null;
            logger.log('✅ PWA installée avec succès');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        const prompt = window.__pwaPrompt || deferredPrompt;
        if (!prompt) return false;

        try {
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            logger.log(`📱 Installation ${outcome === 'accepted' ? 'acceptée' : 'refusée'}`);
            setDeferredPrompt(null);
            window.__pwaPrompt = null;
            return outcome === 'accepted';
        } catch (error) {
            logger.error('Erreur installation:', error);
            return false;
        }
    }, [deferredPrompt]);

    return { isInstallable, isInstalled, promptInstall };
};

/**
 * Hook pour gérer les mises à jour
 */
export const usePWAUpdate = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState(null);

    useEffect(() => {
        // Écouter les événements de mise à jour du service worker
        const handleUpdate = (event) => {
            if (event.detail?.waiting) {
                setWaitingWorker(event.detail.waiting);
                setUpdateAvailable(true);
                logger.log('🔄 Mise à jour disponible');
            }
        };

        window.addEventListener('sw-update-available', handleUpdate);
        return () => window.removeEventListener('sw-update-available', handleUpdate);
    }, []);

    const applyUpdate = useCallback(() => {
        if (!waitingWorker) return;

        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        waitingWorker.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') {
                window.location.reload();
            }
        });
    }, [waitingWorker]);

    const dismissUpdate = useCallback(() => {
        setUpdateAvailable(false);
    }, []);

    return { updateAvailable, applyUpdate, dismissUpdate };
};

/**
 * Composant Banner d'installation PWA
 */
export const PWAInstallBanner = ({ onDismiss }) => {
    const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
    const [dismissed, setDismissed] = useState(false);

    // Vérifier si l'utilisateur a déjà refusé
    useEffect(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const dismissedTime = parseInt(dismissed, 10);
            // Ne pas réafficher avant 7 jours
            if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
                setDismissed(true);
            }
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        setDismissed(true);
        onDismiss?.();
    };

    const handleInstall = async () => {
        const success = await promptInstall();
        if (success) {
            handleDismiss();
        }
    };

    if (isInstalled || dismissed || !isInstallable) return null;

    return (
        <div className="pwa-install-banner">
            <div className="pwa-install-content">
                <div className="pwa-install-icon">📱</div>
                <div className="pwa-install-text">
                    <strong>Installer SRP</strong>
                    <span>Accès rapide depuis l'écran d'accueil</span>
                </div>
            </div>
            <div className="pwa-install-actions">
                <button onClick={handleDismiss} className="pwa-btn-dismiss">
                    Plus tard
                </button>
                <button onClick={handleInstall} className="pwa-btn-install">
                    Installer
                </button>
            </div>
        </div>
    );
};

/**
 * Composant Modal de mise à jour
 */
export const PWAUpdateModal = () => {
    const { updateAvailable, applyUpdate, dismissUpdate } = usePWAUpdate();

    if (!updateAvailable) return null;

    return (
        <div className="pwa-update-overlay">
            <div className="pwa-update-modal">
                <div className="pwa-update-icon">🔄</div>
                <h3>Nouvelle version disponible</h3>
                <p>Une mise à jour est prête. Rafraîchir pour l'appliquer ?</p>
                <div className="pwa-update-actions">
                    <button onClick={dismissUpdate} className="pwa-btn-dismiss">
                        Plus tard
                    </button>
                    <button onClick={applyUpdate} className="pwa-btn-update">
                        Mettre à jour
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Instructions iOS (Safari ne supporte pas l'install prompt)
 */
export const IOSInstallInstructions = ({ onClose }) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isIOS && !isInStandaloneMode) {
            const dismissed = localStorage.getItem('ios-install-dismissed');
            if (!dismissed) {
                setShow(true);
            }
        }
    }, [isIOS, isInStandaloneMode]);

    const handleClose = () => {
        localStorage.setItem('ios-install-dismissed', 'true');
        setShow(false);
        onClose?.();
    };

    if (!show) return null;

    return (
        <div className="ios-install-banner">
            <button onClick={handleClose} className="ios-close-btn">×</button>
            <div className="ios-install-content">
                <div className="ios-install-icon">📲</div>
                <div className="ios-install-text">
                    <strong>Installer SRP sur iPhone</strong>
                    <p>
                        Appuyez sur <span className="ios-share-icon">⬆️</span> puis
                        <strong> "Sur l'écran d'accueil"</strong>
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Composant principal qui combine tout
 */
const PWAInstallPrompt = () => {
    return (
        <>
            <PWAInstallBanner />
            <PWAUpdateModal />
            <IOSInstallInstructions />
        </>
    );
};

export default PWAInstallPrompt;
