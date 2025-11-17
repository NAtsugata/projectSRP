// src/utils/alertOverride.js
// Override window.alert pour utiliser des toasts à la place

/**
 * Configuration globale pour l'override de alert()
 * Cette variable sera définie par App.js pour pointer vers showToast
 */
let toastFunction = null;

/**
 * Configure la fonction de toast à utiliser
 * @param {Function} fn - Fonction showToast de App.js
 */
export const setToastFunction = (fn) => {
  toastFunction = fn;
};

/**
 * Fonction de fallback si toast pas disponible
 */
const fallbackAlert = (message) => {
  console.warn('Toast non disponible, fallback vers alert:', message);
  // Utiliser l'alert natif sauvegardé
  if (window._originalAlert) {
    window._originalAlert(message);
  }
};

/**
 * Analyse le message pour déterminer le type de toast
 * @param {string} message - Message à analyser
 * @returns {{ type: string, message: string }}
 */
const analyzeMessage = (message) => {
  const str = String(message);

  // Succès
  if (str.includes('✅') || str.toLowerCase().includes('succès') || str.toLowerCase().includes('réussi')) {
    return { type: 'success', message: str };
  }

  // Erreur
  if (str.includes('❌') || str.toLowerCase().includes('erreur') || str.toLowerCase().includes('échec')) {
    return { type: 'error', message: str };
  }

  // Warning
  if (str.includes('⚠️') || str.toLowerCase().includes('attention') || str.toLowerCase().includes('obligatoire')) {
    return { type: 'warning', message: str };
  }

  // Info par défaut
  return { type: 'info', message: str };
};

/**
 * Remplace window.alert par un toast
 */
export const overrideAlert = () => {
  // Sauvegarder l'alert original pour fallback
  if (!window._originalAlert) {
    window._originalAlert = window.alert;
  }

  // Override alert
  window.alert = (message) => {
    if (!message) return;

    // Si toast disponible, l'utiliser
    if (toastFunction && typeof toastFunction === 'function') {
      const { type, message: msg } = analyzeMessage(message);
      toastFunction(msg, type);
    } else {
      // Sinon fallback vers alert natif
      fallbackAlert(message);
    }
  };

  console.log('✅ alert() overridden - utilise maintenant des toasts');
};

/**
 * Restaure window.alert à sa fonction originale
 */
export const restoreAlert = () => {
  if (window._originalAlert) {
    window.alert = window._originalAlert;
    console.log('✅ alert() restauré à la fonction native');
  }
};

export default {
  setToastFunction,
  overrideAlert,
  restoreAlert
};
