// src/utils/subsidyCoproCalculations.js
// Moteur de calcul MaPrimeRénov' Copropriété

import {
  COPRO_BASE_RATE,
  COPRO_MAX_PER_HOUSING,
  COPRO_COLLECTIVE_BONUSES,
  COPRO_INDIVIDUAL_BONUS,
  COPRO_ELIGIBILITY_CRITERIA,
  calculateCoproCeiling,
  getAccompanimentRate,
} from './subsidyCoproData';

import { CEE_RATES, getClimateZone } from './subsidyData';

/**
 * Valide l'éligibilité d'une copropriété
 * @param {Object} coproData - Données de la copropriété
 * @returns {Object} - { eligible: boolean, reasons: string[] }
 */
export const validateCoproEligibility = (coproData) => {
  const {
    building_age,
    principal_residence_rate,
    energy_gain,
    has_accompaniment,
  } = coproData;

  const reasons = [];

  // Vérifier l'âge du bâtiment
  if (building_age < COPRO_ELIGIBILITY_CRITERIA.min_building_age) {
    reasons.push(`❌ Le bâtiment doit avoir plus de ${COPRO_ELIGIBILITY_CRITERIA.min_building_age} ans`);
  }

  // Vérifier le taux de résidences principales
  if (principal_residence_rate < COPRO_ELIGIBILITY_CRITERIA.min_principal_residence_rate) {
    reasons.push(`❌ Minimum ${COPRO_ELIGIBILITY_CRITERIA.min_principal_residence_rate * 100}% de résidences principales requis`);
  }

  // Vérifier le gain énergétique
  if (energy_gain < COPRO_ELIGIBILITY_CRITERIA.min_energy_gain) {
    reasons.push(`❌ Gain énergétique minimum ${COPRO_ELIGIBILITY_CRITERIA.min_energy_gain}% requis`);
  }

  // Vérifier l'accompagnement
  if (COPRO_ELIGIBILITY_CRITERIA.accompaniment_required && !has_accompaniment) {
    reasons.push('❌ Mon Accompagnateur Rénov\' obligatoire');
  }

  const eligible = reasons.length === 0;

  if (eligible) {
    reasons.push('✅ Copropriété éligible à MaPrimeRénov\' Copropriété');
  }

  return { eligible, reasons };
};

/**
 * Calcule l'aide collective de base (25%)
 * @param {number} totalCost - Coût total des travaux
 * @param {number} housingCount - Nombre de logements
 * @returns {Object} - Détails de l'aide de base
 */
export const calculateCoproBaseHelp = (totalCost, housingCount) => {
  const baseAmount = totalCost * COPRO_BASE_RATE;
  const maxCeiling = calculateCoproCeiling(housingCount, COPRO_MAX_PER_HOUSING);
  const cappedAmount = Math.min(baseAmount, maxCeiling);

  return {
    rate: COPRO_BASE_RATE * 100, // 25%
    amount_before_ceiling: baseAmount,
    ceiling: maxCeiling,
    amount: cappedAmount,
    per_housing: cappedAmount / housingCount,
  };
};

/**
 * Calcule les bonus collectifs
 * @param {number} totalCost - Coût total des travaux
 * @param {number} housingCount - Nombre de logements
 * @param {Object} bonusFlags - Flags des bonus applicables
 * @returns {Object} - Détails des bonus
 */
