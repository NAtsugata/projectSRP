import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, upcomingInterventions, interventionDate, chantierProgress, filterChantiers, isLateChantier, defaultPlanningView } from '../src/utils/workspaceTracking.js';

test('today follows the local calendar, including a UTC day boundary', () => {
  const local = new Date(2026, 10, 1, 0, 15);
  assert.equal(localDateKey(local), '2026-11-01');
});
test('multi-day interventions appear today even if their original date has passed', () => {
  const items = [{ id: 1, date: '2026-10-29', scheduled_dates: ['2026-11-01', '2026-11-03'] }, { id: 2, date: '2026-10-30' }];
  assert.deepEqual(upcomingInterventions(items, 'today', '2026-11-01').map(item => item.id), [1]);
  assert.equal(interventionDate(items[0], '2026-11-01'), '2026-11-01');
});
test('upcoming work is chronological and excludes archived or completed records', () => {
  const items = [{ id: 1, date: '2026-11-03' }, { id: 2, date: '2026-11-02', time: '14:00' }, { id: 3, date: '2026-11-02', time: '08:00' }, { id: 4, date: '2026-11-02', is_archived: true }, { id: 5, date: '2026-11-02', status: 'Terminée' }, { id: 6, date: '2026-10-29' }];
  const order = items.map(item => item.id);
  assert.deepEqual(upcomingInterventions(items, 'upcoming', '2026-11-01').map(item => item.id), [3, 2, 1]);
  assert.deepEqual(items.map(item => item.id), order);
});
test('urgent follow-up includes overdue unarchived needs, excluding archived work', () => {
  const urgent = { id: 1, date: '2026-10-01', additional_needs: [{ isUrgent: true }] };
  assert.deepEqual(upcomingInterventions([urgent, { ...urgent, id: 2, is_archived: true }, { id: 3, date: '2026-11-02' }], 'urgent', '2026-11-01').map(item => item.id), [1]);
});
test('completed chantiers and an end date of today are never marked overdue', () => {
  assert.equal(isLateChantier({ end_date: '2026-10-31', status: 'en_cours' }, '2026-11-01'), true);
  for (const status of ['clos', 'receptionne']) assert.equal(isLateChantier({ end_date: '2026-10-31', status }, '2026-11-01'), false);
  assert.equal(isLateChantier({ end_date: '2026-11-01' }, '2026-11-01'), false);
  assert.equal(isLateChantier({}), false);
});
test('chantier search ignores accents, combines status and preserves source order', () => {
  const items = [{ id: 1, name: 'Résidence Érable', status: 'en_cours', end_date: '2026-12-01' }, { id: 2, name: 'Résidence Érable', status: 'preparation' }, { id: 3, name: 'Atelier', client_name: 'Éric', status: 'en_cours', end_date: '2026-10-31' }];
  assert.deepEqual(filterChantiers(items, 'residence erable', 'en_cours').map(item => item.id), [1]);
  assert.deepEqual(filterChantiers(items, 'eric', 'late', 'deadline', '2026-11-01').map(item => item.id), [3]);
  assert.deepEqual(items.map(item => item.id), [1, 2, 3]);
});
test('progress is numeric, bounded, and safe for a chantier with no lots', () => {
  assert.equal(chantierProgress(), 0);
  assert.equal(chantierProgress([{ progress: '50' }, { progress: 100 }]), 75);
  assert.equal(chantierProgress([{ progress: 200 }, { progress: -40 }, {}]), 33);
});
test('mobile defaults to list while an existing view preference is preserved', () => {
  let saved = null;
  globalThis.localStorage = { getItem: () => saved };
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  assert.equal(defaultPlanningView('planningViewMode'), 'list');
  saved = 'gantt';
  assert.equal(defaultPlanningView('planningViewMode'), 'gantt');
  saved = 'invalid';
  assert.equal(defaultPlanningView('planningViewMode'), 'list');
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  saved = null;
  assert.equal(defaultPlanningView('planningViewMode'), 'gantt');
  delete globalThis.window;
  delete globalThis.localStorage;
});
