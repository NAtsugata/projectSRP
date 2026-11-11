import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createConnector,isTechnicalDesignation } from '../supabase/functions/srp-odoo/core.js';

test('commercial text embedded inside designations is not published to employees',()=>{
    for(const text of ['Préparation murs 10€/m²','Remise 11.73%','Acompte (réf : Fact/2025/1)','Prix HT : 12 euros'])assert.equal(isTechnicalDesignation(text),false);
    assert.equal(isTechnicalDesignation('PAC 3,5kW - câble 20 m'),true);
});

const token = 'unit-test-token-that-is-over-thirty-two-characters';
function fixture(overrides = {}) {
    const settings = { ODOO_URL: 'https://srp04.odoo.com', ODOO_API_KEY: 'odoo-secret-for-tests', ODOO_COMPANY_ID: '1', ODOO_ORGANIZATION_ID: 'org-a', ODOO_OWNER_USER_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', PORTAL_URL: 'https://portal.example.com', SRP_MCP_TOKEN: token, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'public-key', ...overrides };
    const calls = [];
    let currentTime = 1000000;
    const profile = { organization_id: 'org-a', is_admin: true };
    const user = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_metadata: { is_admin: true } };
    const assignment = { userId: user.id };
    const intervention = { id: 42, client: 'Client Démo', service: 'Entretien', ticket_number: '' };
    const orders = [{ id: 80, name: 'S080', partner_id: [7, 'Client Démo'], partner_shipping_id: [9, 'Chantier Démo'], date_order: '2026-11-02', state: 'sale' }];
    const fetcher = async (url, options) => {
        calls.push({ url, ...options });
        const data = options.body ? JSON.parse(options.body) : null;
        if (url.endsWith('/auth/v1/user')) return Response.json(user);
        if (url.includes('/rest/v1/profiles')) return Response.json([profile]);
        if (url.includes('/rest/v1/interventions')) return Response.json([{ ...intervention, intervention_assignments: [{ user_id: assignment.userId }] }]);
        if (url.endsWith('/sale.order/search_read')) {
            const id = data.domain.find(item => item[0] === 'id')?.[2];
            const name = data.domain.find(item => item[0] === 'name')?.[2];
            const state = data.domain.find(item => item[0] === 'state' && item[1] === '=')?.[2];
            return Response.json(orders.filter(order => (!id || order.id === id) && (!name || order.name === name) && (!state || order.state === state)).slice(0, data.limit));
        }
        if (url.endsWith('/sale.order.line/search_read')) return Response.json([
            { id: 79, order_id: [80, 'S080'], name: 'Ligne 99 €' },
            { id: 81, order_id: [80, 'S080'], name: 'Remplacer le circulateur', product_uom_qty: 1, product_uom: [1, 'Unité'], display_type: false, sequence: 10 },
        ]);
        if (url.endsWith('/fields_get')) return Response.json(Object.fromEntries(data.allfields.filter(name=>name!=='product_uom_id').map(name => [name, { type: 'char' }])));
        if (url.endsWith('/res.company/search_read')) return Response.json([{ id: 1, name: 'Entreprise Test', partner_id: [2, 'Entreprise Test'], company_registry: '12345678901234' }]);
        if (url.endsWith('/res.partner/search_read')) {
            if (data.domain.some(item => item[0] === 'id' && item[1] === 'in')) return Response.json([
                { id: 7, street: 'Adresse de facturation', phone: '0612345678', email: 'client@example.com' },
                { id: 9, street: '12 rue du Chantier', zip: '04000', city: 'Digne-les-Bains', phone: '0623456789' },
            ]);
            const id = data.domain.find(item => Array.isArray(item) && item[0] === 'id')?.[2];
            return Response.json([{ id: id || 7, name: id === 2 ? 'Entreprise Test' : 'Société Alice & Fils', street: id === 2 ? '422 route de Digne' : '12 bis rue des Lilas', zip: '04660', city: 'Champtercier', email: 'test@example.com', country_id: [75, 'France'], l10n_fr_siret: id === 2 ? false : '12345678901234' }]);
        }
        throw new Error('Unexpected outbound request');
    };
    const handler = createConnector({ env: key => settings[key], fetcher, cryptoApi: webcrypto, now: () => currentTime });
    const app = async (body, headers = {}) => handler(new Request('https://test.supabase.co/functions/v1/srp-odoo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-jwt', Origin: settings.PORTAL_URL, ...headers }, body: JSON.stringify(body) }));
    const mcp = async (method, args, headers = {}) => handler(new Request('https://test.supabase.co/functions/v1/srp-odoo/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: args }) }));
    return { handler, app, mcp, settings, calls, profile, user, assignment, intervention, orders, expire: () => { currentTime += 600001; } };
}

test('all transports fail closed without their credentials', async () => {
    const f = fixture();
    assert.equal((await f.app({ action: 'status' }, { Authorization: '' })).status, 401);
    assert.equal((await f.mcp('tools/list', {}, { Authorization: 'Bearer wrong' })).status, 401);
    assert.equal(f.calls.length, 0);
    assert.equal((await fixture({ SRP_MCP_TOKEN: '' }).mcp('tools/list')).status, 401);
});

test('verified user profile controls access, editable metadata does not', async () => {
    const f = fixture();
    f.profile.is_admin = false;
    assert.equal((await f.app({ action: 'prefill', clientId: 7, type: '1301' })).status, 403);
    assert.equal(f.calls.filter(call => call.url.includes('odoo.com')).length, 0);
});

test('an assigned employee receives automatic work designations without financial fields', async () => {
    const f = fixture();
    f.user.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    f.assignment.userId = f.user.id;
    f.profile.is_admin = false;
    const response = await f.app({ action: 'work_instructions', interventionId: 42 });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.orders[0].lines[0].designation, 'Remplacer le circulateur');
    assert.equal(result.orders[0].lines[0].quantity, 1);
    assert.equal(JSON.stringify(result).match(/price|amount|total|discount|tax/), null);
});

