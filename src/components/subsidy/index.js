// src/components/subsidy/index.js
// Point d'entrée pour le module de calcul de primes

// Composants
export { default as SubsidyModeSelector } from './SubsidyModeSelector';
export { default as SubsidyCalculator } from './SubsidyCalculator';
export { default as SubsidyResult } from './SubsidyResult';
export { default as SubsidyCoproCalculator } from './SubsidyCoproCalculator';
export { default as SubsidyCoproResult } from './SubsidyCoproResult';

// Calculs individuels
export {
  calculateFullSubsidy,
  calculateForProfile,
  validateTechnicalEligibility,
  calculateCEE,
  calculateMPR,
  applyCeiling,
} from '../../utils/subsidyCalculations';

// Calculs copropriété
export {
  calculateFullCoproSubsidy,
  validateCoproEligibility,
  calculateCoproBaseHelp,
  calculateCoproCollectiveBonuses,
  calculateCoproAccompaniment,
  calculateCoproIndividualBonuses,
  calculateCoproCEE,
} from '../../utils/subsidyCoproCalculations';

// Données individuels
export {
  getMPRCategory,
  getClimateZone,
  RESOURCE_THRESHOLDS,
  CEE_RATES,
  MPR_RATES,
  MPR_BONUSES,
  CEILING_RATES,
  REPLACEMENT_BONUSES,
  TECHNICAL_CRITERIA,
  LABELS,
} from '../../utils/subsidyData';

// Données copropriété
export {
  COPRO_BASE_RATE,
  COPRO_MAX_PER_HOUSING,
  COPRO_COLLECTIVE_BONUSES,
  COPRO_INDIVIDUAL_BONUS,
  COPRO_ACCOMPANIMENT,
  COPRO_ELIGIBILITY_CRITERIA,
  COPRO_ELIGIBLE_WORKS,
  COPRO_LABELS,
  COPRO_DISTRIBUTION_EXAMPLES,
  calculateCoproCeiling,
  getAccompanimentRate,
} from '../../utils/subsidyCoproData';
