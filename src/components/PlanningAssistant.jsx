import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { loadPlanningContext, createPlanningBatch } from '../services/planningAssistantService';
import { parsePlanningCommand, proposePlanning, slotAvailable, planningBacklog, parisDay, shiftPlanningDay } from '../utils/planningAssistant';
import './PlanningAssistant.css';

const dayLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export default function PlanningAssistant({ profile }) {
    const [open, setOpen] = useState(false), [text, setText] = useState('');
    const [context, setContext] = useState(null), [plan, setPlan] = useState(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null);
    const [changed, setChanged] = useState(false), [suggestion, setSuggestion] = useState('');
    const requestId = useRef(null), trigger = useRef(null), input = useRef(null), alive = useRef(true);
    const queryClient = useQueryClient();
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => {
        if (!open) return;
        input.current?.focus();
        let cancelled = false;
        loadPlanningContext().then(data => { if (!cancelled) setContext(data); }).catch(e => { if (!cancelled) setError(e.message); });
        const onKey = e => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
        document.addEventListener('keydown', onKey);
        const channel = supabase.channel(`assistant-${profile.organization_id}-${profile.id}`).on('postgres_changes', {
            event: '*', schema: 'public', table: 'interventions', filter: `organization_id=eq.${profile.organization_id}`,
        }, () => {
            setChanged(true);
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
            loadPlanningContext().then(data => { if (!cancelled) setContext(data); }).catch(e => { if (!cancelled) setError(e.message); });
        }).subscribe();
        return () => { cancelled = true; document.removeEventListener('keydown', onKey); supabase.removeChannel(channel); };
    }, [open, profile.id, profile.organization_id, queryClient]);

    async function prepare(event) {
        event?.preventDefault(); setBusy(true); setError(''); setResult(null); setPlan(null);
        try {
            const fresh = await loadPlanningContext();
            const proposal = proposePlanning(parsePlanningCommand(text, fresh), fresh);
            if (proposal.error) throw new Error(proposal.error);
            if (!alive.current) return;
            setContext(fresh); setPlan(proposal); setChanged(false); requestId.current = crypto.randomUUID();
        } catch (e) { if (alive.current) setError(e.message); }
        finally { if (alive.current) setBusy(false); }
    }
    function edit(index, field, value) {
        setPlan(previous => ({ ...previous, bookings: previous.bookings.map((b, i) => i === index ? { ...b, [field]: value } : b) }));
        requestId.current = crypto.randomUUID();
    }
    async function create() {
        setBusy(true); setError('');
        try {
            const fresh = await loadPlanningContext();
            if (!plan.bookings.every(booking => slotAvailable(booking, fresh))) throw new Error('Un créneau est indisponible. Modifiez les horaires ou relancez la proposition.');
            const saved = await createPlanningBatch(requestId.current, plan.bookings, fresh.scope);
            if (!alive.current) return;
            setResult(saved); setPlan(null); setChanged(false);
            queryClient.invalidateQueries({ queryKey: ['interventions'] });
            setContext(await loadPlanningContext());
        } catch (e) { if (alive.current) setError(e.message); }
        finally { if (alive.current) setBusy(false); }
    }
    function suggest(item) {
        const client = context.clients.find(c => c.id === item.client_id);
        const staff = context.employees.filter(p => item.intervention_assignments?.some(a => a.user_id === p.id));
        if (!client || !staff.length) { setError('Ouvrez cette intervention pour préciser son client et ses intervenants.'); return; }
        const proposal = proposePlanning({ client, staff, dates: [shiftPlanningDay(parisDay(), 1)], time: null, duration: item.duration_minutes || 60 }, context);
        // Rescheduling must not duplicate an existing intervention.
        setError('');
        setSuggestion(`Créneau suggéré : ${proposal.bookings[0].time || 'aucun disponible'} demain. Ouvrez l’intervention existante pour la déplacer.`);
    }
    return <>
        <button className="planning-assistant-trigger" ref={trigger} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="planning-assistant">✦ Assistant planning</button>
        {open && <section className="planning-assistant-panel" id="planning-assistant" role="dialog" aria-labelledby="planning-assistant-title">
            <header><div><h2 id="planning-assistant-title">Assistant planning</h2><small>Votre entité · Sans API payante</small></div><button aria-label="Fermer l’assistant" onClick={() => { setOpen(false); trigger.current?.focus(); }}>✕</button></header>
            <div className="planning-assistant-body">
                <p>Indiquez les personnes, le client et les dates. Je propose les créneaux disponibles ; vous vérifiez puis créez les rendez-vous.</p>
                <form onSubmit={prepare}><label htmlFor="planning-message">Votre demande</label><textarea disabled={busy} ref={input} id="planning-message" value={text} onChange={e => setText(e.target.value)} placeholder="Tiemoko et Seb rendez-vous chez Leneutre demain et après-demain à 9h pendant 1h" required maxLength={1000} /><button disabled={busy}>Proposer les rendez-vous</button></form>
                <p className="planning-assistant-note">Horaires proposés : 08h–12h et 13h–18h. Durée par défaut : 1h. Les anciennes interventions sans durée bloquent la journée des personnes affectées.</p>
                <div aria-live="polite">{busy && <p>Vérification du planning…</p>}{error && <p role="alert">{error}</p>}{changed && plan && <p>Le planning a changé. Les disponibilités seront revérifiées avant création.</p>}</div>
                {plan && <div><h3>{plan.client.name}</h3><p>{plan.staff.map(p => p.full_name).join(' et ')}</p>{plan.bookings.map((booking, i) => <article className="planning-assistant-card" key={booking.date + i}>
                    <strong>{dayLabel(booking.date)}</strong>
                    <label>Heure<input disabled={busy} type="time" value={booking.time} step="900" onChange={e => edit(i, 'time', e.target.value)} /></label>
                    <label>Durée (min)<input disabled={busy} type="number" min="15" max="480" step="15" value={booking.duration} onChange={e => edit(i, 'duration', Number(e.target.value))} /></label>
                    {!booking.time && <p>Aucun créneau trouvé pour cette journée.</p>}
                    {booking.alternatives.length > 0 && <small>Autres horaires : {booking.alternatives.join(' · ')}</small>}
                </article>)}<button disabled={busy || plan.bookings.some(b => !b.time)} onClick={create}>Créer les {plan.bookings.length} rendez-vous</button></div>}
                {result && <div role="status"><h3>Rendez-vous créés</h3>{result.events.map(e => <p key={e.id}><Link to={`/planning/${e.id}`}>{e.client} · {dayLabel(e.date)} à {e.time.slice(0,5)}</Link></p>)}</div>}
                {context && <div><h3>Interventions à traiter</h3>{suggestion && <p role="status">{suggestion}</p>}{planningBacklog(context.interventions).length ? planningBacklog(context.interventions).map(item => <article className="planning-assistant-card" key={item.id}><Link to={`/planning/${item.id}`}>{item.client} · {dayLabel(item.date)}</Link><button disabled={busy} onClick={() => suggest(item)}>Proposer un créneau</button></article>) : <p>Aucune intervention en retard ou à traiter aujourd’hui.</p>}<Link to="/agenda">Voir tout l’agenda →</Link></div>}
            </div>
        </section>}
    </>;
}
