// src/utils/subsidyCalculations.js
// Moteur de calcul des primes CEE et MaPrimeRénov'

import {
  CEE_RATES,
  MPR_RATES,
  MPR_BONUSES,
  CEILING_RATES,
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
 * Calcule le montant de la Prime Énergie (CEE)
 * @param {Object} params - Paramètres de calcul
 * @returns {Object} - Montants CEE par profil
 */
export const calculateCEE = (params) => {
  const {
    postal_code,
    usage,           // 'heating' ou 'heating_and_dhw'
    surface,         // Surface habitable (m²)
  } = params;

  const zone = getClimateZone(postal_code);
  const usageType = usage === 'heating_and_dhw' ? 'heating_and_dhw' : 'heating_only';

  const rates = CEE_RATES[usageType][zone];

  // Les montants CEE sont forfaitaires, pas proportionnels à la surface
  // (sauf si surface < 35m² où il peut y avoir décote, mais simplifié ici)

  return {
    very_modest: rates.base,
    modest: rates.moderate,
    classic: rates.classic,
    zone: zone.toUpperCase(),
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
  let baseMPR = {
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

  // Bonus remplacement
  const replacementBonus = REPLACEMENT_BONUSES[replacement_type] || 0;
  if (replacementBonus > 0) {
    bonuses.replacement = {
      blue: replacementBonus,
      yellow: replacementBonus,
      violet: replacementBonus,
      rose: replacementBonus,
    };
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
 * Applique l'écrêtement (plafond de cumul des aides)
 * @param {number} totalSubsidy - Total des aides (CEE + MPR)
 * @param {number} projectCost - Coût total du projet
 * @param {string} category - Catégorie MPR
 * @returns {Object} - Montants après écrêtement
 */
export const applyCeiling = (totalSubsidy, projectCost, category) => {
  const ceilingRate = CEILING_RATES[category];
  const maxAllowed = Math.min(projectCost * ceilingRate, MAX_ELIGIBLE_EXPENSE * ceilingRate);

  const capped = Math.min(totalSubsidy, maxAllowed);
  const reduction = totalSubsidy - capped;

  return {
    original: totalSubsidy,
    capped,
    reduction,
    ceiling_rate: ceilingRate * 100, // En %
    max_allowed: maxAllowed,
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
    usage,
    surface: heated_surface,
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
