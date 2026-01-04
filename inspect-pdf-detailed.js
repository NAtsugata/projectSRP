// Inspect all CERFA PDF fields in detail
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function inspectAllFields() {
    const pdfBytes = fs.readFileSync('./src/assets/cerfa_15497-04.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    console.log('=== ANALYSE COMPLÈTE DU PDF CERFA 15497-04 ===\n');

    // Chercher les champs liés à la détection
    console.log('--- CHAMPS DÉTECTION ---');
    fields.forEach(f => {
        const name = f.getName();
        if (name.toLowerCase().includes('detect') || name.toLowerCase().includes('oui') || name.toLowerCase().includes('non')) {
            console.log(`  ${f.constructor.name}: "${name}"`);
        }
    });

    // Chercher les champs liés aux signatures
    console.log('\n--- CHAMPS SIGNATURES ---');
    fields.forEach(f => {
        const name = f.getName();
        if (name.toLowerCase().includes('sign') || name.toLowerCase().includes('signature')) {
            console.log(`  ${f.constructor.name}: "${name}"`);
        }
    });

    // Chercher les champs liés aux fuites
    console.log('\n--- CHAMPS FUITES ---');
    fields.forEach(f => {
        const name = f.getName();
        if (name.toLowerCase().includes('fuite') || name.toLowerCase().includes('rep_')) {
            console.log(`  ${f.constructor.name}: "${name}"`);
        }
    });

    // Chercher les cases à cocher nature intervention
    console.log('\n--- CASES NATURE INTERVENTION ---');
    fields.forEach(f => {
        const name = f.getName();
        if (name.startsWith('Case_') && !name.includes('Fuite') && !name.includes('Rep_') && !name.includes('12') && !name.includes('HFC') && !name.includes('HFO') && !name.includes('HCFC') && !name.includes('Sans') && !name.includes('Avec')) {
            console.log(`  ${f.constructor.name}: "${name}"`);
        }
    });

    // Radio groups
    console.log('\n--- GROUPES RADIO ---');
    fields.forEach(f => {
        if (f.constructor.name === 'PDFRadioGroup') {
            console.log(`  "${f.getName()}"`);
            try {
                const options = f.getOptions();
                console.log(`    Options: ${options.join(', ')}`);
            } catch(e) {}
        }
    });

    // Tous les champs texte
    console.log('\n--- TOUS LES CHAMPS TEXTE ---');
    fields.filter(f => f.constructor.name === 'PDFTextField').forEach(f => {
        console.log(`  "${f.getName()}"`);
    });

    // Toutes les cases à cocher
    console.log('\n--- TOUTES LES CASES À COCHER ---');
    fields.filter(f => f.constructor.name === 'PDFCheckBox').forEach(f => {
        console.log(`  "${f.getName()}"`);
    });
}

inspectAllFields().catch(console.error);
