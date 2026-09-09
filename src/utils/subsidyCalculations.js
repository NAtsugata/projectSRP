// src/utils/subsidyCalculations.js
// Moteur de calcul des primes CEE et MaPrimeRénov'

import {
  CEE_RATES,
  MPR_RATES,
  MPR_BONUSES,
  CEILING_RATES,
  CEILING_ABSOLUTE,
  MAX_ELIGIBLE_EXPENSE,
  REPLACEMENT_BONUSES,
  TECHNICAL_CRITERIA,
  getMPRCategory,
  getClimateZone,
  LABELS
} from './subsidyData';

/**
 * Valide l'éligibilité technique d'une PAC
 * @param {Object} pacSpecs - Spécifications de la PAC
 * @returns {Object} - { eligible: boolean, reasons: string[] }
 */
export const validateTechnicalEligibility = (pacSpecs) => {
  const {
    application_type,   // 'low_temp', 'medium_temp', 'high_temp'
    etas,              // Efficacité énergétique saisonnière (%)
    regulator_class,   // Classe du régulateur (IV à VIII)
    has_regulator      // Boolean
  } = pacSpecs;

  const reasons = [];

  // Vérifier le régulateur
  if (!has_regulator) {
    reasons.push('❌ Un régulateur est obligatoire');
  } else if (regulator_class < TECHNICAL_CRITERIA.regulator_class_min) {
    reasons.push(`❌ Classe de régulateur insuffisante (minimum IV, actuel: ${regulator_class})`);
  }

  // Vérifier ETAS minimum selon type d'application
  const minEtas = TECHNICAL_CRITERIA.etas_min[application_type] || 111;
  if (etas < minEtas) {
    reasons.push(`❌ ETAS insuffisant (minimum ${minEtas}%, actuel: ${etas}%)`);
  }

  // Vérifier l'ancienneté du bâtiment (doit être > 2 ans)
  if (pacSpecs.building_age === 'less_than_2') {
    reasons.push('❌ Le bâtiment doit avoir plus de 2 ans');
  }

  const eligible = reasons.length === 0;

  if (eligible) {
    reasons.push('✅ Critères techniques respectés');
  }

  return { eligible, reasons };
};

/**
 * Calcule le montant de la Prime Énergie (CEE) 2026
 * Selon BAR-TH-171 révisé au 01/01/2026
 * @param {Object} params - Paramètres de calcul
 * @returns {Object} - Montants CEE par profil
 */
export const calculateCEE = (params) => {
  const {
    postal_code,
    housing_type,    // 'house' ou 'apartment'
    surface,         // Surface habitable chauffée (m²)
  } = params;

  const zone = getClimateZone(postal_code);
  const type = housing_type === 'apartment' ? 'apartment' : 'house';

  // Déterminer la catégorie de surface
  let surfaceCategory;
  if (type === 'house') {
    if (surface < 70) surfaceCategory = 'small';
    else if (surface >= 70 && surface <= 90) surfaceCategory = 'medium';
    else surfaceCategory = 'large'; // > 90m²
  } else {
    // Apartment
    if (surface < 35) surfaceCategory = 'small';
    else if (surface >= 35 && surface <= 60) surfaceCategory = 'medium';
    else surfaceCategory = 'large'; // > 60m²
  }

  const rates = CEE_RATES[type][zone][surfaceCategory];

  return {
    very_modest: rates.very_modest, // Bleu + Jaune (Coup de pouce)
    modest: rates.very_modest,      // Même montant pour Jaune
    classic: rates.classic,         // Violet + Rose (CEE classique)
    zone: zone.toUpperCase(),
    surface_category: surfaceCategory,
    housing_type: type,
  };
};

/**
 * Calcule le montant MaPrimeRénov'
 * @param {Object} params - Paramètres
 * @returns {Object} - Montants MPR par catégorie
 */
