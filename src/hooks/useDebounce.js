// src/hooks/useDebounce.js
// Hook pour debouncer une valeur (utile pour recherche, auto-save, etc.)

import { useState, useEffect } from 'react';

/**
 * Hook pour debouncer une valeur
 * @param {*} value - Valeur à debouncer
 * @param {number} delay - Délai en ms (défaut: 500ms)
 * @returns {*} Valeur debouncée
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Met à jour la valeur debouncée après le délai
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Annule le timeout si la valeur change avant la fin du délai
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
