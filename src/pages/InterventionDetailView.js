// =============================
// FILE: src/pages/InterventionDetailView.js (FULL — extended + activity log)
// =============================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon, CheckCircleIcon, AlertTriangleIcon } from '../components/SharedUI';
import { storageService } from '../lib/supabase';

// Optimized image
const OptimizedImage = ({ src, alt, className, style, onClick }) => {
  const [loadState, setLoadState] = useState('loading');
  const imgRef = useRef(null);
  useEffect(() => {
    if (!src || typeof src !== 'string') { setLoadState('error'); return; }
    const img = new Image();
    img.onload = () => setLoadState('loaded');
    img.onerror = () => setLoadState('error');
    if ('IntersectionObserver' in window && imgRef.current) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { img.src = src; observer.disconnect(); }
      }, { rootMargin: '50px' });
      observer.observe(imgRef.current);
      return () => observer.disconnect();
    } else { img.src = src; }
  }, [src]);
  if (loadState === 'loading') return (<div ref={imgRef} className={className} style={{...style,display:'flex',alignItems:'center',justifyContent:'center',background:'#f3f4f6'}}><LoaderIcon className="animate-spin"/></div>);
  if (loadState === 'error') return (<div className={className} style={{...style,display:'flex',alignItems:'center',justifyContent:'center',background:'#fee2e2',color:'#dc2626'}}><XCircleIcon/></div>);
  return <img ref={imgRef} src={src} alt={alt} className={className} style={{...style,display:'block'}} onClick={onClick} loading="lazy"/>;
};

// Signature Modal
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
  const canvasRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const isMobile = window.innerWidth < 768;
    canvas.width = Math.min(window.innerWidth * 0.9, 600);
    canvas.height = isMobile ? window.innerHeight * 0.5 : 300;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = isMobile ? 3 : 2; ctx.lineCap='round'; ctx.lineJoin='round';
    if (existingSignature) { const img = new Image(); img.onload = () => { ctx.drawImage(img,0,0,canvas.width,canvas.height); setHasDrawn(true); }; img.src = existingSignature; }
    let drawing=false,last=null; const getPos=e=>{const r=canvas.getBoundingClientRect(); const x=(e.touches?e.touches[0].clientX:e.clientX)-r.left; const y=(e.touches?e.touches[0].clientY:e.clientY)-r.top; return {x:x*(canvas.width/r.width), y:y*(canvas.height/r.height)};};
    const start=e=>{e.preventDefault(); drawing=true; setHasDrawn(true); last=getPos(e); ctx.beginPath(); ctx.moveTo(last.x,last.y);};
    const stop=e=>{e.preventDefault(); drawing=false; last=null;};
    const draw=e=>{ if(!drawing) return; e.preventDefault(); const p=getPos(e); if(last){ ctx.lineTo(p.x,p.y); ctx.stroke(); } last=p; };
    canvas.addEventListener('mousedown',start); canvas.addEventListener('mouseup',stop); canvas.addEventListener('mousemove',draw); canvas.addEventListener('mouseleave',stop);
    canvas.addEventListener('touchstart',start,{passive:false}); canvas.addEventListener('touchend',stop,{passive:false}); canvas.addEventListener('touchmove',draw,{passive:false});
    return ()=>{ canvas.removeEventListener('mousedown',start); canvas.removeEventListener('mouseup',stop); canvas.removeEventListener('mousemove',draw); canvas.removeEventListener('mouseleave',stop); canvas.removeEventListener('touchstart',start); canvas.removeEventListener('touchend',stop); canvas.removeEventListener('touchmove',draw); };
  }, [existingSignature]);
  return (
    <div className="modal-overlay"><div className="modal-content signature-modal-content">
      <h3>✍️ Signature du client</h3>
      <canvas ref={canvasRef} className="signature-canvas-fullscreen"/>
      <div className="modal-footer" style={{marginTop:'1rem'}}>
        <button type="button" onClick={()=>{const c=canvasRef.current;if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);}}} className="btn btn-secondary">Effacer</button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
        <button type="button" onClick={()=>onSave(canvasRef.current.toDataURL('image/png'))} className="btn btn-primary" disabled={!hasDrawn}>Valider la signature</button>
      </div>
    </div></div>
  );
};

