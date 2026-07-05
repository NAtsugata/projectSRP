// src/utils/teamForDate.js
// Équipe d'une intervention POUR UN JOUR DONNÉ.
//
// Règle métier : sur un chantier multi-jours, chaque jour affiche uniquement
// les personnes qui travaillent CE jour-là (interventions.daily_assignments),
// pas tous ceux qui interviennent sur le chantier. Si aucune équipe
// journalière n'est définie pour la date, on retombe sur l'équipe globale
// (intervention_assignments).

/**
 * IDs des employés qui travaillent sur l'intervention à la date donnée.
 * @param {Object} itv - intervention (avec daily_assignments / intervention_assignments)
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string[]} user ids
 */
export function getDayTeamIds(itv, dateStr) {
  const daily = itv?.daily_assignments || {};
  const key = dateStr ? String(dateStr).split('T')[0] : null;
  if (key && Array.isArray(daily[key]) && daily[key].length > 0) {
    return daily[key];
  }
  return (itv?.intervention_assignments || []).map((a) => a.user_id);
}

/**
 * Copie de l'intervention restreinte à l'équipe du jour :
 * - intervention_assignments filtré aux membres du jour (forme conservée)
 * - assigned_to = ids du jour (compat helpers legacy)
 * Toutes les vues qui affichent les assignés d'une carte "jour" doivent
 * recevoir cette copie, pas l'intervention brute.
 */
export function narrowToDate(itv, dateStr) {
  const dayIds = getDayTeamIds(itv, dateStr);
  const idSet = new Set(dayIds);
  const global = itv?.intervention_assignments || [];
  const narrowed = global.filter((a) => idSet.has(a.user_id));
  // Membres du jour absents de l'équipe globale (cas rare) : forme minimale
  dayIds.forEach((uid) => {
    if (!narrowed.some((a) => a.user_id === uid)) {
      narrowed.push({ user_id: uid, profiles: null });
    }
  });
  return {
    ...itv,
    intervention_assignments: narrowed,
    assigned_to: dayIds,
  };
}

/**
 * Noms des employés du jour (pour affichage direct).
 */
export function getDayTeamNames(itv, dateStr, usersMap = {}) {
  const ids = getDayTeamIds(itv, dateStr);
  if (ids.length === 0) return [];
  const global = itv?.intervention_assignments || [];
  return ids.map((uid) => {
    const fromAssignment = global.find((a) => a.user_id === uid)?.profiles?.full_name;
    return fromAssignment || usersMap[uid]?.full_name || usersMap[uid]?.name || '?';
  });
}
