// src/pages/ChantierDetailView.jsx
// Détail d'un chantier : vue d'ensemble (avancement lots/zones), gestion des
// lots (MOE), tâches (fait par l'entreprise / validé par la MOE), photos
// contextualisées (zéro perte), journal d'audit (MOE), alertes ciblées (MOE).

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chantierService } from '../services/chantierService';
import { useAuthStore } from '../store/authStore';
import { useUsers } from '../hooks/useUsers';
import { useToast } from '../contexts/ToastContext';
import { LoadingSpinner } from '../components/ui';
import { DOC_CATEGORIES, DOC_CATEGORY_LABEL } from '../config/chantierPresets';
import './ChantiersView.css';

const LOT_STATUS = { a_demarrer: 'À démarrer', en_cours: 'En cours', termine: 'Terminé', valide: 'Validé' };
const TASK_STATUS = { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', valide: 'Validé' };
const EVENT_LABELS = {
  chantier_cree: 'Chantier créé', chantier_statut: 'Statut chantier modifié', chantier_modifie: 'Chantier modifié',
  zone_creee: 'Zone créée', zone_supprimee: 'Zone supprimée',
  lot_cree: 'Lot créé', lot_supprime: 'Lot supprimé', lot_statut: 'Statut lot', lot_avancement: 'Avancement lot',
  membre_ajoute: 'Membre ajouté', membre_retire: 'Membre retiré',
  tache_creee: 'Tâche créée', tache_faite: 'Tâche marquée faite', tache_validee: 'Tâche validée', tache_statut: 'Statut tâche',
  photo_ajoutee: 'Photo ajoutée', photo_supprimee: 'Photo retirée', photo_restauree: 'Photo restaurée',
  alerte_envoyee: 'Alerte envoyée',
};

export default function ChantierDetailView() {
  const { chantierId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuthStore();
  const isAdmin = !!profile?.is_admin;
  const { users } = useUsers();

  const [chantier, setChantier] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [media, setMedia] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [journal, setJournal] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: t }, { data: m }, { data: d }] = await Promise.all([
      chantierService.getChantier(chantierId),
      chantierService.getTasks(chantierId),
      chantierService.getMedia(chantierId),
      chantierService.getDocuments(chantierId),
    ]);
    setChantier(c || null);
    setTasks(t || []);
    setMedia(m || []);
    setDocuments(d || []);
    if (isAdmin) {
      const { data: j } = await chantierService.getJournal(chantierId);
      setJournal(j || []);
    }
    setLoading(false);
  }, [chantierId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const lots = chantier?.chantier_lots || [];
  const zones = chantier?.chantier_zones || [];
  const globalProgress = useMemo(() => {
    if (!lots.length) return 0;
    return Math.round(lots.reduce((s, l) => s + (l.progress || 0), 0) / lots.length);
  }, [lots]);

  if (loading) return <LoadingSpinner text="Chargement du chantier..." />;
  if (!chantier) {
    return (
      <div className="chantiers-view">
        <p>Chantier introuvable ou accès non autorisé.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/chantiers')}>← Retour</button>
      </div>
    );
  }

  return (
    <div className="chantiers-view">
      <button className="chantier-back" onClick={() => navigate('/chantiers')}>← Tous les chantiers</button>
      <div className="chantiers-header">
        <div>
          <h2>{chantier.name}</h2>
          <p className="chantiers-subtitle">
            {chantier.client_name ? `${chantier.client_name} · ` : ''}{chantier.address || ''}
          </p>
        </div>
        <div className="chantier-global-progress">
          <span className="chantier-progress-label big">{globalProgress}%</span>
          <span className="muted">avancement global</span>
        </div>
      </div>

      <div className="chantier-tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Vue d'ensemble</button>
        <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>Tâches</button>
        <button className={tab === 'docs' ? 'active' : ''} onClick={() => setTab('docs')}>Documents</button>
        <button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}>Photos</button>
        {isAdmin && <button className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}>Journal</button>}
        {isAdmin && <button className={tab === 'alert' ? 'active' : ''} onClick={() => setTab('alert')}>Alertes</button>}
      </div>

      {tab === 'overview' && (
        <OverviewTab chantier={chantier} lots={lots} zones={zones} isAdmin={isAdmin} users={users} reload={load} toast={toast} />
      )}
      {tab === 'tasks' && (
        <TasksTab chantier={chantier} lots={lots} zones={zones} tasks={tasks} isAdmin={isAdmin} reload={load} toast={toast} />
      )}
      {tab === 'docs' && (
        <DocumentsTab chantier={chantier} lots={lots} documents={documents} isAdmin={isAdmin} profile={profile} reload={load} toast={toast} />
      )}
      {tab === 'media' && (
        <MediaTab chantier={chantier} lots={lots} zones={zones} media={media} isAdmin={isAdmin} profile={profile} reload={load} toast={toast} />
      )}
      {tab === 'journal' && isAdmin && <JournalTab journal={journal} />}
      {tab === 'alert' && isAdmin && <AlertTab chantier={chantier} lots={lots} toast={toast} reload={load} />}
    </div>
  );
}

