// src/pages/SuiviChantiersView.jsx
// Tableau de bord maître d'œuvre / conducteur de travaux.
// Accessible via la permission view_all_interventions.

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useUsers } from '../hooks/useUsers';
import { useSubcontractors } from '../hooks/useSubcontractors';
import { useToast } from '../contexts/ToastContext';
import { SkeletonList } from '../components/ui/LoadingSpinner';
import { tradeLabel, tradeColor, tradesByCategory } from '../constants/buildingTrades';

// ─── Responsive ───────────────────────────────────────────────────────────────

function useBreakpoint() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return { isMobile: w < 640, isTablet: w < 900 };
}

// ─── Constantes — palette alignée sur le thème copper ────────────────────────

const STATUS_COLORS = {
  'À venir':  '#8b7968',
  'En cours': '#b87333',
  'Terminée': '#7c8647',
};

const LOT_STATUS = {
  a_venir:  { label: 'À venir',  color: '#6d5d4f', bg: '#f0e7dc' },
  en_cours: { label: 'En cours', color: '#9c5e22', bg: '#f9efe4' },
  termine:  { label: 'Terminé',  color: '#5e6b31', bg: '#eef2e4' },
  bloque:   { label: 'Bloqué',   color: '#a23a29', bg: '#fbeae8' },
};

const SORT_OPTIONS = [
  { value: 'attention',     label: "Attention d'abord" },
  { value: 'recent',        label: 'Activité récente' },
  { value: 'progress_asc',  label: 'Avancement ↑' },
  { value: 'progress_desc', label: 'Avancement ↓' },
  { value: 'alpha',         label: 'Client A→Z' },
];

