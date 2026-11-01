import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getWorkflowSettings, listWorkflowItems, subscribeWorkflow, workflowCommand } from '../services/businessWorkflowService';
import { WORKFLOW_STATUSES, WORKFLOW_TYPES } from '../utils/businessWorkflow';
import BusinessWorkflowCard from '../components/BusinessWorkflowCard';
import '../components/BusinessWorkflow.css';
export default function BusinessFollowupsPage(){
 const profile=useAuthStore(s=>s.profile);
 if(!profile?.organization_id || !(profile.is_admin || profile.is_super_admin))return <p>Accès réservé aux administrateurs de votre entité.</p>;
 return <Followups key={`${profile.organization_id}:${profile.id}`} profile={profile}/>;
}
function Followups({profile}){
 const [settings,setSettings]=useState(null),[items,setItems]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(0),[status,setStatus]=useState(''),[type,setType]=useState(''),[dueOnly,setDueOnly]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
   const [setting,result]=await Promise.all([getWorkflowSettings(),listWorkflowItems({page,status,type,dueOnly})]);
   return {setting,...result};
 },[page,status,type,dueOnly]);
 useEffect(()=>{let stopped=false,sequence=0;
   async function refresh(){const current=++sequence;setBusy(true);setError('');try{const result=await load();if(!stopped && current===sequence){setSettings(result.setting);setItems(result.items);setCount(result.count);}}catch(e){if(!stopped && current===sequence)setError(e.message);}finally{if(!stopped && current===sequence)setBusy(false);}}
   refresh();const unsub=subscribeWorkflow(profile,refresh,'inbox');const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
   return()=>{stopped=true;unsub();clearInterval(timer);};
 },[load,profile]);
 async function toggle(){setBusy(true);setError('');try{await workflowCommand(settings?.enabled?'pause':'enable');const result=await load();setSettings(result.setting);setItems(result.items);setCount(result.count);}catch(e){setError(e.message);}finally{setBusy(false);}}
 function filter(setter,value){setPage(0);setter(value);}
 return <section className="business-workflow-page"><header><div><h1>À suivre aujourd’hui</h1><p>Décisions attendues, motifs de blocage et prochaines actions</p></div><button disabled={busy} onClick={toggle}>{settings?.enabled?'Suspendre les relances':'Activer les relances pour mon entité'}</button></header>
 <p>{settings?.enabled ? 'Relances actives : un dossier sans évolution pendant 7 jours demande un retour au responsable. Une seule demande est ouverte par évolution du dossier.' : 'Les relances sont suspendues. Les décisions enregistrées restent consultables.'}</p>
 <p>L’activation vous désigne comme responsable initial et inscrit les interventions et chantiers actifs de votre entité. Le compteur des anciens dossiers démarre aujourd’hui. Un rendez-vous futur ne sera pas relancé avant sa date passée de 7 jours. Les devis Odoo en attente sont ajoutés au suivi lorsqu’ils sont consultés.</p>
 <div className="business-workflow-filters"><label><input type="checkbox" checked={dueOnly} onChange={e=>filter(setDueOnly,e.target.checked)}/>Uniquement les contrôles arrivés à échéance</label><label>Statut<select value={status} onChange={e=>filter(setStatus,e.target.value)}><option value="">Tous les statuts</option>{Object.entries(WORKFLOW_STATUSES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Dossier<select value={type} onChange={e=>filter(setType,e.target.value)}><option value="">Tous les dossiers</option>{Object.entries(WORKFLOW_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
 {error && <p role="alert">{error}</p>}{busy && <p aria-live="polite">Actualisation du suivi…</p>}<p>{count} dossier{count>1?'s':''} correspondant aux filtres</p>
 <div className="business-workflow-grid">{items.map(item=><BusinessWorkflowCard key={item.id} item={item} onSaved={saved=>setItems(previous=>previous.map(i=>i.id===saved.id?saved:i))}/>)}</div>
 {!busy && !items.length && <p>Aucun dossier à afficher avec ces filtres.</p>}
 <nav aria-label="Pagination du suivi"><button disabled={busy || page===0} onClick={()=>setPage(p=>p-1)}>Précédent</button><span>Page {page+1}</span><button disabled={busy || (page+1)*25>=count} onClick={()=>setPage(p=>p+1)}>Suivant</button></nav></section>;
}