export const calculateCoproCollectiveBonuses = (totalCost, housingCount, bonusFlags) => {
  const {
    has_exit_sieve,
    has_bbc_target,
    is_fragile,
  } = bonusFlags;

  const bonuses = {};
  let totalBonusRate = 0;
  let totalBonusAmount = 0;

  // Bonus sortie de passoire + BBC = 20% (remplace les deux séparés)
  if (has_exit_sieve && has_bbc_target) {
    const bonus = COPRO_COLLECTIVE_BONUSES.exit_to_bbc;
    const amount = totalCost * bonus.rate;
    const maxCeiling = housingCount * bonus.max_per_housing;
    const cappedAmount = Math.min(amount, maxCeiling);

    bonuses.exit_to_bbc = {
      label: bonus.description,
      rate: bonus.rate * 100,
      amount_before_ceiling: amount,
      ceiling: maxCeiling,
      amount: cappedAmount,
    };

    totalBonusRate += bonus.rate;
    totalBonusAmount += cappedAmount;
  } else {
    // Bonus séparés si pas les deux
    if (has_exit_sieve) {
      const bonus = COPRO_COLLECTIVE_BONUSES.exit_energy_sieve;
      const amount = totalCost * bonus.rate;
      const maxCeiling = housingCount * bonus.max_per_housing;
      const cappedAmount = Math.min(amount, maxCeiling);

      bonuses.exit_sieve = {
        label: bonus.description,
        rate: bonus.rate * 100,
        amount_before_ceiling: amount,
        ceiling: maxCeiling,
        amount: cappedAmount,
      };

      totalBonusRate += bonus.rate;
      totalBonusAmount += cappedAmount;
    }

    if (has_bbc_target) {
      const bonus = COPRO_COLLECTIVE_BONUSES.bbc_target;
      const amount = totalCost * bonus.rate;
      const maxCeiling = housingCount * bonus.max_per_housing;
      const cappedAmount = Math.min(amount, maxCeiling);

      bonuses.bbc = {
        label: bonus.description,
        rate: bonus.rate * 100,
        amount_before_ceiling: amount,
        ceiling: maxCeiling,
        amount: cappedAmount,
      };

      totalBonusRate += bonus.rate;
      totalBonusAmount += cappedAmount;
    }
  }

  // Bonus copropriété fragile
  if (is_fragile) {
    const bonus = COPRO_COLLECTIVE_BONUSES.fragile_copro;
    const amount = totalCost * bonus.rate;
    const maxCeiling = housingCount * bonus.max_per_housing;
    const cappedAmount = Math.min(amount, maxCeiling);

    bonuses.fragile = {
      label: bonus.description,
      rate: bonus.rate * 100,
      amount_before_ceiling: amount,
      ceiling: maxCeiling,
      amount: cappedAmount,
    };

    totalBonusRate += bonus.rate;
    totalBonusAmount += cappedAmount;
  }

  return {
    bonuses,
    total_rate: totalBonusRate * 100,
    total_amount: totalBonusAmount,
  };
};

/**
 * Calcule l'aide à l'accompagnement
 * @param {number} housingCount - Nombre de logements
 * @returns {Object} - Détails de l'accompagnement
 */
export const calculateCoproAccompaniment = (housingCount) => {
  const rates = getAccompanimentRate(housingCount);

  return {
    max_per_housing: rates.max_per_housing,
    total_max: rates.max_per_housing * housingCount,
    coverage_rate: rates.rate * 100, // 100%
    is_large_copro: housingCount > 50,
  };
};

/**
 * Calcule les aides individuelles des copropriétaires
 * @param {number} housingCount - Nombre de logements
 * @param {Object} distribution - Répartition par catégorie { blue: 0.3, yellow: 0.4, ... }
 * @returns {Object} - Détails des aides individuelles
 */
export const calculateCoproIndividualBonuses = (housingCount, distribution = null) => {
  // Distribution par défaut si non fournie (copro mixte)
  const defaultDistribution = {
    blue: 0.30,
    yellow: 0.40,
    violet: 0.20,
    rose: 0.10,
  };

  const dist = distribution || defaultDistribution;

  const breakdown = {
    blue: {
      count: Math.round(housingCount * dist.blue),
      amount_per_housing: COPRO_INDIVIDUAL_BONUS.blue,
      total: Math.round(housingCount * dist.blue) * COPRO_INDIVIDUAL_BONUS.blue,
    },
    yellow: {
      count: Math.round(housingCount * dist.yellow),
      amount_per_housing: COPRO_INDIVIDUAL_BONUS.yellow,
      total: Math.round(housingCount * dist.yellow) * COPRO_INDIVIDUAL_BONUS.yellow,
    },
    violet: {
      count: Math.round(housingCount * dist.violet),
      amount_per_housing: COPRO_INDIVIDUAL_BONUS.violet,
      total: Math.round(housingCount * dist.violet) * COPRO_INDIVIDUAL_BONUS.violet,
    },
    rose: {
      count: Math.round(housingCount * dist.rose),
      amount_per_housing: COPRO_INDIVIDUAL_BONUS.rose,
      total: Math.round(housingCount * dist.rose) * COPRO_INDIVIDUAL_BONUS.rose,
    },
  };

  const totalIndividualBonus = breakdown.blue.total + breakdown.yellow.total + breakdown.violet.total + breakdown.rose.total;

  return {
    breakdown,
    total: totalIndividualBonus,
    distribution: dist,
  };
};

