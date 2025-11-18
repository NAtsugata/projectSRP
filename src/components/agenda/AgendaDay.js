// src/components/agenda/AgendaDay.js
// Composant pour afficher une journée dans l'agenda

import React, { useMemo, useState } from 'react';
import {
  layoutEvents,
  getUrgentCount,
  hasSAV,
  getAssignees,
  getUserColor,
  START_MIN,
  END_MIN,
  validateInterventionMove
} from '../../utils/agendaHelpers';
import DraggableIntervention from './DraggableIntervention';
import DroppableTimeSlot from './DroppableTimeSlot';
import './AgendaDay.css';

const HOUR_MARKS = Array.from({ length: END_MIN / 60 - START_MIN / 60 + 1 }, (_, i) => 6 + i);

/**
 * AgendaDay Component
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Array} interventions - List of interventions for this day
 * @param {Array} allInterventions - All interventions (for conflict detection)
 * @param {Array} employees - List of employees
 * @param {Function} onSelect - Handler when an intervention is clicked
 * @param {Function} onInterventionMove - Handler when an intervention is moved
 * @param {boolean} showDate - Whether to show the date header
 * @param {boolean} enableDragDrop - Enable drag & drop functionality
 */
const AgendaDay = ({
  date,
  interventions = [],
  allInterventions = [],
  employees = [],
  onSelect,
  onInterventionMove,
  showDate = true,
  enableDragDrop = true
}) => {
  const [draggedIntervention, setDraggedIntervention] = useState(null);
  const { positioned, allDay } = useMemo(
    () => layoutEvents(interventions),
    [interventions]
  );

  // Légende intervenants
  const people = useMemo(() => {
    return Array.from(
      new Set(
        interventions.flatMap((it) => getAssignees(it)).filter(Boolean)
      )
    );
  }, [interventions]);

  const dateObj = new Date(date);
  const formattedDate = dateObj.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Handlers for drag & drop
  const handleDragStart = (intervention) => {
    setDraggedIntervention(intervention);
  };

  const handleDragEnd = () => {
    setDraggedIntervention(null);
  };

  const handleValidateDrop = (dropInfo) => {
    if (!draggedIntervention) return false;

    const validation = validateInterventionMove({
      intervention: draggedIntervention,
      targetDate: dropInfo.targetDate,
      targetTime: dropInfo.targetTime,
      targetEmployeeId: dropInfo.targetEmployeeId,
      allInterventions: allInterventions.length > 0 ? allInterventions : interventions,
      employees
    });

    return validation.valid;
  };

  const handleDrop = (dropInfo) => {
    if (!draggedIntervention || !onInterventionMove) return;

    onInterventionMove({
      intervention: draggedIntervention,
      targetDate: dropInfo.targetDate,
      targetTime: dropInfo.targetTime,
      targetEmployeeId: dropInfo.targetEmployeeId
    });

    setDraggedIntervention(null);
  };

  return (
    <section className="agenda-day">
      {showDate && (
        <div className="agenda-day-header">
          <h3 className="agenda-day-title">{formattedDate}</h3>
          {people.length > 0 && (
            <div className="agenda-legend" role="list" aria-label="Intervenants">
              {people.map((p, i) => (
                <span key={p} className="legend-item" role="listitem">
                  <span
                    className="legend-dot"
                    style={{ background: getUserColor(p, i) }}
                    aria-hidden="true"
                  />
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="agenda-allday-section" role="region" aria-label="Événements toute la journée">
          <div className="allday-wrap">
            {allDay.map((it) => {
              const urg = getUrgentCount(it);
              const sav = hasSAV(it);
              const assignees = getAssignees(it);
              return (
                <button
                  key={it.id}
                  className="allday-chip"
                  title={`${it.client} — ${it.service || ""}`}
                  onClick={() => onSelect?.(it)}
                  aria-label={`${it.client} ${it.service || ""} ${urg > 0 ? `${urg} besoin${urg > 1 ? 's' : ''} urgent${urg > 1 ? 's' : ''}` : ''} ${sav ? 'SAV à prévoir' : ''}`}
                >
                  <span className="chip-title">
                    {it.client} {it.service ? `— ${it.service}` : ""}
                  </span>
                  {urg > 0 && <span className="badge badge-warn">URG {urg}</span>}
                  {sav && <span className="badge badge-sav">SAV</span>}
                  {assignees.length > 0 && (
                    <span className="chip-assignees" aria-hidden="true">
                      {assignees.map((n, i) => (
                        <span
                          key={n + i}
                          className="assignee-dot"
                          style={{ background: getUserColor(n, i) }}
                          title={n}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="agenda-timeline" role="region" aria-label="Timeline des interventions">
        {/* Hours column */}
        <div className="hours-col" role="list" aria-label="Heures">
          {HOUR_MARKS.map((h) => (
            <div key={h} className="hour-mark" role="listitem">
              <span className="hour-label">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Events column */}
        <DroppableTimeSlot
          date={date}
          time="08:00"
          employeeId={null}
          onDrop={handleDrop}
          onValidateDrop={handleValidateDrop}
          disabled={!enableDragDrop || !onInterventionMove}
        >
          <div className="events-col">
            {/* Background hour rows */}
            {HOUR_MARKS.map((h) => (
              <div key={h} className="hour-row" aria-hidden="true" />
            ))}

          {/* Positioned events */}
          {positioned.map((it) => {
            const urg = getUrgentCount(it);
            const sav = hasSAV(it);
            const assignees = getAssignees(it);
            const { top, height, left, width } = it._layout;

            const eventCard = (
              <button
                className="event-card"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  left: `${left}%`,
                  width: `${width}%`,
                  borderLeftColor:
                    assignees.length > 0
                      ? getUserColor(assignees[0], 0)
                      : "#4285F4",
                }}
                onClick={() => onSelect?.(it)}
                title={`${it.client} — ${it.service || ""}`}
                aria-label={`${it.time_start || it.time || ''} ${it.client} ${it.service || ''} ${urg > 0 ? `${urg} besoin${urg > 1 ? 's' : ''} urgent${urg > 1 ? 's' : ''}` : ''} ${sav ? 'SAV à prévoir' : ''}`}
              >
                <div className="event-time">
                  {it.time_start || it.time || "—"}
                  {it.time_end ? `–${it.time_end}` : ""}
                </div>
                <div className="event-title">{it.client}</div>
                {it.service && (
                  <div className="event-sub">{it.service}</div>
                )}
                <div className="event-meta">
                  {urg > 0 && (
                    <span className="badge badge-warn" aria-label={`${urg} besoin${urg > 1 ? 's' : ''} urgent${urg > 1 ? 's' : ''}`}>
                      URG {urg}
                    </span>
                  )}
                  {sav && <span className="badge badge-sav" aria-label="SAV à prévoir">SAV</span>}
                  {assignees.length > 0 && (
                    <span className="assignees" aria-hidden="true">
                      {assignees.map((n, i) => (
                        <span
                          key={n + i}
                          className="assignee-dot"
                          style={{ background: getUserColor(n, i) }}
                          title={n}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </button>
            );

            return enableDragDrop ? (
              <DraggableIntervention
                key={it.id}
                intervention={it}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                disabled={!onInterventionMove}
              >
                {eventCard}
              </DraggableIntervention>
            ) : (
              <React.Fragment key={it.id}>{eventCard}</React.Fragment>
            );
          })}
          </div>
        </DroppableTimeSlot>
      </div>

      {/* Empty state */}
      {positioned.length === 0 && allDay.length === 0 && (
        <div className="agenda-day-empty" role="status">
          <p className="text-muted">Aucune intervention pour cette date.</p>
        </div>
      )}
    </section>
  );
};

export default AgendaDay;
