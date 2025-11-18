/**
 * Hook React pour détecter le statut de connexion internet
 * Compatible iOS Safari et Android Chrome
 *
 * @returns {boolean} - true si en ligne, false si hors ligne
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    // Valeur initiale depuis navigator.onLine
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    // Fonction pour mettre à jour le statut
    function handleOnline() {
      console.log('📶 Connexion rétablie');
      setIsOnline(true);
    }

    function handleOffline() {
      console.log('📵 Connexion perdue');
      setIsOnline(false);
    }

    // Écouter les événements de connexion
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérification périodique (utile sur mobile où les événements ne sont pas toujours fiables)
    const checkInterval = setInterval(() => {
      const currentStatus = navigator.onLine;
      if (currentStatus !== isOnline) {
        setIsOnline(currentStatus);
        console.log(`📡 Statut connexion mis à jour: ${currentStatus ? 'en ligne' : 'hors ligne'}`);
      }
    }, 5000); // Vérifier toutes les 5 secondes

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkInterval);
    };
  }, [isOnline]);

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
