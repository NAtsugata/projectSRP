// src/utils/autoAssignment.js
// Algorithme d'auto-assignation intelligente des techniciens

import logger from './logger';

/**
 * Calcule le score de compatibilité d'un technicien pour une intervention
 * @param {Object} user - Technicien
 * @param {Object} intervention - Intervention
 * @param {Object} context - Contexte (workload, absences, etc.)
 * @returns {number} - Score 0-100
 */
export const calculateCompatibilityScore = (user, intervention, context = {}) => {
  let score = 0;
  const weights = {
    availability: 40,
    skills: 30,
    workload: 20,
    distance: 10
  };

  // 1. Disponibilité (40 points)
  const availabilityScore = calculateAvailability(user, intervention, context);
  score += availabilityScore * (weights.availability / 100);

  // 2. Compétences (30 points)
  const skillsScore = calculateSkillMatch(user, intervention);
  score += skillsScore * (weights.skills / 100);

  // 3. Charge de travail (20 points) - Plus légère = mieux
  const workloadScore = calculateWorkloadScore(user, context);
  score += workloadScore * (weights.workload / 100);

  // 4. Distance (10 points) - si localisation disponible
  const distanceScore = calculateDistanceScore(user, intervention, context);
  score += distanceScore * (weights.distance / 100);

  return Math.round(score);
};

/**
 * Calcule le score de disponibilité
 */
const calculateAvailability = (user, intervention, context) => {
  const { absences = [], existingAssignments = {} } = context;
  const dates = intervention.scheduled_dates || [intervention.date];

  let availableDays = 0;

  dates.forEach(date => {
    // Vérifier absence
    const isAbsent = absences.some(abs =>
      abs.user_id === user.id &&
      abs.start_date <= date &&
      abs.end_date >= date &&
      abs.status === 'approved'
    );

    if (isAbsent) return;

    // Vérifier surcharge (max 2 interventions/jour)
    const assignmentsForDay = existingAssignments[date] || [];
    const userAssignments = assignmentsForDay.filter(a =>
      a.assignedUsers?.includes(user.id)
    );

    if (userAssignments.length < 2) {
      availableDays++;
    }
  });

  // Score basé sur pourcentage de disponibilité
  return (availableDays / dates.length) * 100;
};

/**
 * Calcule le score de correspondance des compétences
 */
const calculateSkillMatch = (user, intervention) => {
  const userSkills = user.skills || [];
  const requiredType = intervention.type || 'maintenance';

  // Mapping type intervention → compétences
  const skillMapping = {
    'installation': ['installation', 'plomberie', 'electricite'],
    'maintenance': ['maintenance', 'diagnostic'],
    'repair': ['reparation', 'diagnostic'],
    'diagnostic': ['diagnostic', 'expertise'],
    'emergency': ['urgence', 'diagnostic', 'reparation']
  };

  const requiredSkills = skillMapping[requiredType] || [];

  if (requiredSkills.length === 0) {
    return 70; // Score neutre si pas de compétences spécifiques
  }

  // Compter les correspondances
  const matches = requiredSkills.filter(skill =>
    userSkills.some(userSkill =>
      userSkill.toLowerCase().includes(skill) ||
      skill.includes(userSkill.toLowerCase())
    )
  );

  return (matches.length / requiredSkills.length) * 100;
};

/**
 * Calcule le score de charge de travail (inversé: moins de charge = mieux)
 */
const calculateWorkloadScore = (user, context) => {
  const { existingAssignments = {}, allUsers = [] } = context;

  // Compter les assignations du user
  let userAssignments = 0;
  Object.values(existingAssignments).forEach(dayAssignments => {
    dayAssignments.forEach(assignment => {
      if (assignment.assignedUsers?.includes(user.id)) {
        userAssignments++;
      }
    });
  });

  // Compter moyenne des assignations de tous les users
  const totalAssignments = Object.values(existingAssignments).flat().length;
  const avgAssignments = totalAssignments / (allUsers.length || 1);

  // Score inversé: moins que la moyenne = mieux
  if (userAssignments === 0) return 100;
  if (userAssignments <= avgAssignments) return 80;
  if (userAssignments <= avgAssignments * 1.5) return 50;
  return 20; // Surchargé
};

/**
 * Calcule le score de distance (si géolocalisation disponible)
 */
