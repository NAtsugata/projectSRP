// src/pages/AdminMonthlyExportView.jsx
// Interface admin d'export mensuel pour l'expert-comptable
// Permet la modification des valeurs avant export
// Base horaire : 35h/semaine (7h/jour), heures supp calculées

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
  FileTextIcon,
} from '../components/SharedUI';
import { generateCSV, downloadCSV, generatePDF } from '../services/monthlyExportService';
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

// Champs éditables par l'admin
const EDITABLE_FIELDS = [
  { key: 'workedDays', label: 'Jours travaillés', type: 'number', step: 1 },
  { key: 'baseHours', label: 'Heures base (7h/j)', type: 'number', step: 0.5 },
  { key: 'totalHours', label: 'Heures réelles', type: 'number', step: 0.5 },
  { key: 'heuresSupp', label: 'Heures supp.', type: 'number', step: 0.5 },
  { key: 'totalKm', label: 'Km total', type: 'number', step: 1 },
  { key: 'paniersRepas', label: 'Paniers repas', type: 'number', step: 1 },
  { key: 'leaveDays', label: 'Jours de congé', type: 'number', step: 0.5 },
  { key: 'absenceDays', label: 'Jours d\'absence', type: 'number', step: 0.5 },
];

/**
 * Fusionne les données originales avec les modifications admin
 */
function applyOverrides(employees, overrides) {
  return employees.map(emp => {
    const o = overrides[emp.id];
    if (!o) return emp;
    return { ...emp, ...o };
  });
}

