// =============================
// FILE: src/pages/InterventionDetailView.js — REFACTORÉ
// Utilise les composants extraits pour une meilleure maintenabilité
// =============================
import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DownloadIcon,
  FileTextIcon,
  LoaderIcon,
  ExpandIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
} from '../components/SharedUI';
import { storageService } from '../lib/supabase';
import {
  ImageGalleryOptimized,
  SmartAlerts,
  TimeTrackerEnhanced,
  ScheduledDatesEditor,
  SignatureModal,
  FileUploader,
  VoiceRecorder,
  DictationButton,
  ArrivalDeparture,
} from '../components/intervention';
import InterventionLots from '../components/intervention/InterventionLots';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import CerfaGeneratorModal from '../components/CerfaGeneratorModal';
import ReceptionForm from '../components/ReceptionForm';
import { EditTeamModal } from '../components/planning';
import { prepareCerfaDataFromIntervention } from '../utils/cerfaService';
import { isImageFile, normalizeFileEntry } from '../utils/reportHelpers';
import { debounce } from '../utils/debounce';
import logger from '../utils/logger';
import './InterventionDetailView_Modern.css';

const MIN_REQUIRED_PHOTOS = 2;

// Prédicat image PARTAGÉ (compteur, galerie, SmartAlerts, validation de
// clôture utilisent la même source — voir utils/reportHelpers).
const isImageUrl = isImageFile;
const numberOrNull = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

// -------- Anti-cache pour forcer l'affichage immédiat --------
const withCacheBust = (url) => {
  if (!url || typeof url !== 'string') return url;
  const sep = url.includes('?') ? '&' : '?';
  const cacheBusted = `${url}${sep}v=${Date.now()}&r=${Math.random().toString(36).substring(7)}`;
  logger.log('🖼️ Cache-bust URL:', cacheBusted);
  return cacheBusted;
};

// -------- Format util --------
const fmtTime = (iso) => {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch { return '—'; }
};

// SignatureModal et useBodyScrollLock sont maintenant importés depuis leurs modules dédiés

// InlineUploader et VoiceNoteRecorder remplacés par FileUploader et VoiceRecorder importés

// ─── Ligne d'info structurée ──────────────────────────────────────────────────
function InfoRow({ icon, label, children }) {
  if (!children) return null;
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      padding: '0.6rem 0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {children}
      </span>
    </div>
  );
}

// ─── Modal d'édition de l'intervention (admin uniquement) ─────────────────────

