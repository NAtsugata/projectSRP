import { supabase } from '../lib/supabaseClient';
import { planningIdentity, assertPlanningIdentity } from './planningAssistantService';

async function checked(query, scope) {
    const result=await query;
    assertPlanningIdentity(scope);
    if(result.error) throw result.error;
    return result;
}
export async function workflowCommand(action,payload={}) {
    const scope=planningIdentity();
    return (await checked(supabase.rpc('business_workflow_command',{p_action:action,p_payload:payload}),scope)).data;
}
export async function getWorkflowSettings() {
    const scope=planningIdentity();
    return (await checked(supabase.from('business_workflow_settings').select('*').eq('organization_id',scope.org).maybeSingle(),scope)).data;
}
export async function listWorkflowItems({page=0,status='',type='',dueOnly=true}={}) {
    const scope=planningIdentity();
    let query=supabase.from('business_workflow_items').select('*',{count:'exact'}).eq('organization_id',scope.org);
    if(status) query=query.eq('status',status);
    if(type) query=query.eq('source_type',type);
    if(dueOnly) query=query.lte('due_at',new Date().toISOString()).not('status','in','(completed,cancelled)');
    const result=await checked(query.order('due_at',{ascending:true,nullsFirst:false}).order('id').range(page*25,page*25+24),scope);
    return {items:result.data || [],count:result.count || 0};
}
export async function workflowDueCount() {
    const scope=planningIdentity();
    return (await checked(supabase.from('business_workflow_items').select('id',{count:'exact',head:true}).eq('organization_id',scope.org).eq('manager_id',scope.id).lte('due_at',new Date().toISOString()).not('status','in','(completed,cancelled)'),scope)).count || 0;
}
export async function getWorkflowItem(type,key) {
    const scope=planningIdentity();
    return (await checked(supabase.from('business_workflow_items').select('*').eq('organization_id',scope.org).eq('source_type',type).eq('source_key',String(key)).maybeSingle(),scope)).data;
}
export async function workflowHistory(itemId) {
    const scope=planningIdentity();
    return (await checked(supabase.from('business_workflow_events').select('id,actor_name,from_status,to_status,reason,next_review_at,created_at').eq('organization_id',scope.org).eq('item_id',itemId).order('created_at',{ascending:false}).limit(30),scope)).data;
}
export function subscribeWorkflow(profile,callback,name='view') {
    const channel=supabase.channel(`workflow-${name}-${profile.organization_id}-${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'business_workflow_items',filter:`organization_id=eq.${profile.organization_id}`},callback).subscribe();
    return ()=>{supabase.removeChannel(channel);};
}
