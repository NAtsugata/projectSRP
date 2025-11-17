// src/hooks/useDebounce.js
// Hook React pour debouncer les valeurs et fonctions

import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce as debounceUtil } from '../utils/debounce';

/**
 * Hook pour debouncer une valeur
 * @param {*} value - Valeur à debouncer
 * @param {number} delay - Délai en ms (défaut: 500ms)
 * @returns {*} Valeur debouncée
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook pour debouncer un callback
 * @param {Function} callback - Fonction à debouncer
 * @param {number} delay - Délai en ms (défaut: 500ms)
 * @param {Object} options - Options de debounce (leading, trailing)
 * @returns {Function} Callback debouncé avec méthode cancel
 */
export const useDebouncedCallback = (callback, delay = 500, options = {}) => {
  const callbackRef = useRef(callback);
  const debouncedRef = useRef();

  // Mettre à jour la référence du callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Créer la fonction debouncée
  useEffect(() => {
    debouncedRef.current = debounceUtil(
      (...args) => callbackRef.current(...args),
      delay,
      options
    );

    return () => {
      if (debouncedRef.current && debouncedRef.current.cancel) {
        debouncedRef.current.cancel();
      }
    };
  }, [delay, options]);

  return debouncedRef.current;
};

/**
 * Hook pour un champ de recherche avec debounce
 * Gère à la fois la valeur immédiate et la valeur debouncée
 * @param {string} initialValue - Valeur initiale
 * @param {number} delay - Délai de debounce (défaut: 300ms)
 * @returns {Object} { value, debouncedValue, setValue, clear }
 */
export const useSearchInput = (initialValue = '', delay = 300) => {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, delay);

  const clear = useCallback(() => {
    setValue('');
  }, []);

  return {
    value,
    debouncedValue,
    setValue,
    clear,
    // Helpers pour l'utilisation dans les inputs
    inputProps: {
      value,
      onChange: (e) => setValue(e.target.value)
    }
  };
};

export default useDebounce;
