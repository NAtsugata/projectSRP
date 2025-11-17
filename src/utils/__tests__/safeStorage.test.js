// src/utils/__tests__/safeStorage.test.js
// Tests unitaires pour safeStorage

import { safeStorage } from '../safeStorage';

describe('safeStorage', () => {
  beforeEach(() => {
    // Clear storage avant chaque test
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getItem/setItem', () => {
    test('stocke et récupère une valeur', () => {
      const key = 'test_key';
      const value = 'test_value';
      
      safeStorage.setItem(key, value);
      const result = safeStorage.getItem(key);
      
      expect(result).toBe(value);
    });

    test('retourne null si clé inexistante', () => {
      const result = safeStorage.getItem('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getJSON/setJSON', () => {
    test('stocke et récupère du JSON', () => {
      const key = 'user';
      const data = { id: 1, name: 'John', active: true };
      
      safeStorage.setJSON(key, data);
      const result = safeStorage.getJSON(key);
      
      expect(result).toEqual(data);
    });

    test('retourne defaultValue si clé inexistante', () => {
      const defaultValue = { default: true };
      const result = safeStorage.getJSON('missing', defaultValue);
      
      expect(result).toEqual(defaultValue);
    });

    test('retourne defaultValue si JSON invalide', () => {
      const key = 'invalid';
      const defaultValue = { default: true };
      
      // Stocker du JSON invalide manuellement
      localStorage.setItem(key, '{invalid json}');
      const result = safeStorage.getJSON(key, defaultValue);
      
      expect(result).toEqual(defaultValue);
      // Vérifie que la donnée corrompue a été supprimée
      expect(localStorage.getItem(key)).toBeNull();
    });

    test('gère les objets complexes', () => {
      const data = {
        user: { id: 1, name: 'John' },
        settings: { theme: 'dark', lang: 'fr' },
        items: [1, 2, 3]
      };
      
      safeStorage.setJSON('complex', data);
      const result = safeStorage.getJSON('complex');
      
      expect(result).toEqual(data);
    });
  });

  describe('removeItem', () => {
    test('supprime une clé', () => {
      safeStorage.setItem('to_remove', 'value');
      expect(safeStorage.getItem('to_remove')).toBe('value');
      
      safeStorage.removeItem('to_remove');
      expect(safeStorage.getItem('to_remove')).toBeNull();
    });
  });

  describe('isAvailable', () => {
    test('retourne true si localStorage disponible', () => {
      expect(safeStorage.isAvailable('localStorage')).toBe(true);
    });

    test('retourne true si sessionStorage disponible', () => {
      expect(safeStorage.isAvailable('sessionStorage')).toBe(true);
    });
  });

  describe('storage type', () => {
    test('peut utiliser sessionStorage', () => {
      const key = 'session_test';
      const value = 'session_value';
      
      safeStorage.setItem(key, value, 'sessionStorage');
      const result = safeStorage.getItem(key, 'sessionStorage');
      
      expect(result).toBe(value);
      // Vérifie que ce n'est pas dans localStorage
      expect(localStorage.getItem(key)).toBeNull();
    });

    test('getJSON fonctionne avec sessionStorage', () => {
      const data = { session: true };
      
      safeStorage.setJSON('test', data, 'sessionStorage');
      const result = safeStorage.getJSON('test', null, 'sessionStorage');
      
      expect(result).toEqual(data);
    });
  });
});
