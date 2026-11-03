import { useState } from 'react';
import { normalizePlanningText, parisDay, shiftPlanningDay } from '../utils/planningAssistant';

export default function PlanningManualForm({ context, draft, onChange, onSubmit, busy }) {
    const [search, setSearch] = useState('');
    const filtered = context.clients.filter(c => normalizePlanningText(`${c.name} ${c.company_name || ''}`).includes(normalizePlanningText(search)));
    const selected = context.clients.find(c => c.id === draft.clientId);
    const options = [...new Map([...(selected ? [selected] : []), ...filtered.slice(0,100)].map(c => [c.id,c])).values()];
    const today = parisDay();
    const setDate = (i, value) => onChange({ dates: draft.dates.map((date,index) => index === i ? value : date) });
    return <form className="planning-manual-form planning-assistant-card" onSubmit={onSubmit}>
        <h3>Compléter les informations</h3><p>Les informations reconnues sont conservées. Vérifiez les champs, puis préparez les créneaux.</p>
        <fieldset disabled={busy}><legend>Intervenants de votre entité</legend>{context.employees.map(person => <label className="planning-person-choice" key={person.id}><input type="checkbox" checked={draft.staffIds.includes(person.id)} onChange={e => onChange({ staffIds: e.target.checked ? [...draft.staffIds,person.id] : draft.staffIds.filter(id => id !== person.id) })} />{person.full_name || 'Compte sans nom'}</label>)}</fieldset>
        <label htmlFor="planning-client-filter">Rechercher un client</label><input id="planning-client-filter" disabled={busy} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom du client" />
        <label htmlFor="planning-client-choice">Client</label><select id="planning-client-choice" disabled={busy} value={draft.clientId} onChange={e => onChange({ clientId: e.target.value })} required><option value="">Choisir un client de votre entité</option>{options.map(client => <option key={client.id} value={client.id}>{client.name}{client.company_name ? ` · ${client.company_name}` : ''}</option>)}</select>
        {filtered.length > 100 && <small>Affinez la recherche pour voir les autres clients.</small>}
        {draft.dates.map((date,i) => <div key={i}><label htmlFor={`planning-date-${i}`}>Date {i+1}</label><div className="planning-date-row"><input id={`planning-date-${i}`} type="date" value={date} min={today} max={shiftPlanningDay(today,366)} required disabled={busy} onChange={e => setDate(i,e.target.value)} /><button type="button" disabled={busy || draft.dates.length === 1} aria-label={`Retirer la date ${i+1}`} onClick={() => onChange({ dates: draft.dates.filter((_,index) => index !== i) })}>Retirer</button></div></div>)}
        <button type="button" disabled={busy || draft.dates.length >= 14} onClick={() => onChange({ dates: [...draft.dates,''] })}>Ajouter une date</button>
        <label htmlFor="planning-manual-time">Heure souhaitée (facultatif)</label><input id="planning-manual-time" type="time" disabled={busy} value={draft.time} onChange={e => onChange({ time: e.target.value })} /><small>Sans heure, je propose un créneau disponible.</small>
        <label htmlFor="planning-manual-period">Moment de la journée</label><select id="planning-manual-period" disabled={busy} value={draft.period || ''} onChange={e => onChange({ period: e.target.value })}><option value="">Indifférent</option><option value="morning">Matin</option><option value="afternoon">Après-midi</option></select>
        <label htmlFor="planning-manual-duration">Durée par rendez-vous (minutes)</label><input id="planning-manual-duration" type="number" min="15" max="480" step="15" required disabled={busy} value={draft.duration} onChange={e => onChange({ duration: e.target.value })} />
        <button disabled={busy}>Vérifier et proposer</button>
    </form>;
}
