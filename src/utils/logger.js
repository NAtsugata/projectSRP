// src/utils/logger.js - Système de logging configuré pour dev/production
// En production, seules les erreurs sont loggées
// En développement, tous les logs sont affichés

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  warn: (...args) => {
    // Les warnings sont toujours affichés
    console.warn(...args);
  },

  error: (...args) => {
    // Les erreurs sont toujours affichées
    console.error(...args);
  },

  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  // Fonction spéciale pour les logs avec emoji (style du code actuel)
  emoji: (emoji, message, ...rest) => {
    if (isDevelopment) {
      console.log(`${emoji} ${message}`, ...rest);
    }
  }
};

export default logger;