// ---------- Vue d'ensemble ----------
function OverviewTab({ chantier, lots, zones, isAdmin, users, reload, toast }) {
  const [showLot, setShowLot] = useState(false);
  const [lotName, setLotName] = useState('');
  const [cdc, setCdc] = useState('');
  const [showZone, setShowZone] = useState(false);
  const [zoneName, setZoneName] = useState('');

  const addLot = async () => {
    if (!lotName.trim()) return;
    const { error } = await chantierService.createLot(chantier.id, { name: lotName.trim(), cahier_des_charges: cdc || null });
    if (error) return toast?.error(error.message);
    toast?.success('Lot ajouté'); setLotName(''); setCdc(''); setShowLot(false); reload();
  };
  const addZone = async () => {
    if (!zoneName.trim()) return;
    const { error } = await chantierService.createZone(chantier.id, zoneName.trim());
    if (error) return toast?.error(error.message);
    toast?.success('Zone ajoutée'); setZoneName(''); setShowZone(false); reload();
  };
  const setLotProgress = async (lot, progress) => {
    const status = progress >= 100 ? 'termine' : progress > 0 ? 'en_cours' : 'a_demarrer';
    const { error } = await chantierService.updateLot(lot.id, { progress, status });
    if (error) return toast?.error(error.message);
    reload();
  };
  const validateLot = async (lot) => {
    const { error } = await chantierService.updateLot(lot.id, { status: 'valide', progress: 100 });
    if (error) return toast?.error(error.message);
    toast?.success('Lot validé'); reload();
  };
  const addMember = async (lot, userId) => {
    if (!userId) return;
    const { error } = await chantierService.addLotMember(lot, userId);
    if (error) return toast?.error(error.message);
    toast?.success('Membre ajouté'); reload();
  };
  const removeMember = async (memberId) => {
    const { error } = await chantierService.removeLotMember(memberId);
    if (error) return toast?.error(error.message);
    reload();
  };

  return (
    <div className="chantier-section">
      {isAdmin && (
        <div className="chantier-zones-block">
          <div className="chantier-block-head">
            <h3>Zones</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowZone(v => !v)}>+ Zone</button>
          </div>
          {showZone && (
            <div className="inline-add">
              <input className="form-control" placeholder="Nom de la zone" value={zoneName}
                onChange={(e) => setZoneName(e.target.value)} />
              <button className="btn btn-primary btn-sm" onClick={addZone}>Ajouter</button>
            </div>
          )}
          <div className="chantier-zone-chips">
            {zones.length === 0 && <span className="muted">Aucune zone</span>}
            {zones.map(z => <span key={z.id} className="zone-chip">{z.name}</span>)}
          </div>
        </div>
      )}

      <div className="chantier-block-head">
        <h3>Lots (corps de métier)</h3>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setShowLot(v => !v)}>+ Lot</button>}
      </div>

      {showLot && isAdmin && (
        <div className="inline-add col">
          <input className="form-control" placeholder="Nom du lot (ex : Plomberie)" value={lotName}
            onChange={(e) => setLotName(e.target.value)} />
          <textarea className="form-control" placeholder="Cahier des charges (facultatif)" rows={2}
            value={cdc} onChange={(e) => setCdc(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={addLot}>Ajouter le lot</button>
        </div>
      )}

      {lots.length === 0 && <p className="muted">Aucun lot défini.</p>}
      <div className="chantier-lots">
        {lots.map(lot => {
          const members = lot.chantier_lot_members || [];
          const assignedIds = new Set(members.map(m => m.user_id));
          const available = (users || []).filter(u => !assignedIds.has(u.id) && (u.employee_status || 'actif') !== 'licencié');
          return (
            <div key={lot.id} className="lot-card">
              <div className="lot-card-head">
                <div>
                  <h4>{lot.name}</h4>
                  {lot.subcontractors?.company_name && <span className="muted">{lot.subcontractors.company_name}</span>}
                </div>
                <span className={`lot-badge lot-${lot.status}`}>{LOT_STATUS[lot.status]}</span>
              </div>
              {lot.cahier_des_charges && <p className="lot-cdc">{lot.cahier_des_charges}</p>}

              <div className="chantier-progress">
                <div className="chantier-progress-bar">
                  <div className="chantier-progress-fill" style={{ width: `${lot.progress}%` }} />
                </div>
                <span className="chantier-progress-label">{lot.progress}%</span>
              </div>

              {isAdmin && (
                <div className="lot-admin">
                  <input type="range" min="0" max="100" step="10" value={lot.progress}
                    onChange={(e) => setLotProgress(lot, parseInt(e.target.value, 10))} />
                  {lot.status !== 'valide' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => validateLot(lot)}>Valider le lot</button>
                  )}
                  <div className="lot-members">
                    {members.map(m => (
                      <span key={m.id} className="member-chip">
                        {m.profiles?.full_name || 'Membre'}
                        <button onClick={() => removeMember(m.id)} title="Retirer">×</button>
                      </span>
                    ))}
                    {available.length > 0 && (
                      <select className="member-add" defaultValue="" onChange={(e) => { addMember(lot, e.target.value); e.target.value = ''; }}>
                        <option value="" disabled>+ Assigner…</option>
                        {available.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )}
              {!isAdmin && members.length > 0 && (
                <div className="lot-members">
                  {members.map(m => <span key={m.id} className="member-chip">{m.profiles?.full_name || 'Membre'}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tâches ----------
function TasksTab({ chantier, lots, zones, tasks, isAdmin, reload, toast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ lot_id: '', zone_id: '', title: '' });

  const addTask = async () => {
    if (!form.lot_id || !form.title.trim()) return toast?.error('Lot et titre requis');
    const { error } = await chantierService.createTask(chantier.id, form.lot_id, form.zone_id || null, form.title.trim());
    if (error) return toast?.error(error.message);
    toast?.success('Tâche ajoutée'); setForm({ lot_id: '', zone_id: '', title: '' }); setShowAdd(false); reload();
  };
  const setStatus = async (task, status) => {
    const { error } = await chantierService.setTaskStatus(task.id, status);
    if (error) return toast?.error(error.message);
    reload();
  };

  const lotName = (id) => lots.find(l => l.id === id)?.name || '—';

  return (
    <div className="chantier-section">
      <div className="chantier-block-head">
        <h3>Cahier des charges / tâches</h3>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>+ Tâche</button>}
      </div>
      {showAdd && isAdmin && (
        <div className="inline-add col">
          <select className="form-control" value={form.lot_id} onChange={(e) => setForm({ ...form, lot_id: e.target.value })}>
            <option value="">Lot…</option>
            {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="form-control" value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
            <option value="">Zone (facultatif)…</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <input className="form-control" placeholder="Intitulé de la tâche" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <button className="btn btn-primary btn-sm" onClick={addTask}>Ajouter</button>
        </div>
      )}

      {tasks.length === 0 && <p className="muted">Aucune tâche.</p>}
      <ul className="task-list">
        {tasks.map(t => (
          <li key={t.id} className={`task-row task-${t.status}`}>
            <div className="task-main">
              <span className="task-title">{t.title}</span>
              <span className="task-meta">{lotName(t.lot_id)}</span>
            </div>
            <div className="task-actions">
              <span className={`task-badge tb-${t.status}`}>{TASK_STATUS[t.status]}</span>
              {/* Entreprise : peut avancer jusqu'à "fait" */}
              {!isAdmin && t.status !== 'valide' && t.status !== 'fait' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setStatus(t, 'fait')}>Marquer fait</button>
              )}
              {/* MOE : valide */}
              {isAdmin && t.status === 'fait' && (
                <button className="btn btn-primary btn-sm" onClick={() => setStatus(t, 'valide')}>Valider</button>
              )}
              {isAdmin && t.status === 'a_faire' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setStatus(t, 'en_cours')}>Démarrer</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Photos (preuves) ----------
function MediaTab({ chantier, lots, zones, media, isAdmin, profile, reload, toast }) {
  const [lotId, setLotId] = useState(lots[0]?.id || '');
  const [zoneId, setZoneId] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      const entries = {};
      for (const m of media) {
        const { url } = await chantierService.getMediaUrl(m.file_path);
        if (url) entries[m.id] = url;
      }
      if (active) setUrls(entries);
    })();
    return () => { active = false; };
  }, [media]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!lotId) { toast?.error('Choisissez un lot'); return; }
    const lot = lots.find(l => l.id === lotId);
    setUploading(true);
    const { error } = await chantierService.uploadMedia({
      chantier, lot, zoneId: zoneId || null, file, caption,
      uploaderName: profile?.full_name, companyName: lot?.subcontractors?.company_name,
    });
    setUploading(false);
    e.target.value = '';
    if (error) return toast?.error(`Envoi impossible : ${error.message}`);
    toast?.success('Photo ajoutée (horodatée et rattachée au lot)');
    setCaption(''); reload();
  };

  const removeMedia = async (m) => {
    const { error } = await chantierService.softDeleteMedia(m.id);
    if (error) return toast?.error(error.message);
    toast?.success('Photo retirée (conservée pour la MOE)'); reload();
  };
  const restoreMedia = async (m) => {
    const { error } = await chantierService.restoreMedia(m.id);
    if (error) return toast?.error(error.message);
    toast?.success('Photo restaurée'); reload();
  };

  const visible = media.filter(m => isAdmin || !m.is_deleted);

  return (
    <div className="chantier-section">
      <div className="media-uploader">
        <div className="chantier-form-row">
          <select className="form-control" value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">Lot *</option>
            {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="form-control" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Zone (facultatif)</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <input className="form-control" placeholder="Légende (facultatif)" value={caption}
          onChange={(e) => setCaption(e.target.value)} />
        <label className="btn btn-primary media-upload-btn">
          {uploading ? 'Envoi…' : '📷 Ajouter une photo'}
          <input type="file" accept="image/*" capture="environment" hidden onChange={onUpload} disabled={uploading} />
        </label>
      </div>

      {visible.length === 0 && <p className="muted">Aucune photo pour le moment.</p>}
      <div className="media-grid">
        {visible.map(m => (
          <figure key={m.id} className={`media-item ${m.is_deleted ? 'media-deleted' : ''}`}>
            {urls[m.id]
              ? <img src={urls[m.id]} alt={m.caption || m.file_name} loading="lazy" />
              : <div className="media-placeholder">📷</div>}
            <figcaption>
              <span className="media-lot">{lots.find(l => l.id === m.lot_id)?.name || 'Lot'}</span>
              <span className="media-date">{new Date(m.taken_at).toLocaleString('fr-FR')}</span>
              <span className="media-author">{m.uploader_name || 'Auteur'}{m.company_name ? ` · ${m.company_name}` : ''}</span>
              {m.caption && <span className="media-caption">{m.caption}</span>}
              {m.is_deleted && <span className="media-flag">Retirée</span>}
            </figcaption>
            <div className="media-actions">
              {!m.is_deleted && (isAdmin || m.uploaded_by === profile?.id) && (
                <button className="btn-link-danger" onClick={() => removeMedia(m)}>Retirer</button>
              )}
              {m.is_deleted && isAdmin && (
                <button className="btn-link" onClick={() => restoreMedia(m)}>Restaurer</button>
              )}
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

// ---------- Documents de référence (MOE) ----------
function DocumentsTab({ chantier, lots, documents, isAdmin, profile, reload, toast }) {
  const [category, setCategory] = useState('plan');
  const [title, setTitle] = useState('');
  const [lotId, setLotId] = useState('');
  const [uploading, setUploading] = useState(false);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { error } = await chantierService.uploadDocument({
      chantier, lotId: lotId || null, category, title: title || file.name,
      file, uploaderName: profile?.full_name,
    });
    setUploading(false);
    e.target.value = '';
    if (error) return toast?.error(`Envoi impossible : ${error.message}`);
    toast?.success('Document ajouté'); setTitle(''); reload();
  };

  const openDoc = async (doc) => {
    const { url } = await chantierService.getDocumentUrl(doc.file_path);
    if (url) window.open(url, '_blank', 'noopener');
    else toast?.error('Document indisponible');
  };
  const removeDoc = async (doc) => {
    if (!window.confirm(`Supprimer « ${doc.title} » ?`)) return;
    const { error } = await chantierService.deleteDocument(doc);
    if (error) return toast?.error(error.message);
    toast?.success('Document supprimé'); reload();
  };

  const byCat = documents.reduce((acc, d) => { (acc[d.category] = acc[d.category] || []).push(d); return acc; }, {});

  return (
    <div className="chantier-section">
      {isAdmin && (
        <div className="media-uploader">
          <p className="muted" style={{ margin: 0 }}>Déposez les documents du chantier (plans, plan d'exécution, CCTP…). Ils sont accessibles aux entreprises assignées.</p>
          <div className="chantier-form-row">
            <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
              {DOC_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select className="form-control" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              <option value="">Tout le chantier</option>
              {lots.map(l => <option key={l.id} value={l.id}>Lot : {l.name}</option>)}
            </select>
          </div>
          <input className="form-control" placeholder="Titre du document (facultatif)" value={title}
            onChange={(e) => setTitle(e.target.value)} />
          <label className="btn btn-primary media-upload-btn">
            {uploading ? 'Envoi…' : '📎 Ajouter un document'}
            <input type="file" hidden onChange={onUpload} disabled={uploading}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.jpg,.jpeg,.png,image/*,application/pdf" />
          </label>
        </div>
      )}

      {documents.length === 0 && <p className="muted">Aucun document déposé.</p>}
      {DOC_CATEGORIES.filter(c => byCat[c.key]?.length).map(c => (
        <div key={c.key} className="doc-cat-block">
          <h4>{c.label}</h4>
          <ul className="doc-list">
            {byCat[c.key].map(d => (
              <li key={d.id} className="doc-row">
                <button className="doc-open" onClick={() => openDoc(d)}>
                  <span className="doc-icon">📄</span>
                  <span className="doc-meta">
                    <span className="doc-title">{d.title}</span>
                    <span className="doc-sub">
                      {lots.find(l => l.id === d.lot_id)?.name || 'Chantier'} · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </span>
                </button>
                {isAdmin && <button className="btn-link-danger" onClick={() => removeDoc(d)}>Supprimer</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ---------- Journal d'audit ----------
function JournalTab({ journal }) {
  return (
    <div className="chantier-section">
      <h3>Journal d'audit</h3>
      <p className="muted">Traçabilité inaltérable : qui a fait quoi et quand.</p>
      {journal.length === 0 && <p className="muted">Aucun événement.</p>}
      <ul className="journal-list">
        {journal.map(ev => (
          <li key={ev.id} className="journal-row">
            <span className="journal-date">{new Date(ev.created_at).toLocaleString('fr-FR')}</span>
            <span className="journal-type">{EVENT_LABELS[ev.event_type] || ev.event_type}</span>
            <span className="journal-actor">{ev.actor_name || 'Système'}{ev.company_name ? ` (${ev.company_name})` : ''}</span>
            <span className="journal-ctx">
              {ev.lot_name ? `Lot : ${ev.lot_name}` : ''}{ev.zone_name ? ` · Zone : ${ev.zone_name}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Alertes ciblées ----------
function AlertTab({ chantier, lots, toast, reload }) {
  const [target, setTarget] = useState('all'); // 'all' | lotId
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return toast?.error('Titre et message requis');
    setSending(true);
    const { count, error } = await chantierService.sendAlert(
      chantier.id, title.trim(), message.trim(), target === 'all' ? null : target
    );
    setSending(false);
    if (error) return toast?.error(error.message);
    toast?.success(`Alerte envoyée à ${count} destinataire${count > 1 ? 's' : ''}`);
    setTitle(''); setMessage(''); reload();
  };

  return (
    <div className="chantier-section">
      <h3>Envoyer une alerte</h3>
      <form onSubmit={send} className="alert-form">
        <div className="form-group">
          <label>Destinataires</label>
          <select className="form-control" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">Tout le chantier (tous les acteurs)</option>
            {lots.map(l => <option key={l.id} value={l.id}>Lot : {l.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Titre</label>
          <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Réunion de chantier / Retard / Consigne sécurité" />
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea className="form-control" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={sending || !title || !message}>
          {sending ? 'Envoi…' : 'Envoyer l\'alerte'}
        </button>
      </form>
    </div>
  );
}
