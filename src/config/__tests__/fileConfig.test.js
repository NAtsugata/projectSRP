// src/config/__tests__/fileConfig.test.js
// Tests unitaires pour fileConfig

import { FILE_SIZE, ACCEPTED_TYPES, fileUtils } from '../fileConfig';

describe('fileConfig', () => {
  describe('FILE_SIZE constants', () => {
    test('définit les constantes de base correctement', () => {
      expect(FILE_SIZE.KB).toBe(1024);
      expect(FILE_SIZE.MB).toBe(1024 * 1024);
      expect(FILE_SIZE.GB).toBe(1024 * 1024 * 1024);
    });

    test('définit les limites par type', () => {
      expect(FILE_SIZE.MAX_IMAGE).toBe(10 * 1024 * 1024);
      expect(FILE_SIZE.MAX_DOCUMENT).toBe(20 * 1024 * 1024);
      expect(FILE_SIZE.MAX_PDF).toBe(20 * 1024 * 1024);
    });
  });

  describe('ACCEPTED_TYPES', () => {
    test('contient les types d\'images', () => {
      expect(ACCEPTED_TYPES.IMAGES).toContain('image/jpeg');
      expect(ACCEPTED_TYPES.IMAGES).toContain('image/png');
      expect(ACCEPTED_TYPES.IMAGES).toContain('image/webp');
    });

    test('contient les types de documents', () => {
      expect(ACCEPTED_TYPES.DOCUMENTS).toContain('application/pdf');
      expect(ACCEPTED_TYPES.DOCUMENTS).toContain('text/csv');
    });

    test('ALL combine tous les types', () => {
      expect(ACCEPTED_TYPES.ALL.length).toBeGreaterThan(0);
      expect(ACCEPTED_TYPES.ALL).toContain('image/jpeg');
      expect(ACCEPTED_TYPES.ALL).toContain('application/pdf');
    });
  });

  describe('fileUtils.formatFileSize', () => {
    test('formate les bytes correctement', () => {
      expect(fileUtils.formatFileSize(0)).toBe('0 B');
      expect(fileUtils.formatFileSize(500)).toBe('500 B');
      expect(fileUtils.formatFileSize(1024)).toBe('1 KB');
      expect(fileUtils.formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(fileUtils.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    test('formate avec décimales', () => {
      expect(fileUtils.formatFileSize(1536, 1)).toBe('1.5 KB'); // 1.5KB
      expect(fileUtils.formatFileSize(1024 * 1024 * 2.5, 1)).toBe('2.5 MB');
    });
  });

  describe('fileUtils.mbToBytes', () => {
    test('convertit MB en bytes', () => {
      expect(fileUtils.mbToBytes(1)).toBe(1024 * 1024);
      expect(fileUtils.mbToBytes(10)).toBe(10 * 1024 * 1024);
      expect(fileUtils.mbToBytes(0.5)).toBe(512 * 1024);
    });
  });

  describe('fileUtils.bytesToMB', () => {
    test('convertit bytes en MB', () => {
      expect(fileUtils.bytesToMB(1024 * 1024)).toBe(1);
      expect(fileUtils.bytesToMB(10 * 1024 * 1024)).toBe(10);
      expect(fileUtils.bytesToMB(512 * 1024)).toBe(0.5);
    });
  });

  describe('fileUtils.isImage', () => {
    test('identifie les types d\'images', () => {
      expect(fileUtils.isImage('image/jpeg')).toBe(true);
      expect(fileUtils.isImage('image/png')).toBe(true);
      expect(fileUtils.isImage('image/webp')).toBe(true);
      expect(fileUtils.isImage('image/gif')).toBe(true);
    });

    test('rejette les non-images', () => {
      expect(fileUtils.isImage('application/pdf')).toBe(false);
      expect(fileUtils.isImage('text/plain')).toBe(false);
      expect(fileUtils.isImage('video/mp4')).toBe(false);
    });
  });

  describe('fileUtils.isDocument', () => {
    test('identifie les documents', () => {
      expect(fileUtils.isDocument('application/pdf')).toBe(true);
      expect(fileUtils.isDocument('application/msword')).toBe(true);
      expect(fileUtils.isDocument('text/plain')).toBe(true);
    });

    test('rejette les non-documents', () => {
      expect(fileUtils.isDocument('image/jpeg')).toBe(false);
      expect(fileUtils.isDocument('video/mp4')).toBe(false);
    });
  });

  describe('fileUtils.getMaxSize', () => {
    test('retourne la bonne taille pour images', () => {
      expect(fileUtils.getMaxSize('image', '2G')).toBe(FILE_SIZE.MAX_IMAGE_MOBILE_2G);
      expect(fileUtils.getMaxSize('image', '4G')).toBe(FILE_SIZE.MAX_IMAGE_MOBILE_4G);
    });

    test('retourne la bonne taille pour documents', () => {
      expect(fileUtils.getMaxSize('document')).toBe(FILE_SIZE.MAX_DOCUMENT);
      expect(fileUtils.getMaxSize('pdf')).toBe(FILE_SIZE.MAX_PDF);
    });

    test('retourne la bonne taille pour contextes spécifiques', () => {
      expect(fileUtils.getMaxSize('vault')).toBe(FILE_SIZE.MAX_VAULT_FILE);
      expect(fileUtils.getMaxSize('expense')).toBe(FILE_SIZE.MAX_EXPENSE_RECEIPT);
    });
  });

  describe('fileUtils.validateFile', () => {
    test('accepte les fichiers valides', () => {
      const file = { name: 'test.jpg', size: 5 * 1024 * 1024 }; // 5MB
      const result = fileUtils.validateFile(file, 10 * 1024 * 1024); // max 10MB
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('rejette les fichiers trop gros', () => {
      const file = { name: 'huge.jpg', size: 15 * 1024 * 1024 }; // 15MB
      const result = fileUtils.validateFile(file, 10 * 1024 * 1024); // max 10MB
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('trop volumineux');
    });

    test('gère les fichiers null', () => {
      const result = fileUtils.validateFile(null, 10 * 1024 * 1024);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Aucun fichier');
    });
  });
});
