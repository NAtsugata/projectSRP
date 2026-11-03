import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardSummary, expensePeriodFilters, expensePeriod, expenseStatus, numericAmount } from '../src/utils/dashboardSummary.js';

const now = new Date(2026, 10, 1, 12);
test('one pending note and its amount remain distinct labelled values', () => {
  const pending = buildDashboardSummary({ now, expenses: [{ amount: '2257', status: 'pending', date: '2026-09-01' }] }).find(item => item.id === 'pending');
  assert.equal(pending.value, 1);
  assert.equal(pending.unit, 'note');
  assert.equal(pending.secondaryLabel, 'Montant à valider');
  assert.match(pending.secondaryValue.replace(/\s/g, ''), /^2257,00€/);
  assert.equal(pending.to, '/expenses?period=all&status=pending');
  assert.equal(pending.period, 'Toutes périodes');
});
test('expense totals add numeric strings and retain cents without including another month', () => {
  const items = buildDashboardSummary({ now, expenses: [{ date: '2026-11-01', amount: '12.35' }, { date: '2026-11-15', amount: '2.10' }, { date: '2026-10-31', amount: 1000 }] });
  const monthly = items.find(item => item.id === 'expenses');
  assert.match(monthly.value.replace(/\s/g, ''), /^14,45€/);
  assert.equal(monthly.to, '/expenses?period=month');
});
test('all six dashboard cards have an existing destination and an explicit action', () => {
  const items = buildDashboardSummary({ now });
  assert.equal(items.length, 6);
  const routes = new Set(['/planning', '/expenses', '/contracts', '/cerfa', '/archives']);
  for (const item of items) {
    assert.ok(routes.has(item.to.split('?')[0]));
    assert.match(item.action, /^Voir /);
  }
  assert.equal(items.find(item => item.id === 'contracts').to, '/contracts?status=active');
  assert.equal(items.find(item => item.id === 'pending').unit, 'notes');
});
test('expense deep links use explicit bounded month dates or remove the date restriction', () => {
  assert.deepEqual(expensePeriodFilters('month', now), { startDate: '2026-11-01', endDate: '2026-11-30' });
  assert.deepEqual(expensePeriodFilters('month', new Date(2028, 1, 15)), { startDate: '2028-02-01', endDate: '2028-02-29' });
  assert.deepEqual(expensePeriodFilters('all', now), {});
  assert.equal(expensePeriod(new URLSearchParams('period=invalid')), '3m');
  assert.equal(expenseStatus(new URLSearchParams('status=invalid')), 'all');
  assert.equal(expenseStatus(new URLSearchParams('status=pending')), 'pending');
});
test('kilometre reporting accepts a zero starting meter and never counts negative distances', () => {
  const rows = [
    { is_archived: true, archived_at: '2026-11-01', report: { km_start: 0, km_end: 25 } },
    { is_archived: true, archived_at: '2026-11-01', report: { km_start: 50, km_end: 30 } },
    { is_archived: false, archived_at: '2026-11-01', report: { km_start: 0, km_end: 100 } },
  ];
  assert.equal(buildDashboardSummary({ now, interventions: rows }).find(item => item.id === 'km').value, '25');
});
test('missing or non-finite amounts cannot corrupt the summary total', () => {
  for (const value of [undefined, 'invalid', Infinity, NaN]) assert.equal(numericAmount(value), 0);
  assert.equal(numericAmount('12.50'), 12.5);
});
