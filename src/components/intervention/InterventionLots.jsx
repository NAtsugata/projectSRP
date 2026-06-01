// src/components/intervention/InterventionLots.jsx
// Lots de chantier par métier (Phase 2). Composant autonome et additif :
// inséré dans la page de détail d'intervention sans modifier le flux existant.
//
// - Admin : crée / modifie / supprime les lots, assigne un métier et un ouvrier.
// - Ouvrier : ne voit que les lots de son (ses) métier(s) ou ceux qui lui sont
//   assignés ; met à jour l'avancement, le statut, les notes et les photos.

import React, { useMemo, useState } from 'react';
import { useInterventionLots } from '../../hooks/useInterventionLots';
import { usePermissions } from '../../hooks/usePermissions';
import { lotService } from '../../services/lotService';
import { tradesByCategory, tradeLabel, tradeColor } from '../../constants/buildingTrades';

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

// Formulaire de création d'un lot (admin)
function NewLotForm({ users, onCreate, onCancel, busy }) {
  const [tradeCode, setTradeCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const groups = tradesByCategory();

  const submit = (e) => {
    e.preventDefault();
    if (!tradeCode || !title.trim()) return;
    onCreate({
      trade_code: tradeCode,
      title: title.trim(),
      description: description.trim() || null,
      assigned_user_id: assignedUserId || null,
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
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Ouvrier assigné (optionnel)</label>
        <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className="form-control">
          <option value="">— Non assigné —</option>
          {users.filter(u => !u.is_admin).map((u) => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Ajouter le lot</button>
      </div>
    </form>
  );
}

// Carte d'un lot
function LotCard({ lot, canEdit, canManage, users, interventionId, onUpdate, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState(lot.notes || '');
  const color = tradeColor(lot.trade_code);
  const assignee = users.find(u => u.id === lot.assigned_user_id);
  const photos = Array.isArray(lot.photos) ? lot.photos : [];

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

  return (
    <div style={{ border: `1px solid ${color}44`, borderLeft: `4px solid ${color}`, borderRadius: '8px', padding: '0.75rem', marginBottom: '0.6rem', background: 'white' }}>
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
        </div>
        {canManage && (
          <button onClick={() => onDelete(lot.id)} className="btn btn-secondary btn-sm" title="Supprimer le lot" style={{ color: '#ef4444' }}>✕</button>
        )}
      </div>

      <div style={{ marginTop: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#6b7280', marginBottom: '2px' }}>
          <span>Avancement</span><span>{lot.progress || 0}%</span>
        </div>
        <ProgressBar value={lot.progress} />
      </div>

      {canEdit && (
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

      {photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
          {photos.map((ph, idx) => (
            <a key={idx} href={ph.url} target="_blank" rel="noopener noreferrer">
              <img src={ph.url} alt={ph.name || 'photo'} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InterventionLots({ interventionId, isAdmin, profile, users = [] }) {
  const { lots, isLoading, createLot, updateLot, deleteLot, isMutating } = useInterventionLots(interventionId);
  const { hasPermission } = usePermissions();
  const [showForm, setShowForm] = useState(false);

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
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
              {showForm ? 'Fermer' : '+ Ajouter un lot'}
            </button>
          )}
        </div>

        {visibleLots.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}><ProgressBar value={overall} /></div>
        )}

        {canManageLots && showForm && (
          <NewLotForm users={users} onCreate={handleCreate} onCancel={() => setShowForm(false)} busy={isMutating} />
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
