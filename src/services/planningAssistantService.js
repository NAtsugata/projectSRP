import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';

export function planningIdentity() {
    const p = useAuthStore.getState().profile;
    if (!p?.id || !p.organization_id) throw new Error('Session requise');
    return { id: p.id, org: p.organization_id };
}
export function assertPlanningIdentity(scope) {
    const current = planningIdentity();
    if (current.id !== scope.id || current.org !== scope.org) throw new Error('Session modifiée : rouvrez l’assistant.');
}
export async function loadPlanningContext() {
    const scope = planningIdentity();
    const queries = [
        ['employees', supabase.from('profiles').select('id,full_name').eq('organization_id', scope.org)],
        ['clients', supabase.from('clients').select('id,name,company_name').eq('organization_id', scope.org).eq('is_active', true)],
        ['interventions', supabase.from('interventions').select('id,client,client_id,date,time,status,duration_minutes,scheduled_dates,is_archived,intervention_assignments(user_id)').eq('organization_id', scope.org).eq('is_archived', false).not('status', 'in', '(Terminée,Annulée)')],
        ['absences', supabase.from('employee_absences').select('employee_id,start_date,end_date').eq('organization_id', scope.org)],
        ['leaves', supabase.from('leave_requests').select('user_id,start_date,end_date,status').eq('organization_id', scope.org)],
    ];
    const entries = await Promise.all(queries.map(async ([key, query]) => {
        // Fetch max+1: never infer availability from a truncated dataset.
        const { data, error } = await query.limit(1000);
        if (error) throw error;
        if (data.length >= 1000) throw new Error('Planning volumineux : utilisez l’agenda pour vérifier les disponibilités.');
        return [key, data];
    }));
    assertPlanningIdentity(scope);
    return { ...Object.fromEntries(entries), scope };
}
export async function createPlanningBatch(requestId, bookings, scope) {
    assertPlanningIdentity(scope);
    const { data, error } = await supabase.rpc('create_planning_batch', {
        p_request_id: requestId,
        p_events: bookings.map(({ date, time, duration, staffIds, clientId, service }) => ({ date, time, duration, staffIds, clientId, service })),
    });
    if (error) throw error;
    assertPlanningIdentity(scope);
    return data;
}
