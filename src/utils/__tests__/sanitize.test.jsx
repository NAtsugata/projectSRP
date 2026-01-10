// src/utils/__tests__/sanitize.test.js
// Tests unitaires pour les fonctions de sanitisation - Version améliorée

import {
  sanitizeHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeObject,
  sanitizeFilename,
  sanitizeEmail,
  sanitizePhone,
  sanitizeAttribute,
  clearSanitizeCache,
  getCacheStats,
  SECURITY_LIMITS
} from '../sanitize';

describe('sanitize utils', () => {
  beforeEach(() => {
    clearSanitizeCache();
  });

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

    test('tronque les strings trop longues', () => {
      const huge = 'x'.repeat(SECURITY_LIMITS.MAX_STRING_LENGTH + 1000);
      const clean = sanitizeText(huge);
      expect(clean.length).toBe(SECURITY_LIMITS.MAX_STRING_LENGTH);
    });

    test('utilise le cache pour améliorer les performances', () => {
      const text = 'Test cache';
      sanitizeText(text);
      sanitizeText(text);
      const stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
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

    test('tronque les strings trop longues', () => {
      const huge = '<p>' + 'x'.repeat(SECURITY_LIMITS.MAX_STRING_LENGTH + 1000) + '</p>';
      const clean = sanitizeHTML(huge);
      expect(clean.length).toBeLessThanOrEqual(SECURITY_LIMITS.MAX_STRING_LENGTH + 10);
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

    test('accepte les URLs relatives par défaut', () => {
      expect(sanitizeURL('/path/to/page')).toBe('/path/to/page');
      expect(sanitizeURL('#anchor')).toBe('#anchor');
      expect(sanitizeURL('?query=value')).toBe('?query=value');
    });

    test('rejette les URLs relatives si désactivé', () => {
      expect(sanitizeURL('/path', { allowRelative: false })).toBe('');
      expect(sanitizeURL('#anchor', { allowRelative: false })).toBe('');
    });

    test('rejette les protocoles dangereux', () => {
      expect(sanitizeURL('javascript:alert(1)')).toBe('');
      expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    test('rejette javascript: dans les URLs relatives', () => {
      expect(sanitizeURL('/path?javascript:alert(1)')).toBe('');
      expect(sanitizeURL('#javascript:alert(1)')).toBe('');
    });

    test('retourne vide pour entrée invalide', () => {
      expect(sanitizeURL('')).toBe('');
      expect(sanitizeURL(null)).toBe('');
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

    test('protège contre les références circulaires', () => {
      const obj = { name: 'test' };
      obj.self = obj;
      const clean = sanitizeObject(obj);
      expect(clean.self).toBe('[Circular]');
    });

    test('préserve les types spéciaux (Date, RegExp)', () => {
      const date = new Date('2024-01-01');
      const regex = /test/gi;
      const obj = { date, regex };
      const clean = sanitizeObject(obj);
      expect(clean.date).toBeInstanceOf(Date);
      expect(clean.date.getTime()).toBe(date.getTime());
      expect(clean.regex).toBeInstanceOf(RegExp);
      expect(clean.regex.source).toBe('test');
    });

    test('gère les Map et Set', () => {
      const map = new Map([['key', '<script>value</script>']]);
      const set = new Set(['<script>item</script>']);
      const obj = { map, set };
      const clean = sanitizeObject(obj);
      expect(clean.map).toBeInstanceOf(Map);
      expect(clean.set).toBeInstanceOf(Set);
      expect(clean.map.get('key')).not.toContain('<script>');
    });

    test('limite la profondeur de récursion', () => {
      let deep = { value: 'test' };
      for (let i = 0; i < 20; i++) {
        deep = { nested: deep };
      }
      const clean = sanitizeObject(deep);
      // Devrait s'arrêter à MAX_OBJECT_DEPTH
      expect(clean).toBeDefined();
    });

    test('limite le nombre d\'éléments dans les tableaux', () => {
      const huge = Array(SECURITY_LIMITS.MAX_ARRAY_LENGTH + 1000).fill('test');
      const clean = sanitizeObject({ items: huge });
      expect(clean.items.length).toBe(SECURITY_LIMITS.MAX_ARRAY_LENGTH);
    });

    test('limite le nombre de clés dans les objets', () => {
      const huge = {};
      for (let i = 0; i < SECURITY_LIMITS.MAX_OBJECT_KEYS + 100; i++) {
        huge[`key${i}`] = 'value';
      }
      const clean = sanitizeObject(huge);
      expect(Object.keys(clean).length).toBeLessThanOrEqual(SECURITY_LIMITS.MAX_OBJECT_KEYS);
    });

    test('peut sanitizer les clés d\'objet', () => {
      const dirty = {
        '<script>key</script>': 'value'
      };
      const clean = sanitizeObject(dirty, true, { sanitizeKeys: true });
      const keys = Object.keys(clean);
      expect(keys[0]).not.toContain('<script>');
    });
  });

  describe('sanitizeFilename', () => {
    test('retire les caractères dangereux', () => {
      expect(sanitizeFilename('file<>.txt')).toBe('file.txt');
      expect(sanitizeFilename('file/path\\test.pdf')).toBe('filepathtest.pdf');
      expect(sanitizeFilename('file:name.txt')).toBe('filename.txt');
    });

    test('retire les points au début', () => {
      expect(sanitizeFilename('..hidden.txt')).toBe('hidden.txt');
      expect(sanitizeFilename('.config')).toBe('config');
    });

    test('limite la longueur à 255 caractères', () => {
      const long = 'a'.repeat(300) + '.txt';
      const clean = sanitizeFilename(long);
      expect(clean.length).toBe(255);
    });

    test('retourne un nom par défaut si vide', () => {
      expect(sanitizeFilename('')).toBe('fichier-sans-nom');
      expect(sanitizeFilename('...')).toBe('fichier-sans-nom');
      expect(sanitizeFilename('<>:|')).toBe('fichier-sans-nom');
    });

    test('normalise les espaces multiples', () => {
      expect(sanitizeFilename('file    name.txt')).toBe('file name.txt');
    });
  });

  describe('sanitizeEmail', () => {
    test('accepte les emails valides', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('user.name+tag@example.co.uk')).toBe('user.name+tag@example.co.uk');
    });

    test('normalise en minuscules', () => {
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    test('retire les espaces', () => {
      expect(sanitizeEmail('  test@example.com  ')).toBe('test@example.com');
    });

    test('rejette les emails invalides', () => {
      expect(sanitizeEmail('not-an-email')).toBe('');
      expect(sanitizeEmail('missing@domain')).toBe('');
      expect(sanitizeEmail('@example.com')).toBe('');
      expect(sanitizeEmail('test@')).toBe('');
    });

    test('rejette les emails trop longs (RFC 5321)', () => {
      const long = 'a'.repeat(250) + '@example.com';
      expect(sanitizeEmail(long)).toBe('');
    });

    test('retourne vide pour entrée invalide', () => {
      expect(sanitizeEmail('')).toBe('');
      expect(sanitizeEmail(null)).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    test('accepte les numéros avec formatage', () => {
      expect(sanitizePhone('+33 6 12 34 56 78')).toBe('+33 6 12 34 56 78');
      expect(sanitizePhone('(123) 456-7890')).toBe('(123) 456-7890');
    });

    test('retire les caractères non autorisés', () => {
      expect(sanitizePhone('abc123-456-7890xyz')).toBe('123-456-7890');
      expect(sanitizePhone('+33.6.12.34')).toBe('+3361234'); // Les points sont retirés
    });

    test('limite la longueur à 20 caractères', () => {
      const long = '+33 6 12 34 56 78 90 12 34 56';
      const clean = sanitizePhone(long);
      expect(clean.length).toBeLessThanOrEqual(20);
    });

    test('retourne vide pour entrée invalide', () => {
      expect(sanitizePhone('')).toBe('');
      expect(sanitizePhone(null)).toBe('');
    });
  });

  describe('sanitizeAttribute', () => {
    test('retire les caractères dangereux', () => {
      expect(sanitizeAttribute('value"with\'quotes')).toBe('valuewithquotes');
      expect(sanitizeAttribute('<script>attr</script>')).toBe('scriptattr/script');
    });

    test('limite la longueur', () => {
      const long = 'a'.repeat(2000);
      const clean = sanitizeAttribute(long);
      expect(clean.length).toBe(1000);
    });

    test('retourne vide pour entrée invalide', () => {
      expect(sanitizeAttribute('')).toBe('');
      expect(sanitizeAttribute(null)).toBe('');
    });
  });

  describe('Cache', () => {
    test('getCacheStats retourne les statistiques', () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
    });

    test('clearSanitizeCache vide le cache', () => {
      sanitizeText('test1');
      sanitizeText('test2');
      let stats = getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      clearSanitizeCache();
      stats = getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('SECURITY_LIMITS', () => {
    test('exporte les limites de sécurité', () => {
      expect(SECURITY_LIMITS).toHaveProperty('MAX_STRING_LENGTH');
      expect(SECURITY_LIMITS).toHaveProperty('MAX_OBJECT_DEPTH');
      expect(SECURITY_LIMITS).toHaveProperty('MAX_ARRAY_LENGTH');
      expect(SECURITY_LIMITS).toHaveProperty('MAX_OBJECT_KEYS');
    });
  });
});
