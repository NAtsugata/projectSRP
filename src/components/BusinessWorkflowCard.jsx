import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflowCommand, workflowHistory, reviewLegacyWorkflowItem } from '../services/businessWorkflowService';
import { WORKFLOW_STATUSES, WORKFLOW_TYPES, interpretManagerReply, validateWorkflowReply, terminalWorkflowStatus, workflowSourceUrl } from '../utils/businessWorkflow';
import { parisDay, shiftPlanningDay } from '../utils/planningAssistant';
import './BusinessWorkflow.css';
const dateLabel=value=>value ? new Date(value).toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

export default function BusinessWorkflowCard({item,onSaved,compact=false}) {
    const [editing,setEditing]=useState(false),[reason,setReason]=useState(''),[status,setStatus]=useState(item.status),[nextReview,setNextReview]=useState(shiftPlanningDay(parisDay(),7));
    const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[history,setHistory]=useState(null);
    const request=useRef(null),alive=useRef(true);
    useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
    const due=item.due_at && new Date(item.due_at)<=new Date() && !terminalWorkflowStatus(item.status);
    function change(patch) {request.current=null;setConfirmed(false);setNotice('');if(patch.status!==undefined)setStatus(patch.status);if(patch.reason!==undefined)setReason(patch.reason);if(patch.nextReview!==undefined)setNextReview(patch.nextReview);}
    function analyze(value) {
        const result=interpretManagerReply(value); change({reason:value,status:result.status,nextReview:result.nextReview});
        setNotice(result.needsClarification ? 'Vérifiez et choisissez le statut à appliquer.' : `Proposition : ${WORKFLOW_STATUSES[result.status]}. Vérifiez avant d’appliquer.`);
    }
    async function save(event) {
        event.preventDefault(); const fields={status,reason,nextReview:terminalWorkflowStatus(status)?'':nextReview,confirmed};
        const invalid=validateWorkflowReply(fields); if(invalid){setError(invalid);return;}
        setBusy(true);setError('');
        try {
            if(!request.current)request.current={requestId:crypto.randomUUID(),...(item.legacy?{sourceType:item.source_type,sourceKey:item.source_key,legacyRevision:item.legacy_revision}:{itemId:item.id,revision:item.revision}),...fields};
            const saved=item.legacy?await reviewLegacyWorkflowItem(request.current):await workflowCommand('reply',request.current);
            if(!alive.current)return;
            setEditing(false);setHistory(null);setReason('');setNotice('Retour enregistré.');request.current=null;onSaved?.(saved);
        }catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}
    }
    async function showHistory(event) {
        if(!event.currentTarget.open)return;
        try{const rows=await workflowHistory(item.id);if(alive.current)setHistory(rows);}catch(e){if(alive.current)setError(e.message);}
    }
    return <article className={`business-workflow-card ${due?'is-due':''} ${compact?'is-compact':''}`}>
        <header><div><small>{WORKFLOW_TYPES[item.source_type]} · {item.legacy?'Ancien dossier':'Suivi métier'}</small><h3><Link to={workflowSourceUrl(item)}>{item.title}</Link></h3></div><span className={`business-workflow-status ${item.legacy?'waiting':item.status}`}>{item.legacy?'À qualifier':WORKFLOW_STATUSES[item.status]}</span></header>
        {item.legacy?<p className="business-workflow-question">Ce dossier du {new Date(`${item.source_date}T12:00:00`).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})} est toujours ouvert. Que faut-il en faire ?</p>:due && <p className="business-workflow-question">Ce dossier attend votre retour. Quelle est la situation et la prochaine action ?</p>}
        <p className="business-workflow-meta">{item.legacy?'Dernière modification enregistrée':'Dernière évolution'} : {dateLabel(item.last_activity_at)}<br/>{item.legacy?`Statut enregistré : ${WORKFLOW_STATUSES[item.status]}`:`Prochain contrôle : ${dateLabel(item.due_at)}`}</p>
        {item.reason && <p><strong>Dernier motif :</strong> {item.reason}</p>}
        <button type="button" disabled={busy} onClick={()=>{request.current=null;setEditing(v=>!v);setStatus(item.status);setError('');setConfirmed(false);}}>{editing?'Fermer le retour':'Répondre / changer le statut'}</button>
        {editing && <form onSubmit={save}>
            <div className="business-workflow-actions">{[...(item.legacy?['todo']:[]),'waiting','procedure','completed','cancelled'].map(s=><button key={s} type="button" disabled={busy} aria-pressed={status===s} onClick={()=>change({status:s})}>{item.legacy && s==='todo'?'À reprendre':WORKFLOW_STATUSES[s]}</button>)}</div>
            <label htmlFor={`workflow-reason-${item.id}`}>Retour du gérant / motif</label><textarea id={`workflow-reason-${item.id}`} required minLength={3} maxLength={2000} disabled={busy} value={reason} onChange={e=>analyze(e.target.value)} placeholder="On attend la pièce vendredi" />
            {notice && <p role="status">{notice}</p>}
            <label htmlFor={`workflow-status-${item.id}`}>Statut à appliquer</label><select id={`workflow-status-${item.id}`} required disabled={busy} value={status} onChange={e=>change({status:e.target.value})}><option value="">Choisir le statut</option>{Object.entries(WORKFLOW_STATUSES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
            {!terminalWorkflowStatus(status) && <><label htmlFor={`workflow-review-${item.id}`}>Prochain contrôle</label><input id={`workflow-review-${item.id}`} required={['waiting','procedure'].includes(status)} type="date" min={shiftPlanningDay(parisDay(),1)} max={shiftPlanningDay(parisDay(),366)} disabled={busy} value={nextReview} onChange={e=>change({nextReview:e.target.value})}/></>}
            {terminalWorkflowStatus(status) && <label className="business-workflow-confirm"><input type="checkbox" required disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Je confirme {status==='cancelled'?'l’annulation de ce suivi':'la fin des travaux'}. La facturation Odoo reste séparée.</label>}
            {item.source_type==='chantier' && status==='completed' && <p>La réception administrative du chantier reste à valider dans sa fiche.</p>}
            <button disabled={busy}>{busy?'Enregistrement…':'Appliquer le retour'}</button>
        </form>}
        {error && <p role="alert">{error}</p>}{!editing && notice && <p role="status">{notice}</p>}
        {!item.legacy && <details onToggle={showHistory}><summary>Historique des décisions</summary>{history?.length===0 && <p>Aucune décision enregistrée.</p>}{history?.map(event=><div className="business-workflow-event" key={event.id}><strong>{event.actor_name} · {WORKFLOW_STATUSES[event.to_status]}</strong><small>{dateLabel(event.created_at)}</small><p>{event.reason}</p>{event.next_review_at && <small>Prochain contrôle : {dateLabel(event.next_review_at)}</small>}</div>)}</details>}
    </article>;
}
