// src/utils/conflictDetection.js
// Système de détection de conflits de planification

import logger from './logger';
import { isPublicHoliday } from './smartScheduler';

/**
 * Types de conflits
 */
export const CONFLICT_TYPES = {
  ABSENCE: 'absence',                    // Technicien absent
  OVERLOAD: 'overload',                  // Surcharge (trop d'interventions)
  OVERLAP: 'overlap',                    // Chevauchement horaire
  SKILL_MISMATCH: 'skill_mismatch',      // Compétences inadéquates
  PUBLIC_HOLIDAY: 'public_holiday',      // Jour férié
  WEEKEND: 'weekend',                    // Weekend (si non autorisé)
  DISTANCE: 'distance',                  // Distance trop importante
  AVAILABILITY: 'availability'           // Non disponible
};

/**
 * Niveaux de sévérité
 */
export const SEVERITY = {
  CRITICAL: 'critical',    // Bloquant
  WARNING: 'warning',      // Attention
  INFO: 'info'            // Informatif
};

/**
 * Détecte tous les conflits pour une intervention
 * @param {Object} intervention - Intervention à vérifier
 * @param {Array} users - Techniciens assignés
 * @param {Object} context - Contexte (autres interventions, absences, etc.)
 * @returns {Array} - Liste de conflits détectés
 */
export const detectConflicts = (intervention, users, context = {}) => {
  const {
    allInterventions = [],
    absences = [],
    allowWeekends = false,
    allowPublicHolidays = false,
    maxInterventionsPerDay = 2
  } = context;

  const conflicts = [];
  const dates = intervention.scheduled_dates || [intervention.date];

  // Pour chaque date et chaque technicien
  dates.forEach(date => {
    const assignedUserIds = intervention.daily_assignments?.[date] ||
                           intervention.intervention_assignments?.map(a => a.user_id) ||
                           [];

    assignedUserIds.forEach(userId => {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      // 1. Vérifier absence
      const absenceConflict = checkAbsence(user, date, absences);
      if (absenceConflict) conflicts.push(absenceConflict);

      // 2. Vérifier surcharge
      const overloadConflict = checkOverload(
        user,
        date,
        allInterventions,
        maxInterventionsPerDay,
        intervention.id
      );
      if (overloadConflict) conflicts.push(overloadConflict);

      // 3. Vérifier chevauchement horaire
      const overlapConflict = checkTimeOverlap(
        user,
        date,
        intervention,
        allInterventions
      );
      if (overlapConflict) conflicts.push(overlapConflict);
    });

    // 4. Vérifier jour férié
    if (!allowPublicHolidays) {
      const holidayConflict = checkPublicHoliday(date);
      if (holidayConflict) conflicts.push(holidayConflict);
    }

    // 5. Vérifier weekend
    if (!allowWeekends) {
      const weekendConflict = checkWeekend(date);
      if (weekendConflict) conflicts.push(weekendConflict);
    }
  });

  // 6. Vérifier compétences
  const assignedUsers = users.filter(u =>
    intervention.intervention_assignments?.some(a => a.user_id === u.id)
  );

  assignedUsers.forEach(user => {
    const skillConflict = checkSkillMatch(user, intervention);
    if (skillConflict) conflicts.push(skillConflict);
  });

  logger.log(`[ConflictDetection] ${conflicts.length} conflit(s) détecté(s) pour intervention ${intervention.id}`);

  return conflicts;
};

/**
 * Vérifie si un technicien est absent
 */
const checkAbsence = (user, date, absences) => {
  const absence = absences.find(abs =>
    abs.user_id === user.id &&
    abs.start_date <= date &&
    abs.end_date >= date &&
    abs.status === 'approved'
  );

  if (absence) {
    return {
      type: CONFLICT_TYPES.ABSENCE,
      severity: SEVERITY.CRITICAL,
      date,
      userId: user.id,
      userName: user.full_name,
      message: `${user.full_name} est absent(e) le ${formatDate(date)}`,
      reason: absence.reason || 'Absence',
      details: absence
    };
  }

  return null;
};

/**
 * Vérifie la surcharge d'un technicien
 */
