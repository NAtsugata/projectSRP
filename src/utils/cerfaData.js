// Shared normalization for saved forms and imported business data.
export function parseFrenchAddress(value = '') {
    const address = String(value ?? '').trim();
    const match = address.match(/(?:^|[\s,])(\d{5})(?=$|[\s,])/);
    let street = address, postalCode = '', city = '';
    if (match) {
        street = address.slice(0, match.index).replace(/[\s,]+$/, '');
        postalCode = match[1];
        city = address.slice(match.index + match[0].length).replace(/^[\s,]+|[\s,]+$/g, '');
        // Legacy saved addresses sometimes use "City, 01234".
        if (!city && street && !/^\d/.test(street)) { city = street; street = ''; }
    }
    const numbered = street.match(/^(\d+(?:\s*(?:bis|ter|quater)|[A-Za-z])?)\s+(.+)$/i);
    return { street, postalCode, city, number: numbered?.[1] || '', road: numbered?.[2] || street };
}

export function isoCerfaDate(value) {
    const text = String(value ?? '').trim();
    const french = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/);
    if (!french && !iso) return null;
    const [year, month, day] = french ? [french[3], french[2], french[1]] : iso.slice(1);
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function frenchCerfaDate(value) {
    return isoCerfaDate(value)?.split('-').reverse().join('/') || '';
}

export function mergeCerfaDefaults(current, defaults, imported = {}) {
    const result = { ...current };
    for (const [key, value] of Object.entries(defaults)) {
        if (result[key] === '' || result[key] == null) result[key] = value ?? '';
    }
    return { ...result, ...imported };
}

// URLSearchParams already decodes once; keep legacy double-encoded links working.
export function parseCerfaImport(value) {
    let parsed;
    try { parsed = JSON.parse(value); }
    catch { parsed = JSON.parse(decodeURIComponent(value)); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Données CERFA invalides');
    return parsed;
}

export function company15498Defaults(company) {
    const address = parseFrenchAddress(company.address);
    return {
        inst_raison: company.companyName || company.name || '', inst_num: address.number,
        inst_voie: address.road, inst_postal: address.postalCode, inst_commune: address.city,
        inst_siret: company.siret || '', inst_tel: company.phone || '',
        inst_email: company.email || '', inst_attestation: company.attestationNumber || '',
    };
}
