// src/pages/AdminMonthlyExportView.jsx
// Interface admin d'export mensuel pour l'expert-comptable

import React, { useState, useMemo, useCallback } from 'react';
import {
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  UserIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  DollarSignIcon,
} from '../components/SharedUI';
import { generateCSV, downloadCSV } from '../services/monthlyExportService';
import './AdminMonthlyExportView.css';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const EXPENSE_CATEGORIES = {
  transport: { label: 'Transport', color: '#3b82f6' },
  meals: { label: 'Repas', color: '#10b981' },
  fuel: { label: 'Carburant', color: '#ef4444' },
  parking: { label: 'Parking', color: '#6366f1' },
  phone: { label: 'Téléphone', color: '#06b6d4' },
  supplies: { label: 'Fournitures', color: '#f59e0b' },
  accommodation: { label: 'Hébergement', color: '#8b5cf6' },
  other: { label: 'Autres', color: '#64748b' },
};

export default function AdminMonthlyExportView({ employeeData = [], isLoading, error, year, month, onChangeMonth }) {
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`;

  // Navigation mois
  const handlePrevMonth = useCallback(() => {
    if (month === 1) {
      onChangeMonth(year - 1, 12);
    } else {
      onChangeMonth(year, month - 1);
    }
  }, [year, month, onChangeMonth]);

  const handleNextMonth = useCallback(() => {
    if (month === 12) {
      onChangeMonth(year + 1, 1);
    } else {
      onChangeMonth(year, month + 1);
    }
  }, [year, month, onChangeMonth]);

  // Filtrage
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employeeData;
    const s = searchTerm.toLowerCase();
    return employeeData.filter(e =>
      e.fullName?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s)
    );
  }, [employeeData, searchTerm]);

  // Totaux globaux
  const totals = useMemo(() => {
    return filteredEmployees.reduce((acc, emp) => ({
      workedDays: acc.workedDays + emp.workedDays,
      totalHours: acc.totalHours + emp.totalHours,
      totalKm: acc.totalKm + emp.totalKm,
      paniersRepas: acc.paniersRepas + emp.paniersRepas,
      leaveDays: acc.leaveDays + emp.leaveDays,
      interventionCount: acc.interventionCount + emp.interventionCount,
      totalExpenses: acc.totalExpenses + emp.totalExpenses,
    }), {
      workedDays: 0,
      totalHours: 0,
      totalKm: 0,
      paniersRepas: 0,
      leaveDays: 0,
      interventionCount: 0,
      totalExpenses: 0,
    });
  }, [filteredEmployees]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(filteredEmployees, year, month);
    const filename = `export_comptable_${year}-${String(month).padStart(2, '0')}.csv`;
    downloadCSV(csv, filename);
  }, [filteredEmployees, year, month]);

  const toggleEmployee = useCallback((id) => {
    setExpandedEmployee(prev => prev === id ? null : id);
  }, []);

  if (error) {
    return (
      <div className="monthly-export-error">
        <h3>Erreur de chargement</h3>
        <p>{error.message || 'Impossible de charger les données.'}</p>
      </div>
    );
  }

  return (
    <div className="monthly-export">
      {/* Header */}
      <div className="monthly-export-header">
        <div className="monthly-export-title">
          <h2>Export Comptable</h2>
          <p>Données mensuelles pour l'expert-comptable</p>
        </div>
        <button
          className="export-csv-btn"
          onClick={handleExportCSV}
          disabled={isLoading || filteredEmployees.length === 0}
        >
          <DownloadIcon />
          <span>Exporter CSV</span>
        </button>
      </div>

      {/* Sélecteur de mois */}
      <div className="month-selector">
        <button className="month-nav-btn" onClick={handlePrevMonth}>
          <ChevronLeftIcon />
        </button>
        <div className="month-label">
          <CalendarIcon />
          <span>{monthLabel}</span>
        </div>
        <button className="month-nav-btn" onClick={handleNextMonth}>
          <ChevronRightIcon />
        </button>
      </div>

      {/* Recherche */}
      <div className="export-search">
        <input
          type="text"
          placeholder="Rechercher un employé..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="export-search-input"
        />
      </div>

      {/* Résumé global */}
      <div className="export-summary-grid">
        <SummaryCard icon={<UserIcon />} label="Employés" value={filteredEmployees.length} color="blue" />
        <SummaryCard icon={<CalendarIcon />} label="Jours travaillés" value={totals.workedDays} color="indigo" />
        <SummaryCard icon={<ClockIcon />} label="Heures totales" value={`${totals.totalHours}h`} color="purple" />
        <SummaryCard icon={<MapPinIcon />} label="Km parcourus" value={`${totals.totalKm} km`} color="teal" />
        <SummaryCard label="Paniers repas" value={totals.paniersRepas} color="orange" emoji="🍽️" />
        <SummaryCard label="Jours de congé" value={totals.leaveDays} color="rose" emoji="🌴" />
        <SummaryCard label="Interventions" value={totals.interventionCount} color="green" emoji="🔧" />
        <SummaryCard icon={<DollarSignIcon />} label="Dépenses" value={`${totals.totalExpenses.toFixed(0)}€`} color="red" />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="export-loading">
          <div className="loading-spinner" />
          <p>Chargement des données...</p>
        </div>
      )}

      {/* Liste des employés */}
      {!isLoading && (
        <div className="employee-export-list">
          {filteredEmployees.length === 0 ? (
            <div className="export-empty">
              <p>Aucun employé trouvé pour cette période.</p>
            </div>
          ) : (
            filteredEmployees.map(emp => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                isExpanded={expandedEmployee === emp.id}
                onToggle={() => toggleEmployee(emp.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== Sous-composants ==================== */

function SummaryCard({ icon, label, value, color, emoji }) {
  return (
    <div className={`summary-card summary-card-${color}`}>
      <div className="summary-card-icon">
        {emoji ? <span className="summary-emoji">{emoji}</span> : icon}
      </div>
      <div className="summary-card-content">
        <span className="summary-card-value">{value}</span>
        <span className="summary-card-label">{label}</span>
      </div>
    </div>
  );
}

function EmployeeCard({ employee: emp, isExpanded, onToggle }) {
  return (
    <div className={`employee-export-card ${isExpanded ? 'expanded' : ''}`}>
      {/* En-tête cliquable */}
      <div className="employee-card-header" onClick={onToggle}>
        <div className="employee-card-info">
          <div className="employee-avatar">
            {emp.fullName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="employee-name">{emp.fullName}</h3>
            <p className="employee-email">{emp.email}</p>
          </div>
        </div>

        <div className="employee-card-badges">
          <span className="badge badge-blue">{emp.workedDays}j</span>
          <span className="badge badge-purple">{emp.totalHours}h</span>
          <span className="badge badge-teal">{emp.totalKm} km</span>
          <span className="badge badge-orange">{emp.paniersRepas} repas</span>
          {emp.leaveDays > 0 && <span className="badge badge-rose">{emp.leaveDays}j congé</span>}
          <ChevronDownIcon className={`expand-icon ${isExpanded ? 'rotated' : ''}`} />
        </div>
      </div>

      {/* Détails */}
      {isExpanded && (
        <div className="employee-card-details">
          {/* Section Déplacements */}
          <DetailSection title="Déplacements">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Km total</span>
                <span className="detail-value">{emp.totalKm} km</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Zones</span>
                <span className="detail-value">
                  {emp.zones.length > 0 ? emp.zones.join(', ') : 'Aucune'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Paniers repas</span>
                <span className="detail-value">{emp.paniersRepas}</span>
              </div>
            </div>
          </DetailSection>

          {/* Section Activité */}
          <DetailSection title="Activité">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Interventions</span>
                <span className="detail-value">{emp.interventionCount} ({emp.completedCount} terminées)</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Jours travaillés</span>
                <span className="detail-value">{emp.workedDays}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Heures</span>
                <span className="detail-value">{emp.totalHours}h</span>
              </div>
            </div>
            {emp.workedDates.length > 0 && (
              <div className="worked-dates">
                <span className="detail-label">Dates travaillées :</span>
                <div className="date-chips">
                  {emp.workedDates.map(d => (
                    <span key={d} className="date-chip">
                      {new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </DetailSection>

          {/* Section Congés */}
          {emp.leaveDays > 0 && (
            <DetailSection title={`Congés (${emp.leaveDays} jours)`}>
              <div className="leaves-list">
                {emp.leaves.map((leave, i) => (
                  <div key={i} className="leave-item">
                    <span className={`leave-status ${leave.status === 'Approuvée' ? 'approved' : 'pending'}`}>
                      {leave.status}
                    </span>
                    <span className="leave-dates">
                      {new Date(leave.startDate).toLocaleDateString('fr-FR')} — {new Date(leave.endDate).toLocaleDateString('fr-FR')}
                    </span>
                    {leave.reason && <span className="leave-reason">{leave.reason}</span>}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Section Dépenses */}
          {emp.totalExpenses > 0 && (
            <DetailSection title={`Dépenses (${emp.totalExpenses.toFixed(2)}€)`}>
              <div className="expense-bars">
                {Object.entries(emp.expensesByCategory)
                  .filter(([, amount]) => amount > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, amount]) => {
                    const cfg = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.other;
                    const pct = (amount / emp.totalExpenses) * 100;
                    return (
                      <div key={cat} className="expense-bar-row">
                        <span className="expense-cat-label">{cfg.label}</span>
                        <div className="expense-bar-track">
                          <div
                            className="expense-bar-fill"
                            style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                          />
                        </div>
                        <span className="expense-amount">{amount.toFixed(2)}€</span>
                      </div>
                    );
                  })}
              </div>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="detail-section">
      <h4 className="detail-section-title">{title}</h4>
      {children}
    </div>
  );
}
