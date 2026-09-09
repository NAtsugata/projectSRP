// src/utils/smartScheduler.js
// Moteur de planification intelligente multi-jours

import logger from './logger';
import { toLocalDateStr } from './agendaHelpers';

/**
 * Génère une plage de dates consécutives
 * @param {Date|string} startDate - Date de début
 * @param {number} days - Nombre de jours
 * @returns {string[]} - Tableau de dates au format YYYY-MM-DD
 */
export const generateDateRange = (startDate, days) => {
  const start = new Date(startDate);
  const dates = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(toLocalDateStr(date));
  }

  return dates;
};

/**
 * Génère une plage de dates en excluant les week-ends
 * @param {Date|string} startDate - Date de début
 * @param {number} workDays - Nombre de jours ouvrés
 * @param {Object} options - Options (includeWeekends, excludeDates)
 * @returns {string[]} - Tableau de dates
 */
export const generateWorkingDays = (startDate, workDays, options = {}) => {
  const {
    includeWeekends = false,
    excludeDates = [],
    excludePublicHolidays = true
  } = options;

  const start = new Date(startDate);
  const dates = [];
  const currentDate = new Date(start);
  let addedDays = 0;

  while (addedDays < workDays) {
    const dateStr = toLocalDateStr(currentDate);

    // Vérifier si exclu
    if (excludeDates.includes(dateStr)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Vérifier weekend
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Dimanche ou Samedi

    if (!includeWeekends && isWeekend) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Vérifier jour férié
    if (excludePublicHolidays && isPublicHoliday(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    dates.push(dateStr);
    addedDays++;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

/**
 * Vérifie si une date est un jour férié français
 * @param {Date} date - Date à vérifier
 * @returns {boolean}
 */
export const isPublicHoliday = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Jours fériés fixes
  const fixedHolidays = [
    '01-01', // Jour de l'an
    '05-01', // Fête du travail
    '05-08', // Victoire 1945
    '07-14', // Fête nationale
    '08-15', // Assomption
    '11-01', // Toussaint
    '11-11', // Armistice 1918
    '12-25'  // Noël
  ];

  const monthDay = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  if (fixedHolidays.includes(monthDay)) {
    return true;
  }

  // Jours fériés mobiles (Pâques, Ascension, Pentecôte)
  const easter = calculateEaster(year);

  // Lundi de Pâques = Easter + 1 jour
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  // Jeudi de l'Ascension = Easter + 39 jours
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);

  // Lundi de Pentecôte = Easter + 50 jours
  const pentecostMonday = new Date(easter);
  pentecostMonday.setDate(easter.getDate() + 50);

  const mobileHolidays = [easterMonday, ascension, pentecostMonday];

  for (const holiday of mobileHolidays) {
    if (
      holiday.getDate() === day &&
      holiday.getMonth() + 1 === month &&
      holiday.getFullYear() === year
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Calcule la date de Pâques (algorithme de Meeus)
 * @param {number} year - Année
 * @returns {Date} - Date de Pâques
 */
const calculateEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
};

/**
 * Calcule la durée optimale en jours pour une intervention
 * @param {Object} intervention - Données de l'intervention
 * @returns {number} - Nombre de jours recommandés
 */
export const calculateOptimalDuration = (intervention) => {
  const {
    type = 'maintenance',
    complexity = 'medium',
    description = '',
    estimated_hours = 0
  } = intervention;

  // Base par type
  const typeBaseDays = {
    'installation': 2,
    'maintenance': 1,
    'diagnostic': 0.5,
    'repair': 1,
    'emergency': 0.5,
    'project': 5
  };

  let baseDays = typeBaseDays[type] || 1;

  // Ajuster selon complexité
  const complexityMultiplier = {
    'low': 0.7,
    'medium': 1,
    'high': 1.5,
    'very_high': 2
  };

  baseDays *= complexityMultiplier[complexity] || 1;

  // Si durée estimée fournie
  if (estimated_hours > 0) {
    const hoursPerDay = 7; // Heures productives par jour
    baseDays = Math.max(baseDays, estimated_hours / hoursPerDay);
  }

  // Arrondir au demi-jour supérieur
  return Math.ceil(baseDays * 2) / 2;
};

/**
 * Divise une intervention en tâches journalières
 * @param {Object} intervention - Intervention
 * @param {string[]} dates - Dates planifiées
 * @returns {Object} - Planning par jour { "2026-03-15": { task, progress, ... }, ... }
 */
export const splitIntoDailyTasks = (intervention, dates) => {
  const {
    type = 'maintenance',
    description = '',
    estimated_hours = 0
  } = intervention;

  const dailyPlan = {};
  const totalDays = dates.length;

  // Phases standards pour une installation
  const installationPhases = [
    'Préparation et diagnostic',
    'Installation système principal',
    'Installation composants secondaires',
    'Tests et mise en service',
    'Formation et finalisation'
  ];

  // Phases pour maintenance
  const maintenancePhases = [
    'Diagnostic et inspection',
    'Nettoyage et entretien',
    'Réparations mineures',
    'Tests de fonctionnement'
  ];

  // Sélectionner les phases appropriées
  let phases = type === 'installation' ? installationPhases : maintenancePhases;

  // Ajuster le nombre de phases au nombre de jours
  if (phases.length > totalDays) {
    phases = phases.slice(0, totalDays);
  } else if (phases.length < totalDays) {
    // Dupliquer la phase principale si nécessaire
    while (phases.length < totalDays) {
      phases.splice(Math.floor(phases.length / 2), 0, phases[1] || phases[0]);
    }
  }

  // Répartir les heures
  const hoursPerDay = estimated_hours > 0 ? estimated_hours / totalDays : 7;

  dates.forEach((date, index) => {
    dailyPlan[date] = {
      date,
      phase: phases[index] || `Jour ${index + 1}`,
      estimatedHours: Math.round(hoursPerDay * 10) / 10,
      progress: 0,
      dayNumber: index + 1,
      totalDays,
      tasks: generateDailyTasks(phases[index], type),
      isFirstDay: index === 0,
      isLastDay: index === totalDays - 1
    };
  });

  return dailyPlan;
};

/**
 * Génère les tâches spécifiques pour une phase
 * @param {string} phase - Phase de la journée
 * @param {string} type - Type d'intervention
 * @returns {string[]} - Liste des tâches
 */
const generateDailyTasks = (phase, type) => {
  const taskTemplates = {
    'Préparation et diagnostic': [
      'Vérification du matériel',
      'Inspection des lieux',
      'Relevé des mesures',
      'Validation du plan d\'intervention'
    ],
    'Installation système principal': [
      'Pose du système principal',
      'Raccordements électriques',
      'Raccordements hydrauliques',
      'Fixation et sécurisation'
    ],
    'Diagnostic et inspection': [
      'Inspection visuelle complète',
      'Tests de pression',
      'Vérification des connections',
      'Analyse des performances'
    ],
    'Tests et mise en service': [
      'Tests de fonctionnement',
      'Réglages et calibration',
      'Vérification sécurité',
      'Validation client'
    ]
  };

  return taskTemplates[phase] || [
    'Travaux programmés',
    'Vérifications',
    'Tests',
    'Finalisation'
  ];
};

/**
 * Crée une intervention multi-jours avec planning auto
 * @param {Object} baseIntervention - Données de base
 * @param {Date|string} startDate - Date de début
 * @param {number} duration - Durée en jours (optionnel, calculé auto sinon)
 * @param {Object} options - Options de planification
 * @returns {Object} - Intervention enrichie
 */
export const createMultiDayIntervention = (
  baseIntervention,
  startDate,
  duration = null,
  options = {}
) => {
  const {
    excludeWeekends = true,
    excludePublicHolidays = true,
    assignTeam = true
  } = options;

  // Calculer durée optimale si non fournie
  const days = duration || calculateOptimalDuration(baseIntervention);

  // Générer les dates
  const scheduledDates = generateWorkingDays(
    startDate,
    Math.ceil(days),
    {
      includeWeekends: !excludeWeekends,
      excludePublicHolidays
    }
  );

  // Créer le planning journalier
  const dailyPlan = splitIntoDailyTasks(baseIntervention, scheduledDates);

  // Structure enrichie
  const multiDayIntervention = {
    ...baseIntervention,
    scheduled_dates: scheduledDates,
    start_date: scheduledDates[0],
    end_date: scheduledDates[scheduledDates.length - 1],
    duration_days: scheduledDates.length,
    is_multi_day: scheduledDates.length > 1,
    daily_plan: dailyPlan,
    daily_assignments: {}, // À remplir par l'auto-assignation
    metadata: {
      created_at: new Date().toISOString(),
      planning_method: 'smart_scheduler',
      excluded_weekends: excludeWeekends,
      excluded_holidays: excludePublicHolidays,
      optimal_duration_calculated: !duration
    }
  };

  logger.log('[SmartScheduler] Intervention multi-jours créée:', {
    dates: scheduledDates.length,
    from: scheduledDates[0],
    to: scheduledDates[scheduledDates.length - 1]
  });

  return multiDayIntervention;
};

/**
 * Modifie les dates d'une intervention multi-jours
 * @param {Object} intervention - Intervention existante
 * @param {Date|string} newStartDate - Nouvelle date de début
 * @param {number} newDuration - Nouvelle durée (optionnel)
 * @returns {Object} - Intervention mise à jour
 */
export const rescheduleIntervention = (intervention, newStartDate, newDuration = null) => {
  const duration = newDuration || intervention.duration_days || intervention.scheduled_dates?.length || 1;

  const newDates = generateWorkingDays(newStartDate, duration, {
    includeWeekends: !intervention.metadata?.excluded_weekends,
    excludePublicHolidays: intervention.metadata?.excluded_holidays !== false
  });

  // Recréer le planning journalier
  const newDailyPlan = splitIntoDailyTasks(intervention, newDates);

  // Conserver les assignations existantes si possibles
  const newDailyAssignments = {};
  const oldAssignments = intervention.daily_assignments || {};

  newDates.forEach((date, index) => {
    const oldDate = intervention.scheduled_dates?.[index];
    if (oldDate && oldAssignments[oldDate]) {
      newDailyAssignments[date] = oldAssignments[oldDate];
    }
  });

  return {
    ...intervention,
    scheduled_dates: newDates,
    start_date: newDates[0],
    end_date: newDates[newDates.length - 1],
    duration_days: newDates.length,
    daily_plan: newDailyPlan,
    daily_assignments: newDailyAssignments,
    metadata: {
      ...intervention.metadata,
      last_rescheduled: new Date().toISOString()
    }
  };
};

/**
 * Étend ou réduit une intervention multi-jours
 * @param {Object} intervention - Intervention
 * @param {number} additionalDays - Jours à ajouter (négatif pour réduire)
 * @returns {Object} - Intervention modifiée
 */
export const extendIntervention = (intervention, additionalDays) => {
  const currentDates = intervention.scheduled_dates || [intervention.date];
  const lastDate = currentDates[currentDates.length - 1];

  if (additionalDays > 0) {
    // Ajouter des jours
    const newDates = generateWorkingDays(lastDate, additionalDays + 1, {
      includeWeekends: !intervention.metadata?.excluded_weekends
    });

    // Retirer le premier (qui est lastDate)
    newDates.shift();

    const allDates = [...currentDates, ...newDates];
    return rescheduleIntervention(intervention, currentDates[0], allDates.length);

  } else if (additionalDays < 0) {
    // Réduire
    const daysToKeep = Math.max(1, currentDates.length + additionalDays);
    const newDates = currentDates.slice(0, daysToKeep);

    return rescheduleIntervention(intervention, currentDates[0], newDates.length);
  }

  return intervention;
};

export default {
  generateDateRange,
  generateWorkingDays,
  isPublicHoliday,
  calculateOptimalDuration,
  splitIntoDailyTasks,
  createMultiDayIntervention,
  rescheduleIntervention,
  extendIntervention
};
