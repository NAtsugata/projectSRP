import { useEffect,useRef,useState } from 'react';
import { Link,useLocation,useNavigate,useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useModules } from '../hooks/useModules';
import { isHrefHidden } from '../config/menuModules';
import { readAssistantDraft,REQUEST_CATEGORIES,validatePersonalRequest } from '../utils/requestAssistant';
import { personalRequestId,requestScope,listPersonalRequests,submitPersonalRequest } from '../services/personalRequestService';
import { leaveStatusLabel } from '../utils/leaveStatus';
import './PersonalRequestsPage.css';

export default function PersonalRequestsPage(){
    const profile=useAuthStore(s=>s.profile),organization=useAuthStore(s=>s.organization),{hasModule}=useModules(),location=useLocation(),navigate=useNavigate(),[params]=useSearchParams(),[notice,setNotice]=useState('');
    const allowed=['leave','expense'].filter(kind=>{const module=kind==='leave'?'leaves':'expenses';return hasModule(module) && !isHrefHidden(`/${module}`,organization?.settings?.hidden_modules || []);});
    if(!profile?.id || !profile.organization_id)return <p role="alert">Connectez-vous pour retrouver vos demandes.</p>;
    if(!allowed.length)return <p>Aucun module de demande n’est accessible. Contactez votre responsable.</p>;
    const kind=allowed.includes(params.get('type'))?params.get('type'):allowed[0],draft=readAssistantDraft(location.state?.assistantDraft,profile);
    return <div className="personal-requests"><header><small>MON ESPACE PERSONNEL</small><h1>Mes demandes</h1><p>Préparer, vérifier et suivre mes demandes auprès de mon entreprise.</p></header><nav aria-label="Type de demande">{allowed.map(value=><button type="button" key={value} aria-pressed={value===kind} onClick={()=>{setNotice('');navigate(`/my-requests?type=${value}`,{replace:true,state:null});}}>{value==='leave'?'Congés / absences':'Notes de frais'}</button>)}</nav>
        {location.state?.assistantDraft && !draft && <p role="alert">Ce brouillon a expiré ou appartient à une autre session. Remplissez le formulaire ou rouvrez l’assistant.</p>}
        {notice?.scope===profile.organization_id+':'+profile.id && <p role="status">{notice.text}</p>}
        <PersonalRequestForm onSaved={result=>{setNotice({scope:profile.organization_id+':'+profile.id,text:'Demande enregistrée. Statut : '+leaveStatusLabel(result.status)+'.'});navigate(`/my-requests?type=${kind}`,{replace:true,state:null});}} key={`${profile.organization_id}:${profile.id}:${kind}:${draft?.id || 'manual'}`} kind={kind} profile={profile} initial={draft?.kind===kind?draft.values:null}/>
    </div>;
}
function PersonalRequestForm({kind,profile,initial,onSaved}){
    const blank=()=>kind==='leave'?{startDate:'',endDate:'',reason:''}:{date:'',category:'other',amount:'',description:''};
    const [values,setValues]=useState(()=>initial || blank()),[files,setFiles]=useState([]),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[rows,setRows]=useState([]),[listError,setListError]=useState('');
    const stable=useRef(null),lock=useRef(false),alive=useRef(true),queries=useQueryClient();
    function change(field,value){if(stable.current){setError('');stable.current=null;}setValues(v=>({...v,[field]:value}));setConfirmed(false);setSuccess('');}
    useEffect(()=>{alive.current=true;let active=true;listPersonalRequests(kind).then(data=>{if(active)setRows(data);}).catch(e=>{if(active)setListError(e.message);});return()=>{active=false;alive.current=false;};},[kind]);
    async function submit(event){
        event.preventDefault();if(lock.current)return;
        const invalid=validatePersonalRequest(kind,values);if(invalid || !confirmed){setError(invalid || 'Confirmez avoir vérifié la demande.');return;}
        lock.current=true;setBusy(true);setError('');setSuccess('');
        try{
            if(!stable.current)stable.current={id:personalRequestId(kind),scope:requestScope(),values:{...values},files:[...files]};
            const command=stable.current,result=await submitPersonalRequest(kind,command.values,command);
            if(!alive.current)return;
            setRows(previous=>[result,...previous.filter(r=>String(r.id)!==String(result.id))]);setValues(blank());setFiles([]);setConfirmed(false);stable.current=null;setSuccess('Demande enregistrée et en attente de validation.');
            queries.invalidateQueries({queryKey:[kind==='leave'?'leaveRequests':'expenses']});onSaved?.(result);
        }catch(e){if(alive.current)setError(e.message || 'Envoi impossible. Le formulaire est conservé pour réessayer.');}finally{lock.current=false;if(alive.current)setBusy(false);}
    }
    return <><section className="personal-request-form"><div className="personal-request-heading"><h2>{kind==='leave'?'Préparer mon congé / absence':'Préparer ma note de frais'}</h2><span>Pour {profile.full_name || 'mon compte'}</span></div><p>{initial?'Champs préparés par l’assistant : vérifiez les dates et les informations avant l’envoi.':'Vous pouvez remplir ces champs directement ou utiliser l’assistant.'}</p>
        <form onSubmit={submit}><fieldset disabled={busy}>
            {kind==='leave'?<><div className="personal-request-grid"><label>Date de début<input type="date" required value={values.startDate} onChange={e=>change('startDate',e.target.value)}/></label><label>Date de fin<input type="date" required min={values.startDate || undefined} value={values.endDate} onChange={e=>change('endDate',e.target.value)}/></label></div><label>Motif et précisions<textarea required maxLength={500} value={values.reason} onChange={e=>change('reason',e.target.value)} placeholder="Précisez le motif et, si utile, le type d’absence demandé."/></label><p className="personal-request-note">La validation, le type de congé et le décompte des jours restent à vérifier par votre responsable.</p></>:<>
                <div className="personal-request-grid"><label>Date de la dépense<input type="date" required value={values.date} onChange={e=>change('date',e.target.value)}/></label><label>Montant total en euros<input inputMode="decimal" required value={values.amount} onChange={e=>change('amount',e.target.value)} placeholder="18,50"/></label></div><label>Catégorie<select value={values.category} onChange={e=>change('category',e.target.value)}>{Object.entries(REQUEST_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Description<textarea required maxLength={1000} value={values.description} onChange={e=>change('description',e.target.value)}/></label>
                <label>Justificatifs<input key={files.length?'selected':'empty'} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>{const selected=Array.from(e.target.files || []);setFiles(selected);stable.current=null;setConfirmed(false);}}/></label><p className="personal-request-note">3 fichiers maximum, 5 Mo chacun. JPEG, PNG, WebP ou PDF. Vérifiez les exigences de votre entreprise avant l’envoi.</p>{files.map((file,i)=><p key={`${file.name}:${i}`}>{file.name} · {(file.size/1024).toFixed(0)} Ko</p>)}
            </>}
            <label className="personal-request-confirm"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>J’ai vérifié ces informations et je souhaite envoyer cette demande pour mon compte.</span></label><button type="submit">{busy?'Enregistrement…':'Envoyer ma demande'}</button>
        </fieldset></form>{error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}
    </section><section className="personal-request-history"><h2>Suivi de mes demandes</h2><p>Vos 50 demandes les plus récentes pour cette catégorie.</p>{listError && <p role="alert">Le suivi n’a pas pu être chargé : {listError}</p>}{!rows.length && !listError && <p>Aucune demande à afficher.</p>}{rows.map(row=><article key={row.id}><div><strong>{kind==='leave'?`${row.start_date} → ${row.end_date}`:`${row.date} · ${Number(row.amount).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}`}</strong><span>{kind==='expense' && row.is_paid?'Payée':leaveStatusLabel(row.status)}</span></div><p>{kind==='leave'?row.reason:row.description}</p>{(row.rejection_reason || row.admin_comment) && <p>Retour du responsable : {row.rejection_reason || row.admin_comment}</p>}</article>)}<Link to={kind==='leave'?'/leaves':'/expenses'}>Ouvrir l’écran habituel →</Link></section></>;
}
