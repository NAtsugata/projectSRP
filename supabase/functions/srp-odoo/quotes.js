const relatedId = value => Array.isArray(value) ? value[0] : value;
const relatedName = value => Array.isArray(value) ? value[1] : '';

export function classifyQuote(order, saleLines, invoices, invoiceLines, completeData = true) {
    const lines = saleLines.filter(line => relatedId(line.order_id) === order.id && !line.display_type && !line.is_downpayment && Number(line.product_uom_qty) > 0);
    const realIds = new Set(lines.map(line => line.id));
    const orderInvoices = invoices.filter(invoice => (order.invoice_ids || []).includes(invoice.id) && invoice.state !== 'cancel');
    const finals = orderInvoices.filter(invoice => invoice.move_type === 'out_invoice' && invoiceLines.some(line => relatedId(line.move_id) === invoice.id && Number(line.quantity) > 0 && (line.sale_line_ids || []).some(id => realIds.has(id))));
    const credit = orderInvoices.some(invoice => invoice.move_type === 'out_refund' && invoice.state === 'posted');
    const fullCoverage = lines.length > 0 && lines.every(line => Number.isFinite(Number(line.qty_invoiced_posted)) && Number(line.qty_invoiced_posted) + 0.000001 >= Number(line.product_uom_qty));
    const done = completeData && !credit && order.state === 'sale' && order.invoice_status === 'invoiced' && fullCoverage && finals.length > 0 && finals.every(invoice => invoice.state === 'posted');
    const invoiceStage = !completeData ? 'incomplete' : credit ? 'credit_review' : done ? 'final_posted' : finals.some(invoice => invoice.state === 'draft') ? 'final_draft' : finals.length ? 'partial_posted' : orderInvoices.length ? 'deposit' : 'none';
    return {
        id: order.id, reference: order.name, client: relatedName(order.partner_id), date: order.date_order,
        amount: Number(order.amount_total), currency: relatedName(order.currency_id), state: order.state,
        invoiceStage, canComplete: done, invoiceStatus: order.invoice_status,
        invoices: orderInvoices.map(invoice => ({ id: invoice.id, reference: invoice.name || 'Brouillon', state: invoice.state, type: invoice.move_type, paymentState: invoice.payment_state, date: invoice.invoice_date || null, currency: relatedName(invoice.currency_id), amount: Number(invoice.amount_total), remaining: Number(invoice.amount_residual), isFinal: finals.some(final => final.id === invoice.id) })),
    };
}

export function createQuoteReader({ odoo, companyId, origin }) {
    return async function listQuotes({ page = 0, query = '' } = {}) {
        if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || typeof query !== 'string' || query.length > 100) throw new Error('Recherche de devis invalide');
        const domain = [['company_id', '=', companyId], ['state', 'in', ['draft', 'sent', 'sale']]];
        if (query.trim()) domain.push('|', ['name', 'ilike', query.trim()], ['partner_id.name', 'ilike', query.trim()]);
        const raw = await odoo('sale.order', 'search_read', { domain, fields: ['id', 'name', 'partner_id', 'date_order', 'amount_total', 'currency_id', 'state', 'invoice_status', 'invoice_ids'], order: 'date_order desc, id desc', limit: 26, offset: page * 25 });
        const orders = raw.slice(0, 25);
        if (!orders.length) return { quotes: [], page, hasMore: false, syncedAt: new Date().toISOString() };
        const invoiceIds = [...new Set(orders.flatMap(order => order.invoice_ids || []))];
        const [saleLines, invoices] = await Promise.all([
            odoo('sale.order.line', 'search_read', { domain: [['order_id', 'in', orders.map(order => order.id)], ['company_id', '=', companyId]], fields: ['id', 'order_id', 'is_downpayment', 'display_type', 'product_uom_qty', 'qty_invoiced_posted'], limit: 2000 }),
            invoiceIds.length ? odoo('account.move', 'search_read', { domain: [['id', 'in', invoiceIds], ['company_id', '=', companyId]], fields: ['id', 'name', 'state', 'move_type', 'payment_state', 'invoice_date', 'currency_id', 'amount_total', 'amount_residual', 'invoice_line_ids'], limit: 1000 }) : [],
        ]);
        const invoiceLineIds = [...new Set(invoices.flatMap(invoice => invoice.invoice_line_ids || []))];
        const invoiceLines = invoiceLineIds.length ? await odoo('account.move.line', 'search_read', { domain: [['id', 'in', invoiceLineIds], ['company_id', '=', companyId]], fields: ['id', 'move_id', 'sale_line_ids', 'quantity', 'display_type'], limit: 3000 }) : [];
        const complete = saleLines.length < 2000 && invoices.length < 1000 && invoiceLines.length < 3000 && invoices.length === invoiceIds.length && invoiceLines.length === invoiceLineIds.length;
        return { quotes: orders.map(order => ({ ...classifyQuote(order, saleLines, invoices, invoiceLines, complete), url: `${origin}/odoo/sale.order/${order.id}`, invoiceOrigin: origin })), page, hasMore: raw.length > 25, syncedAt: new Date().toISOString() };
    };
}
