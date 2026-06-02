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
  'À venir':  '#8b7968',   // --text-tertiary
  'En cours': '#b87333',   // --color-copper
  'Terminée': '#7c8647',   // --color-success
};

const LOT_STATUS = {
  a_venir:  { label: 'À venir',  color: '#8b7968', bg: '#f5ede4' },
  en_cours: { label: 'En cours', color: '#b87333', bg: '#f9efe4' },
  termine:  { label: 'Terminé',  color: '#7c8647', bg: '#eef2e4' },
  bloque:   { label: 'Bloqué',   color: '#b84c3a', bg: '#fbeae8' },
};

const SORT_OPTIONS = [
  { value: 'attention',     label: "Attention d'abord" },
  { value: 'recent',        label: 'Activité récente' },
  { value: 'progress_asc',  label: 'Avancement ↑' },
  { value: 'progress_desc', label: 'Avancement ↓' },
  { value: 'alpha',         label: 'Client A→Z' },
];

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

function ProgressBar({ value, color }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const fill = color || (v >= 100 ? '#7c8647' : '#b87333');
  return (
    <div style={{ background: 'var(--border-color, #f4e5d9)', borderRadius: '999px', height: '6px', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${v}%`, height: '100%', background: fill, transition: 'width .3s' }} />
    </div>
  );
}

// ─── Ligne de lot ─────────────────────────────────────────────────────────────

function LotRow({ lot, userById, subById }) {
  const [showPhotos, setShowPhotos] = useState(false);
  const color = tradeColor(lot.trade_code);
  const sm = LOT_STATUS[lot.status] || LOT_STATUS.a_venir;
  const photos = Array.isArray(lot.photos) ? lot.photos : [];
  const assignee = lot.assigned_user_id ? userById[lot.assigned_user_id] : null;
  const sub = lot.subcontractor_id ? subById[lot.subcontractor_id] : null;
  const isBlocked = lot.status === 'bloque';

  return (
    <div style={{
      padding: '0.75rem 0.85rem',
      borderLeft: `3px solid ${isBlocked ? '#b84c3a' : color}`,
      marginBottom: '0.5rem',
      background: isBlocked ? '#fbeae8' : 'var(--bg-secondary, #ffe8d1)',
      borderRadius: '0 8px 8px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color, background: color + '22', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
          {tradeLabel(lot.trade_code)}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: sm.color, background: sm.bg, padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
          {sm.label}
        </span>
        <span style={{ fontSize: '0.88rem', fontWeight: 500, flex: 1, wordBreak: 'break-word', minWidth: 0, color: 'var(--text-primary, #1f1410)' }}>
          {lot.title}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
        <ProgressBar value={lot.progress} color={isBlocked ? '#b84c3a' : color} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #57473d)', whiteSpace: 'nowrap', fontWeight: 600, minWidth: '36px', textAlign: 'right' }}>
          {lot.progress || 0}%
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: sub ? '#7c3aed' : 'var(--text-secondary, #57473d)', fontWeight: sub ? 600 : 400 }}>
          {sub ? `🏢 ${sub.company_name}` : (assignee ? `👷 ${assignee.full_name || assignee.email}` : '—')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {photos.length > 0 && (
            <button onClick={() => setShowPhotos(v => !v)}
              style={{ fontSize: '0.75rem', color: '#b87333', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', minHeight: '36px' }}>
              📷 {photos.length}
            </button>
          )}
          {lot.updated_at && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #8b7968)', whiteSpace: 'nowrap' }}>🕑 {timeAgo(lot.updated_at)}</span>
          )}
        </div>
      </div>

      {lot.notes && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-primary, #1f1410)', wordBreak: 'break-word' }}>💬 {lot.notes}</p>
      )}

      {showPhotos && photos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
          {photos.map((ph, i) => (
            <a key={i} href={ph.url} target="_blank" rel="noopener noreferrer">
              <img src={ph.url} alt={ph.name || 'photo'} loading="lazy"
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color, #f4e5d9)' }} />
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
  const [hovered, setHovered] = useState(false);

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
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: hasBlocked ? '1px solid #b84c3a' : '1px solid var(--border-color, #f4e5d9)',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
        marginBottom: '0.75rem',
        background: 'var(--bg-primary, #ffffff)',
        boxShadow: hovered ? 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.1))' : 'var(--shadow-sm, 0 1px 3px 0 rgba(0,0,0,.1))',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: isMobile ? '0.9rem' : '0.85rem 1rem', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', wordBreak: 'break-word', color: 'var(--text-primary, #1f1410)' }}>
                {intervention.client}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: statusColor, background: statusColor + '22', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
                {intervention.status}
              </span>
              {hasBlocked && (
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b84c3a', background: '#fbeae8', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>
                  ⚠ {counts.bloque} bloqué{counts.bloque > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {intervention.address && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #57473d)', wordBreak: 'break-word' }}>
                {intervention.address}
              </p>
            )}
            {firstDate && (
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.77rem', color: 'var(--text-tertiary, #8b7968)' }}>📅 {formatDate(firstDate)}</p>
            )}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: overall >= 100 ? '#7c8647' : 'var(--text-primary, #1f1410)', lineHeight: 1 }}>
              {overall}%
            </span>
            {lots.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #8b7968)', marginTop: '2px' }}>
                {lots.length} lot{lots.length > 1 ? 's' : ''}
              </span>
            )}
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary, #8b7968)', marginTop: '4px' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {/* Barre globale */}
      {lots.length > 0 && (
        <div style={{ padding: '0 1rem 0.5rem' }}><ProgressBar value={overall} /></div>
      )}

      {/* Compteurs */}
      {lots.length > 0 && (
        <div style={{ padding: '0 1rem 0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {counts.en_cours > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b87333', background: '#f9efe4', padding: '2px 8px', borderRadius: '999px' }}>🔨 {counts.en_cours} en cours</span>}
          {counts.termine > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#7c8647', background: '#eef2e4', padding: '2px 8px', borderRadius: '999px' }}>✓ {counts.termine} terminé{counts.termine > 1 ? 's' : ''}</span>}
          {counts.a_venir > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8b7968', background: 'var(--bg-secondary, #ffe8d1)', border: '1px solid var(--border-color, #f4e5d9)', padding: '2px 8px', borderRadius: '999px' }}>⏳ {counts.a_venir} à venir</span>}
          {counts.bloque > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#b84c3a', background: '#fbeae8', padding: '2px 8px', borderRadius: '999px' }}>🚫 {counts.bloque} bloqué{counts.bloque > 1 ? 's' : ''}</span>}
        </div>
      )}

      {/* Lots dépliés */}
      {expanded && (
        <div style={{ padding: '0.5rem 0.85rem 0.85rem', background: 'var(--bg-secondary, #ffe8d1)', borderTop: '1px solid var(--border-color, #f4e5d9)' }}>
          {lots.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-tertiary, #8b7968)', fontSize: '0.85rem' }}>Aucun lot pour ce chantier.</p>
          ) : (
            lots.map(lot => <LotRow key={lot.id} lot={lot} userById={userById} subById={subById} />)
          )}
          <button
            onClick={() => navigate(`/planning/${intervention.id}`)}
            style={{
              marginTop: '0.75rem',
              fontSize: '0.88rem',
              color: '#b87333',
              background: 'var(--bg-primary, #ffffff)',
              border: '1px solid var(--border-color-dark, #e8d4c2)',
              borderRadius: 'var(--radius-md, 8px)',
              cursor: 'pointer',
              padding: '0.65rem 1rem',
              width: '100%',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              transition: 'background 0.15s',
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
      <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #1f1410)' }}>
        Avancement par corps de métier
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.5rem' }}>
        {byTrade.map(t => {
          const color = tradeColor(t.code);
          const active = activeTrade === t.code;
          return (
            <TradeSummaryCard key={t.code} t={t} color={color} active={active} onPick={onPick} isMobile={isMobile} />
          );
        })}
      </div>
    </div>
  );
}

function TradeSummaryCard({ t, color, active, onPick, isMobile }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onPick(active ? '' : t.code)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left',
        background: active ? color + '11' : 'var(--bg-primary, #ffffff)',
        cursor: 'pointer',
        border: active ? `2px solid ${color}` : '1px solid var(--border-color, #f4e5d9)',
        borderRadius: 'var(--radius-md, 10px)',
        padding: isMobile ? '0.6rem 0.7rem' : '0.5rem 0.7rem',
        minHeight: '44px',
        boxShadow: hovered ? 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,.08))' : 'var(--shadow-xs, 0 1px 2px 0 rgba(0,0,0,.05))',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color, lineHeight: 1.3 }}>{tradeLabel(t.code)}</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary, #1f1410)' }}>{t.progress}%</span>
      </div>
      <ProgressBar value={t.progress} color={color} />
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary, #8b7968)' }}>{t.count} lot{t.count > 1 ? 's' : ''}</span>
        {t.blocked > 0 && <span style={{ fontSize: '0.68rem', color: '#b84c3a', fontWeight: 600 }}>⚠ {t.blocked} bloqué{t.blocked > 1 ? 's' : ''}</span>}
      </div>
    </button>
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
    { label: 'Chantiers',  value: stats.total,    color: 'var(--text-primary, #1f1410)' },
    { label: 'En cours',   value: stats.en_cours,  color: '#b87333' },
    { label: 'À venir',    value: stats.a_venir,   color: '#8b7968' },
    { label: 'Terminés',   value: stats.termine,   color: '#7c8647' },
    { label: 'Bloqués',    value: stats.bloques,   color: '#b84c3a' },
  ];

  const activeFiltersCount = [search, statusFilter, tradeFilter, onlyAttention].filter(Boolean).length;
  const tradeGroups = tradesByCategory();

  return (
    <div style={{ padding: isMobile ? '0.75rem' : '1rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 0.2rem', fontSize: isMobile ? '1.2rem' : '1.3rem', color: 'var(--text-primary, #1f1410)', borderLeft: '3px solid #b87333', paddingLeft: '0.6rem' }}>
            🏗️ Suivi des Chantiers
          </h2>
          {!isMobile && (
            <p style={{ margin: '0 0 0 calc(0.6rem + 3px)', fontSize: '0.85rem', color: 'var(--text-secondary, #57473d)' }}>
              Avancement par corps de métier — toutes les interventions actives
            </p>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sous-traitants')} style={{ whiteSpace: 'nowrap', minHeight: '40px' }}>
          🏢 Sous-traitants
        </button>
      </div>

      {/* Compteurs — défilement horizontal sur mobile */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '4px',
        marginBottom: '1.25rem',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {statsItems.map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-primary, #ffffff)',
            border: '1px solid var(--border-color, #f4e5d9)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: isMobile ? '0.6rem 0.85rem' : '0.5rem 0.9rem',
            textAlign: 'center',
            flexShrink: 0,
            boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0,0,0,.05))',
          }}>
            <div style={{ fontSize: isMobile ? '1.4rem' : '1.3rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #8b7968)', marginTop: '3px', whiteSpace: 'nowrap' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Synthèse par métier */}
      {!isLoading && (
        <TradeSummary lots={visibleLots} activeTrade={tradeFilter} onPick={setTradeFilter} isMobile={isMobile} />
      )}

      {/* Filtres */}
      {isTablet ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: showFilters ? '0.6rem' : 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un chantier…"
              className="form-control"
              style={{ flex: 1, minHeight: '44px' }}
            />
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
              style={{ minHeight: '44px', whiteSpace: 'nowrap' }}
            >
              ⚙ Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
            </button>
          </div>
          {showFilters && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ minHeight: '44px' }}>
                <option value="">Tous statuts</option>
                <option value="En cours">En cours</option>
                <option value="À venir">À venir</option>
                <option value="Terminée">Terminés</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="form-control" style={{ minHeight: '44px' }}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={tradeFilter} onChange={e => setTradeFilter(e.target.value)} className="form-control" style={{ minHeight: '44px', gridColumn: '1 / -1' }}>
                <option value="">Tous les métiers</option>
                {tradeGroups.map(g => (
                  <optgroup key={g.id} label={g.label}>
                    {g.trades.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <label style={{ fontSize: '0.88rem', color: 'var(--text-primary, #1f1410)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', gridColumn: '1 / -1', minHeight: '44px' }}>
                <input type="checkbox" checked={onlyAttention} onChange={e => setOnlyAttention(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                ⚠ Chantiers avec lots bloqués seulement
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
            <label style={{ fontSize: '0.82rem', color: 'var(--text-primary, #1f1410)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
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
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary, #8b7968)', background: 'var(--bg-secondary, #ffe8d1)', borderRadius: 'var(--radius-lg, 12px)', border: '1px dashed var(--border-color-dark, #e8d4c2)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
          {interventions.length === 0 ? 'Aucun chantier actif.' : 'Aucun chantier ne correspond aux filtres.'}
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary, #8b7968)', marginBottom: '0.5rem' }}>
            {cards.length} chantier{cards.length > 1 ? 's' : ''} affiché{cards.length > 1 ? 's' : ''}
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
