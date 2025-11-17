// src/hooks/useLocalStorage.js
// Hook pour persister l'état dans localStorage

import { useState, useEffect, useCallback } from 'react';
import logger from '../utils/logger';
import { safeStorage } from '../utils/safeStorage';

/**
 * Hook pour synchroniser l'état avec localStorage
 * @param {string} key - Clé localStorage
 * @param {*} initialValue - Valeur initiale
 * @returns {Array} [value, setValue, remove]
 */
export const useLocalStorage = (key, initialValue) => {
  // Fonction pour récupérer la valeur initiale
  const getInitialValue = useCallback(() => {
    return safeStorage.getJSON(key, initialValue);
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState(getInitialValue);

  // Fonction pour sauvegarder
  // ✅ Utilise functional update pour éviter stale closure
  const setValue = useCallback((value) => {
    setStoredValue(currentValue => {
      // Utiliser functional update pour éviter stale closure
      const valueToStore = value instanceof Function
        ? value(currentValue)
        : value;

      // Sauvegarder de manière sécurisée
      safeStorage.setJSON(key, valueToStore);
      logger.log(`💾 localStorage saved: ${key}`);

      return valueToStore;
    });
  }, [key]); // ✅ Seulement key dans les deps

  // Fonction pour supprimer
  const remove = useCallback(() => {
    safeStorage.removeItem(key);
    setStoredValue(initialValue);
    logger.log(`🗑️ localStorage removed: ${key}`);
  }, [key, initialValue]);

  // Synchronise avec les changements dans d'autres onglets
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        const parsed = safeStorage.getJSON(key, null);
        if (parsed !== null) {
          setStoredValue(parsed);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue, remove];
};

export default useLocalStorage;
