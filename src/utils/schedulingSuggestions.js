// src/utils/schedulingSuggestions.js
// Système de suggestions intelligentes de planification

import {
  createMultiDayIntervention,
  generateWorkingDays,
  calculateOptimalDuration
} from './smartScheduler';
import { autoAssignTechnicians, suggestBestTeams } from './autoAssignment';
import { validateScheduling } from './conflictDetection';
import logger from './logger';

/**
 * Génère des suggestions complètes de planification pour une intervention
 * @param {Object} intervention - Intervention de base
 * @param {Object} context - Contexte (users, interventions, absences, etc.)
 * @param {Object} preferences - Préférences utilisateur
 * @returns {Array} - Liste de suggestions triées par pertinence
 */
export const generateSchedulingSuggestions = (
  intervention,
  context = {},
  preferences = {}
) => {
  const {
    users = [],
    allInterventions = [],
    absences = []
  } = context;

  const {
    preferredStartDate = new Date(),
    flexibility = 'medium', // low, medium, high
    prioritizeQuality = true,
    maxSuggestions = 5
  } = preferences;

  const suggestions = [];

  // 1. Suggestion "Au plus tôt" (prochaine disponibilité)
  const earliestSuggestion = suggestEarliest(
    intervention,
    preferredStartDate,
    { users, allInterventions, absences }
  );
  if (earliestSuggestion) suggestions.push(earliestSuggestion);

  // 2. Suggestion "Optimal" (meilleur équilibre)
  const optimalSuggestion = suggestOptimal(
    intervention,
    preferredStartDate,
    { users, allInterventions, absences },
    { prioritizeQuality }
  );
  if (optimalSuggestion) suggestions.push(optimalSuggestion);

  // 3. Suggestion "Flexible" (alternatives)
  if (flexibility !== 'low') {
    const flexibleSuggestions = suggestFlexibleAlternatives(
      intervention,
      preferredStartDate,
      { users, allInterventions, absences },
      { count: 3 }
    );
    suggestions.push(...flexibleSuggestions);
  }

  // Trier par score de qualité
  suggestions.sort((a, b) => b.qualityScore - a.qualityScore);

  // Limiter au nombre demandé
  return suggestions.slice(0, maxSuggestions);
};

/**
 * Suggestion: Au plus tôt
 */
const suggestEarliest = (intervention, startDate, context) => {
  const { users } = context;

  // Trouver la première date sans conflit
  let currentDate = new Date(startDate);
  let attempts = 0;
  const maxAttempts = 30; // Chercher sur 30 jours max

  while (attempts < maxAttempts) {
    const plannedIntervention = createMultiDayIntervention(
      intervention,
      currentDate
    );

    // Auto-assigner
    const assignment = autoAssignTechnicians(
      plannedIntervention,
      users,
      context
    );

    if (assignment.confidence > 60) {
      // Valider
      plannedIntervention.intervention_assignments = assignment.assignedUsers.map(id => ({ user_id: id }));

      const validation = validateScheduling(plannedIntervention, {
        ...context,
        users
      });

      if (validation.canProceed) {
        return {
          id: 'earliest',
          label: '🚀 Au plus tôt',
          description: 'Prochaine disponibilité sans conflit',
          intervention: plannedIntervention,
          assignment,
          validation,
          qualityScore: 70 + assignment.confidence / 3,
          startDate: plannedIntervention.start_date,
          benefits: [
            'Démarrage rapide',
            'Aucun conflit bloquant',
            `Confiance: ${assignment.confidence}%`
          ]
        };
      }
    }

    // Passer au jour suivant
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
  }

  return null;
};

/**
 * Suggestion: Optimal
 */
