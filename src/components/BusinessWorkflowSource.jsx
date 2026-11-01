import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getWorkflowItem, subscribeWorkflow } from '../services/businessWorkflowService';
import BusinessWorkflowCard from './BusinessWorkflowCard';
export default function BusinessWorkflowSource({type,sourceKey}){
 const profile=useAuthStore(s=>s.profile);
 if(!(profile?.is_admin || profile?.is_super_admin))return null;
 return <Source key={`${profile.organization_id}:${profile.id}:${type}:${sourceKey}`} profile={profile} type={type} sourceKey={sourceKey}/>;
}
function Source({profile,type,sourceKey}){
 const [item,setItem]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let stopped=false;async function refresh(){try{const result=await getWorkflowItem(type,sourceKey);if(!stopped)setItem(result);}catch(e){if(!stopped)setError(e.message);}}refresh();const unsub=subscribeWorkflow(profile,refresh,`${type}-${sourceKey}`);return()=>{stopped=true;unsub();};},[profile,type,sourceKey]);
 return <div className="business-workflow-source">{item?<BusinessWorkflowCard item={item} onSaved={setItem} compact/>:<Link to="/followups">Ouvrir le suivi métier et les relances →</Link>}{error && <p role="alert">{error}</p>}</div>;
}
