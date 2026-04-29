// src/components/MultiDayScheduler.jsx
// Composant de planification multi-jours intelligente

import React, { useState, useEffect } from 'react';
import { createMultiDayIntervention } from '../utils/smartScheduler';
import { generateSchedulingSuggestions } from '../utils/schedulingSuggestions';
import { validateScheduling } from '../utils/conflictDetection';
import './MultiDayScheduler.css';

const MultiDayScheduler = ({
  intervention,
  users = [],
  allInterventions = [],
  absences = [],
  onSchedule,
  onCancel
}) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(1);
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [plannedIntervention, setPlannedIntervention] = useState(null);
  const [validation, setValidation] = useState(null);

  // Générer suggestions au chargement
  useEffect(() => {
    const context = { users, allInterventions, absences };
    const prefs = { preferredStartDate: new Date(startDate), maxSuggestions: 3 };

    const generated = generateSchedulingSuggestions(intervention, context, prefs);
    setSuggestions(generated);

    if (generated.length > 0) {
      setSelectedSuggestion(generated[0]);
      setPlannedIntervention(generated[0].intervention);
      setValidation(generated[0].validation);
    }
  }, []);

  // Mettre à jour la planification manuelle
  const handleManualPlan = () => {
    const planned = createMultiDayIntervention(
      intervention,
      startDate,
      duration,
      { excludeWeekends }
    );

    const context = { users, allInterventions, absences };
    const valid = validateScheduling(planned, context);

    setPlannedIntervention(planned);
    setValidation(valid);
    setSelectedSuggestion(null);
  };

  // Confirmer la planification
  const handleConfirm = () => {
    if (onSchedule && plannedIntervention) {
      onSchedule(plannedIntervention, validation);
    }
  };

  return (
    <div className="multi-day-scheduler">
      <h2>📅 Planification Multi-Jours</h2>

      {/* Suggestions automatiques */}
      {suggestions.length > 0 && (
        <div className="suggestions-section">
          <h3>💡 Suggestions Intelligentes</h3>

          <div className="suggestions-list">
            {suggestions.map(sug => (
              <div
                key={sug.id}
                className={`suggestion-card ${selectedSuggestion?.id === sug.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedSuggestion(sug);
                  setPlannedIntervention(sug.intervention);
                  setValidation(sug.validation);
                }}
              >
                <div className="suggestion-header">
                  <span className="suggestion-label">{sug.label}</span>
                  <span className="suggestion-score">
                    {Math.round(sug.qualityScore)}%
                  </span>
                </div>

                <p className="suggestion-description">{sug.description}</p>

                <div className="suggestion-benefits">
                  {sug.benefits.map((benefit, idx) => (
                    <span key={idx} className="benefit-tag">{benefit}</span>
                  ))}
                </div>

                <div className="suggestion-details">
                  <span>📅 {sug.intervention.start_date} → {sug.intervention.end_date}</span>
                  <span>⏱️ {sug.intervention.duration_days} jour(s)</span>
                  <span>👥 {sug.assignment.assignedUsers.length} tech.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Planification manuelle */}
      <div className="manual-planning">
        <h3>⚙️ Planification Manuelle</h3>

        <div className="form-row">
          <label>
            Date de début:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </label>

          <label>
            Durée (jours):
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              min="1"
              max="30"
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={excludeWeekends}
              onChange={(e) => setExcludeWeekends(e.target.checked)}
            />
            Exclure les week-ends
          </label>

          <button onClick={handleManualPlan} className="btn-preview">
            🔍 Prévisualiser
          </button>
        </div>
      </div>

      {/* Aperçu de la planification */}
      {plannedIntervention && (
        <div className="planning-preview">
          <h3>📋 Aperçu de la Planification</h3>

          <div className="dates-timeline">
            {plannedIntervention.scheduled_dates.map((date, index) => (
              <div key={date} className="date-card">
                <div className="date-header">
                  <span className="day-number">Jour {index + 1}</span>
                  <span className="date-value">{formatDate(date)}</span>
                </div>

                {plannedIntervention.daily_plan && plannedIntervention.daily_plan[date] && (
                  <div className="daily-info">
                    <p className="phase-name">
                      {plannedIntervention.daily_plan[date].phase}
                    </p>
                    <span className="estimated-hours">
                      ⏱️ {plannedIntervention.daily_plan[date].estimatedHours}h
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Validation et conflits */}
          {validation && (
            <div className="validation-section">
              {validation.valid ? (
                <div className="validation-success">
                  ✅ Aucun conflit détecté
                </div>
              ) : (
                <div className="validation-warnings">
                  <strong>⚠️ {validation.conflicts.length} conflit(s) détecté(s):</strong>

                  {validation.conflicts.slice(0, 5).map((conflict, idx) => (
                    <div key={idx} className={`conflict-item ${conflict.severity}`}>
                      {conflict.message}
                    </div>
                  ))}

                  {validation.canOverride && (
                    <p className="can-override">
                      ℹ️ Ces conflits peuvent être ignorés si nécessaire
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button onClick={onCancel} className="btn-cancel">
          Annuler
        </button>

        <button
          onClick={handleConfirm}
          className="btn-confirm"
          disabled={!plannedIntervention || (validation && !validation.canProceed)}
        >
          ✅ Confirmer la Planification
        </button>
      </div>
    </div>
  );
};

// Helper pour formater les dates
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

export default MultiDayScheduler;
