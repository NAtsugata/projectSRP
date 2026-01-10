// src/utils/consoleOverride.js
// Override console methods en production pour éviter les logs inutiles

// Vite utilise import.meta.env.PROD (true en production)
const isProduction = import.meta.env.PROD;

if (isProduction) {
  // Sauvegarder les méthodes originales pour les erreurs
  const originalError = console.error;
  const originalWarn = console.warn;

  // Désactiver console.log, console.info, console.debug en production
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};

  // Garder console.error et console.warn actifs
  console.error = originalError;
  console.warn = originalWarn;
}

const consoleOverride = { isProduction };
export default consoleOverride;
