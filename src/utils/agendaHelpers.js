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

/**
 * Parse une durée estimée d'intervention (en heures)
 * Par défaut: 2h
 */
export const getInterventionDuration = (intervention) => {
  // Si durée définie explicitement
  if (intervention.estimated_duration) {
    return intervention.estimated_duration;
  }

  // Sinon, estimation par défaut
  return 2; // 2 heures
};

/**
 * Vérifie si deux interventions se chevauchent dans le temps
 * @param {Object} itv1 - Première intervention
 * @param {Object} itv2 - Deuxième intervention
 * @returns {boolean} - true si chevauchement
 */
export const doIntervensionsOverlap = (itv1, itv2) => {
  // Même date ?
  if (itv1.date !== itv2.date) return false;

  // Parser les heures
  const start1 = parseTimeToMin(itv1.time || '08:00');
  const start2 = parseTimeToMin(itv2.time || '08:00');

  if (start1 === null || start2 === null) return false;

  // Calculer les fins
  const duration1 = getInterventionDuration(itv1);
  const duration2 = getInterventionDuration(itv2);
  const end1 = start1 + (duration1 * 60);
  const end2 = start2 + (duration2 * 60);

  // Vérifier le chevauchement
  // itv1 commence avant la fin de itv2 ET itv1 se termine après le début de itv2
  return start1 < end2 && end1 > start2;
};

/**
 * Détecte les conflits d'horaires pour un employé
 * @param {string} employeeId - ID de l'employé
 * @param {Array} allInterventions - Toutes les interventions
 * @param {Object} newIntervention - Nouvelle intervention à vérifier (optionnel)
 * @returns {Array} - Liste des conflits
 */
export const detectScheduleConflicts = (employeeId, allInterventions, newIntervention = null) => {
  const conflicts = [];

  // Filtrer les interventions de cet employé
  const employeeInterventions = allInterventions.filter(itv => {
    return itv.assigned_to && itv.assigned_to.includes(employeeId);
  });

  // Si on vérifie une nouvelle intervention
  if (newIntervention && newIntervention.assigned_to && newIntervention.assigned_to.includes(employeeId)) {
    // Vérifier contre toutes les interventions existantes
    employeeInterventions.forEach(existing => {
      if (existing.id !== newIntervention.id && doIntervensionsOverlap(existing, newIntervention)) {
        conflicts.push({
          intervention: existing,
          type: 'overlap',
          employee: employeeId
        });
      }
    });
  } else {
    // Vérifier les conflits dans les interventions existantes
    for (let i = 0; i < employeeInterventions.length; i++) {
      for (let j = i + 1; j < employeeInterventions.length; j++) {
        if (doIntervensionsOverlap(employeeInterventions[i], employeeInterventions[j])) {
          conflicts.push({
            intervention1: employeeInterventions[i],
            intervention2: employeeInterventions[j],
            type: 'overlap',
            employee: employeeId
          });
        }
      }
    }
  }

  return conflicts;
};

/**
 * Détecte tous les conflits pour tous les employés
 * @param {Array} interventions - Liste des interventions
 * @param {Array} employees - Liste des employés
 * @returns {Object} - Conflits groupés par employé
 */
export const detectAllConflicts = (interventions, employees) => {
  const conflictsByEmployee = {};

  employees.forEach(emp => {
    const conflicts = detectScheduleConflicts(emp.id, interventions);
    if (conflicts.length > 0) {
      conflictsByEmployee[emp.id] = {
        employee: emp,
        conflicts
      };
    }
  });

  return conflictsByEmployee;
};

/**
 * Vérifie si un employé est surchargé pour une date donnée
 * @param {string} employeeId - ID de l'employé
 * @param {string} date - Date à vérifier (YYYY-MM-DD)
 * @param {Array} interventions - Liste des interventions
 * @param {number} maxHours - Nombre max d'heures (défaut: 8)
 * @returns {Object} - { overloaded: boolean, hours: number, interventions: [] }
 */
