// src/components/intervention/InterventionLots.jsx
// Lots de chantier par métier (Phase 2). Composant autonome et additif :
// inséré dans la page de détail d'intervention sans modifier le flux existant.
//
// - Admin : crée / modifie / supprime les lots, assigne un métier et un ouvrier.
// - Ouvrier : ne voit que les lots de son (ses) métier(s) ou ceux qui lui sont
//   assignés ; met à jour l'avancement, le statut, les notes et les photos.

import React, { useMemo, useState } from 'react';
import { useInterventionLots } from '../../hooks/useInterventionLots';
import { useSubcontractors } from '../../hooks/useSubcontractors';
import { usePermissions } from '../../hooks/usePermissions';
import { lotService } from '../../services/lotService';
import { tradesByCategory, tradeLabel, tradeColor } from '../../constants/buildingTrades';
import { CHANTIER_TEMPLATES } from '../../constants/chantierTemplates';

const STATUS_META = {
  a_venir: { label: 'À venir', color: '#6b7280' },
  en_cours: { label: 'En cours', color: '#3b82f6' },
  termine: { label: 'Terminé', color: '#10b981' },
  bloque: { label: 'Bloqué', color: '#ef4444' },
};
const STATUS_ORDER = ['a_venir', 'en_cours', 'termine', 'bloque'];

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.a_venir;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
      background: m.color + '22', color: m.color, border: `1px solid ${m.color}44`,
    }}>{m.label}</span>
  );
}

function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
      <div style={{ width: `${v}%`, height: '100%', background: v >= 100 ? '#10b981' : '#3b82f6', transition: 'width .3s' }} />
    </div>
  );
}

