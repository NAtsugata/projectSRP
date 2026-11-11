import assert from 'node:assert/strict';
import test from 'node:test';
import { finishInterventionPause, interventionTimeStats } from '../src/utils/interventionTime.js';
import { buildSanitizedReport } from '../src/utils/reportHelpers.js';

const arrivalTime = '2026-11-11T08:02:00Z';
const pauseStartedAt = '2026-11-11T08:44:00Z';
const departureTime = '2026-11-11T08:50:00Z';

test('a running pause is retained after saving and stops the worked time only', () => {
    const stored = buildSanitizedReport({ arrivalTime, isPaused: true, pauseStartedAt });
    assert.equal(stored.isPaused, true);
    assert.equal(stored.pauseStartedAt, pauseStartedAt);
    assert.deepEqual(interventionTimeStats(stored, Date.parse(departureTime)), { elapsed: 48 * 60, worked: 42 * 60 });
});

test('departure closes the current pause without mutating its history', () => {
    const report = { arrivalTime, isPaused: true, pauseStartedAt, pauseHistory: [] };
    const stored = buildSanitizedReport({ ...report, ...finishInterventionPause(report, departureTime), departureTime });
    assert.deepEqual(report.pauseHistory, []);
    assert.equal(stored.isPaused, false);
    assert.equal(stored.pauseStartedAt, null);
    assert.deepEqual(stored.pauseHistory, [{ start: pauseStartedAt, end: departureTime, duration: 360 }]);
    assert.deepEqual(interventionTimeStats(stored, Date.parse('2026-11-12T10:00:00Z')), { elapsed: 48 * 60, worked: 42 * 60 });
});

test('an older completed report with an open pause stops counting at departure', () => {
    const old = { arrivalTime, departureTime, isPaused: true, pauseStartedAt };
    assert.deepEqual(interventionTimeStats(old), { elapsed: 48 * 60, worked: 42 * 60 });
    assert.equal(interventionTimeStats({}), null);
});
