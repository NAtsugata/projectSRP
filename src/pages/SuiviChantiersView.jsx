// src/pages/SuiviChantiersView.jsx
// Tableau de bord maître d'œuvre / conducteur de travaux.
// Accessible via la permission view_all_interventions + manage_chantiers.
// Fichier 100% additif — ne touche à rien d'existant.

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useInterventionLots } from '../hooks/useInterventionLots';
import { tradeLabel, tradeColor, tradesByCategory } from '../constants/buildingTrades';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  'À venir':  '#6b7280',
  'En cours': '#3b82f6',
  'Terminée': '#10b981',
};

const LOT_STATUS = {
  a_venir: { label: 'À venir',  color: '#6b7280' },
  en_cours: { label: 'En cours', color: '#3b82f6' },
  termine:  { label: 'Terminé',  color: '#10b981' },
  bloque:   { label: 'Bloqué',   color: '#ef4444' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function ProgressBar({ value, color }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const fill = color || (v >= 100 ? '#10b981' : '#3b82f6');
  return (
    <div style={{ background: '#e5e7eb', borderRadius: '999px', height: '6px', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${v}%`, height: '100%', background: fill, transition: 'width .3s' }} />
    </div>
  );
}

// ─── Sous-composant : ligne de lot ────────────────────────────────────────────

function LotRow({ lot }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const color = tradeColor(lot.trade_code);
  const sm = LOT_STATUS[lot.status] || LOT_STATUS.a_venir;
  const photos = Array.isArray(lot.photos) ? lot.photos : [];

  return (
    <div style={{ padding: '0.6rem 0.75rem', borderLeft: `3px solid ${color}`, marginBottom: '0.4rem', background: '#f9fafb', borderRadius: '0 6px 6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* badge métier */}
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color, background: color + '22', padding: '1px 7px', borderRadius: '999px' }}>
          {tradeLabel(lot.trade_code)}
        </span>
        {/* statut */}
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: sm.color, background: sm.color + '22', padding: '1px 7px', borderRadius: '999px' }}>
          {sm.label}
        </span>
        {/* titre */}
        <span style={{ fontSize: '0.85rem', fontWeight: 500, flex: 1 }}>{lot.title}</span>
        {/* photos count */}
        {photos.length > 0 && (
          <button onClick={() => setShowPhotos(v => !v)}
            style={{ fontSize: '0.72rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            📷 {photos.length} photo{photos.length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* barre de progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
        <ProgressBar value={lot.progress} color={color} />
        <span style={{ fontSize: '0.72rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{lot.progress || 0}%</span>
      </div>

      {/* notes */}
      {lot.notes && (
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#374151' }}>💬 {lot.notes}</p>
      )}

      {/* photos */}
      {showPhotos && photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
          {photos.map((ph, i) => (
            <a key={i} href={ph.url} target="_blank" rel="noopener noreferrer">
              <img src={ph.url} alt={ph.name || 'photo'} loading="lazy"
                style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : card chantier ──────────────────────────────────────────

function ChantierCard({ intervention, tradeFilter }) {
  const navigate = useNavigate();
  const { lots, isLoading } = useInterventionLots(intervention.id);
  const [expanded, setExpanded] = useState(false);

  const visibleLots = useMemo(() => {
    if (!lots) return [];
    if (!tradeFilter) return lots;
    return lots.filter(l => l.trade_code === tradeFilter);
  }, [lots, tradeFilter]);

  const overall = useMemo(() => {
    if (!visibleLots.length) return 0;
    return Math.round(visibleLots.reduce((s, l) => s + (l.progress || 0), 0) / visibleLots.length);
  }, [visibleLots]);

  const statusColor = STATUS_COLORS[intervention.status] || '#6b7280';
  const firstDate = intervention.scheduled_dates?.[0] || intervention.date;

  // Résumé statuts des lots
  const lotCounts = useMemo(() => {
    const counts = { termine: 0, en_cours: 0, bloque: 0, a_venir: 0 };
    visibleLots.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    return counts;
  }, [visibleLots]);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.75rem' }}>
      {/* En-tête cliquable */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '0.75rem 1rem', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{intervention.client}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: statusColor, background: statusColor + '22', padding: '1px 7px', borderRadius: '999px' }}>
              {intervention.status}
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>{intervention.address}</p>
          {firstDate && (
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>📅 {formatDate(firstDate)}</p>
          )}
        </div>

        <div style={{ textAlign: 'right', minWidth: '80px' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: overall >= 100 ? '#10b981' : '#374151' }}>{overall}%</div>
          {visibleLots.length > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{visibleLots.length} lot{visibleLots.length > 1 ? 's' : ''}</div>
          )}
          <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Barre globale */}
      {visibleLots.length > 0 && (
        <div style={{ padding: '0 1rem', background: 'white' }}>
          <ProgressBar value={overall} />
        </div>
      )}

      {/* Résumé lots en pastilles */}
      {visibleLots.length > 0 && (
        <div style={{ padding: '0.4rem 1rem 0.6rem', background: 'white', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {lotCounts.bloque > 0 && (
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: '999px' }}>
              ⚠ {lotCounts.bloque} bloqué{lotCounts.bloque > 1 ? 's' : ''}
            </span>
          )}
          {lotCounts.en_cours > 0 && (
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '999px' }}>
              🔨 {lotCounts.en_cours} en cours
            </span>
          )}
          {lotCounts.termine > 0 && (
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '999px' }}>
              ✓ {lotCounts.termine} terminé{lotCounts.termine > 1 ? 's' : ''}
            </span>
          )}
          {lotCounts.a_venir > 0 && (
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b7280', background: '#f9fafb', padding: '2px 8px', borderRadius: '999px' }}>
              ⏳ {lotCounts.a_venir} à venir
            </span>
          )}
        </div>
      )}

      {/* Détail des lots (accordéon) */}
      {expanded && (
        <div style={{ padding: '0.5rem 1rem 0.75rem', background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
          {isLoading ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem' }}>Chargement…</p>
          ) : visibleLots.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.85rem' }}>Aucun lot pour ce chantier.</p>
          ) : (
            visibleLots.map(lot => <LotRow key={lot.id} lot={lot} />)
          )}
          <button
            onClick={() => navigate(`/planning/${intervention.id}`)}
            style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            → Ouvrir le chantier complet
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Vue principale ───────────────────────────────────────────────────────────

export default function SuiviChantiersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');

  // Fetch toutes les interventions non archivées de l'organisation
  const { data: interventions = [], isLoading } = useQuery({
    queryKey: ['interventions-moe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select('id, client, address, status, date, scheduled_dates, service')
        .eq('is_archived', false)
        .order('scheduled_dates', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const tradeGroups = tradesByCategory();

  const filtered = useMemo(() => {
    return interventions.filter(i => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!i.client?.toLowerCase().includes(q) && !i.address?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [interventions, statusFilter, search]);

  // Stats globales
  const stats = useMemo(() => ({
    total: interventions.length,
    en_cours: interventions.filter(i => i.status === 'En cours').length,
    a_venir: interventions.filter(i => i.status === 'À venir').length,
    termine: interventions.filter(i => i.status === 'Terminée').length,
  }), [interventions]);

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem' }}>🏗️ Suivi des Chantiers</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.88rem' }}>
          Avancement par corps de métier — toutes les interventions actives
        </p>
      </div>

      {/* Compteurs */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { label: 'Total', value: stats.total, color: '#374151' },
          { label: 'En cours', value: stats.en_cours, color: '#3b82f6' },
          { label: 'À venir', value: stats.a_venir, color: '#6b7280' },
          { label: 'Terminés', value: stats.termine, color: '#10b981' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.5rem 0.9rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un chantier…"
          className="form-control"
          style={{ flex: 1, minWidth: '180px' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ minWidth: '140px' }}>
          <option value="">Tous les statuts</option>
          <option value="En cours">En cours</option>
          <option value="À venir">À venir</option>
          <option value="Terminée">Terminés</option>
        </select>
        <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className="form-control" style={{ minWidth: '180px' }}>
          <option value="">Tous les métiers</option>
          {tradeGroups.map(g => (
            <optgroup key={g.id} label={g.label}>
              {g.trades.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Liste des chantiers */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Chargement des chantiers…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          {interventions.length === 0 ? 'Aucun chantier actif.' : 'Aucun chantier correspond à vos filtres.'}
        </div>
      ) : (
        filtered.map(i => (
          <ChantierCard key={i.id} intervention={i} tradeFilter={tradeFilter} />
        ))
      )}
    </div>
  );
}
