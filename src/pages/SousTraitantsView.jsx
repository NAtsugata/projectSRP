// src/pages/SousTraitantsView.jsx
// Gestion des sous-traitants (entreprises externes). CRUD complet.
// Accessible aux admins et aux utilisateurs avec la permission manage_chantiers.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubcontractors } from '../hooks/useSubcontractors';
import { tradesByCategory, tradeLabel, tradeColor } from '../constants/buildingTrades';

// ─── Responsive ───────────────────────────────────────────────────────────────

function useBreakpoint() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return { isMobile: w < 640 };
}

// ─── Pastilles de métiers ─────────────────────────────────────────────────────

function TradeBadges({ trades }) {
  if (!trades || trades.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
      {trades.map(code => {
        const color = tradeColor(code);
        return (
          <span key={code} style={{ fontSize: '0.7rem', fontWeight: 600, color, background: color + '22', padding: '2px 8px', borderRadius: '999px' }}>
            {tradeLabel(code)}
          </span>
        );
      })}
    </span>
  );
}

// ─── Sélecteur multi-métiers ──────────────────────────────────────────────────

function TradesSelector({ selected, onToggle, isMobile }) {
  const groups = tradesByCategory();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.7rem',
      maxHeight: '240px',
      overflowY: 'auto',
      padding: '8px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      WebkitOverflowScrolling: 'touch',
    }}>
      {groups.map(group => (
        <div key={group.id}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: group.color, marginBottom: '6px', letterSpacing: '0.05em' }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {group.trades.map(t => {
              const on = selected.includes(t.code);
              return (
                <button type="button" key={t.code} onClick={() => onToggle(t.code)}
                  style={{
                    padding: isMobile ? '6px 12px' : '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    border: `1px solid ${on ? group.color : '#d1d5db'}`,
                    background: on ? group.color + '22' : 'transparent',
                    color: on ? group.color : '#374151',
                    fontWeight: on ? 600 : 400,
                    minHeight: isMobile ? '36px' : '30px',
                  }}>
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

// ─── Formulaire création / édition ────────────────────────────────────────────

function SubForm({ initial, onSave, onCancel, busy, isMobile }) {
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '', phone: '', siret: '', notes: '',
    is_active: true,
    ...initial,
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

  const inputStyle = { minHeight: isMobile ? '48px' : '40px', fontSize: isMobile ? '1rem' : '0.9rem' };

  return (
    <form onSubmit={submit} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem',
      background: '#f9fafb',
      padding: isMobile ? '1rem' : '1.25rem',
      borderRadius: '12px',
      marginBottom: '1rem',
      border: '1px solid #e5e7eb',
    }}>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
        {initial?.id ? '✏️ Modifier le sous-traitant' : '+ Nouveau sous-traitant'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.7rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Entreprise *</label>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="form-control" placeholder="Nom de l'entreprise" required style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Contact</label>
          <input value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} className="form-control" placeholder="Nom du contact" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Téléphone</label>
          <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="form-control" placeholder="06 00 00 00 00" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email</label>
          <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="form-control" placeholder="email@entreprise.fr" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>SIRET</label>
          <input value={form.siret || ''} onChange={e => set('siret', e.target.value)} className="form-control" placeholder="000 000 000 00000" style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
          Métiers{' '}
          {form.trades.length > 0 && (
            <span style={{ color: '#6b7280', fontWeight: 400 }}>({form.trades.length} sélectionné{form.trades.length > 1 ? 's' : ''})</span>
          )}
        </label>
        <TradesSelector selected={form.trades} onToggle={toggleTrade} isMobile={isMobile} />
      </div>

      <div>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Notes</label>
        <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="form-control" rows={2} placeholder="Informations complémentaires…" style={{ fontSize: isMobile ? '1rem' : '0.9rem' }} />
      </div>

      <label style={{ fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minHeight: '36px' }}>
        <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} style={{ width: '18px', height: '18px' }} />
        Sous-traitant actif (disponible pour assignation)
      </label>

      <div style={{ display: 'flex', gap: '0.6rem', flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ minHeight: '44px' }}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: '44px', flex: isMobile ? 1 : undefined }}>
          {busy ? 'Enregistrement…' : (initial?.id ? 'Enregistrer' : '+ Ajouter')}
        </button>
      </div>
    </form>
  );
}

// ─── Vue principale ───────────────────────────────────────────────────────────

export default function SousTraitantsView() {
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
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
      setShowForm(false);
      setEditing(null);
    } catch (e) { /* l'UI reste ouverte */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce sous-traitant ? Les lots assignés repasseront en « non assigné ».')) return;
    try { await deleteSubcontractor(id); } catch (e) { /* noop */ }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: isMobile ? '0.75rem' : '1rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => navigate('/suivi-chantiers')}
          style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '8px 0', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '44px' }}
        >
          ← Suivi Chantiers
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.3rem' }}>🏢 Sous-traitants</h2>
          {!showForm && (
            <button
              className="btn btn-primary"
              onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ minHeight: '44px', width: isMobile ? '100%' : 'auto', marginTop: isMobile ? '0.4rem' : 0 }}
            >
              + Ajouter un sous-traitant
            </button>
          )}
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <SubForm
          initial={editing || undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          busy={isMutating}
          isMobile={isMobile}
        />
      )}

      {/* Liste */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Chargement…
        </div>
      ) : subcontractors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '12px', border: '1px dashed #e5e7eb' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏢</div>
          <p style={{ margin: 0, fontWeight: 600 }}>Aucun sous-traitant</p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>Ajoutez vos entreprises partenaires pour les assigner aux lots de chantier.</p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
            {subcontractors.length} sous-traitant{subcontractors.length > 1 ? 's' : ''}
          </div>
          {subcontractors.map(s => (
            <div key={s.id} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: isMobile ? '0.85rem' : '0.85rem 1rem',
              marginBottom: '0.6rem',
              background: 'white',
              opacity: s.is_active === false ? 0.65 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', wordBreak: 'break-word' }}>{s.company_name}</span>
                    {s.is_active === false && (
                      <span style={{ fontSize: '0.7rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>Inactif</span>
                    )}
                  </div>
                  {(s.contact_name || s.phone || s.email) && (
                    <div style={{ margin: '0.3rem 0 0', fontSize: '0.83rem', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.75rem' }}>
                      {s.contact_name && <span>👤 {s.contact_name}</span>}
                      {s.phone && <span>📞 {s.phone}</span>}
                      {s.email && <span>✉ {s.email}</span>}
                    </div>
                  )}
                  {s.siret && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>SIRET : {s.siret}</p>}
                  {s.trades && s.trades.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}><TradeBadges trades={s.trades} /></div>
                  )}
                  {s.notes && <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#374151', wordBreak: 'break-word' }}>💬 {s.notes}</p>}
                </div>

                {/* Boutons desktop */}
                {!isMobile && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      title="Modifier"
                      onClick={() => handleEdit(s)}
                      style={{ minWidth: '40px', minHeight: '40px' }}
                    >✏️</button>
                    <button
                      className="btn btn-secondary btn-sm"
                      title="Supprimer"
                      style={{ color: '#ef4444', minWidth: '40px', minHeight: '40px' }}
                      onClick={() => handleDelete(s.id)}
                    >✕</button>
                  </div>
                )}
              </div>

              {/* Boutons mobile : toute la largeur */}
              {isMobile && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEdit(s)}
                    style={{ flex: 1, minHeight: '44px', fontSize: '0.88rem' }}
                  >✏️ Modifier</button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, color: '#ef4444', minHeight: '44px', fontSize: '0.88rem' }}
                    onClick={() => handleDelete(s.id)}
                  >✕ Supprimer</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
