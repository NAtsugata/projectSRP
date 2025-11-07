// src/hooks/useGeolocation.js
// Hook pour gérer la géolocalisation avec retry et gestion d'erreurs

import { useState, useCallback, useMemo } from 'react';
import logger from '../utils/logger';

/**
 * Hook pour obtenir la géolocalisation
 * @param {Object} options - Options de géolocalisation
 * @returns {Object} {getPosition, position, loading, error, requestPosition}
 */
export const useGeolocation = (options = {}) => {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultOptions = useMemo(() => ({
    enableHighAccuracy: true,
    timeout: 15000, // 15s au lieu de 10s
    maximumAge: 0,
    ...options
  }), [options]);

  const getPosition = useCallback(
    (retries = 2) => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          const err = new Error('Géolocalisation non supportée sur ce navigateur');
          setError(err);
          reject(err);
          return;
        }

        setLoading(true);
        setError(null);

        const attemptGeolocation = (attemptsLeft) => {
          logger.log(`📍 Tentative de géolocalisation (${3 - attemptsLeft}/3)`);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const geoData = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: Math.round(pos.coords.accuracy),
                timestamp: new Date().toISOString()
              };

              logger.log('✅ Géolocalisation réussie:', geoData);
              setPosition(geoData);
              setLoading(false);
              resolve(geoData);
            },
            (err) => {
              logger.warn(`⚠️ Erreur géolocalisation:`, err.message);

              if (attemptsLeft > 0) {
                logger.log(`🔄 Nouvelle tentative dans 2s...`);
                setTimeout(() => {
                  attemptGeolocation(attemptsLeft - 1);
                }, 2000);
              } else {
                const errorMessage = getErrorMessage(err);
                const error = new Error(errorMessage);
                error.code = err.code;

                logger.error('❌ Géolocalisation échouée:', errorMessage);
                setError(error);
                setLoading(false);
                reject(error);
              }
            },
            defaultOptions
          );
        };

        attemptGeolocation(retries);
      });
    },
    [defaultOptions]
  );

  // Fonction helper pour obtenir un message d'erreur user-friendly
  const getErrorMessage = (err) => {
    switch (err.code) {
      case err.PERMISSION_DENIED:
        return 'Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position dans les paramètres.';
      case err.POSITION_UNAVAILABLE:
        return 'Position indisponible. Vérifiez que le GPS est activé.';
      case err.TIMEOUT:
        return 'Délai dépassé. Vérifiez votre connexion GPS.';
      default:
        return 'Erreur de géolocalisation inconnue.';
    }
  };

  // Fonction pour demander la permission et obtenir la position
  const requestPosition = useCallback(async () => {
    try {
      const pos = await getPosition();
      return { data: pos, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }, [getPosition]);

  // Fonction pour formater la position pour l'affichage
  const formatPosition = useCallback((pos) => {
    if (!pos) return null;

    return {
      display: `${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`,
      accuracy: `±${pos.accuracy}m`,
      mapsUrl: `https://www.google.com/maps?q=${pos.latitude},${pos.longitude}`
    };
  }, []);

  return {
    position,
    loading,
    error,
    getPosition,
    requestPosition,
    formatPosition
  };
};

export default useGeolocation;
