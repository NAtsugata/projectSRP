import React, { useMemo } from "react";

/**
 * AgendaView — style Google Agenda (jour par jour)
 * - Timeline de 06:00 à 20:00
 * - Événements positionnés selon heure début/fin (time_start / time_end ou time)
 * - Gestion des "Toute la journée"
 * - Badges: URG n (besoins urgents), SAV (follow_up_required)
 * - Couleurs par intervenant (petits points + légende)
 *
 * Props attendues (souples):
 *   interventions: [{
 *     id, date (YYYY-MM-DD),
 *     client, service, address?,
 *     time_start?, time_end?, time?,  // on tolère "time" si tu n'as qu'une heure
 *     report?: { needs?: [{ urgent: boolean }] , follow_up_required? },
 *     intervention_assignments?: [{ profiles: { full_name } }],
 *   }]
 *   onSelect?: (intervention) => void   // optionnel
 */

const START_MIN = 6 * 60;  // 06:00
const END_MIN = 20 * 60;   // 20:00
const DAY_SPAN = END_MIN - START_MIN;

const HOUR_MARKS = Array.from({ length: END_MIN / 60 - START_MIN / 60 + 1 }, (_, i) => 6 + i);

const palette = [
  "#4285F4", "#DB4437", "#F4B400", "#0F9D58",
  "#AB47BC", "#00ACC1", "#EF6C00", "#8E24AA",
  "#5C6BC0", "#43A047", "#D81B60", "#3949AB",
];

const parseTimeToMin = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string") return null;
  // accepts "HH:mm" or "H:mm"
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const minutes = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return h * 60 + minutes;
};

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const getUrgentCount = (itv) =>
  Array.isArray(itv?.report?.needs)
    ? itv.report.needs.filter((n) => n.urgent).length
    : 0;

const hasSAV = (itv) => Boolean(itv?.report?.follow_up_required);

const getAssignees = (itv) =>
  Array.isArray(itv?.intervention_assignments)
    ? itv.intervention_assignments
        .map((a) => a?.profiles?.full_name)
        .filter(Boolean)
    : [];

/**
 * Assigne une colonne par chevauchement (façon Google Agenda).
 * Retourne events enrichis: { ...itv, _layout: { top, height, left, width } }
 */
const layoutEvents = (events) => {
  // Prépare créneaux (en minutes depuis 00:00)
  const prepared = events.map((e) => {
    const start =
      parseTimeToMin(e.time_start) ??
      parseTimeToMin(e.time) ??
      parseTimeToMin("08:00");
    const end =
      parseTimeToMin(e.time_end) ??
      (start != null ? start + 60 : parseTimeToMin("09:00"));
    return { ...e, _start: start, _end: end };
  });

  // Filtre ceux qui ont des heures plausibles & clamp dans la zone visible
  const timed = prepared
    .filter((e) => e._start != null && e._end != null && e._end > e._start)
    .map((e) => {
      const s = clamp(e._start, START_MIN, END_MIN);
      const en = clamp(e._end, START_MIN, END_MIN);
      return { ...e, _s: s, _e: Math.max(s + 10, en) }; // min 10 min de hauteur visuelle
    })
    .sort((a, b) => a._s - b._s || a._e - b._e);

  // Algo simple type "line sweep" pour colonnes
  const active = [];
  const rows = []; // liste des "groupes" d'événements qui se chevauchent
  for (const ev of timed) {
    // vide ceux déjà terminés
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i]._e <= ev._s) active.splice(i, 1);
    }
    // cherche une ligne où caser l'event
    let placed = false;
    for (const row of rows) {
      // si pas de conflit avec la dernière colonne de cette rangée
      const conflict = row.some((e) => !(e._e <= ev._s || ev._e <= e._s));
      if (!conflict) {
        row.push(ev);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([ev]);
    active.push(ev);
  }

  // Pour chaque "cluster" (ensemble chevauchant), on attribue des colonnes
  const positioned = [];
  const all = [...timed];
  while (all.length) {
    // cluster = tous les events qui s'intersectent au moins en chaîne
    const cluster = [all.shift()];
    for (let i = 0; i < cluster.length; i++) {
      const a = cluster[i];
      for (let j = all.length - 1; j >= 0; j--) {
        const b = all[j];
        const overlap = !(a._e <= b._s || b._e <= a._s);
        if (overlap && !cluster.includes(b)) {
          cluster.push(b);
          all.splice(j, 1);
        }
      }
    }
    // attribution colonnes au sein du cluster
    const cols = [];
    cluster
      .sort((a, b) => a._s - b._s || a._e - b._e)
      .forEach((ev) => {
        let colIdx = 0;
        while (true) {
          const hasConflict =
            cols[colIdx]?.some((e) => !(e._e <= ev._s || ev._e <= e._s)) || false;
          if (!hasConflict) break;
          colIdx++;
        }
        if (!cols[colIdx]) cols[colIdx] = [];
        cols[colIdx].push(ev);
        ev._col = colIdx;
      });

    const maxCols = cols.length;
    cluster.forEach((ev) => {
      const top = ((ev._s - START_MIN) / DAY_SPAN) * 100;
      const height = ((ev._e - ev._s) / DAY_SPAN) * 100;
      const width = 100 / maxCols;
      const left = ev._col * width;
      positioned.push({
        ...ev,
        _layout: { top, height, left, width },
      });
    });
  }

  // Toute la journée (sans heure)
  const allDay = events.filter(
    (e) =>
      (parseTimeToMin(e.time_start) == null &&
        parseTimeToMin(e.time_end) == null &&
        parseTimeToMin(e.time) == null) ||
      e.all_day === true
  );

  return { positioned, allDay };
};

