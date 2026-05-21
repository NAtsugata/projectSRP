// src/pages/AdminEmployeeTrackingView.jsx
import React, { useState, useMemo } from 'react';
import './AdminEmployeeTrackingView.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function computeNetDuration(report) {
  if (!report?.arrivalTime || !report?.departureTime) return null;
  const ms = new Date(report.departureTime) - new Date(report.arrivalTime);
  if (ms <= 0) return null;
  const pauseMs = (report.pauseHistory || []).reduce((acc, p) => {
    if (p.start && p.end) return acc + (new Date(p.end) - new Date(p.start));
    if (p.duration) return acc + p.duration * 1000;
    return acc;
  }, 0);
  const net = Math.max(0, ms - pauseMs);
  const h = Math.floor(net / 3600000);
  const m = Math.floor((net % 3600000) / 60000);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function statusLabel(status) {
  if (!status) return { label: 'À venir', cls: 'pending' };
  const s = status.toLowerCase();
  if (s.includes('termin') || s === 'completed' || s === 'done') return { label: 'Terminée', cls: 'completed' };
  if (s.includes('cours') || s === 'in_progress') return { label: 'En cours', cls: 'in-progress' };
  return { label: status, cls: 'pending' };
}

function getInterventionDate(iv) {
  if (iv.scheduled_dates?.length) return iv.scheduled_dates[0];
  return iv.date || '';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminEmployeeTrackingView({ rows, users, isLoading }) {
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

  const [filterUser, setFilterUser] = useState('all');
  const [filterStart, setFilterStart] = useState(firstOfMonth);
  const [filterEnd, setFilterEnd] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Filter ──
  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (filterUser !== 'all' && row.userId !== filterUser) return false;
      const date = getInterventionDate(row.intervention);
      if (filterStart && date && date < filterStart) return false;
      if (filterEnd && date && date > filterEnd) return false;
      if (filterStatus !== 'all') {
        const { cls } = statusLabel(row.intervention.status);
        if (cls !== filterStatus) return false;
      }
      return true;
    });
  }, [rows, filterUser, filterStart, filterEnd, filterStatus]);

  // ── Stats per employee (from filtered rows) ──
  const employeeStats = useMemo(() => {
    const map = {};
    filtered.forEach(row => {
      if (!map[row.userId]) {
        map[row.userId] = {
          userId: row.userId,
          name: row.userName,
          total: 0,
          done: 0,
          totalMinutes: 0,
        };
      }
      const s = map[row.userId];
      s.total++;
      if (statusLabel(row.intervention.status).cls === 'completed') s.done++;
      const dur = computeNetDuration(row.intervention.report);
      if (dur) {
        const [h, m] = dur.split('h');
        s.totalMinutes += parseInt(h, 10) * 60 + parseInt(m || '0', 10);
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const formatMinutes = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const resetFilters = () => {
    setFilterUser('all');
    setFilterStart(firstOfMonth);
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
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </label>
        <label>
          Du
          <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
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
                  <span className="stat-metric-value">{s.total}</span>
                  <span className="stat-metric-label">Interv.</span>
                </div>
                <div className="stat-metric">
                  <span className="stat-metric-value">{formatMinutes(s.totalMinutes)}</span>
                  <span className="stat-metric-label">Temps net</span>
                </div>
                <div className="stat-metric">
                  <span className="stat-metric-value">{s.total > 0 ? Math.round(s.done / s.total * 100) : 0}%</span>
                  <span className="stat-metric-label">Terminées</span>
                </div>
              </div>
              <div className="stat-completion-bar">
                <div
                  className="stat-completion-fill"
                  style={{ width: `${s.total > 0 ? (s.done / s.total * 100) : 0}%` }}
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
                  <th>Date</th>
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

                  return (
                    <tr key={`${row.userId}-${iv.id}-${i}`}>
                      <td>
                        <div className="td-employee">
                          <div className="td-avatar">{initials(row.userName)}</div>
                          {row.userName}
                        </div>
                      </td>
                      <td className="td-client">{iv.client || iv.client_data?.name || '—'}</td>
                      <td>
                        <div className="td-address" title={iv.address}>{iv.address || '—'}</div>
                      </td>
                      <td>{formatDate(getInterventionDate(iv))}</td>
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
