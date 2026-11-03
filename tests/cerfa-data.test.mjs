import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrenchAddress, isoCerfaDate, frenchCerfaDate, mergeCerfaDefaults, parseCerfaImport, company15498Defaults } from '../src/utils/cerfaData.js';

test('French addresses preserve leading postal zero, multiword city, number and street', () => {
    assert.deepEqual(parseFrenchAddress('422 route de Digne, 04660 Champtercier'), { street: '422 route de Digne', postalCode: '04660', city: 'Champtercier', number: '422', road: 'route de Digne' });
    assert.equal(parseFrenchAddress('12 bis rue Victor Hugo 04000 Digne les Bains').city, 'Digne les Bains');
    assert.equal(parseFrenchAddress('12 bis rue Victor Hugo 04000 Digne les Bains').number, '12 bis');
    assert.equal(parseFrenchAddress('Champtercier, 04660').city, 'Champtercier');
    assert.equal(parseFrenchAddress('Lieu-dit Les Pins').road, 'Lieu-dit Les Pins');
});

test('French and Odoo ISO dates map consistently to PDF and database dates', () => {
    assert.equal(isoCerfaDate('01/11/2026'), '2026-11-01');
    assert.equal(frenchCerfaDate('2026-11-01 08:30:00'), '01/11/2026');
    assert.equal(frenchCerfaDate('2026-11-01T23:30:00Z'), '01/11/2026');
    assert.equal(isoCerfaDate('31/02/2026'), null);
    assert.equal(isoCerfaDate(''), null);
});

test('saved manual values survive defaults, explicit imports win and zero/false survive', () => {
    assert.deepEqual(mergeCerfaDefaults({ name: 'Brouillon', phone: '', amount: 0, checked: false }, { name: 'SRP', phone: '0102030405', amount: 12, checked: true }, { address: 'Autre adresse' }), { name: 'Brouillon', phone: '0102030405', amount: 0, checked: false, address: 'Autre adresse' });
    const data = { details: 'Contrôle à 100 %' };
    assert.deepEqual(parseCerfaImport(JSON.stringify(data)), data);
    assert.deepEqual(parseCerfaImport(encodeURIComponent(JSON.stringify(data))), data);
    assert.throws(() => parseCerfaImport('[]'));
});

test('15498 company defaults do not duplicate the street in the number field', () => {
    const data = company15498Defaults({ companyName: 'SRP', address: '422 route de Digne, 04660 Champtercier', email: 'test@example.com' });
    assert.equal(data.inst_raison, 'SRP');
    assert.equal(data.inst_num, '422');
    assert.equal(data.inst_voie, 'route de Digne');
    assert.equal(data.inst_postal, '04660');
    assert.equal(data.inst_email, 'test@example.com');
});