export const calculateMPR = (params) => {
  const {
    rfr,              // Revenu fiscal de référence
    household_size,   // Nombre de personnes
    postal_code,
    has_exit_sieve,   // Boolean - Sortie de passoire (F/G → D minimum)
    has_bbc_target,   // Boolean - Objectif BBC (A ou B)
    replacement_type, // Type de système remplacé
  } = params;

  const category = getMPRCategory(rfr || 0, household_size || 1, postal_code);

  // Montant de base
  const baseMPR = {
    blue: MPR_RATES.blue,
    yellow: MPR_RATES.yellow,
    violet: MPR_RATES.violet,
    rose: MPR_RATES.rose,
  };

  // Ajouter les bonus
  const bonuses = {};

  if (has_exit_sieve) {
    bonuses.exit_sieve = {
      blue: MPR_BONUSES.exit_energy_sieve.blue,
      yellow: MPR_BONUSES.exit_energy_sieve.yellow,
      violet: MPR_BONUSES.exit_energy_sieve.violet,
      rose: MPR_BONUSES.exit_energy_sieve.rose,
    };
  }

  if (has_bbc_target) {
    bonuses.bbc = {
      blue: MPR_BONUSES.bbc.blue,
      yellow: MPR_BONUSES.bbc.yellow,
      violet: MPR_BONUSES.bbc.violet,
      rose: MPR_BONUSES.bbc.rose,
    };
  }

  // Bonus remplacement (varie selon le profil)
  const replacementBonuses = REPLACEMENT_BONUSES[replacement_type] || REPLACEMENT_BONUSES.none;
  if (replacementBonuses.blue > 0 || replacementBonuses.yellow > 0 || replacementBonuses.violet > 0) {
    bonuses.replacement = replacementBonuses;
  }

  // Calculer les totaux
  const totals = {};
  ['blue', 'yellow', 'violet', 'rose'].forEach(cat => {
    let total = baseMPR[cat];
    Object.values(bonuses).forEach(bonus => {
      total += bonus[cat] || 0;
    });
    totals[cat] = total;
  });

  return {
    base: baseMPR,
    bonuses,
    totals,
    category,
  };
};

/**
 * Applique l'écrêtement 2026 (plafond de cumul des aides)
 * Double plafond : absolu ET % du coût
 * @param {number} totalSubsidy - Total des aides (CEE + MPR + Bonus)
 * @param {number} projectCost - Coût total du projet
 * @param {string} category - Catégorie MPR
 * @returns {Object} - Montants après écrêtement
 */
export const applyCeiling = (totalSubsidy, projectCost, category) => {
  // Plafond 1 : Montant absolu maximum
  const absoluteCeiling = CEILING_ABSOLUTE[category];

  // Plafond 2 : % du coût du projet
  const ceilingRate = CEILING_RATES[category];
  const percentCeiling = projectCost * ceilingRate;

  // Prendre le minimum des deux plafonds
  const maxAllowed = Math.min(absoluteCeiling, percentCeiling);

  const capped = Math.min(totalSubsidy, maxAllowed);
  const reduction = totalSubsidy - capped;
  const isCapped = reduction > 0;

  return {
    original: totalSubsidy,
    capped,
    reduction,
    is_capped: isCapped,
    ceiling_rate: ceilingRate * 100, // En %
    absolute_ceiling: absoluteCeiling,
    percent_ceiling: percentCeiling,
    max_allowed: maxAllowed,
    capping_reason: isCapped
      ? maxAllowed === absoluteCeiling
        ? `Plafond absolu ${category.toUpperCase()} (${absoluteCeiling}€)`
        : `${ceilingRate * 100}% du coût des travaux`
      : null,
  };
};

/**
 * Calcule le récapitulatif complet des aides
 * @param {Object} formData - Données du formulaire
 * @returns {Object} - Récapitulatif complet avec tous les scénarios
 */
