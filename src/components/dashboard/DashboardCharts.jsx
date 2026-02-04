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
  orange: '#f97316',
};

const CHART_THEME = {
  textColor: '#94a3b8',
  gridColor: 'rgba(148, 163, 184, 0.1)',
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

// Tooltip monétaire
const MoneyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="chart-tooltip-value" style={{ color: entry.color || entry.fill }}>
          {entry.name}: <strong>{Number(entry.value).toFixed(0)} €</strong>
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
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
// 2. Interventions par mois (Bar Chart) - STABILISÉ
// ========================
export const MonthlyInterventionsChart = ({ interventions = [] }) => {
  const data = useMemo(() => {
    const now = new Date();
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-based
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });

      let creees = 0;
      let terminees = 0;

      interventions.forEach(itv => {
        // Créées ce mois
        if (itv.created_at) {
          const cd = new Date(itv.created_at);
          if (cd.getFullYear() === year && cd.getMonth() === month) creees++;
        }
        // Terminées (archivées) ce mois
        if (itv.is_archived && itv.archived_at) {
          const ad = new Date(itv.archived_at);
          if (ad.getFullYear() === year && ad.getMonth() === month) terminees++;
        }
      });

      result.push({ month: label, creees, terminees });
    }
    return result;
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
    leaveRequests.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: status, value: count, color: statusMap[status]?.color || COLORS.secondary,
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
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
// 6. KPI Gauges
// ========================
export const KPIGauges = ({ interventions = [], leaveRequests = [], users = [], expenses = [], contracts = [] }) => {
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

    const activeContracts = contracts.filter(c => c.status === 'active').length;
    const totalContracts = contracts.length;
    const contractRate = totalContracts > 0 ? Math.round((activeContracts / totalContracts) * 100) : 0;

    return [
      { label: 'Taux d\'affectation', value: teamRate, color: teamRate > 70 ? COLORS.success : teamRate > 40 ? COLORS.warning : COLORS.danger },
      { label: 'Utilisation équipe', value: utilRate, color: utilRate > 60 ? COLORS.success : utilRate > 30 ? COLORS.warning : COLORS.danger },
      { label: 'Congés traités', value: approvalRate, color: approvalRate > 80 ? COLORS.success : approvalRate > 50 ? COLORS.warning : COLORS.danger },
      { label: 'Contrats actifs', value: contractRate, color: contractRate > 70 ? COLORS.success : contractRate > 40 ? COLORS.warning : COLORS.danger },
    ];
  }, [interventions, leaveRequests, users, contracts]);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Indicateurs clés</h3>
      <div className="kpi-gauges">
        {kpis.map((kpi, i) => (
          <div key={i} className="kpi-gauge">
            <div className="kpi-ring">
              <svg viewBox="0 0 36 36" className="kpi-svg">
                <path className="kpi-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="kpi-fill" strokeDasharray={`${kpi.value}, 100`} style={{ stroke: kpi.color }} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
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

// ========================
// 7. Dépenses par mois (Area Chart)
// ========================
export const MonthlyExpensesChart = ({ expenses = [] }) => {
  const data = useMemo(() => {
    const now = new Date();
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });

      let total = 0;
      let approved = 0;
      let pending = 0;

      expenses.forEach(exp => {
        const ed = new Date(exp.date || exp.created_at);
        if (ed.getFullYear() === year && ed.getMonth() === month) {
          const amount = Number(exp.amount) || 0;
          total += amount;
          if (exp.status === 'approved') approved += amount;
          if (exp.status === 'pending') pending += amount;
        }
      });

      result.push({ month: label, total: Math.round(total), approuvees: Math.round(approved), attente: Math.round(pending) });
    }
    return result;
  }, [expenses]);

  const grandTotal = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="chart-card">
      <h3 className="chart-title">
        Dépenses par mois
        <span className="chart-title-badge">{grandTotal.toLocaleString('fr-FR')} €</span>
      </h3>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
            <XAxis dataKey="month" tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<MoneyTooltip />} />
            <Area type="monotone" dataKey="total" name="Total" stroke={COLORS.orange} fill="url(#gradOrange)" strokeWidth={2} />
            <Area type="monotone" dataKey="approuvees" name="Approuvées" stroke={COLORS.success} fill="url(#gradSuccess)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.orange }}></span>
          <span className="legend-label">Total</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.success }}></span>
          <span className="legend-label">Approuvées</span>
        </div>
      </div>
    </div>
  );
};