const CancelReasonModal = ({ onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-overlay"><div className="modal-content">
      <h3>Annuler l'intervention</h3>
      <p className="text-muted">Expliquez brièvement la raison.</p>
      <textarea className="form-control" rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Client absent, accès impossible, pièce manquante…"/>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Retour</button>
        <button type="button" className="btn btn-danger" onClick={()=>onConfirm(reason.trim())} disabled={!reason.trim()}>Confirmer</button>
      </div>
    </div></div>
  );
};

// Inline Uploader (uses storageService)
const InlineUploader = ({ interventionId, onUploadComplete, folder='report' }) => {
  const [state, setState] = useState({ uploading:false, queue:[], error:null });
  const inputRef = useRef(null);
  const compressImage = useCallback(async(file)=>{ if(!file.type.startsWith('image/')) return file; return new Promise(res=>{const c=document.createElement('canvas');const ctx=c.getContext('2d');const img=new Image();img.onload=()=>{let {width,height}=img;const MW=1280,MH=720;if(width>height){if(width>MW){height*=MW/width;width=MW;}}else{if(height>MH){width*=MH/height;height=MH;}}c.width=width;c.height=height;ctx.drawImage(img,0,0,width,height);c.toBlob(b=>res(b?new File([b],file.name,{type:'image/jpeg',lastModified:Date.now()}):file),'image/jpeg',0.8);};img.onerror=()=>res(file);img.src=URL.createObjectURL(file);}); },[]);
  const onChange = useCallback(async(e)=>{
    const files = Array.from(e.target.files||[]); if(inputRef.current) inputRef.current.value=''; if(!files.length) return;
    const queue = files.map((f,i)=>({id:`${f.name}-${Date.now()}-${i}`,name:f.name,status:'pending',progress:0,error:null}));
    setState({uploading:true,queue,error:null});
    const uploaded=[];
    for (let i=0;i<files.length;i++) {
      try{
        const fu = await compressImage(files[i]);
        const result = await storageService.uploadInterventionFile(fu, interventionId, folder, (p)=>{
          setState(s=>({...s,queue:s.queue.map((it,idx)=>idx===i?{...it,status:'uploading',progress:p}:it)}));
        });
        if(result.error) throw result.error;
        const publicUrl = result.publicURL?.publicUrl || result.publicURL; if(typeof publicUrl !== 'string') throw new Error('URL de fichier invalide');
        uploaded.push({ name: files[i].name, url: publicUrl, type: files[i].type });
        setState(s=>({...s,queue:s.queue.map((it,idx)=>idx===i?{...it,status:'completed',progress:100}:it)}));
      }catch(err){
        setState(s=>({...s,queue:s.queue.map((it,idx)=>idx===i?{...it,status:'error',error:String(err.message||err)}:it)}));
      }
    }
    if(uploaded.length){ try{ await onUploadComplete(uploaded);}catch(err){ setState(s=>({...s,error:"La sauvegarde des fichiers a échoué. Rafraîchissez et réessayez."})); } }
    setState(s=>({...s,uploading:false}));
  },[compressImage,interventionId,onUploadComplete]);
  return (
    <div className="mobile-uploader-panel">
      <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" onChange={onChange} disabled={state.uploading} style={{display:'none'}}/>
      <button onClick={()=>inputRef.current?.click()} className={`btn btn-secondary w-full flex-center ${state.uploading?'disabled':''}`} disabled={state.uploading}>
        {state.uploading?'Envoi en cours…':'Choisir des fichiers'}
      </button>
      {state.queue.length>0 && (
        <div className="upload-queue-container">
          {state.queue.map(item=> (
            <div key={item.id} className={`upload-queue-item status-${item.status}`}>
              <div style={{width:24,flexShrink:0}}>
                {item.status==='uploading' && <LoaderIcon className="animate-spin"/>}
                {item.status==='completed' && <CheckCircleIcon style={{color:'#16a34a'}}/>}
                {item.status==='error' && <AlertTriangleIcon style={{color:'#dc2626'}}/>}
              </div>
              <div style={{flexGrow:1,minWidth:0}}>
                <div className="file-name">{item.name}</div>
                {item.status==='uploading' && <div className="upload-progress-bar"><div className="upload-progress-fill" style={{width:`${item.progress}%`}}/></div>}
                {item.error && <div className="error-message">{item.error}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {state.error && <div className="error-message" style={{color:'#dc2626',marginTop:'1rem',textAlign:'center',fontWeight:500}}>{state.error}</div>}
    </div>
  );
};

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, dataVersion, refreshData, onAddBriefingDocuments }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    const found = interventions.find(i => String(i.id) === String(interventionId));
    if (found) {
      setIntervention(found);
      setReport(found.report || { notes:'', files:[], arrivalTime:null, departureTime:null, signature:null, needs:[] });
      setAdminNotes(found.admin_notes || '');
      setLoading(false);
    } else if (interventions.length>0) {
      navigate('/planning');
    }
  }, [interventions, interventionId, navigate, dataVersion]);

  const handleReportChange = (field, value) => setReport(prev=>({...prev,[field]:value}));

  const handleSave = async () => {
    if (!intervention) return; setIsSaving(true);
    try { await onSave(intervention.id, { ...report, admin_notes: adminNotes }); }
    finally { setIsSaving(false); }
  };

  // Activity log helper
  const appendActivity = async (action, meta={}) => {
    const entry = { at:new Date().toISOString(), by:(isAdmin?'admin':'employe'), action, meta };
    const current = Array.isArray(intervention.activity_log) ? [...intervention.activity_log] : [];
    current.push(entry);
    await onSaveSilent(intervention.id, { activity_log: current });
  };

  // Needs
  const [needDraft, setNeedDraft] = useState({ label:'', qty:1, urgent:false, note:'' });
  const addNeed = async () => {
    if (!needDraft.label.trim()) return;
    const newNeeds = [...(report.needs||[]), { ...needDraft, id:`need-${Date.now()}` }];
    const updated = { ...report, needs: newNeeds };
    setReport(updated);
    await onSaveSilent(intervention.id, updated);
    await appendActivity('NEED_ADDED', { label:needDraft.label, qty:needDraft.qty, urgent:needDraft.urgent });
    setNeedDraft({ label:'', qty:1, urgent:false, note:'' });
    refreshData();
  };
  const removeNeed = async (id) => {
    const newNeeds = (report.needs||[]).filter(n=>n.id!==id);
    const updated = { ...report, needs: newNeeds };
    setReport(updated);
    await onSaveSilent(intervention.id, updated);
    await appendActivity('NEED_REMOVED', { id });
    refreshData();
  };

  // Status
  const setStatus = async (status, reason=null) => {
    const payload = { status, cancellation_reason: status==='Annulée' ? (reason||'') : null };
    await onSaveSilent(intervention.id, payload);
    await appendActivity('STATUS_CHANGED', { status, reason: reason||null });
    refreshData();
  };

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'N/A';
  if (loading || !intervention || !report) return <div className="loading-container"><LoaderIcon className="animate-spin"/><p>Chargement…</p></div>;
  const currentStatus = intervention.status || (report.arrivalTime ? 'En cours' : 'À venir');

  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n=>n.urgent).length : 0;

  return (
    <div>
      {showSignatureModal && <SignatureModal onSave={(sig)=>{handleReportChange('signature',sig); setShowSignatureModal(false);}} onCancel={()=>setShowSignatureModal(false)} existingSignature={report.signature}/>}
      {showCancelModal && <CancelReasonModal onCancel={()=>setShowCancelModal(false)} onConfirm={async(reason)=>{ setShowCancelModal(false); await setStatus('Annulée', reason); }}/>}

      <button onClick={()=>navigate('/planning')} className="back-button"><ChevronLeftIcon/> Retour</button>
      <div className="card-white">
        <h2>{intervention.client}</h2>
        <p className="text-muted">{intervention.address}</p>

        <div className="section">
          <h3>⚑ Statut de l'intervention</h3>
          <div className="flex items-center gap-2" style={{flexWrap:'wrap'}}>
            <span className="badge">Statut actuel : {currentStatus}{intervention.cancellation_reason?` — ${intervention.cancellation_reason}`:''}</span>
            {urgentCount>0 && <span className="badge" style={{background:'#f59e0b',color:'#111827'}}>URG {urgentCount}</span>}
            {!isAdmin && (<>
              <button className="btn btn-danger" onClick={()=>setShowCancelModal(true)} disabled={currentStatus==='Annulée'}>Annuler</button>
              <button className="btn btn-secondary" onClick={async()=>{ await setStatus(report.arrivalTime?'En cours':'À venir'); }} disabled={currentStatus!=='Annulée'}>Reprise</button>
            </>)}
          </div>
        </div>

        <div className="section">
          <h3>📋 Documents de préparation</h3>
          {(intervention.intervention_briefing_documents?.length>0) ? (
            <ul className="document-list-optimized" style={{marginBottom:'1rem'}}>
              {intervention.intervention_briefing_documents.map(doc=>{
                const isImage = doc.file_name && /(jpe?g|png|gif|webp)$/i.test(doc.file_name);
                return (
                  <li key={doc.id} className="document-item-optimized">
                    {isImage && doc.file_url
                      ? <OptimizedImage src={doc.file_url} alt={doc.file_name} style={{width:40,height:40,objectFit:'cover',borderRadius:'0.25rem'}}/>
                      : <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>}
                    <span className="file-name">{doc.file_name}</span>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" download={doc.file_name}><DownloadIcon/> Voir</a>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-muted">Aucun document de préparation.</p>}
          {isAdmin && <BriefingUploadBlock interventionId={interventionId} onAddBriefingDocuments={onAddBriefingDocuments} refreshData={refreshData}/>}
        </div>

        <div className="section">
          <h3>⏱️ Pointage</h3>
          <div className="grid-2-cols">
            <button onClick={async()=>{handleReportChange('arrivalTime', new Date().toISOString()); await appendActivity('TIME_ARRIVAL', {});}} className="btn btn-success" disabled={!!report.arrivalTime || isAdmin}>
              {report.arrivalTime?`✅ Arrivé: ${formatTime(report.arrivalTime)}`:'🕐 Arrivée sur site'}
            </button>
            <button onClick={async()=>{handleReportChange('departureTime', new Date().toISOString()); await appendActivity('TIME_DEPARTURE', {});}} className="btn btn-danger" disabled={!report.arrivalTime || !!report.departureTime || isAdmin}>
              {report.departureTime?`✅ Parti: ${formatTime(report.departureTime)}`:'🚪 Départ du site'}
            </button>
          </div>
        </div>

        <div className="section">
          <h3>📝 Rapport de chantier</h3>
          <textarea value={report.notes||''} onChange={e=>handleReportChange('notes', e.target.value)} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={isAdmin}/>
        </div>

        {(isAdmin || adminNotes) && (
          <div className="section">
            <h3>🔒 Notes de l'administration</h3>
            <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} placeholder={isAdmin?"Ajouter des notes...":"Aucune note de l'administration."} rows="4" className="form-control" readOnly={!isAdmin}/>
          </div>
        )}

        {/* Needs */}
        <div className="section">
          <h3>🧰 Besoins chantier</h3>
          {(!report.needs || report.needs.length===0) && <p className="text-muted">Aucun besoin pour le moment.</p>}
          {Array.isArray(report.needs) && report.needs.length>0 && (
            <ul className="document-list">
              {report.needs.map(n=> (
                <li key={n.id}>
                  <div style={{flexGrow:1}}>
                    <p className="font-semibold">{n.label}{n.qty?` × ${n.qty}`:''} {n.urgent?<span className="badge" style={{marginLeft:8}}>Urgent</span>:null}</p>
                    {n.note && <p className="text-muted" style={{fontSize:'0.875rem'}}>{n.note}</p>}
                  </div>
                  {!isAdmin && <button className="btn-icon-danger" onClick={()=>removeNeed(n.id)} title="Supprimer">✖</button>}
                </li>
              ))}
            </ul>
          )}
          {!isAdmin && (
            <div className="grid" style={{gridTemplateColumns:'180px 100px 120px 1fr auto', gap:'0.5rem', alignItems:'end'}}>
              <div><label>Intitulé</label><input className="form-control" value={needDraft.label} onChange={e=>setNeedDraft(v=>({...v,label:e.target.value}))} placeholder="Ex: Tuyau 16mm"/></div>
              <div><label>Qté</label><input type="number" min={1} className="form-control" value={needDraft.qty} onChange={e=>setNeedDraft(v=>({...v,qty:Math.max(1,Number(e.target.value)||1)}))}/></div>
              <div><label>Urgent ?</label><select className="form-control" value={needDraft.urgent?'1':'0'} onChange={e=>setNeedDraft(v=>({...v,urgent:e.target.value==='1'}))}><option value="0">Non</option><option value="1">Oui</option></select></div>
              <div><label>Note</label><input className="form-control" value={needDraft.note} onChange={e=>setNeedDraft(v=>({...v,note:e.target.value}))} placeholder="Détail, lien, référence…"/></div>
              <div><button className="btn btn-primary" onClick={addNeed} disabled={!needDraft.label.trim()}>Ajouter</button></div>
            </div>
          )}
        </div>

        <div className="section">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h3>📷 Photos et Documents</h3>
            <button onClick={refreshData} className="btn-icon" title="Rafraîchir"><RefreshCwIcon/></button>
          </div>
          {report.files?.length>0 ? (
            <ul className="document-list-optimized" style={{marginBottom:'1rem'}}>
              {report.files.map((file,idx)=> (
                <li key={`${file.url||idx}-${idx}`} className="document-item-optimized">
                  {file.type?.startsWith('image/') ? <OptimizedImage src={file.url} alt={file.name} style={{width:40,height:40,objectFit:'cover',borderRadius:'0.25rem'}}/> : (
                    <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>
                  )}
                  <span className="file-name">{file.name}</span>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" download={file.name}><DownloadIcon/></a>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">Aucun fichier pour le moment.</p>}
          {!isAdmin && (<>
            <button onClick={()=>setShowUploader(!showUploader)} className={`btn w-full ${showUploader?'btn-secondary':'btn-primary'}`}>{showUploader?'Fermer':'📷 Ajouter photos/documents'}</button>
            {showUploader && <InlineUploader interventionId={interventionId} onUploadComplete={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]),...uploaded]}; setReport(updated); await onSaveSilent(intervention.id, updated); await appendActivity('FILE_UPLOADED', {count:uploaded.length}); refreshData(); }}/>}
          </>)}
        </div>

        <div className="section">
          <h3>✍️ Signature du client</h3>
          {report.signature ? (
            <div>
              <img src={report.signature} alt="Signature" style={{width:'100%',maxWidth:300,border:'2px solid #e5e7eb',borderRadius:'0.5rem',background:'#f8f9fa'}}/>
              {!isAdmin && <button onClick={()=>handleReportChange('signature',null)} className="btn btn-sm btn-secondary" style={{marginTop:8}}>Effacer</button>}
            </div>
          ) : (
            <div>
              <canvas width="300" height="150" style={{border:'2px dashed #cbd5e1',borderRadius:'0.5rem',width:'100%',maxWidth:300,background:'#f8fafc',cursor:isAdmin?'not-allowed':'crosshair'}}/>
              {!isAdmin && <div style={{marginTop:8}}><button onClick={()=>setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon/> Agrandir</button></div>}
            </div>
          )}
        </div>

        {/* Activity Log */}
        {Array.isArray(intervention.activity_log) && intervention.activity_log.length>0 && (
          <div className="section">
            <h3>🗒️ Journal d’activités</h3>
            <ul className="document-list">
              {[...intervention.activity_log].reverse().slice(0,100).map((e,i)=> (
                <li key={i}>
                  <div style={{flexGrow:1}}>
                    <p className="font-semibold">{e.action}</p>
                    <p className="text-muted" style={{fontSize:'0.875rem'}}>{new Date(e.at).toLocaleString('fr-FR')} — {e.by}</p>
                  </div>
                  {e.meta && <code style={{fontSize:'0.75rem',background:'#f3f4f6',padding:'4px 6px',borderRadius:6}}>{JSON.stringify(e.meta)}</code>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{fontSize:'1rem',padding:'1rem',fontWeight:600}}>{isSaving ? (<><LoaderIcon className="animate-spin"/> Sauvegarde...</>) : '🔒 Sauvegarder et Clôturer'}</button>
      </div>
    </div>
  );
}

const BriefingUploadBlock = ({ interventionId, onAddBriefingDocuments, refreshData }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={()=>setOpen(!open)} className={`btn w-full ${open?'btn-secondary':'btn-primary'}`}>{open?'Fermer':'➕ Ajouter des documents'}</button>
      {open && (
        <InlineUploader interventionId={interventionId} onUploadComplete={async(files)=>{ await onAddBriefingDocuments(interventionId, files); refreshData(); setOpen(false); }} folder="briefing"/>
      )}
    </>
  );
};

// =============================
// FILE: src/pages/AdminPlanningView.js (FULL — visual grid with badges)
// =============================
import React, { useMemo } from 'react';

export default function AdminPlanningView({ interventions = [], users = [], showToast }) {
  const days = useMemo(() => Array.from(new Set((interventions||[]).map(i=>i.date))).sort(), [interventions]);
  const userList = users || [];
  const urgentCount = (itv) => Array.isArray(itv?.report?.needs) ? itv.report.needs.filter(n => n.urgent).length : 0;
  const statusColor = (s) => s==='Annulée' ? '#fecaca' : s==='En cours' ? '#bfdbfe' : '#e5e7eb';
  const formatDay = (iso) => new Date(iso).toLocaleDateString('fr-FR', { weekday:'short', day:'2-digit', month:'2-digit' });

  const grid = useMemo(()=>{
    const g={};
    for (const d of days){ g[d]={}; for(const u of userList) g[d][u.id]=[]; g[d].unassigned=[]; }
    for (const itv of (interventions||[])){
      const d=itv.date; if(!g[d]){ g[d]={}; for(const u of userList) g[d][u.id]=[]; g[d].unassigned=[]; }
      const assignees = Array.isArray(itv.assigned_user_ids) && itv.assigned_user_ids.length ? itv.assigned_user_ids : [null];
      for (const uid of assignees){ if(uid===null) g[d].unassigned.push(itv); else (g[d][uid]=g[d][uid]||[]).push(itv); }
    }
    return g;
  },[days, userList, interventions]);

  return (
    <div>
      <h2 className="view-title">Planning</h2>
      <div className="card-white" style={{overflowX:'auto'}}>
        <table className="planning-grid">
          <thead>
            <tr>
              <th style={{minWidth:140}}>Jour</th>
              {userList.map(u=> <th key={u.id} style={{minWidth:220}}>{u.full_name}</th> )}
              <th style={{minWidth:220}}>Non assigné</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d=> (
              <tr key={d}>
                <td className="day-cell">{formatDay(d)}</td>
                {userList.map(u=> (
                  <td key={u.id}>
                    <div className="slot-col">
                      {(grid[d][u.id]||[]).map(itv=> (
                        <div key={itv.id} className="itv-card" style={{backgroundColor:statusColor(itv.status)}}>
                          <div className="itv-title">{itv.client}</div>
                          <div className="itv-sub">{itv.service}</div>
                          <div className="itv-meta">
                            {itv.time_start ? `${itv.time_start}–${itv.time_end||''}` : '—'}
                            {urgentCount(itv)>0 && <span className="badge">URG {urgentCount(itv)}</span>}
                            {itv.status==='Annulée' && <span className="badge" style={{background:'#ef4444',color:'#fff'}}>Annulée</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
                <td>
                  <div className="slot-col">
                    {(grid[d].unassigned||[]).map(itv=> (
                      <div key={itv.id} className="itv-card" style={{backgroundColor:statusColor(itv.status)}}>
                        <div className="itv-title">{itv.client}</div>
                        <div className="itv-sub">{itv.service}</div>
                        <div className="itv-meta">
                          {itv.time_start ? `${itv.time_start}–${itv.time_end||''}` : '—'}
                          {urgentCount(itv)>0 && <span className="badge">URG {urgentCount(itv)}</span>}
                          {itv.status==='Annulée' && <span className="badge" style={{background:'#ef4444',color:'#fff'}}>Annulée</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .planning-grid { width:100%; border-collapse:separate; border-spacing:0; }
        .planning-grid th, .planning-grid td { padding:8px; border-bottom:1px solid #eee; vertical-align:top; }
        .day-cell { font-weight:600; white-space:nowrap; }
        .slot-col { display:flex; flex-direction:column; gap:8px; }
        .itv-card { border:1px solid #e5e7eb; border-radius:10px; padding:8px; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
        .itv-title { font-weight:600; font-size:14px; }
        .itv-sub { color:#6b7280; font-size:12px; }
        .itv-meta { display:flex; gap:8px; align-items:center; margin-top:4px; font-size:12px; color:#374151; }
        .badge { background:#f59e0b; color:#111827; border-radius:999px; padding:2px 6px; font-weight:700; font-size:11px; }
      `}</style>
    </div>
  );
}

// =============================
// FILE: src/pages/AgendaView.js (FULL — adds URG badge)
// =============================
import React, { useMemo } from 'react';

export default function AgendaView({ interventions = [], date, onSelect }) {
  const items = useMemo(() => (interventions||[]).filter(i=>i.date===date), [interventions, date]);
  const urgentCount = (itv) => Array.isArray(itv?.report?.needs) ? itv.report.needs.filter(n => n.urgent).length : 0;
  return (
    <div>
      <h2 className="view-title">Agenda — {new Date(date).toLocaleDateString('fr-FR')}</h2>
      <div className="card-white">
        <ul className="document-list">
          {items.length? items.map(itv=> (
            <li key={itv.id} onClick={()=>onSelect?.(itv)} style={{cursor:onSelect?'pointer':'default'}}>
              <div>
                <p className="font-semibold">{itv.client} — {itv.service} {urgentCount(itv)>0 && <span className="badge" style={{marginLeft:8}}>URG {urgentCount(itv)}</span>}</p>
                <p className="text-muted">{itv.time_start?`${itv.time_start}–${itv.time_end||''}`:'—'} • {itv.address||''}</p>
              </div>
            </li>
          )) : <p>Aucune intervention.</p>}
        </ul>
      </div>
      <style>{`.badge{background:#f59e0b;color:#111827;border-radius:999px;padding:2px 6px;font-weight:700;font-size:11px}`}</style>
    </div>
  );
}
