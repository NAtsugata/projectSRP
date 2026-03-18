// src/utils/subsidyCoproData.js
// Données de référence MaPrimeRénov' Copropriété 2026

/**
 * Aide MaPrimeRénov' Copropriété de base
 */
export const COPRO_BASE_RATE = 0.25; // 25% du montant des travaux

/**
 * Plafond par logement
 */
export const COPRO_MAX_PER_HOUSING = 25000; // €

/**
 * Bonus collectifs cumulables (% supplémentaires)
 */
export const COPRO_COLLECTIVE_BONUSES = {
  // Sortie de passoire énergétique (F/G → E minimum)
  exit_energy_sieve: {
    rate: 0.10, // +10%
    max_per_housing: 10000, // €
    description: 'Sortie de passoire énergétique (F/G → E min)',
  },

  // Atteinte BBC (étiquette A ou B)
  bbc_target: {
    rate: 0.10, // +10%
    max_per_housing: 10000, // €
    description: 'Atteinte du niveau BBC (étiquette A ou B)',
  },

  // Sortie de passoire + BBC (cumul des deux = 20%)
  exit_to_bbc: {
    rate: 0.20, // +20% (remplace les deux précédents)
    max_per_housing: 10000, // €
    description: 'Sortie de passoire vers BBC (F/G → A/B)',
  },

  // Copropriété fragile
  fragile_copro: {
    rate: 0.20, // +20%
    max_per_housing: 3000, // €
    description: 'Copropriété en difficulté financière',
  },
};

/**
 * Aide individuelle par copropriétaire (forfait)
 * Selon catégorie de revenus
 */
export const COPRO_INDIVIDUAL_BONUS = {
  blue: 3000,   // Très modeste
  yellow: 1500, // Modeste
  violet: 0,    // Intermédiaire
  rose: 0,      // Supérieur
};

/**
 * Aide à l'accompagnement (Mon Accompagnateur Rénov')
 * Obligatoire pour les copropriétés
 */
export const COPRO_ACCOMPANIMENT = {
  small_copro: {
    // ≤ 50 logements
    rate: 1.00, // 100% pris en charge
    max_per_housing: 600, // € HT
  },
  large_copro: {
    // > 50 logements
    rate: 1.00, // 100% pris en charge
    max_per_housing: 420, // € HT
  },
};

/**
 * Conditions d'éligibilité copropriété
 */
export const COPRO_ELIGIBILITY_CRITERIA = {
  min_building_age: 15, // ans
  min_principal_residence_rate: 0.75, // 75%
  min_energy_gain: 35, // % d'amélioration énergétique
  accompaniment_required: true,
};

/**
 * Types de travaux éligibles
 */
export const COPRO_ELIGIBLE_WORKS = [
  {
    id: 'insulation',
    label: 'Isolation (toiture, murs, planchers)',
    category: 'enveloppe',
  },
  {
    id: 'heating',
    label: 'Système de chauffage collectif',
    category: 'chauffage',
  },
  {
    id: 'ventilation',
    label: 'Ventilation',
    category: 'ventilation',
  },
  {
    id: 'dhw',
    label: 'Eau chaude sanitaire collective',
    category: 'ecs',
  },
  {
    id: 'interfaces',
    label: 'Interfaces (compteurs individuels, etc.)',
    category: 'interfaces',
  },
  {
    id: 'audit',
    label: 'Audit énergétique',
    category: 'audit',
  },
  {
    id: 'assistance',
    label: 'Assistance à maîtrise d\'ouvrage',
    category: 'assistance',
  },
];

/**
 * Calcule le plafond total pour la copropriété
 * @param {number} housingCount - Nombre de logements
 * @param {number} maxPerHousing - Plafond par logement
 * @returns {number} - Plafond total
 */
export const calculateCoproCeiling = (housingCount, maxPerHousing = COPRO_MAX_PER_HOUSING) => {
  return housingCount * maxPerHousing;
};

/**
 * Détermine si accompagnement avec tarif réduit (> 50 logements)
 * @param {number} housingCount - Nombre de logements
 * @returns {Object} - Tarif accompagnement
 */
export const getAccompanimentRate = (housingCount) => {
  if (housingCount > 50) {
    return COPRO_ACCOMPANIMENT.large_copro;
  }
  return COPRO_ACCOMPANIMENT.small_copro;
};

/**
 * Labels affichables
 */
export const COPRO_LABELS = {
  base_help: 'Aide de base MaPrimeRénov\' Copropriété',
  collective_bonuses: 'Bonus collectifs',
  individual_bonuses: 'Aides individuelles copropriétaires',
  accompaniment: 'Accompagnement Mon Accompagnateur Rénov\'',
  total_collective: 'Total aide collective',
  total_with_individual: 'Total avec aides individuelles',
};

/**
 * Exemples de répartition copropriétaires par catégorie
 */
export const COPRO_DISTRIBUTION_EXAMPLES = [
  {
    id: 'mixed',
    label: 'Copropriété mixte',
    distribution: {
      blue: 0.30,   // 30% très modestes
      yellow: 0.40, // 40% modestes
      violet: 0.20, // 20% intermédiaires
      rose: 0.10,   // 10% supérieurs
    },
  },
  {
    id: 'social',
    label: 'Copropriété sociale',
    distribution: {
      blue: 0.60,
      yellow: 0.30,
      violet: 0.10,
      rose: 0,
    },
  },
  {
    id: 'standard',
    label: 'Copropriété standard',
    distribution: {
      blue: 0.20,
      yellow: 0.30,
      violet: 0.30,
      rose: 0.20,
    },
  },
  {
    id: 'upscale',
    label: 'Copropriété aisée',
    distribution: {
      blue: 0,
      yellow: 0.10,
      violet: 0.30,
      rose: 0.60,
    },
  },
];

export default {
  COPRO_BASE_RATE,
  COPRO_MAX_PER_HOUSING,
  COPRO_COLLECTIVE_BONUSES,
  COPRO_INDIVIDUAL_BONUS,
  COPRO_ACCOMPANIMENT,
  COPRO_ELIGIBILITY_CRITERIA,
  COPRO_ELIGIBLE_WORKS,
  calculateCoproCeiling,
  getAccompanimentRate,
  COPRO_LABELS,
  COPRO_DISTRIBUTION_EXAMPLES,
};