export const checkEmployeeOverload = (employeeId, date, interventions, maxHours = 8) => {
  // Filtrer les interventions de cet employé pour cette date
  const dayInterventions = interventions.filter(itv => {
    return itv.date === date && itv.assigned_to && itv.assigned_to.includes(employeeId);
  });

  // Calculer le total d'heures
  const totalHours = dayInterventions.reduce((sum, itv) => {
    return sum + getInterventionDuration(itv);
  }, 0);

  return {
    overloaded: totalHours > maxHours,
    hours: totalHours,
    maxHours,
    interventions: dayInterventions,
    count: dayInterventions.length
  };
};

/**
 * Valide si une intervention peut être déplacée vers une nouvelle position
 * @param {Object} params - Paramètres de validation
 * @param {Object} params.intervention - Intervention à déplacer
 * @param {string} params.targetDate - Date cible (YYYY-MM-DD)
 * @param {string} params.targetTime - Heure cible (HH:MM)
 * @param {string} params.targetEmployeeId - ID de l'employé cible
 * @param {Array} params.allInterventions - Toutes les interventions
 * @param {Array} params.employees - Tous les employés
 * @returns {Object} - { valid: boolean, reason: string }
 */
export const validateInterventionMove = ({
  intervention,
  targetDate,
  targetTime,
  targetEmployeeId,
  allInterventions,
  employees
}) => {
  // Vérifier que l'employé cible existe
  const targetEmployee = employees.find(e => e.id === targetEmployeeId);
  if (!targetEmployee) {
    return {
      valid: false,
      reason: 'Employé introuvable'
    };
  }

  // Créer une version temporaire de l'intervention avec la nouvelle position
  const movedIntervention = {
    ...intervention,
    date: targetDate,
    time: targetTime,
    assigned_to: [targetEmployeeId]
  };

  // Vérifier les conflits avec les autres interventions de l'employé
  const otherInterventions = allInterventions.filter(itv =>
    itv.id !== intervention.id &&
    itv.assigned_to &&
    itv.assigned_to.includes(targetEmployeeId)
  );

  for (const existing of otherInterventions) {
    if (doIntervensionsOverlap(movedIntervention, existing)) {
      return {
        valid: false,
        reason: `Conflit avec une autre intervention à ${existing.time}`
      };
    }
  }

  // Vérifier la charge de travail
  const overloadCheck = checkEmployeeOverload(
    targetEmployeeId,
    targetDate,
    [...otherInterventions, movedIntervention]
  );

  if (overloadCheck.overloaded) {
    return {
      valid: true, // On autorise quand même mais on alerte
      warning: `L'employé dépassera ${overloadCheck.maxHours}h de travail (${overloadCheck.hours.toFixed(1)}h)`
    };
  }

  return {
    valid: true,
    reason: 'Déplacement autorisé'
  };
};

/**
 * Applique le déplacement d'une intervention
 * @param {Object} params - Paramètres du déplacement
 * @param {string} params.interventionId - ID de l'intervention
 * @param {string} params.targetDate - Nouvelle date
 * @param {string} params.targetTime - Nouvelle heure
 * @param {string} params.targetEmployeeId - Nouvel employé
 * @param {Array} params.interventions - Liste des interventions
 * @returns {Array} - Nouvelle liste d'interventions
 */
export const applyInterventionMove = ({
  interventionId,
  targetDate,
  targetTime,
  targetEmployeeId,
  interventions
}) => {
  return interventions.map(itv => {
    if (itv.id === interventionId) {
      return {
        ...itv,
        date: targetDate,
        time: targetTime,
        assigned_to: targetEmployeeId ? [targetEmployeeId] : itv.assigned_to,
        // Mettre à jour aussi les assignments si nécessaire
        intervention_assignments: targetEmployeeId ? [{
          profiles: { id: targetEmployeeId }
        }] : itv.intervention_assignments
      };
    }
    return itv;
  });
};

/**
 * Formate les minutes en heures:minutes (HH:MM)
 * @param {number} minutes - Minutes depuis minuit
 * @returns {string} - Format HH:MM
 */
export const formatMinutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export { START_MIN, END_MIN, DAY_SPAN };
