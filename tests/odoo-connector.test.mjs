import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createConnector } from '../supabase/functions/srp-odoo/core.js';

const token = 'unit-test-token-that-is-over-thirty-two-characters';
function fixture(overrides = {}) {
    const settings = { ODOO_URL: 'https://srp04.odoo.com', ODOO_API_KEY: 'odoo-secret-for-tests', ODOO_COMPANY_ID: '1', ODOO_ORGANIZATION_ID: 'org-a', PORTAL_URL: 'https://portal.example.com', SRP_MCP_TOKEN: token, SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'public-key', ...overrides };
    const calls = [];
    let currentTime = 1000000;
    const profile = { organization_id: 'org-a', is_admin: true };
    const fetcher = async (url, options) => {
        calls.push({ url, ...options });
        const data = options.body ? JSON.parse(options.body) : null;
        if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', user_metadata: { is_admin: true } });
        if (url.includes('/rest/v1/profiles')) return Response.json([profile]);
        if (url.endsWith('/fields_get')) return Response.json(Object.fromEntries(data.allfields.map(name => [name, { type: 'char' }])));
        if (url.endsWith('/res.company/search_read')) return Response.json([{ id: 1, name: 'Entreprise Test', partner_id: [2, 'Entreprise Test'], company_registry: '12345678901234' }]);
        if (url.endsWith('/res.partner/search_read')) {
            const id = data.domain.find(item => Array.isArray(item) && item[0] === 'id')?.[2];
            return Response.json([{ id: id || 7, name: id === 2 ? 'Entreprise Test' : 'Société Alice & Fils', street: id === 2 ? '422 route de Digne' : '12 bis rue des Lilas', zip: '04660', city: 'Champtercier', email: 'test@example.com', country_id: [75, 'France'], l10n_fr_siret: id === 2 ? false : '12345678901234' }]);
        }
        throw new Error('Unexpected outbound request');
    };
    const handler = createConnector({ env: key => settings[key], fetcher, cryptoApi: webcrypto, now: () => currentTime });
    const app = async (body, headers = {}) => handler(new Request('https://test.supabase.co/functions/v1/srp-odoo', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-jwt', Origin: settings.PORTAL_URL, ...headers }, body: JSON.stringify(body) }));
    const mcp = async (method, args, headers = {}) => handler(new Request('https://test.supabase.co/functions/v1/srp-odoo/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: args }) }));
    return { handler, app, mcp, settings, calls, profile, expire: () => { currentTime += 600001; } };
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

test('another organization and untrusted origin cannot read Odoo', async () => {
    const f = fixture();
    f.profile.organization_id = 'org-b';
    assert.equal((await f.app({ action: 'search_clients', query: 'Alice' })).status, 403);
    assert.equal((await f.app({ action: 'status' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal(f.calls.filter(call => call.url.includes('odoo.com')).length, 0);
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