test('an unassigned employee cannot read work instructions or contact Odoo', async () => {
    const f = fixture();
    f.user.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    f.profile.is_admin = false;
    const response = await f.app({ action: 'work_instructions', interventionId: 42 });
    assert.equal(response.status, 403);
    assert.equal(f.calls.some(call => call.url.includes('odoo.com')), false);
});

test('appointment prefill uses the selected quote and delivery address without exposing prices', async () => {
    const f = fixture();
    const response = await f.app({ action: 'appointment_prefill', quoteId: 80 });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        client: 'Client Démo', address: '12 rue du Chantier, 04000 Digne-les-Bains',
        client_phone: '0623456789', secondary_phone: '0612345678', client_email: 'client@example.com',
        ticket_number: 'S080', service: 'Remplacer le circulateur',
    });
    const orderCall = f.calls.find(call => call.url.endsWith('/sale.order/search_read'));
    assert.ok(JSON.parse(orderCall.body).domain.some(item => item[0] === 'company_id' && item[2] === 1));
    assert.equal((await f.app({ action: 'appointment_prefill', quoteId: 999 })).status, 404);
    assert.equal((await f.app({ action: 'appointment_prefill', quoteId: '80' })).status, 400);
    f.profile.is_admin = false;
    const previousOdooCalls = f.calls.filter(call => call.url.includes('odoo.com')).length;
    assert.equal((await f.app({ action: 'appointment_prefill', quoteId: 80 })).status, 403);
    assert.equal(f.calls.filter(call => call.url.includes('odoo.com')).length, previousOdooCalls);
});

test('an assigned employee sees the linked quote even when a newer quote exists', async () => {
    const f = fixture();
    f.profile.is_admin = false;
    f.intervention.ticket_number = 'S080';
    f.orders.unshift({ ...f.orders[0], id: 82, name: 'S082' });
    const read = async () => (await f.app({ action: 'work_instructions', interventionId: 42 })).json();
    assert.deepEqual((await read()).orders.map(order => order.reference), ['S080']);
    f.orders[1].state = 'draft';
    assert.deepEqual((await read()).orders, []);
});

