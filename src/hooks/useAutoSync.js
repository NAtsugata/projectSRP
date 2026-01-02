import { useState, useEffect, useCallback } from 'react';
import { getPendingUploads } from '../utils/indexedDBCache';
import logger from '../utils/logger';

/**
 * Hook pour la synchronisation automatique des uploads
 * Détecte le retour en ligne et synchronise automatiquement
 */
export const useAutoSync = (onSync) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Vérifier les uploads en attente
    const checkPending = useCallback(async () => {
        try {
            const pending = await getPendingUploads();
            setPendingCount(pending.length);
            return pending;
        } catch (error) {
            console.error('Erreur vérification uploads en attente:', error);
            return [];
        }
    }, []);

    // Synchroniser les uploads
    const syncUploads = useCallback(async () => {
        if (isSyncing || !isOnline) return;

        setIsSyncing(true);
        try {
            const pending = await checkPending();

            if (pending.length > 0 && onSync) {
                logger.log(`🔄 Synchronisation de ${pending.length} upload(s)...`);
                await onSync(pending);
                await checkPending(); // Rafraîchir le compte
            }
        } catch (error) {
            console.error('Erreur synchronisation:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, isOnline, onSync, checkPending]);

    useEffect(() => {
        // Vérifier au montage
        checkPending();

        const handleOnline = async () => {
            logger.log('✅ Connexion rétablie');
            setIsOnline(true);

            // Attendre 2 secondes pour stabiliser la connexion
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Synchroniser automatiquement
            syncUploads();
        };

        const handleOffline = () => {
            logger.log('❌ Connexion perdue');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Vérifier périodiquement les uploads en attente
        const interval = setInterval(checkPending, 30000); // Toutes les 30 secondes

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [checkPending, syncUploads]);

    return {
        isOnline,
        isSyncing,
        pendingCount,
        syncNow: syncUploads,
        checkPending
    };
};

export default useAutoSync;