const checkOverload = (user, date, allInterventions, maxPerDay, currentInterventionId) => {
  const interventionsForDay = allInterventions.filter(itv => {
    if (itv.id === currentInterventionId) return false; // Exclure intervention courante

    const dates = itv.scheduled_dates || [itv.date];
    return dates.includes(date);
  });

  const userInterventions = interventionsForDay.filter(itv =>
    itv.intervention_assignments?.some(a => a.user_id === user.id)
  );

  if (userInterventions.length >= maxPerDay) {
    return {
      type: CONFLICT_TYPES.OVERLOAD,
      severity: SEVERITY.WARNING,
      date,
      userId: user.id,
      userName: user.full_name,
      message: `${user.full_name} a déjà ${userInterventions.length} intervention(s) le ${formatDate(date)}`,
      current: userInterventions.length,
      maximum: maxPerDay,
      details: userInterventions.map(itv => ({
        id: itv.id,
        title: itv.title || itv.type
      }))
    };
  }

  return null;
};

/**
 * Vérifie les chevauchements horaires
 */
const checkTimeOverlap = (user, date, intervention, allInterventions) => {
  const itvStart = intervention.start_time || '08:00';
  const itvEnd = intervention.end_time || '17:00';

  const overlapping = allInterventions.filter(itv => {
    if (itv.id === intervention.id) return false;

    const dates = itv.scheduled_dates || [itv.date];
    if (!dates.includes(date)) return false;

    const assigned = itv.intervention_assignments?.some(a => a.user_id === user.id);
    if (!assigned) return false;

    // Vérifier chevauchement horaire
    const otherStart = itv.start_time || '08:00';
    const otherEnd = itv.end_time || '17:00';

    return timesOverlap(itvStart, itvEnd, otherStart, otherEnd);
  });

  if (overlapping.length > 0) {
    return {
      type: CONFLICT_TYPES.OVERLAP,
      severity: SEVERITY.CRITICAL,
      date,
      userId: user.id,
      userName: user.full_name,
      message: `Chevauchement horaire pour ${user.full_name} le ${formatDate(date)}`,
      timeSlot: `${itvStart}-${itvEnd}`,
      conflictingInterventions: overlapping.map(itv => ({
        id: itv.id,
        title: itv.title || itv.type,
        timeSlot: `${itv.start_time || '08:00'}-${itv.end_time || '17:00'}`
      }))
    };
  }

  return null;
};

/**
 * Vérifie si c'est un jour férié
 */
const checkPublicHoliday = (date) => {
  const dateObj = new Date(date);

  if (isPublicHoliday(dateObj)) {
    return {
      type: CONFLICT_TYPES.PUBLIC_HOLIDAY,
      severity: SEVERITY.WARNING,
      date,
      message: `Le ${formatDate(date)} est un jour férié`,
      canOverride: true
    };
  }

  return null;
};

/**
 * Vérifie si c'est un weekend
 */
const checkWeekend = (date) => {
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      type: CONFLICT_TYPES.WEEKEND,
      severity: SEVERITY.INFO,
      date,
      message: `Le ${formatDate(date)} est un ${dayOfWeek === 0 ? 'dimanche' : 'samedi'}`,
      canOverride: true
    };
  }

  return null;
};

/**
 * Vérifie la correspondance des compétences
 */
const checkSkillMatch = (user, intervention) => {
  const userSkills = user.skills || [];
  const requiredType = intervention.type || 'maintenance';

  const skillMapping = {
    'installation': ['installation', 'plomberie'],
    'maintenance': ['maintenance'],
    'emergency': ['urgence', 'diagnostic']
  };

  const required = skillMapping[requiredType] || [];

  if (required.length === 0) return null;

  const hasMatch = required.some(reqSkill =>
    userSkills.some(userSkill =>
      userSkill.toLowerCase().includes(reqSkill) ||
      reqSkill.includes(userSkill.toLowerCase())
    )
  );

  if (!hasMatch) {
    return {
      type: CONFLICT_TYPES.SKILL_MISMATCH,
      severity: SEVERITY.WARNING,
      userId: user.id,
      userName: user.full_name,
      message: `Compétences de ${user.full_name} ne correspondent pas parfaitement`,
      required,
      userSkills,
      canOverride: true
    };
  }

  return null;
};

/**
 * Vérifie si deux plages horaires se chevauchent
 */
const timesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

/**
 * Formate une date pour affichage
 */
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Regroupe les conflits par sévérité
 * @param {Array} conflicts - Liste de conflits
 * @returns {Object} - { critical: [], warning: [], info: [] }
 */
export const groupConflictsBySeverity = (conflicts) => {
  return {
    critical: conflicts.filter(c => c.severity === SEVERITY.CRITICAL),
    warning: conflicts.filter(c => c.severity === SEVERITY.WARNING),
    info: conflicts.filter(c => c.severity === SEVERITY.INFO)
  };
};

