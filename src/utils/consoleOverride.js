// src/utils/consoleOverride.js
// Override console methods en production pour éviter les logs inutiles

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Sauvegarder les méthodes originales pour les erreurs
  const originalError = console.error;
  const originalWarn = console.warn;

  // Désactiver console.log, console.info, console.debug en production
  console.log = () => { };
  console.info = () => { };
  console.debug = () => { };

  // Garder console.error et console.warn actifs (mais on pourrait les filtrer aussi)
  console.error = originalError;
  console.warn = originalWarn;

  // Message de confirmation (une seule fois au démarrage)
  originalError('🔇 Mode production : console.log désactivé. Seules les erreurs et warnings sont affichés.');
}

const consoleOverride = { isProduction };
export default consoleOverride;
