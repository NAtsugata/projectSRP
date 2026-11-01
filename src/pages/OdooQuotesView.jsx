import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabaseClient';
import { requestOdoo } from '../services/odooService';
import './OdooQuotesView.css';
const stages = { incomplete: 'À vérifier : données incomplètes', credit_review: 'Avoir : contrôle nécessaire', final_posted: 'Facture finale comptabilisée', final_draft: 'Facture finale en brouillon', partial_posted: 'Facturation partielle', deposit: 'Acompte uniquement', none: 'Pas de facture' };
const money = (amount, currency) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(amount)} ${currency || ''}`;
export default function OdooQuotesView() {
    const profile = useAuthStore(s => s.profile);
    return <Quotes key={`${profile?.organization_id}:${profile?.id}`} profile={profile} />;
}
function Quotes({ profile }) {
    const [data, setData] = useState(null), [tracking, setTracking] = useState({}), [page, setPage] = useState(0);
    const [input, setInput] = useState(''), [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
    const [busy, setBusy] = useState(false), [saving, setSaving] = useState(null), [error, setError] = useState('');
    const alive = useRef(true), sequence = useRef(0);
    const readTracking = useCallback(async () => {
        const { data: rows, error } = await supabase.from('odoo_quote_tracking').select('odoo_order_id,work_status').eq('organization_id', profile.organization_id).eq('owner_id', profile.id).limit(1000);
        if (error) throw error;
        if (alive.current) setTracking(Object.fromEntries(rows.map(r => [r.odoo_order_id, r.work_status])));
    }, [profile.id, profile.organization_id]);
    const load = useCallback(async () => {
        const current = ++sequence.current; setBusy(true); setError('');
        try { const result = await requestOdoo({ action: 'quotes', page, query }); await readTracking(); if (alive.current && current === sequence.current) setData(result); }
        catch (e) { if (alive.current && current === sequence.current) { setData(null); setError(e.message); } }
        finally { if (alive.current && current === sequence.current) setBusy(false); }
    }, [page, query, readTracking]);
    useEffect(() => { alive.current = true; load(); const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30000); return () => { alive.current = false; clearInterval(timer); }; }, [load]);
    useEffect(() => {
        const channel = supabase.channel(`odoo-tracking-${profile.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'odoo_quote_tracking', filter: `owner_id=eq.${profile.id}` }, () => readTracking().catch(e => { if (alive.current) setError(e.message); })).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [profile.id, readTracking]);
    const status = quote => quote.canComplete ? 'done' : tracking[quote.id] || 'todo';
    const labels = { todo: 'À traiter', in_progress: 'En cours', done: 'Traité' };
    async function mark(quote, value) {
        setSaving(quote.id); setError('');
        try { const { error } = await supabase.from('odoo_quote_tracking').upsert({ organization_id: profile.organization_id, owner_id: profile.id, odoo_order_id: quote.id, work_status: value, updated_at: new Date().toISOString() }); if (error) throw error; if (alive.current) setTracking(old => ({ ...old, [quote.id]: value })); }
        catch (e) { if (alive.current) setError(e.message); } finally { if (alive.current) setSaving(null); }
    }
    const quotes = data?.quotes || [];
    return <section className="odoo-quotes"><header><div><h1>Devis Odoo</h1><p>Suivi du traitement et de la facture finale</p></div><button onClick={load} disabled={busy}>{busy ? 'Actualisation…' : 'Actualiser'}</button></header>
        <p>Le statut « Traité » est automatique lorsque les prestations sont entièrement facturées par une facture comptabilisée. Un acompte ou un brouillon ne suffit pas. Le règlement reste suivi séparément.</p>
        <form onSubmit={e => { e.preventDefault(); setData(null); setPage(0); setQuery(input.trim()); }}><label htmlFor="odoo-search">Référence ou client</label><input id="odoo-search" value={input} maxLength={100} onChange={e => setInput(e.target.value)} /><button disabled={busy}>Rechercher</button></form>
        <div className="odoo-status-filters" aria-label="Filtrer les devis de cette page">{['all','todo','in_progress','done'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'Tous' : labels[value]} · {value === 'all' ? quotes.length : quotes.filter(q => status(q) === value).length}</button>)}</div>
        <small>Compteurs et filtres sur cette page (25 devis maximum). Actualisation toutes les 30 secondes.</small>
        {error && <p role="alert">{error}</p>}{data && <p>Dernière lecture : {new Date(data.syncedAt).toLocaleTimeString('fr-FR')}</p>}
        <div className="odoo-quotes-grid">{quotes.filter(q => filter === 'all' || status(q) === filter).map(quote => <article key={quote.id} className="odoo-quote-card"><header><a href={quote.url} target="_blank" rel="noreferrer">{quote.reference} ↗</a><span className={`odoo-stage ${status(quote)}`}>{labels[status(quote)]}</span></header><h2>{quote.client}</h2><strong className="odoo-amount">{money(quote.amount, quote.currency)}</strong><p>{stages[quote.invoiceStage]}</p>
            {!quote.canComplete && <label>Traitement<select disabled={saving === quote.id} value={tracking[quote.id] || 'todo'} onChange={e => mark(quote, e.target.value)}><option value="todo">À traiter</option><option value="in_progress">En cours</option></select></label>}
            <details><summary>Factures associées ({quote.invoices.length})</summary>{quote.invoices.map(invoice => <div className="odoo-invoice-row" key={invoice.id}><a href={`${quote.invoiceOrigin}/odoo/account.move/${invoice.id}`} target="_blank" rel="noreferrer">{invoice.reference} ↗</a><p>{invoice.type === 'out_refund' ? 'Avoir' : invoice.isFinal ? 'Prestations' : 'Acompte / autre'} · {invoice.state === 'posted' ? 'Comptabilisée' : invoice.state === 'cancel' ? 'Annulée' : 'Brouillon'}</p><p>Total : {money(invoice.amount, invoice.currency)}<br/>Reste à régler : {money(invoice.remaining, invoice.currency)}</p></div>)}</details>
        </article>)}</div>{data && !quotes.length && <p>Aucun devis trouvé.</p>}
        <nav aria-label="Pagination des devis"><button disabled={busy || page === 0} onClick={() => { setData(null); setPage(p => p - 1); }}>Précédent</button><span>Page {page + 1}</span><button disabled={busy || !data?.hasMore} onClick={() => { setData(null); setPage(p => p + 1); }}>Suivant</button></nav>
    </section>;
}