const getUserColor = (name, i) => {
  if (!name) return palette[i % palette.length];
  let h = 0;
  for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) >>> 0;
  return palette[h % palette.length];
};

export default function AgendaView({ interventions = [], onSelect }) {
  // group by date
  const byDate = useMemo(() => {
    const acc = {};
    for (const it of interventions) {
      const d = it.date;
      if (!d) continue;
      (acc[d] = acc[d] || []).push(it);
    }
    // Tri des évènements par heure
    for (const d of Object.keys(acc)) {
      acc[d].sort((a, b) => {
        const sa =
          parseTimeToMin(a.time_start) ?? parseTimeToMin(a.time) ?? 9999;
        const sb =
          parseTimeToMin(b.time_start) ?? parseTimeToMin(b.time) ?? 9999;
        return sa - sb;
      });
    }
    return acc;
  }, [interventions]);

  const dates = useMemo(() => Object.keys(byDate).sort(), [byDate]);

  return (
    <div>
      <h2 className="view-title">Agenda</h2>

      {dates.map((date) => {
        const dayItems = byDate[date] || [];
        const { positioned, allDay } = layoutEvents(dayItems);

        // Légende intervenants (construit via les noms unique)
        const people = Array.from(
          new Set(
            dayItems.flatMap((it) => getAssignees(it)).filter(Boolean)
          )
        );

        return (
          <section key={date} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">
                {new Date(date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {people.length > 0 && (
                <div className="legend">
                  {people.map((p, i) => (
                    <span key={p} className="legend-item">
                      <span
                        className="legend-dot"
                        style={{ background: getUserColor(p, i) }}
                      />
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* All-day chips */}
            {allDay.length > 0 && (
              <div className="card-white" style={{ marginBottom: 8 }}>
                <div className="allday-wrap">
                  {allDay.map((it) => {
                    const urg = getUrgentCount(it);
                    const sav = hasSAV(it);
                    const assignees = getAssignees(it);
                    return (
                      <button
                        key={it.id}
                        className="chip"
                        title={`${it.client} — ${it.service || ""}`}
                        onClick={() => onSelect?.(it)}
                      >
                        <span className="chip-title">
                          {it.client} {it.service ? `— ${it.service}` : ""}
                        </span>
                        {urg > 0 && <span className="badge badge-warn">URG {urg}</span>}
                        {sav && <span className="badge badge-sav">SAV</span>}
                        {assignees.length > 0 && (
                          <span className="chip-assignees">
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
            <div className="agenda-grid card-white">
              {/* colonne heures */}
              <div className="hours-col">
                {HOUR_MARKS.map((h) => (
                  <div key={h} className="hour-mark">
                    <span className="hour-label">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* zone des évènements */}
              <div className="events-col">
                {/* lignes de fond */}
                {HOUR_MARKS.map((h) => (
                  <div key={h} className="hour-row" />
                ))}

                {/* événements positionnés */}
                {positioned.map((it) => {
                  const urg = getUrgentCount(it);
                  const sav = hasSAV(it);
                  const assignees = getAssignees(it);
                  const { top, height, left, width } = it._layout;

                  return (
                    <div
                      key={it.id}
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
                          <span className="badge badge-warn">URG {urg}</span>
                        )}
                        {sav && <span className="badge badge-sav">SAV</span>}
                        {assignees.length > 0 && (
                          <span className="assignees">
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
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Liste fallback (si aucun événement horaire) */}
            {positioned.length === 0 && allDay.length === 0 && (
              <div className="card-white" style={{ marginTop: 8 }}>
                <p className="text-muted" style={{ padding: "8px 4px" }}>
                  Aucune intervention pour cette date.
                </p>
              </div>
            )}
          </section>
        );
      })}

      <style>{`
        /* Layout global */
        .card-white { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px; }
        .text-muted { color:#6b7280; }

        /* Légende intervenants */
        .legend { display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:#374151; }
        .legend-item { display:inline-flex; align-items:center; gap:6px; }
        .legend-dot { width:10px; height:10px; border-radius:999px; display:inline-block; }

        /* All-day chips */
        .allday-wrap { display:flex; gap:8px; flex-wrap:wrap; }
        .chip {
          display:inline-flex; align-items:center; gap:6px;
          border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px;
          background:#f9fafb; cursor:pointer;
        }
        .chip:hover { background:#f3f4f6; }
        .chip-title { font-weight:600; font-size:13px; }
        .chip-assignees { display:inline-flex; gap:4px; margin-left:6px; }
        .assignee-dot { width:8px; height:8px; border-radius:999px; display:inline-block; }

        /* Badges */
        .badge { font-weight:700; font-size:10px; border-radius:999px; padding:2px 6px; }
        .badge-warn { background:#f59e0b; color:#111827; }
        .badge-sav { background:#3b82f6; color:#fff; }

        /* Agenda grid (façon Google) */
        .agenda-grid {
          display:grid;
          grid-template-columns: 72px 1fr;
          gap:0;
          position:relative;
          min-height: 560px; /* ~14h x 40px */
          overflow:hidden;
        }
        .hours-col {
          border-right:1px solid #e5e7eb;
          padding-right:8px;
          position:relative;
        }
        .hour-mark {
          height: calc(100% * (60 / ${DAY_SPAN}));
          position:relative;
        }
        .hour-label {
          position:absolute; top:-7px; right:8px;
          font-size:12px; color:#6b7280;
        }
        .events-col {
          position:relative;
          background:linear-gradient(to bottom, transparent 50%, #f3f4f6 50%);
          background-size: 100% calc(100% / ${HOUR_MARKS.length - 1});
        }
        .hour-row { height: calc(100% / ${HOUR_MARKS.length - 1}); }

        /* Event cards */
        .event-card {
          position:absolute;
          box-sizing:border-box;
          border-left:4px solid #4285F4;
          background:#E8F0FE;
          color:#1f2937;
          border-radius:8px;
          padding:6px 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
          overflow:hidden;
          cursor:pointer;
        }
        .event-card:hover { filter:brightness(0.98); }
        .event-time { font-size:11px; color:#374151; }
        .event-title { font-weight:700; font-size:13px; margin-top:2px; }
        .event-sub { font-size:12px; color:#4b5563; }
        .event-meta { display:flex; gap:6px; align-items:center; margin-top:4px; }
        .assignees { display:inline-flex; gap:4px; margin-left:auto; }
      `}</style>
    </div>
  );
}