function EditInterventionModal({ intervention, onSave, onClose, isOpen }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && intervention) {
      setForm({
        client:           intervention.client           || '',
        address:          intervention.address          || '',
        service:          intervention.service          || '',
        date:             intervention.date             || '',
        time:             intervention.time             || '',
        client_phone:     intervention.client_phone     || '',
        secondary_phone:  intervention.secondary_phone  || '',
        client_email:     intervention.client_email     || '',
        ticket_number:    intervention.ticket_number    || '',
        km_start:         intervention.km_start != null ? String(intervention.km_start) : '',
      });
    }
  }, [isOpen, intervention]);

  if (!isOpen) return null;

  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client.trim() || !form.service.trim() || !form.date) return;
    setSaving(true);
    try {
      await onSave({
        client:          form.client.trim(),
        address:         form.address.trim(),
        service:         form.service.trim(),
        date:            form.date,
        time:            form.time,
        client_phone:    form.client_phone.trim(),
        secondary_phone: form.secondary_phone.trim(),
        client_email:    form.client_email.trim(),
        ticket_number:   form.ticket_number.trim(),
        km_start:        form.km_start !== '' ? Number(form.km_start) : null,
      });
      onClose();
    } catch { /* erreur gérée par le parent */ } finally {
      setSaving(false);
    }
  };

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const L = ({ children }) => (
    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px', color: '#473a30' }}>
      {children}
    </label>
  );
  const I = (props) => <input {...props} className="form-control" style={{ minHeight: '44px', ...props.style }} />;

  return (
    <div onClick={handleBackdrop} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', padding: '1.5rem',
        width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1f1410', borderLeft: '4px solid #b87333', paddingLeft: '0.65rem' }}>
            ✏️ Modifier l'intervention
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6b7280', padding: '4px' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div><L>Client *</L><I value={form.client} onChange={e => set('client', e.target.value)} required placeholder="Nom du client" /></div>
            <div><L>Service *</L><I value={form.service} onChange={e => set('service', e.target.value)} required placeholder="Type d'intervention" /></div>
          </div>
          <div><L>Adresse</L><I value={form.address} onChange={e => set('address', e.target.value)} placeholder="Adresse complète" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div><L>Date *</L><I type="date" value={form.date} onChange={e => set('date', e.target.value)} required /></div>
            <div><L>Heure</L><I type="time" value={form.time} onChange={e => set('time', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div><L>Tél. principal</L><I type="tel" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="06 00 00 00 00" /></div>
            <div><L>Tél. secondaire</L><I type="tel" value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} placeholder="07 00 00 00 00" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div><L>Email</L><I type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="email@exemple.fr" /></div>
            <div><L>N° ticket</L><I value={form.ticket_number} onChange={e => set('ticket_number', e.target.value)} placeholder="Ex : TICK-1234" /></div>
          </div>
          <div style={{ maxWidth: '180px' }}>
            <L>Km départ</L>
            <I type="number" value={form.km_start} onChange={e => set('km_start', e.target.value)} placeholder="0" min="0" />
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid #f4e5d9', paddingTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minHeight: '44px' }}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ minHeight: '44px', minWidth: '130px' }}>
              {saving ? 'Enregistrement…' : '✓ Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bloc accordéon générique ──────────────────────────────────────────────────
// `required` (rouge vif) : signale un bloc avec une action obligatoire non terminée.
// `blockId` : permet l'ouverture+scroll déclenchée par les alertes cliquables.
function AccordionBlock({ icon, title, summary, defaultOpen = false, badge, children, danger = false, required = false, blockId }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);

  // Ouverture pilotée à distance (clic sur une alerte → ouvre + scroll)
  useEffect(() => {
    if (!blockId) return;
    const handler = (e) => {
      if (e.detail?.id === blockId) {
        setOpen(true);
        requestAnimationFrame(() => {
          ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    };
    window.addEventListener('srp-open-block', handler);
    return () => window.removeEventListener('srp-open-block', handler);
  }, [blockId]);

  const accent = required ? 'var(--color-danger)' : danger ? 'var(--color-danger)' : 'var(--color-copper)';

  return (
    <div ref={ref} style={{
      background: 'var(--card-bg)',
      border: required ? '1.5px solid var(--color-danger)' : '1px solid var(--border-color)',
      borderRadius: '16px', marginBottom: '0.7rem',
      overflow: 'hidden',
      boxShadow: required ? '0 2px 10px rgba(184,76,58,.18)' : 'var(--shadow-sm)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem',
        padding: '0.85rem 1rem', background: 'none', border: 'none',
        cursor: 'pointer', borderLeft: `4px solid ${accent}`,
        textAlign: 'left',
      }}>
        {/* Pastille d'icône (look moderne) */}
        <span style={{
          width: 34, height: 34, flexShrink: 0, borderRadius: '10px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.05rem', lineHeight: 1,
          background: required ? 'rgba(184,76,58,.12)' : 'var(--bg-secondary)',
        }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {title}
          {required && (
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: 'var(--color-danger)', padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Obligatoire
            </span>
          )}
        </span>
        {badge != null && (
          <span style={{
            fontSize: '0.75rem',
            background: required ? 'var(--color-danger)' : 'var(--bg-secondary)',
            color: required ? '#fff' : 'var(--color-primary)',
            padding: '2px 9px', borderRadius: '20px', fontWeight: 700, marginRight: '0.3rem', flexShrink: 0,
          }}>
            {badge}
          </span>
        )}
        {summary && <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginRight: '0.3rem', flexShrink: 0, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>}
        <span style={{ color: accent, fontSize: '0.8rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0.75rem 1rem 1rem', borderTop: '1px solid var(--border-color)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, dataVersion, refreshData, onUpdateScheduledDates, onUpdateAdminNote, onUpdateIntervention, onUpdateTeam, isUpdatingTeam, users = [], profile, organization }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [showCerfaModal, setShowCerfaModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [cerfaData, setCerfaData] = useState(null);

  // ── Protocole « single-owner » de l'état du rapport ───────────────────────
  // reportRef est la source de vérité SYNCHRONE : toute écriture passe par
  // applyReport, qui met le ref à jour AVANT le setState. Les callbacks
  // asynchrones (dictée vocale, blur, fin d'upload…) composent donc toujours
  // sur l'état le plus frais — aucune fenêtre entre un commit React et la
  // resynchronisation d'un effet.
  const reportRef = useRef(report);
  useEffect(() => { reportRef.current = report; }, [report]); // filet si un setReport direct subsiste
  const lastSavedReportRef = useRef(null); // dernier snapshot persisté (dirty-check par identité)
  const interventionRef = useRef(intervention);
  useEffect(() => { interventionRef.current = intervention; }, [intervention]);

  // Applique une mise à jour (objet ou fonction updater) sur l'état le plus frais.
  const applyReport = useCallback((updaterOrNext) => {
    const base = reportRef.current;
    const next = typeof updaterOrNext === 'function' ? updaterOrNext(base) : updaterOrNext;
    reportRef.current = next;
    setReport(next);
    return next;
  }, []);

  // Debug: logger les changements de uploadQueue
  useEffect(() => {
    logger.log('📊 Upload queue mise à jour:', uploadQueue.length, 'items', uploadQueue);
  }, [uploadQueue]);

  // Handler pour les previews locales - affichage IMMÉDIAT
  const handleLocalPreview = useCallback((preview) => {
    logger.log('🖼️ handleLocalPreview appelé:', {
      id: preview.id,
      name: preview.name,
      type: preview.type,
      localUrl: preview.localUrl ? 'blob:...' : 'NULL',
      status: preview.status
    });

    const newItem = {
      ...preview,
      preview: preview.localUrl,  // Map localUrl → preview pour ImageGalleryOptimized
      type: preview.type || 'image/jpeg'  // Fallback si type vide
    };

    logger.log('➕ Ajout à uploadQueue:', newItem.id);
    setUploadQueue(prev => {
      const updated = [...prev, newItem];
      logger.log('📊 uploadQueue après ajout:', updated.length, 'items');
      return updated;
    });
  }, []);

  // Handler pour la mise à jour de progression d'upload
  // Ne supprime PAS de la queue - c'est handleUploadComplete qui le fait
  const handleUploadProgress = useCallback(({ id, progress, status, url, error }) => {
    logger.log('📤 Progression upload:', id, progress + '%', status);
    setUploadQueue(prev => prev.map(item =>
      item.id === id
        ? { ...item, progress, status, url: url || item.url, error }
        : item
    ));
  }, []);

  // === Scroll locks + restauration ===
  const { lock, unlock } = useBodyScrollLock();
  const scrollerRef = useRef(null);
  const savedScrollRef = useRef(0);
  const pendingRestoreRef = useRef(false);
  const focusRestoreCleanupRef = useRef(null);

  const getScroller = () => document.scrollingElement || document.documentElement || document.body;

  const saveScroll = useCallback(() => {
    scrollerRef.current = getScroller();
    savedScrollRef.current = scrollerRef.current.scrollTop || window.scrollY || 0;
  }, []);

  const restoreScroll = useCallback(() => {
    if (!scrollerRef.current) scrollerRef.current = getScroller();
    const y = savedScrollRef.current || 0;
    scrollerRef.current.scrollTop = y;
    window.scrollTo(0, y);
  }, []);

  // Au retour du focus (ex: caméra → app), relancer une restauration si on l'attend
  const beginCriticalPicker = useCallback(() => {
    // Mémorise la position et lock le body
    saveScroll();
    pendingRestoreRef.current = true;
    lock();

    // Handler focus une seule fois
    const onFocus = () => {
      if (pendingRestoreRef.current) {
        setTimeout(() => {
          restoreScroll();
          pendingRestoreRef.current = false;
        }, 50);
      }
      window.removeEventListener('focus', onFocus, true);
      focusRestoreCleanupRef.current = null;
    };
    window.addEventListener('focus', onFocus, true);
    focusRestoreCleanupRef.current = () => window.removeEventListener('focus', onFocus, true);
  }, [lock, saveScroll, restoreScroll]);

  // Nettoyage si démontage en plein milieu
  useEffect(() => {
    return () => {
      focusRestoreCleanupRef.current?.();
    };
  }, []);

  useLayoutEffect(() => {
    if (pendingRestoreRef.current) {
      // Restaurer sur plusieurs frames pour contrer les relayouts iOS
      restoreScroll();
      requestAnimationFrame(() => restoreScroll());
      setTimeout(() => restoreScroll(), 0);
      setTimeout(() => restoreScroll(), 50);
      pendingRestoreRef.current = false;
    }
  });

  // Harmonise le schéma du report
  const ensureReportSchema = useCallback((base) => {
    const r = base || {};
    return {
      notes: r.notes || '',
      // Normalise les entrées legacy (chaîne URL) en objets { url } une seule
      // fois à la frontière — tous les consommateurs supposent ensuite l'objet.
      files: (Array.isArray(r.files) ? r.files : []).map(normalizeFileEntry),
      arrivalTime: r.arrivalTime || null,
      departureTime: r.departureTime || null,
      signature: r.signature || null,
      needs: Array.isArray(r.needs) ? r.needs.map(n => ({
        id: n.id || `need-${Math.random().toString(36).slice(2)}`,
        label: n.label || '',
        qty: Number(n.qty) || 1,
        urgent: !!n.urgent,
        note: n.note || '',
        category: n.category || 'materiel',
        estimated_price: numberOrNull(n.estimated_price),
        request_id: n.request_id || null,
      })) : [],
      supply_requests: Array.isArray(r.supply_requests) ? r.supply_requests : [],
      quick_checkpoints: Array.isArray(r.quick_checkpoints) ? r.quick_checkpoints.every?.(c => typeof c === 'object') ? r.quick_checkpoints : [
        { label: 'Zone sécurisée', done: false, at: null },
        { label: 'Essais OK', done: false, at: null },
        { label: 'Brief client fait', done: false, at: null },
      ] : [
        { label: 'Zone sécurisée', done: false, at: null },
        { label: 'Essais OK', done: false, at: null },
        { label: 'Brief client fait', done: false, at: null },
      ],
      blocks: r.blocks || {
        access: { blocked: false, note: '', photos: [] },
        power: { blocked: false, note: '', photos: [] },
        parts: { blocked: false, note: '', photos: [] },
        authorization: { blocked: false, note: '', photos: [] },
      },
      arrivalGeo: r.arrivalGeo || null,
      departureGeo: r.departureGeo || null,
      rating: r.rating || null,
      follow_up_required: !!r.follow_up_required,
      parts_used: Array.isArray(r.parts_used) ? r.parts_used : [],
      // Nouveaux champs pour timer avec pause/reprise
      isPaused: !!r.isPaused,
      pauseStartedAt: r.pauseStartedAt || null,
      pauseHistory: Array.isArray(r.pauseHistory) ? r.pauseHistory : [],
      km_end: r.km_end ? Number(r.km_end) : null,
    };
  }, []);

  useEffect(() => {
    const found = interventions.find(i => String(i.id) === String(interventionId));
    if (found) {
      setIntervention(found);
      // ✅ Fusionner le report : fichiers frais depuis la BDD, changements
      // locaux conservés. (applyReport = updater appliqué UNE fois, de façon
      // synchrone, sur le ref — un effet de bord interne y est sûr.)
      applyReport(prev => {
        const isInitialLoad = !prev;
        const currentReport = prev || ensureReportSchema(found.report);
        const merged = {
          ...currentReport,  // Garde les changements locaux
          files: (found.report?.files || currentReport.files || []).map(normalizeFileEntry),
          updated_at: found.updated_at
        };
        // Au premier chargement, l'état BDD est par définition déjà sauvegardé
        if (isInitialLoad) lastSavedReportRef.current = merged;
        return merged;
      });
      setLoading(false);
    } else {
      // Si on a reçu les données (tableau vide ou pas le bon ID) et qu'on a fini de charger côté parent
      // On arrête le loading local pour afficher l'état vide/erreur
      if (interventions !== undefined) {
        setLoading(false);
      }
    }
  }, [interventions, interventionId, navigate, dataVersion, ensureReportSchema, applyReport]);

  // ✅ Rafraîchir les URLs signées des images (expirent après 1h)
  useEffect(() => {
    const refreshFileUrls = async () => {
      if (!report?.files?.length) return;

      // Vérifier si les URLs ont besoin d'être rafraîchies (contiennent supabase)
      const needsRefresh = report.files.some(f =>
        f.url && typeof f.url === 'string' && f.url.includes('supabase')
      );

      if (!needsRefresh) return;

      try {
        logger.log('🔄 Rafraîchissement des URLs des images...');
        const refreshedFiles = await storageService.refreshReportFileUrls(report.files);

        // Mettre à jour seulement si les URLs ont changé
        const urlsChanged = refreshedFiles.some((f, i) => f.url !== report.files[i]?.url);
        if (urlsChanged) {
          logger.log('✅ URLs des images rafraîchies');
          applyReport(prev => ({ ...prev, files: refreshedFiles }));
        }
      } catch (error) {
        logger.error('❌ Erreur rafraîchissement URLs:', error);
      }
    };

    refreshFileUrls();
  }, [intervention?.id]); // Rafraîchir quand l'intervention change

  // ✅ Persistance du report. Accepte un objet OU une fonction updater :
  // l'updater compose sur reportRef (état le plus frais), ce qui élimine les
  // écrasements croisés entre dictée, uploads, checkpoints et géoloc.
  const persistReport = useCallback(async (updatedOrUpdater) => {
    const updated = applyReport(updatedOrUpdater);
    lastSavedReportRef.current = updated;
    try {
      const res = await onSaveSilent(intervention.id, updated);
      if (res?.error) alert('Échec de la sauvegarde du rapport');
    } catch (e) {
      logger.error(e);
      alert('Échec de la sauvegarde du rapport');
    }
    // ✅ Pas de lock/unlock ici, le parent gère la stabilisation du scroll
  }, [applyReport, intervention, onSaveSilent]);

  const handleReportChange = (field, value) => applyReport(prev => ({ ...prev, [field]: value }));

  // Persiste l'état courant seulement s'il a changé depuis la dernière
  // sauvegarde (identité d'objet : chaque modification crée un nouvel objet).
  // Utilisé au blur des champs texte → l'autosave couvre notes ET km_end.
  const persistIfDirty = useCallback(() => {
    const cur = reportRef.current;
    if (!cur || cur === lastSavedReportRef.current) return;
    persistReport(cur);
  }, [persistReport]);

  // Dictée vocale : 1 sauvegarde par pause de parole (débounce), pas une par
  // phrase — évite des dizaines d'écritures/refetchs pendant une dictée.
  const persistIfDirtyRef = useRef(persistIfDirty);
  useEffect(() => { persistIfDirtyRef.current = persistIfDirty; }, [persistIfDirty]);
  const debouncedDictationSave = useMemo(
    () => debounce(() => persistIfDirtyRef.current(), 2500),
    []
  );
  useEffect(() => () => debouncedDictationSave.flush(), [debouncedDictationSave]);

  // Note admin (dictée) : même principe — le handler parent affiche un toast
  // et refetch, donc 1 appel par pause au lieu d'un par phrase.
  const adminNoteSaveRef = useRef(() => {});
  useEffect(() => {
    adminNoteSaveRef.current = () => {
      const cur = interventionRef.current;
      if (cur && onUpdateAdminNote) onUpdateAdminNote(cur.id, cur.admin_note || '');
    };
  }, [onUpdateAdminNote]);
  const debouncedAdminNoteSave = useMemo(() => debounce(() => adminNoteSaveRef.current(), 2500), []);
  useEffect(() => () => debouncedAdminNoteSave.flush(), [debouncedAdminNoteSave]);

  // Sauvegarde du PV de réception
  const handlePVSave = useCallback(async (pvData) => {
    await persistReport(prev => ({ ...prev, pv_reception: pvData }));
    alert('✓ Procès-Verbal de Réception enregistré');
  }, [persistReport]);

  // Reusable upload completion handler
  const handleUploadComplete = useCallback(async (uploaded) => {
    logger.log('✅ Upload terminé, ajout de', uploaded.length, 'fichiers');

    // Compose sur l'état le plus frais : un upload qui se termine après une
    // dictée ou un toggle de checkpoint ne doit pas les écraser.
    await persistReport(prev => ({ ...prev, files: [...(prev.files || []), ...uploaded] }));

    // Vider la queue d'upload - les fichiers sont maintenant dans report.files
    // Libérer aussi les blob URLs pour éviter les fuites mémoire
    setUploadQueue(prev => {
      prev.forEach(item => {
        if (item.preview?.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
      return [];
    });

    // Rafraîchir les données
    try {
      await refreshData?.();
    } catch (e) {
      logger.error('Erreur refresh:', e);
    }
  }, [persistReport, refreshData]);

  // Paste handler désactivé (nécessiterait une ré-implémentation avec FileUploader)

  // -------- Suppression d'image --------
  // Normalise l'URL (retire les query params : jeton signé / cache-bust) pour
  // que le matching reste fiable même après rafraîchissement des URLs signées.
  const normalizeUrl = (u) => (typeof u === 'string' ? u.split('?')[0] : u);

  const handleDeleteImage = useCallback(async (image) => {
    logger.log('🗑️ Suppression de l\'image:', image?.url);
    const target = normalizeUrl(image?.url);

    // 1) Retrait OPTIMISTE du rapport (par URL normalisée) — garantit que
    //    l'entrée disparaît de la liste, quelle que soit l'issue côté stockage.
    await persistReport(prev => ({
      ...prev,
      files: (prev.files || []).filter(f => {
        const fUrl = typeof f === 'string' ? f : f?.url; // entrées legacy = chaîne
        return !(target && normalizeUrl(fUrl) === target);
      }),
    }));

    // 2) Suppression du fichier dans le stockage (best-effort, non bloquante)
    try {
      const { error: storageError } = await storageService.deleteInterventionFile(image.url);
      if (storageError) logger.warn('Suppression stockage non confirmée:', storageError);
    } catch (e) {
      logger.warn('Suppression stockage échouée (entrée déjà retirée du rapport):', e);
    }

    logger.log('✅ Image retirée du rapport');
  }, [persistReport]);

  // -------- Téléchargement de tous les fichiers en ZIP --------
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadAllAsZip = useCallback(async () => {
    if (!window.JSZip) {
      alert('Erreur: Librairie de compression non disponible');
      return;
    }

    if (!report.files || report.files.length === 0) {
      alert('Aucun fichier à télécharger');
      return;
    }

    setIsDownloadingZip(true);
    try {
      const JSZip = window.JSZip;
      const zip = new JSZip();
      const totalFiles = report.files.length;
      let successCount = 0;
      let failCount = 0;

      logger.log('📦 Création du ZIP avec', totalFiles, 'fichier(s)');

      // Fonction pour télécharger un fichier avec retry
      const downloadFile = async (file, index) => {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            logger.log(`📥 Téléchargement ${index + 1}/${totalFiles} (tentative ${attempt}):`, file.name);

            // Timeout plus long pour mobile (60s)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(file.url, {
              signal: controller.signal,
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            return { success: true, blob, file };
          } catch (error) {
            logger.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée pour ${file.name}:`, error.message);
            if (attempt === maxRetries) {
              return { success: false, error, file };
            }
            // Attendre avant retry
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        }
      };

      // Télécharger par batch de 2 fichiers pour ne pas surcharger le mobile
      const BATCH_SIZE = 2;
      for (let i = 0; i < report.files.length; i += BATCH_SIZE) {
        const batch = report.files.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((file, idx) => downloadFile(file, i + idx))
        );

        for (const result of results) {
          if (result.success) {
            // Ajouter au ZIP avec un nom unique
            let fileName = result.file.name || `fichier-${successCount + 1}`;
            let counter = 1;
            let uniqueName = fileName;
            while (zip.file(uniqueName)) {
              const ext = fileName.match(/\.[^.]+$/)?.[0] || '';
              const base = fileName.replace(/\.[^.]+$/, '');
              uniqueName = `${base}-${counter}${ext}`;
              counter++;
            }
            zip.file(uniqueName, result.blob);
            successCount++;
            logger.log(`✅ Ajouté au ZIP: ${uniqueName}`);
          } else {
            failCount++;
            logger.error(`❌ Échec final ${result.file.name}:`, result.error?.message);
          }
        }
      }

      if (successCount === 0) {
        throw new Error('Aucun fichier n\'a pu être téléchargé');
      }

      // Générer le ZIP
      logger.log('🗜️ Compression du ZIP...');
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Télécharger le ZIP - méthode optimisée mobile
      const zipName = `Intervention-${intervention.client || intervention.id}-Fichiers.zip`;

      // Utiliser saveAs si disponible (plus fiable sur mobile)
      if (window.saveAs) {
        window.saveAs(zipBlob, zipName);
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = zipName;
        link.style.display = 'none';
        document.body.appendChild(link);
        // Délai pour iOS
        setTimeout(() => {
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          }, 100);
        }, 100);
      }

      logger.log('✅ ZIP téléchargé:', zipName);
      if (failCount > 0) {
        alert(`⚠️ ZIP créé avec ${successCount} fichier(s). ${failCount} fichier(s) n'ont pas pu être récupérés.`);
      } else {
        alert(`✅ Tous les ${successCount} fichiers ont été téléchargés dans ${zipName}`);
      }
    } catch (error) {
      logger.error('❌ Erreur création ZIP:', error);
      alert('Erreur lors de la création du fichier ZIP: ' + error.message);
    } finally {
      setIsDownloadingZip(false);
    }
  }, [report?.files, intervention]);

  // -------- Besoins --------
  const [needDraft, setNeedDraft] = useState({ label: '', qty: 1, urgent: false, note: '', category: 'materiel', estimated_price: '' });
  const [needsOpen, setNeedsOpen] = useState(true);
  const [adminNoteExpanded, setAdminNoteExpanded] = useState(false);
  const needsTotal = Array.isArray(report?.needs) ? report.needs.reduce((sum, n) => sum + (Number(n.estimated_price) || 0), 0) : 0;

  const addNeed = async () => {
    if (!needDraft.label.trim()) return;
    const item = { ...needDraft, id: `need-${Date.now()}`, qty: Math.max(1, Number(needDraft.qty) || 1), estimated_price: numberOrNull(needDraft.estimated_price), request_id: null };
    await persistReport(prev => ({ ...prev, needs: [...(prev.needs || []), item] }));
    setNeedDraft({ label: '', qty: 1, urgent: false, note: '', category: 'materiel', estimated_price: '' });
  };
  const removeNeed = async (id) => {
    await persistReport(prev => ({ ...prev, needs: (prev.needs || []).filter(n => n.id !== id) }));
  };

  // -------- Arrivé / Départ (nouveau) --------
  const markWithGeo = useCallback(async (kind) => {
    const isArrival = kind === 'arrival';
    const nowIso = new Date().toISOString();

    // Early guard UI : départ ne peut pas précéder l'arrivée (état le plus frais)
    const arrivalTime = reportRef.current?.arrivalTime;
    if (!isArrival && arrivalTime) {
      try {
        const arr = new Date(arrivalTime).getTime();
        const dep = new Date(nowIso).getTime();
        if (dep < arr) { alert("L'heure de départ ne peut pas précéder l'arrivée."); return; }
      } catch { /* date parse error – ignore */ }
    }

    // Lock le body pendant la phase géoloc + persistance (mobile peut sauter)
    saveScroll(); pendingRestoreRef.current = true; if (!document.body.dataset.__scrollLocked) lock();

    const finalize = async (updated, msg) => {
      try {
        await persistReport(updated);
        if (msg) alert(msg);
      } finally {
        // ✅ Toujours déverrouiller et restaurer le scroll
        unlock();
        restoreScroll();
        pendingRestoreRef.current = false;
      }
    };

    // Updaters : composent sur l'état le plus frais au moment où la géoloc
    // répond (peut prendre 10s — d'autres écritures ont pu arriver entre-temps).
    const withMark = (geo) => (prev) => ({
      ...prev,
      [isArrival ? 'arrivalTime' : 'departureTime']: nowIso,
      [isArrival ? 'arrivalGeo' : 'departureGeo']: geo,
    });

    if (!('geolocation' in navigator)) {
      await finalize(withMark(null), 'Géolocalisation indisponible. Heure enregistrée.');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords || {};
      await finalize(withMark({ lat: latitude, lng: longitude, acc: accuracy }));
    }, async () => {
      await finalize(withMark(null), 'Géolocalisation refusée. Heure enregistrée sans position.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }, [lock, unlock, saveScroll, restoreScroll, persistReport]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- Validation & sauvegarde --------
  const validateCanClose = () => {
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsOK = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.every(c => !!c.done) : true;

    // Debug logging
    logger.log('🔍 Validation:', {
      filesCount: report.files?.length || 0,
      imgCount,
      files: report.files?.map(f => ({ url: f.url?.substring(0, 50), type: f.type, isImage: isImageUrl(f) })),
      hasSignature: !!report.signature,
      checkpoints: report.quick_checkpoints?.map(c => ({ label: c.label, done: c.done })),
      checkpointsOK
    });

    if (!report.signature) return { ok: false, msg: 'Signature client manquante.' };
    if (imgCount < MIN_REQUIRED_PHOTOS) return { ok: false, msg: `Minimum ${MIN_REQUIRED_PHOTOS} photo(s) requise(s). (${imgCount} trouvée(s))` };
    if (!checkpointsOK) return { ok: false, msg: 'Tous les checkpoints rapides doivent être validés.' };
    return { ok: true };
  };

  // Détecte les oublis de l'employé
  const getEmployeeOublis = () => {
    const oublis = [];
    const imgCount = Array.isArray(report.files) ? report.files.filter(isImageUrl).length : 0;
    const checkpointsNotDone = Array.isArray(report.quick_checkpoints)
      ? report.quick_checkpoints.filter(c => !c.done)
      : [];

    if (!report.signature) oublis.push('Signature client manquante');
    if (imgCount < MIN_REQUIRED_PHOTOS) oublis.push(`Photos insuffisantes (${imgCount}/${MIN_REQUIRED_PHOTOS})`);
    if (!report.arrivalTime) oublis.push('Heure d\'arrivée non enregistrée');
    if (!report.departureTime) oublis.push('Heure de départ non enregistrée');
    if (checkpointsNotDone.length > 0) {
      checkpointsNotDone.forEach(c => oublis.push(`Checkpoint non validé : ${c.label}`));
    }
    if (!report.notes?.trim()) oublis.push('Aucune note de rapport');

    return oublis;
  };

  const handleSave = async () => {
    if (!intervention) return;

    if (isAdmin) {
      // Détecter et enregistrer les oublis dans le rapport
      const oublis = getEmployeeOublis();
      const reportToSave = { ...report };
      if (oublis.length > 0) {
        reportToSave.admin_oublis = oublis;
        reportToSave.admin_closed_at = new Date().toISOString();
      }
      setIsSaving(true);
      try { await onSave(intervention.id, reportToSave); }
      finally { setIsSaving(false); }
    } else {
      const v = validateCanClose(); if (!v.ok) { alert(v.msg); return; }
      setIsSaving(true);
      try { await onSave(intervention.id, { ...report }); }
      finally { setIsSaving(false); }
    }
  };

  if (loading) return <div className="loading-container"><LoaderIcon className="animate-spin" /><p>Chargement…</p></div>;

  if (!intervention || !report) return (
    <div className="loading-container">
      <AlertTriangleIcon className="text-danger" style={{ width: 48, height: 48, marginBottom: 16 }} />
      <h3>Intervention introuvable</h3>
      <p className="text-muted">Impossible de charger les détails de cette intervention.</p>
      <button className="btn btn-primary" onClick={() => navigate('/planning')} style={{ marginTop: 16 }}>
        Retour au planning
      </button>
    </div>
  );

  const currentStatus = intervention.status || (report.arrivalTime ? 'En cours' : 'À venir');
  const urgentCount = Array.isArray(report.needs) ? report.needs.filter(n => n.urgent).length : 0;

  // Calcul des statistiques pour StatusCard
  const calculateDuration = () => {
    if (!report.arrivalTime) return null;
    const now = report.departureTime ? new Date(report.departureTime) : new Date();
    const start = new Date(report.arrivalTime);
    const diff = Math.floor((now - start) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
  };

  const stats = {
    duration: calculateDuration(),
    photoCount: report.files?.filter(isImageUrl).length || 0,
    checkpointProgress: report.quick_checkpoints?.length > 0
      ? `${report.quick_checkpoints.filter(c => c.done).length}/${report.quick_checkpoints.length}`
      : null,
    team: intervention.intervention_assignments?.length > 0
      ? intervention.intervention_assignments.map(a => a.profiles?.full_name || 'Employé').join(', ')
      : 'Non assigné'
  };

  const STATUS_COLOR = { 'À venir': '#8b7968', 'En cours': '#9c5e22', 'Terminée': '#5e6b31' };
  const STATUS_BG    = { 'À venir': '#f0e7dc', 'En cours': '#f9efe4', 'Terminée': '#eef2e4' };
  const teamSummary  = intervention.intervention_assignments?.map(a => a.profiles?.full_name || 'Employé').join(', ') || '';

  // ── Éléments OBLIGATOIRES non terminés (mis en rouge vif) ─────────────────
  const isDone = currentStatus === 'Terminée';
  const photosMissing      = !isDone && stats.photoCount < MIN_REQUIRED_PHOTOS;
  const signatureMissing   = !isDone && !report.signature;
  const checkpointsTotal   = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.length : 0;
  const checkpointsDone    = Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints.filter(c => c.done).length : 0;
  const checkpointsMissing = !isDone && checkpointsTotal > 0 && checkpointsDone < checkpointsTotal;
  const reportRequired     = signatureMissing; // la signature vit dans le bloc Rapport

  // ── Progression globale de l'intervention (pour le Hero) ──────────────────
  const progressSteps = [
    !!report.arrivalTime,
    stats.photoCount >= MIN_REQUIRED_PHOTOS,
    checkpointsTotal === 0 || checkpointsDone === checkpointsTotal,
    !!report.signature,
    !!report.notes?.trim(),
    !!report.departureTime,
  ];
  const progressPct = isDone ? 100 : Math.round((progressSteps.filter(Boolean).length / progressSteps.length) * 100);

  // ── Éléments obligatoires restants (barre d'action fixe) ──────────────────
  const missingRequired = [];
  if (photosMissing)      missingRequired.push('photos');
  if (checkpointsMissing) missingRequired.push('points de contrôle');
  if (signatureMissing)   missingRequired.push('signature');

  // ── Initiales du client (avatar Hero) ─────────────────────────────────────
  const clientInitials = (intervention.client || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]?.toUpperCase()).join('') || '?';

  return (
    <div className="intervention-detail-modern">
      <div className="intervention-content">

        {/* ═══ BLOC HERO ═══════════════════════════════════════════════════════ */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--color-copper) 0%, var(--color-primary-dark) 55%, var(--color-accent-dark) 100%)',
          border: '1px solid var(--border-color)', borderRadius: '20px',
          padding: '1.1rem 1.2rem', marginBottom: '0.7rem',
          boxShadow: 'var(--shadow-lg)', color: '#fff',
        }}>
          {/* halo décoratif */}
          <div style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.10)', pointerEvents: 'none' }} />
          {/* Ligne 1 : retour + statut + modifier */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <button onClick={() => navigate('/planning')}
              style={{ background: 'rgba(255,255,255,.18)', border: 'none', cursor: 'pointer', fontSize: '1.1rem', width: 34, height: 34, borderRadius: '10px', color: '#fff', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ←
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, padding: '4px 11px', borderRadius: '20px',
              background: 'rgba(255,255,255,.92)', color: STATUS_COLOR[currentStatus] || '#8b7968', flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[currentStatus] || '#8b7968', display: 'inline-block' }} />
              {currentStatus}
            </span>
            {urgentCount > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', flexShrink: 0 }}>
                ⚠️ {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {isAdmin && onUpdateIntervention && (
              <button onClick={() => setShowEditModal(true)}
                style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: '10px', padding: '0.4rem 0.7rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', minHeight: '36px', flexShrink: 0 }}>
                ✏️ Modifier
              </button>
            )}
          </div>
          {/* Ligne 2 : avatar + nom client + service */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.9rem' }}>
            <div style={{
              width: 52, height: 52, flexShrink: 0, borderRadius: '14px',
              background: 'rgba(255,255,255,.22)', border: '1.5px solid rgba(255,255,255,.35)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', fontWeight: 800, color: '#fff',
            }}>{clientInitials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '0.1rem', wordBreak: 'break-word' }}>
                {intervention.client}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>
                {intervention.service}
              </div>
            </div>
          </div>
          {/* Progression globale */}
          <div style={{ position: 'relative', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,.92)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>Progression</span>
              <span>{progressPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: '20px', background: 'rgba(255,255,255,.22)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: '20px', background: progressPct === 100 ? '#86efac' : '#fff', transition: 'width 0.4s ease' }} />
            </div>
          </div>
          {/* Ligne 3 : boutons d'action rapide (verre dépoli) */}
          <div style={{ position: 'relative', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              intervention.client_phone && { href: `tel:${intervention.client_phone}`, label: '📞 Appeler' },
              intervention.client_phone && { href: `sms:${intervention.client_phone}`, label: '💬 SMS' },
              intervention.address && { onClick: () => { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(intervention.address)}`, '_blank', 'noopener'); }, label: '🗺️ Adresse' },
              (typeof navigator !== 'undefined' && navigator.share) && { onClick: () => navigator.share({ title: intervention.client, text: `${intervention.client} — ${intervention.address || ''}` }).catch(() => {}), label: '↗ Partager' },
            ].filter(Boolean).map((b, i) => {
              const style = {
                minHeight: '40px', padding: '0 0.85rem', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(255,255,255,.18)', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                border: '1px solid rgba(255,255,255,.3)', borderRadius: '10px', cursor: 'pointer',
              };
              return b.href
                ? <a key={i} href={b.href} style={style}>{b.label}</a>
                : <button key={i} onClick={b.onClick} style={style}>{b.label}</button>;
            })}
          </div>
        </div>

        {/* ═══ ALERTES (cliquables → ouvrent le bloc concerné) ════════════════ */}
        <SmartAlerts
          report={report}
          intervention={intervention}
          MIN_PHOTOS={MIN_REQUIRED_PHOTOS}
          onNavigate={(blockId) => {
            window.dispatchEvent(new CustomEvent('srp-open-block', { detail: { id: blockId } }));
          }}
        />

        {/* Conteneur des blocs : 1 colonne sur mobile, 2 colonnes sur grand écran */}
        <div className="intervention-blocks">

        {/* ═══ SUIVI DU TEMPS ═════════════════════════════════════════════════ */}
        <AccordionBlock icon="⏱" title="Suivi du temps" defaultOpen>
          <TimeTrackerEnhanced report={report} onUpdateReport={persistReport} disabled={false} />
          <div style={{ marginTop: '0.75rem' }}>
            <ArrivalDeparture
              report={report}
              onMarkArrival={() => markWithGeo('arrival')}
              onMarkDeparture={() => markWithGeo('departure')}
              disabled={false}
            />
          </div>
        </AccordionBlock>

        {/* ═══ POINTS DE CONTRÔLE (obligatoire) ══════════════════════════════ */}
        <AccordionBlock icon="✅" title="Points de contrôle" defaultOpen
          badge={stats.checkpointProgress} required={checkpointsMissing} blockId="checkpoints">
          {(!report.quick_checkpoints || report.quick_checkpoints.length === 0) && (
            <p className="text-muted">Aucun checkpoint défini pour cette intervention.</p>
          )}
          {Array.isArray(report.quick_checkpoints) && report.quick_checkpoints.map((checkpoint, index) => (
            <label key={index} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              // ✅ validé → vert / ❗ non validé → rouge vif (obligatoire)
              background: checkpoint.done ? 'rgba(16,185,129,.10)' : 'rgba(220,38,38,.06)',
              border: `2px solid ${checkpoint.done ? '#10b981' : '#dc2626'}`,
              borderRadius: '0.6rem', marginBottom: '0.5rem',
              cursor: isAdmin ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
            }}>
              <input type="checkbox" checked={checkpoint.done || false}
                onChange={(e) => {
                  if (isAdmin) return;
                  const done = e.target.checked;
                  persistReport(prev => {
                    const updated = [...(prev.quick_checkpoints || [])];
                    updated[index] = { ...updated[index], done, at: done ? new Date().toISOString() : null };
                    return { ...prev, quick_checkpoints: updated };
                  });
                }}
                disabled={false} style={{ width: '1.3rem', height: '1.3rem', accentColor: checkpoint.done ? '#10b981' : '#dc2626' }}
              />
              <span style={{ fontWeight: 600, color: checkpoint.done ? '#059669' : '#dc2626', flex: 1 }}>
                {checkpoint.label}
              </span>
              {checkpoint.done && checkpoint.at ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  ✓ {new Date(checkpoint.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626' }}>À VALIDER</span>
              )}
            </label>
          ))}

          {/* Note Admin */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>📝 Note Admin</span>
              {!isAdmin && intervention.admin_note && (
                <button onClick={() => setAdminNoteExpanded(!adminNoteExpanded)}
                  className="btn btn-sm btn-outline-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}>
                  {adminNoteExpanded ? '🔽 Réduire' : '🔼 Agrandir'}
                </button>
              )}
            </div>
            {isAdmin ? (
              <>
                <textarea className="form-control"
                  value={intervention.admin_note || ''}
                  onChange={(e) => setIntervention(prev => ({ ...prev, admin_note: e.target.value }))}
                  onBlur={(e) => onUpdateAdminNote && onUpdateAdminNote(intervention.id, e.target.value)}
                  placeholder="Note pour l'employé..." rows={3}
                />
                <DictationButton
                  onAppendText={(text) => {
                    if (!text) return;
                    const prev = interventionRef.current || intervention;
                    const cur = prev.admin_note || '';
                    const sep = cur && !/\s$/.test(cur) ? ' ' : '';
                    const updated = { ...prev, admin_note: cur + sep + text };
                    interventionRef.current = updated; // réf synchrone
                    setIntervention(updated);          // UI immédiate
                    debouncedAdminNoteSave();          // 1 sauvegarde (toast) par pause, pas par phrase
                  }}
                />
              </>
            ) : (
              <div style={{
                maxHeight: adminNoteExpanded ? 'none' : '120px',
                overflow: adminNoteExpanded ? 'visible' : 'auto',
                background: 'var(--bg-secondary)', borderRadius: '8px', padding: '0.6rem 0.8rem', border: '1px solid var(--border-color)',
              }}>
                {intervention.admin_note
                  ? <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{intervention.admin_note}</p>
                  : <span className="text-muted" style={{ fontSize: '0.85rem' }}>Aucune note.</span>
                }
              </div>
            )}
          </div>
        </AccordionBlock>

        {/* ═══ INFORMATIONS ═══════════════════════════════════════════════════ */}
        <AccordionBlock icon="📋" title="Informations" summary={intervention.address?.split(',')[0]}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
            {intervention.address && (
              <InfoRow icon="📍" label="Adresse">{intervention.address}</InfoRow>
            )}
            {intervention.date && (
              <InfoRow icon="📅" label="Date">
                {new Date(intervention.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {intervention.time && <span style={{ marginLeft: '0.4rem', fontWeight: 600 }}>à {intervention.time}</span>}
              </InfoRow>
            )}
            {(intervention.client_phone || intervention.secondary_phone) && (
              <InfoRow icon="📞" label="Téléphone">
                {intervention.client_phone && (
                  <a href={`tel:${intervention.client_phone}`} style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>{intervention.client_phone}</a>
                )}
                {intervention.secondary_phone && (
                  <span> · <a href={`tel:${intervention.secondary_phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{intervention.secondary_phone}</a></span>
                )}
              </InfoRow>
            )}
            {intervention.client_email && (
              <InfoRow icon="✉️" label="Email">
                <a href={`mailto:${intervention.client_email}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', wordBreak: 'break-all' }}>{intervention.client_email}</a>
              </InfoRow>
            )}
            {intervention.ticket_number && (
              <InfoRow icon="🎫" label="N° ticket">{intervention.ticket_number}</InfoRow>
            )}
            {intervention.km_start != null && (
              <InfoRow icon="🚗" label="Km départ">{intervention.km_start} km</InfoRow>
            )}
          </div>
        </AccordionBlock>

        {/* ═══ DATES PLANIFIÉES (Admin) ════════════════════════════════════════ */}
        {isAdmin && onUpdateScheduledDates && (
          <AccordionBlock icon="📅" title="Dates planifiées" badge={intervention.scheduled_dates?.length || 0}>
            <ScheduledDatesEditor
              scheduledDates={intervention.scheduled_dates || []}
              onUpdate={(dates) => onUpdateScheduledDates(intervention.id, dates)}
              disabled={false}
            />
          </AccordionBlock>
        )}

        {/* ═══ ÉQUIPE (Admin) ══════════════════════════════════════════════════ */}
        {isAdmin && onUpdateTeam && (
          <AccordionBlock icon="👥" title="Équipe" summary={teamSummary || 'Non assignée'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Membres assignés</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowTeamModal(true)}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                Modifier l'équipe
              </button>
            </div>
            {intervention.intervention_assignments && intervention.intervention_assignments.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {intervention.intervention_assignments.map((assignment, idx) => (
                  <span key={assignment.user_id || idx} className="badge"
                    style={{ background: '#b87333', color: 'white', padding: '0.35rem 0.7rem', borderRadius: '1rem', fontSize: '0.82rem' }}>
                    {assignment.profiles?.full_name || 'Employé'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ margin: '0 0 0.75rem' }}>Aucun employé assigné</p>
            )}
            {intervention.daily_assignments && Object.keys(intervention.daily_assignments).length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Équipe par jour
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {Object.entries(intervention.daily_assignments).sort(([a], [b]) => a.localeCompare(b)).map(([date, userIds]) => {
                    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                    const userNames = userIds.map(uid => {
                      const assignment = intervention.intervention_assignments?.find(a => a.user_id === uid);
                      return assignment?.profiles?.full_name || users.find(u => u.id === uid)?.full_name || 'Employé';
                    });
                    return (
                      <div key={date} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600, minWidth: '80px', color: 'var(--text-secondary)' }}>{formattedDate}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{userNames.join(', ') || 'Aucun'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </AccordionBlock>
        )}

        {/* ═══ LOTS PAR MÉTIER ═════════════════════════════════════════════════ */}
        <AccordionBlock icon="🏗" title="Lots par métier">
          <InterventionLots
            interventionId={intervention.id}
            isAdmin={isAdmin}
            profile={profile}
            users={users}
          />
        </AccordionBlock>

        {/* ═══ PHOTOS (minimum requis) ════════════════════════════════════════ */}
        <AccordionBlock icon="📷" title="Photos et documents"
          badge={photosMissing ? `${stats.photoCount}/${MIN_REQUIRED_PHOTOS}` : (stats.photoCount > 0 ? stats.photoCount : null)}
          required={photosMissing} blockId="photos">
          {photosMissing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(220,38,38,.07)', border: '1px solid #dc2626', color: '#dc2626', borderRadius: '10px', padding: '0.55rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
              📸 {MIN_REQUIRED_PHOTOS} photos minimum requises — il en manque {MIN_REQUIRED_PHOTOS - stats.photoCount}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              {report.files?.length || 0} fichier{(report.files?.length || 0) > 1 ? 's' : ''}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {report.files && report.files.length > 1 && (
                <button onClick={handleDownloadAllAsZip} disabled={isDownloadingZip}
                  className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>
                  <DownloadIcon />{isDownloadingZip ? ' Préparation...' : ' Tout télécharger'}
                </button>
              )}
              <button onClick={refreshData} className="btn-icon" title="Rafraîchir"><RefreshCwIcon /></button>
            </div>
          </div>
          <ImageGalleryOptimized
            images={(report.files || []).filter(isImageUrl).map(f =>
              typeof f === 'string' ? { url: f } : { url: f.url, name: f.name, type: f.type }
            )}
            uploadQueue={uploadQueue.filter(item => item.type?.startsWith('image/'))}
            emptyMessage="Aucune photo. Utilisez le bouton ci-dessous pour en ajouter."
            onDeleteImage={isAdmin ? handleDeleteImage : null}
          />
          <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              ➕ Ajouter des photos / documents
            </div>
            <FileUploader
              interventionId={interventionId}
              folder="report"
              onLocalPreview={handleLocalPreview}
              onUploadProgress={handleUploadProgress}
              onUploadComplete={handleUploadComplete}
              onBeginCritical={lock}
              onEndCritical={unlock}
            />
          </div>
        </AccordionBlock>

        {/* ═══ RAPPORT DE CHANTIER ═════════════════════════════════════════════ */}
        <AccordionBlock icon="📝" title="Rapport de chantier" required={reportRequired} blockId="rapport">
          {/* Notes + dictée vocale */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              🗒️ Notes de chantier
            </label>
            <textarea value={report.notes || ''} onChange={e => handleReportChange('notes', e.target.value)}
              onBlur={persistIfDirty}
              placeholder="Détails, matériel, observations… ou utilisez la dictée vocale ci-dessous." rows="5" className="form-control" />
            {/* 🎙️ Dictée : la parole s'écrit toute seule (sauvegarde débouncée) */}
            <DictationButton
              onAppendText={(text) => {
                if (!text) return;
                applyReport(prev => {
                  const sep = prev.notes && !/\s$/.test(prev.notes) ? ' ' : '';
                  return { ...prev, notes: (prev.notes || '') + sep + text };
                });
                debouncedDictationSave();
              }}
            />
            {/* Note vocale (fichier audio joint) */}
            <div style={{ marginTop: '0.5rem' }}>
              <VoiceRecorder
                interventionId={interventionId}
                onUploaded={async (uploaded) => {
                  await persistReport(prev => ({ ...prev, files: [...(prev.files || []), ...uploaded] }));
                  saveScroll(); pendingRestoreRef.current = true;
                  if (!document.body.dataset.__scrollLocked) lock();
                  try { await refreshData?.(); } finally { unlock(); restoreScroll(); }
                }}
                onBeginCritical={lock}
                onEndCritical={unlock}
              />
            </div>

            {/* Liste des notes vocales enregistrées (lecture + suppression) */}
            {(() => {
              const audioFiles = (report.files || []).filter(f => f.type?.startsWith('audio/') || /\.(webm|mp4|m4a|mp3|ogg|wav)(\?|$)/i.test(f.url || ''));
              if (audioFiles.length === 0) return null;
              return (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🎧 Notes vocales ({audioFiles.length})
                  </div>
                  {audioFiles.map((f, i) => (
                    <div key={f.url || i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: '10px', padding: '0.5rem 0.65rem',
                    }}>
                      <audio controls preload="none" src={f.url} style={{ flex: 1, minWidth: 0, height: 38 }} />
                      <button onClick={async () => { if (window.confirm('Supprimer cette note vocale ?')) await handleDeleteImage(f); }}
                        title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1.05rem', flexShrink: 0 }}>
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Besoins */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between" onClick={() => setNeedsOpen(o => !o)}
              style={{ cursor: 'pointer', userSelect: 'none', marginBottom: needsOpen ? '0.75rem' : 0 }}>
              <h3 className="flex items-center gap-2" style={{ margin: 0, fontSize: '0.9rem' }}>
                <span style={{ display: 'inline-block', width: 16, textAlign: 'center' }}>{needsOpen ? '▼' : '▶'}</span>
                🧰 Besoins chantier {Array.isArray(report.needs) ? `(${report.needs.length})` : ''}
              </h3>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>Budget: <b>{needsTotal.toFixed(2)} €</b></div>
            </div>
            {needsOpen && (
              <div>
                {(!report.needs || report.needs.length === 0) && <p className="text-muted" style={{ marginTop: '0.5rem' }}>Aucun besoin pour le moment.</p>}
                {Array.isArray(report.needs) && report.needs.length > 0 && (
                  <ul className="document-list" style={{ marginTop: '0.5rem' }}>
                    {report.needs.map(n => (
                      <li key={n.id}>
                        <div style={{ flexGrow: 1 }}>
                          <p className="font-semibold">[{n.category || '—'}] {n.label}{n.qty ? ` × ${n.qty}` : ''} {n.urgent ? <span className="badge" style={{ marginLeft: 8 }}>Urgent</span> : null}</p>
                          <p className="text-muted" style={{ fontSize: '0.875rem' }}>{n.note || '—'} {typeof n.estimated_price === 'number' ? ` • Estimé: ${n.estimated_price.toFixed(2)} €` : ''}</p>
                        </div>
                        <button className="btn-icon-danger" onClick={() => removeNeed(n.id)} title="Supprimer">✖</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid" style={{ gridTemplateColumns: '160px 80px 120px 1fr 140px auto', gap: '0.5rem', alignItems: 'end', marginTop: '0.75rem' }}>
                  <div><label>Catégorie</label>
                    <select className="form-control" value={needDraft.category} onChange={e => setNeedDraft(v => ({ ...v, category: e.target.value }))}>
                      <option value="materiel">Matériel</option><option value="consommables">Consommables</option>
                      <option value="location">Location</option><option value="commande">Commande</option>
                    </select>
                  </div>
                  <div><label>Qté</label><input type="number" min={1} className="form-control" value={needDraft.qty} onChange={e => setNeedDraft(v => ({ ...v, qty: Math.max(1, Number(e.target.value) || 1) }))} /></div>
                  <div><label>Urgent ?</label><select className="form-control" value={needDraft.urgent ? '1' : '0'} onChange={e => setNeedDraft(v => ({ ...v, urgent: e.target.value === '1' }))}><option value="0">Non</option><option value="1">Oui</option></select></div>
                  <div><label>Intitulé</label><input className="form-control" value={needDraft.label} onChange={e => setNeedDraft(v => ({ ...v, label: e.target.value }))} placeholder="Ex: Tuyau 16mm" /></div>
                  <div><label>Prix estimé (€)</label><input className="form-control" value={needDraft.estimated_price} onChange={e => setNeedDraft(v => ({ ...v, estimated_price: e.target.value }))} placeholder="ex: 25.90" /></div>
                  <div><label>Note</label><input className="form-control" value={needDraft.note} onChange={e => setNeedDraft(v => ({ ...v, note: e.target.value }))} placeholder="Détail, lien, réf…" /></div>
                  <div style={{ gridColumn: '1 / -1' }}><button className="btn btn-primary" onClick={addNeed} disabled={!needDraft.label.trim()}>Ajouter</button></div>
                </div>
              </div>
            )}
          </div>

          {/* Signature (obligatoire) */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }} id="signature-section">
            <h3 style={{ fontSize: '0.9rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ✍️ Signature du client
              {signatureMissing && (
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: '#dc2626', padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase' }}>Obligatoire</span>
              )}
            </h3>
            {report.signature ? (
              <div>
                <img src={report.signature} alt="Signature" style={{ width: '100%', maxWidth: 300, border: '2px solid var(--border-color)', borderRadius: '0.5rem', background: '#fff' }} />
                <button onClick={async () => { await persistReport(prev => ({ ...prev, signature: null })); }}
                  className="btn btn-sm btn-secondary" style={{ marginTop: 8 }}>Effacer</button>
              </div>
            ) : (
              <div>
                <button onClick={() => setShowSignatureModal(true)}
                  style={{
                    width: '100%', maxWidth: 320, minHeight: 120, cursor: 'pointer',
                    border: `2px dashed ${signatureMissing ? '#dc2626' : 'var(--border-color-dark)'}`,
                    borderRadius: '0.6rem',
                    background: signatureMissing ? 'rgba(220,38,38,.05)' : 'var(--bg-secondary)',
                    color: signatureMissing ? '#dc2626' : 'var(--text-tertiary)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                    fontWeight: 600, fontSize: '0.9rem',
                  }}>
                  <span style={{ fontSize: '1.6rem' }}>✍️</span>
                  Appuyez pour faire signer
                </button>
              </div>
            )}
          </div>

          {/* Kilométrage de fin */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.9rem', marginTop: 0 }}>🚗 Kilométrage de fin</h3>
            <input type="number" min="0" step="1" value={report.km_end || ''} placeholder="Ex: 45430"
              onChange={(e) => handleReportChange('km_end', e.target.value ? parseInt(e.target.value) : null)}
              onBlur={persistIfDirty}
              className="form-control" style={{ maxWidth: '200px' }} />
            {intervention.km_start && report.km_end && (
              <small className="form-hint" style={{ display: 'block', marginTop: '0.5rem' }}>
                Distance parcourue : <strong>{report.km_end - intervention.km_start} km</strong>
              </small>
            )}
          </div>

          {/* CERFA */}
          {(intervention.type?.toLowerCase()?.includes('entretien') ||
            intervention.type?.toLowerCase()?.includes('chaudière') ||
            intervention.type?.toLowerCase()?.includes('chaudiere') ||
            intervention.service?.toLowerCase()?.includes('entretien')) && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.9rem', marginTop: 0 }}>📄 Attestation CERFA</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>Attestation d'entretien annuel (CERFA 15497-04).</p>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => { const data = prepareCerfaDataFromIntervention(intervention, { display_name: localStorage.getItem('user_name') || '' }); setCerfaData(data); setShowCerfaModal(true); }}>
                📄 Générer CERFA 15497
              </button>
            </div>
          )}

          {/* PV Réception */}
          <ReceptionForm
            intervention={intervention}
            organization={organization}
            technician={profile}
            onSaved={() => refreshData?.()}
            onClose={null}
          />
        </AccordionBlock>

        </div>{/* fin .intervention-blocks */}

        {/* ═══ CLÔTURE (panneaux d'info ; le bouton est dans la barre fixe) ════ */}
        {isAdmin ? (
          currentStatus !== 'Terminée' ? (
            (() => {
              const oublis = getEmployeeOublis();
              if (oublis.length === 0) return null;
              return (
                <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '0.6rem', marginTop: '0.25rem' }}>
                  <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem', fontSize: '0.9rem' }}>⚠️ Oublis de l'employé ({oublis.length})</div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#dc2626', fontSize: '0.875rem' }}>
                    {oublis.map((o, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{o}</li>)}
                  </ul>
                </div>
              );
            })()
          ) : (
            <div>
              {report.admin_oublis?.length > 0 && (
                <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '0.6rem' }}>
                  <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>Oublis de l'employé ({report.admin_oublis.length})</div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#dc2626', fontSize: '0.875rem' }}>
                    {report.admin_oublis.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                  {report.admin_closed_at && (
                    <div style={{ fontSize: '0.75rem', color: '#8b7968', marginTop: '0.5rem' }}>
                      Clôturée par admin le {new Date(report.admin_closed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
              <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '12px', color: '#166534', fontWeight: 700, textAlign: 'center' }}>
                ✓ Intervention terminée
              </div>
            </div>
          )
        ) : null}

        {/* Espace pour ne pas masquer le dernier bloc derrière la barre fixe */}
        {!isDone && <div className="intervention-bottom-spacer" />}
      </div>

      {/* ═══ BARRE D'ACTION FIXE (bas d'écran) ════════════════════════════════ */}
      {!isDone && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900,
          background: 'var(--card-bg)', borderTop: '1px solid var(--border-color)',
          boxShadow: '0 -4px 20px rgba(0,0,0,.12)',
          padding: '0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom, 0px))',
        }}>
          <div className="intervention-actionbar-inner" style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {missingRequired.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', fontWeight: 700, fontSize: '0.82rem' }}>
                  <span style={{ background: '#dc2626', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', flexShrink: 0 }}>
                    {missingRequired.length}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    À faire : {missingRequired.join(', ')}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success)', fontWeight: 700, fontSize: '0.85rem' }}>
                  ✓ Tout est prêt
                </div>
              )}
            </div>
            <button onClick={handleSave} disabled={isSaving} className="btn btn-primary"
              style={{ fontSize: '0.95rem', padding: '0.8rem 1.4rem', fontWeight: 700, borderRadius: '12px', flexShrink: 0, whiteSpace: 'nowrap' }}>
              {isSaving
                ? (<><LoaderIcon className="animate-spin" /> {isAdmin ? 'Clôture…' : 'Sauvegarde…'}</>)
                : (isAdmin ? '✓ Clôturer (Admin)' : '✓ Clôturer')}
            </button>
          </div>
        </div>
      )}

      {/* Modale signature */}
      {showSignatureModal && <SignatureModal onSave={async (sig) => {
        await persistReport(prev => ({ ...prev, signature: sig }));
        setShowSignatureModal(false);
      }} onCancel={() => setShowSignatureModal(false)} existingSignature={report.signature} />}

      {/* Modal CERFA */}
      <CerfaGeneratorModal
        isOpen={showCerfaModal}
        onClose={() => setShowCerfaModal(false)}
        initialData={cerfaData}
        sourceType="intervention"
        sourceId={intervention?.id}
        showToast={(msg) => alert(msg)}
      />

      {/* Modal Édition intervention (Admin) */}
      {isAdmin && onUpdateIntervention && (
        <EditInterventionModal
          isOpen={showEditModal}
          intervention={intervention}
          onSave={(updates) => onUpdateIntervention(intervention.id, updates)}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Modal Équipe (Admin) */}
      {isAdmin && onUpdateTeam && (
        <EditTeamModal
          isOpen={showTeamModal}
          intervention={intervention}
          users={users}
          onSave={async (selectedUserIds, dailyAssignments) => {
            await onUpdateTeam(intervention.id, selectedUserIds, dailyAssignments);
            setShowTeamModal(false);
          }}
          onCancel={() => setShowTeamModal(false)}
          loading={isUpdatingTeam}
        />
      )}
    </div>
  );
}
