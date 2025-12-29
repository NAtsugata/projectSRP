// src/components/ui/LoadingFallback.js
// Composant réutilisable pour les fallbacks de Suspense

import React from 'react';

/**
 * Composant d'affichage de chargement pour Suspense
 * @param {Object} props
 * @param {string} props.message - Message de chargement personnalisé
 */
const LoadingFallback = ({ message = 'Chargement...' }) => {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingFallback;