// Sélecteur d'assignation : employé interne OU sous-traitant (ou non assigné)
function AssignmentSelect({ users, subcontractors = [], assignedUserId, subcontractorId, onChange }) {
  const value = subcontractorId ? `sub:${subcontractorId}` : (assignedUserId ? `user:${assignedUserId}` : '');
  const handle = (v) => {
    if (!v) onChange({ assigned_user_id: null, subcontractor_id: null });
    else if (v.startsWith('user:')) onChange({ assigned_user_id: v.slice(5), subcontractor_id: null });
    else if (v.startsWith('sub:')) onChange({ assigned_user_id: null, subcontractor_id: Number(v.slice(4)) });
  };
  return (
    <select value={value} onChange={(e) => handle(e.target.value)} className="form-control">
      <option value="">— Non assigné —</option>
      <optgroup label="Employés">
        {users.filter(u => !u.is_admin).map(u => (
          <option key={u.id} value={`user:${u.id}`}>{u.full_name || u.email}</option>
        ))}
      </optgroup>
      {subcontractors.filter(s => s.is_active !== false).length > 0 && (
        <optgroup label="Sous-traitants">
          {subcontractors.filter(s => s.is_active !== false).map(s => (
            <option key={s.id} value={`sub:${s.id}`}>🏢 {s.company_name}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Formulaire de création d'un lot (admin / MOE)
function NewLotForm({ users, subcontractors, onCreate, onCancel, busy }) {
  const [tradeCode, setTradeCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assign, setAssign] = useState({ assigned_user_id: null, subcontractor_id: null });
  const groups = tradesByCategory();

  const submit = (e) => {
    e.preventDefault();
    if (!tradeCode || !title.trim()) return;
    onCreate({
      trade_code: tradeCode,
      title: title.trim(),
      description: description.trim() || null,
      assigned_user_id: assign.assigned_user_id,
      subcontractor_id: assign.subcontractor_id,
    });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#f9fafb', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
      <div>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Métier *</label>
        <select value={tradeCode} onChange={(e) => setTradeCode(e.target.value)} className="form-control" required>
          <option value="">— Choisir un métier —</option>
          {groups.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {g.trades.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Intitulé du lot *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-control" placeholder="Ex : Tableau électrique RDC" required />
      </div>
      <div>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="form-control" rows={2} />
      </div>
      <div>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Réalisé par (optionnel)</label>
        <AssignmentSelect
          users={users}
          subcontractors={subcontractors}
          assignedUserId={assign.assigned_user_id}
          subcontractorId={assign.subcontractor_id}
          onChange={setAssign}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Ajouter le lot</button>
      </div>
    </form>
  );
}

// Sélecteur de modèle de chantier : choisit un modèle, ajuste les lots, crée en bloc
function TemplatePicker({ onCreateMany, onCancel, busy }) {
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState({}); // index -> bool

  const template = CHANTIER_TEMPLATES.find(t => t.id === selectedId);

  const pickTemplate = (t) => {
    setSelectedId(t.id);
    const init = {};
    t.lots.forEach((_, i) => { init[i] = true; });
    setChecked(init);
  };

  const toggle = (i) => setChecked(prev => ({ ...prev, [i]: !prev[i] }));

  const create = () => {
    if (!template) return;
    const lots = template.lots.filter((_, i) => checked[i]);
    if (lots.length === 0) return;
    onCreateMany(lots);
  };

  return (
    <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
      {!template ? (
        <>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Choisir un modèle de chantier</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {CHANTIER_TEMPLATES.map(t => (
              <button key={t.id} type="button" onClick={() => pickTemplate(t)}
                style={{ textAlign: 'left', background: 'white', cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem 0.6rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.icon} {t.label}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem' }}>{t.lots.length} lots</div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Fermer</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{template.icon} {template.label}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {template.lots.map((l, i) => {
              const color = tradeColor(l.trade_code);
              return (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!checked[i]} onChange={() => toggle(i)} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color, background: color + '22', padding: '1px 6px', borderRadius: '999px' }}>
                    {tradeLabel(l.trade_code)}
                  </span>
                  <span>{l.title}</span>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '0.6rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedId(null)}>← Modèles</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={create} disabled={busy}>
              {busy ? 'Création…' : `Créer les lots sélectionnés`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Carte d'un lot
function LotCard({ lot, canEdit, canManage, users, subcontractors = [], interventionId, onUpdate, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState(lot.notes || '');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    trade_code: lot.trade_code,
    title: lot.title,
    description: lot.description || '',
    assigned_user_id: lot.assigned_user_id || null,
    subcontractor_id: lot.subcontractor_id || null,
  });
  const color = tradeColor(lot.trade_code);
  const assignee = users.find(u => u.id === lot.assigned_user_id);
  const subcontractor = subcontractors.find(s => s.id === lot.subcontractor_id);
  const photos = Array.isArray(lot.photos) ? lot.photos : [];
  const editGroups = tradesByCategory();

  const saveEdit = async () => {
    if (!edit.trade_code || !edit.title.trim()) return;
    await onUpdate(lot.id, {
      trade_code: edit.trade_code,
      title: edit.title.trim(),
      description: edit.description.trim() || null,
      assigned_user_id: edit.assigned_user_id || null,
      subcontractor_id: edit.subcontractor_id || null,
    });
    setEditing(false);
  };

  const setStatus = async (status) => { await onUpdate(lot.id, { status }); };
  const setProgress = async (progress) => {
    const updates = { progress };
    if (progress >= 100) updates.status = 'termine';
    else if (progress > 0 && lot.status === 'a_venir') updates.status = 'en_cours';
    await onUpdate(lot.id, updates);
  };
  const saveNote = async () => { if (noteDraft !== (lot.notes || '')) await onUpdate(lot.id, { notes: noteDraft }); };

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      const { data: uploaded } = await lotService.uploadLotPhotos(interventionId, lot.id, files);
      if (uploaded && uploaded.length > 0) {
        await onUpdate(lot.id, { photos: [...photos, ...uploaded] });
      }
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const removePhoto = async (idx) => {
    const next = photos.filter((_, i) => i !== idx);
    await onUpdate(lot.id, { photos: next });
  };

  return (
    <div style={{ border: `1px solid ${color}44`, borderLeft: `4px solid ${color}`, borderRadius: '8px', padding: '0.75rem', marginBottom: '0.6rem', background: 'white' }}>
      {editing ? (
        /* Mode édition (admin / MOE) : modifier métier, intitulé, description, ouvrier */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Métier</label>
            <select value={edit.trade_code} onChange={(e) => setEdit(s => ({ ...s, trade_code: e.target.value }))} className="form-control">
              {editGroups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {g.trades.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Intitulé</label>
            <input value={edit.title} onChange={(e) => setEdit(s => ({ ...s, title: e.target.value }))} className="form-control" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Description</label>
            <textarea value={edit.description} onChange={(e) => setEdit(s => ({ ...s, description: e.target.value }))} className="form-control" rows={2} />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Réalisé par</label>
            <AssignmentSelect
              users={users}
              subcontractors={subcontractors}
              assignedUserId={edit.assigned_user_id}
              subcontractorId={edit.subcontractor_id}
              onChange={(a) => setEdit(s => ({ ...s, ...a }))}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setEdit({ trade_code: lot.trade_code, title: lot.title, description: lot.description || '', assigned_user_id: lot.assigned_user_id || null, subcontractor_id: lot.subcontractor_id || null }); }}>Annuler</button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit}>Enregistrer</button>
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color, background: color + '22', padding: '2px 8px', borderRadius: '999px' }}>
              {tradeLabel(lot.trade_code)}
            </span>
            <StatusPill status={lot.status} />
          </div>
          <p style={{ margin: '0.4rem 0 0', fontWeight: 600 }}>{lot.title}</p>
          {lot.description && <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>{lot.description}</p>}
          {assignee && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#374151' }}>👷 {assignee.full_name || assignee.email}</p>}
          {subcontractor && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#7c3aed', fontWeight: 600 }}>
              🏢 Sous-traitant : {subcontractor.company_name}
            </p>
          )}
        </div>
        {canManage && (
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm" title="Modifier le lot">✏️</button>
            <button onClick={() => onDelete(lot.id)} className="btn btn-secondary btn-sm" title="Supprimer le lot" style={{ color: '#ef4444' }}>✕</button>
          </div>
        )}
      </div>
      )}

      {!editing && (
      <div style={{ marginTop: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#6b7280', marginBottom: '2px' }}>
          <span>Avancement</span><span>{lot.progress || 0}%</span>
        </div>
        <ProgressBar value={lot.progress} />
      </div>
      )}

      {canEdit && !editing && (
        <>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
            {[0, 25, 50, 75, 100].map((p) => (
              <button key={p} onClick={() => setProgress(p)} className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', fontWeight: lot.progress === p ? 700 : 400 }}>
                {p}%
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
            {STATUS_ORDER.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem',
                  borderColor: lot.status === s ? STATUS_META[s].color : undefined,
                  color: lot.status === s ? STATUS_META[s].color : undefined,
                  fontWeight: lot.status === s ? 700 : 400 }}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '0.6rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Note</label>
            <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onBlur={saveNote}
              className="form-control" rows={2} placeholder="Observations, blocage, matériel manquant…" />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
              {busy ? '⏳ Envoi…' : '📷 Ajouter des photos'}
              <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotos} disabled={busy} style={{ display: 'none' }} />
            </label>
          </div>
        </>
      )}

      {photos.length > 0 && !editing && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
          {photos.map((ph, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <a href={ph.url} target="_blank" rel="noopener noreferrer">
                <img src={ph.url} alt={ph.name || 'photo'} loading="lazy" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'block' }} />
              </a>
              {canEdit && (
                <button
                  onClick={() => removePhoto(idx)}
                  title="Supprimer la photo"
                  style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '999px', border: 'none', background: '#ef4444', color: 'white', fontSize: '0.7rem', lineHeight: '20px', cursor: 'pointer', padding: 0 }}
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InterventionLots({ interventionId, isAdmin, profile, users = [] }) {
  const { lots, isLoading, createLot, updateLot, deleteLot, isMutating } = useInterventionLots(interventionId);
  const { subcontractors } = useSubcontractors();
  const { hasPermission } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Peut gérer les lots : admin OU utilisateur avec la permission manage_chantiers
  const canManageLots = isAdmin || hasPermission('manage_chantiers');

  const myTrades = Array.isArray(profile?.trades) ? profile.trades : [];

  // Filtrage : admin / MOE voit tout ; l'ouvrier voit ses métiers + lots assignés.
  const visibleLots = useMemo(() => {
    if (canManageLots) return lots;
    return lots.filter(l =>
      myTrades.includes(l.trade_code) || l.assigned_user_id === profile?.id
    );
  }, [lots, canManageLots, myTrades, profile?.id]);

  // Avancement global (sur les lots visibles)
  const overall = useMemo(() => {
    if (visibleLots.length === 0) return 0;
    const sum = visibleLots.reduce((acc, l) => acc + (l.progress || 0), 0);
    return Math.round(sum / visibleLots.length);
  }, [visibleLots]);

  const handleCreate = async (lot) => {
    try { await createLot(lot); setShowForm(false); } catch (e) { /* erreur silencieuse, l'UI reste ouverte */ }
  };
  // Création groupée depuis un modèle (séquentielle pour rester sûr)
  const handleCreateMany = async (templateLots) => {
    setBulkBusy(true);
    try {
      for (const l of templateLots) {
        await createLot({ trade_code: l.trade_code, title: l.title });
      }
      setShowTemplates(false);
    } catch (e) {
      /* noop : les lots déjà créés restent, l'utilisateur peut réessayer */
    } finally {
      setBulkBusy(false);
    }
  };
  const handleDelete = async (lotId) => {
    if (!window.confirm('Supprimer ce lot ?')) return;
    try { await deleteLot(lotId); } catch (e) { /* noop */ }
  };
  const handleUpdate = async (lotId, updates) => {
    try { await updateLot({ lotId, updates }); } catch (e) { /* noop */ }
  };

  // Un ouvrier peut éditer un lot s'il est de son métier ou qu'il lui est assigné.
  const canEditLot = (lot) => canManageLots
    || myTrades.includes(lot.trade_code)
    || lot.assigned_user_id === profile?.id;

  // Ne rien afficher aux ouvriers s'il n'y a aucun lot pour eux (page inchangée).
  if (!canManageLots && !isLoading && visibleLots.length === 0) return null;

  return (
    <div className="card-white" style={{ marginBottom: '1rem' }}>
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>🧱 Lots par métier {visibleLots.length > 0 && <span style={{ color: '#6b7280', fontWeight: 400 }}>({overall}%)</span>}</h3>
          {canManageLots && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowTemplates(v => !v); setShowForm(false); }} style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}>
                📋 Modèles
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(v => !v); setShowTemplates(false); }} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                {showForm ? 'Fermer' : '+ Ajouter un lot'}
              </button>
            </div>
          )}
        </div>

        {visibleLots.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}><ProgressBar value={overall} /></div>
        )}

        {canManageLots && showTemplates && (
          <TemplatePicker onCreateMany={handleCreateMany} onCancel={() => setShowTemplates(false)} busy={bulkBusy} />
        )}

        {canManageLots && showForm && (
          <NewLotForm users={users} subcontractors={subcontractors} onCreate={handleCreate} onCancel={() => setShowForm(false)} busy={isMutating} />
        )}

        {isLoading ? (
          <p className="text-muted" style={{ margin: 0 }}>Chargement des lots…</p>
        ) : visibleLots.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            {canManageLots ? 'Aucun lot. Ajoutez les corps de métier de ce chantier.' : 'Aucun lot pour votre métier.'}
          </p>
        ) : (
          visibleLots.map((lot) => (
            <LotCard
              key={lot.id}
              lot={lot}
              canEdit={canEditLot(lot)}
              canManage={canManageLots}
              users={users}
              subcontractors={subcontractors}
              interventionId={interventionId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