/**
 * Filtre les conflits bloquants (critiques)
 * @param {Array} conflicts - Liste de conflits
 * @returns {boolean} - True si au moins un conflit critique
 */
export const hasBlockingConflicts = (conflicts) => {
  return conflicts.some(c => c.severity === SEVERITY.CRITICAL);
};

/**
 * Génère un rapport de conflits formaté
 * @param {Array} conflicts - Liste de conflits
 * @returns {string} - Rapport textuel
 */
export const generateConflictReport = (conflicts) => {
  if (conflicts.length === 0) {
    return '✅ Aucun conflit détecté';
  }

  const grouped = groupConflictsBySeverity(conflicts);
  let report = '';

  if (grouped.critical.length > 0) {
    report += `🔴 ${grouped.critical.length} conflit(s) critique(s):\n`;
    grouped.critical.forEach(c => {
      report += `  - ${c.message}\n`;
    });
  }

  if (grouped.warning.length > 0) {
    report += `\n🟡 ${grouped.warning.length} avertissement(s):\n`;
    grouped.warning.forEach(c => {
      report += `  - ${c.message}\n`;
    });
  }

  if (grouped.info.length > 0) {
    report += `\nℹ️  ${grouped.info.length} information(s):\n`;
    grouped.info.forEach(c => {
      report += `  - ${c.message}\n`;
    });
  }

  return report;
};

/**
 * Suggère des solutions pour résoudre les conflits
 * @param {Array} conflicts - Liste de conflits
 * @param {Object} context - Contexte (users, interventions, etc.)
 * @returns {Array} - Suggestions de résolution
 */
export const suggestResolutions = (conflicts, context = {}) => {
  const suggestions = [];

  conflicts.forEach(conflict => {
    switch (conflict.type) {
      case CONFLICT_TYPES.ABSENCE:
        suggestions.push({
          conflictId: conflict.userId + conflict.date,
          type: 'reassign',
          message: `Réassigner à un autre technicien disponible`,
          action: 'auto_reassign',
          priority: 'high'
        });
        break;

      case CONFLICT_TYPES.OVERLOAD:
        suggestions.push({
          conflictId: conflict.userId + conflict.date,
          type: 'redistribute',
          message: `Redistribuer certaines interventions ou ajouter un technicien`,
          action: 'redistribute_load',
          priority: 'medium'
        });
        break;

      case CONFLICT_TYPES.OVERLAP:
        suggestions.push({
          conflictId: conflict.userId + conflict.date,
          type: 'reschedule',
          message: `Décaler l'horaire ou modifier la date`,
          action: 'reschedule_time',
          priority: 'high'
        });
        break;

      case CONFLICT_TYPES.PUBLIC_HOLIDAY:
      case CONFLICT_TYPES.WEEKEND:
        suggestions.push({
          conflictId: conflict.date,
          type: 'reschedule_date',
          message: `Planifier un jour ouvré ou autoriser exceptionnellement`,
          action: 'change_date',
          priority: 'low'
        });
        break;

      case CONFLICT_TYPES.SKILL_MISMATCH:
        suggestions.push({
          conflictId: conflict.userId,
          type: 'add_team_member',
          message: `Ajouter un technicien avec les compétences requises`,
          action: 'add_skilled_user',
          priority: 'medium'
        });
        break;

      default:
        break;
    }
  });

  return suggestions;
};

/**
 * Valide si une intervention peut être planifiée
 * @param {Object} intervention - Intervention
 * @param {Object} context - Contexte complet
 * @returns {Object} - { valid: boolean, conflicts: [], canOverride: boolean }
 */
export const validateScheduling = (intervention, context = {}) => {
  const { users = [] } = context;

  const conflicts = detectConflicts(intervention, users, context);
  const hasBlocking = hasBlockingConflicts(conflicts);

  const overridable = conflicts.filter(c => c.canOverride);
  const canOverride = conflicts.length > 0 && conflicts.length === overridable.length;

  return {
    valid: conflicts.length === 0,
    canProceed: !hasBlocking || canOverride,
    conflicts,
    hasBlockingConflicts: hasBlocking,
    canOverride,
    report: generateConflictReport(conflicts),
    suggestions: suggestResolutions(conflicts, context)
  };
};

export default {
  CONFLICT_TYPES,
  SEVERITY,
  detectConflicts,
  groupConflictsBySeverity,
  hasBlockingConflicts,
  generateConflictReport,
  suggestResolutions,
  validateScheduling
};
