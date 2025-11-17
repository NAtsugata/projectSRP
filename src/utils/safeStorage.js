// src/utils/safeStorage.js
// Wrapper sécurisé pour localStorage/sessionStorage
// Gère les erreurs (mode privé, quota, JSON corrompu)

/**
 * Wrapper sécurisé pour localStorage avec gestion d'erreurs
 */
export const safeStorage = {
  /**
   * Vérifie si le storage est disponible
   */
  isAvailable(type = 'localStorage') {
    try {
      const storage = window[type];
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Récupère un item du localStorage
   */
  getItem(key, type = 'localStorage') {
    try {
      if (!this.isAvailable(type)) return null;
      return window[type].getItem(key);
    } catch (error) {
      console.error(`Failed to get item "${key}":`, error);
      return null;
    }
  },

  /**
   * Stocke un item dans le localStorage
   */
  setItem(key, value, type = 'localStorage') {
    try {
      if (!this.isAvailable(type)) return false;
      window[type].setItem(key, value);
      return true;
    } catch (error) {
      // QuotaExceededError ou SecurityError
      console.error(`Failed to set item "${key}":`, error);

      // Tenter de libérer de l'espace en supprimant les anciennes données
      if (error.name === 'QuotaExceededError') {
        this.clearOldData(type);
        // Réessayer une fois
        try {
          window[type].setItem(key, value);
          return true;
        } catch (retryError) {
          console.error(`Retry failed for "${key}":`, retryError);
          return false;
        }
      }
      return false;
    }
  },

  /**
   * Supprime un item du localStorage
   */
  removeItem(key, type = 'localStorage') {
    try {
      if (!this.isAvailable(type)) return;
      window[type].removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item "${key}":`, error);
    }
  },

  /**
   * Récupère et parse du JSON de manière sécurisée
   */
  getJSON(key, defaultValue = null, type = 'localStorage') {
    try {
      const item = this.getItem(key, type);
      if (!item) return defaultValue;

      return JSON.parse(item);
    } catch (error) {
      console.error(`JSON.parse failed for key "${key}":`, error);
      // Supprimer la donnée corrompue
      this.removeItem(key, type);
      return defaultValue;
    }
  },

  /**
   * Stringify et stocke du JSON de manière sécurisée
   */
  setJSON(key, value, type = 'localStorage') {
    try {
      const json = JSON.stringify(value);
      return this.setItem(key, json, type);
    } catch (error) {
      console.error(`JSON.stringify failed for key "${key}":`, error);
      return false;
    }
  },

  /**
   * Nettoie les données anciennes du localStorage
   * Supprime les données avec timestamp > 7 jours
   */
  clearOldData(type = 'localStorage') {
    try {
      if (!this.isAvailable(type)) return;

      const storage = window[type];
      const keysToRemove = [];
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours

      // Identifier les clés à supprimer
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;

        // Vérifier si c'est une clé avec timestamp
        if (key.includes('_timestamp')) {
          try {
            const timestamp = this.getJSON(key, null, type);
            if (timestamp && Date.now() - timestamp > maxAge) {
              const dataKey = key.replace('_timestamp', '');
              keysToRemove.push(dataKey);
              keysToRemove.push(key);
            }
          } catch (e) {
            // Supprimer les clés corrompues
            keysToRemove.push(key);
          }
        }

        // Supprimer aussi les données temporaires trop anciennes
        if (key.startsWith('temp_') || key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }

      // Supprimer les clés identifiées
      keysToRemove.forEach(key => this.removeItem(key, type));

      console.log(`🧹 Cleaned ${keysToRemove.length} old items from ${type}`);
    } catch (error) {
      console.error('Failed to clear old data:', error);
    }
  },

  /**
   * Vide complètement le storage
   */
  clear(type = 'localStorage') {
    try {
      if (!this.isAvailable(type)) return;
      window[type].clear();
    } catch (error) {
      console.error(`Failed to clear ${type}:`, error);
    }
  }
};

export default safeStorage;
