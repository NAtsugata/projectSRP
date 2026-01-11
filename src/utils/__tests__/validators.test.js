// src/utils/__tests__/validators.test.js
// Tests unitaires pour validators

import { describe, test, expect } from 'vitest';
import { isValidEmail, isValidPhone, validatePassword, validateFileSize } from '../validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    test('accepte les emails valides', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('test123@domain.fr')).toBe(true);
    });

    test('rejette les emails invalides', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    test('accepte les numéros français valides', () => {
      expect(isValidPhone('0612345678')).toBe(true);
      expect(isValidPhone('06 12 34 56 78')).toBe(true);
      expect(isValidPhone('06.12.34.56.78')).toBe(true);
      expect(isValidPhone('+33612345678')).toBe(true);
      expect(isValidPhone('0033612345678')).toBe(true);
    });

    test('rejette les numéros invalides', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('0012345678')).toBe(false); // commence par 00 mais pas suivi de 33
      expect(isValidPhone('abcdefghij')).toBe(false);
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('accepte les mots de passe valides', () => {
      const result = validatePassword('Password1');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('');
      expect(result.errors).toEqual([]);
    });

    test('accepte les mots de passe complexes', () => {
      const result = validatePassword('MySecureP4ss!');
      expect(result.isValid).toBe(true);
    });

    test('rejette les mots de passe trop courts', () => {
      const result = validatePassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Au moins 8 caractères');
    });

    test('rejette les mots de passe sans majuscule', () => {
      const result = validatePassword('password1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Au moins une lettre majuscule');
    });

    test('rejette les mots de passe sans minuscule', () => {
      const result = validatePassword('PASSWORD1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Au moins une lettre minuscule');
    });

    test('rejette les mots de passe sans chiffre', () => {
      const result = validatePassword('PasswordABC');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Au moins un chiffre');
    });

    test('rejette les mots de passe vides', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('requis');
    });

    test('rejette null et undefined', () => {
      expect(validatePassword(null).isValid).toBe(false);
      expect(validatePassword(undefined).isValid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    test('accepte les fichiers dans la limite', () => {
      const result = validateFileSize(5 * 1024 * 1024, 10); // 5MB, max 10MB
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('');
    });

    test('rejette les fichiers trop gros', () => {
      const result = validateFileSize(15 * 1024 * 1024, 10); // 15MB, max 10MB
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('trop volumineux');
    });

    test('utilise 10MB par défaut', () => {
      const result = validateFileSize(11 * 1024 * 1024); // 11MB, default max 10MB
      expect(result.isValid).toBe(false);
    });

    test('accepte taille exacte à la limite', () => {
      const result = validateFileSize(10 * 1024 * 1024, 10); // exactly 10MB
      expect(result.isValid).toBe(true);
    });
  });
});
