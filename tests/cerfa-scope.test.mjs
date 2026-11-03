import test from 'node:test';
import assert from 'node:assert/strict';
import { cerfaStorageKey } from '../src/utils/cerfaScope.js';

test('CERFA drafts use separate keys for every entity, user and template', () => {
    const owner = { id: 'owner', organization_id: 'srp' };
    const first = cerfaStorageKey('15497', owner);
    assert.notEqual(first, cerfaStorageKey('15497', { ...owner, id: 'another-admin' }));
    assert.notEqual(first, cerfaStorageKey('15497', { ...owner, organization_id: 'another-tenant' }));
    assert.notEqual(first, cerfaStorageKey('1301', owner));
    assert.notEqual(first, 'cerfa_15497_draft');
});

test('no shared anonymous namespace is used before the profile is loaded', () => {
    assert.equal(cerfaStorageKey('15497', null), null);
    assert.equal(cerfaStorageKey('15497', { id: 'owner' }), null);
    assert.equal(cerfaStorageKey('15497', { organization_id: 'srp' }), null);
    assert.notEqual(cerfaStorageKey('draft', { id: 'a:b', organization_id: 'c' }), cerfaStorageKey('draft', { id: 'b', organization_id: 'c:a' }));
});
