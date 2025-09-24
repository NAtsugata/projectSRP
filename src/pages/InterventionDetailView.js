// =============================
// FILE: src/pages/InterventionDetailView.js — FULL (Expérience Technicien + validations technicien)
// =============================
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeftIcon,
  DownloadIcon,
  FileTextIcon,
  LoaderIcon,
  ExpandIcon,
  RefreshCwIcon,
  XCircleIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  MicIcon,
  StopCircleIcon,
  CheckCircle2Icon,
  PaperPlaneIcon,
  CameraIcon,
} from '../components/SharedUI';
import { storageService } from '../lib/supabase';

const MIN_REQUIRED_PHOTOS = 2;
const MEDIA_TAGS = ['Avant', 'En cours', 'Après', 'Anomalies', 'Documents'];

const isImageUrl = (f) => {
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u);
};
const numberOrNull = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

const OptimizedImage = ({ src, alt, className, style }) => {
  const [loadState, setLoadState] = useState('loading');
  const imgRef = useRef(null);
  useEffect(() => {
    if (!src || typeof src !== 'string') { setLoadState('error'); return; }
    const img = new Image();
    img.onload = () => setLoadState('loaded');
    img.onerror = () => setLoadState('error');
    if ('IntersectionObserver' in window && imgRef.current) {
      const obs = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { img.src = src; obs.disconnect(); } }, { rootMargin: '50px' });
      obs.observe(imgRef.current);
      return () => obs.disconnect();
    } else { img.src = src; }
  }, [src]);
  if (loadState === 'loading') return (<div ref={imgRef} className={className} style={{...style,display:'flex',alignItems:'center',justifyContent:'center',background:'#f3f4f6'}}><LoaderIcon className="animate-spin"/></div>);
  if (loadState === 'error') return (<div className={className} style={{...style,display:'flex',alignItems:'center',justifyContent:'center',background:'#fee2e2',color:'#dc2626'}}><XCircleIcon/></div>);
  return <img ref={imgRef} src={src} alt={alt} className={className} style={{...style,display:'block'}} loading="lazy"/>;
};

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
    let drawing=false,last=null;
    const getPos = (e) => { const r=canvas.getBoundingClientRect(); const ex=e.touches?e.touches[0].clientX:e.clientX; const ey=e.touches?e.touches[0].clientY:e.clientY; return { x:(ex-r.left)*(canvas.width/r.width), y:(ey-r.top)*(canvas.height/r.height) }; };
    const start = (e)=>{ e.preventDefault(); drawing=true; setHasDrawn(true); last=getPos(e); ctx.beginPath(); ctx.moveTo(last.x,last.y); };
    const stop  = (e)=>{ e.preventDefault(); drawing=false; last=null; };
    const draw  = (e)=>{ if(!drawing) return; e.preventDefault(); const p=getPos(e); if(last){ ctx.lineTo(p.x,p.y); ctx.stroke(); } last=p; };
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
        <button type="button" onClick={()=>onSave(canvasRef.current.toDataURL('image/png'))} className="btn btn-primary" disabled={!hasDrawn}>Valider</button>
      </div>
    </div></div>
  );
};

