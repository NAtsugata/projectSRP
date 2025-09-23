// =============================
// FILE: src/pages/InterventionDetailView.js — FULL
// Adds a usable "Demande de fourniture" workflow on top of Needs:
//  - Needs keep category/estimated_price
//  - Create purchase requests from selected needs (status: brouillon/envoyée/reçue/refusée)
//  - Attach request docs, compute totals, persist via onSaveSilent
//  - Safe defaults so existing data won’t crash
// =============================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon, CheckCircleIcon, AlertTriangleIcon, PaperPlaneIcon, CheckCircle2Icon } from '../components/SharedUI';
import { storageService } from '../lib/supabase';

const MIN_REQUIRED_PHOTOS = 2; // validation clôture

const isImageUrl = (f) => {
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u);
};
const numberOrNull = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

// ---------- UI bits ----------
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
    </div>
  );
};

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, dataVersion, refreshData, onAddBriefingDocuments }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [report,    setReport]    = useState(null);
  const [adminNotes,setAdminNotes]= useState('');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // safe schema builder so old data never breaks
  const ensureReportSchema = useCallback((base)=>{
    const r = base || {};
    return {
      notes: r.notes || '',
      files: Array.isArray(r.files) ? r.files : [],
      arrivalTime: r.arrivalTime || null,
      departureTime: r.departureTime || null,
      signature: r.signature || null,
      // needs with new properties
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
      // new: supply requests
      supply_requests: Array.isArray(r.supply_requests) ? r.supply_requests : [],
      // leave the rest untouched if present (extended features can co-exist)
      ...('blocks' in r ? { blocks: r.blocks } : {}),
      ...('parts_used' in r ? { parts_used: r.parts_used } : {}),
      ...('quick_checkpoints' in r ? { quick_checkpoints: r.quick_checkpoints } : {}),
      ...('arrivalGeo' in r ? { arrivalGeo: r.arrivalGeo } : {}),
      ...('departureGeo' in r ? { departureGeo: r.departureGeo } : {}),
      ...('rating' in r ? { rating: r.rating } : {}),
      ...('follow_up_required' in r ? { follow_up_required: r.follow_up_required } : {}),
    };
  },[]);

  useEffect(() => {
    const found = interventions.find(i => String(i.id) === String(interventionId));
    if (found) {
      setIntervention(found);
      setReport(ensureReportSchema(found.report));
      setAdminNotes(found.admin_notes || '');
      setLoading(false);
    } else if (interventions.length>0) {
      navigate('/planning');
    }
  }, [interventions, interventionId, navigate, dataVersion, ensureReportSchema]);

  const persistReport = async (next) => {
    setReport(next);
    await onSaveSilent(intervention.id, next);
    refreshData?.();
  };

  const handleReportChange = (field, value) => setReport(prev=>({...prev,[field]:value}));

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'N/A';
  if (loading || !intervention || !report) return <div className="loading-container"><LoaderIcon className="animate-spin"/><p>Chargement…</p></div>;

  const currentStatus = intervention.status || (report.arrivalTime ? 'En cours' : 'À venir');

  // ------------- Needs (with categories + price) -------------
  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n=>n.urgent).length : 0;
  const [needDraft, setNeedDraft] = useState({ label:'', qty:1, urgent:false, note:'', category:'materiel', estimated_price:'' });
  const addNeed = async () => {
    if (!needDraft.label.trim()) return;
    const item = { ...needDraft, id:`need-${Date.now()}`, estimated_price: numberOrNull(needDraft.estimated_price), request_id:null };
    const updated = { ...report, needs: [...(report.needs||[]), item] };
    await persistReport(updated);
  };
  const removeNeed = async (id) => {
    const updated = { ...report, needs: (report.needs||[]).filter(n=>n.id!==id) };
    await persistReport(updated);
  };
  const needsTotal = Array.isArray(report.needs) ? report.needs.reduce((s,n)=> s + (Number(n.estimated_price)||0), 0) : 0;

  // ------------- Supply Requests (Demande de fourniture) -------------
  const [selection, setSelection] = useState({});
  const toggleSelect = (id) => setSelection(s=>({ ...s, [id]: !s[id] }));

  const createSupplyRequest = async () => {
    const selectedNeeds = (report.needs||[]).filter(n=>selection[n.id] && !n.request_id);
    if (!selectedNeeds.length) return alert('Sélectionnez au moins 1 besoin non déjà demandé.');
    const items = selectedNeeds.map(n=>({ need_id:n.id, label:n.label, qty:n.qty||1, category:n.category||'materiel', estimated_price:numberOrNull(n.estimated_price), note:n.note||'' }));
    const total = items.reduce((s,i)=> s + ((Number(i.estimated_price)||0)), 0);
    const req = { id:`req-${Date.now()}`, created_at:new Date().toISOString(), status:'brouillon', vendor:'', comment:'', total, items, files:[] };
    const needs = report.needs.map(n=> selection[n.id] ? { ...n, request_id:req.id } : n);
    const updated = { ...report, supply_requests:[...(report.supply_requests||[]), req], needs };
    await persistReport(updated);
    setSelection({});
  };

  const updateRequest = async (reqId, patch) => {
    const list = (report.supply_requests||[]).map(r=> r.id===reqId ? { ...r, ...patch } : r);
    await persistReport({ ...report, supply_requests: list });
  };
  const addRequestFiles = async (reqId, files) => {
    const list = (report.supply_requests||[]).map(r=> r.id===reqId ? { ...r, files:[...(r.files||[]), ...files] } : r);
    await persistReport({ ...report, supply_requests: list });
  };

  const exportRequestCSV = (req) => {
    const rows = [['Label','Qté','Catégorie','Prix estimé (€)','Note']].concat(
      req.items.map(i=>[i.label, i.qty, i.category, (i.estimated_price??'').toString().replace('.',','), i.note.replace(/\n/g,' ')]));
    const total = req.total || req.items.reduce((s,i)=> s+(Number(i.estimated_price)||0),0);
    rows.push([],[`TOTAL`, '', '', total.toString().replace('.',','), '']);
    const csv = rows.map(r=> r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `demande_fourniture_${req.id}.csv`; a.click();
  };

  // ------------- Clôture -------------
  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    if (!report.signature) return { ok:false, msg:'Signature client manquante.' };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok:false, msg:`Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s).` };
    return { ok:true };
  };
  const handleSave = async () => {
    const v = validateCanClose(); if(!v.ok) return alert(v.msg);
    setIsSaving(true); try { await onSave(intervention.id, { ...report, admin_notes: adminNotes }); } finally { setIsSaving(false); }
  };

  return (
    <div>
      <button onClick={()=>navigate('/planning')} className="back-button"><ChevronLeftIcon/> Retour</button>
      <div className="card-white">
        <h2>{intervention.client}</h2>
        <p className="text-muted">{intervention.address}</p>

        {/* Statut + badges */}
        <div className="section">
          <h3>⚑ Statut de l'intervention</h3>
          <div className="flex items-center gap-2" style={{flexWrap:'wrap'}}>
            <span className="badge">Statut actuel : {currentStatus}</span>
            {urgentCount>0 && <span className="badge" style={{background:'#f59e0b',color:'#111827'}}>URG {urgentCount}</span>}
          </div>
        </div>

        {/* Rapport */}
        <div className="section">
          <h3>📝 Rapport de chantier</h3>
          <textarea value={report.notes||''} onChange={e=>handleReportChange('notes', e.target.value)} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={isAdmin}/>
        </div>

        {/* Besoins */}
        <div className="section">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <h3>🧰 Besoins chantier</h3>
            <div className="text-muted">Budget estimé: <b>{needsTotal.toFixed(2)} €</b></div>
          </div>
          {(!report.needs || report.needs.length===0) && <p className="text-muted">Aucun besoin pour le moment.</p>}
          {Array.isArray(report.needs) && report.needs.length>0 && (
            <ul className="document-list">
              {report.needs.map(n=> (
                <li key={n.id}>
                  <div style={{flexGrow:1,minWidth:0}}>
                    <label className="checkbox" title="Inclure dans une demande"><input type="checkbox" checked={!!selection[n.id]} onChange={()=>toggleSelect(n.id)} disabled={!!n.request_id}/>&nbsp;</label>
                    <span className="font-semibold">[{n.category||'—'}] {n.label}{n.qty?` × ${n.qty}`:''} {n.urgent?<span className="badge" style={{marginLeft:8}}>Urgent</span>:null}</span>
                    <div className="text-muted" style={{fontSize:'0.875rem'}}>
                      {n.note||'—'} {typeof n.estimated_price==='number'?` • Estimé: ${n.estimated_price.toFixed(2)} €`:''}
                      {n.request_id && <span className="badge" style={{marginLeft:8,background:'#e5e7eb',color:'#111827'}}>Req: {n.request_id}</span>}
                    </div>
                  </div>
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
              <div style={{gridColumn:'1 / -1',display:'flex',gap:8,flexWrap:'wrap'}}>
                <button className="btn btn-primary" onClick={addNeed} disabled={!needDraft.label.trim()}>Ajouter besoin</button>
                <button className="btn btn-secondary" onClick={createSupplyRequest} disabled={!Object.values(selection).some(Boolean)}><PaperPlaneIcon/> Créer une demande de fourniture</button>
              </div>
            </div>
          )}
        </div>

        {/* Demandes de fourniture */}
        <div className="section">
          <h3>📦 Demandes de fourniture</h3>
          {!(report.supply_requests||[]).length && <p className="text-muted">Aucune demande créée.</p>}
          {(report.supply_requests||[]).map(req => (
            <div className="card-white" key={req.id} style={{marginBottom:8}}>
              <div className="flex-between items-center" style={{gap:8,flexWrap:'wrap'}}>
                <div>
                  <b>#{req.id}</b> — {new Date(req.created_at).toLocaleString('fr-FR')} — <span className="badge" style={{background:'#e5e7eb',color:'#111827'}}>{req.status}</span>
                  {req.vendor && <span className="text-muted"> • Fournisseur: {req.vendor}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary" onClick={()=>exportRequestCSV(req)} title="Exporter en CSV"><DownloadIcon/> CSV</button>
                  {!isAdmin && req.status!=='envoyée' && (
                    <button className="btn btn-primary" onClick={()=>updateRequest(req.id,{status:'envoyée'})}><PaperPlaneIcon/> Marquer envoyée</button>
                  )}
                  {isAdmin && req.status!=='reçue' && (
                    <button className="btn btn-success" onClick={()=>updateRequest(req.id,{status:'reçue'})}><CheckCircle2Icon/> Marquer reçue</button>
                  )}
                </div>
              </div>
              <div style={{marginTop:8}}>
                <label>Commentaire / fournisseur</label>
                <input className="form-control" value={req.vendor||''} onChange={e=>updateRequest(req.id,{vendor:e.target.value})} placeholder="Nom fournisseur, référence devis…"/>
              </div>
              <ul className="document-list" style={{marginTop:8}}>
                {req.items.map((i,idx)=> (
                  <li key={i.need_id||idx}>
                    <div style={{flexGrow:1}}>
                      <p className="font-semibold">[{i.category}] {i.label} × {i.qty||1}</p>
                      <p className="text-muted" style={{fontSize:'0.875rem'}}>Estimation: {typeof i.estimated_price==='number'? i.estimated_price.toFixed(2)+' €' : '—'} {i.note? ' • '+i.note : ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex-between" style={{marginTop:8}}>
                <div className="text-muted">Total estimé: <b>{(req.total || req.items.reduce((s,i)=>s+(Number(i.estimated_price)||0),0)).toFixed(2)} €</b></div>
                <InlineUploader interventionId={interventionId} onUploadComplete={(files)=>addRequestFiles(req.id, files)} folder={`supply/${req.id}`}/>
              </div>
              {Array.isArray(req.files) && req.files.length>0 && (
                <ul className="document-list-optimized" style={{marginTop:8}}>
                  {req.files.map((f,idx)=> (
                    <li key={idx} className="document-item-optimized">
                      <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',background:'#e9ecef',borderRadius:'0.25rem'}}><FileTextIcon/></div>
                      <span className="file-name">{f.name}</span>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" download={f.name}><DownloadIcon/></a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Photos & signature (pour la validation) */}
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
            <InlineUploader interventionId={interventionId} onUploadComplete={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]),...uploaded]}; await persistReport(updated); }}/>
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
              <canvas width="300" height="150" style={{border:'2px dashed #cbd5e1',borderRadius:'0.5rem',width:'100%',maxWidth:300,background:'#f8fafc'}}/>
              {!isAdmin && <div style={{marginTop:8}}><button onClick={()=>setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon/> Agrandir</button></div>}
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{fontSize:'1rem',padding:'1rem',fontWeight:600}}>{isSaving ? (<><LoaderIcon className="animate-spin"/> Sauvegarde...</>) : '🔒 Sauvegarder et Clôturer'}</button>
      </div>

      {/* Modales */}
      {showSignatureModal && <SignatureModal onSave={(sig)=>{handleReportChange('signature',sig); setShowSignatureModal(false);}} onCancel={()=>setShowSignatureModal(false)} existingSignature={report.signature}/>}
      {showCancelModal && <CancelReasonModal onCancel={()=>setShowCancelModal(false)} onConfirm={(reason)=>{ setShowCancelModal(false); /* setStatus('Annulée', reason) — optionnel */ }}/>}
    </div>
  );
}

