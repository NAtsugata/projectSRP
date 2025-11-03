// src/hooks/useLocalStorage.js
// Hook pour persister l'état dans localStorage

import { useState, useEffect, useCallback } from 'react';
import logger from '../utils/logger';

/**
 * Hook pour synchroniser l'état avec localStorage
 * @param {string} key - Clé localStorage
 * @param {*} initialValue - Valeur initiale
 * @returns {Array} [value, setValue, remove]
 */
export const useLocalStorage = (key, initialValue) => {
  // Fonction pour récupérer la valeur initiale
  const getInitialValue = useCallback(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.warn(`Erreur lecture localStorage pour clé "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState(getInitialValue);

  // Fonction pour sauvegarder
  const setValue = useCallback((value) => {
    try {
      // Permet de passer une fonction comme avec useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      setStoredValue(valueToStore);

      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      logger.log(`💾 localStorage saved: ${key}`);
    } catch (error) {
      logger.error(`Erreur sauvegarde localStorage pour clé "${key}":`, error);
    }
  }, [key, storedValue]);

  // Fonction pour supprimer
  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      logger.log(`🗑️ localStorage removed: ${key}`);
    } catch (error) {
      logger.error(`Erreur suppression localStorage pour clé "${key}":`, error);
    }
  }, [key, initialValue]);

  // Synchronise avec les changements dans d'autres onglets
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          logger.warn('Erreur parsing storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, remove];
};

export default useLocalStorage;
