// =============================
// FILE: src/pages/InterventionDetailView.js — REFACTORÉ
// Utilise les composants extraits pour une meilleure maintenabilité
// =============================
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
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
  ArrivalDeparture,
} from '../components/intervention';
import InterventionLots from '../components/intervention/InterventionLots';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import CerfaGeneratorModal from '../components/CerfaGeneratorModal';
import ReceptionForm from '../components/ReceptionForm';
import { EditTeamModal } from '../components/planning';
import { prepareCerfaDataFromIntervention } from '../utils/cerfaService';
import logger from '../utils/logger';
import './InterventionDetailView_Modern.css';

const MIN_REQUIRED_PHOTOS = 2;

const isImageUrl = (f) => {
  // Check MIME type property first (most reliable for uploaded files)
  if (typeof f === 'object' && f?.type?.startsWith('image/')) {
    return true;
  }
  // Fall back to URL pattern matching for legacy/string entries
  const u = typeof f === 'string' ? f : f?.url;
  if (!u) return false;
  return u.startsWith('data:image/') || /(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.tiff?)($|\?)/i.test(u);
};
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
      background: '#ffffff',
      border: '1px solid #ecddcf',
      borderRadius: '10px',
      padding: '0.6rem 0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8b7968', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1f1410', lineHeight: 1.35 }}>
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
function AccordionBlock({ icon, title, summary, defaultOpen = false, badge, children, danger = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: '#fff',
      border: danger ? '1px solid #f4c7c3' : '1px solid #ecddcf',
      borderRadius: '14px', marginBottom: '0.6rem',
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.85rem 1rem', background: 'none', border: 'none',
        cursor: 'pointer', borderLeft: `4px solid ${danger ? '#b84c3a' : '#b87333'}`,
        textAlign: 'left',
      }}>
        <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: '#1f1410' }}>{title}</span>
        {badge != null && (
          <span style={{ fontSize: '0.75rem', background: '#f5ede4', color: '#9c5e22', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, marginRight: '0.3rem', flexShrink: 0 }}>
            {badge}
          </span>
        )}
        {summary && <span style={{ fontSize: '0.8rem', color: '#8b7968', marginRight: '0.3rem', flexShrink: 0, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>}
        <span style={{ color: '#b87333', fontSize: '0.8rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: '0.75rem 1rem 1rem', borderTop: '1px solid #f4e5d9' }}>
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
      files: Array.isArray(r.files) ? r.files : [],
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
      // ✅ Fusionner le report pour obtenir les nouveaux fichiers uploadés
      setReport(prev => {
        const currentReport = prev || ensureReportSchema(found.report);
        return {
          ...currentReport,  // Garde les changements locaux
          files: found.report?.files || currentReport.files,  // ✅ UPDATE files depuis la BDD
          updated_at: found.updated_at
        };
      });
      setLoading(false);
    } else {
      // Si on a reçu les données (tableau vide ou pas le bon ID) et qu'on a fini de charger côté parent
      // On arrête le loading local pour afficher l'état vide/erreur
      if (interventions !== undefined) {
        setLoading(false);
      }
    }
  }, [interventions, interventionId, navigate, dataVersion, ensureReportSchema]);

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
          setReport(prev => ({ ...prev, files: refreshedFiles }));
        }
      } catch (error) {
        logger.error('❌ Erreur rafraîchissement URLs:', error);
      }
    };

    refreshFileUrls();
  }, [intervention?.id]); // Rafraîchir quand l'intervention change

  // ✅ Persistance simplifiée du report (le lock/unlock est géré par beginCriticalPicker)
  const persistReport = useCallback(async (updated) => {
    setReport(updated);
    try {
      const res = await onSaveSilent(intervention.id, updated);
      if (res?.error) alert('Échec de la sauvegarde du rapport');
    } catch (e) {
      logger.error(e);
      alert('Échec de la sauvegarde du rapport');
    }
    // ✅ Pas de lock/unlock ici, le parent gère la stabilisation du scroll
  }, [intervention, onSaveSilent]);

  const handleReportChange = (field, value) => setReport(prev => ({ ...prev, [field]: value }));

  // Sauvegarde du PV de réception
  const handlePVSave = useCallback(async (pvData) => {
    const updated = { ...report, pv_reception: pvData };
    await persistReport(updated);
    alert('✓ Procès-Verbal de Réception enregistré');
  }, [report, persistReport]);

  // Reusable upload completion handler
  const handleUploadComplete = useCallback(async (uploaded) => {
    logger.log('✅ Upload terminé, ajout de', uploaded.length, 'fichiers');

    // Ajouter les fichiers au rapport
    const updated = { ...report, files: [...(report.files || []), ...uploaded] };
    setReport(updated);
    await persistReport(updated);

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
  }, [report, persistReport, refreshData]);

  // Paste handler désactivé (nécessiterait une ré-implémentation avec FileUploader)

  // -------- Suppression d'image --------
  const handleDeleteImage = useCallback(async (image) => {
    try {
      logger.log('🗑️ Suppression de l\'image:', image.url);

      // Supprimer du stockage Supabase
      const { error: storageError } = await storageService.deleteInterventionFile(image.url);

      if (storageError) {
        logger.error('Erreur suppression stockage:', storageError);
        throw new Error('Impossible de supprimer le fichier du stockage');
      }

      // Supprimer du rapport
      const updatedFiles = (report.files || []).filter(f => f.url !== image.url);
      const updated = { ...report, files: updatedFiles };

      // Persister
      await persistReport(updated);

      logger.log('✅ Image supprimée avec succès');
    } catch (error) {
      logger.error('❌ Erreur suppression image:', error);
      throw error;
    }
  }, [report, persistReport]);

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
    const updated = { ...report, needs: [...(report.needs || []), item] };
    await persistReport(updated);
    setNeedDraft({ label: '', qty: 1, urgent: false, note: '', category: 'materiel', estimated_price: '' });
  };
  const removeNeed = async (id) => {
    const updated = { ...report, needs: (report.needs || []).filter(n => n.id !== id) };
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
  }, [report, lock, unlock, saveScroll, restoreScroll, persistReport]); // eslint-disable-line react-hooks/exhaustive-deps

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
    photoCount: report.files?.filter(f => f.type?.startsWith('image/')).length || 0,
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

  return (
    <div className="intervention-detail-modern">
      <div className="intervention-content">

        {/* ═══ BLOC HERO ═══════════════════════════════════════════════════════ */}
        <div style={{
          background: 'linear-gradient(135deg, #faf6f1 0%, #f5ede4 100%)',
          border: '1px solid #ecddcf', borderRadius: '16px',
          padding: '1.1rem 1.2rem', marginBottom: '0.6rem',
          boxShadow: '0 2px 8px rgba(184,115,51,.1)',
        }}>
          {/* Ligne 1 : retour + statut + modifier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
            <button onClick={() => navigate('/planning')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', padding: '4px 8px', color: '#b87333', lineHeight: 1, marginLeft: '-4px' }}>
              ←
            </button>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              background: STATUS_BG[currentStatus] || '#f0e7dc', color: STATUS_COLOR[currentStatus] || '#8b7968', flexShrink: 0 }}>
              {currentStatus}
            </span>
            {urgentCount > 0 && (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#fef3c7', color: '#92400e', flexShrink: 0 }}>
                ⚠️ {urgentCount} urgent{urgentCount > 1 ? 's' : ''}
              </span>
            )}
            <span style={{ flex: 1 }} />
            {isAdmin && onUpdateIntervention && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)} style={{ minHeight: '36px', flexShrink: 0 }}>
                ✏️ Modifier
              </button>
            )}
          </div>
          {/* Ligne 2 : nom client + service */}
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1f1410', lineHeight: 1.2, marginBottom: '0.15rem', wordBreak: 'break-word' }}>
            {intervention.client}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#9c5e22', fontWeight: 600, marginBottom: '0.9rem' }}>
            {intervention.service}
          </div>
          {/* Ligne 3 : boutons d'action rapide */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {intervention.client_phone && (
              <a href={`tel:${intervention.client_phone}`} className="btn btn-primary btn-sm"
                style={{ minHeight: '40px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                📞 Appeler
              </a>
            )}
            {intervention.client_phone && (
              <a href={`sms:${intervention.client_phone}`} className="btn btn-secondary btn-sm"
                style={{ minHeight: '40px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                💬 SMS
              </a>
            )}
            {intervention.address && (
              <button className="btn btn-secondary btn-sm" style={{ minHeight: '40px' }}
                onClick={() => { navigator.clipboard?.writeText(intervention.address); }}>
                🗺️ Adresse
              </button>
            )}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button className="btn btn-secondary btn-sm" style={{ minHeight: '40px' }}
                onClick={() => navigator.share({ title: intervention.client, text: `${intervention.client} — ${intervention.address || ''}` }).catch(() => {})}>
                ↗ Partager
              </button>
            )}
          </div>
        </div>

        {/* ═══ ALERTES ════════════════════════════════════════════════════════ */}
        <SmartAlerts
          report={report}
          intervention={intervention}
          MIN_PHOTOS={MIN_REQUIRED_PHOTOS}
        />

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

        {/* ═══ POINTS DE CONTRÔLE ════════════════════════════════════════════ */}
        <AccordionBlock icon="✅" title="Points de contrôle" defaultOpen badge={stats.checkpointProgress}>
          {(!report.quick_checkpoints || report.quick_checkpoints.length === 0) && (
            <p className="text-muted">Aucun checkpoint défini pour cette intervention.</p>
          )}
          {Array.isArray(report.quick_checkpoints) && report.quick_checkpoints.map((checkpoint, index) => (
            <label key={index} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: checkpoint.done ? '#ecfdf5' : '#f9fafb',
              border: `2px solid ${checkpoint.done ? '#10b981' : '#e5e7eb'}`,
              borderRadius: '0.5rem', marginBottom: '0.5rem',
              cursor: isAdmin ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
            }}>
              <input type="checkbox" checked={checkpoint.done || false}
                onChange={(e) => {
                  if (isAdmin) return;
                  const updated = [...report.quick_checkpoints];
                  updated[index] = { ...updated[index], done: e.target.checked, at: e.target.checked ? new Date().toISOString() : null };
                  persistReport({ ...report, quick_checkpoints: updated });
                }}
                disabled={false} style={{ width: '1.25rem', height: '1.25rem', accentColor: '#10b981' }}
              />
              <span style={{ fontWeight: 500, color: checkpoint.done ? '#059669' : '#374151', flex: 1 }}>
                {checkpoint.label}
              </span>
              {checkpoint.done && checkpoint.at && (
                <span style={{ fontSize: '0.75rem', color: '#8b7968' }}>
                  ✓ {new Date(checkpoint.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </label>
          ))}

          {/* Note Admin */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f4e5d9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#473a30' }}>📝 Note Admin</span>
              {!isAdmin && intervention.admin_note && (
                <button onClick={() => setAdminNoteExpanded(!adminNoteExpanded)}
                  className="btn btn-sm btn-outline-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}>
                  {adminNoteExpanded ? '🔽 Réduire' : '🔼 Agrandir'}
                </button>
              )}
            </div>
            {isAdmin ? (
              <textarea className="form-control"
                value={intervention.admin_note || ''}
                onChange={(e) => setIntervention(prev => ({ ...prev, admin_note: e.target.value }))}
                onBlur={(e) => onUpdateAdminNote && onUpdateAdminNote(intervention.id, e.target.value)}
                placeholder="Note pour l'employé..." rows={3}
              />
            ) : (
              <div style={{
                maxHeight: adminNoteExpanded ? 'none' : '120px',
                overflow: adminNoteExpanded ? 'visible' : 'auto',
                background: '#faf6f1', borderRadius: '8px', padding: '0.6rem 0.8rem', border: '1px solid #ecddcf',
              }}>
                {intervention.admin_note
                  ? <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.88rem', color: '#473a30' }}>{intervention.admin_note}</p>
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
                  <a href={`tel:${intervention.client_phone}`} style={{ color: '#9c5e22', fontWeight: 600, textDecoration: 'none' }}>{intervention.client_phone}</a>
                )}
                {intervention.secondary_phone && (
                  <span> · <a href={`tel:${intervention.secondary_phone}`} style={{ color: '#9c5e22', textDecoration: 'none' }}>{intervention.secondary_phone}</a></span>
                )}
              </InfoRow>
            )}
            {intervention.client_email && (
              <InfoRow icon="✉️" label="Email">
                <a href={`mailto:${intervention.client_email}`} style={{ color: '#9c5e22', textDecoration: 'none', wordBreak: 'break-all' }}>{intervention.client_email}</a>
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
              <span style={{ fontSize: '0.85rem', color: '#8b7968' }}>Membres assignés</span>
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
              <div style={{ borderTop: '1px solid #f4e5d9', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8b7968', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
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
                        <span style={{ fontWeight: 600, minWidth: '80px', color: '#473a30' }}>{formattedDate}</span>
                        <span style={{ color: '#374151' }}>{userNames.join(', ') || 'Aucun'}</span>
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

        {/* ═══ PHOTOS ══════════════════════════════════════════════════════════ */}
        <AccordionBlock icon="📷" title="Photos et documents" badge={stats.photoCount > 0 ? stats.photoCount : null}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#8b7968' }}>
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
            images={(report.files || []).filter(f => f.type?.startsWith('image/')).map(f => ({ url: f.url, name: f.name, type: f.type }))}
            uploadQueue={uploadQueue.filter(item => item.type?.startsWith('image/'))}
            emptyMessage="Aucune photo. Utilisez le bouton ci-dessous pour en ajouter."
            onDeleteImage={isAdmin ? handleDeleteImage : null}
          />
          <div style={{ marginTop: '1rem' }}>
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
        <AccordionBlock icon="📝" title="Rapport de chantier">
          {/* Notes */}
          <div style={{ marginBottom: '1rem' }}>
            <textarea value={report.notes || ''} onChange={e => handleReportChange('notes', e.target.value)}
              placeholder="Détails, matériel, observations..." rows="5" className="form-control" />
            <VoiceRecorder
              interventionId={interventionId}
              onUploaded={async (uploaded) => {
                const updated = { ...report, files: [...(report.files || []), ...uploaded] };
                await persistReport(updated);
                saveScroll(); pendingRestoreRef.current = true;
                if (!document.body.dataset.__scrollLocked) lock();
                try { await refreshData?.(); } finally { unlock(); restoreScroll(); }
              }}
              onBeginCritical={lock}
              onEndCritical={unlock}
            />
          </div>

          {/* Besoins */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f4e5d9' }}>
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

          {/* Signature */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f4e5d9' }} id="signature-section">
            <h3 style={{ fontSize: '0.9rem', marginTop: 0 }}>✍️ Signature du client</h3>
            {report.signature ? (
              <div>
                <img src={report.signature} alt="Signature" style={{ width: '100%', maxWidth: 300, border: '2px solid #ecddcf', borderRadius: '0.5rem', background: '#f8f9fa' }} />
                <button onClick={async () => { handleReportChange('signature', null); await persistReport({ ...report, signature: null }); }}
                  className="btn btn-sm btn-secondary" style={{ marginTop: 8 }}>Effacer</button>
              </div>
            ) : (
              <div>
                <canvas width="300" height="150" style={{ border: '2px dashed #cbd5e1', borderRadius: '0.5rem', width: '100%', maxWidth: 300, background: '#f8fafc' }} />
                <div style={{ marginTop: 8 }}><button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon /> Agrandir</button></div>
              </div>
            )}
          </div>

          {/* Kilométrage de fin */}
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f4e5d9' }}>
            <h3 style={{ fontSize: '0.9rem', marginTop: 0 }}>🚗 Kilométrage de fin</h3>
            <input type="number" min="0" step="1" value={report.km_end || ''} placeholder="Ex: 45430"
              onChange={(e) => handleReportChange('km_end', e.target.value ? parseInt(e.target.value) : null)}
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
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #f4e5d9' }}>
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

        {/* ═══ CLÔTURE ═════════════════════════════════════════════════════════ */}
        {isAdmin ? (
          currentStatus !== 'Terminée' ? (
            <>
              {(() => {
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
              })()}
              <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full"
                style={{ fontSize: '1rem', padding: '1rem', fontWeight: 700, borderRadius: '12px', marginTop: '0.25rem' }}>
                {isSaving ? (<><LoaderIcon className="animate-spin" /> Clôture...</>) : 'Clôturer l\'intervention (Admin)'}
              </button>
            </>
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
        ) : (
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full"
            style={{ fontSize: '1rem', padding: '1rem', fontWeight: 700, borderRadius: '12px', marginTop: '0.25rem' }}>
            {isSaving ? (<><LoaderIcon className="animate-spin" /> Sauvegarde...</>) : 'Sauvegarder et Clôturer'}
          </button>
        )}

      </div>

      {/* Modale signature */}
      {showSignatureModal && <SignatureModal onSave={async (sig) => {
        handleReportChange('signature', sig);
        const updated = { ...report, signature: sig };
        await persistReport(updated);
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
