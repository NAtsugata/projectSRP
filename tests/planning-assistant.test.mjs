import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanningCommand, validatePlanningDraft, proposePlanning, slotAvailable, parisDay, planningBacklog } from '../src/utils/planningAssistant.js';
const context = { employees: [{ id: 'a', full_name: 'Tiemoko Traoré' }, { id: 'b', full_name: 'Reymond Sébastien' }], clients: [{ id: 'c', name: 'Leneutre' }], now: new Date('2026-11-01T12:00:00Z') };

test('full days create morning and afternoon on every requested date',()=>{
    const parsed=parsePlanningCommand('Tiemoko chez Leneutre demain et après-demain toute la journée',context);
    assert.equal(parsed.error,undefined);
    const plan=proposePlanning(parsed,context);
    assert.equal(plan.bookings.length,4);
    assert.deepEqual(plan.bookings.map(b=>[b.time,b.duration]),[['08:00',240],['08:00',240],['13:00',300],['13:00',300]]);
});
test('date ranges include intermediate dates',()=>{
    for(const phrase of ['du 2 au 4 novembre','du 2 au 4/11','du 02/11 au 04/11','de lundi à mercredi','du lundi au mercredi','demain pendant trois jours']){
        const parsed=parsePlanningCommand(`Tiemoko chez Leneutre ${phrase}`,context);
        assert.equal(parsed.error,undefined);assert.deepEqual(parsed.dates,['2026-11-02','2026-11-03','2026-11-04']);
    }
});
test('multiple sites reserve each previous slot within the proposed batch',()=>{
    const ctx={...context,clients:[...context.clients,{id:'d',name:'Dupont'}]};
    const parsed=parsePlanningCommand('Tiemoko chez Leneutre demain puis chez Dupont',ctx);
    assert.equal(parsed.error,undefined);const plan=proposePlanning(parsed,ctx);
    assert.equal(plan.bookings.length,2);assert.deepEqual(plan.bookings.map(b=>[b.clientId,b.time]),[['c','08:00'],['d','09:00']]);
});

