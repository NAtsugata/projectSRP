// src/pages/SousTraitantsView.jsx
// Gestion des sous-traitants (entreprises externes). CRUD complet.
// Accessible aux admins et aux utilisateurs avec la permission manage_chantiers.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubcontractors } from '../hooks/useSubcontractors';
import { useToast } from '../contexts/ToastContext';
import { SkeletonList } from '../components/ui/LoadingSpinner';
import ConfirmDialog from '../components/ui/ConfirmDialog';
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

// Couleurs de texte à fort contraste
const TXT = { primary: '#1f1410', secondary: '#473a30', muted: '#6d5d4f' };

// ─── Pastilles de métiers ─────────────────────────────────────────────────────

function TradeBadges({ trades }) {
  if (!trades || trades.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '5px' }}>
      {trades.map(code => {
        const color = tradeColor(code);
        return (
          <span key={code} style={{ fontSize: '0.78rem', fontWeight: 600, color, background: color + '22', padding: '3px 10px', borderRadius: '999px' }}>
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
      gap: '0.85rem',
      maxHeight: '260px',
      overflowY: 'auto',
      padding: '10px',
      border: '1px solid #ecddcf',
      borderRadius: '12px',
      background: '#ffffff',
      WebkitOverflowScrolling: 'touch',
    }}>
      {groups.map(group => (
        <div key={group.id}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: group.color, marginBottom: '8px', letterSpacing: '0.04em' }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {group.trades.map(t => {
              const on = selected.includes(t.code);
              return (
                <button type="button" key={t.code} onClick={() => onToggle(t.code)}
                  style={{
                    padding: isMobile ? '8px 14px' : '6px 12px',
                    borderRadius: '999px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: `1px solid ${on ? group.color : '#d8c5b2'}`,
                    background: on ? group.color + '22' : 'transparent',
                    color: on ? group.color : TXT.secondary,
                    fontWeight: on ? 700 : 500,
                    minHeight: isMobile ? '42px' : '34px',
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

  const labelStyle = { fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '5px', color: TXT.secondary };
  const inputStyle = { minHeight: isMobile ? '48px' : '42px', fontSize: '1rem' };

  return (
    <form onSubmit={submit} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      background: '#faf6f1',
      padding: isMobile ? '1rem' : '1.25rem',
      borderRadius: '14px',
      marginBottom: '1rem',
      border: '1px solid #ecddcf',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
    }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: TXT.primary }}>
        {initial?.id ? '✏️ Modifier le sous-traitant' : '+ Nouveau sous-traitant'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
        <div>
          <label style={labelStyle}>Entreprise *</label>
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="form-control" placeholder="Nom de l'entreprise" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Contact</label>
          <input value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} className="form-control" placeholder="Nom du contact" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Téléphone</label>
          <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="form-control" placeholder="06 00 00 00 00" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} className="form-control" placeholder="email@entreprise.fr" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>SIRET</label>
          <input value={form.siret || ''} onChange={e => set('siret', e.target.value)} className="form-control" placeholder="000 000 000 00000" style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          Métiers{' '}
          {form.trades.length > 0 && (
            <span style={{ color: TXT.muted, fontWeight: 400 }}>
              ({form.trades.length} sélectionné{form.trades.length > 1 ? 's' : ''})
            </span>
          )}
        </label>
        <TradesSelector selected={form.trades} onToggle={toggleTrade} isMobile={isMobile} />
      </div>

      <div>
        <label style={labelStyle}>Notes</label>
        <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="form-control" rows={2} placeholder="Informations complémentaires…" style={{ fontSize: '1rem' }} />
      </div>

      <label style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', minHeight: '44px', color: TXT.primary }}>
        <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
        Sous-traitant actif (disponible pour assignation)
      </label>

      <div style={{ display: 'flex', gap: '0.6rem', flexDirection: isMobile ? 'column-reverse' : 'row', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ minHeight: '48px' }}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minHeight: '48px', flex: isMobile ? 1 : undefined }}>
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
  const toast = useToast();
  const { subcontractors, isLoading, createSubcontractor, updateSubcontractor, deleteSubcontractor, isMutating } = useSubcontractors();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (data) => {
    try {
      if (editing?.id) {
        const { id, created_at, updated_at, organization_id, created_by, ...updates } = { ...editing, ...data };
        await updateSubcontractor({ id: editing.id, updates });
        toast.success('Sous-traitant modifié.');
      } else {
        await createSubcontractor(data);
        toast.success('Sous-traitant ajouté.');
      }
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      toast.error('Erreur : ' + (e.message || 'impossible de sauvegarder.'));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSubcontractor(pendingDelete);
      toast.success('Sous-traitant supprimé.');
      setPendingDelete(null);
    } catch (e) {
      toast.error('Erreur : ' + (e.message || 'impossible de supprimer.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (s) => {
    setEditing(s);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: isMobile ? '0.85rem' : '1rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          onClick={() => navigate('/suivi-chantiers')}
          style={{ background: 'none', border: 'none', color: '#9c5e22', cursor: 'pointer', padding: '8px 0', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '44px', fontWeight: 600 }}
        >
          ← Suivi Chantiers
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '1.3rem' : '1.4rem', color: TXT.primary, borderLeft: '4px solid #b87333', paddingLeft: '0.65rem', lineHeight: 1.2 }}>
            🏢 Sous-traitants
          </h2>
          {!showForm && (
            <button
              className="btn btn-primary"
              onClick={() => { setEditing(null); setShowForm(true); }}
              style={{ minHeight: '48px', width: isMobile ? '100%' : 'auto', marginTop: isMobile ? '0.5rem' : 0 }}
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
        <SkeletonList count={3} variant="card" />
      ) : subcontractors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: TXT.muted, background: '#faf6f1', borderRadius: '14px', border: '1px dashed #e0cdb8' }}>
          <div style={{ fontSize: '2.75rem', marginBottom: '0.5rem' }}>🏢</div>
          <p style={{ margin: 0, fontWeight: 700, color: TXT.primary, fontSize: '1rem' }}>Aucun sous-traitant</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', lineHeight: 1.4 }}>Ajoutez vos entreprises partenaires pour les assigner aux lots de chantier.</p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.85rem', color: TXT.muted, marginBottom: '0.6rem', fontWeight: 500 }}>
            {subcontractors.length} sous-traitant{subcontractors.length > 1 ? 's' : ''}
          </div>
          {subcontractors.map(s => (
            <SubcontractorCard
              key={s.id}
              s={s}
              isMobile={isMobile}
              onEdit={handleEdit}
              onDelete={(id) => setPendingDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Confirmation de suppression */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Supprimer ce sous-traitant ?"
        message="Les lots actuellement assignés à ce sous-traitant repasseront en « non assigné ». Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ─── Carte sous-traitant ───────────────────────────────────────────────────────

function SubcontractorCard({ s, isMobile, onEdit, onDelete }) {
  return (
    <div style={{
      border: '1px solid #ecddcf',
      borderRadius: '14px',
      padding: '1rem',
      marginBottom: '0.75rem',
      background: '#ffffff',
      opacity: s.is_active === false ? 0.7 : 1,
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
    }}>
      {/* Nom + bouton modifier (desktop) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', wordBreak: 'break-word', color: TXT.primary }}>{s.company_name}</span>
            {s.is_active === false && (
              <span style={{ fontSize: '0.75rem', color: TXT.muted, background: '#f0e7dc', padding: '3px 10px', borderRadius: '999px', flexShrink: 0, fontWeight: 600 }}>Inactif</span>
            )}
          </div>
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm" title="Modifier" onClick={() => onEdit(s)} style={{ minWidth: '44px', minHeight: '44px' }}>✏️</button>
            <button className="btn btn-secondary btn-sm" title="Supprimer" style={{ color: '#a23a29', minWidth: '44px', minHeight: '44px' }} onClick={() => onDelete(s.id)}>✕</button>
          </div>
        )}
      </div>

      {/* Coordonnées — une info par ligne pour la lisibilité */}
      {(s.contact_name || s.phone || s.email) && (
        <div style={{ margin: '0.6rem 0 0', fontSize: '0.9rem', color: TXT.secondary, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {s.contact_name && <span>👤 {s.contact_name}</span>}
          {s.phone && <a href={`tel:${s.phone}`} style={{ color: '#9c5e22', textDecoration: 'none', fontWeight: 600 }}>📞 {s.phone}</a>}
          {s.email && <a href={`mailto:${s.email}`} style={{ color: '#9c5e22', textDecoration: 'none', wordBreak: 'break-all' }}>✉ {s.email}</a>}
        </div>
      )}

      {s.siret && (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: TXT.muted }}>SIRET : {s.siret}</p>
      )}

      {s.trades && s.trades.length > 0 && (
        <div style={{ marginTop: '0.6rem' }}><TradeBadges trades={s.trades} /></div>
      )}

      {s.notes && (
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.88rem', color: TXT.secondary, wordBreak: 'break-word', background: '#faf6f1', padding: '0.5rem 0.65rem', borderRadius: '8px', lineHeight: 1.4 }}>
          💬 {s.notes}
        </p>
      )}

      {/* Boutons mobile — pleine largeur */}
      {isMobile && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', borderTop: '1px solid #f0e7dc', paddingTop: '0.85rem' }}>
          <button className="btn btn-secondary" onClick={() => onEdit(s)} style={{ flex: 1, minHeight: '48px', fontSize: '0.92rem' }}>✏️ Modifier</button>
          <button className="btn btn-secondary" style={{ flex: 1, color: '#a23a29', minHeight: '48px', fontSize: '0.92rem' }} onClick={() => onDelete(s.id)}>✕ Supprimer</button>
        </div>
      )}
    </div>
  );
}
