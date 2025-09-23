// =============================
// FILE: src/pages/InterventionDetailView.js — FULL (persist OK)
// - persistReport() transmet *directement* le report à onSaveSilent
// - plus de clignotement, besoins et notes restent
// =============================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, DownloadIcon, FileTextIcon, LoaderIcon, ExpandIcon, RefreshCwIcon, XCircleIcon, CheckCircleIcon, AlertTriangleIcon, MicIcon, StopCircleIcon } from '../components/SharedUI';
import { storageService } from '../lib/supabase';

const MIN_REQUIRED_PHOTOS = 2; // ajustable

const isImageUrl = (f) => {
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?)($|\?)/i.test(u);
};
const numberOrNull = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

const OptimizedImage = ({ src, alt, className, style }) => {
  const [loadState, setLoadState] = useState('loading');
  const imgRef = useRef(null);
  useEffect(() => {
    if (!src || typeof src !== 'string') {
      setLoadState('error');
      return;
    }
    const img = new Image();
    img.onload = () => setLoadState('loaded');
    img.onerror = () => setLoadState('error');
    if ('IntersectionObserver' in window && imgRef.current) {
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            img.src = src;
            obs.disconnect();
          }
        },
        { rootMargin: '50px' }
      );
      obs.observe(imgRef.current);
      return () => obs.disconnect();
    } else {
      img.src = src;
    }
  }, [src]);
  if (loadState === 'loading')
    return (
      <div
        ref={imgRef}
        className={className}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}
      >
        <LoaderIcon className="animate-spin" />
      </div>
    );
  if (loadState === 'error')
    return (
      <div
        className={className}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', color: '#dc2626' }}
      >
        <XCircleIcon />
      </div>
    );
  return <img ref={imgRef} src={src} alt={alt} className={className} style={{ ...style, display: 'block' }} loading="lazy" />;
};

const SignatureModal = ({ onSave, onCancel, existingSignature }) => {
  const canvasRef = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isMobile = window.innerWidth < 768;
    canvas.width = Math.min(window.innerWidth * 0.9, 600);
    canvas.height = isMobile ? window.innerHeight * 0.5 : 300;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = existingSignature;
    }
    let drawing = false,
      last = null;
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const ex = e.touches ? e.touches[0].clientX : e.clientX;
      const ey = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (ex - r.left) * (canvas.width / r.width), y: (ey - r.top) * (canvas.height / r.height) };
    };
    const start = (e) => {
      e.preventDefault();
      drawing = true;
      setHasDrawn(true);
      last = getPos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
    };
    const stop = (e) => {
      e.preventDefault();
      drawing = false;
      last = null;
    };
    const draw = (e) => {
      if (!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      if (last) {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      last = p;
    };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchend', stop, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseleave', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchend', stop);
      canvas.removeEventListener('touchmove', draw);
    };
  }, [existingSignature]);
  return (
    <div className="modal-overlay">
      <div className="modal-content signature-modal-content">
        <h3>✍️ Signature du client</h3>
        <canvas ref={canvasRef} className="signature-canvas-fullscreen" />
        <div className="modal-footer" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => {
              const c = canvasRef.current;
              if (c) {
                c.getContext('2d').clearRect(0, 0, c.width, c.height);
              }
            }}
            className="btn btn-secondary"
          >
            Effacer
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Annuler
          </button>
          <button type="button" onClick={() => onSave(canvasRef.current.toDataURL('image/png'))} className="btn btn-primary" disabled={!hasDrawn}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
};

