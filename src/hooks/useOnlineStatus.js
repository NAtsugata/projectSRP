/**
 * Hook React pour détecter le statut de connexion internet
 * Compatible iOS Safari et Android Chrome
 *
 * @returns {boolean} - true si en ligne, false si hors ligne
 */

import { useState, useEffect, useRef } from 'react';
import logger from '../utils/logger';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  useEffect(() => {
    function handleOnline() {
      logger.log('📶 Connexion rétablie');
      setIsOnline(true);
    }

    function handleOffline() {
      logger.log('📵 Connexion perdue');
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérification périodique (utile sur mobile)
    const checkInterval = setInterval(() => {
      const currentStatus = navigator.onLine;
      if (currentStatus !== isOnlineRef.current) {
        setIsOnline(currentStatus);
        logger.log(`📡 Statut connexion mis à jour: ${currentStatus ? 'en ligne' : 'hors ligne'}`);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkInterval);
    };
  }, []);

  return isOnline;
}

/**
 * Hook pour détecter quand on passe de online à offline et vice-versa
 *
 * @param {Function} onOnline - Callback quand on revient en ligne
 * @param {Function} onOffline - Callback quand on passe hors ligne
 */
export function useOnlineStatusChange(onOnline, onOffline) {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (isOnline && onOnline) {
      onOnline();
    } else if (!isOnline && onOffline) {
      onOffline();
    }
  }, [isOnline, onOnline, onOffline]);

  return isOnline;
}

/**
 * Hook pour afficher une notification quand le statut change
 *
 * @param {Function} showToast - Fonction pour afficher une notification
 * @returns {boolean} - Statut de connexion
 */
export function useOnlineStatusWithToast(showToast) {
  const isOnline = useOnlineStatus();
  const [wasOnline, setWasOnline] = useState(isOnline);

  useEffect(() => {
    // Détecter les changements de statut
    if (isOnline !== wasOnline) {
      if (isOnline) {
        if (showToast) {
          showToast('Connexion rétablie ! 📶', 'success');
        }
      } else {
        if (showToast) {
          showToast('Mode hors ligne - Fonctionnalités limitées 📵', 'warning');
        }
      }
      setWasOnline(isOnline);
    }
  }, [isOnline, wasOnline, showToast]);

  return isOnline;
}
