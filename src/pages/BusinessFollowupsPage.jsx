import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { getWorkflowSettings, listWorkflowItems, listLegacyWorkflowItems, subscribeWorkflow, workflowCommand } from '../services/businessWorkflowService';
import { WORKFLOW_STATUSES, WORKFLOW_TYPES } from '../utils/businessWorkflow';
import BusinessWorkflowCard from '../components/BusinessWorkflowCard';
import { workflowQueue } from '../utils/workflowQueue';
import '../components/BusinessWorkflow.css';
export default function BusinessFollowupsPage(){
 const profile=useAuthStore(s=>s.profile);
 const [params]=useSearchParams();
 const initialView=params.get('view')==='followups'?'followups':'legacy';
 if(!profile?.organization_id || !(profile.is_admin || profile.is_super_admin))return <p>Accès réservé aux administrateurs de votre entité.</p>;
 return <Followups key={`${profile.organization_id}:${profile.id}:${initialView}`} profile={profile} initialView={initialView}/>;
}
function Followups({profile,initialView}){
 const [search,setSearch]=useState(''),[order,setOrder]=useState('priority');
 const [view,setView]=useState(initialView),[legacyCount,setLegacyCount]=useState(0),[refreshTick,setRefreshTick]=useState(0);
 const [settings,setSettings]=useState(null),[items,setItems]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(0),[status,setStatus]=useState(''),[type,setType]=useState(''),[dueOnly,setDueOnly]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
   const [setting,legacy,result]=await Promise.all([getWorkflowSettings(),listLegacyWorkflowItems({page:view==='legacy'?page:0,type:view==='legacy'?type:''}),view==='legacy'?Promise.resolve(null):listWorkflowItems({page,status,type,dueOnly})]);
   return {setting,legacyCount:legacy.count,...(view==='legacy'?legacy:result)};
 },[page,status,type,dueOnly,view]);
 useEffect(()=>{let stopped=false,sequence=0;
   async function refresh(){const current=++sequence;setBusy(true);setError('');try{const result=await load();if(!stopped && current===sequence){setSettings(result.setting);setItems(result.items);setCount(result.count);setLegacyCount(result.legacyCount);}}catch(e){if(!stopped && current===sequence)setError(e.message);}finally{if(!stopped && current===sequence)setBusy(false);}}
   refresh();const unsub=subscribeWorkflow(profile,refresh,'inbox');const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
   return()=>{stopped=true;unsub();clearInterval(timer);};
 },[load,profile,refreshTick]);
 async function toggle(){setBusy(true);setError('');try{await workflowCommand(settings?.enabled?'pause':'enable');const result=await load();setSettings(result.setting);setItems(result.items);setCount(result.count);}catch(e){setError(e.message);}finally{setBusy(false);}}
 function filter(setter,value){setPage(0);setter(value);}
 const queue=workflowQueue(items,{search,order});
 return <section className="business-workflow-page"><header><div><h1>À suivre aujourd’hui</h1><p>Décisions attendues, motifs de blocage et prochaines actions</p></div><button disabled={busy} onClick={toggle}>{settings?.enabled?'Suspendre les relances':'Activer les relances pour mon entité'}</button></header>
 <p>{settings?.enabled ? 'Relances actives : un dossier sans évolution pendant 7 jours demande un retour au responsable. Une seule demande est ouverte par évolution du dossier.' : 'Les relances sont suspendues. Les décisions enregistrées restent consultables.'}</p>
 <p>Les anciens dossiers ouverts depuis plus de 7 jours sont à qualifier dès maintenant. Cette revue fonctionne même si les relances automatiques sont désactivées. Chaque décision s’applique uniquement au dossier choisi et conserve votre motif dans l’historique.</p>
 <div className="business-workflow-actions" aria-label="Vues du suivi"><button aria-pressed={view==='legacy'} onClick={()=>{setView('legacy');setPage(0);setType('');}}>Anciens à qualifier ({legacyCount})</button><button aria-pressed={view==='followups'} onClick={()=>{setView('followups');setPage(0);setType('');}}>Contrôles et suivi</button></div>
 <div className="business-workflow-filters">{view!=='legacy' && <><label><input type="checkbox" checked={dueOnly} onChange={e=>filter(setDueOnly,e.target.checked)}/>Uniquement les contrôles arrivés à échéance</label><label>Statut<select value={status} onChange={e=>filter(setStatus,e.target.value)}><option value="">Tous les statuts</option>{Object.entries(WORKFLOW_STATUSES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></>}<label>Dossier<select value={type} onChange={e=>filter(setType,e.target.value)}><option value="">Tous les dossiers</option>{Object.entries(WORKFLOW_TYPES).filter(([k])=>view!=='legacy'||k!=='odoo_quote').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
 {error && <p role="alert">{error}</p>}{busy && <p aria-live="polite">Actualisation du suivi…</p>}<p>{count} dossier{count>1?'s':''} correspondant aux filtres</p>
 <section className="manager-queue-overview" aria-label="Priorités de la page"><div><span>À REVOIR</span><strong>{queue.overdue}</strong><small>Contrôles arrivés à échéance</small></div><div><span>DOSSIERS BLOQUÉS</span><strong>{queue.blocked}</strong><small>Attente ou procédure en cours</small></div><div><span>À QUALIFIER</span><strong>{queue.legacy}</strong><small>Anciens dossiers de cette page</small></div></section>
 <div className="manager-queue-tools"><label>Rechercher dans cette page<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Client, chantier ou motif…"/></label><label>Ordre d’affichage<select value={order} onChange={e=>setOrder(e.target.value)}><option value="priority">Priorité à la prochaine action</option><option value="recent">Modification récente</option><option value="title">Nom du dossier</option></select></label></div>
 <p className="manager-queue-caption">{queue.items.length} dossier(s) visible(s) sur cette page · Les compteurs ci-dessus concernent les dossiers chargés, pas l’ensemble de l’entreprise.</p>
 <div className="business-workflow-grid">{queue.items.map(item=><BusinessWorkflowCard key={item.id} item={item} onSaved={saved=>{if(item.legacy)setItems(previous=>previous.filter(i=>i.id!==item.id));else setItems(previous=>previous.map(i=>i.id===saved.id?saved:i));setRefreshTick(n=>n+1);}}/>)}</div>
 {!busy && items.length>0 && queue.items.length===0 && <p>Aucun dossier de cette page ne correspond à votre recherche.</p>}
 {!busy && !items.length && <p>Aucun dossier à afficher avec ces filtres.</p>}
 <nav aria-label="Pagination du suivi"><button disabled={busy || page===0} onClick={()=>setPage(p=>p-1)}>Précédent</button><span>Page {page+1}</span><button disabled={busy || (page+1)*25>=count} onClick={()=>setPage(p=>p+1)}>Suivant</button></nav></section>;
}