test('another organization and untrusted origin cannot read Odoo', async () => {
    const f = fixture();
    f.profile.organization_id = 'org-b';
    assert.equal((await f.app({ action: 'search_clients', query: 'Alice' })).status, 403);
    assert.equal((await f.app({ action: 'status' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal(f.calls.filter(call => call.url.includes('odoo.com')).length, 0);
});

test('another administrator in the same entity cannot use this owner connection', async () => {
    const f = fixture();
    f.user.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    f.profile.is_super_admin = true;
    for (const action of ['status', 'search_clients', 'prefill', 'redeem']) {
        assert.equal((await f.app({ action, clientId: 7, type: '1301', query: 'Alice', organization_id: 'org-a' })).status, 403);
    }
    assert.equal(f.calls.some(call => call.url.includes('odoo.com')), false);
});

test('missing owner configuration denies both transports without contacting Odoo', async () => {
    const f = fixture({ ODOO_OWNER_USER_ID: '' });
    assert.equal((await f.app({ action: 'status' })).status, 503);
    assert.equal((await f.mcp('tools/list')).status, 503);
    assert.equal(f.calls.some(call => call.url.includes('odoo.com')), false);
});

test('a prefill link is invalidated if its configured owner changes', async () => {
    const f = fixture();
    const prepared = await (await f.mcp('tools/call', { name: 'preparer_cerfa', arguments: { clientId: 7, type: '1301' } })).json();
    const link = new URLSearchParams(new URL(prepared.result.structuredContent.url).hash.slice(1)).get('odoo');
    f.settings.ODOO_OWNER_USER_ID = f.user.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const before = f.calls.filter(call => call.url.includes('odoo.com')).length;
    assert.equal((await f.app({ action: 'redeem', token: link })).status, 400);
    assert.equal(f.calls.filter(call => call.url.includes('odoo.com')).length, before);
});

test('setup status reveals missing variable names, never secret values', async () => {
    const f = fixture({ ODOO_API_KEY: '' });
    const result = await (await f.app({ action: 'status' })).json();
    assert.equal(result.configured, false);
    assert.ok(result.missing.includes('ODOO_API_KEY'));
    assert.equal(JSON.stringify(result).includes(token), false);
});

test('root MCP transport requires the same secret and cannot bypass user authorization', async () => {
    const f = fixture();
    const response = await f.app({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.tools.length, 3);
    assert.equal(f.calls.length, 0);
    assert.equal((await f.app({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { Authorization: '' })).status, 401);
});

test('contact search is bounded, company scoped and read only', async () => {
    const f = fixture();
    const response = await f.app({ action: 'search_clients', query: 'Alice' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).clients[0].id, 7);
    const call = f.calls.find(call => call.url.endsWith('/res.partner/search_read'));
    const body = JSON.parse(call.body);
    assert.equal(body.limit, 15);
    assert.ok(body.domain.some(item => Array.isArray(item) && item[0] === 'company_id' && item[2] === 1));
    assert.ok(f.calls.filter(call => call.url.includes('odoo.com')).every(call => /\/(fields_get|search_read)$/.test(call.url)));
});

test('all three CERFA mappings preserve a business name and exact postal code', async () => {
    for (const type of ['15497', '15498', '1301']) {
        const f = fixture();
        const result = await (await f.app({ action: 'prefill', clientId: 7, type })).json();
        assert.equal(result.company.companyName, 'Entreprise Test');
        assert.equal(result.company.siret, '12345678901234');
        assert.equal(result.data[{ '15497': 'detenteurNom', '15498': 'acq_nom', '1301': 'clientNom' }[type]], 'Société Alice & Fils');
        assert.equal(result.data.signatureClient, undefined);
        if (type === '1301') { assert.equal(result.data.clientPrenom, ''); assert.equal(result.data.clientCodePostal, '04660'); }
        if (type === '15498') { assert.equal(result.data.acq_num, '12 bis'); assert.equal(result.data.acq_voie, 'rue des Lilas'); }
    }
});

test('invalid IDs, arbitrary actions and non-Odoo destinations are rejected', async () => {
    const f = fixture();
    for (const clientId of [0, -1, '7', 7.2]) assert.equal((await f.app({ action: 'prefill', clientId, type: '1301' })).status, 400);
    assert.equal((await f.app({ action: 'execute_sql' })).status, 400);
    assert.equal((await fixture({ ODOO_URL: 'https://evil.example' }).app({ action: 'search_clients', query: 'Alice' })).status, 503);
    assert.equal((await f.app({ action: 'prefill', clientId: 7, type: '__proto__' })).status, 400);
});

test('Claude discovers only scoped tools and negotiates the supported protocol', async () => {
    const f = fixture();
    const list = await (await f.mcp('tools/list')).json();
    assert.deepEqual(list.result.tools.map(tool => tool.name), ['rechercher_clients', 'lire_entreprise', 'preparer_cerfa']);
    const init = await (await f.mcp('initialize', { protocolVersion: '2025-11-25' })).json();
    assert.equal(init.result.protocolVersion, '2025-11-25');
    const modern = await (await f.mcp('server/discover')).json();
    assert.ok(modern.result.supportedVersions.includes('2026-07-28'));
    assert.equal((await f.mcp('tools/list', {}, { 'MCP-Protocol-Version': 'bad' })).status, 400);
});

test('Claude prefill links are encrypted, expire and require a logged-in admin to redeem', async () => {
    const f = fixture();
    const result = await (await f.mcp('tools/call', { name: 'preparer_cerfa', arguments: { clientId: 7, type: '1301', details: 'Entretien convenu' } })).json();
    const url = result.result.structuredContent.url;
    assert.match(url, /^https:\/\/portal.example.com\/cerfa-form-1301#odoo=/);
    assert.equal(url.includes('Alice'), false);
    const link = new URLSearchParams(new URL(url).hash.slice(1)).get('odoo');
    assert.equal((await f.app({ action: 'redeem', token: link }, { Authorization: '' })).status, 401);
    const data = await (await f.app({ action: 'redeem', token: link })).json();
    assert.equal(data.data.descriptionTravaux, 'Entretien convenu');
    assert.equal((await f.app({ action: 'redeem', token: `x${link}` })).status, 400);
    f.expire();
    assert.equal((await f.app({ action: 'redeem', token: link })).status, 400);
});
