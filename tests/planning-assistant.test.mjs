import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanningCommand, proposePlanning, slotAvailable, parisDay, planningBacklog } from '../src/utils/planningAssistant.js';
const context = { employees: [{ id: 'a', full_name: 'Tiemoko Traoré' }, { id: 'b', full_name: 'Reymond Sébastien' }], clients: [{ id: 'c', name: 'Leneutre' }], now: new Date('2026-11-01T12:00:00Z') };
test('two named people and two relative dates create exactly two joint proposals', () => {
    const parsed = parsePlanningCommand('tiemoko et seb rendezvous leneutre demain et apres demain', context);
    assert.deepEqual(parsed.dates, ['2026-11-02','2026-11-03']);
    const plan = proposePlanning(parsed, {});
    assert.equal(plan.bookings.length, 2);
    assert.deepEqual(plan.bookings[0].staffIds, ['a','b']);
    assert.equal(plan.bookings[0].time, '08:00');
    assert.equal(plan.bookings[0].duration, 60);
});
test('ambiguous staff or clients require clarification', () => {
    assert.match(parsePlanningCommand('seb rdv Leneutre demain', { ...context, employees: [...context.employees, { id: 'd', full_name: 'Sebastien Dupont' }] }).error, /Plusieurs personnes/);
    assert.match(parsePlanningCommand('seb rdv Leneutre demain', { ...context, clients: [...context.clients, { id: 'd', name: 'Leneutre SARL' }] }).error, /Plusieurs clients/);
});
test('Paris dates work across UTC midnight and daylight saving changes', () => {
    assert.equal(parisDay(new Date('2026-10-31T23:30:00Z')), '2026-11-01');
    assert.deepEqual(parsePlanningCommand('seb rdv Leneutre après-demain', { ...context, now: new Date('2026-10-24T23:30:00Z') }).dates, ['2026-10-27']);
});
test('requested time is preserved only if free, never moved silently', () => {
    const parsed = parsePlanningCommand('seb rdv chez Leneutre demain à 9h pendant 2h', context);
    assert.equal(parsed.duration, 120);
    const result = proposePlanning(parsed, { absences: [{ employee_id: 'b', start_date: '2026-11-02', end_date: '2026-11-02' }] });
    assert.equal(result.bookings[0].time, '');
    assert.deepEqual(result.conflicts, ['2026-11-02']);
});
test('availability excludes lunch, absences, approved leave and unknown legacy duration', () => {
    const slot = { date: '2026-11-02', time: '09:00', duration: 60, staffIds: ['b'] };
    assert.equal(slotAvailable(slot, {}), true);
    assert.equal(slotAvailable({ ...slot, time: '11:30' }, {}), false);
    assert.equal(slotAvailable(slot, { leaves: [{ user_id: 'b', status: 'Approuvée', start_date: slot.date, end_date: slot.date }] }), false);
    const appointment = { date: slot.date, time: '14:00:00', duration_minutes: null, intervention_assignments: [{ user_id: 'b' }], status: 'Planifiée' };
    assert.equal(slotAvailable(slot, { interventions: [appointment] }), false);
    assert.equal(slotAvailable(slot, { interventions: [{ ...appointment, duration_minutes: 60 }] }), true);
    assert.equal(slotAvailable({ ...slot, time: '14:30' }, { interventions: [{ ...appointment, duration_minutes: 60 }] }), false);
});
test('backlog excludes archived, cancelled, completed and future interventions', () => {
    const rows = [{ id: 1, date: '2026-10-30', status: 'Planifiée' }, { id: 2, date: '2026-11-02', status: 'Planifiée' }, { id: 3, date: '2026-10-30', status: 'Terminée' }];
    assert.deepEqual(planningBacklog(rows, context.now).map(r => r.id), [1]);
});
