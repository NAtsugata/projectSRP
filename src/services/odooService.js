import { supabase } from '../lib/supabaseClient';
import { planningIdentity, assertPlanningIdentity } from './planningAssistantService';
export async function requestOdoo(body) {
    const scope = planningIdentity();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Connectez-vous au portail');
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/srp-odoo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
    });
    const result = await response.json().catch(() => ({}));
    assertPlanningIdentity(scope);
    if (!response.ok) { const error = new Error(result.error || 'Connexion Odoo indisponible'); error.status = response.status; throw error; }
    return result;
}