const calculateDistanceScore = (user, intervention, context) => {
  // À implémenter si vous ajoutez la géolocalisation
  // Pour l'instant, score neutre
  return 50;
};

/**
 * Auto-assigne les meilleurs techniciens pour une intervention
 * @param {Object} intervention - Intervention
 * @param {Array} availableUsers - Techniciens disponibles
 * @param {Object} context - Contexte de planification
 * @param {Object} options - Options
 * @returns {Object} - { assignedUsers, dailyAssignments, confidence }
 */
export const autoAssignTechnicians = (
  intervention,
  availableUsers,
  context = {},
  options = {}
) => {
  const {
    teamSize = 1,
    requireSkillMatch = false,
    minScore = 50
  } = options;

  const dates = intervention.scheduled_dates || [intervention.date];

  // Calculer scores pour chaque user
  const scoredUsers = availableUsers.map(user => ({
    user,
    score: calculateCompatibilityScore(user, intervention, context),
    id: user.id
  }));

  // Trier par score décroissant
  scoredUsers.sort((a, b) => b.score - a.score);

  // Filtrer minimum score
  const qualified = scoredUsers.filter(su => su.score >= minScore);

  if (qualified.length === 0) {
    logger.warn('[AutoAssignment] Aucun technicien qualifié trouvé');
    return {
      assignedUsers: [],
      dailyAssignments: {},
      confidence: 0,
      reason: 'no_qualified_users'
    };
  }

  // Sélectionner top N
  const selected = qualified.slice(0, teamSize);
  const assignedUserIds = selected.map(s => s.id);

  // Créer assignations journalières
  const dailyAssignments = {};
  dates.forEach(date => {
    dailyAssignments[date] = assignedUserIds;
  });

  // Calculer confiance globale
  const avgScore = selected.reduce((sum, s) => sum + s.score, 0) / selected.length;
  const confidence = Math.round(avgScore);

  logger.log('[AutoAssignment] Techniciens assignés:', {
    intervention: intervention.id,
    users: assignedUserIds.length,
    confidence: `${confidence}%`,
    scores: selected.map(s => `${s.user.full_name}: ${s.score}%`)
  });

  return {
    assignedUsers: assignedUserIds,
    dailyAssignments,
    confidence,
    details: selected.map(s => ({
      userId: s.id,
      name: s.user.full_name,
      score: s.score
    }))
  };
};

/**
 * Auto-assigne avec rotation pour intervention multi-jours
 * Permet de changer l'équipe chaque jour si souhaité
 * @param {Object} intervention - Intervention
 * @param {Array} availableUsers - Techniciens
 * @param {Object} context - Contexte
 * @param {Object} options - Options
 * @returns {Object} - Assignations
 */
export const autoAssignWithRotation = (
  intervention,
  availableUsers,
  context = {},
  options = {}
) => {
  const {
    teamSize = 1,
    allowRotation = true,
    minScore = 50
  } = options;

  const dates = intervention.scheduled_dates || [intervention.date];
  const dailyAssignments = {};
  const usedUsers = new Set();

  dates.forEach((date, index) => {
    // Créer une intervention temporaire pour ce jour
    const dailyIntervention = {
      ...intervention,
      date,
      scheduled_dates: [date]
    };

    // Filtrer les utilisateurs déjà utilisés si rotation
    const availableForDay = allowRotation
      ? availableUsers.filter(u => !usedUsers.has(u.id) || index > dates.length / 2)
      : availableUsers;

    // Auto-assigner pour ce jour
    const result = autoAssignTechnicians(
      dailyIntervention,
      availableForDay,
      context,
      { teamSize, minScore }
    );

    dailyAssignments[date] = result.assignedUsers;

    // Marquer comme utilisés
    if (allowRotation) {
      result.assignedUsers.forEach(userId => usedUsers.add(userId));
    }
  });

  // Collecter tous les users uniques
  const allAssignedUsers = [...new Set(Object.values(dailyAssignments).flat())];

  return {
    assignedUsers: allAssignedUsers,
    dailyAssignments,
    rotationApplied: allowRotation && usedUsers.size > teamSize
  };
};

/**
 * Optimise la répartition d'interventions sur plusieurs techniciens
 * Algorithme d'équilibrage de charge
 * @param {Array} interventions - Liste d'interventions à assigner
 * @param {Array} users - Techniciens disponibles
 * @param {Object} context - Contexte
 * @returns {Object} - Plan d'assignation global
 */
