// =================================================================
// FICHIER : src/pages/InterventionDetailView.js — VERSION AMÉLIORÉE
// - Intègre un uploader de fichiers optimisé pour mobile
// - Améliore l'expérience utilisateur et le design général
// =================================================================
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeftIcon, DownloadIcon, FileTextIcon, LoaderIcon, ExpandIcon, RefreshCwIcon,
  XCircleIcon, CheckCircleIcon, AlertTriangleIcon, MicIcon, StopCircleIcon, CheckCircle2Icon,
  PaperPlaneIcon, CameraIcon, FileUpIcon,
} from '../components/SharedUI'; // Assurez-vous d'importer CameraIcon et FileUpIcon
import { storageService } from '../lib/supabase';

const MIN_REQUIRED_PHOTOS = 2;
const MEDIA_TAGS = ['Avant', 'En cours', 'Après', 'Anomalies', 'Documents'];

// --- Fonctions utilitaires ---
const isImageUrl = (f) => {
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u);
};
const numberOrNull = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

// =================================================================
// COMPOSANT : OptimizedImage
// Affiche une image de manière optimisée (lazy loading)
// =================================================================
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

// =================================================================
// COMPOSANT : SignatureModal
// Modale pour la signature client en plein écran
// =================================================================
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
        <button type="button" onClick={()=>{const c=canvasRef.current;if(c){c.getContext('2d').clearRect(0,0,c.width,c.height); setHasDrawn(false);}}} className="btn btn-secondary">Effacer</button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Annuler</button>
        <button type="button" onClick={()=>onSave(canvasRef.current.toDataURL('image/png'))} className="btn btn-primary" disabled={!hasDrawn}>Valider</button>
      </div>
    </div></div>
  );
};


