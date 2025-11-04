// src/utils/agendaHelpers.js
// Utilitaires pour le layout et formatage de l'agenda

const START_MIN = 6 * 60;  // 06:00
const END_MIN = 20 * 60;   // 20:00
const DAY_SPAN = END_MIN - START_MIN;

const palette = [
  "#4285F4", "#DB4437", "#F4B400", "#0F9D58",
  "#AB47BC", "#00ACC1", "#EF6C00", "#8E24AA",
  "#5C6BC0", "#43A047", "#D81B60", "#3949AB",
];

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
export const parseTimeToMin = (hhmm) => {
  if (!hhmm || typeof hhmm !== "string") return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const minutes = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return h * 60 + minutes;
};

/**
 * Clamp value between min and max
 */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * Get count of urgent needs from intervention
 */
export const getUrgentCount = (itv) =>
  Array.isArray(itv?.report?.needs)
    ? itv.report.needs.filter((n) => n.urgent).length
    : 0;

/**
 * Check if intervention has SAV (follow-up required)
 */
export const hasSAV = (itv) => Boolean(itv?.report?.follow_up_required);

/**
 * Get list of assignee names from intervention
 */
export const getAssignees = (itv) =>
  Array.isArray(itv?.intervention_assignments)
    ? itv.intervention_assignments
        .map((a) => a?.profiles?.full_name)
        .filter(Boolean)
    : [];

/**
 * Get consistent color for a user name
 */
export const getUserColor = (name, i) => {
  if (!name) return palette[i % palette.length];
  let h = 0;
  for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) >>> 0;
  return palette[h % palette.length];
};

/**
 * Layout events in timeline with columns to avoid overlaps
 * Returns { positioned, allDay }
 */
export const layoutEvents = (events) => {
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
  const rows = [];
  for (const ev of timed) {
    // vide ceux déjà terminés
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i]._e <= ev._s) active.splice(i, 1);
    }
    // cherche une ligne où caser l'event
    let placed = false;
    for (const row of rows) {
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

/**
 * Filter interventions based on filter criteria
 */
export const filterInterventions = (interventions, filters) => {
  if (!filters) return interventions;

  return interventions.filter(intervention => {
    // Filter by employees
    if (filters.employees && filters.employees.length > 0) {
      const assignees = getAssignees(intervention);
      const assigneeIds = intervention.intervention_assignments?.map(a => a.profiles?.id) || [];
      const hasSelectedEmployee = filters.employees.some(id => assigneeIds.includes(id));
      if (!hasSelectedEmployee) return false;
    }

    // Filter by urgent only
    if (filters.showUrgentOnly) {
      const urgentCount = getUrgentCount(intervention);
      if (urgentCount === 0) return false;
    }

    // Filter by SAV only
    if (filters.showSAVOnly) {
      if (!hasSAV(intervention)) return false;
    }

    // Filter by search text
    if (filters.searchText && filters.searchText.trim()) {
      const searchLower = filters.searchText.toLowerCase().trim();
      const matchesClient = intervention.client?.toLowerCase().includes(searchLower);
      const matchesService = intervention.service?.toLowerCase().includes(searchLower);
      const matchesAddress = intervention.address?.toLowerCase().includes(searchLower);

      if (!matchesClient && !matchesService && !matchesAddress) return false;
    }

    return true;
  });
};

/**
 * Get date range for a given period
 */
export const getDateRange = (date, viewMode) => {
  const current = new Date(date);

  if (viewMode === 'day') {
    return {
      start: new Date(current),
      end: new Date(current)
    };
  }

  if (viewMode === 'week') {
    // Start on Monday
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      start: monday,
      end: sunday
    };
  }

  if (viewMode === 'month') {
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    return {
      start: firstDay,
      end: lastDay
    };
  }

  return { start: current, end: current };
};

/**
 * Navigate to next/previous period
 */
export const navigatePeriod = (currentDate, viewMode, direction) => {
  const date = new Date(currentDate);

  if (viewMode === 'day') {
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
  } else if (viewMode === 'week') {
    date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
  } else if (viewMode === 'month') {
    date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
  }

  return date;
};

export { START_MIN, END_MIN, DAY_SPAN };