/**
 * Calcule les primes CEE pour copropriété
 * @param {Object} params - Paramètres
 * @returns {Object} - Montants CEE
 */
export const calculateCoproCEE = (params) => {
  const {
    postal_code,
    housing_count,
    work_type, // 'heating', 'insulation', etc.
  } = params;

  const zone = getClimateZone(postal_code);

  // Pour simplification, on prend le montant individuel × nombre de logements
  // En réalité, les CEE copropriété ont des calculs spécifiques selon les travaux
  const baseCEEPerHousing = 3000; // Montant forfaitaire simplifié

  return {
    zone: zone.toUpperCase(),
    per_housing: baseCEEPerHousing,
    total: baseCEEPerHousing * housing_count,
    note: 'Montant indicatif - CEE copropriété calculés selon travaux spécifiques',
  };
};

/**
 * Calcule le récapitulatif complet pour une copropriété
 * @param {Object} formData - Données du formulaire
 * @returns {Object} - Récapitulatif complet
 */
export const calculateFullCoproSubsidy = (formData) => {
  const {
    // Copropriété
    building_age,
    postal_code,
    housing_count,
    principal_residence_rate,

    // Travaux
    total_cost,
    energy_gain,
    work_categories,

    // Bonus
    has_exit_sieve,
    has_bbc_target,
    is_fragile,

    // Accompagnement
    has_accompaniment,
    accompaniment_cost,

    // Distribution copropriétaires (optionnel)
    distribution,
  } = formData;

  // 1. Validation éligibilité
  const eligibility = validateCoproEligibility({
    building_age,
    principal_residence_rate,
    energy_gain,
    has_accompaniment,
  });

  if (!eligibility.eligible) {
    return {
      eligible: false,
      reasons: eligibility.reasons,
    };
  }

  // 2. Aide de base (25%)
  const baseHelp = calculateCoproBaseHelp(total_cost, housing_count);

  // 3. Bonus collectifs
  const collectiveBonuses = calculateCoproCollectiveBonuses(
    total_cost,
    housing_count,
    {
      has_exit_sieve,
      has_bbc_target,
      is_fragile,
    }
  );

  // 4. Accompagnement
  const accompaniment = calculateCoproAccompaniment(housing_count);

  // 5. Aides individuelles copropriétaires
  const individualBonuses = calculateCoproIndividualBonuses(housing_count, distribution);

  // 6. CEE
  const cee = calculateCoproCEE({
    postal_code,
    housing_count,
    work_type: work_categories?.[0] || 'heating',
  });

  // 7. Totaux
  const totalCollective = baseHelp.amount + collectiveBonuses.total_amount;
  const totalWithIndividual = totalCollective + individualBonuses.total;
  const totalWithCEE = totalWithIndividual + cee.total;

  const totalRate = ((totalCollective / total_cost) * 100).toFixed(1);

  return {
    eligible: true,
    reasons: eligibility.reasons,

    // Détails
    base_help: baseHelp,
    collective_bonuses: collectiveBonuses,
    accompaniment,
    individual_bonuses: individualBonuses,
    cee,

    // Totaux
    total_collective: totalCollective,
    total_with_individual: totalWithIndividual,
    total_with_cee: totalWithCEE,
    total_rate: parseFloat(totalRate),

    // Par logement
    per_housing: {
      collective: totalCollective / housing_count,
      with_individual: totalWithIndividual / housing_count,
      with_cee: totalWithCEE / housing_count,
    },

    // Reste à charge
    remaining_cost: total_cost - totalWithCEE,
    remaining_per_housing: (total_cost - totalWithCEE) / housing_count,

    // Contexte
    housing_count,
    total_cost,
    climate_zone: cee.zone,
  };
};

export default {
  validateCoproEligibility,
  calculateCoproBaseHelp,
  calculateCoproCollectiveBonuses,
  calculateCoproAccompaniment,
  calculateCoproIndividualBonuses,
  calculateCoproCEE,
  calculateFullCoproSubsidy,
};