export const optimizeWorkload = (interventions, users, context = {}) => {
  const assignments = {};
  const userWorkload = {};

  // Initialiser compteurs
  users.forEach(user => {
    userWorkload[user.id] = 0;
  });

  // Trier interventions par priorité/urgence
  const sortedInterventions = [...interventions].sort((a, b) => {
    const priorityOrder = { 'urgent': 1, 'high': 2, 'medium': 3, 'low': 4 };
    return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
  });

  // Assigner chaque intervention
  sortedInterventions.forEach(intervention => {
    // Calculer scores
    const scored = users.map(user => ({
      user,
      score: calculateCompatibilityScore(user, intervention, {
        ...context,
        userWorkload
      })
    }));

    // Ajuster score selon charge actuelle
    scored.forEach(s => {
      const workloadPenalty = userWorkload[s.user.id] * 5; // -5 points par intervention
      s.adjustedScore = Math.max(0, s.score - workloadPenalty);
    });

    // Trier par score ajusté
    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);

    // Sélectionner le meilleur
    const best = scored[0];

    if (best && best.adjustedScore > 30) {
      assignments[intervention.id] = {
        userId: best.user.id,
        score: best.score,
        adjustedScore: best.adjustedScore
      };

      // Incrémenter charge
      const days = intervention.scheduled_dates?.length || 1;
      userWorkload[best.user.id] += days;
    } else {
      logger.warn(`[OptimizeWorkload] Impossible d'assigner intervention ${intervention.id}`);
    }
  });

  // Statistiques
  const stats = {
    totalAssigned: Object.keys(assignments).length,
    totalUnassigned: interventions.length - Object.keys(assignments).length,
    workloadDistribution: userWorkload,
    avgWorkload: Object.values(userWorkload).reduce((a, b) => a + b, 0) / users.length
  };

  logger.log('[OptimizeWorkload] Optimisation terminée:', stats);

  return {
    assignments,
    stats
  };
};

/**
 * Suggère la meilleure équipe pour une intervention complexe
 * @param {Object} intervention - Intervention
 * @param {Array} users - Tous les techniciens
 * @param {Object} context - Contexte
 * @returns {Array} - Top 5 combinaisons recommandées
 */
export const suggestBestTeams = (intervention, users, context = {}) => {
  const teamSize = intervention.complexity === 'very_high' ? 3 :
                   intervention.complexity === 'high' ? 2 : 1;

  const teams = [];

  // Générer toutes les combinaisons possibles
  const combinations = generateCombinations(users, teamSize);

  // Scorer chaque combinaison
  combinations.forEach(team => {
    let teamScore = 0;
    const teamIds = team.map(u => u.id);

    team.forEach(user => {
      teamScore += calculateCompatibilityScore(user, intervention, context);
    });

    // Bonus synergie (si membres ont déjà travaillé ensemble)
    const synergyBonus = calculateSynergyBonus(team, context);
    teamScore += synergyBonus;

    // Score moyen
    teamScore = teamScore / team.length;

    teams.push({
      members: team.map(u => ({ id: u.id, name: u.full_name })),
      userIds: teamIds,
      score: Math.round(teamScore),
      synergyBonus
    });
  });

  // Trier et retourner top 5
  teams.sort((a, b) => b.score - a.score);
  return teams.slice(0, 5);
};

/**
 * Génère toutes les combinaisons de N éléments
 */
const generateCombinations = (arr, size) => {
  const results = [];

  const combine = (start, combo) => {
    if (combo.length === size) {
      results.push([...combo]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  };

  combine(0, []);
  return results;
};

/**
 * Calcule bonus de synergie d'équipe
 */
const calculateSynergyBonus = (team, context) => {
  // À implémenter: analyse historique des collaborations
  // Pour l'instant, bonus simple si compétences complémentaires
  const allSkills = new Set();
  team.forEach(user => {
    (user.skills || []).forEach(skill => allSkills.add(skill));
  });

  // Bonus si diversité de compétences
  return Math.min(allSkills.size * 3, 15);
};

export default {
  calculateCompatibilityScore,
  autoAssignTechnicians,
  autoAssignWithRotation,
  optimizeWorkload,
  suggestBestTeams
};
