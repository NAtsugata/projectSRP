import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { planningIdentity, assertPlanningIdentity } from '../services/planningAssistantService';
import { subscribeWorkflow, workflowCommand } from '../services/businessWorkflowService';
import BusinessWorkflowCard from './BusinessWorkflowCard';
export function useOdooBusinessWorkflow(quotes,profile){
 const [items,setItems]=useState({}),[error,setError]=useState('');
 const signature=JSON.stringify(quotes.map(q=>({id:q.id,title:`${q.reference} · ${q.client}`,invoiced:q.canComplete})));
 useEffect(()=>{let stopped=false,sequence=0,timer;setItems({});
  async function refresh(register=false){const current=++sequence;try{const scope=planningIdentity(),batch=JSON.parse(signature);if(register && batch.length)await workflowCommand('register_quotes',{quotes:batch});if(!batch.length)return;const result=await supabase.from('business_workflow_items').select('*').eq('organization_id',scope.org).eq('owner_id',scope.id).eq('source_type','odoo_quote').in('source_key',batch.map(q=>String(q.id)));assertPlanningIdentity(scope);if(result.error)throw result.error;if(!stopped && current===sequence){setError('');setItems(Object.fromEntries(result.data.map(i=>[i.source_key,i])));}}catch(e){if(!stopped && current===sequence)setError(e.message);}}
  refresh(true);const unsub=subscribeWorkflow(profile,()=>{clearTimeout(timer);timer=setTimeout(()=>refresh(false),200);},'quotes');return()=>{stopped=true;clearTimeout(timer);unsub();};
 },[signature,profile]);
 return {items,error,saved:item=>setItems(previous=>({...previous,[item.source_key]:item}))};
}
export default function OdooBusinessWorkflow({item,onSaved}){
 return item?<BusinessWorkflowCard item={item} onSaved={onSaved} compact/>:<p><Link to="/followups">Activer ou consulter le suivi métier →</Link></p>;
}