// =================================================================
// COMPOSANT : InlineUploader (VERSION AMÉLIORÉE)
// Gère l'envoi de fichiers avec prévisualisation et accès caméra
// =================================================================
const InlineUploader = ({ interventionId, onUploadComplete, folder = 'report', accept = 'image/*,application/pdf,audio/webm' }) => {
  const [state, setState] = useState({ uploading: false, queue: [], error: null });
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const compressImage = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise(res => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const MW = 1280, MH = 720;
        if (width > height) { if (width > MW) { height *= MW / width; width = MW; } }
        else { if (height > MH) { width *= MH / height; height = MH; } }
        c.width = width; c.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        c.toBlob(b => res(b ? new File([b], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file), 'image/jpeg', 0.8);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const newQueue = Array.from(files).map((f, i) => ({
      id: `${f.name}-${Date.now()}-${i}`,
      name: f.name,
      status: 'pending',
      progress: 0,
      error: null,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      originalFile: f,
    }));

    // Reset file inputs
    if(photoInputRef.current) photoInputRef.current.value = "";
    if(fileInputRef.current) fileInputRef.current.value = "";

    setState(s => ({ ...s, uploading: true, queue: [...s.queue, ...newQueue], error: null }));

    const uploaded = [];
    for (let i = 0; i < newQueue.length; i++) {
      const item = newQueue[i];
      try {
        const fileToUpload = await compressImage(item.originalFile);

        const result = await storageService.uploadInterventionFile(fileToUpload, interventionId, folder, (progress) => {
          setState(s => ({ ...s, queue: s.queue.map(it => it.id === item.id ? { ...it, status: 'uploading', progress } : it) }));
        });

        if (result.error) throw result.error;
        const publicUrl = result.publicURL?.publicUrl || result.publicURL;
        if (typeof publicUrl !== 'string') throw new Error('URL de fichier invalide');

        uploaded.push({ name: item.name, url: publicUrl, type: item.originalFile.type });
        setState(s => ({ ...s, queue: s.queue.map(it => it.id === item.id ? { ...it, status: 'completed', progress: 100 } : it) }));

      } catch (err) {
        setState(s => ({ ...s, queue: s.queue.map(it => it.id === item.id ? { ...it, status: 'error', error: String(err.message || err) } : it) }));
      }
      if (item.preview) URL.revokeObjectURL(item.preview);
    }

    if (uploaded.length > 0) {
      try { await onUploadComplete(uploaded); }
      catch (err) { setState(s => ({ ...s, error: "La sauvegarde des fichiers a échoué." })); }
    }

    setTimeout(() => {
        setState(s => ({...s, uploading: false, queue: s.queue.filter(it => it.status !== 'completed') }));
    }, 2000);

  }, [compressImage, interventionId, onUploadComplete, folder]);

  return (
    <div className="uploader-v2">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
        disabled={state.uploading}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
        disabled={state.uploading}
      />
      <div className="uploader-actions">
        <button onClick={() => photoInputRef.current?.click()} className="btn btn-primary" disabled={state.uploading}>
          <CameraIcon/> Prendre une photo
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" disabled={state.uploading}>
          <FileUpIcon/> Choisir des fichiers
        </button>
      </div>

      {state.uploading && <div className="text-center text-muted" style={{margin:'0.5rem 0'}}>Envoi en cours...</div>}

      {state.queue.length > 0 && (
        <div className="upload-queue-v2">
          {state.queue.map(item => (
            <div key={item.id} className={`upload-item-v2 status-${item.status}`}>
              {item.preview ? (
                <img src={item.preview} alt="preview" className="upload-preview" />
              ) : (
                <div className="upload-preview-placeholder"><FileTextIcon/></div>
              )}
              <div className="upload-details">
                <div className="file-name">{item.name}</div>
                {item.status === 'uploading' && (
                  <div className="upload-progress-bar"><div className="upload-progress-fill" style={{ width: `${item.progress}%` }} /></div>
                )}
                {item.status === 'completed' && <div className="status-text-success"><CheckCircleIcon/> Terminé</div>}
                {item.error && <div className="error-message">{item.error}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =================================================================
// COMPOSANT : VoiceNoteRecorder
// Enregistre une note vocale et l'envoie
// =================================================================
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
        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
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


// =================================================================
// VUE PRINCIPALE : InterventionDetailView
// =================================================================
export default function InterventionDetailView({ interventions, onSave, onSaveSilent, onUpdateStatus, isAdmin, dataVersion, refreshData }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeMediaTag, setActiveMediaTag] = useState('Avant');

  // --- Modales de validation ---
  const [cancelModal, setCancelModal] = useState({ open: false, reason: '', initials: '', agree: false });
  const [startModal, setStartModal] = useState({ open: false, initials: '', agree: false });
  const [resumeModal, setResumeModal] = useState({ open: false, initials: '', agree: false });
  const [closeModal, setCloseModal] = useState({ open: false, initials: '', agree: false });

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
      needs: Array.isArray(r.needs) ? r.needs.map(n=>({ id: n.id || `need-${Math.random().toString(36).slice(2)}`, label: n.label || '', qty: Number(n.qty)||1, urgent: !!n.urgent, note: n.note || '', category: n.category || 'materiel', estimated_price: numberOrNull(n.estimated_price), request_id: n.request_id || null })) : [],
      supply_requests: Array.isArray(r.supply_requests) ? r.supply_requests : [],
      quick_checkpoints: Array.isArray(r.quick_checkpoints) && r.quick_checkpoints.length > 0 ? r.quick_checkpoints : [
        { label:'Zone sécurisée', done:false, at:null }, { label:'Essais OK', done:false, at:null }, { label:'Brief client fait', done:false, at:null },
      ],
      blocks: r.blocks || { access:{ blocked:false, note:'', photos:[] }, power:{ blocked:false, note:'', photos:[] }, parts:{ blocked:false, note:'', photos:[] }, authorization:{ blocked:false, note:'', photos:[] } },
      parts_used: Array.isArray(r.parts_used) ? r.parts_used.map(p=>({ ref: p.ref || '', label: p.label || '', qty: Number(p.qty)||1, serial: p.serial || '', unit_price: numberOrNull(p.unit_price) })) : [],
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

  const persistReport = async (updated, field) => {
    setReport(updated);
    try {
        await onSaveSilent(intervention.id, updated, field);
    } catch (e) {
        console.error("Silent save failed:", e);
    }
  };

  const handleReportChange = (field, value) => {
      const updatedReport = { ...report, [field]: value };
      persistReport(updatedReport, field);
  };


  const currentStatus = intervention?.status || (report?.arrivalTime ? 'En cours' : 'Planifiée');

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
    if(onUpdateStatus) await onUpdateStatus(intervention.id, 'En cours');
    setStartModal({ open:false, initials:'', agree:false });
  };

  const openCancel = () => setCancelModal({ open: true, reason: '', initials: '', agree: false });
  const confirmCancel = async () => {
    const reason = cancelModal.reason?.trim();
    if (!reason || !cancelModal.initials.trim() || !cancelModal.agree) return;
    const now = new Date().toISOString();
    const tv = { ...(report.tech_validations||{}), cancel: { initials: cancelModal.initials.trim(), at: now, reason } };
    await persistReport({ ...report, cancel_reason: reason, tech_validations: tv });
    if(onUpdateStatus) await onUpdateStatus(intervention.id, 'Annulée', { cancel_reason: reason });
    setCancelModal({ open: false, reason: '', initials:'', agree:false });
  };

  const openCloseValidation = () => setCloseModal({ open: true, initials: '', agree: false });
  const confirmClose = async () => {
    if (!closeModal.initials.trim() || !closeModal.agree) return;
    const v = validateCanClose(); if (!v.ok) { alert(v.msg); return; }
    const now = new Date().toISOString();
    let departureGeo = null;
     try {
      if (navigator.geolocation) {
        departureGeo = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
            () => resolve(null), { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }
    } catch {}
    const tv = { ...(report.tech_validations||{}), close: { initials: closeModal.initials.trim(), at: now } };
    const updated = { ...report, departureTime: now, departureGeo, tech_validations: tv };
    setCloseModal({ open:false, initials:'', agree:false });
    setIsSaving(true);
    try {
        if(onSave) await onSave(intervention.id, updated);
    } finally {
        setIsSaving(false);
    }
  };


  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsOK = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.every(c=>!!c.done) : true;
    if (!report.signature) return { ok:false, msg:'Signature client manquante.' };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok:false, msg:`Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s).` };
    if (!checkpointsOK) return { ok:false, msg:'Tous les checkpoints rapides doivent être validés.' };
    return { ok:true };
  };

  const handleSaveAndClose = async () => {
      if (!intervention) return;
      const v = validateCanClose();
      if(!v.ok) {
          alert(v.msg);
          return;
      }
      openCloseValidation();
  };

  if (loading || !intervention || !report) return <div className="loading-container"><LoaderIcon className="animate-spin"/><p>Chargement…</p></div>;

  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n=>n.urgent).length : 0;
  const filteredFiles = useMemo(() => (report?.files||[]).filter(f => (activeMediaTag ? (f.tag||'Documents') === activeMediaTag : true)), [report?.files, activeMediaTag]);

  return (
    <div className="intervention-detail">
      <div className="quick-action-bar">
        <button className="qa-btn" onClick={openStartValidation} disabled={!!report.arrivalTime}><CheckCircle2Icon/> {report.arrivalTime ? 'Arrivée OK' : 'Arrivé'}</button>
        <button className="qa-btn" onClick={()=>{ document.getElementById('media-section')?.scrollIntoView({ behavior: 'smooth' }); setActiveMediaTag('En cours'); }}><CameraIcon/> Photo</button>
        <button className="qa-btn" onClick={()=>document.getElementById('need-input')?.focus()}>➕ Besoin</button>
        {currentStatus !== 'Annulée' && <button className="qa-btn danger" onClick={openCancel}><XCircleIcon/> Annuler</button>}
        <button className="qa-btn primary" onClick={handleSaveAndClose} disabled={isSaving}><PaperPlaneIcon/> Clôturer</button>
      </div>

      <button onClick={()=>navigate('/planning')} className="back-button"><ChevronLeftIcon/> Retour au planning</button>

      <div className="card-white">
        <div className="header-row">
          <div>
            <h2>{intervention.client}</h2>
            <p className="text-muted">{intervention.address}</p>
          </div>
          <div className="status-badges">
            <span className="badge">Statut : {currentStatus}</span>
            {urgentCount > 0 && <span className="badge-warning">URG {urgentCount}</span>}
          </div>
        </div>

        <div className="section">
          <h3>📝 Rapport de chantier</h3>
          <textarea value={report.notes||''} onBlur={(e) => handleReportChange('notes', e.target.value)} onChange={(e)=>setReport(prev=>({...prev, notes: e.target.value}))} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={!!isAdmin}/>
          <VoiceNoteRecorder interventionId={interventionId} onUploaded={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]), ...uploaded.map(u=>({...u, tag: 'Documents'}))]}; await persistReport(updated, 'files'); }}/>
        </div>

        <div className="section" id="media-section">
          <div className="section-header">
              <h3>📷 Médias</h3>
              <div className="tabs">
                  {MEDIA_TAGS.map(tag => (
                      <button key={tag} className={`tab ${activeMediaTag===tag?'active':''}`} onClick={()=>setActiveMediaTag(tag)}>{tag}</button>
                  ))}
              </div>
          </div>
          {filteredFiles.length > 0 ? (
              <div className="image-grid">
                  {filteredFiles.map((file,idx)=> (
                      <div key={`${file.url || idx}-${idx}`} className="image-grid-item">
                          {isImageUrl(file) ? <OptimizedImage src={file.url} alt={file.name} className="image-grid-thumb"/>
                          : file.type?.startsWith('audio/') ? <div className="file-thumb-placeholder"><MicIcon/></div>
                          : <div className="file-thumb-placeholder"><FileTextIcon/></div>}
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="download-icon" download={file.name}><DownloadIcon/></a>
                      </div>
                  ))}
              </div>
          ) : <p className="text-muted">Aucun média dans "{activeMediaTag}".</p>}
          <InlineUploader interventionId={interventionId} onUploadComplete={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]), ...uploaded.map(u=>({...u, tag: activeMediaTag}))]}; await persistReport(updated, 'files'); }}/>
        </div>

        <div className="section">
          <h3>✍️ Signature du client</h3>
          {report.signature ? (
            <div>
              <img src={report.signature} alt="Signature" className="signature-preview"/>
              <button onClick={()=>handleReportChange('signature',null)} className="btn btn-sm btn-secondary" style={{marginTop:8}}>Effacer</button>
            </div>
          ) : (
            <div>
              <canvas width="300" height="150" style={{border:'2px dashed #cbd5e1',borderRadius:'0.5rem',width:'100%',maxWidth:300,background:'#f8fafc'}}/>
              <div style={{marginTop:8}}><button onClick={()=>setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon/> Agrandir pour signer</button></div>
            </div>
          )}
        </div>

        <button onClick={handleSaveAndClose} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{fontSize:'1rem',padding:'1rem',fontWeight:600}}>{isSaving ? (<><LoaderIcon className="animate-spin"/> Sauvegarde...</>) : '🔒 Sauvegarder et Clôturer'}</button>
      </div>

      {showSignatureModal && <SignatureModal onSave={(sig)=>{handleReportChange('signature',sig); setShowSignatureModal(false);}} onCancel={()=>setShowSignatureModal(false)} existingSignature={report.signature}/>}

      {/* --- Modales de validation --- */}
      {startModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Valider l'arrivée</h3>
          <p className="text-muted">Vos initiales seront enregistrées avec l'heure et la géolocalisation.</p>
          <div className="validation-form">
              <input className="form-control" value={startModal.initials} onChange={(e)=>setStartModal(m=>({...m, initials: e.target.value.toUpperCase()}))} placeholder="Vos initiales (ex: AB)"/>
              <label className="checkbox"><input type="checkbox" checked={startModal.agree} onChange={(e)=>setStartModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme mon arrivée</span></label>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setStartModal({ open:false, initials:'', agree:false })}>Annuler</button>
            <button className="btn btn-primary" onClick={confirmStart} disabled={!startModal.initials.trim() || !startModal.agree}>Valider</button>
          </div>
        </div></div>
      )}
      {closeModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Clôturer l'intervention</h3>
          <p className="text-muted">Confirmez la clôture. Les validations seront vérifiées.</p>
           <div className="validation-form">
              <input className="form-control" value={closeModal.initials} onChange={(e)=>setCloseModal(m=>({...m, initials: e.target.value.toUpperCase()}))} placeholder="Vos initiales (ex: AB)"/>
              <label className="checkbox"><input type="checkbox" checked={closeModal.agree} onChange={(e)=>setCloseModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme la clôture</span></label>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setCloseModal({ open:false, initials:'', agree:false })}>Annuler</button>
            <button className="btn btn-primary" onClick={confirmClose} disabled={!closeModal.initials.trim() || !closeModal.agree}>Clôturer</button>
          </div>
        </div></div>
      )}
      {cancelModal.open && (
        <div className="modal-overlay"><div className="modal-content">
          <h3>Annuler l'intervention</h3>
          <p className="text-muted">Veuillez indiquer le motif d'annulation et valider.</p>
          <textarea className="form-control" rows={3} value={cancelModal.reason} onChange={(e)=>setCancelModal(m=>({...m, reason: e.target.value}))} placeholder="Motif obligatoire…" />
           <div className="validation-form" style={{marginTop: '1rem'}}>
              <input className="form-control" value={cancelModal.initials} onChange={(e)=>setCancelModal(m=>({...m, initials: e.target.value.toUpperCase()}))} placeholder="Vos initiales (ex: AB)"/>
              <label className="checkbox"><input type="checkbox" checked={cancelModal.agree} onChange={(e)=>setCancelModal(m=>({...m, agree: e.target.checked}))}/> <span>Je confirme l'annulation</span></label>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={()=>setCancelModal({ open:false, reason:'', initials:'', agree:false })}>Fermer</button>
            <button className="btn btn-danger" onClick={confirmCancel} disabled={!cancelModal.reason.trim() || !cancelModal.initials.trim() || !cancelModal.agree}>Confirmer</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
