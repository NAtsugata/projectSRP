// src/components/dashboard/DashboardCharts.jsx
// Composants graphiques pour le tableau de bord admin

import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import './DashboardCharts.css';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#8b5cf6',
  secondary: '#64748b',
  cyan: '#06b6d4',
  pink: '#ec4899',
};

const CHART_THEME = {
  background: 'transparent',
  textColor: '#94a3b8',
  gridColor: 'rgba(148, 163, 184, 0.1)',
  tooltipBg: 'rgba(15, 23, 42, 0.95)',
  tooltipBorder: 'rgba(148, 163, 184, 0.2)',
};

// Tooltip personnalisé dark mode
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="chart-tooltip-value" style={{ color: entry.color || entry.fill }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ========================
// 1. Répartition des interventions (Pie Chart)
// ========================
export const InterventionStatusChart = ({ interventions = [] }) => {
  const data = useMemo(() => {
    const active = interventions.filter(i => !i.is_archived);
    const archived = interventions.filter(i => i.is_archived);
    const urgent = active.filter(i => i.additional_needs?.some(n => n.isUrgent));
    const withTeam = active.filter(i => i.intervention_assignments?.length > 0);
    const noTeam = active.filter(i => !i.intervention_assignments?.length);

    return [
      { name: 'Avec équipe', value: withTeam.length, color: COLORS.success },
      { name: 'Sans équipe', value: noTeam.length, color: COLORS.warning },
      { name: 'Urgentes', value: urgent.length, color: COLORS.danger },
      { name: 'Archivées', value: archived.length, color: COLORS.secondary },
    ].filter(d => d.value > 0);
  }, [interventions]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Répartition des interventions</h3>
      <div className="chart-container pie-container">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center-label">
          <span className="pie-center-value">{total}</span>
          <span className="pie-center-text">Total</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((d, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: d.color }}></span>
            <span className="legend-label">{d.name}</span>
            <span className="legend-value">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========================
// 2. Interventions par mois (Bar Chart)
// ========================
export const MonthlyInterventionsChart = ({ interventions = [] }) => {
  const data = useMemo(() => {
    const months = {};
    const now = new Date();

    // 6 derniers mois
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      months[key] = { month: label, creees: 0, terminees: 0 };
    }

    interventions.forEach(i => {
      if (i.created_at) {
        const key = i.created_at.slice(0, 7);
        if (months[key]) months[key].creees++;
      }
      if (i.is_archived && i.archived_at) {
        const key = i.archived_at.slice(0, 7);
        if (months[key]) months[key].terminees++;
      }
    });

    return Object.values(months);
  }, [interventions]);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Interventions par mois</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
            <XAxis dataKey="month" tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="creees" name="Créées" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="terminees" name="Terminées" fill={COLORS.success} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.primary }}></span>
          <span className="legend-label">Créées</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.success }}></span>
          <span className="legend-label">Terminées</span>
        </div>
      </div>
    </div>
  );
};

