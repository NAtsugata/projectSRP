import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyQuote } from '../supabase/functions/srp-odoo/quotes.js';

const order = { id: 1, name: 'S001', state: 'sale', invoice_status: 'invoiced', invoice_ids: [10], amount_total: 1000, partner_id: [1, 'Client'], currency_id: [1, 'EUR'] };
const real = { id: 3, order_id: [1, 'S001'], is_downpayment: false, product_uom_qty: 2, qty_invoiced_posted: 2 };
const posted = { id: 10, state: 'posted', move_type: 'out_invoice', payment_state: 'not_paid', amount_total: 1000, amount_residual: 1000 };
const invoiceLine = { id: 50, move_id: [10, 'F001'], sale_line_ids: [3], quantity: 2 };
test('a fully invoiced order with posted final invoice becomes processed, even when unpaid', () => {
    const result = classifyQuote(order, [real], [posted], [invoiceLine]);
    assert.equal(result.canComplete, true);
    assert.equal(result.invoiceStage, 'final_posted');
    assert.equal(result.invoices[0].remaining, 1000);
});
test('a posted deposit never completes an order', () => {
    const result = classifyQuote(order, [real, { id: 4, order_id: [1, 'S001'], is_downpayment: true, product_uom_qty: 1, qty_invoiced_posted: 1 }], [posted], [{ ...invoiceLine, sale_line_ids: [4] }]);
    assert.equal(result.canComplete, false);
    assert.equal(result.invoiceStage, 'deposit');
});
test('a draft, cancelled, partially invoiced or credited final invoice requires follow-up', () => {
    assert.equal(classifyQuote(order, [real], [{ ...posted, state: 'draft' }], [invoiceLine]).invoiceStage, 'final_draft');
    assert.equal(classifyQuote(order, [real], [{ ...posted, state: 'cancel' }], [invoiceLine]).canComplete, false);
    assert.equal(classifyQuote(order, [{ ...real, qty_invoiced_posted: 1 }], [posted], [invoiceLine]).canComplete, false);
    assert.equal(classifyQuote(order, [real], [{ ...posted, move_type: 'out_refund' }], [invoiceLine]).invoiceStage, 'credit_review');
});
test('a consolidated invoice cannot use another order line to finish this order', () => {
    assert.equal(classifyQuote(order, [real], [posted], [{ ...invoiceLine, sale_line_ids: [999] }]).canComplete, false);
});
test('missing fields, unavailable records and truncated results fail conservatively', () => {
    assert.equal(classifyQuote(order, [{ ...real, qty_invoiced_posted: undefined }], [posted], [invoiceLine]).canComplete, false);
    assert.equal(classifyQuote(order, [real], [posted], [invoiceLine], false).invoiceStage, 'incomplete');
});