export const calculateFullSubsidy = (formData) => {
  const {
    // Identité
    applicant_type,      // 'tenant' | 'owner'
    entity_type,         // 'individual' | 'company'

    // Bâtiment
    building_age,        // 'less_than_2' | '2_to_15' | 'more_than_15'
    postal_code,
    heated_surface,

    // PAC
    application_type,    // 'low_temp' | 'medium_temp' | 'high_temp'
    usage,              // 'heating' | 'heating_and_dhw' | 'other'
    has_regulator,
    regulator_class,    // 4 à 8 (IV à VIII)
    etas,               // %
    thermal_power,      // kW
    starting_intensity, // 'mono_45A' | 'tri_60A' | 'other'

    // Configuration
    has_other_heating,
    emitter_type,       // 'radiant' | 'mixed' | 'other'
    has_dhw_system,
    dhw_consumes_energy,
    dhw_has_backup,

    // Contexte
    replacement_type,   // 'coal' | 'fuel' | 'gas' | 'electric' | 'none'
    has_exit_sieve,     // Sortie de passoire
    has_bbc_target,     // Objectif BBC

    // Financier
    project_cost,       // Coût total du projet
    rfr,                // Revenu fiscal de référence (optionnel)
    household_size,     // Taille du foyer (optionnel)
  } = formData;

  // 1. Validation technique
  const eligibility = validateTechnicalEligibility({
    application_type,
    etas,
    regulator_class,
    has_regulator,
    building_age,
  });

  if (!eligibility.eligible) {
    return {
      eligible: false,
      reasons: eligibility.reasons,
      scenarios: [],
    };
  }

  // 2. Calcul CEE
  const ceeAmounts = calculateCEE({
    postal_code,
    housing_type: formData.housing_type || 'house', // 'house' ou 'apartment'
    surface: heated_surface || 90, // Surface par défaut si non fournie
  });

  // 3. Calcul MPR
  const mprAmounts = calculateMPR({
    rfr,
    household_size,
    postal_code,
    has_exit_sieve,
    has_bbc_target,
    replacement_type,
  });

  // 4. Créer les 4 scénarios possibles
  const scenarios = [
    {
      id: 'very_modest',
      label: 'Prime Énergie Très modeste',
      mpr_category: 'blue',
      mpr_label: LABELS.categories.blue,
      cee: ceeAmounts.very_modest,
      mpr: mprAmounts.totals.blue,
      total_before_ceiling: ceeAmounts.very_modest + mprAmounts.totals.blue,
    },
    {
      id: 'modest',
      label: 'Prime Énergie Modeste',
      mpr_category: 'yellow',
      mpr_label: LABELS.categories.yellow,
      cee: ceeAmounts.modest,
      mpr: mprAmounts.totals.yellow,
      total_before_ceiling: ceeAmounts.modest + mprAmounts.totals.yellow,
    },
    {
      id: 'classic',
      label: 'Prime Énergie Classique',
      mpr_category: 'violet',
      mpr_label: LABELS.categories.violet,
      cee: ceeAmounts.classic,
      mpr: mprAmounts.totals.violet,
      total_before_ceiling: ceeAmounts.classic + mprAmounts.totals.violet,
    },
    {
      id: 'high_income',
      label: 'Prime Énergie Classique',
      mpr_category: 'rose',
      mpr_label: LABELS.categories.rose,
      cee: ceeAmounts.classic,
      mpr: mprAmounts.totals.rose,
      total_before_ceiling: ceeAmounts.classic + mprAmounts.totals.rose,
    }
  ];

  // 5. Appliquer l'écrêtement pour chaque scénario
  scenarios.forEach(scenario => {
    const ceiling = applyCeiling(
      scenario.total_before_ceiling,
      project_cost || MAX_ELIGIBLE_EXPENSE,
      scenario.mpr_category
    );

    scenario.ceiling = ceiling;
    scenario.total_after_ceiling = ceiling.capped;
    scenario.ceiling_rate = ceiling.ceiling_rate;
  });

  // 6. Déterminer le scénario recommandé basé sur RFR/household
  let recommended_scenario = null;
  if (rfr && household_size) {
    const category = mprAmounts.category;
    recommended_scenario = scenarios.find(s => s.mpr_category === category);
  }

  return {
    eligible: true,
    reasons: eligibility.reasons,
    climate_zone: ceeAmounts.zone,
    scenarios,
    recommended_scenario,
    mpr_details: mprAmounts,
    project_cost: project_cost || MAX_ELIGIBLE_EXPENSE,
  };
};

/**
 * Calcule uniquement pour un profil donné
 * @param {Object} formData - Données du formulaire
 * @param {string} profile - 'very_modest' | 'modest' | 'classic' | 'high_income'
 * @returns {Object} - Détails du calcul pour ce profil
 */
export const calculateForProfile = (formData, profile = 'classic') => {
  const fullResult = calculateFullSubsidy(formData);

  if (!fullResult.eligible) {
    return fullResult;
  }

  const scenario = fullResult.scenarios.find(s => s.id === profile);

  return {
    ...fullResult,
    selected_scenario: scenario,
  };
};

export default {
  validateTechnicalEligibility,
  calculateCEE,
  calculateMPR,
  applyCeiling,
  calculateFullSubsidy,
  calculateForProfile,
};