test('the reported sentence preserves 08:30 and resolves people after the client', () => {
    const result = parsePlanningCommand('Rendezvous demain 8h30 chez madame leneutre pour tiemoko', context);
    assert.equal(result.error, undefined);
    assert.equal(result.time, '08:30');
    assert.deepEqual(result.dates, ['2026-11-02']);
    assert.deepEqual(result.staff.map(p => p.id), ['a']);
    assert.equal(result.client.id, 'c');
});
for (const message of [
    'Rdv demain 08:30 chez Mme Leneutre avec Tiemoko',
    'Tiemoko et Seb rendez-vous demain 8h30 chez madame Leneutre',
    'Prévois Tiemoko chez Leneutre demain à 8h30.',
    'Rendez-vous pour Tiemoko demain à 8:30 chez Leneutre',
    'Demain à 8h30 Tiemoko chez Leneutre',
    'Rdv demain 8h30 Tiemoko chez Leneutre',
    'Rendez-vous chez Leneutre pour Tiemoko demain à 8 heures 30',
    'Rdv chez Leneutre avec Tiemoko demain à huit heures et demie',
    'Rdv chez Leneutre demain huit heures trente pour Tiemoko',
    'Rdv demain 8h30 chez Leneutre pour Tiemoko stp',
]) test(`natural order: ${message}`, () => {
    const result = parsePlanningCommand(message, context);
    assert.equal(result.error, undefined);
    assert.equal(result.time, '08:30');
    assert.equal(result.client.id, 'c');
    assert.ok(result.staff.some(p => p.id === 'a'));
});
test('duration is not misread as a start time and half hours are retained', () => {
    const result = parsePlanningCommand('Rdv demain 8h30 chez Leneutre pour Tiemoko pendant 1h30min', context);
    assert.equal(result.error, undefined);
    assert.equal(result.time, '08:30');
    assert.equal(result.duration, 90);
    assert.equal(parsePlanningCommand('Tiemoko rdv Leneutre demain pendant deux heures', context).time, null);
});
test('weekdays, numeric dates, month names and relative days work in Paris', () => {
    for (const [phrase,expected] of [['lundi','2026-11-02'],['mardi prochain','2026-11-03'],['dans deux jours','2026-11-03'],['le 03/11/2026','2026-11-03'],['le 3 novembre','2026-11-03'],['2026-11-03','2026-11-03']]) {
        const result = parsePlanningCommand(`Rdv ${phrase} 8h30 chez Leneutre pour Tiemoko`, context);
        assert.equal(result.error, undefined, phrase);
        assert.deepEqual(result.dates, [expected]);
    }
    const monday = { ...context, now: new Date('2026-11-02T12:00:00Z') };
    assert.deepEqual(parsePlanningCommand('Rdv lundi de la semaine prochaine chez Leneutre pour Tiemoko', monday).dates, ['2026-11-09']);
});
test('afternoon requests never silently receive a morning slot', () => {
    const parsed = parsePlanningCommand('Rdv demain après-midi chez Leneutre pour Tiemoko', context);
    assert.equal(parsed.error, undefined);
    assert.equal(proposePlanning(parsed, {}).bookings[0].time, '13:00');
});
test('a weekday beside a date is one event and conflicting weekdays ask for clarification', () => {
    const correct = parsePlanningCommand('Rdv lundi 2 novembre chez Leneutre pour Tiemoko', context);
    assert.equal(correct.error, undefined);
    assert.deepEqual(correct.dates, ['2026-11-02']);
    const wrong = parsePlanningCommand('Rdv mardi 2 novembre chez Leneutre pour Tiemoko', context);
    assert.match(wrong.error, /ne correspond pas/);
    assert.deepEqual(wrong.draft.dates, ['2026-11-02']);
});
test('uncertain commands retain recognized fields for guided completion', () => {
    const parsed = parsePlanningCommand('Rdv demain 8h30 chez Leneutre pour inconnu et Seb', context);
    assert.ok(parsed.error);
    assert.deepEqual(parsed.draft, { staffIds:['b'], clientId:'c', dates:['2026-11-02'], time:'08:30', duration:60, period:'' });
    const repaired = validatePlanningDraft({ ...parsed.draft, staffIds:['a','b'] }, context);
    assert.equal(repaired.error, undefined);
    assert.equal(repaired.time, '08:30');
    assert.ok(validatePlanningDraft({ ...parsed.draft, staffIds:['foreign'] }, context).error);
    assert.ok(validatePlanningDraft({ ...parsed.draft, clientId:'foreign' }, context).error);
});
test('unsupported constraints and destructive intents never silently create a proposal', () => {
    for (const phrase of ['demain avant 9h','demain 8h30 ou 9h30','demain 8h3','demain matin et après-midi','demain à 25h']) {
        assert.ok(parsePlanningCommand(`Rdv ${phrase} chez Leneutre pour Tiemoko`, context).error, phrase);
    }
    assert.equal(parsePlanningCommand('Annule le rdv demain chez Leneutre pour Tiemoko', context).unsupportedIntent, true);
});
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
test('a first name inside a concatenated legacy name resolves the real profile', () => {
    const joined = { ...context, employees: [{ id: 'a', full_name: 'duponttiemoko' }, context.employees[1]] };
    const parsed = parsePlanningCommand('tiemoko et seb rendezvous leneutre demain et apres demain', joined);
    assert.equal(parsed.error, undefined);
    assert.deepEqual(parsed.staff.map(p => p.id), ['a', 'b']);
    assert.equal(proposePlanning(parsed, {}).bookings.length, 2);
    assert.equal(parsePlanningCommand('dupont tiemoko et seb rdv leneutre demain', joined).staff.length, 2);
});
test('ambiguous matches expose scoped choices and resume with the selected identity', () => {
    const team = [...context.employees, { id: 'd', full_name: 'duponttiemoko' }];
    const first = parsePlanningCommand('tiemoko et seb rdv Leneutre demain', { ...context, employees: team });
    assert.deepEqual(first.staffQuestions[0].candidates.map(p => p.id), ['a','d']);
    const selected = parsePlanningCommand('tiemoko et seb rdv Leneutre demain', { ...context, employees: team, staffChoices: { tiemoko: 'd' } });
    assert.deepEqual(selected.staff.map(p => p.id), ['d','b']);
    assert.ok(parsePlanningCommand('tiemoko et seb rdv Leneutre demain', { ...context, employees: team, staffChoices: { tiemoko: 'foreign-tenant-id' } }).error);
});
test('unknown names offer real entity profiles without silently replacing them', () => {
    const result = parsePlanningCommand('inconnu et seb rdv Leneutre demain', context);
    assert.ok(result.error);
    assert.deepEqual(result.staffQuestions[0].candidates.map(p => p.id), ['a','b']);
    assert.ok(parsePlanningCommand('ali rdv Leneutre demain', { ...context, employees: [{ id: 'x', full_name: 'Salim' }] }).error);
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
