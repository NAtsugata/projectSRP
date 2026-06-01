// src/pages/SousTraitantsView.jsx
// Gestion des sous-traitants (entreprises externes). CRUD complet.
// Accessible aux admins et aux utilisateurs avec la permission manage_chantiers.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubcontractors } from '../hooks/useSubcontractors';
import { tradesByCategory, tradeLabel, tradeColor } from '../constants/buildingTrades';

// Pastilles de métiers
function TradeBadges({ trades }) {
  if (!trades || trades.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
      {trades.map(code => {
        const color = tradeColor(code);
        return (
          <span key={code} style={{ fontSize: '0.7rem', fontWeight: 600, color, background: color + '22', padding: '1px 7px', borderRadius: '999px' }}>
            {tradeLabel(code)}
          </span>
        );
      })}
    </span>
  );
}

// Sélecteur multi-métiers
function TradesSelector({ selected, onToggle }) {
  const groups = tradesByCategory();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '220px', overflowY: 'auto', padding: '4px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
      {groups.map(group => (
        <div key={group.id}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: group.color, marginBottom: '4px' }}>{group.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {group.trades.map(t => {
              const on = selected.includes(t.code);
              return (
                <button type="button" key={t.code} onClick={() => onToggle(t.code)}
                  style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '0.76rem', cursor: 'pointer',
                    border: `1px solid ${on ? group.color : '#d1d5db'}`,
                    background: on ? group.color + '22' : 'transparent',
                    color: on ? group.color : '#374151', fontWeight: on ? 600 : 400 }}>
                  {on ? '✓ ' : ''}{t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Formulaire création / édition
function SubForm({ initial, onSave, onCancel, busy }) {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '', siret: '', notes: '',
    trades: [], is_active: true, ...initial,
    trades: Array.isArray(initial?.trades) ? initial.trades : [],
  });
  const set = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const toggleTrade = (code) => setForm(s => ({
    ...s, trades: s.trades.includes(code) ? s.trades.filter(c => c !== code) : [...s.trades, code],
  }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    onSave({ ...form, company_name: form.company_name.trim() });
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', background: '#f9fafb', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Entreprise *</label>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="form-control" placeholder="Nom de l'entreprise" required />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Contact</label>
          <input value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} className="form-control" placeholder="Nom du contact" />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Téléphone</label>
          <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="form-control" />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Email</label>
          <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="form-control" />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>SIRET</label>
          <input value={form.siret || ''} onChange={e => set('siret', e.target.value)} className="form-control" />
        </div>
      </div>
      <div>
        <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Métiers</label>
        <TradesSelector selected={form.trades} onToggle={toggleTrade} />
      </div>
      <div>
        <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Notes</label>
        <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="form-control" rows={2} />
      </div>
      <label style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} />
        Sous-traitant actif (disponible pour assignation)
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{initial?.id ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  );
}

export default function SousTraitantsView() {
  const navigate = useNavigate();
  const { subcontractors, isLoading, createSubcontractor, updateSubcontractor, deleteSubcontractor, isMutating } = useSubcontractors();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleSave = async (data) => {
    try {
      if (editing?.id) {
        const { id, created_at, updated_at, organization_id, created_by, ...updates } = { ...editing, ...data };
        await updateSubcontractor({ id: editing.id, updates });
      } else {
        await createSubcontractor(data);
      }
      setShowForm(false); setEditing(null);
    } catch (e) { /* l'UI reste ouverte */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce sous-traitant ? Les lots assignés repasseront en « non assigné ».')) return;
    try { await deleteSubcontractor(id); } catch (e) { /* noop */ }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <button onClick={() => navigate('/suivi-chantiers')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}>← Suivi Chantiers</button>
          <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.3rem' }}>🏢 Sous-traitants</h2>
        </div>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowForm(true); }}>+ Ajouter un sous-traitant</button>
        )}
      </div>

      {showForm && (
        <SubForm
          initial={editing || undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          busy={isMutating}
        />
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Chargement…</div>
      ) : subcontractors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          Aucun sous-traitant. Ajoutez vos entreprises partenaires pour les assigner aux lots de chantier.
        </div>
      ) : (
        subcontractors.map(s => (
          <div key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '0.6rem', background: 'white', opacity: s.is_active === false ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>{s.company_name}</span>
                  {s.is_active === false && <span style={{ fontSize: '0.7rem', color: '#6b7280', background: '#f3f4f6', padding: '1px 7px', borderRadius: '999px' }}>Inactif</span>}
                </div>
                {(s.contact_name || s.phone || s.email) && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                    {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ')}
                  </p>
                )}
                {s.siret && <p style={{ margin: '0.1rem 0 0', fontSize: '0.76rem', color: '#9ca3af' }}>SIRET : {s.siret}</p>}
                <div style={{ marginTop: '0.4rem' }}><TradeBadges trades={s.trades} /></div>
                {s.notes && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#374151' }}>💬 {s.notes}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button className="btn btn-secondary btn-sm" title="Modifier" onClick={() => { setEditing(s); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️</button>
                <button className="btn btn-secondary btn-sm" title="Supprimer" style={{ color: '#ef4444' }} onClick={() => handleDelete(s.id)}>✕</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