export default function AdminMonthlyExportView({ employeeData = [], isLoading, error, year, month, onChangeMonth }) {
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Modifications admin : { [employeeId]: { workedDays?: n, totalHours?: n, primeExceptionnelle?: n, primeType?: 'net'|'brut', ... } }
  const [overrides, setOverrides] = useState({});

  const monthLabel = `${MONTHS_FR[month - 1]} ${year}`;
  const hasOverrides = Object.keys(overrides).length > 0;

  // Navigation mois — reset les modifications au changement de mois
  const handlePrevMonth = useCallback(() => {
    setOverrides({});
    if (month === 1) {
      onChangeMonth(year - 1, 12);
    } else {
      onChangeMonth(year, month - 1);
    }
  }, [year, month, onChangeMonth]);

  const handleNextMonth = useCallback(() => {
    setOverrides({});
    if (month === 12) {
      onChangeMonth(year + 1, 1);
    } else {
      onChangeMonth(year, month + 1);
    }
  }, [year, month, onChangeMonth]);

  // Modifier un champ pour un employé
  const handleFieldChange = useCallback((empId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: value,
      },
    }));
  }, []);

  // Réinitialiser les modifications d'un employé
  const handleResetEmployee = useCallback((empId) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[empId];
      return next;
    });
  }, []);

  // Réinitialiser toutes les modifications
  const handleResetAll = useCallback(() => {
    setOverrides({});
  }, []);

  // Données avec modifications appliquées
  const mergedData = useMemo(
    () => applyOverrides(employeeData, overrides),
    [employeeData, overrides]
  );

  // Filtrage
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return mergedData;
    const s = searchTerm.toLowerCase();
    return mergedData.filter(e =>
      e.fullName?.toLowerCase().includes(s) ||
      e.email?.toLowerCase().includes(s)
    );
  }, [mergedData, searchTerm]);

  // Totaux globaux (utilise les données modifiées)
  const totals = useMemo(() => {
    return filteredEmployees.reduce((acc, emp) => ({
      workedDays: acc.workedDays + emp.workedDays,
      baseHours: acc.baseHours + (emp.baseHours || 0),
      totalHours: acc.totalHours + emp.totalHours,
      heuresSupp: acc.heuresSupp + (emp.heuresSupp || 0),
      totalKm: acc.totalKm + emp.totalKm,
      paniersRepas: acc.paniersRepas + emp.paniersRepas,
      leaveDays: acc.leaveDays + emp.leaveDays,
      absenceDays: acc.absenceDays + (emp.absenceDays || 0),
      interventionCount: acc.interventionCount + emp.interventionCount,
      totalExpenses: acc.totalExpenses + emp.totalExpenses,
      totalPrimes: acc.totalPrimes + (emp.primeExceptionnelle || 0),
    }), {
      workedDays: 0,
      baseHours: 0,
      totalHours: 0,
      heuresSupp: 0,
      totalKm: 0,
      paniersRepas: 0,
      leaveDays: 0,
      absenceDays: 0,
      interventionCount: 0,
      totalExpenses: 0,
      totalPrimes: 0,
    });
  }, [filteredEmployees]);

  // Export CSV (utilise les données modifiées)
  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(filteredEmployees, year, month);
    const filename = `export_comptable_${year}-${String(month).padStart(2, '0')}.csv`;
    downloadCSV(csv, filename);
  }, [filteredEmployees, year, month]);

  // Export PDF (utilise les données modifiées)
  const handleExportPDF = useCallback(() => {
    generatePDF(filteredEmployees, year, month);
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
          <p>Données mensuelles — Base 35h/semaine — Départ : Champtercier</p>
        </div>
        <div className="export-actions">
          {hasOverrides && (
            <button className="reset-all-btn" onClick={handleResetAll}>
              Réinitialiser tout
            </button>
          )}
          <button
            className="export-csv-btn"
            onClick={handleExportCSV}
            disabled={isLoading || filteredEmployees.length === 0}
          >
            <DownloadIcon />
            <span>Exporter CSV</span>
          </button>
          <button
            className="export-pdf-btn"
            onClick={handleExportPDF}
            disabled={isLoading || filteredEmployees.length === 0}
          >
            <FileTextIcon />
            <span>Exporter PDF</span>
          </button>
        </div>
      </div>

      {hasOverrides && (
        <div className="overrides-banner">
          Des valeurs ont été modifiées manuellement. Les exports utiliseront les valeurs modifiées.
        </div>
      )}

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
        <SummaryCard icon={<ClockIcon />} label="Heures base" value={`${totals.baseHours}h`} color="purple" />
        <SummaryCard label="Heures supp." value={`${totals.heuresSupp}h`} color="rose" emoji="+" />
        <SummaryCard icon={<MapPinIcon />} label="Km parcourus" value={`${totals.totalKm} km`} color="teal" />
        <SummaryCard label="Paniers repas" value={totals.paniersRepas} color="orange" emoji="🍽️" />
        <SummaryCard label="Absences" value={`${totals.absenceDays}j`} color="red" emoji="🚫" />
        <SummaryCard label="Primes" value={`${totals.totalPrimes.toFixed(0)}€`} color="green" emoji="🎁" />
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
                originalEmployee={employeeData.find(e => e.id === emp.id)}
                isExpanded={expandedEmployee === emp.id}
                onToggle={() => toggleEmployee(emp.id)}
                onFieldChange={handleFieldChange}
                onReset={handleResetEmployee}
                hasOverride={!!overrides[emp.id]}
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

function EmployeeCard({ employee: emp, originalEmployee: orig, isExpanded, onToggle, onFieldChange, onReset, hasOverride }) {
  return (
    <div className={`employee-export-card ${isExpanded ? 'expanded' : ''} ${hasOverride ? 'modified' : ''}`}>
      {/* En-tête cliquable */}
      <div className="employee-card-header" onClick={onToggle}>
        <div className="employee-card-info">
          <div className="employee-avatar">
            {emp.fullName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="employee-name">
              {emp.fullName}
              {hasOverride && <span className="modified-indicator" title="Valeurs modifiées"> *</span>}
            </h3>
            <p className="employee-email">{emp.email}</p>
          </div>
        </div>

        <div className="employee-card-badges">
          <span className={`badge badge-blue ${hasOverride && emp.workedDays !== orig?.workedDays ? 'badge-modified' : ''}`}>{emp.workedDays}j</span>
          <span className={`badge badge-purple ${hasOverride && emp.baseHours !== orig?.baseHours ? 'badge-modified' : ''}`}>{emp.baseHours || 0}h</span>
          {(emp.heuresSupp || 0) > 0 && (
            <span className={`badge badge-rose ${hasOverride && emp.heuresSupp !== orig?.heuresSupp ? 'badge-modified' : ''}`}>+{emp.heuresSupp}h sup</span>
          )}
          <span className={`badge badge-teal ${hasOverride && emp.totalKm !== orig?.totalKm ? 'badge-modified' : ''}`}>{emp.totalKm} km</span>
          <span className={`badge badge-orange ${hasOverride && emp.paniersRepas !== orig?.paniersRepas ? 'badge-modified' : ''}`}>{emp.paniersRepas} repas</span>
          {(emp.absenceDays || 0) > 0 && (
            <span className="badge badge-red">{emp.absenceDays}j abs.</span>
          )}
          {(emp.primeExceptionnelle || 0) > 0 && (
            <span className="badge badge-green">{emp.primeExceptionnelle}€ {emp.primeType}</span>
          )}
          <ChevronDownIcon className={`expand-icon ${isExpanded ? 'rotated' : ''}`} />
        </div>
      </div>

      {/* Détails avec champs éditables */}
      {isExpanded && (
        <div className="employee-card-details">
          {/* Section Modification des valeurs */}
          <DetailSection title="Modifier les valeurs">
            {hasOverride && (
              <button className="reset-employee-btn" onClick={(e) => { e.stopPropagation(); onReset(emp.id); }}>
                Réinitialiser les valeurs originales
              </button>
            )}
            <div className="editable-fields-grid">
              {EDITABLE_FIELDS.map(field => {
                const currentVal = emp[field.key] ?? 0;
                const origVal = orig?.[field.key] ?? 0;
                const isModified = hasOverride && currentVal !== origVal;
                return (
                  <div key={field.key} className={`editable-field ${isModified ? 'field-modified' : ''}`}>
                    <label className="editable-field-label">{field.label}</label>
                    <div className="editable-field-input-wrap">
                      <input
                        type={field.type}
                        step={field.step}
                        min={0}
                        value={currentVal}
                        onChange={(e) => {
                          const val = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                          onFieldChange(emp.id, field.key, val);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="editable-field-input"
                      />
                      {isModified && (
                        <span className="original-value" title="Valeur originale">
                          (était {origVal})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DetailSection>

          {/* Section Prime exceptionnelle */}
          <DetailSection title="Prime exceptionnelle">
            <div className="prime-fields">
              <div className="editable-field">
                <label className="editable-field-label">Montant (€)</label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={emp.primeExceptionnelle || 0}
                  onChange={(e) => onFieldChange(emp.id, 'primeExceptionnelle', parseFloat(e.target.value) || 0)}
                  onClick={(e) => e.stopPropagation()}
                  className="editable-field-input"
                />
              </div>
              <div className="editable-field">
                <label className="editable-field-label">Type</label>
                <div className="prime-type-toggle" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`prime-type-btn ${(emp.primeType || 'brut') === 'brut' ? 'active' : ''}`}
                    onClick={() => onFieldChange(emp.id, 'primeType', 'brut')}
                  >
                    Brut
                  </button>
                  <button
                    className={`prime-type-btn ${emp.primeType === 'net' ? 'active' : ''}`}
                    onClick={() => onFieldChange(emp.id, 'primeType', 'net')}
                  >
                    Net
                  </button>
                </div>
              </div>
            </div>
          </DetailSection>

          {/* Section Déplacements & Zones */}
          <DetailSection title="Déplacements (depuis 422 rte de Digne, 04660 Champtercier)">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Km total</span>
                <span className="detail-value">{emp.totalKm} km</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Paniers repas</span>
                <span className="detail-value">{emp.paniersRepas}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Interventions</span>
                <span className="detail-value">{emp.interventionCount}</span>
              </div>
            </div>

            {/* Zones de déplacement */}
            {emp.zones && emp.zones.length > 0 && (
              <div className="zone-breakdown">
                <span className="detail-label">Zones de déplacement :</span>
                <div className="zone-chips">
                  {emp.zones.map((z, i) => (
                    <span key={i} className="zone-chip">
                      {z.zone} <strong>x{z.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Détail par chantier */}
            {emp.interventionDetails && emp.interventionDetails.filter(d => d.distanceAller > 0).length > 0 && (
              <div className="chantier-details">
                <span className="detail-label">Détail par chantier :</span>
                <div className="chantier-table">
                  <div className="chantier-header">
                    <span>Client</span>
                    <span>Adresse</span>
                    <span>Dist. aller</span>
                    <span>Zone</span>
                    <span>Source</span>
                  </div>
                  {emp.interventionDetails.filter(d => d.distanceAller > 0).map((d, i) => (
                    <div key={i} className={`chantier-row ${i % 2 === 0 ? 'alt' : ''}`}>
                      <span>{d.client || '-'}</span>
                      <span className="chantier-addr">{d.city || d.address || '-'}</span>
                      <span className="chantier-km">{d.distanceAller} km</span>
                      <span className="chantier-zone">{d.zone}</span>
                      <span className={`chantier-source ${d.distanceSource === 'géocodage' ? 'source-geo' : 'source-compteur'}`}>
                        {d.distanceSource === 'géocodage' ? '📍' : '🔧'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DetailSection>

          {/* Section Activité */}
          <DetailSection title="Activité & Heures (base 35h/semaine)">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Jours travaillés</span>
                <span className="detail-value">{emp.workedDays}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Heures base (7h/j)</span>
                <span className="detail-value">{emp.baseHours || 0}h</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Heures réelles</span>
                <span className="detail-value">{emp.totalHours}h</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Heures supp.</span>
                <span className={`detail-value ${(emp.heuresSupp || 0) > 0 ? 'text-rose' : ''}`}>
                  {(emp.heuresSupp || 0) > 0 ? `+${emp.heuresSupp}h` : '0h'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Interventions</span>
                <span className="detail-value">{emp.interventionCount} ({emp.completedCount} terminées)</span>
              </div>
            </div>
            {emp.workedDates && emp.workedDates.length > 0 && (
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

          {/* Section Absences */}
          {(emp.absenceDays || 0) > 0 && emp.absenceDetails && emp.absenceDetails.length > 0 && (
            <DetailSection title={`Absences (${emp.absenceDays} jour${emp.absenceDays > 1 ? 's' : ''})`}>
              <div className="leaves-list">
                {emp.absenceDetails.map((absence, i) => (
                  <div key={i} className="leave-item absence-item">
                    <span className="leave-status absence-status">
                      {absence.reason}
                    </span>
                    <span className="leave-dates">
                      {new Date(absence.startDate).toLocaleDateString('fr-FR')} — {new Date(absence.endDate).toLocaleDateString('fr-FR')}
                      <span className="absence-days-count">({absence.days}j)</span>
                    </span>
                    {absence.notes && <span className="leave-reason">{absence.notes}</span>}
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