const InlineUploader = ({ interventionId, onUploadComplete, folder = 'report' }) => {
  const [state, setState] = useState({ uploading: false, queue: [], error: null });
  const inputRef = useRef(null);
  const compressImage = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((res) => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const MW = 1280,
          MH = 720;
        if (width > height) {
          if (width > MW) {
            height *= MW / width;
            width = MW;
          }
        } else {
          if (height > MH) {
            width *= MH / height;
            height = MH;
          }
        }
        c.width = width;
        c.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        c.toBlob((b) => res(b ? new File([b], file.name, { type: 'image/jpeg', lastModified: Date.now() }) : file), 'image/jpeg', 0.8);
      };
      img.onerror = () => res(file);
      img.src = URL.createObjectURL(file);
    });
  }, []);
  const onChange = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || []);
      if (inputRef.current) inputRef.current.value = '';
      if (!files.length) return;
      const queue = files.map((f, i) => ({ id: `${f.name}-${Date.now()}-${i}`, name: f.name, status: 'pending', progress: 0, error: null }));
      setState({ uploading: true, queue, error: null });
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const fu = await compressImage(files[i]);
          const result = await storageService.uploadInterventionFile(fu, interventionId, folder, (p) => {
            setState((s) => ({ ...s, queue: s.queue.map((it, idx) => (idx === i ? { ...it, status: 'uploading', progress: p } : it)) }));
          });
          if (result.error) throw result.error;
          const publicUrl = result.publicURL?.publicUrl || result.publicURL;
          if (typeof publicUrl !== 'string') throw new Error('URL de fichier invalide');
          uploaded.push({ name: files[i].name, url: publicUrl, type: files[i].type });
          setState((s) => ({ ...s, queue: s.queue.map((it, idx) => (idx === i ? { ...it, status: 'completed', progress: 100 } : it)) }));
        } catch (err) {
          setState((s) => ({ ...s, queue: s.queue.map((it, idx) => (idx === i ? { ...it, status: 'error', error: String(err.message || err) } : it)) }));
        }
      }
      if (uploaded.length) {
        try {
          await onUploadComplete(uploaded);
        } catch (err) {
          setState((s) => ({ ...s, error: 'La sauvegarde des fichiers a échoué.' }));
        }
      }
      setState((s) => ({ ...s, uploading: false }));
    },
    [compressImage, interventionId, onUploadComplete]
  );
  return (
    <div className="mobile-uploader-panel">
      <input ref={inputRef} type="file" multiple accept="image/*,application/pdf,audio/webm" onChange={onChange} disabled={state.uploading} style={{ display: 'none' }} />
      <button onClick={() => inputRef.current?.click()} className={`btn btn-secondary w-full flex-center ${state.uploading ? 'disabled' : ''}`} disabled={state.uploading}>
        {state.uploading ? 'Envoi en cours…' : 'Choisir des fichiers'}
      </button>
      {state.queue.length > 0 && (
        <div className="upload-queue-container">
          {state.queue.map((item) => (
            <div key={item.id} className={`upload-queue-item status-${item.status}`}>
              <div style={{ width: 24, flexShrink: 0 }}>
                {item.status === 'uploading' && <LoaderIcon className="animate-spin" />}
                {item.status === 'completed' && <CheckCircleIcon style={{ color: '#16a34a' }} />}
                {item.status === 'error' && <AlertTriangleIcon style={{ color: '#dc2626' }} />}
              </div>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div className="file-name">{item.name}</div>
                {item.status === 'uploading' && (
                  <div className="upload-progress-bar">
                    <div className="upload-progress-fill" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
                {item.error && <div className="error-message">{item.error}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VoiceNoteRecorder = ({ onUploaded, interventionId }) => {
  const [rec, setRec] = useState(null);
  const [recording, setRecording] = useState(false);
  const chunksRef = useRef([]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mediaRec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mediaRec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `note-${Date.now()}.webm`, { type: 'audio/webm' });
        const res = await storageService.uploadInterventionFile(file, interventionId, 'voice', () => {});
        const publicUrl = res.publicURL?.publicUrl || res.publicURL;
        await onUploaded([{ name: file.name, url: publicUrl, type: file.type }]);
      };
      mediaRec.start();
      setRec(mediaRec);
      setRecording(true);
    } catch (e) {
      alert('Micro non disponible: ' + e.message);
    }
  };
  const stop = () => {
    try {
      rec?.stop();
      setRecording(false);
    } catch (e) {}
  };
  return (
    <div className="flex items-center gap-2" style={{ marginTop: '0.5rem' }}>
      {!recording ? (
        <button className="btn btn-secondary" onClick={start}>
          <span style={{ marginRight: 6 }}>🎙️</span> Enregistrer une note
        </button>
      ) : (
        <button className="btn btn-danger" onClick={stop}>
          <span style={{ marginRight: 6 }}>⏹️</span> Stop
        </button>
      )}
    </div>
  );
};

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, dataVersion, refreshData }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  thedule
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const ensureReportSchema = useCallback((base) => {
    const r = base || {};
    return {
      notes: r.notes || '',
      files: Array.isArray(r.files) ? r.files : [],
      arrivalTime: r.arrivalTime || null,
      departureTime: r.departureTime || null,
      signature: r.signature || null,
      needs: Array.isArray(r.needs)
        ? r.needs.map((n) => ({
            id: n.id || `need-${Math.random().toString(36).slice(2)}`,
            label: n.label || '',
            qty: Number(n.qty) || 1,
            urgent: !!n.urgent,
            note: n.note || '',
            category: n.category || 'materiel',
            estimated_price: numberOrNull(n.estimated_price),
            request_id: n.request_id || null
          }))
        : [],
      supply_requests: Array.isArray(r.supply_requests) ? r.supply_requests : [],
      quick_checkpoints: Array.isArray(r.quick_checkpoints)
        ? r.quick_checkpoints
        : [
            { label: 'Zone sécurisée', done: false, at: null },
            { label: 'Essais OK', done: false, at: null },
            { label: 'Brief client fait', done: false, at: null }
          ],
      blocks: r.blocks || {
        access: { blocked: false, note: '', photos: [] },
        power: { blocked: false, note: '', photos: [] },
        parts: { blocked: false, note: '', photos: [] },
        authorization: { blocked: false, note: '', photos: [] }
      },
      arrivalGeo: r.arrivalGeo || null,
      departureGeo: r.departureGeo || null,
      rating: r.rating || null,
      follow_up_required: !!r.follow_up_required
    };
  }, []);

  useEffect(() => {
    const found = interventions.find((i) => String(i.id) === String(interventionId));
    if (found) {
      setIntervention(found);
      setReport(ensureReportSchema(found.report));
      setAdminNotes(found.admin_notes || '');
      setLoading(false);
    } else if (interventions.length > 0) {
      navigate('/planning');
    }
  }, [interventions, interventionId, navigate, dataVersion, ensureReportSchema]);

  // ✅ Persistance sans wrapper { report: ... }
  const persistReport = async (updated) => {
    setReport(updated);
    try {
      const res = await onSaveSilent(intervention.id, updated);
      if (res?.error) alert("Échec de la sauvegarde du rapport");
    } catch (e) {
      console.error(e);
      alert('Échec de la sauvegarde du rapport');
    }
  };

  const handleReportChange = (field, value) => setReport((prev) => ({ ...prev, [field]: value }));

  const [needDraft, setNeedDraft] = useState({ label: '', qty: 1, urgent: false, note: '', category: 'materiel', estimated_price: '' });
  const needsTotal = Array.isArray(report?.needs) ? report.needs.reduce((sum, n) => sum + (Number(n.estimated_price) || 0), 0) : 0;

  const addNeed = async () => {
    if (!needDraft.label.trim()) return;
    const item = {
      ...needDraft,
      id: `need-${Date.now()}`,
      qty: Math.max(1, Number(needDraft.qty) || 1),
      estimated_price: numberOrNull(needDraft.estimated_price),
      request_id: null
    };
    const updated = { ...report, needs: [...(report.needs || []), item] };
    await persistReport(updated);
    setNeedDraft({ label: '', qty: 1, urgent: false, note: '', category: 'materiel', estimated_price: '' });
  };
  const removeNeed = async (id) => {
    const updated = { ...report, needs: (report.needs || []).filter((n) => n.id !== id) };
    await persistReport(updated);
  };

  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsOK = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.every((c) => !!c.done) : true;
    if (!report.signature) return { ok: false, msg: `Signature client manquante.` };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok: false, msg: `Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s).` };
    if (!checkpointsOK) return { ok: false, msg: `Tous les checkpoints rapides doivent être validés.` };
    return { ok: true };
  };

  const handleSave = async () => {
    if (!intervention) return;
    const v = validateCanClose();
    if (!v.ok) {
      alert(v.msg);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(intervention.id, { ...report }); // onSave attend le report, App.js wrappera
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A');
  if (loading || !intervention || !report)
    return (
      <div className="loading-container">
        <LoaderIcon className="animate-spin" />
        <p>Chargement…</p>
      </div>
    );
  const currentStatus = intervention.status || (report.arrivalTime ? 'En cours' : 'À venir');
  const urgentCount = Array.isArray(report.needs) ? report.needs.filter((n) => n.urgent).length : 0;

  return (
    <div>
      <button onClick={() => navigate('/planning')} className="back-button">
        <ChevronLeftIcon /> Retour
      </button>
      <div className="card-white">
        <h2>{intervention.client}</h2>
        <p className="text-muted">{intervention.address}</p>

        <div className="section">
          <h3>⚑ Statut de l'intervention</h3>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span className="badge">Statut actuel : {currentStatus}</span>
            {urgentCount > 0 && (
              <span className="badge" style={{ background: '#f59e0b', color: '#111827' }}>
                URG {urgentCount}
              </span>
            )}
          </div>
        </div>

        <div className="section">
          <h3>📝 Rapport de chantier</h3>
          <textarea
            value={report.notes || ''}
            onChange={(e) => handleReportChange('notes', e.target.value)}
            placeholder="Détails, matériel, observations..."
            rows="5"
            className="form-control"
          />
          <VoiceNoteRecorder
            interventionId={interventionId}
            onUploaded={async (uploaded) => {
              const updated = { ...report, files: [...(report.files || []), ...uploaded] };
              await persistReport(updated);
            }}
          />
        </div>

        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <h3>🧰 Besoins chantier</h3>
            <div className="text-muted">
              Budget estimé: <b>{needsTotal.toFixed(2)} €</b>
            </div>
          </div>
          {(!report.needs || report.needs.length === 0) && <p className="text-muted">Aucun besoin pour le moment.</p>}
          {Array.isArray(report.needs) && report.needs.length > 0 && (
            <ul className="document-list">
              {report.needs.map((n) => (
                <li key={n.id}>
                  <div style={{ flexGrow: 1 }}>
                    <p className="font-semibold">
                      [{n.category || '—'}] {n.label}
                      {n.qty ? ` × ${n.qty}` : ''}{' '}
                      {n.urgent ? <span className="badge" style={{ marginLeft: 8 }}>Urgent</span> : null}
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                      {n.note || '—'} {typeof n.estimated_price === 'number' ? ` • Estimé: ${n.estimated_price.toFixed(2)} €` : ''}
                    </p>
                  </div>
                  <button className="btn-icon-danger" onClick={() => removeNeed(n.id)} title="Supprimer">
                    ✖
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid" style={{ gridTemplateColumns: '160px 80px 120px 1fr 140px auto', gap: '0.5rem', alignItems: 'end' }}>
            <div>
              <label>Catégorie</label>
              <select className="form-control" value={needDraft.category} onChange={(e) => setNeedDraft((v) => ({ ...v, category: e.target.value }))}>
                <option value="materiel">Matériel</option>
                <option value="consommables">Consommables</option>
                <option value="location">Location</option>
                <option value="commande">Commande</option>
              </select>
            </div>
            <div>
              <label>Qté</label>
              <input type="number" min={1} className="form-control" value={needDraft.qty} onChange={(e) => setNeedDraft((v) => ({ ...v, qty: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div>
              <label>Urgent ?</label>
              <select className="form-control" value={needDraft.urgent ? '1' : '0'} onChange={(e) => setNeedDraft((v) => ({ ...v, urgent: e.target.value === '1' }))}>
                <option value="0">Non</option>
                <option value="1">Oui</option>
              </select>
            </div>
            <div>
              <label>Intitulé</label>
              <input className="form-control" value={needDraft.label} onChange={(e) => setNeedDraft((v) => ({ ...v, label: e.target.value }))} placeholder="Ex: Tuyau 16mm" />
            </div>
            <div>
              <label>Prix estimé (€)</label>
              <input className="form-control" value={needDraft.estimated_price} onChange={(e) => setNeedDraft((v) => ({ ...v, estimated_price: e.target.value }))} placeholder="ex: 25.90" />
            </div>
            <div>
              <label>Note</label>
              <input className="form-control" value={needDraft.note} onChange={(e) => setNeedDraft((v) => ({ ...v, note: e.target.value }))} placeholder="Détail, lien, réf…" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn btn-primary" onClick={addNeed} disabled={!needDraft.label.trim()}>
                Ajouter
              </button>
            </div>
          </div>
        </div>

        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>📷 Photos et Documents</h3>
            <button onClick={refreshData} className="btn-icon" title="Rafraîchir">
              <RefreshCwIcon />
            </button>
          </div>
          {report.files?.length > 0 ? (
            <ul className="document-list-optimized" style={{ marginBottom: '1rem' }}>
              {report.files.map((file, idx) => (
                <li key={`${file.url || idx}-${idx}`} className="document-item-optimized">
                  {file.type?.startsWith('image/') ? (
                    <OptimizedImage src={file.url} alt={file.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '0.25rem' }} />
                  ) : file.type?.startsWith('audio/') ? (
                    <div style={{ width: 40 }}>
                      <audio controls src={file.url} style={{ height: 32 }} />
                    </div>
                  ) : (
                    <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9ecef', borderRadius: '0.25rem' }}>
                      <FileTextIcon />
                    </div>
                  )}
                  <span className="file-name">{file.name}</span>
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" download={file.name}>
                    <DownloadIcon />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Aucun fichier pour le moment.</p>
          )}
          <InlineUploader
            interventionId={interventionId}
            onUploadComplete={async (uploaded) => {
              const updated = { ...report, files: [...(report.files || []), ...uploaded] };
              await persistReport(updated);
            }}
          />
        </div>

        <div className="section">
          <h3>✍️ Signature du client</h3>
          {report.signature ? (
            <div>
              <img
                src={report.signature}
                alt="Signature"
                style={{ width: '100%', maxWidth: 300, border: '2px solid #e5e7eb', borderRadius: '0.5rem', background: '#f8f9fa' }}
              />
              <button onClick={() => handleReportChange('signature', null)} className="btn btn-sm btn-secondary" style={{ marginTop: 8 }}>
                Effacer
              </button>
            </div>
          ) : (
            <div>
              <canvas width="300" height="150" style={{ border: '2px dashed #cbd5e1', borderRadius: '0.5rem', width: '100%', maxWidth: 300, background: '#f8fafc' }} />
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary">
                  <ExpandIcon /> Agrandir
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{ fontSize: '1rem', padding: '1rem', fontWeight: 600 }}>
          {isSaving ? (
            <>
              <LoaderIcon className="animate-spin" /> Sauvegarde...
            </>
          ) : (
            '🔒 Sauvegarder et Clôturer'
          )}
        </button>
      </div>

      {showSignatureModal && (
        <SignatureModal
          onSave={(sig) => {
            handleReportChange('signature', sig);
            setShowSignatureModal(false);
          }}
          onCancel={() => setShowSignatureModal(false)}
          existingSignature={report.signature}
        />
      )}
    </div>
  );
}