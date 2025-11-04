// src/hooks/useAsync.js
// Hook pour gérer les opérations asynchrones avec loading, error et data states

import { useState, useCallback, useEffect } from 'react';

/**
 * Hook pour gérer les opérations asynchrones
 * @param {Function} asyncFunction - Fonction asynchrone à exécuter
 * @param {boolean} immediate - Exécuter immédiatement au mount
 * @returns {Object} {execute, loading, error, data, reset}
 */
export const useAsync = (asyncFunction, immediate = false) => {
  const [status, setStatus] = useState('idle'); // idle | pending | success | error
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...params) => {
      setStatus('pending');
      setData(null);
      setError(null);

      try {
        const response = await asyncFunction(...params);
        setData(response);
        setStatus('success');
        return { data: response, error: null };
      } catch (err) {
        setError(err);
        setStatus('error');
        return { data: null, error: err };
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setData(null);
    setError(null);
  }, []);

  // Exécution immédiate si demandé
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return {
    execute,
    loading: status === 'pending',
    error,
    data,
    status,
    reset,
    isIdle: status === 'idle',
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error'
  };
};

export default useAsync;
