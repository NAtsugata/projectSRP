// =============================
// FILE: src/pages/InterventionDetailView.js (FULL — + besoins avec catégories/prix, pièces utilisées,
//         blocages avec justificatifs, checkpoints rapides, validation de clôture,
//         géoloc arrivée/départ, note vocale, notation client + SAV)
// =============================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon, CheckCircleIcon, AlertTriangleIcon, MicIcon, StopCircleIcon } from '../components/SharedUI';
import { storageService } from '../lib/supabase';

// -------- Config validation clôture --------
const MIN_REQUIRED_PHOTOS = 2; // ajustable

// -------- Utilitaires --------
const isImageUrl = (f) => {
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)($|\?)/i.test(u);
};

// Image optimisée
const OptimizedImage = ({ src, alt, className, style }) => {
  const [loadState, setLoadState] = useState('loading');
  const imgRef = useRef(null);
  useEffect(() => {
    if (!src || typeof src !== 'string') { setLoadState('error'); return; }
    const img = new Image();
    img.onload = () => setLoadState('loaded');
    img.onerror = () => setLoadState('error');
    if ('IntersectionObserver' in window && imgRef.current) {
      const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) { img.src = src; obs.disconnect(); }
      }, { rootMargin: '50px' });
      obs.observe(imgRef.current);
      return () => obs.disconnect();
    } else { img.src = src; }
  }, [src]);
  if (loadState === 'loading') return (<div ref={imgRef} className={className} style={{...style,display:'flex',alignItems:'center',justifyContent:'center',background:'#f3f4f6'}}><LoaderIcon className="animate-spin"/></div>);
  if (loadState === 'error') return (<div className={className} style={{...style,display:'flex',alignItems:'center',justifyContent:'center',background:'#fee2e2',color:'#dc2626'}}><XCircleIcon/></div>);
  return <img ref={imgRef} src={src} alt={alt} className={className} style={{...style,display:'block'}} loading="lazy"/>;
};

// Signature plein écran
const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
  const canvasRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const isMobile = window.innerWidth < 768;
    canvas.width = Math.min(window.innerWidth * 0.9, 600);
    canvas.height = isMobile ? window.innerHeight * 0.5 : 300;
    const ctx = canvas.getContext('2d'); ctx.strokeStyle = '#000'; ctx.lineWidth = isMobile ? 3 : 2; ctx.lineCap='round'; ctx.lineJoin='round';
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
    <div className="modal-overlay">
      <div className="modal-content signature-modal-content">
        <h3>✍️ Signature du client</h3>
        <canvas ref={canvasRef} className="signature-canvas-fullscreen"/>
        <div className="modal-footer" style={{marginTop:'1rem'}}>
          <button type="button" onClick={()=>{const c=canvasRef.current;if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);}}} className="btn btn-secondary">Effacer</button>
          <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
          <button type="button" onClick={()=>onSave(canvasRef.current.toDataURL('image/png'))} className="btn btn-primary" disabled={!hasDrawn}>Valider</button>
        </div>
      </div>
    </div>
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

