import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { subscribeWorkflow, workflowDueCount } from '../services/businessWorkflowService';
import './BusinessWorkflow.css';
export default function BusinessWorkflowAlert(){
 const profile=useAuthStore(s=>s.profile);
 if(!(profile?.is_admin || profile?.is_super_admin))return null;
 return <Alert key={`${profile.organization_id}:${profile.id}`} profile={profile}/>;
}
function Alert({profile}){
 const [count,setCount]=useState(0);
 useEffect(()=>{let stopped=false;async function refresh(){try{const value=await workflowDueCount();if(!stopped)setCount(value);}catch{/* The inbox displays connection errors without disrupting navigation. */}}refresh();const unsub=subscribeWorkflow(profile,refresh,'badge');const timer=setInterval(refresh,60000);return()=>{stopped=true;unsub();clearInterval(timer);};},[profile]);
 return <Link className="business-workflow-alert-link" to="/followups">À suivre {count>0?`· ${count} retour${count>1?'s':''} attendu${count>1?'s':''}`:''} →</Link>;
}
