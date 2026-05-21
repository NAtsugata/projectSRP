// src/pages/AdminEmployeeTrackingView.jsx
import React, { useState, useMemo } from 'react';
import './AdminEmployeeTrackingView.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computeNetDuration(report) {
  if (!report || typeof report !== 'object') return null;
  if (!report.arrivalTime || !report.departureTime) return null;
  const arr = new Date(report.arrivalTime).getTime();
  const dep = new Date(report.departureTime).getTime();
  if (Number.isNaN(arr) || Number.isNaN(dep)) return null;
  const ms = dep - arr;
  if (ms <= 0) return null;
  const pauseMs = (Array.isArray(report.pauseHistory) ? report.pauseHistory : []).reduce((acc, p) => {
    if (!p) return acc;
    if (p.start && p.end) {
      const ps = new Date(p.start).getTime();
      const pe = new Date(p.end).getTime();
      if (Number.isNaN(ps) || Number.isNaN(pe) || pe <= ps) return acc;
      return acc + (pe - ps);
    }
    if (typeof p.duration === 'number' && p.duration > 0) return acc + p.duration * 1000;
    return acc;
  }, 0);
  const net = Math.max(0, ms - Math.min(pauseMs, ms));
  const h = Math.floor(net / 3600000);
  const m = Math.floor((net % 3600000) / 60000);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function toDateKey(input) {
  if (!input) return '';
  const str = String(input);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function statusLabel(status) {
  if (!status) return { label: 'À venir', cls: 'pending' };
  const s = status.toLowerCase();
  if (s.includes('termin') || s === 'completed' || s === 'done') return { label: 'Terminée', cls: 'completed' };
  if (s.includes('cours') || s === 'in_progress') return { label: 'En cours', cls: 'in-progress' };
  return { label: status, cls: 'pending' };
}

function getInterventionDate(iv) {
  if (Array.isArray(iv.scheduled_dates) && iv.scheduled_dates.length > 0) {
    return iv.scheduled_dates[0];
  }
  return iv.date || '';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminEmployeeTrackingView({ rows, users, isLoading }) {
  // Pas de filtre date par défaut → tout l'historique visible
  const [filterUser, setFilterUser] = useState('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Filter ──
  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (filterUser !== 'all' && row.userId !== filterUser) return false;
      const dateKey = toDateKey(getInterventionDate(row.intervention));
      if (filterStart && dateKey && dateKey < filterStart) return false;
      if (filterEnd && dateKey && dateKey > filterEnd) return false;
      if (filterStatus !== 'all') {
        const { cls } = statusLabel(row.intervention.status);
        if (cls !== filterStatus) return false;
      }
      return true;
    });
  }, [rows, filterUser, filterStart, filterEnd, filterStatus]);

  // ── Stats par employé (sur les lignes filtrées) ──
  const employeeStats = useMemo(() => {
    const map = {};
    filtered.forEach(row => {
      if (!map[row.userId]) {
        map[row.userId] = {
          userId: row.userId,
          name: row.userName,
          totalInterventions: 0,
          totalDays: 0,
          done: 0,
          totalMinutes: 0,
        };
      }
      const s = map[row.userId];
      s.totalInterventions++;
      s.totalDays += row.days || 1;
      if (statusLabel(row.intervention.status).cls === 'completed') s.done++;
      const dur = computeNetDuration(row.intervention.report);
      if (dur) {
        const [h, rest] = dur.split('h');
        s.totalMinutes += parseInt(h, 10) * 60 + parseInt(rest || '0', 10);
      }
    });
    return Object.values(map).sort((a, b) => b.totalDays - a.totalDays);
  }, [filtered]);

  const formatMinutes = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const resetFilters = () => {
    setFilterUser('all');
    setFilterStart('');
    setFilterEnd('');
    setFilterStatus('all');
  };

  if (isLoading) {
    return (
      <div className="employee-tracking">
        <h1>📊 Suivi des employés</h1>
        <div className="empty-state"><div className="empty-icon">⏳</div><p>Chargement...</p></div>
      </div>
    );
  }

  return (
    <div className="employee-tracking">
      <h1>📊 Suivi des employés</h1>

      {/* ── Filters ── */}
      <div className="tracking-filters">
        <label>
          Employé
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="all">Tous</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name || 'Sans nom'}</option>
            ))}
          </select>
        </label>
        <label>
          Du
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} placeholder="Depuis toujours" />
        </label>
        <label>
          Au
          <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
        </label>
        <label>
          Statut
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">Tous</option>
            <option value="completed">Terminées</option>
            <option value="in-progress">En cours</option>
            <option value="pending">À venir</option>
          </select>
        </label>
        <button className="btn-reset-filters" onClick={resetFilters}>↺ Réinitialiser</button>
      </div>

      {/* ── Stats cards ── */}
      {employeeStats.length > 0 && (
        <div className="employee-stats-grid">
          {employeeStats.map(s => (
            <div
              key={s.userId}
              className={`employee-stat-card${filterUser === s.userId ? ' selected' : ''}`}
              onClick={() => setFilterUser(filterUser === s.userId ? 'all' : s.userId)}
              title="Cliquer pour filtrer"
            >
              <div className="stat-card-name">
                <div className="stat-card-avatar">{initials(s.name)}</div>
                {s.name}
              </div>
              <div className="stat-card-metrics">
                <div className="stat-metric">
                  <span className="stat-metric-value">{s.totalInterventions}</span>
                  <span className="stat-metric-label">Interv.</span>
                </div>
                <div className="stat-metric">
                  <span className="stat-metric-value">{s.totalDays}</span>
                  <span className="stat-metric-label">Jours</span>
                </div>
                <div className="stat-metric">
                  <span className="stat-metric-value">{formatMinutes(s.totalMinutes)}</span>
                  <span className="stat-metric-label">Temps net</span>
                </div>
                <div className="stat-metric">
                  <span className="stat-metric-value">{s.totalInterventions > 0 ? Math.round(s.done / s.totalInterventions * 100) : 0}%</span>
                  <span className="stat-metric-label">Terminées</span>
                </div>
              </div>
              <div className="stat-completion-bar">
                <div
                  className="stat-completion-fill"
                  style={{ width: `${s.totalInterventions > 0 ? (s.done / s.totalInterventions * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="tracking-table-wrap">
        <div className="tracking-table-header">
          <h3>Détail des interventions</h3>
          <span className="tracking-count-badge">{filtered.length} ligne{filtered.length > 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p>Aucune intervention pour ces filtres.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tracking-table">
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Client</th>
                  <th>Adresse</th>
                  <th>Date début</th>
                  <th>Jours</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th>Durée nette</th>
                  <th>Équipe</th>
                  <th>Statut</th>
                  <th>Checks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const iv = row.intervention;
                  const report = iv.report || {};
                  const dur = computeNetDuration(report);
                  const { label: stLabel, cls: stCls } = statusLabel(iv.status);
                  const totalChecks = report.quick_checkpoints?.length || 0;
                  const doneChecks = report.quick_checkpoints?.filter(c => c.done).length || 0;
                  const checksOk = totalChecks > 0 && doneChecks === totalChecks;
                  const days = row.days || 1;

                  return (
                    <tr key={`${row.userId}-${iv.id}-${i}`}>
                      <td>
                        <div className="td-employee">
                          <div className="td-avatar">{initials(row.userName)}</div>
                          {row.userName}
                        </div>
                      </td>
                      <td className="td-client">{iv.client || '—'}</td>
                      <td>
                        <div className="td-address" title={iv.address}>{iv.address || '—'}</div>
                      </td>
                      <td>{formatDate(getInterventionDate(iv))}</td>
                      <td>
                        <span className={`days-badge${days > 1 ? ' multi' : ''}`}>
                          {days} j
                        </span>
                      </td>
                      <td className="td-time">{formatTime(report.arrivalTime)}</td>
                      <td className="td-time">{formatTime(report.departureTime)}</td>
                      <td className="td-duration">{dur || '—'}</td>
                      <td>
                        <div className="td-team">
                          {(row.teamNames || []).map((name, j) => (
                            <span
                              key={j}
                              className={`team-chip${name === row.userName ? ' self' : ''}`}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${stCls}`}>{stLabel}</span>
                      </td>
                      <td>
                        {totalChecks === 0 ? (
                          <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                        ) : (
                          <span className={`checkpoint-progress${checksOk ? ' done' : ''}`}>
                            {checksOk ? '✅' : '⬜'} {doneChecks}/{totalChecks}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
