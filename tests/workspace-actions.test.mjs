import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceActions } from '../src/utils/workspaceActions.js';

const navigation = ['/planning', '/documents', '/my-requests', '/followups', '/chantiers'].map(href => ({ href }));
test('employee shortcuts never open the intervention creation or manager review, and respect enabled request kinds', () => {
  const actions = workspaceActions(navigation, false, ['leave']);
  assert.ok(actions.some(action => action.href === '/planning'));
  assert.ok(actions.some(action => action.href === '/my-requests?type=leave'));
  assert.ok(!actions.some(action => /new=true|followups|type=expense/.test(action.href)));
});
test('a removed module disappears immediately, including when the account or organization changes', () => {
  assert.ok(workspaceActions(navigation, true, ['leave', 'expense']).some(action => action.href === '/documents?scan=photo'));
  const actions = workspaceActions([{ href: '/my-requests' }], false, ['expense']);
  assert.deepEqual(actions.map(action => action.href), ['/my-requests?type=expense']);
  assert.deepEqual(workspaceActions([], true, ['leave', 'expense']), []);
});
