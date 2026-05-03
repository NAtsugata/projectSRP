// Tests pour validators.js
import { describe, it, expect, vi } from 'vitest';

// Mock sanitize (DOMPurify)
vi.mock('../../utils/sanitize', () => ({
    sanitizeText: vi.fn((str) => str.replace(/<[^>]*>/g, '')),
}));

// Mock fileConfig
vi.mock('../../config/fileConfig', () => ({
    fileUtils: {
        mbToBytes: (mb) => mb * 1024 * 1024,
        formatFileSize: (bytes) => `${(bytes / (1024 * 1024)).toFixed(0)} MB`,
    },
}));

const {
    isValidEmail,
    isValidPhone,
    validatePassword,
    isValidDate,
    validateDateRange,
    validateIntervention,
    validateUser,
    validateLeaveRequest,
    sanitizeString,
    validateFileSize,
    validateFileType,
} = await import('../../utils/validators');

describe('validators', () => {
    describe('isValidEmail', () => {
        it('accepte un email valide', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.fr')).toBe(true);
        });

        it('rejette un email invalide', () => {
            expect(isValidEmail('')).toBe(false);
            expect(isValidEmail(null)).toBe(false);
            expect(isValidEmail('noatsign')).toBe(false);
            expect(isValidEmail('missing@domain')).toBe(false);
        });
    });

    describe('isValidPhone', () => {
        it('accepte les numéros français valides', () => {
            expect(isValidPhone('0612345678')).toBe(true);
            expect(isValidPhone('06 12 34 56 78')).toBe(true);
            expect(isValidPhone('+33612345678')).toBe(true);
        });

        it('rejette les numéros invalides', () => {
            expect(isValidPhone('')).toBe(false);
            expect(isValidPhone(null)).toBe(false);
            expect(isValidPhone('123')).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('accepte un mot de passe valide', () => {
            const result = validatePassword('Abcdef1X');
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('rejette un mot de passe trop court', () => {
            const result = validatePassword('Ab1');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Au moins 8 caractères');
        });

        it('exige majuscule, minuscule, chiffre', () => {
            const result = validatePassword('abcdefgh');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Au moins une lettre majuscule');
            expect(result.errors).toContain('Au moins un chiffre');
        });

        it('rejette null/undefined', () => {
            expect(validatePassword(null).isValid).toBe(false);
            expect(validatePassword(undefined).isValid).toBe(false);
        });
    });

    describe('isValidDate', () => {
        it('accepte une date valide', () => {
            expect(isValidDate('2025-01-15')).toBe(true);
        });

        it('rejette une date invalide', () => {
            expect(isValidDate('')).toBe(false);
            expect(isValidDate(null)).toBe(false);
            expect(isValidDate('not-a-date')).toBe(false);
        });
    });

    describe('validateDateRange', () => {
        it('accepte une plage valide', () => {
            const result = validateDateRange('2025-01-01', '2025-01-31');
            expect(result.isValid).toBe(true);
        });

        it('rejette quand début > fin', () => {
            const result = validateDateRange('2025-02-01', '2025-01-01');
            expect(result.isValid).toBe(false);
        });

        it('rejette des dates invalides', () => {
            expect(validateDateRange('invalid', '2025-01-01').isValid).toBe(false);
            expect(validateDateRange('2025-01-01', 'invalid').isValid).toBe(false);
        });
    });

    describe('validateIntervention', () => {
        const validIntervention = {
            client: 'Test Client',
            client_phone: '0612345678',
            address: '123 Rue Test',
            service: 'Installation',
            date: '2025-06-15',
            time: '09:00',
        };

        it('accepte une intervention valide', () => {
            const errors = validateIntervention(validIntervention);
            expect(Object.keys(errors)).toHaveLength(0);
        });

        it('rejette si le client est manquant', () => {
            const errors = validateIntervention({ ...validIntervention, client: '' });
            expect(errors.client).toBe('Le nom du client est requis');
        });

        it('rejette un téléphone invalide', () => {
            const errors = validateIntervention({ ...validIntervention, client_phone: '123' });
            expect(errors.client_phone).toBeDefined();
        });

        it('valide optionnellement email et téléphone secondaire', () => {
            const errors = validateIntervention({
                ...validIntervention,
                client_email: 'invalid',
                secondary_phone: '123',
            });
            expect(Object.keys(errors).length).toBeGreaterThanOrEqual(2);
            expect(errors.client_email).toBeDefined();
            expect(errors.secondary_phone).toBeDefined();
        });
    });

    describe('validateUser', () => {
        it('accepte un utilisateur valide', () => {
            expect(validateUser({ full_name: 'Jean Dupont' }).isValid).toBe(true);
        });

        it('rejette un nom trop court', () => {
            expect(validateUser({ full_name: 'J' }).isValid).toBe(false);
        });

        it('rejette un nom trop long', () => {
            expect(validateUser({ full_name: 'A'.repeat(101) }).isValid).toBe(false);
        });
    });

    describe('validateLeaveRequest', () => {
        it('accepte une demande valide', () => {
            const result = validateLeaveRequest({
                startDate: '2025-06-01',
                endDate: '2025-06-05',
                reason: 'Vacances',
            });
            expect(result.isValid).toBe(true);
        });

        it('rejette sans motif', () => {
            const result = validateLeaveRequest({
                startDate: '2025-06-01',
                endDate: '2025-06-05',
                reason: '',
            });
            expect(result.isValid).toBe(false);
        });

        it('rejette un motif trop long', () => {
            const result = validateLeaveRequest({
                startDate: '2025-06-01',
                endDate: '2025-06-05',
                reason: 'A'.repeat(501),
            });
            expect(result.isValid).toBe(false);
        });
    });

    describe('sanitizeString', () => {
        it('retourne une string nettoyée', () => {
            expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
        });

        it('retourne vide pour non-string', () => {
            expect(sanitizeString(123)).toBe('');
            expect(sanitizeString(null)).toBe('');
        });

        it('tronque à 1000 caractères', () => {
            const long = 'A'.repeat(1500);
            expect(sanitizeString(long).length).toBe(1000);
        });
    });

    describe('validateFileSize', () => {
        it('accepte un fichier sous la limite', () => {
            expect(validateFileSize(5 * 1024 * 1024).isValid).toBe(true);
        });

        it('rejette un fichier trop gros', () => {
            expect(validateFileSize(15 * 1024 * 1024).isValid).toBe(false);
        });
    });

    describe('validateFileType', () => {
        it('accepte les types autorisés', () => {
            expect(validateFileType('photo.jpg').isValid).toBe(true);
            expect(validateFileType('doc.pdf').isValid).toBe(true);
        });

        it('rejette les types non autorisés', () => {
            expect(validateFileType('script.exe').isValid).toBe(false);
        });

        it('rejette un nom vide', () => {
            expect(validateFileType('').isValid).toBe(false);
            expect(validateFileType(null).isValid).toBe(false);
        });
    });
});
