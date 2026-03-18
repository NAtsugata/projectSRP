// src/components/subsidy/index.js
// Point d'entrée pour le module de calcul de primes

export { default as SubsidyCalculator } from './SubsidyCalculator';
export { default as SubsidyResult } from './SubsidyResult';

export {
  calculateFullSubsidy,
  calculateForProfile,
  validateTechnicalEligibility,
  calculateCEE,
  calculateMPR,
  applyCeiling,
} from '../../utils/subsidyCalculations';

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
