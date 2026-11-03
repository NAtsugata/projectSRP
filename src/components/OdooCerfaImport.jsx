import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { company15498Defaults } from '../utils/cerfaData';
import './OdooCerfaImport.css';
import { requestOdoo } from '../services/odooService';

export default function OdooCerfaImport({ type, onImport }) {
    const profile = useAuthStore(state => state.profile);
    const [status, setStatus] = useState(null);
    const [query, setQuery] = useState('');
    const [clients, setClients] = useState([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const alive = useRef(true);
    const importRef = useRef(onImport);
    importRef.current = onImport;
    const admin = profile?.is_admin || profile?.is_super_admin;

    useEffect(() => {
        alive.current = true;
        let cancelled = false;
        setStatus(null);
        if (!admin) return () => { alive.current = false; };
        requestOdoo({ action: 'status' }).then(result => {
            if (!cancelled) setStatus(result);
        }).catch(error => {
            if (!cancelled) setStatus(error.status === 403 ? { forbidden: true } : { configured: false, missing: ['Connexion serveur à activer'] });
        });
        return () => { cancelled = true; alive.current = false; };
    }, [admin, profile?.id, profile?.organization_id]);

    const apply = useCallback(result => {
        if (result.type !== type) throw new Error('Ce lien correspond à un autre type de CERFA');
        const defaults = type === '15498' ? company15498Defaults(result.company) : {};
        importRef.current(Object.fromEntries(Object.entries({ ...defaults, ...result.data }).filter(([key, value]) => value !== '' || key === 'clientPrenom')));
        setMessage(`Coordonnées de ${result.client.name} chargées. Vérifiez les travaux, les mesures et les signatures avant de générer le PDF.`);
    }, [type]);

    useEffect(() => {
        if (!admin || !status?.configured) return;
        const params = new URLSearchParams(window.location.hash.slice(1));
        const token = params.get('odoo');
        if (!token) return;
        let cancelled = false;
        setBusy(true);
        setError('');
        requestOdoo({ action: 'redeem', token }).then(result => {
            if (cancelled) return;
            apply(result);
            // Remove the private token only after a successful import.
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        }).catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
    }, [admin, status?.configured, type, apply]);

    if (!admin || status?.forbidden) return null;
    const search = async () => {
        setBusy(true); setError(''); setMessage(''); setClients([]);
        try {
            const result = await requestOdoo({ action: 'search_clients', query: query.trim() });
            if (!alive.current) return;
            setClients(result.clients);
            if (!result.clients.length) setMessage('Aucun client trouvé. Essayez un autre nom.');
        } catch (err) { if (alive.current) setError(err.message); }
        finally { if (alive.current) setBusy(false); }
    };
    const load = async clientId => {
        setBusy(true); setError('');
        try {
            const result = await requestOdoo({ action: 'prefill', clientId, type });
            if (alive.current) { apply(result); setClients([]); }
        } catch (err) { if (alive.current) setError(err.message); }
        finally { if (alive.current) setBusy(false); }
    };

    return <section className="odoo-cerfa" aria-labelledby={`odoo-title-${type}`}>
        <h2 id={`odoo-title-${type}`}>Préremplir depuis Odoo</h2>
        {!status ? <p role="status">Vérification de la connexion…</p> : !status.configured ? <>
            <p>La connexion doit être activée par l’administrateur. Le formulaire reste utilisable.</p>
            <details><summary>Configuration de la connexion</summary>
                <p>Variables serveur manquantes : {(status.missing || []).join(', ')}</p>
                {status.organizationId && <p>Identifiant de votre organisation : <code>{status.organizationId}</code></p>}
                <p>Ne collez jamais une clé API dans un formulaire CERFA ou dans une conversation.</p>
            </details>
        </> : <>
            <p>Recherchez le client, puis chargez ses coordonnées et celles de votre entreprise.</p>
            <div className="odoo-cerfa-search">
                <label htmlFor={`odoo-search-${type}`}>Nom du client</label>
                <input id={`odoo-search-${type}`} type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!busy && query.trim().length >= 2) search(); } }} />
                <button type="button" disabled={busy || query.trim().length < 2} onClick={search}>{busy ? 'Chargement…' : 'Rechercher'}</button>
            </div>
            {clients.length > 0 && <ul className="odoo-cerfa-results">{clients.map(client => <li key={client.id}>
                <div><strong>{client.name}</strong><span>{client.address}</span></div>
                <button type="button" disabled={busy} onClick={() => load(client.id)}>Charger les coordonnées</button>
            </li>)}</ul>}
        </>}
        {error && <p className="odoo-cerfa-error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
    </section>;
}
