import { useEffect, useState } from 'react';
import { requestOdoo } from '../services/odooService';
import './WorkInstructions.css';

const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const previewLength = 4;

function WorkOrder({ order, showReference }) {
    const [expanded, setExpanded] = useState(false);
    const remaining = order.lines.length - previewLength;
    const visibleLines = expanded ? order.lines : order.lines.slice(0, previewLength);

    return (
        <article>
            {showReference && <h3 className="work-order-reference">Devis {order.reference}</h3>}
            <ol className="work-order-lines">
                {visibleLines.map((line, index) => (
                    <li key={index}>
                        <span>{line.designation}</span>
                        <strong>{quantityFormat.format(line.quantity)}{line.unit && ` ${line.unit}`}</strong>
                    </li>
                ))}
            </ol>
            {remaining > 0 && (
                <button className="work-orders-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                    {expanded ? 'Afficher moins' : `Voir ${remaining} autre${remaining > 1 ? 's' : ''} prestation${remaining > 1 ? 's' : ''}`}
                </button>
            )}
        </article>
    );
}

export default function WorkInstructions({ interventionId, isAdmin = false }) {
    const [orderReference, setOrderReference] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(true);

    useEffect(() => {
        let active = true;
        setBusy(true);
        setError('');
        requestOdoo({ action: 'work_instructions', interventionId: Number(interventionId), ...(orderReference ? { orderReference } : {}) })
            .then(result => { if (active) setData(result); })
            .catch(error => { if (active) setError(error.message); })
            .finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [interventionId, orderReference, attempt]);

    const orders = data?.orders ?? [];
    const reference = !busy && !error && orders.length === 1 ? orders[0].reference : null;

    return (
        <section className="work-instructions" aria-labelledby="work-instructions-title">
            <header>
                <h2 id="work-instructions-title">Travaux à réaliser</h2>
                {reference && <span className="work-order-reference">Devis {reference}</span>}
            </header>
            {isAdmin && data?.choices?.length > 0 && (
                <label className="work-instructions-select">
                    Consulter un devis validé
                    <select disabled={busy} value={orderReference} onChange={event => { setBusy(true); setOrderReference(event.target.value); }}>
                        <option value="">Devis de l’intervention (automatique)</option>
                        {data.choices.map(order => <option key={order.reference} value={order.reference}>{order.reference}{order.date && ` · ${String(order.date).slice(0, 10)}`}</option>)}
                    </select>
                    <small>Ce choix change uniquement ta consultation.</small>
                </label>
            )}
            {busy && <p role="status" className="work-instructions-message">Chargement des désignations du devis…</p>}
            {!busy && error && (
                <div className="work-instructions-message">
                    <p role="alert">Impossible de charger le devis. {error}</p>
                    <button className="work-orders-toggle" type="button" onClick={() => setAttempt(value => value + 1)}>Réessayer</button>
                </div>
            )}
            {!busy && !error && orders.length === 0 && <p className="work-instructions-message">Aucune prestation issue d’un devis validé pour cette intervention.</p>}
            {!busy && !error && orders.map(order => <WorkOrder key={order.reference} order={order} showReference={!reference} />)}
        </section>
    );
}
