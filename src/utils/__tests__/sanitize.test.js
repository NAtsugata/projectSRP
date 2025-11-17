// src/utils/__tests__/sanitize.test.js
// Tests unitaires pour les fonctions de sanitisation

import { sanitizeHTML, sanitizeText, sanitizeURL, sanitizeObject } from '../sanitize';

describe('sanitize utils', () => {
  describe('sanitizeText', () => {
    test('supprime tous les tags HTML', () => {
      const dirty = '<script>alert("XSS")</script>Hello';
      const clean = sanitizeText(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
    });

    test('échappe les caractères dangereux', () => {
      const dirty = '<img onerror="alert(1)" src=x>';
      const clean = sanitizeText(dirty);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('<img');
    });

    test('retourne chaîne vide pour entrée invalide', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText('')).toBe('');
    });

    test('préserve le texte normal', () => {
      const text = 'Ceci est un texte normal';
      expect(sanitizeText(text)).toBe(text);
    });
  });

  describe('sanitizeHTML', () => {
    test('permet les tags autorisés', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      const clean = sanitizeHTML(html);
      expect(clean).toContain('<p>');
      expect(clean).toContain('<strong>');
    });

    test('supprime les scripts', () => {
      const html = '<p>Safe</p><script>alert("XSS")</script>';
      const clean = sanitizeHTML(html);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>');
    });

    test('supprime les event handlers', () => {
      const html = '<div onclick="alert(1)">Click</div>';
      const clean = sanitizeHTML(html);
      expect(clean).not.toContain('onclick');
    });
  });

  describe('sanitizeURL', () => {
    test('accepte les URLs HTTP/HTTPS', () => {
      expect(sanitizeURL('https://example.com')).toBe('https://example.com');
      expect(sanitizeURL('http://example.com')).toBe('http://example.com');
    });

    test('accepte les URLs mailto et tel', () => {
      expect(sanitizeURL('mailto:test@example.com')).toBe('mailto:test@example.com');
      expect(sanitizeURL('tel:+33612345678')).toBe('tel:+33612345678');
    });

    test('rejette les protocoles dangereux', () => {
      expect(sanitizeURL('javascript:alert(1)')).toBe('');
      expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('retourne vide pour entrée invalide', () => {
      expect(sanitizeURL('')).toBe('');
      expect(sanitizeURL(null)).toBe('');
      expect(sanitizeURL('not a url')).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    test('nettoie toutes les chaînes d\'un objet', () => {
      const dirty = {
        name: '<script>alert(1)</script>John',
        email: 'test@example.com',
        bio: '<p>Hello</p>'
      };
      const clean = sanitizeObject(dirty);
      expect(clean.name).not.toContain('<script>');
      expect(clean.name).toContain('John');
      expect(clean.email).toBe('test@example.com');
    });

    test('gère les objets imbriqués', () => {
      const dirty = {
        user: {
          name: '<b>Test</b>',
          profile: {
            bio: '<script>XSS</script>'
          }
        }
      };
      const clean = sanitizeObject(dirty);
      expect(clean.user.profile.bio).not.toContain('<script>');
    });

    test('gère les tableaux', () => {
      const dirty = {
        items: ['<script>1</script>', 'safe', '<b>bold</b>']
      };
      const clean = sanitizeObject(dirty);
      expect(clean.items[0]).not.toContain('<script>');
      expect(clean.items[1]).toBe('safe');
    });
  });
});