// Uploader inline (photos/docs généraux ou justificatifs blocages)
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
    if(uploaded.length){ try{ await onUploadComplete(uploaded);}catch(err){ setState(s=>({...s,error:"La sauvegarde des fichiers a échoué."})); } }
    setState(s=>({...s,uploading:false}));
  },[compressImage,interventionId,onUploadComplete]);
  return (
    <div className="mobile-uploader-panel">
      <input ref={inputRef} type="file" multiple accept="image/*,application/pdf,audio/webm" onChange={onChange} disabled={state.uploading} style={{display:'none'}}/>
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

// Enregistreur de note vocale
const VoiceNoteRecorder = ({ onUploaded, interventionId }) => {
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
    } catch (e) { alert("Micro non disponible: " + e.message); }
  };
  const stop = () => { try { rec?.stop(); setRecording(false); } catch(e){} };
  return (
    <div className="flex items-center gap-2" style={{marginTop:'0.5rem'}}>
      {!recording ? <button className="btn btn-secondary" onClick={start}><MicIcon/> Enregistrer une note</button>
                   : <button className="btn btn-danger" onClick={stop}><StopCircleIcon/> Stop</button>}
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
      setReport(found.report || {
        notes:'', files:[], arrivalTime:null, departureTime:null, signature:null,
        needs:[],
        parts_used:[],
        quick_checkpoints:[
          { label:'Zone sécurisée', done:false, at:null },
          { label:'Essais OK', done:false, at:null },
          { label:'Brief client fait', done:false, at:null },
        ],
        blocks:{
          access:{ blocked:false, note:'', photos:[] },
          power:{ blocked:false, note:'', photos:[] },
          parts:{ blocked:false, note:'', photos:[] },
          authorization:{ blocked:false, note:'', photos:[] },
        },
        arrivalGeo:null,
        departureGeo:null,
        rating:null,
        follow_up_required:false
      });
      setAdminNotes(found.admin_notes || '');
      setLoading(false);
    } else if (interventions.length>0) {
      navigate('/planning');
    }
  }, [interventions, interventionId, navigate, dataVersion]);

  // Journal d'activité
  const appendActivity = async (action, meta={}) => {
    const entry = { at:new Date().toISOString(), by:(isAdmin?'admin':'employe'), action, meta };
    const current = Array.isArray(intervention.activity_log) ? [...intervention.activity_log] : [];
    current.push(entry);
    await onSaveSilent(intervention.id, { activity_log: current });
  };

  const handleReportChange = (field, value) => setReport(prev=>({...prev,[field]:value}));

  const persistReport = async (updated) => {
    setReport(updated);
    await onSaveSilent(intervention.id, updated);
    refreshData();
  };

  // -------- Besoins chantier (catégories + prix estimé) --------
  const [needDraft, setNeedDraft] = useState({ label:'', qty:1, urgent:false, note:'', category:'materiel', estimated_price:'' });
  const addNeed = async () => {
    if (!needDraft.label.trim()) return;
    const newNeeds = [...(report.needs||[]), { ...needDraft, id:`need-${Date.now()}`, estimated_price: needDraft.estimated_price? Number(needDraft.estimated_price): null }];
    const updated = { ...report, needs: newNeeds };
    await persistReport(updated);
    await appendActivity('NEED_ADDED', { label:needDraft.label, qty:needDraft.qty, urgent:needDraft.urgent, category:needDraft.category });
    setNeedDraft({ label:'', qty:1, urgent:false, note:'', category:'materiel', estimated_price:'' });
  };
  const removeNeed = async (id) => {
    const newNeeds = (report.needs||[]).filter(n=>n.id!==id);
    await persistReport({ ...report, needs: newNeeds });
    await appendActivity('NEED_REMOVED', { id });
  };
  const needsTotal = Array.isArray(report?.needs)? report.needs.reduce((sum,n)=> sum + (Number(n.estimated_price)||0), 0) : 0;

  // -------- Pièces utilisées --------
  const [partDraft, setPartDraft] = useState({ ref:'', qty:1, unit_price:'' });
  const addPart = async () => {
    if (!partDraft.ref.trim()) return;
    const newParts = [...(report.parts_used||[]), { ...partDraft, id:`part-${Date.now()}`, unit_price: partDraft.unit_price? Number(partDraft.unit_price): null }];
    await persistReport({ ...report, parts_used: newParts });
    await appendActivity('PART_ADDED', { ref:partDraft.ref, qty:partDraft.qty });
    setPartDraft({ ref:'', qty:1, unit_price:'' });
  };
  const removePart = async (id) => {
    const newParts = (report.parts_used||[]).filter(p=>p.id!==id);
    await persistReport({ ...report, parts_used: newParts });
    await appendActivity('PART_REMOVED', { id });
  };
  const partsTotal = Array.isArray(report?.parts_used)? report.parts_used.reduce((sum,p)=> sum + ((Number(p.unit_price)||0) * (Number(p.qty)||0)), 0) : 0;

  // -------- Blocages (checkbox + note + photos) --------
  const toggleBlock = async (key) => {
    const blocks = { ...(report.blocks||{}) };
    blocks[key] = { ...(blocks[key]||{}), blocked: !blocks[key]?.blocked };
    await persistReport({ ...report, blocks });
    await appendActivity('BLOCK_TOGGLED', { key, blocked: blocks[key].blocked });
  };
  const updateBlockNote = async (key, note) => {
    const blocks = { ...(report.blocks||{}) };
    blocks[key] = { ...(blocks[key]||{}), note };
    await persistReport({ ...report, blocks });
  };
  const addBlockPhotos = async (key, uploaded) => {
    const blocks = { ...(report.blocks||{}) };
    const list = Array.isArray(blocks[key]?.photos) ? blocks[key].photos : [];
    blocks[key] = { ...(blocks[key]||{}), photos: [...list, ...uploaded] };
    await persistReport({ ...report, blocks });
    await appendActivity('BLOCK_PHOTOS_ADDED', { key, count: uploaded.length });
  };

  // -------- Checkpoints rapides --------
  const toggleQuickCheckpoint = async (idx) => {
    const list = Array.isArray(report.quick_checkpoints) ? [...report.quick_checkpoints] : [];
    const curr = list[idx]; if (!curr) return;
    list[idx] = { ...curr, done: !curr.done, at: new Date().toISOString() };
    await persistReport({ ...report, quick_checkpoints: list });
  };

  // -------- Pointage + géoloc --------
  const captureGeo = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos)=> resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      ()=> resolve(null),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
  const setArrival = async () => {
    const geo = await captureGeo();
    await persistReport({ ...report, arrivalTime: new Date().toISOString(), arrivalGeo: geo });
    await appendActivity('TIME_ARRIVAL', { geo });
  };
  const setDeparture = async () => {
    const geo = await captureGeo();
    await persistReport({ ...report, departureTime: new Date().toISOString(), departureGeo: geo });
    await appendActivity('TIME_DEPARTURE', { geo });
  };

  // -------- Statut --------
  const setStatus = async (status, reason=null) => {
    const payload = { status, cancellation_reason: status==='Annulée' ? (reason||'') : null };
    await onSaveSilent(intervention.id, payload);
    await appendActivity('STATUS_CHANGED', { status, reason: reason||null });
    refreshData();
  };

  // -------- Validation de clôture --------
  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsOK = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.every(c=>!!c.done) : true;
    if (!report.signature) return { ok:false, msg:`Signature client manquante.` };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok:false, msg:`Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s).` };
    if (!checkpointsOK) return { ok:false, msg:`Tous les checkpoints rapides doivent être validés.` };
    return { ok:true };
  };

  const handleSave = async () => {
    if (!intervention) return;
    const v = validateCanClose();
    if (!v.ok) { alert(v.msg); return; }
    setIsSaving(true);
    try { await onSave(intervention.id, { ...report, admin_notes: adminNotes }); }
    finally { setIsSaving(false); }
  };

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'N/A';
  if (loading || !intervention || !report) return <div className="loading-container"><LoaderIcon className="animate-spin"/><p>Chargement…</p></div>;
  const currentStatus = intervention.status || (report.arrivalTime ? 'En cours' : 'À venir');
  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n=>n.urgent).length : 0;
  const arrivalGeoTxt = report.arrivalGeo ? `${report.arrivalGeo.lat.toFixed(5)}, ${report.arrivalGeo.lng.toFixed(5)} (±${Math.round(report.arrivalGeo.acc)}m)` : '—';
  const departureGeoTxt = report.departureGeo ? `${report.departureGeo.lat.toFixed(5)}, ${report.departureGeo.lng.toFixed(5)} (±${Math.round(report.departureGeo.acc)}m)` : '—';

  return (
    <div>
      {showSignatureModal && <SignatureModal onSave={(sig)=>{handleReportChange('signature',sig); setShowSignatureModal(false);}} onCancel={()=>setShowSignatureModal(false)} existingSignature={report.signature}/>}
      {showCancelModal && <CancelReasonModal onCancel={()=>setShowCancelModal(false)} onConfirm={async(reason)=>{ setShowCancelModal(false); await setStatus('Annulée', reason); }}/>}

      <button onClick={()=>navigate('/planning')} className="back-button"><ChevronLeftIcon/> Retour</button>
      <div className="card-white">
        <h2>{intervention.client}</h2>
        <p className="text-muted">{intervention.address}</p>

        {/* Statut + badges */}
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

        {/* Pointage + géoloc */}
        <div className="section">
          <h3>⏱️ Pointage</h3>
          <div className="grid-2-cols">
            <button onClick={setArrival} className="btn btn-success" disabled={!!report.arrivalTime || isAdmin}>
              {report.arrivalTime?`✅ Arrivé: ${formatTime(report.arrivalTime)} — ${arrivalGeoTxt}`:'🕐 Arrivée sur site'}
            </button>
            <button onClick={setDeparture} className="btn btn-danger" disabled={!report.arrivalTime || !!report.departureTime || isAdmin}>
              {report.departureTime?`✅ Parti: ${formatTime(report.departureTime)} — ${departureGeoTxt}`:'🚪 Départ du site'}
            </button>
          </div>
        </div>

        {/* Documents de préparation */}
        <div className="section">
          <h3>📋 Documents de préparation</h3>
          {(intervention.intervention_briefing_documents?.length>0) ? (
            <ul className="document-list-optimized" style={{marginBottom:'1rem'}}>
              {intervention.intervention_briefing_documents.map(doc=>{
                const isImg = doc.file_name && /(jpe?g|png|gif|webp)$/i.test(doc.file_name);
                return (
                  <li key={doc.id} className="document-item-optimized">
                    {isImg && doc.file_url
                      ? <OptimizedImage src={doc.file_url} alt={doc.file_name} style={{width:40,height:40,objectFit:'cover',borderRadius:'0.25rem'}}/>
                      : <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>}
                    <span className="file-name">{doc.file_name}</span>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" download={doc.file_name}><DownloadIcon/> Voir</a>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-muted">Aucun document de préparation.</p>}
        </div>

        {/* Rapport notes */}
        <div className="section">
          <h3>📝 Rapport de chantier</h3>
          <textarea value={report.notes||''} onChange={e=>handleReportChange('notes', e.target.value)} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={isAdmin}/>
          {!isAdmin && (
            <VoiceNoteRecorder
              interventionId={interventionId}
              onUploaded={async(uploaded)=>{
                const updated={...report, files:[...(report.files||[]), ...uploaded]};
                await persistReport(updated);
                await appendActivity('VOICE_NOTE_UPLOADED', { count: uploaded.length });
              }}
            />
          )}
        </div>

        {/* Notes admin */}
        {(isAdmin || adminNotes) && (
          <div className="section">
            <h3>🔒 Notes de l'administration</h3>
            <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} placeholder={isAdmin?"Ajouter des notes...":"Aucune note de l'administration."} rows="4" className="form-control" readOnly={!isAdmin}/>
          </div>
        )}

        {/* Besoins chantier */}
        <div className="section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12}}>
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
                  {!isAdmin && <button className="btn-icon-danger" onClick={()=>removeNeed(n.id)} title="Supprimer">✖</button>}
                </li>
              ))}
            </ul>
          )}
          {!isAdmin && (
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
              <div><label>Intitulé</label><input className="form-control" value={needDraft.label} onChange={e=>setNeedDraft(v=>({...v,label:e.target.value}))} placeholder="Ex: Tuyau 16mm"/></div>
              <div><label>Prix estimé (€)</label><input className="form-control" value={needDraft.estimated_price} onChange={e=>setNeedDraft(v=>({...v,estimated_price:e.target.value}))} placeholder="ex: 25.90"/></div>
              <div><label>Note</label><input className="form-control" value={needDraft.note} onChange={e=>setNeedDraft(v=>({...v,note:e.target.value}))} placeholder="Détail, lien, réf…"/></div>
              <div style={{gridColumn:'1 / -1'}}><button className="btn btn-primary" onClick={addNeed} disabled={!needDraft.label.trim()}>Ajouter</button></div>
            </div>
          )}
        </div>

        {/* Pièces utilisées */}
        <div className="section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12}}>
            <h3>🔩 Pièces utilisées</h3>
            <div className="text-muted">Coût pièces: <b>{partsTotal.toFixed(2)} €</b></div>
          </div>
          {(!report.parts_used || report.parts_used.length===0) && <p className="text-muted">Aucune pièce saisie.</p>}
          {Array.isArray(report.parts_used) && report.parts_used.length>0 && (
            <ul className="document-list">
              {report.parts_used.map(p=> (
                <li key={p.id}>
                  <div style={{flexGrow:1}}>
                    <p className="font-semibold">{p.ref} {p.qty?`× ${p.qty}`:''}</p>
                    <p className="text-muted" style={{fontSize:'0.875rem'}}>
                      {typeof p.unit_price==='number' ? `Unit: ${p.unit_price.toFixed(2)} € • Total: ${(p.unit_price*(p.qty||0)).toFixed(2)} €` : '—'}
                    </p>
                  </div>
                  {!isAdmin && <button className="btn-icon-danger" onClick={()=>removePart(p.id)} title="Supprimer">✖</button>}
                </li>
              ))}
            </ul>
          )}
          {!isAdmin && (
            <div className="grid" style={{gridTemplateColumns:'1fr 100px 160px auto', gap:'0.5rem', alignItems:'end'}}>
              <div><label>Référence</label><input className="form-control" value={partDraft.ref} onChange={e=>setPartDraft(v=>({...v,ref:e.target.value}))} placeholder="Ex: Raccord 1/4"/></div>
              <div><label>Qté</label><input type="number" min={1} className="form-control" value={partDraft.qty} onChange={e=>setPartDraft(v=>({...v,qty:Math.max(1,Number(e.target.value)||1)}))}/></div>
              <div><label>Prix unit. (€)</label><input className="form-control" value={partDraft.unit_price} onChange={e=>setPartDraft(v=>({...v,unit_price:e.target.value}))} placeholder="ex: 12.50"/></div>
              <div><button className="btn btn-primary" onClick={addPart} disabled={!partDraft.ref.trim()}>Ajouter</button></div>
            </div>
          )}
        </div>

        {/* Blocages */}
        <div className="section">
          <h3>⛔ Blocages</h3>
          {['access','power','parts','authorization'].map(key=> (
            <div key={key} className="card-white" style={{marginBottom:'0.5rem'}}>
              <div className="flex items-center gap-2" style={{justifyContent:'space-between'}}>
                <label className="checkbox"><input type="checkbox" checked={!!report.blocks?.[key]?.blocked} onChange={()=>toggleBlock(key)}/> <b>{key==='access'?'Accès': key==='power'?'Alim': key==='parts'?'Pièces':'Autorisation'}</b></label>
                {!isAdmin && <InlineUploader interventionId={interventionId} onUploadComplete={(files)=>addBlockPhotos(key, files)} folder={`blocks/${key}`}/>}
              </div>
              <div style={{marginTop:6}}>
                <input className="form-control" placeholder="Justificatif / commentaire" value={report.blocks?.[key]?.note||''} onChange={e=>updateBlockNote(key, e.target.value)} readOnly={isAdmin}/>
              </div>
              {Array.isArray(report.blocks?.[key]?.photos) && report.blocks[key].photos.length>0 && (
                <ul className="document-list-optimized" style={{marginTop:'8px'}}>
                  {report.blocks[key].photos.map((f,idx)=> (
                    <li key={idx} className="document-item-optimized">
                      {isImageUrl(f) ? <OptimizedImage src={f.url||f} alt={f.name||'photo'} style={{width:40,height:40,objectFit:'cover',borderRadius:'0.25rem'}}/> : (
                        <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>
                      )}
                      <span className="file-name">{f.name||'fichier'}</span>
                      <a href={f.url||f} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" download>{<DownloadIcon/>}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Photos & documents généraux + note vocale */}
        <div className="section">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h3>📷 Photos et Documents</h3>
            <button onClick={refreshData} className="btn-icon" title="Rafraîchir"><RefreshCwIcon/></button>
          </div>
          {report.files?.length>0 ? (
            <ul className="document-list-optimized" style={{marginBottom:'1rem'}}>
              {report.files.map((file,idx)=> (
                <li key={`${file.url||idx}-${idx}`} className="document-item-optimized">
                  {file.type?.startsWith('image/') ? <OptimizedImage src={file.url} alt={file.name} style={{width:40,height:40,objectFit:'cover',borderRadius:'0.25rem'}}/>
                   : file.type?.startsWith('audio/') ? <div style={{width:40}}><audio controls src={file.url} style={{height:32}}/></div>
                   : <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>}
                  <span className="file-name">{file.name}</span>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" download={file.name}><DownloadIcon/></a>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">Aucun fichier pour le moment.</p>}
          {!isAdmin && (<>
            <button onClick={()=>setShowUploader(!showUploader)} className={`btn w-full ${showUploader?'btn-secondary':'btn-primary'}`}>{showUploader?'Fermer':'📷 Ajouter photos/documents'}</button>
            {showUploader && <InlineUploader interventionId={interventionId} onUploadComplete={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]),...uploaded]}; await persistReport(updated); await appendActivity('FILE_UPLOADED', {count:uploaded.length}); }}/>}
          </>)}
        </div>

        {/* Signature */}
        <div className="section">
          <h3>✍️ Signature du client</h3>
          {report.signature ? (
            <div>
              <img src={report.signature} alt="Signature" style={{width:'100%',maxWidth:300,border:'2px solid #e5e7eb',borderRadius:'0.5rem',background:'#f8f9fa'}}/>
              {!isAdmin && <button onClick={()=>handleReportChange('signature',null)} className="btn btn-sm btn-secondary" style={{marginTop:8}}>Effacer</button>}
            </div>
          ) : (
            <div>
              <canvas width="300" height="150" style={{border:'2px dashed #cbd5e1',borderRadius:'0.5rem',width:'100%',maxWidth:300,background:'#f8fafc'}}/>
              {!isAdmin && <div style={{marginTop:8}}><button onClick={()=>setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon/> Agrandir</button></div>}
            </div>
          )}
        </div>

        {/* Checkpoints rapides */}
        <div className="section">
          <h3>✅ Checkpoints rapides</h3>
          <ul className="document-list">
            {(report.quick_checkpoints||[]).map((c,idx)=> (
              <li key={idx}>
                <label className="checkbox"><input type="checkbox" checked={!!c.done} onChange={()=>toggleQuickCheckpoint(idx)} disabled={isAdmin}/> {c.label}</label>
                <span className="text-muted" style={{fontSize:'0.875rem'}}>{c.done?`le ${new Date(c.at).toLocaleString('fr-FR')}`:'à faire'}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Notation client + SAV */}
        <div className="section">
          <h3>⭐ Suivi client</h3>
          <div className="grid" style={{gridTemplateColumns:'160px 1fr 160px', gap:'0.5rem', alignItems:'center'}}>
            <div>
              <label>Note (1–5)</label>
              <input type="number" min={1} max={5} className="form-control" value={report.rating||''} onChange={e=>handleReportChange('rating', Math.min(5,Math.max(1, Number(e.target.value)||1)))} readOnly={isAdmin}/>
            </div>
            <div>
              <label>À recontacter (SAV)</label>
              <select className="form-control" value={report.follow_up_required? '1':'0'} onChange={e=>handleReportChange('follow_up_required', e.target.value==='1')} disabled={isAdmin}>
                <option value="0">Non</option>
                <option value="1">Oui</option>
              </select>
            </div>
          </div>
        </div>

        {/* Journal d’activités */}
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
