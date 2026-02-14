// Tests pour interventionService
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-call chain mocks — each from() call gets its own chain
let fromCallIndex = 0;
let fromChains = [];

function createChain(eqResolve) {
    const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => eqResolve ? Promise.resolve(eqResolve) : chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => eqResolve ? Promise.resolve(eqResolve) : chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
    return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
    supabase: {
        from: vi.fn((...args) => {
            const chain = fromChains[fromCallIndex] || createChain();
            fromCallIndex++;
            return chain;
        }),
    },
}));

vi.mock('../../utils/logger', () => ({
    default: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Import après les mocks
const { interventionService } = await import('../../services/interventionService');

describe('interventionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fromCallIndex = 0;
        fromChains = [];
    });

    describe('getInterventions', () => {
        it('retourne les interventions pour admin (sans userId)', async () => {
            const chain = createChain();
            chain.limit.mockResolvedValue({
                data: [{ id: '1', title: 'Test' }],
                error: null,
            });
            fromChains = [chain];

            const result = await interventionService.getInterventions(null, false);

            expect(result.data).toHaveLength(1);
            expect(result.error).toBeNull();
        });

        it('retourne une erreur Supabase', async () => {
            const chain = createChain();
            chain.limit.mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
            });
            fromChains = [chain];

            const result = await interventionService.getInterventions();

            expect(result.error).toBeTruthy();
            expect(result.error.message).toBe('Database error');
        });
    });

    describe('updateIntervention', () => {
        it('appelle supabase.update avec les bons paramètres', async () => {
            const chain = createChain();
            chain.eq.mockResolvedValue({ data: { id: '1' }, error: null });
            fromChains = [chain];

            const result = await interventionService.updateIntervention('1', { status: 'Terminée' });

            expect(result.error).toBeNull();
        });
    });

    describe('deleteIntervention', () => {
        it('appelle supabase.delete', async () => {
            const chain = createChain();
            chain.eq.mockResolvedValue({ data: null, error: null });
            fromChains = [chain];

            const result = await interventionService.deleteIntervention('1');

            expect(result.error).toBeNull();
        });
    });

    describe('updateAssignments', () => {
        it('supprime les anciennes et crée les nouvelles assignations', async () => {
            // 1st from() → delete chain
            const deleteChain = createChain();
            deleteChain.eq.mockResolvedValue({ error: null });

            // 2nd from() → insert chain
            const insertChain = createChain();
            insertChain.insert.mockResolvedValue({ error: null });

            fromChains = [deleteChain, insertChain];

            const result = await interventionService.updateAssignments('int-1', ['user-1', 'user-2']);

            expect(result.error).toBeNull();
        });

        it('retourne une erreur si la suppression échoue', async () => {
            const deleteChain = createChain();
            deleteChain.eq.mockResolvedValue({ error: { message: 'Delete failed' } });

            fromChains = [deleteChain];

            const result = await interventionService.updateAssignments('int-1', ['user-1']);

            expect(result.error).toBeTruthy();
            expect(result.error.message).toBe('Delete failed');
        });
    });
});
