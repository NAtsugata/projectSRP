// =============================
// FILE: src/pages/InterventionDetailView.js — SCROLL 100% STABILISÉ (mobile + iOS)
// - Lock body scroll pendant le choix / upload (caméra, fichiers)
// - Restaure exactement la position après persistance
// - N'écrase plus le report après l’init
// - 100% des fonctionnalités préservées
// =============================
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
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
} from '../components/SharedUI';
import { storageService } from '../lib/supabase';

const MIN_REQUIRED_PHOTOS = 2;

const isImageUrl = (f) => {
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u);
};
const numberOrNull = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

// -------- Format util --------
const fmtTime = (iso) => {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
  } catch { return '—'; }
};

// -------- Image lazy/optimisée --------
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

// -------- Signature en modal plein écran --------
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

// ====== Hook/Helpers: Body Scroll Lock (robuste iOS) ======
const useBodyScrollLock = () => {
  const savedYRef = useRef(0);
  const lockedRef = useRef(false);

  const lock = useCallback(() => {
    if (lockedRef.current) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    savedYRef.current = y;
    const body = document.body;
    body.dataset.__scrollLocked = '1';
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    lockedRef.current = true;
  }, []);

  const unlock = useCallback(() => {
    if (!lockedRef.current) return;
    const y = savedYRef.current || 0;
    const body = document.body;
    delete body.dataset.__scrollLocked;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    // Restaurer la position
    window.scrollTo(0, y);
    lockedRef.current = false;
  }, []);

  return { lock, unlock, isLocked: () => lockedRef.current };
};