// ========================
// 3. Charge de travail par employé (Horizontal Bar)
// ========================
export const WorkloadChart = ({ interventions = [], users = [] }) => {
  const data = useMemo(() => {
    const active = interventions.filter(i => !i.is_archived);
    const counts = {};

    active.forEach(i => {
      (i.intervention_assignments || []).forEach(a => {
        if (a.user_id) {
          counts[a.user_id] = (counts[a.user_id] || 0) + 1;
        }
      });
    });

    return users
      .map(u => ({
        name: u.full_name?.split(' ')[0] || 'N/A',
        interventions: counts[u.id] || 0,
      }))
      .sort((a, b) => b.interventions - a.interventions)
      .slice(0, 8);
  }, [interventions, users]);

  if (data.length === 0) return null;

  return (
    <div className="chart-card">
      <h3 className="chart-title">Charge par employé</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} horizontal={false} />
            <XAxis type="number" tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="interventions" name="Interventions" fill={COLORS.cyan} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ========================
// 4. Congés par statut (Donut)
// ========================
export const LeaveStatusChart = ({ leaveRequests = [] }) => {
  const data = useMemo(() => {
    const statusMap = {
      'En attente': { color: COLORS.warning },
      'Approuvée': { color: COLORS.success },
      'Refusée': { color: COLORS.danger },
    };

    const counts = {};
    leaveRequests.forEach(l => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });

    return Object.entries(counts).map(([status, count]) => ({
      name: status,
      value: count,
      color: statusMap[status]?.color || COLORS.secondary,
    }));
  }, [leaveRequests]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Congés</h3>
        <div className="chart-empty">Aucune demande de congé</div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3 className="chart-title">Demandes de congés</h3>
      <div className="chart-container pie-container">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center-label">
          <span className="pie-center-value">{total}</span>
          <span className="pie-center-text">Demandes</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((d, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: d.color }}></span>
            <span className="legend-label">{d.name}</span>
            <span className="legend-value">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========================
// 5. Activité hebdomadaire (Area Chart)
// ========================
export const WeeklyActivityChart = ({ interventions = [] }) => {
  const data = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

      const created = interventions.filter(int => int.created_at?.slice(0, 10) === dateStr).length;
      const scheduled = interventions.filter(int => {
        if (int.is_archived) return false;
        if (int.scheduled_dates?.includes(dateStr)) return true;
        return int.date === dateStr;
      }).length;

      days.push({ jour: label, creees: created, planifiees: scheduled });
    }
    return days;
  }, [interventions]);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Activité des 7 derniers jours</h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
            <XAxis dataKey="jour" tick={{ fill: CHART_THEME.textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="planifiees" name="Planifiées" stroke={COLORS.primary} fill="url(#gradBlue)" strokeWidth={2} />
            <Area type="monotone" dataKey="creees" name="Créées" stroke={COLORS.success} fill="url(#gradGreen)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.primary }}></span>
          <span className="legend-label">Planifiées</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.success }}></span>
          <span className="legend-label">Créées</span>
        </div>
      </div>
    </div>
  );
};

// ========================
// 6. KPI Gauges (mini infographic)
// ========================
export const KPIGauges = ({ interventions = [], leaveRequests = [], users = [] }) => {
  const kpis = useMemo(() => {
    const active = interventions.filter(i => !i.is_archived);
    const withTeam = active.filter(i => i.intervention_assignments?.length > 0).length;
    const teamRate = active.length > 0 ? Math.round((withTeam / active.length) * 100) : 0;

    const totalEmployees = users.length;
    const assignedEmployees = new Set();
    active.forEach(i => (i.intervention_assignments || []).forEach(a => { if (a.user_id) assignedEmployees.add(a.user_id); }));
    const utilRate = totalEmployees > 0 ? Math.round((assignedEmployees.size / totalEmployees) * 100) : 0;

    const pendingLeaves = leaveRequests.filter(r => r.status === 'En attente').length;
    const totalLeaves = leaveRequests.length;
    const approvalRate = totalLeaves > 0 ? Math.round(((totalLeaves - pendingLeaves) / totalLeaves) * 100) : 100;

    return [
      { label: 'Taux d\'affectation', value: teamRate, color: teamRate > 70 ? COLORS.success : teamRate > 40 ? COLORS.warning : COLORS.danger },
      { label: 'Utilisation équipe', value: utilRate, color: utilRate > 60 ? COLORS.success : utilRate > 30 ? COLORS.warning : COLORS.danger },
      { label: 'Congés traités', value: approvalRate, color: approvalRate > 80 ? COLORS.success : approvalRate > 50 ? COLORS.warning : COLORS.danger },
    ];
  }, [interventions, leaveRequests, users]);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Indicateurs clés</h3>
      <div className="kpi-gauges">
        {kpis.map((kpi, i) => (
          <div key={i} className="kpi-gauge">
            <div className="kpi-ring">
              <svg viewBox="0 0 36 36" className="kpi-svg">
                <path
                  className="kpi-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="kpi-fill"
                  strokeDasharray={`${kpi.value}, 100`}
                  style={{ stroke: kpi.color }}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="kpi-value" style={{ color: kpi.color }}>{kpi.value}%</span>
            </div>
            <span className="kpi-label">{kpi.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