const InlineUploader = ({ interventionId, onUploadComplete, folder='report', accept='image/*,application/pdf,audio/webm' }) => {
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
      }catch(err){ setState(s=>({...s,queue:s.queue.map((it,idx)=>idx===i?{...it,status:'error',error:String(err.message||err)}:it)})); }
    }
    if(uploaded.length){ try{ await onUploadComplete(uploaded);}catch(err){ setState(s=>({...s,error:"La sauvegarde des fichiers a échoué."})); } }
    setState(s=>({...s,uploading:false}));
  },[compressImage,interventionId,onUploadComplete]);
  return (
    <div className="mobile-uploader-panel">
      <input ref={inputRef} type="file" multiple accept={accept} onChange={onChange} disabled={state.uploading} style={{display:'none'}}/>
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
    </div>
  );
};

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, onUpdateStatus, isAdmin, dataVersion, refreshData }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeMediaTag, setActiveMediaTag] = useState('Avant');
  const [cancelModal, setCancelModal] = useState({ open: false, reason: '', initials: '', agree: false });
  const [startModal, setStartModal] = useState({ open: false, initials: '', agree: false });
  const [resumeModal, setResumeModal] = useState({ open: false, initials: '', agree: false });
  const [closeModal, setCloseModal] = useState({ open: false, initials: '', agree: false });

  // ---- Helpers schéma ----
  const ensureReportSchema = useCallback((base)=>{
    const r = base || {};
    return {
      notes: r.notes || '',
      files: Array.isArray(r.files) ? r.files.map(f=>({ ...f, tag: f.tag || 'Documents' })) : [],
      arrivalTime: r.arrivalTime || null,
      departureTime: r.departureTime || null,
      arrivalGeo: r.arrivalGeo || null,
      departureGeo: r.departureGeo || null,
      signature: r.signature || null,
      needs: Array.isArray(r.needs) ? r.needs.map(n=>({
        id: n.id || `need-${Math.random().toString(36).slice(2)}`,
        label: n.label || '',
        qty: Number(n.qty)||1,
        urgent: !!n.urgent,
        note: n.note || '',
        category: n.category || 'materiel',
        estimated_price: numberOrNull(n.estimated_price),
        request_id: n.request_id || null,
      })) : [],
      supply_requests: Array.isArray(r.supply_requests) ? r.supply_requests : [],
      quick_checkpoints: Array.isArray(r.quick_checkpoints) ? r.quick_checkpoints : [
        { label:'Zone sécurisée', done:false, at:null },
        { label:'Essais OK', done:false, at:null },
        { label:'Brief client fait', done:false, at:null },
      ],
      blocks: r.blocks || {
        access:{ blocked:false, note:'', photos:[] },
        power:{ blocked:false, note:'', photos:[] },
        parts:{ blocked:false, note:'', photos:[] },
        authorization:{ blocked:false, note:'', photos:[] },
      },
      parts_used: Array.isArray(r.parts_used) ? r.parts_used.map(p=>({
        ref: p.ref || '', label: p.label || '', qty: Number(p.qty)||1, serial: p.serial || '', unit_price: numberOrNull(p.unit_price)
      })) : [],
      rating: r.rating ?? null,
      follow_up_required: !!r.follow_up_required,
      cancel_reason: r.cancel_reason || '',
      tech_validations: r.tech_validations || {},
    };
  },[]);

  useEffect(() => {
    const found = interventions.find(i => String(i.id) === String(interventionId));
    if (found) {
      setIntervention(found);
      setReport(ensureReportSchema(found.report));
      setLoading(false);
    } else if (interventions.length>0) {
      navigate('/planning');
    }
  }, [interventions, interventionId, navigate, dataVersion, ensureReportSchema]);

  const persistReport = async (updated) => {
    setReport(updated);
    try { await onSaveSilent(intervention.id, updated); } catch (e) { console.error(e); }
  };

  const currentStatus = intervention?.status || (report?.arrivalTime ? 'En cours' : 'Planifiée');

  // ---- Quick actions (avec validations tech) ----
  const openStartValidation = () => setStartModal({ open: true, initials: '', agree: false });
  const confirmStart = async () => {
    if (!startModal.initials.trim() || !startModal.agree) return;
    const now = new Date().toISOString();
    let arrivalGeo = null;
    try {
      if (navigator.geolocation) {
        arrivalGeo = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
    } catch {}
    const tv = { ...(report.tech_validations||{}), start: { initials: startModal.initials.trim(), at: now } };
    await persistReport({ ...report, arrivalTime: now, arrivalGeo, tech_validations: tv });
    await onUpdateStatus(intervention.id, 'En cours');
    setStartModal({ open:false, initials:'', agree:false });
  };

  const openCancel = () => setCancelModal({ open: true, reason: '', initials: '', agree: false });
  const confirmCancel = async () => {
    const reason = cancelModal.reason?.trim();
    if (!reason || !cancelModal.initials.trim() || !cancelModal.agree) return; // champs obligatoires
    const now = new Date().toISOString();
    const tv = { ...(report.tech_validations||{}), cancel: { initials: cancelModal.initials.trim(), at: now, reason } };
    await persistReport({ ...report, cancel_reason: reason, tech_validations: tv });
    await onUpdateStatus(intervention.id, 'Annulée', { cancel_reason: reason });
    setCancelModal({ open: false, reason: '', initials:'', agree:false });
  };

  const openResumeValidation = () => setResumeModal({ open: true, initials: '', agree: false });
  const confirmResume = async () => {
    if (!resumeModal.initials.trim() || !resumeModal.agree) return;
    const now = new Date().toISOString();
    const tv = { ...(report.tech_validations||{}), resume: { initials: resumeModal.initials.trim(), at: now } };
    await persistReport({ ...report, tech_validations: tv });
    await onUpdateStatus(intervention.id, 'En cours');
    setResumeModal({ open:false, initials:'', agree:false });
  };

  const openCloseValidation = () => setCloseModal({ open: true, initials: '', agree: false });
  const confirmClose = async () => {
    if (!closeModal.initials.trim() || !closeModal.agree) return;
    const v = validateCanClose(); if (!v.ok) { alert(v.msg); return; }
    const now = new Date().toISOString();
    const tv = { ...(report.tech_validations||{}), close: { initials: closeModal.initials.trim(), at: now } };
    const updated = { ...report, departureTime: now, tech_validations: tv };
    setCloseModal({ open:false, initials:'', agree:false });
    setIsSaving(true);
    try { await onSave(intervention.id, updated); } finally { setIsSaving(false); }
  };

  // ---- Checkpoints ----
  const toggleCheckpoint = async (idx) => {
    const cps = [...report.quick_checkpoints];
    const cur = cps[idx];
    const done = !cur.done;
    cps[idx] = { ...cur, done, at: done ? new Date().toISOString() : null };
    await persistReport({ ...report, quick_checkpoints: cps });
  };

  // ---- Needs ----
  const [needDraft, setNeedDraft] = useState({ label:'', qty:1, urgent:false, note:'', category:'materiel', estimated_price:'' });
  const needsTotal = useMemo(() => (Array.isArray(report?.needs)? report.needs.reduce((sum,n)=> sum + (Number(n.estimated_price)||0), 0) : 0), [report?.needs]);
  const addNeed = async () => {
    if (!needDraft.label.trim()) return;
    const item = { ...needDraft, id:`need-${Date.now()}`, qty: Math.max(1, Number(needDraft.qty)||1), estimated_price: numberOrNull(needDraft.estimated_price), request_id:null };
    const updated = { ...report, needs: [...(report.needs||[]), item] };
    await persistReport(updated);
    setNeedDraft({ label:'', qty:1, urgent:false, note:'', category:'materiel', estimated_price:'' });
  };
  const removeNeed = async (id) => {
    const updated = { ...report, needs: (report.needs||[]).filter(n=>n.id!==id) };
    await persistReport(updated);
  };

  // ---- Parts used ----
  const [partDraft, setPartDraft] = useState({ ref:'', label:'', qty:1, serial:'', unit_price:'' });
  const partsTotal = useMemo(() => (Array.isArray(report?.parts_used)? report.parts_used.reduce((s,p)=> s + (Number(p.unit_price)||0) * (Number(p.qty)||1), 0) : 0), [report?.parts_used]);
  const addPart = async () => {
    if (!partDraft.ref && !partDraft.label) return;
    const item = { ref: partDraft.ref.trim(), label: partDraft.label.trim(), qty: Math.max(1, Number(partDraft.qty)||1), serial: partDraft.serial.trim(), unit_price: numberOrNull(partDraft.unit_price) };
    const updated = { ...report, parts_used: [...(report.parts_used||[]), item] };
    await persistReport(updated);
    setPartDraft({ ref:'', label:'', qty:1, serial:'', unit_price:'' });
  };
  const removePart = async (idx) => {
    const arr = [...(report.parts_used||[])]; arr.splice(idx,1);
    await persistReport({ ...report, parts_used: arr });
  };

  // ---- Blocks ----
  const blockKeys = [
    { key:'access', label:'Accès' },
    { key:'power', label:'Alimentation' },
    { key:'parts', label:'Pièces' },
    { key:'authorization', label:'Autorisation' },
  ];
  const setBlockField = async (key, field, value) => {
    const blocks = { ...report.blocks, [key]: { ...report.blocks[key], [field]: value } };
    await persistReport({ ...report, blocks });
  };

  // ---- Media tagging & display ----
  const filteredFiles = useMemo(() => (report?.files||[]).filter(f => (activeMediaTag ? (f.tag||'Documents') === activeMediaTag : true)), [report?.files, activeMediaTag]);
  const moveFileTag = async (idx, newTag) => {
    const files = [...(report.files||[])];
    files[idx] = { ...files[idx], tag: newTag };
    await persistReport({ ...report, files });
  };

  // ---- Sauvegarde & validation ----
  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsOK = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.every(c=>!!c.done) : true;
    if (!report.signature) return { ok:false, msg:'Signature client manquante.' };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok:false, msg:`Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s).` };
    if (!checkpointsOK) return { ok:false, msg:'Tous les checkpoints rapides doivent être validés.' };
    const anyBlocked = blockKeys.some(({key}) => report.blocks?.[key]?.blocked);
    if (anyBlocked) return { ok:false, msg:'Impossible de clôturer: un blocage est actif.' };
    return { ok:true };
  };

  if (loading || !intervention || !report) return <div className="loading-container"><LoaderIcon className="animate-spin"/><p>Chargement…</p></div>;

  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n=>n.urgent).length : 0;

  return (
    <div className="intervention-detail">
      {/* ====== Barre d'actions rapides ====== */}
      <div className="quick-action-bar">
        <button className="qa-btn" onClick={openStartValidation} disabled={!!report.arrivalTime}><CheckCircle2Icon/> {report.arrivalTime ? 'Arrivée enregistrée' : 'Arrivé'}</button>
        <button className="qa-btn" onClick={()=>setActiveMediaTag('En cours')}><CameraIcon/> Photo</button>
        <button className="qa-btn" onClick={()=>document.getElementById('need-input')?.focus()}>➕ Besoin</button>
        <button className="qa-btn" onClick={()=>document.getElementById('part-ref')?.focus()}>🔧 Pièce</button>
        <button className="qa-btn" onClick={()=>setActiveMediaTag('Anomalies')}>⚠️ Blocage</button>
        {currentStatus !== 'Annulée' ? (
          <button className="qa-btn danger" onClick={openCancel}><XCircleIcon/> Annuler</button>
        ) : (
          <button className="qa-btn" onClick={openResumeValidation}><RefreshCwIcon/> Reprise</button>
        )}
        <button className="qa-btn primary" onClick={openCloseValidation} disabled={isSaving}><PaperPlaneIcon/> Clôturer</button>
      </div>

      <button onClick={()=>navigate('/planning')} className="back-button"><ChevronLeftIcon/> Retour</button>

      <div className="card-white">
        <div className="header-row">
          <div>
            <h2>{intervention.client}</h2>
            <p className="text-muted">{intervention.address}</p>
          </div>
          <div className="status-badges">
            <span className="badge">Statut : {currentStatus}</span>
            {urgentCount>0 && <span className="badge" style={{background:'#f59e0b',color:'#111827'}}>URG {urgentCount}</span>}
          </div>
        </div>

        {/* ====== Notes & note vocale ====== */}
        <div className="section">
          <h3>📝 Notes</h3>
          <textarea value={report.notes||''} onChange={(e)=>persistReport({ ...report, notes: e.target.value })} placeholder="Détails, observations, travaux effectués…" rows={5} className="form-control"/>
          <div style={{marginTop:8}}>
            <VoiceNoteRecorder interventionId={interventionId} onUploaded={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]), ...uploaded.map(u=>({...u, tag:'Documents'}))]}; await persistReport(updated); }}/>
          </div>
        </div>

        {/* ====== Checkpoints rapides ====== */}
        <div className="section">
          <h3>✅ Checkpoints rapides</h3>
          <ul className="checkpoints-list">
            {report.quick_checkpoints.map((c,idx)=> (
              <li key={idx}>
                <label className="checkbox">
                  <input type="checkbox" checked={!!c.done} onChange={()=>toggleCheckpoint(idx)} />
                  <span>{c.label}</span>
                </label>
                <small className="text-muted">{c.at ? new Date(c.at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '-'}</small>
              </li>
            ))}
          </ul>
        </div>

        {/* ====== Besoins chantier ====== */}
        <div className="section">
          <div className="section-header">
            <h3>🧰 Besoins chantier</h3>
            <div className="text-muted">Budget estimé: <b>{needsTotal.toFixed(2)} €</b></div>
          </div>
          {(!report.needs || report.needs.length===0) && <p className="text-muted">Aucun besoin pour le moment.</p>}
          {Array.isArray(report.needs) && report.needs.length>0 && (
            <ul className="document-list">
              {report.needs.map(n=> (
                <li key={n.id}>
                  <div style={{flexGrow:1}}>
                    <p className="font-semibold">[{n.category||'—'}] {n.label}{n.qty?` × ${n.qty}`:''} {n.urgent?<span className="badge" style={{marginLeft:8}}>Urgent</span>:null}</p>
                    <p className="text-muted" style={{fontSize:'0.875rem'}}>
                      {n.note || '—'} {typeof n.estimated_price==='number' ? ` • Estimé: ${n.estimated_price.toFixed(2)} €` : ''}
                    </p>
                  </div>
                  <button className="btn-icon-danger" onClick={()=>removeNeed(n.id)} title="Supprimer">✖</button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid" style={{gridTemplateColumns:'160px 80px 120px 1fr 140px auto', gap:'0.5rem', alignItems:'end'}}>
            <div><label>Catégorie</label>
              <select className="form-control" value={needDraft.category} onChange={e=>setNeedDraft(v=>({...v,category:e.target.value}))}>
                <option value="materiel">Matériel</option>
                <option value="consommables">Consommables</option>
                <option value="location">Location</option>
                <option value="commande">Commande</option>
              </select>
            </div>
            <div><label>Qté</label><input type="number" min={1} className="form-control" value={needDraft.qty} onChange={e=>setNeedDraft(v=>({...v,qty:Math.max(1,Number(e.target.value)||1)}))}/></div>
            <div><label>Urgent ?</label><select className="form-control" value={needDraft.urgent?'1':'0'} onChange={e=>setNeedDraft(v=>({...v,urgent:e.target.value==='1'}))}><option value="0">Non</option><option value="1">Oui</option></select></div>
            <div style={{gridColumn:'1 / -1'}}>
              <label>Intitulé</label>
              <input id="need-input" className="form-control" value={needDraft.label} onChange={e=>setNeedDraft(v=>({...v,label:e.target.value}))} placeholder="Ex: Tuyau 16mm"/>
            </div>
            <div><label>Prix estimé (€)</label><input className="form-control" value={needDraft.estimated_price} onChange={e=>setNeedDraft(v=>({...v,estimated_price:e.target.value}))} placeholder="ex: 25.90"/></div>
            <div><label>Note</label><input className="form-control" value={needDraft.note} onChange={e=>setNeedDraft(v=>({...v,note:e.target.value}))} placeholder="Détail, lien, réf…"/></div>
            <div style={{gridColumn:'1 / -1'}}><button className="btn btn-primary" onClick={addNeed} disabled={!needDraft.label.trim()}>Ajouter</button></div>
          </div>
        </div>

        {/* ====== Pièces utilisées ====== */}
        <div className="section">
          <div className="section-header"><h3>🔩 Pièces utilisées</h3><div className="text-muted">Total: <b>{partsTotal.toFixed(2)} €</b></div></div>
          {(!report.parts_used || report.parts_used.length===0) && <p className="text-muted">Aucune pièce renseignée.</p>}
          {Array.isArray(report.parts_used) && report.parts_used.length>0 && (
            <div className="table-like">
              <div className="trow thead"><div>Réf</div><div>Désignation</div><div>Qté</div><div>N° série</div><div>Prix unitaire (€)</div><div></div></div>
              {report.parts_used.map((p,idx)=> (
                <div className="trow" key={`${p.ref}-${idx}`}>
                  <div>{p.ref||'—'}</div>
                  <div>{p.label||'—'}</div>
                  <div>{p.qty||1}</div>
                  <div>{p.serial||'—'}</div>
                  <div>{typeof p.unit_price==='number'?p.unit_price.toFixed(2):'—'}</div>
                  <div><button className="btn-icon-danger" onClick={()=>removePart(idx)} title="Supprimer">✖</button></div>
                </div>
              ))}
            </div>
          )}
          <div className="grid" style={{gridTemplateColumns:'140px 1fr 80px 160px 160px auto', gap:'0.5rem', alignItems:'end'}}>
            <div><label>Référence</label><input id="part-ref" className="form-control" value={partDraft.ref} onChange={e=>setPartDraft(v=>({...v,ref:e.target.value}))} placeholder="REF-1234"/></div>
            <div><label>Désignation</label><input className="form-control" value={partDraft.label} onChange={e=>setPartDraft(v=>({...v,label:e.target.value}))} placeholder="Ex: Pompe 40W"/></div>
            <div><label>Qté</label><input type="number" min={1} className="form-control" value={partDraft.qty} onChange={e=>setPartDraft(v=>({...v,qty:Math.max(1,Number(e.target.value)||1)}))}/></div>
            <div><label>N° série (opt)</label><input className="form-control" value={partDraft.serial} onChange={e=>setPartDraft(v=>({...v,serial:e.target.value}))} placeholder="SN-..."/></div>
            <div><label>Prix unitaire (€)</label><input className="form-control" value={partDraft.unit_price} onChange={e=>setPartDraft(v=>({...v,unit_price:e.target.value}))} placeholder="ex: 12.90"/></div>
            <div><button className="btn btn-secondary" onClick={addPart} disabled={(!partDraft.ref && !partDraft.label)}>Ajouter</button></div>
          </div>
        </div>

        {/* ====== Blocages ====== */}
        <div className="section">
          <h3>🚧 Blocages</h3>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
            {blockKeys.map(({key,label})=> (
              <div key={key} className="card-sub">
                <label className="checkbox"><input type="checkbox" checked={!!report.blocks?.[key]?.blocked} onChange={(e)=>setBlockField(key,'blocked', e.target.checked)} /> <b>{label}</b></label>
                <textarea className="form-control" rows={2} placeholder={`Note ${label.toLowerCase()}…`} value={report.blocks?.[key]?.note||''} onChange={(e)=>setBlockField(key,'note', e.target.value)} />
                <div className="mt-2">
                  <InlineUploader interventionId={interventionId} folder={`blocks_${key}`} accept="image/*" onUploadComplete={async(uploaded)=>{
                    const photos = [...(report.blocks?.[key]?.photos||[]), ...uploaded];
                    await setBlockField(key,'photos', photos);
                  }}/>
                </div>
                {Array.isArray(report.blocks?.[key]?.photos) && report.blocks[key].photos.length>0 && (
                  <div className="thumbs">
                    {report.blocks[key].photos.map((ph,idx)=> (
                      <OptimizedImage key={idx} src={ph.url} alt={ph.name} className="thumb" style={{width:64,height:64,objectFit:'cover',borderRadius:6}}/>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ====== Médias (albums) ====== */}
        <div className="section">
          <div className="section-header"><h3>📷 Médias</h3>
            <div className="tabs">
              {MEDIA_TAGS.map(tag => (
                <button key={tag} className={`tab ${activeMediaTag===tag?'active':''}`} onClick={()=>setActiveMediaTag(tag)}>{tag}</button>
              ))}
            </div>
          </div>
          {filteredFiles.length>0 ? (
            <ul className="document-list-optimized" style={{marginBottom:'1rem'}}>
              {filteredFiles.map((file,idx)=> {
                const originalIdx = (report.files||[]).findIndex(f => f.url===file.url && f.name===file.name);
                return (
                  <li key={`${file.url||idx}-${idx}`} className="document-item-optimized">
                    {file.type?.startsWith('image/') ? <OptimizedImage src={file.url} alt={file.name} style={{width:40,height:40,objectFit:'cover',borderRadius:'0.25rem'}}/>
                    : file.type?.startsWith('audio/') ? <div style={{width:40}}><audio controls src={file.url} style={{height:32}}/></div>
                    : <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>}
                    <span className="file-name">{file.name}</span>
                    <select className="form-control" value={file.tag||'Documents'} onChange={(e)=>moveFileTag(originalIdx, e.target.value)}>
                      {MEDIA_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                      {!MEDIA_TAGS.includes('Documents') && <option value="Documents">Documents</option>}
                    </select>
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" download={file.name}><DownloadIcon/></a>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-muted">Aucun média dans "{activeMediaTag}".</p>}
          <InlineUploader interventionId={interventionId} onUploadComplete={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]), ...uploaded.map(u=>({...u, tag: activeMediaTag}))]}; await persistReport(updated); }}/>
        </div>

        {/* ====== Signature & Clôture ====== */}
        <div className="section">
          <h3>✍️ Signature du client</h3>
          {report.signature ? (
            <div>
              <img src={report.signature} alt="Signature" style={{width:'100%',maxWidth:300,border:'2px solid #e5e7eb',borderRadius:'0.5rem',background:'#f8f9fa'}}/>
              <button onClick={()=>persistReport({ ...report, signature: null })} className="btn btn-sm btn-secondary" style={{marginTop:8}}>Effacer</button>
            </div>
          ) : (
            <div>
              <canvas width="300" height="150" style={{border:'2px dashed #cbd5e1',borderRadius:'0.5rem',width:'100%',maxWidth:300,background:'#f8fafc'}}/>
              <div style={{marginTop:8}}><button onClick={()=>setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon/> Agrandir</button></div>
            </div>
          )}
        </div>

        <div className="section">
          <button onClick={openCloseValidation} disabled={isSaving} className="btn btn-primary w-full" style={{fontSize:'1rem',padding:'1rem',fontWeight:600}}>
            {isSaving ? (<><LoaderIcon className="animate-spin"/> Sauvegarde...</>) : '🔒 Sauvegarder et Clôturer'}
          </button>
        </div>
      </div>

      {showSignatureModal && <SignatureModal onSave={(sig)=>{persistReport({ ...report, signature: sig }); setShowSignatureModal(false);}} onCancel={()=>setShowSignatureModal(false)} existingSignature={report.signature}/>}

      {/* Modale Annulation (validation technicien) */}
      {cancelModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Annuler l'intervention</h3>
          <p className="text-muted">Veuillez indiquer le motif d'annulation et valider votre action.</p>
          <textarea className="form-control" rows={3} value={cancelModal.reason} onChange={(e)=>setCancelModal(m=>({...m, reason: e.target.value}))} placeholder="Motif obligatoire…" />
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginTop:'0.5rem'}}>
            <div>
              <label>Initiales technicien (obligatoire)</label>
              <input className="form-control" value={cancelModal.initials} onChange={(e)=>setCancelModal(m=>({...m, initials: e.target.value}))} placeholder="ex: AB"/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <label className="checkbox"><input type="checkbox" checked={cancelModal.agree} onChange={(e)=>setCancelModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme l'annulation</span></label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setCancelModal({ open:false, reason:'', initials:'', agree:false })}>Fermer</button>
            <button className="btn btn-danger" onClick={confirmCancel} disabled={!cancelModal.reason.trim() || !cancelModal.initials.trim() || !cancelModal.agree}>Confirmer</button>
          </div>
        </div></div>
      )}

      {/* Modale Départ/Clôture (validation technicien) */}
      {closeModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Clôturer l'intervention</h3>
          <p className="text-muted">Confirmez la clôture. Les validations requises seront vérifiées.</p>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
            <div>
              <label>Initiales technicien</label>
              <input className="form-control" value={closeModal.initials} onChange={(e)=>setCloseModal(m=>({...m, initials: e.target.value}))} placeholder="ex: AB"/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <label className="checkbox"><input type="checkbox" checked={closeModal.agree} onChange={(e)=>setCloseModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme la clôture</span></label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setCloseModal({ open:false, initials:'', agree:false })}>Annuler</button>
            <button className="btn btn-primary" onClick={confirmClose} disabled={!closeModal.initials.trim() || !closeModal.agree}>Clôturer</button>
          </div>
        </div></div>
      )}

      {/* Modale Arrivée (validation technicien) */}
      {startModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Valider l'arrivée</h3>
          <p className="text-muted">Vos initiales seront enregistrées avec l'heure et la géolocalisation (si disponible).</p>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
            <div>
              <label>Initiales technicien</label>
              <input className="form-control" value={startModal.initials} onChange={(e)=>setStartModal(m=>({...m, initials: e.target.value}))} placeholder="ex: AB"/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <label className="checkbox"><input type="checkbox" checked={startModal.agree} onChange={(e)=>setStartModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme mon arrivée</span></label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setStartModal({ open:false, initials:'', agree:false })}>Annuler</button>
            <button className="btn btn-primary" onClick={confirmStart} disabled={!startModal.initials.trim() || !startModal.agree}>Valider</button>
          </div>
        </div></div>
      )}

      {/* Modale Reprise (validation technicien) */}
      {resumeModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Reprise de l'intervention</h3>
          <p className="text-muted">Confirmez la reprise. Vos initiales seront enregistrées.</p>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
            <div>
              <label>Initiales technicien</label>
              <input className="form-control" value={resumeModal.initials} onChange={(e)=>setResumeModal(m=>({...m, initials: e.target.value}))} placeholder="ex: AB"/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <label className="checkbox"><input type="checkbox" checked={resumeModal.agree} onChange={(e)=>setResumeModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme la reprise</span></label>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setResumeModal({ open:false, initials:'', agree:false })}>Annuler</button>
            <button className="btn btn-primary" onClick={confirmResume} disabled={!resumeModal.initials.trim() || !resumeModal.agree}>Valider</button>
          </div>
        </div></div>
      )}

    </div>
  );
}

// -------- Enregistreur de note vocale --------
function VoiceNoteRecorder({ onUploaded, interventionId }) {
  const [rec, setRec] = useState(null);
  const [recording, setRecording] = useState(false);
  const chunksRef = useRef([]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mediaRec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mediaRec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `note-${Date.now()}.webm`, { type: 'audio/webm' });
        const res = await storageService.uploadInterventionFile(file, interventionId, 'voice', ()=>{});
        const publicUrl = res.publicURL?.publicUrl || res.publicURL;
        await onUploaded([{ name: file.name, url: publicUrl, type: file.type }]);
      };
      mediaRec.start(); setRec(mediaRec); setRecording(true);
    } catch (e) { alert('Micro non disponible: ' + e.message); }
  };
  const stop = () => { try { rec?.stop(); setRecording(false); } catch(e){} };
  return (
    <div className="flex items-center gap-2">
      {!recording ? <button className="btn btn-secondary" onClick={start}><MicIcon/> Enregistrer une note</button>
                   : <button className="btn btn-danger" onClick={stop}><StopCircleIcon/> Stop</button>}
    </div>
  );
}