// -------- Uploader inline (photos/docs) --------
const InlineUploader = ({ interventionId, onUploadComplete, folder='report', onBeginCritical, onEndCritical }) => {
  const [state, setState] = useState({ uploading:false, queue:[], error:null });
  const inputRef = useRef(null);
  const cancelUnlockTimerRef = useRef(null);

  const startCriticalWithFallback = useCallback(() => {
    onBeginCritical?.();
    // iOS : si l'utilisateur annule le picker, aucun "change" n'arrive.
    // On met un fallback pour débloquer au bout de 12s.
    cancelUnlockTimerRef.current && clearTimeout(cancelUnlockTimerRef.current);
    cancelUnlockTimerRef.current = setTimeout(() => {
      onEndCritical?.();
    }, 12000);
  }, [onBeginCritical, onEndCritical]);

  const clearCriticalFallback = useCallback(() => {
    cancelUnlockTimerRef.current && clearTimeout(cancelUnlockTimerRef.current);
    cancelUnlockTimerRef.current = null;
  }, []);

  const compressImage = useCallback(async(file)=>{
    if(!file.type.startsWith('image/')) return file;
    return new Promise(res=>{
      const c=document.createElement('canvas');const ctx=c.getContext('2d');const img=new Image();
      img.onload=()=>{let {width,height}=img;const MW=1280,MH=720;
        if(width>height){if(width>MW){height*=MW/width;width=MW;}}
        else{if(height>MH){width*=MH/height;height=MH;}}
        c.width=width;c.height=height;ctx.drawImage(img,0,0,width,height);
        c.toBlob(b=>res(b?new File([b],file.name,{type:'image/jpeg',lastModified:Date.now()}):file),'image/jpeg',0.8);
      };
      img.onerror=()=>res(file);
      img.src=URL.createObjectURL(file);
    });
  },[]);

  const onChange = useCallback(async(e)=>{
    clearCriticalFallback(); // le picker a rendu la main
    const files = Array.from(e.target.files||[]);
    // Débloquer tout de suite si rien n'a été choisi (annulation)
    if (!files.length) { onEndCritical?.(); if(inputRef.current) inputRef.current.value=''; return; }

    if(inputRef.current) inputRef.current.value='';
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
    if(uploaded.length){
      try{ await onUploadComplete(uploaded); }catch(err){ setState(s=>({...s,error:"La sauvegarde des fichiers a échoué."})); }
    }
    setState(s=>({...s,uploading:false}));
    onEndCritical?.(); // fin de la phase critique
  },[compressImage,interventionId,onUploadComplete,onEndCritical,clearCriticalFallback]);

  return (
    <div className="mobile-uploader-panel">
      <input
        ref={inputRef}
        type="file"
        multiple
        // Ouvre directement la caméra sur mobile si possible
        accept="image/*,application/pdf,audio/webm"
        capture="environment"
        onChange={onChange}
        disabled={state.uploading}
        style={{display:'none'}}
      />
      <button
        onClick={()=>{
          startCriticalWithFallback();
          inputRef.current?.click();
        }}
        className={`btn btn-secondary w-full flex-center ${state.uploading?'disabled':''}`}
        disabled={state.uploading}
      >
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

// -------- Enregistrement note vocale --------
const VoiceNoteRecorder = ({ onUploaded, interventionId, onBeginCritical, onEndCritical }) => {
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
        try {
          onBeginCritical?.();
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `note-${Date.now()}.webm`, { type: 'audio/webm' });
          const res = await storageService.uploadInterventionFile(file, interventionId, 'voice', ()=>{});
          const publicUrl = res.publicURL?.publicUrl || res.publicURL;
          await onUploaded([{ name: file.name, url: publicUrl, type: file.type }]);
        } finally {
          onEndCritical?.();
        }
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

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, dataVersion, refreshData }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === Scroll locks + restauration ===
  const { lock, unlock } = useBodyScrollLock();
  const scrollerRef = useRef(null);
  const savedScrollRef = useRef(0);
  const pendingRestoreRef = useRef(false);

  const getScroller = () => document.scrollingElement || document.documentElement;

  const saveScroll = useCallback(() => {
    scrollerRef.current = getScroller();
    savedScrollRef.current = scrollerRef.current.scrollTop || window.scrollY || 0;
  }, []);

  const restoreScroll = useCallback(() => {
    if (!scrollerRef.current) scrollerRef.current = getScroller();
    const y = savedScrollRef.current || 0;
    scrollerRef.current.scrollTop = y;
    // en plus, pour iOS Safari :
    window.scrollTo(0, y);
  }, []);

  useLayoutEffect(() => {
    if (pendingRestoreRef.current) {
      // Restaurer sur plusieurs frames pour contrer les relayouts iOS
      restoreScroll();
      requestAnimationFrame(()=>restoreScroll());
      setTimeout(()=>restoreScroll(), 0);
      setTimeout(()=>restoreScroll(), 50);
      pendingRestoreRef.current = false;
    }
  });

  // Harmonise le schéma du report
  const ensureReportSchema = useCallback((base)=>{
    const r = base || {};
    return {
      notes: r.notes || '',
      files: Array.isArray(r.files) ? r.files : [],
      arrivalTime: r.arrivalTime || null,
      departureTime: r.departureTime || null,
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
      quick_checkpoints: Array.isArray(r.quick_checkpoints) ? r.quick_checkpoints.every?.(c=>typeof c==='object') ? r.quick_checkpoints : [
        { label:'Zone sécurisée', done:false, at:null },
        { label:'Essais OK', done:false, at:null },
        { label:'Brief client fait', done:false, at:null },
      ] : [
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
      arrivalGeo: r.arrivalGeo || null,
      departureGeo: r.departureGeo || null,
      rating: r.rating || null,
      follow_up_required: !!r.follow_up_required,
      parts_used: Array.isArray(r.parts_used) ? r.parts_used : [],
    };
  },[]);

  useEffect(() => {
    const found = interventions.find(i => String(i.id) === String(interventionId));
    if (found) {
      setIntervention(found);
      // ⬇️ Initialiser le report une seule fois pour éviter l'écrasement après upload
      setReport(prev => prev ?? ensureReportSchema(found.report));
      setLoading(false);
    } else if (interventions.length>0) {
      navigate('/planning');
    }
  }, [interventions, interventionId, navigate, dataVersion, ensureReportSchema]);

  // Persistance *directement* du report avec stabilisation + lock
  const persistReport = async (updated) => {
    // Geler position + body (évite remontée iOS après retour du picker)
    saveScroll();
    pendingRestoreRef.current = true;
    if (!document.body.dataset.__scrollLocked) lock();

    setReport(updated);
    try {
      const res = await onSaveSilent(intervention.id, updated);
      if (res?.error) alert('Échec de la sauvegarde du rapport');
    } catch (e) {
      console.error(e);
      alert('Échec de la sauvegarde du rapport');
    } finally {
      // Restaure le body + position
      unlock();
      // (pendingRestoreRef fera le reste dans useLayoutEffect)
      // double sécurité immédiate :
      restoreScroll();
    }
  };

  const handleReportChange = (field, value) => setReport(prev=>({...prev,[field]:value}));

  // -------- Besoins --------
  const [needDraft, setNeedDraft] = useState({ label:'', qty:1, urgent:false, note:'', category:'materiel', estimated_price:'' });
  const [needsOpen, setNeedsOpen] = useState(true);
  const needsTotal = Array.isArray(report?.needs) ? report.needs.reduce((sum,n)=> sum + (Number(n.estimated_price)||0), 0) : 0;

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

  // -------- Arrivé / Départ (nouveau) --------
  const markWithGeo = useCallback(async (kind) => {
    const isArrival = kind === 'arrival';
    const nowIso = new Date().toISOString();

    // Early guard UI : départ ne peut pas précéder l'arrivée
    if (!isArrival && report?.arrivalTime) {
      try {
        const arr = new Date(report.arrivalTime).getTime();
        const dep = new Date(nowIso).getTime();
        if (dep < arr) { alert("L'heure de départ ne peut pas précéder l'arrivée."); return; }
      } catch {}
    }

    // Lock le body pendant la phase géoloc + persistance (mobile peut sauter)
    saveScroll(); pendingRestoreRef.current = true; if (!document.body.dataset.__scrollLocked) lock();

    const finalize = async (updated, msg) => {
      await persistReport(updated); // persistReport gère déjà unlock + restore
      if (msg) alert(msg);
    };

    if (!('geolocation' in navigator)) {
      const updated = {
        ...report,
        [isArrival ? 'arrivalTime' : 'departureTime']: nowIso,
        [isArrival ? 'arrivalGeo' : 'departureGeo']: null,
      };
      await finalize(updated, 'Géolocalisation indisponible. Heure enregistrée.');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords || {};
      const geo = { lat: latitude, lng: longitude, acc: accuracy };
      const updated = {
        ...report,
        [isArrival ? 'arrivalTime' : 'departureTime']: nowIso,
        [isArrival ? 'arrivalGeo' : 'departureGeo']: geo,
      };
      await finalize(updated);
    }, async () => {
      const updated = {
        ...report,
        [isArrival ? 'arrivalTime' : 'departureTime']: nowIso,
        [isArrival ? 'arrivalGeo' : 'departureGeo']: null,
      };
      await finalize(updated, 'Géolocalisation refusée. Heure enregistrée sans position.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }, [report, lock, saveScroll, persistReport]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- Validation & sauvegarde --------
  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsOK = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.every(c=>!!c.done) : true;
    if (!report.signature) return { ok:false, msg:'Signature client manquante.' };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok:false, msg:`Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s).` };
    if (!checkpointsOK) return { ok:false, msg:'Tous les checkpoints rapides doivent être validés.' };
    return { ok:true };
  };

  const handleSave = async () => {
    if (!intervention) return;
    const v = validateCanClose(); if(!v.ok) { alert(v.msg); return; }
    setIsSaving(true);
    try { await onSave(intervention.id, { ...report }); }
    finally { setIsSaving(false); }
  };

  if (loading || !intervention || !report) return <div className="loading-container"><LoaderIcon className="animate-spin"/><p>Chargement…</p></div>;

  const currentStatus = intervention.status || (report.arrivalTime ? 'En cours' : 'À venir');
  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n=>n.urgent).length : 0;

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

        {/* Arrivé / Départ */}
        <div className="section">
          <h3>⏱️ Temps sur site</h3>
          <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
            <div className="card-slim">
              <div className="text-muted" style={{marginBottom:4}}>Arrivé sur site</div>
              <div className="flex items-center justify-between" style={{gap:8}}>
                <div><b>{fmtTime(report.arrivalTime)}</b></div>
                <button className="btn btn-secondary" disabled={!!report.arrivalTime} onClick={()=>markWithGeo('arrival')}>
                  {report.arrivalTime? 'Déjà enregistré' : 'Marquer l\'arrivée'}
                </button>
              </div>
              {report.arrivalGeo && (
                <div className="text-muted" style={{fontSize:'0.85rem',marginTop:4}}>lat {report.arrivalGeo.lat?.toFixed?.(5)} · lng {report.arrivalGeo.lng?.toFixed?.(5)} (±{Math.round(report.arrivalGeo.acc||0)} m)</div>
              )}
            </div>
            <div className="card-slim">
              <div className="text-muted" style={{marginBottom:4}}>Départ du site</div>
              <div className="flex items-center justify-between" style={{gap:8}}>
                <div><b>{fmtTime(report.departureTime)}</b></div>
                <button className="btn btn-secondary" disabled={!!report.departureTime || !report.arrivalTime} onClick={()=>markWithGeo('departure')}>
                  {report.departureTime? 'Déjà enregistré' : (!report.arrivalTime? 'Attente arrivée' : 'Marquer le départ')}
                </button>
              </div>
              {report.departureGeo && (
                <div className="text-muted" style={{fontSize:'0.85rem',marginTop:4}}>lat {report.departureGeo.lat?.toFixed?.(5)} · lng {report.departureGeo.lng?.toFixed?.(5)} (±{Math.round(report.departureGeo.acc||0)} m)</div>
              )}
            </div>
          </div>
        </div>

        {/* Rapport */}
        <div className="section">
          <h3>📝 Rapport de chantier</h3>
          <textarea value={report.notes||''} onChange={e=>handleReportChange('notes', e.target.value)} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={!!isAdmin}/>
          <VoiceNoteRecorder
            interventionId={interventionId}
            onUploaded={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]), ...uploaded]}; await persistReport(updated); }}
            onBeginCritical={lock}
            onEndCritical={unlock}
          />
        </div>

        {/* Besoins */}
        <div className="section">
          <div className="flex items-center justify-between" onClick={() => setNeedsOpen(o=>!o)} style={{cursor:'pointer', userSelect:'none'}}>
            <h3 className="flex items-center gap-2" style={{margin:0}}>
              <span style={{display:'inline-block', width:18, textAlign:'center'}}>{needsOpen ? '▼' : '▶'}</span>
              🧰 Besoins chantier {Array.isArray(report.needs) ? `(${report.needs.length})` : ''}
            </h3>
            <div className="text-muted">Budget estimé: <b>{needsTotal.toFixed(2)} €</b></div>
          </div>

          {needsOpen && (
            <div>
              {(!report.needs || report.needs.length===0) && <p className="text-muted" style={{marginTop:'0.5rem'}}>Aucun besoin pour le moment.</p>}

              {Array.isArray(report.needs) && report.needs.length>0 && (
                <ul className="document-list" style={{marginTop:'0.5rem'}}>
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

              <div className="grid" style={{gridTemplateColumns:'160px 80px 120px 1fr 140px auto', gap:'0.5rem', alignItems:'end', marginTop:'0.75rem'}}>
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
            </div>
          )}
        </div>

        {/* Photos & docs */}
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
          <InlineUploader interventionId={interventionId} onUploadComplete={async(uploaded)=>{ const updated={...report, files:[...(report.files||[]),...uploaded]}; await persistReport(updated); }}/>
        </div>

        {/* Signature */}
        <div className="section">
          <h3>✍️ Signature du client</h3>
          {report.signature ? (
            <div>
              <img src={report.signature} alt="Signature" style={{width:'100%',maxWidth:300,border:'2px solid #e5e7eb',borderRadius:'0.5rem',background:'#f8f9fa'}}/>
              <button onClick={()=>handleReportChange('signature',null)} className="btn btn-sm btn-secondary" style={{marginTop:8}}>Effacer</button>
            </div>
          ) : (
            <div>
              <canvas width="300" height="150" style={{border:'2px dashed #cbd5e1',borderRadius:'0.5rem',width:'100%',maxWidth:300,background:'#f8fafc'}}/>
              <div style={{marginTop:8}}><button onClick={()=>setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon/> Agrandir</button></div>
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{fontSize:'1rem',padding:'1rem',fontWeight:600}}>{isSaving ? (<><LoaderIcon className="animate-spin"/> Sauvegarde...</>) : '🔒 Sauvegarder et Clôturer'}</button>
      </div>

      {/* Modale signature */}
      {showSignatureModal && <SignatureModal onSave={(sig)=>{handleReportChange('signature',sig); setShowSignatureModal(false);}} onCancel={()=>setShowSignatureModal(false)} existingSignature={report.signature}/>}
    </div>
  );
}
