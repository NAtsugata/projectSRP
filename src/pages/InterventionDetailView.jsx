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
  ImageWithProgress,
  InterventionHeader,
  QuickActionsBar,
  SmartAlerts,
  TimeTrackerEnhanced,
  CallButtons,
  ScheduledDatesEditor,
  SignatureModal,
  FileUploader,
  VoiceRecorder,
  StatusCard,
  ArrivalDeparture,
  PVReception,
} from '../components/intervention';
import { Tabs, Tab } from '../components/ui';
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

export default function InterventionDetailView({ interventions, onSave, onSaveSilent, isAdmin, dataVersion, refreshData, onUpdateScheduledDates, onUpdateAdminNote, onUpdateTeam, isUpdatingTeam, users = [], profile, organization }) {
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
  }, [restoreScroll]);

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
    if (!intervention?.id) return;
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

  return (
    <div className="intervention-detail-modern">
      {/* NOUVEAU HEADER MODERNE */}
      <InterventionHeader
        intervention={intervention}
        onBack={() => navigate('/planning')}
      />

      <div className="intervention-content">
        {/* CARTE DE RÉSUMÉ */}
        <StatusCard
          intervention={intervention}
          report={report}
          stats={stats}
        />

        {/* ALERTES INTELLIGENTES */}
        <SmartAlerts
          report={report}
          intervention={intervention}
          MIN_PHOTOS={MIN_REQUIRED_PHOTOS}
        />

        {/* ACTIONS RAPIDES */}
        <QuickActionsBar
          intervention={intervention}
          onAction={(action) => logger.log('Action:', action)}
        />

        {/* BOUTONS D'APPEL ULTRA-VISIBLES */}
        <CallButtons
          intervention={intervention}
          onCall={(label) => logger.log('Appel vers:', label)}
        />

        {/* CHRONOMÈTRE AVANCÉ AVEC PAUSE/REPRISE */}
        <div id="time-section">
          <TimeTrackerEnhanced
            report={report}
            onUpdateReport={persistReport}
            disabled={false}
          />
        </div>

        {/* ÉDITEUR DE DATES PLANIFIÉES (Admin uniquement) */}
        {isAdmin && onUpdateScheduledDates && (
          <ScheduledDatesEditor
            scheduledDates={intervention.scheduled_dates || []}
            onUpdate={(dates) => onUpdateScheduledDates(intervention.id, dates)}
            disabled={false}
          />
        )}

        {/* GESTION DE L'ÉQUIPE (Admin uniquement) */}
        {isAdmin && onUpdateTeam && (
          <div className="card-white" style={{ marginBottom: '1rem' }}>
            <div className="section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>👥 Équipe assignée</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowTeamModal(true)}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}
                >
                  Modifier l'équipe
                </button>
              </div>

              {/* Affichage de l'équipe actuelle */}
              {intervention.intervention_assignments && intervention.intervention_assignments.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {intervention.intervention_assignments.map((assignment, idx) => (
                    <span
                      key={assignment.user_id || idx}
                      className="badge"
                      style={{ background: '#3b82f6', color: 'white', padding: '0.35rem 0.6rem', borderRadius: '1rem' }}
                    >
                      {assignment.profiles?.full_name || 'Employé'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted" style={{ margin: 0 }}>Aucun employé assigné</p>
              )}

              {/* Affichage des assignations par jour si présentes */}
              {intervention.daily_assignments && Object.keys(intervention.daily_assignments).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#6b7280' }}>Équipe par jour :</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(intervention.daily_assignments).sort(([a], [b]) => a.localeCompare(b)).map(([date, userIds]) => {
                      const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                      const userNames = userIds.map(uid => {
                        const assignment = intervention.intervention_assignments?.find(a => a.user_id === uid);
                        return assignment?.profiles?.full_name || users.find(u => u.id === uid)?.full_name || 'Employé';
                      });
                      return (
                        <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 500, minWidth: '80px' }}>{formattedDate}</span>
                          <span style={{ color: '#374151' }}>{userNames.join(', ') || 'Aucun'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENU ORGANISÉ EN TABS */}
        <Tabs defaultTab={0}>
          {/* ONGLET INFOS */}
          <Tab label="Infos" icon="📋">
            <div>
              <h2 style={{ marginTop: 0 }}>{intervention.client}</h2>
              <p className="text-muted">{intervention.address}</p>

              {/* Statut + badges */}
              <div className="section">
                <h3>⚑ Statut de l'intervention</h3>
                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  <span className="badge">Statut actuel : {currentStatus}</span>
                  {urgentCount > 0 && <span className="badge" style={{ background: '#f59e0b', color: '#111827' }}>URG {urgentCount}</span>}
                </div>
              </div>

              {/* Arrivé / Départ - Nouveau composant */}
              <div className="section">
                <ArrivalDeparture
                  report={report}
                  onMarkArrival={() => markWithGeo('arrival')}
                  onMarkDeparture={() => markWithGeo('departure')}
                  disabled={false}
                />
              </div>

              {/* Admin Note Section */}
              <div className="section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>📝 Note Admin</h3>
                  {!isAdmin && intervention.admin_note && (
                    <button
                      onClick={() => setAdminNoteExpanded(!adminNoteExpanded)}
                      className="btn btn-sm btn-outline-secondary"
                      style={{ padding: '0.25rem 0.75rem' }}
                    >
                      {adminNoteExpanded ? '🔽 Réduire' : '🔼 Agrandir'}
                    </button>
                  )}
                </div>
                {isAdmin ? (
                  <textarea
                    className="form-control"
                    value={intervention.admin_note || ''}
                    onChange={(e) => {
                      setIntervention(prev => ({ ...prev, admin_note: e.target.value }));
                    }}
                    onBlur={(e) => onUpdateAdminNote && onUpdateAdminNote(intervention.id, e.target.value)}
                    placeholder="Note pour l'employé..."
                    rows={3}
                  />
                ) : (
                  <div
                    className="admin-note-display p-3 bg-gray-50 rounded border"
                    style={{
                      maxHeight: adminNoteExpanded ? 'none' : '150px',
                      overflow: adminNoteExpanded ? 'visible' : 'auto',
                      transition: 'max-height 0.3s ease'
                    }}
                  >
                    {intervention.admin_note ? (
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{intervention.admin_note}</p>
                    ) : (
                      <span className="text-muted">Aucune note.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Tab>

          {/* ONGLET PHOTOS */}
          <Tab label="Photos" icon="📷" badge={stats.photoCount > 0 ? stats.photoCount : null}>
            <div>
              <div className="section-header" style={{ marginBottom: '1rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>
                  <span className="section-title-icon">📷</span>
                  Photos et Documents <span style={{ fontSize: '0.7em', color: '#16a34a' }}>(v4.0 IndexedDB Cache)</span>
                  {report.files && report.files.length > 0 && (
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#6b7280', marginLeft: '0.5rem' }}>
                      ({report.files.length})
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {report.files && report.files.length > 1 && (
                    <button
                      onClick={handleDownloadAllAsZip}
                      disabled={isDownloadingZip}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      title="Télécharger tous les fichiers en ZIP"
                    >
                      <DownloadIcon />
                      {isDownloadingZip ? 'Préparation...' : 'Tout télécharger'}
                    </button>
                  )}
                  <button onClick={refreshData} className="btn-icon" title="Rafraîchir"><RefreshCwIcon /></button>
                </div>
              </div>

              {/* Galerie d'images optimisée avec pagination et lazy loading */}
              <ImageGalleryOptimized
                images={(report.files || []).filter(f => f.type?.startsWith('image/')).map(f => ({
                  url: f.url,
                  name: f.name,
                  type: f.type
                }))}
                uploadQueue={uploadQueue.filter(item => {
                  // Filtrer UNIQUEMENT les images (pas les PDFs ou audios)
                  const isImage = item.type?.startsWith('image/');
                  return isImage;
                })}
                emptyMessage="Aucune photo. Utilisez le bouton ci-dessous pour en ajouter."
                onDeleteImage={isAdmin ? handleDeleteImage : null}
              />

              {/* Upload de nouveaux fichiers */}
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
            </div>
          </Tab>

          {/* ONGLET CHECKPOINTS */}
          <Tab label="Checks" icon="✅" badge={stats.checkpointProgress}>
            <div>
              <h3 style={{ marginTop: 0 }}>Points de contrôle rapides</h3>
              {(!report.quick_checkpoints || report.quick_checkpoints.length === 0) && (
                <p className="text-muted">Aucun checkpoint défini pour cette intervention.</p>
              )}
              {Array.isArray(report.quick_checkpoints) && report.quick_checkpoints.map((checkpoint, index) => (
                <label
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: checkpoint.done ? '#ecfdf5' : '#f9fafb',
                    border: `2px solid ${checkpoint.done ? '#10b981' : '#e5e7eb'}`,
                    borderRadius: '0.5rem',
                    marginBottom: '0.5rem',
                    cursor: isAdmin ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkpoint.done || false}
                    onChange={(e) => {
                      if (isAdmin) return;
                      const updated = [...report.quick_checkpoints];
                      updated[index] = {
                        ...updated[index],
                        done: e.target.checked,
                        at: e.target.checked ? new Date().toISOString() : null
                      };
                      persistReport({ ...report, quick_checkpoints: updated });
                    }}
                    disabled={false}
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      accentColor: '#10b981'
                    }}
                  />
                  <span style={{
                    fontWeight: 500,
                    color: checkpoint.done ? '#059669' : '#374151',
                    textDecoration: checkpoint.done ? 'none' : 'none'
                  }}>
                    {checkpoint.label}
                  </span>
                  {checkpoint.done && checkpoint.at && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280' }}>
                      ✓ {new Date(checkpoint.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </Tab>

          {/* ONGLET RAPPORT */}
          <Tab label="Rapport" icon="📝">
            <div>
              {/* Rapport */}
              <div className="section" style={{ marginTop: 0 }}>
                <h3>📝 Rapport de chantier</h3>
                <textarea value={report.notes || ''} onChange={e => handleReportChange('notes', e.target.value)} placeholder="Détails, matériel, observations..." rows="5" className="form-control" readOnly={false} />
                <VoiceRecorder
                  interventionId={interventionId}
                  onUploaded={async (uploaded) => {
                    const updated = { ...report, files: [...(report.files || []), ...uploaded] };
                    await persistReport(updated);
                    saveScroll();
                    pendingRestoreRef.current = true;
                    if (!document.body.dataset.__scrollLocked) lock();
                    try {
                      await refreshData?.();
                    } finally {
                      unlock();
                      restoreScroll();
                    }
                  }}
                  onBeginCritical={lock}
                  onEndCritical={unlock}
                />
              </div>

              {/* Besoins */}
              <div className="section">
                <div className="flex items-center justify-between" onClick={() => setNeedsOpen(o => !o)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <h3 className="flex items-center gap-2" style={{ margin: 0 }}>
                    <span style={{ display: 'inline-block', width: 18, textAlign: 'center' }}>{needsOpen ? '▼' : '▶'}</span>
                    🧰 Besoins chantier {Array.isArray(report.needs) ? `(${report.needs.length})` : ''}
                  </h3>
                  <div className="text-muted">Budget estimé: <b>{needsTotal.toFixed(2)} €</b></div>
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
                              <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                                {n.note || '—'} {typeof n.estimated_price === 'number' ? ` • Estimé: ${n.estimated_price.toFixed(2)} €` : ''}
                              </p>
                            </div>
                            <button className="btn-icon-danger" onClick={() => removeNeed(n.id)} title="Supprimer">✖</button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="grid" style={{ gridTemplateColumns: '160px 80px 120px 1fr 140px auto', gap: '0.5rem', alignItems: 'end', marginTop: '0.75rem' }}>
                      <div><label>Catégorie</label>
                        <select className="form-control" value={needDraft.category} onChange={e => setNeedDraft(v => ({ ...v, category: e.target.value }))}>
                          <option value="materiel">Matériel</option>
                          <option value="consommables">Consommables</option>
                          <option value="location">Location</option>
                          <option value="commande">Commande</option>
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
              <div className="section" id="signature-section">
                <h3>✍️ Signature du client</h3>
                {report.signature ? (
                  <div>
                    <img src={report.signature} alt="Signature" style={{ width: '100%', maxWidth: 300, border: '2px solid #e5e7eb', borderRadius: '0.5rem', background: '#f8f9fa' }} />
                    <button onClick={async () => {
                      handleReportChange('signature', null);
                      const updated = { ...report, signature: null };
                      await persistReport(updated);
                    }} className="btn btn-sm btn-secondary" style={{ marginTop: 8 }}>Effacer</button>
                  </div>
                ) : (
                  <div>
                    <canvas width="300" height="150" style={{ border: '2px dashed #cbd5e1', borderRadius: '0.5rem', width: '100%', maxWidth: 300, background: '#f8fafc' }} />
                    <div style={{ marginTop: 8 }}><button onClick={() => setShowSignatureModal(true)} className="btn btn-secondary"><ExpandIcon /> Agrandir</button></div>
                  </div>
                )}
              </div>

              {/* Kilométrage de fin */}
              <div className="section">
                <h3>🚗 Kilométrage de fin</h3>
                <div className="form-group">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={report.km_end || ''}
                    onChange={(e) => handleReportChange('km_end', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Ex: 45430"
                    className="form-control"
                    style={{ maxWidth: '200px' }}
                    readOnly={false}
                  />
                  {intervention.km_start && report.km_end && (
                    <small className="form-hint" style={{ display: 'block', marginTop: '0.5rem' }}>
                      Distance parcourue : <strong>{report.km_end - intervention.km_start} km</strong>
                    </small>
                  )}
                </div>
              </div>

              {/* Génération CERFA - visible pour interventions entretien chaudière */}
              {(intervention.type?.toLowerCase()?.includes('entretien') ||
                intervention.type?.toLowerCase()?.includes('chaudière') ||
                intervention.type?.toLowerCase()?.includes('chaudiere') ||
                intervention.service?.toLowerCase()?.includes('entretien')) && (
                  <div className="section">
                    <h3>📄 Attestation CERFA</h3>
                    <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
                      Générez l'attestation d'entretien annuel (CERFA 15497-04) pour cette intervention.
                    </p>
                    <button
                      onClick={() => {
                        const data = prepareCerfaDataFromIntervention(intervention, profile || { display_name: localStorage.getItem('user_name') || '' }, organization);
                        setCerfaData(data);
                        setShowCerfaModal(true);
                      }}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      📄 Générer CERFA 15497
                    </button>
                  </div>
                )}

              {/* Procès-Verbal de Réception */}
              <div className="section" style={{ padding: 0, background: 'transparent', boxShadow: 'none' }}>
                <ReceptionForm
                  intervention={intervention}
                  organization={organization}
                  technician={profile}
                  onSaved={() => refreshData?.()}
                  onClose={null}
                />
              </div>
            </div>
          </Tab>
        </Tabs>

        {/* Save button section */}
        {isAdmin ? (
          currentStatus !== 'Terminée' ? (
            <>
              {/* Afficher les oublis de l'employé */}
              {(() => {
                const oublis = getEmployeeOublis();
                if (oublis.length === 0) return null;
                return (
                  <div className="mt-4" style={{ padding: '1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                    <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>
                      Oublis de l'employé ({oublis.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#dc2626', fontSize: '0.875rem' }}>
                      {oublis.map((o, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{o}</li>)}
                    </ul>
                    <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '0.5rem', fontStyle: 'italic' }}>
                      Ces oublis seront enregistrés dans le rapport.
                    </div>
                  </div>
                );
              })()}
              <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{ fontSize: '1rem', padding: '1rem', fontWeight: 600 }}>
                {isSaving ? (<><LoaderIcon className="animate-spin" /> Clôture...</>) : 'Clôturer l\'intervention (Admin)'}
              </button>
            </>
          ) : (
            <div>
              {Array.isArray(report.admin_oublis) && report.admin_oublis.length > 0 && (
                <div className="mt-4" style={{ padding: '1rem', background: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                  <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>
                    Oublis de l'employé ({report.admin_oublis.length})
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#dc2626', fontSize: '0.875rem' }}>
                    {report.admin_oublis.map((o, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{o}</li>)}
                  </ul>
                  {report.admin_closed_at && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      Clôturée par admin le {new Date(report.admin_closed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
              <div className="text-center mt-4" style={{ padding: '1rem', background: '#dcfce7', borderRadius: '0.5rem', color: '#166534', fontWeight: 600 }}>
                Intervention terminée
              </div>
            </div>
          )
        ) : (
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary w-full mt-4" style={{ fontSize: '1rem', padding: '1rem', fontWeight: 600 }}>
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
        organization={organization}
        showToast={(msg, type) => alert(msg)}
      />

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