const suggestOptimal = (intervention, startDate, context, options = {}) => {
  const { users } = context;
  const { prioritizeQuality = true } = options;

  // Calculer durée optimale
  const optimalDuration = calculateOptimalDuration(intervention);

  // Chercher la meilleure équipe
  const bestTeams = suggestBestTeams(intervention, users, context);

  if (bestTeams.length === 0) return null;

  const bestTeam = bestTeams[0];

  // Trouver le meilleur créneau pour cette équipe
  let bestSlot = null;
  let bestScore = 0;
  let currentDate = new Date(startDate);

  for (let i = 0; i < 14; i++) { // Chercher sur 2 semaines
    const plannedIntervention = createMultiDayIntervention(
      intervention,
      currentDate,
      optimalDuration
    );

    plannedIntervention.intervention_assignments = bestTeam.userIds.map(id => ({ user_id: id }));

    const validation = validateScheduling(plannedIntervention, {
      ...context,
      users
    });

    // Calculer score de qualité
    let score = bestTeam.score;

    if (validation.conflicts.length === 0) score += 30;
    else if (validation.canProceed) score += 10;
    else score -= 50;

    // Bonus si début de semaine
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 1) score += 5; // Lundi

    if (score > bestScore) {
      bestScore = score;
      bestSlot = {
        intervention: plannedIntervention,
        validation,
        team: bestTeam
      };
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (!bestSlot) return null;

  return {
    id: 'optimal',
    label: '⭐ Optimal',
    description: 'Meilleure équipe et meilleur créneau',
    intervention: bestSlot.intervention,
    assignment: {
      assignedUsers: bestSlot.team.userIds,
      confidence: bestSlot.team.score
    },
    validation: bestSlot.validation,
    qualityScore: bestScore,
    startDate: bestSlot.intervention.start_date,
    benefits: [
      `Équipe optimale (score: ${bestSlot.team.score}%)`,
      `Durée adaptée (${optimalDuration} jours)`,
      bestSlot.team.synergyBonus > 0 ? 'Bonne synergie d\'équipe' : '',
      bestSlot.validation.conflicts.length === 0 ? 'Aucun conflit' : ''
    ].filter(Boolean)
  };
};

/**
 * Suggestion: Alternatives flexibles
 */
const suggestFlexibleAlternatives = (intervention, startDate, context, options = {}) => {
  const { count = 3 } = options;
  const { users } = context;
  const alternatives = [];

  // Dates alternatives: +3 jours, +1 semaine, +2 semaines
  const dateOffsets = [3, 7, 14];

  dateOffsets.slice(0, count).forEach((offset, index) => {
    const altDate = new Date(startDate);
    altDate.setDate(altDate.getDate() + offset);

    const plannedIntervention = createMultiDayIntervention(
      intervention,
      altDate
    );

    const assignment = autoAssignTechnicians(
      plannedIntervention,
      users,
      context
    );

    if (assignment.confidence > 50) {
      plannedIntervention.intervention_assignments = assignment.assignedUsers.map(id => ({ user_id: id }));

      const validation = validateScheduling(plannedIntervention, {
        ...context,
        users
      });

      const qualityScore = assignment.confidence - offset; // Pénalité pour éloignement

      alternatives.push({
        id: `flexible_${index + 1}`,
        label: `📅 Alternative ${index + 1}`,
        description: `Dans ${offset} jour${offset > 1 ? 's' : ''}`,
        intervention: plannedIntervention,
        assignment,
        validation,
        qualityScore,
        startDate: plannedIntervention.start_date,
        benefits: [
          `Démarrage: ${formatDate(plannedIntervention.start_date)}`,
          validation.conflicts.length === 0 ? '✅ Aucun conflit' : `⚠️ ${validation.conflicts.length} conflit(s)`,
          `Confiance: ${assignment.confidence}%`
        ]
      });
    }
  });

  return alternatives;
};

/**
 * Formate une date
 */
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
};

/**
 * Suggère des optimisations pour une planification existante
 * @param {Object} intervention - Intervention planifiée
 * @param {Object} context - Contexte
 * @returns {Array} - Suggestions d'amélioration
 */
export const suggestImprovements = (intervention, context = {}) => {
  const improvements = [];

  // 1. Réduire durée si possible
  if (intervention.duration_days > 1) {
    const optimalDuration = calculateOptimalDuration(intervention);
    if (optimalDuration < intervention.duration_days) {
      improvements.push({
        type: 'reduce_duration',
        message: `Durée peut être réduite à ${optimalDuration} jour(s)`,
        benefit: 'Économie de temps',
        savings: `${intervention.duration_days - optimalDuration} jour(s)`
      });
    }
  }

  // 2. Meilleure équipe disponible
  const { users = [] } = context;
  if (users.length > 0) {
    const bestTeams = suggestBestTeams(intervention, users, context);
    const currentAssignedIds = intervention.intervention_assignments?.map(a => a.user_id) || [];

    if (bestTeams.length > 0) {
      const bestTeamScore = bestTeams[0].score;
      const currentAssignment = autoAssignTechnicians(intervention, users, context);

      if (bestTeamScore > currentAssignment.confidence + 15) {
        improvements.push({
          type: 'better_team',
          message: 'Une meilleure équipe est disponible',
          benefit: `+${bestTeamScore - currentAssignment.confidence}% de confiance`,
          suggestedTeam: bestTeams[0].members
        });
      }
    }
  }

  // 3. Décaler pour éviter conflits
  const validation = validateScheduling(intervention, context);
  if (validation.conflicts.length > 0) {
    improvements.push({
      type: 'avoid_conflicts',
      message: `${validation.conflicts.length} conflit(s) peuvent être évités`,
      benefit: 'Planification sans risque',
      conflicts: validation.conflicts.length
    });
  }

  return improvements;
};

/**
 * Compare plusieurs scénarios de planification
 * @param {Array} scenarios - Liste de scénarios
 * @returns {Object} - Comparaison détaillée
 */
export const compareScenarios = (scenarios) => {
  const comparison = {
    scenarios: scenarios.map((s, index) => ({
      id: s.id || `scenario_${index + 1}`,
      label: s.label || `Scénario ${index + 1}`,
      qualityScore: s.qualityScore || 0,
      startDate: s.intervention?.start_date,
      duration: s.intervention?.duration_days,
      teamSize: s.assignment?.assignedUsers?.length || 0,
      conflicts: s.validation?.conflicts?.length || 0,
      confidence: s.assignment?.confidence || 0,
      pros: s.benefits || [],
      cons: []
    })),
    bestScenario: null,
    recommendation: ''
  };

  // Déterminer meilleur scénario
  if (comparison.scenarios.length > 0) {
    comparison.scenarios.sort((a, b) => b.qualityScore - a.qualityScore);
    comparison.bestScenario = comparison.scenarios[0];
    comparison.recommendation = `Nous recommandons "${comparison.bestScenario.label}" (score: ${comparison.bestScenario.qualityScore})`;
  }

  return comparison;
};

export default {
  generateSchedulingSuggestions,
  suggestImprovements,
  compareScenarios
};