// Couleurs de texte à fort contraste (lisibilité mobile)
const TXT = {
  primary:   '#1f1410',
  secondary: '#473a30',
  muted:     '#6d5d4f',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

function avg(lots) {
  if (!lots.length) return 0;
  return Math.round(lots.reduce((s, l) => s + (l.progress || 0), 0) / lots.length);
}

function ProgressBar({ value, color, height = 8 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const fill = color || (v >= 100 ? '#7c8647' : '#b87333');
  return (
    <div style={{ background: '#eaddd0', borderRadius: '999px', height: `${height}px`, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${v}%`, height: '100%', background: fill, transition: 'width .3s' }} />
    </div>
  );
}

// ─── Ligne de lot ─────────────────────────────────────────────────────────────

function LotRow({ lot, userById, subById, isMobile }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const color = tradeColor(lot.trade_code);
  const sm = LOT_STATUS[lot.status] || LOT_STATUS.a_venir;
  const photos = Array.isArray(lot.photos) ? lot.photos : [];
  const assignee = lot.assigned_user_id ? userById[lot.assigned_user_id] : null;
  const sub = lot.subcontractor_id ? subById[lot.subcontractor_id] : null;
  const isBlocked = lot.status === 'bloque';

  return (
    <div style={{
      padding: isMobile ? '0.85rem' : '0.75rem 0.85rem',
      borderLeft: `4px solid ${isBlocked ? '#a23a29' : color}`,
      marginBottom: '0.6rem',
      background: isBlocked ? '#fbeae8' : '#ffffff',
      borderRadius: '0 10px 10px 0',
      boxShadow: '0 1px 2px rgba(0,0,0,.04)',
    }}>
      {/* Titre du lot — en grand, en premier */}
      <div style={{ fontSize: isMobile ? '1rem' : '0.95rem', fontWeight: 600, color: TXT.primary, wordBreak: 'break-word', lineHeight: 1.35 }}>
        {lot.title}
      </div>

      {/* Métier + statut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color, background: color + '22', padding: '3px 10px', borderRadius: '999px' }}>
          {tradeLabel(lot.trade_code)}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: sm.color, background: sm.bg, padding: '3px 10px', borderRadius: '999px' }}>
          {sm.label}
        </span>
      </div>

      {/* Barre de progression */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.6rem' }}>
        <ProgressBar value={lot.progress} color={isBlocked ? '#a23a29' : color} />
        <span style={{ fontSize: '0.9rem', color: TXT.primary, whiteSpace: 'nowrap', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
          {lot.progress || 0}%
        </span>
      </div>

      {/* Assigné */}
      <div style={{ fontSize: '0.88rem', color: sub ? '#7c3aed' : TXT.secondary, fontWeight: sub ? 700 : 500, marginTop: '0.6rem' }}>
        {sub ? `🏢 ${sub.company_name}` : (assignee ? `👷 ${assignee.full_name || assignee.email}` : '👷 Non assigné')}
      </div>

      {/* Pied : photos + horodatage */}
      {(photos.length > 0 || lot.updated_at) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {photos.length > 0 ? (
            <button onClick={() => setShowPhotos(v => !v)}
              style={{ fontSize: '0.85rem', color: '#9c5e22', background: '#f9efe4', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', minHeight: '40px', fontWeight: 600 }}>
              📷 {photos.length} photo{photos.length > 1 ? 's' : ''} {showPhotos ? '▲' : '▼'}
            </button>
          ) : <span />}
          {lot.updated_at && (
            <span style={{ fontSize: '0.8rem', color: TXT.muted, whiteSpace: 'nowrap' }}>🕑 {timeAgo(lot.updated_at)}</span>
          )}
        </div>
      )}

      {lot.notes && (
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.88rem', color: TXT.secondary, wordBreak: 'break-word', background: '#faf6f1', padding: '0.5rem 0.65rem', borderRadius: '8px', lineHeight: 1.4 }}>
          💬 {lot.notes}
        </p>
      )}

      {showPhotos && photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}>
          {photos.map((ph, i) => (
            <a key={i} href={ph.url} target="_blank" rel="noopener noreferrer">
              <img src={ph.url} alt={ph.name || 'photo'} loading="lazy"
                style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #eaddd0' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card chantier ────────────────────────────────────────────────────────────

function ChantierCard({ intervention, lots, userById, subById, defaultExpanded, isMobile }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  const overall = useMemo(() => avg(lots), [lots]);
  const statusColor = STATUS_COLORS[intervention.status] || '#8b7968';
  const firstDate = intervention.scheduled_dates?.[0] || intervention.date;

  const counts = useMemo(() => {
    const c = { termine: 0, en_cours: 0, bloque: 0, a_venir: 0 };
    lots.forEach(l => { if (c[l.status] !== undefined) c[l.status]++; });
    return c;
  }, [lots]);

  const hasBlocked = counts.bloque > 0;

  return (
    <div style={{
      border: hasBlocked ? '2px solid #e0a59c' : '1px solid #ecddcf',
      borderRadius: '14px',
      overflow: 'hidden',
      marginBottom: '0.85rem',
      background: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
    }}>
      {/* Header — cliquable */}
      <div onClick={() => setExpanded(v => !v)} style={{ padding: '1rem', cursor: 'pointer' }}>
        {/* Ligne 1 : client + % */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: isMobile ? '1.1rem' : '1.05rem', color: TXT.primary, wordBreak: 'break-word', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
            {intervention.client}
          </span>
          <div style={{ textAlign: 'center', flexShrink: 0, background: overall >= 100 ? '#eef2e4' : '#f9efe4', borderRadius: '10px', padding: '0.3rem 0.6rem', minWidth: '64px' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: overall >= 100 ? '#5e6b31' : '#9c5e22', lineHeight: 1 }}>
              {overall}%
            </div>
            {lots.length > 0 && (
              <div style={{ fontSize: '0.7rem', color: TXT.muted, marginTop: '2px' }}>
                {lots.length} lot{lots.length > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Ligne 2 : statut + alerte */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: statusColor, background: statusColor + '22', padding: '3px 10px', borderRadius: '999px' }}>
            {intervention.status}
          </span>
          {hasBlocked && (
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a23a29', background: '#fbeae8', padding: '3px 10px', borderRadius: '999px' }}>
              ⚠ {counts.bloque} bloqué{counts.bloque > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Adresse + date */}
        {intervention.address && (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.9rem', color: TXT.secondary, wordBreak: 'break-word', lineHeight: 1.4 }}>
            📍 {intervention.address}
          </p>
        )}
        {firstDate && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: TXT.muted }}>📅 {formatDate(firstDate)}</p>
        )}

        {/* Barre globale */}
        {lots.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}><ProgressBar value={overall} height={8} /></div>
        )}

        {/* Compteurs + indicateur déplier */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {counts.en_cours > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9c5e22', background: '#f9efe4', padding: '3px 9px', borderRadius: '999px' }}>🔨 {counts.en_cours}</span>}
            {counts.termine > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5e6b31', background: '#eef2e4', padding: '3px 9px', borderRadius: '999px' }}>✓ {counts.termine}</span>}
            {counts.a_venir > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6d5d4f', background: '#f0e7dc', padding: '3px 9px', borderRadius: '999px' }}>⏳ {counts.a_venir}</span>}
            {counts.bloque > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a23a29', background: '#fbeae8', padding: '3px 9px', borderRadius: '999px' }}>🚫 {counts.bloque}</span>}
          </div>
          <span style={{ fontSize: '0.85rem', color: '#9c5e22', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {expanded ? 'Masquer ▲' : 'Détails ▼'}
          </span>
        </div>
      </div>

      {/* Lots dépliés */}
      {expanded && (
        <div style={{ padding: '0.75rem', background: '#faf6f1', borderTop: '1px solid #ecddcf' }}>
          {lots.length === 0 ? (
            <p style={{ margin: '0.25rem 0', color: TXT.muted, fontSize: '0.9rem', textAlign: 'center' }}>Aucun lot pour ce chantier.</p>
          ) : (
            lots.map(lot => <LotRow key={lot.id} lot={lot} userById={userById} subById={subById} isMobile={isMobile} />)
          )}
          <button
            onClick={() => navigate(`/planning/${intervention.id}`)}
            style={{
              marginTop: '0.5rem',
              fontSize: '0.92rem',
              color: '#ffffff',
              background: '#b87333',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              padding: '0.75rem 1rem',
              width: '100%',
              minHeight: '48px',
              fontWeight: 600,
            }}
          >
            Ouvrir le chantier complet →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Synthèse par corps de métier ─────────────────────────────────────────────

function TradeSummary({ lots, activeTrade, onPick, isMobile }) {
  const byTrade = useMemo(() => {
    const map = {};
    lots.forEach(l => {
      if (!map[l.trade_code]) map[l.trade_code] = { code: l.trade_code, lots: [], blocked: 0 };
      map[l.trade_code].lots.push(l);
      if (l.status === 'bloque') map[l.trade_code].blocked++;
    });
    return Object.values(map)
      .map(t => ({ ...t, progress: avg(t.lots), count: t.lots.length }))
      .sort((a, b) => b.count - a.count);
  }, [lots]);

  if (byTrade.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '1rem', fontWeight: 700, color: TXT.primary }}>
        Avancement par métier
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
        {byTrade.map(t => {
          const color = tradeColor(t.code);
          const active = activeTrade === t.code;
          return (
            <button key={t.code} onClick={() => onPick(active ? '' : t.code)}
              style={{
                textAlign: 'left',
                background: active ? color + '15' : '#ffffff',
                cursor: 'pointer',
                border: active ? `2px solid ${color}` : '1px solid #ecddcf',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                minHeight: '56px',
                boxShadow: '0 1px 2px rgba(0,0,0,.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color }}>{tradeLabel(t.code)}</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: TXT.primary }}>{t.progress}%</span>
              </div>
              <ProgressBar value={t.progress} color={color} />
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: TXT.muted, fontWeight: 500 }}>{t.count} lot{t.count > 1 ? 's' : ''}</span>
                {t.blocked > 0 && <span style={{ fontSize: '0.8rem', color: '#a23a29', fontWeight: 700 }}>⚠ {t.blocked} bloqué{t.blocked > 1 ? 's' : ''}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vue principale ───────────────────────────────────────────────────────────

export default function SuiviChantiersView() {
  const { isMobile, isTablet } = useBreakpoint();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [sortBy, setSortBy] = useState('attention');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();
  const { users } = useUsers();
  const { subcontractors } = useSubcontractors();

  const userById = useMemo(() => {
    const m = {};
    (users || []).forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  const subById = useMemo(() => {
    const m = {};
    (subcontractors || []).forEach(s => { m[s.id] = s; });
    return m;
  }, [subcontractors]);

  const { data: interventions = [], isLoading: loadingInt } = useQuery({
    queryKey: ['interventions-moe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select('id, client, address, status, date, scheduled_dates, service')
        .eq('is_archived', false)
        .order('scheduled_dates', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    onError: (e) => toast.error('Impossible de charger les chantiers : ' + (e.message || 'erreur réseau')),
  });

  const { data: allLots = [], isLoading: loadingLots } = useQuery({
    queryKey: ['all-lots-moe'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_lots')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
    onError: (e) => toast.error('Impossible de charger les lots : ' + (e.message || 'erreur réseau')),
  });

  const isLoading = loadingInt || loadingLots;

  const lotsByIntervention = useMemo(() => {
    const map = {};
    allLots.forEach(l => {
      if (tradeFilter && l.trade_code !== tradeFilter) return;
      (map[l.intervention_id] = map[l.intervention_id] || []).push(l);
    });
    return map;
  }, [allLots, tradeFilter]);

  const visibleLots = useMemo(
    () => (tradeFilter ? allLots.filter(l => l.trade_code === tradeFilter) : allLots),
    [allLots, tradeFilter]
  );

  const cards = useMemo(() => {
    let list = interventions.map(i => {
      const lots = lotsByIntervention[i.id] || [];
      const blocked = lots.filter(l => l.status === 'bloque').length;
      const lastActivity = lots.reduce((max, l) => {
        const t = l.updated_at ? new Date(l.updated_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      return { intervention: i, lots, overall: avg(lots), blocked, lastActivity };
    });

    if (tradeFilter) list = list.filter(c => c.lots.length > 0);
    if (statusFilter) list = list.filter(c => c.intervention.status === statusFilter);
    if (onlyAttention) list = list.filter(c => c.blocked > 0);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.intervention.client?.toLowerCase().includes(q) ||
        c.intervention.address?.toLowerCase().includes(q));
    }

    const sorters = {
      attention:    (a, b) => (b.blocked - a.blocked) || (b.lastActivity - a.lastActivity),
      recent:       (a, b) => b.lastActivity - a.lastActivity,
      progress_asc: (a, b) => a.overall - b.overall,
      progress_desc:(a, b) => b.overall - a.overall,
      alpha:        (a, b) => (a.intervention.client || '').localeCompare(b.intervention.client || ''),
    };
    return list.sort(sorters[sortBy] || sorters.attention);
  }, [interventions, lotsByIntervention, tradeFilter, statusFilter, onlyAttention, search, sortBy]);

  const stats = useMemo(() => ({
    total:    interventions.length,
    en_cours: interventions.filter(i => i.status === 'En cours').length,
    a_venir:  interventions.filter(i => i.status === 'À venir').length,
    termine:  interventions.filter(i => i.status === 'Terminée').length,
    bloques:  allLots.filter(l => l.status === 'bloque').length,
  }), [interventions, allLots]);

  const statsItems = [
    { label: 'Chantiers', value: stats.total,    color: TXT.primary },
    { label: 'En cours',  value: stats.en_cours, color: '#9c5e22' },
    { label: 'À venir',   value: stats.a_venir,  color: '#6d5d4f' },
    { label: 'Terminés',  value: stats.termine,  color: '#5e6b31' },
    { label: 'Bloqués',   value: stats.bloques,  color: '#a23a29' },
  ];

  const activeFiltersCount = [search, statusFilter, tradeFilter, onlyAttention].filter(Boolean).length;
  const tradeGroups = tradesByCategory();

  return (
    <div style={{ padding: isMobile ? '0.85rem' : '1rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? '1.3rem' : '1.4rem', color: TXT.primary, borderLeft: '4px solid #b87333', paddingLeft: '0.65rem', lineHeight: 1.2 }}>
          🏗️ Suivi des Chantiers
        </h2>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sous-traitants')} style={{ whiteSpace: 'nowrap', minHeight: '44px' }}>
          🏢 Sous-traitants
        </button>
      </div>

      {/* Compteurs — grille 3 colonnes sur mobile, lisible */}
      {isMobile ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {statsItems.map(s => (
            <div key={s.label} style={{
              background: '#ffffff', border: '1px solid #ecddcf', borderRadius: '12px',
              padding: '0.7rem 0.5rem', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,.05)',
            }}>
              <div style={{ fontSize: '1.55rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: TXT.muted, marginTop: '4px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {statsItems.map(s => (
            <div key={s.label} style={{
              background: '#ffffff', border: '1px solid #ecddcf', borderRadius: '10px',
              padding: '0.6rem 1rem', textAlign: 'center', minWidth: '90px', boxShadow: '0 1px 2px rgba(0,0,0,.05)',
            }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.78rem', color: TXT.muted, marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Synthèse par métier */}
      {!isLoading && (
        <TradeSummary lots={visibleLots} activeTrade={tradeFilter} onPick={setTradeFilter} isMobile={isMobile} />
      )}

      {/* Filtres */}
      {isTablet ? (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: showFilters ? '0.7rem' : 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="form-control"
              style={{ flex: 1, minHeight: '48px', fontSize: '1rem' }}
            />
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '48px', whiteSpace: 'nowrap' }}
            >
              ⚙{activeFiltersCount > 0 ? ` ${activeFiltersCount}` : ''}
            </button>
          </div>
          {showFilters && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: '#faf6f1', padding: '0.85rem', borderRadius: '12px', border: '1px solid #ecddcf' }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ minHeight: '48px', fontSize: '1rem' }}>
                <option value="">Tous les statuts</option>
                <option value="En cours">En cours</option>
                <option value="À venir">À venir</option>
                <option value="Terminée">Terminés</option>
              </select>
              <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className="form-control" style={{ minHeight: '48px', fontSize: '1rem' }}>
                <option value="">Tous les métiers</option>
                {tradeGroups.map(g => (
                  <optgroup key={g.id} label={g.label}>
                    {g.trades.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-control" style={{ minHeight: '48px', fontSize: '1rem' }}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label style={{ fontSize: '0.95rem', color: TXT.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '44px' }}>
                <input type="checkbox" checked={onlyAttention} onChange={e => setOnlyAttention(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                ⚠ Seulement les chantiers bloqués
              </label>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un chantier…" className="form-control" style={{ flex: 1, minWidth: '160px' }} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ minWidth: '130px' }}>
              <option value="">Tous les statuts</option>
              <option value="En cours">En cours</option>
              <option value="À venir">À venir</option>
              <option value="Terminée">Terminés</option>
            </select>
            <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className="form-control" style={{ minWidth: '160px' }}>
              <option value="">Tous les métiers</option>
              {tradeGroups.map(g => (
                <optgroup key={g.id} label={g.label}>
                  {g.trades.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-control" style={{ minWidth: '170px' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: TXT.primary, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <input type="checkbox" checked={onlyAttention} onChange={e => setOnlyAttention(e.target.checked)} />
              ⚠ Afficher seulement les chantiers avec lots bloqués
            </label>
          </div>
        </>
      )}

      {/* Liste */}
      {isLoading ? (
        <SkeletonList count={4} variant="card" />
      ) : cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: TXT.muted, background: '#faf6f1', borderRadius: '14px', border: '1px dashed #e0cdb8' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            {interventions.length === 0 ? 'Aucun chantier actif.' : 'Aucun chantier ne correspond aux filtres.'}
          </p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.85rem', color: TXT.muted, marginBottom: '0.6rem', fontWeight: 500 }}>
            {cards.length} chantier{cards.length > 1 ? 's' : ''}
          </div>
          {cards.map(c => (
            <ChantierCard
              key={c.intervention.id}
              intervention={c.intervention}
              lots={c.lots}
              userById={userById}
              subById={subById}
              defaultExpanded={onlyAttention || !!tradeFilter}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
