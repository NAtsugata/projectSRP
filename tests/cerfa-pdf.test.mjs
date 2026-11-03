import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pdfLibUrl = pathToFileURL(require.resolve('pdf-lib')).href;
const { PDFDocument, PDFName } = await import(pdfLibUrl);
// Node cannot import JSX/PDF assets; replace only those import boundaries.
let source = await readFile(new URL('../src/utils/cerfaService.jsx', import.meta.url), 'utf8');
source = source.replace("from 'pdf-lib'", `from '${pdfLibUrl}'`)
    .replace("import logger from './logger';", 'const logger = { log() {}, warn() {}, error() {} };')
    .replace("from './cerfaData'", `from '${new URL('../src/utils/cerfaData.js', import.meta.url).href}'`)
    .replace("import { safeStorage } from './safeStorage';", 'const safeStorage = { getJSON: (key, fallback) => fallback, getItem: () => null };')
    .replace(/import (\w+) from '\.\.\/assets\/(.+\.pdf)';/g, (_, name, file) => `const ${name} = '${file}';`);
const service = await import(`data:text/javascript;base64,${Buffer.from(source + '\n//# sourceURL=cerfa-service-under-test.mjs').toString('base64')}`);
globalThis.fetch = async filename => {
    const bytes = await readFile(new URL(`../src/assets/${filename}`, import.meta.url));
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

test('1301 maps property, usage, owner and precise declarations to canonical PDF fields', async () => {
    const blob = await service.fillCerfa1301({
        clientNom: 'SociÃ©tÃ© de test', clientAdresse: '12 rue du Test', clientCodePostal: '04000', clientVille: 'Digne les Bains',
        natureAppartement: true, qualiteLocataire: true, usageLocal: '3', milliemes: '125',
        memeAdresse: false, immeubleAdresse: '24 autre rue', immeubleCodePostal: '04660', immeubleVille: 'Champtercier',
        pasImmeubleNeuf: true, moins6Elements: true, elemPlomberie: true, pasAugmentationSurface: true,
        pasSurelevation: false, travauxEntretien: true, travauxTransformation: true,
        dateAttestation: '2026-11-01', lieu: 'Digne',
    }, { flatten: false });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    const form = pdf.getForm();
    assert.equal(form.getRadioGroup('cac1').getSelected(), '3');
    assert.equal(form.getRadioGroup('cac2').getSelected(), '3');
    assert.equal(form.getRadioGroup('cac3').getSelected(), '2');
    for (const [field, value] of Object.entries({ a1: 'SociÃ©tÃ© de test', a5: '04000', a5a: '', a6: '125', a7: '24 autre rue', a8: 'Champtercier', a9: '04660', a12: '01/11/2026' })) assert.equal(form.getTextField(field).getText() || '', value, field);
    assert.equal(form.getCheckBox('cac9').isChecked(), true);
    assert.equal(form.getCheckBox('cac12').isChecked(), true);
    for (const field of ['cac13', 'cac14', 'cac15']) assert.equal(form.getCheckBox(field).isChecked(), false, field);
});

test('15497 preserves zero quantities, ISO control dates and unknown leak status', async () => {
    const blob = await service.fillCerfa15497({ dateIntervention: '2026-11-01', fluideVierge: 0, fluideRecycle: 0, fluideChargeInitiale: 0 }, { flatten: false });
    const form = (await PDFDocument.load(await blob.arrayBuffer())).getForm();
    assert.equal(form.getTextField('Controle_Jour').getText(), '01');
    assert.equal(form.getTextField('Controle_Mois').getText(), '11');
    assert.equal(form.getTextField('Controle_Annee').getText(), '2026');
    for (const field of ['11_QA', '11_QB', 'Equipement_Charge']) assert.equal(form.getTextField(field).getText(), '0', field);
    assert.equal(form.getCheckBox('Case_Fuite_Non').isChecked(), false);
});

test('15498 carries the company address and selected equipment into the PDF', async () => {
    const blob = await service.fillCerfa15498({ acq_nom: 'Client Test', inst_num: '422', inst_voie: 'route de Digne', inst_postal: '04660', inst_commune: 'Champtercier', pompe: true, hfc: true }, { flatten: false });
    const form = (await PDFDocument.load(await blob.arrayBuffer())).getForm();
    assert.equal(form.getTextField('inst_num').getText(), '422');
    assert.equal(form.getTextField('inst_voie').getText(), 'route de Digne');
    assert.equal(form.getTextField('inst_postal').getText(), '04660');
    assert.equal(form.getCheckBox('pompe').isChecked(), true);
    assert.equal(form.getCheckBox('pfc').isChecked(), false);
});

test('default downloaded PDFs retain the existing static workflow', async () => {
    for (const name of ['fillCerfa15497', 'fillCerfa15498', 'fillCerfa1301']) {
        const blob = await service[name]({ clientNom: 'Test', dateIntervention: '01/11/2026' });
        const pdf = await PDFDocument.load(await blob.arrayBuffer());
        assert.equal(pdf.getForm().getFields().length, 0, name);
        for (const page of pdf.getPages()) {
            const widgets = (page.node.Annots()?.asArray() || []).filter(ref => pdf.context.lookup(ref)?.get(PDFName.of('Subtype')) === PDFName.of('Widget'));
            assert.equal(widgets.length, 0, name);
        }
    }
});