// ========================
// 8. Dépenses par catégorie (Donut)
// ========================
export const ExpenseCategoryChart = ({ expenses = [] }) => {
  const data = useMemo(() => {
    const catColors = {
      transport: COLORS.primary,
      meals: COLORS.orange,
      accommodation: COLORS.info,
      supplies: COLORS.cyan,
      other: COLORS.secondary,
    };
    const catLabels = {
      transport: 'Transport',
      meals: 'Repas',
      accommodation: 'Hébergement',
      supplies: 'Fournitures',
      other: 'Autre',
    };

    const counts = {};
    expenses.forEach(e => {
      const cat = e.category || 'other';
      counts[cat] = (counts[cat] || 0) + (Number(e.amount) || 0);
    });

    return Object.entries(counts)
      .map(([cat, amount]) => ({
        name: catLabels[cat] || cat,
        value: Math.round(amount),
        color: catColors[cat] || COLORS.secondary,
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Dépenses par catégorie</h3>
        <div className="chart-empty">Aucune dépense enregistrée</div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3 className="chart-title">Dépenses par catégorie</h3>
      <div className="chart-container pie-container">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center-label">
          <span className="pie-center-value">{total.toLocaleString('fr-FR')}</span>
          <span className="pie-center-text">EUR</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((d, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: d.color }}></span>
            <span className="legend-label">{d.name}</span>
            <span className="legend-value">{d.value} €</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========================
// 9. Contrats de maintenance (Bar Chart)
// ========================
export const ContractsChart = ({ contracts = [] }) => {
  const { data, stats } = useMemo(() => {
    const statusCounts = { active: 0, inactive: 0, expired: 0 };
    let totalAmount = 0;

    contracts.forEach(c => {
      if (c.status === 'active') { statusCounts.active++; totalAmount += Number(c.amount) || 0; }
      else if (c.status === 'expired') statusCounts.expired++;
      else statusCounts.inactive++;
    });

    // Contrats signés par mois (6 derniers mois)
    const now = new Date();
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });

      let signes = 0;
      contracts.forEach(c => {
        if (c.signed_date || c.created_at) {
          const sd = new Date(c.signed_date || c.created_at);
          if (sd.getFullYear() === year && sd.getMonth() === month) signes++;
        }
      });
      monthly.push({ month: label, signes });
    }

    return {
      data: monthly,
      stats: { ...statusCounts, totalAmount, total: contracts.length },
    };
  }, [contracts]);

  return (
    <div className="chart-card">
      <h3 className="chart-title">Contrats de maintenance</h3>
      <div className="contract-stats-row">
        <div className="mini-stat">
          <span className="mini-stat-value" style={{ color: COLORS.success }}>{stats.active}</span>
          <span className="mini-stat-label">Actifs</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value" style={{ color: COLORS.danger }}>{stats.expired}</span>
          <span className="mini-stat-label">Expirés</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value" style={{ color: COLORS.primary }}>{stats.total}</span>
          <span className="mini-stat-label">Total</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value" style={{ color: COLORS.orange }}>{stats.totalAmount.toLocaleString('fr-FR')} €</span>
          <span className="mini-stat-label">CA actif</span>
        </div>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.gridColor} />
            <XAxis dataKey="month" tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: CHART_THEME.textColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="signes" name="Signés" fill={COLORS.info} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ========================
// 10. Infographie résumé (Big Numbers)
// ========================
export const SummaryInfoGraphic = ({ interventions = [], expenses = [], contracts = [], leaveRequests = [], cerfaCount = 0 }) => {
  const summary = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Interventions ce mois
    const monthInterventions = interventions.filter(i => {
      const d = new Date(i.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    // Dépenses ce mois
    const monthExpenses = expenses.reduce((sum, e) => {
      const d = new Date(e.date || e.created_at);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        return sum + (Number(e.amount) || 0);
      }
      return sum;
    }, 0);

    // Dépenses en attente
    const pendingExpenses = expenses.filter(e => e.status === 'pending');
    const pendingTotal = pendingExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // Contrats actifs
    const activeContracts = contracts.filter(c => c.status === 'active').length;

    // KM total ce mois
    const monthKm = interventions.reduce((sum, i) => {
      if (i.is_archived && i.report?.km_start && i.report?.km_end) {
        const d = new Date(i.archived_at || i.created_at);
        if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
          return sum + Math.max(0, (i.report.km_end - i.report.km_start));
        }
      }
      return sum;
    }, 0);

    return [
      { icon: '📋', value: monthInterventions, label: 'Interventions ce mois', color: COLORS.primary },
      { icon: '💰', value: `${Math.round(monthExpenses).toLocaleString('fr-FR')} €`, label: 'Dépenses ce mois', color: COLORS.orange },
      { icon: '⏳', value: `${pendingExpenses.length}`, sublabel: `${Math.round(pendingTotal).toLocaleString('fr-FR')} €`, label: 'Notes en attente', color: COLORS.warning },
      { icon: '📝', value: activeContracts, label: 'Contrats actifs', color: COLORS.success },
      { icon: '📄', value: cerfaCount, label: 'CERFA générés', color: COLORS.info },
      { icon: '🚗', value: `${Math.round(monthKm).toLocaleString('fr-FR')}`, sublabel: 'km', label: 'Kilomètres ce mois', color: COLORS.cyan },
    ];
  }, [interventions, expenses, contracts, cerfaCount]);

  return (
    <div className="chart-card summary-card">
      <h3 className="chart-title">Résumé du mois</h3>
      <div className="summary-grid">
        {summary.map((item, i) => (
          <div key={i} className="summary-item">
            <span className="summary-icon">{item.icon}</span>
            <div className="summary-data">
              <span className="summary-value" style={{ color: item.color }}>
                {item.value}
                {item.sublabel && <span className="summary-sublabel"> {item.sublabel}</span>}
              </span>
              <span className="summary-label">{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
