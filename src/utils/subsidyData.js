// src/utils/subsidyData.js
// Données de référence pour le calcul des primes CEE et MaPrimeRénov'

/**
 * Plafonds de ressources MaPrimeRénov' 2026
 * Selon revenus fiscaux de référence (RFR)
 */
export const RESOURCE_THRESHOLDS = {
  // Île-de-France
  idf: {
    blue: [23541, 34551, 41493, 48447, 55427],      // Très modeste
    yellow: [28657, 42058, 50513, 58981, 67473],    // Modeste
    violet: [40018, 58827, 70382, 82839, 94844],    // Intermédiaire
    // Rose : au-dessus de Violet
  },
  // Autres régions
  other: {
    blue: [17009, 24875, 29917, 34948, 40002],
    yellow: [21805, 31889, 38349, 44802, 51281],
    violet: [30549, 44907, 54071, 63235, 72400],
    // Rose : au-dessus de Violet
  }
};

/**
 * Détermine la catégorie MaPrimeRénov' selon RFR et composition du foyer
 * @param {number} rfr - Revenu fiscal de référence
 * @param {number} household - Nombre de personnes dans le foyer
 * @param {string} postalCode - Code postal (pour déterminer IDF/Autre)
 * @returns {string} - 'blue', 'yellow', 'violet', 'rose'
 */
export const getMPRCategory = (rfr, household, postalCode) => {
  const isIDF = ['75', '77', '78', '91', '92', '93', '94', '95'].includes(postalCode.substring(0, 2));
  const thresholds = isIDF ? RESOURCE_THRESHOLDS.idf : RESOURCE_THRESHOLDS.other;

  const index = Math.min(household - 1, 4); // Max 5 personnes dans le tableau

  if (rfr <= thresholds.blue[index]) return 'blue';
  if (rfr <= thresholds.yellow[index]) return 'yellow';
  if (rfr <= thresholds.violet[index]) return 'violet';
  return 'rose';
};

/**
 * Barèmes Prime Énergie (CEE) pour PAC air/eau
 * Montants en € selon zone climatique et surface
 */
export const CEE_RATES = {
  // Zones climatiques H1, H2, H3
  heating_only: {
    // Zone H1 (Nord, Est)
    h1: {
      base: 3636,      // Très modeste
      moderate: 3181.5, // Modeste
      classic: 3181.5,  // Classique
    },
    // Zone H2 (Ouest, Centre)
    h2: {
      base: 3300,
      moderate: 2887.5,
      classic: 2887.5,
    },
    // Zone H3 (Sud, Méditerranée)
    h3: {
      base: 2700,
      moderate: 2362.5,
      classic: 2362.5,
    }
  },
  heating_and_dhw: {
    // Chauffage + Eau chaude sanitaire
    h1: {
      base: 4545,
      moderate: 3977,
      classic: 3977,
    },
    h2: {
      base: 4125,
      moderate: 3609,
      classic: 3609,
    },
    h3: {
      base: 3375,
      moderate: 2953,
      classic: 2953,
    }
  }
};

/**
 * Détermination de la zone climatique selon code postal
 * @param {string} postalCode - Code postal
 * @returns {string} - 'h1', 'h2', 'h3'
 */
export const getClimateZone = (postalCode) => {
  const dept = postalCode.substring(0, 2);

  // Zone H1 (Nord, Est) - Départements les plus froids
  const h1Depts = ['02', '08', '10', '14', '25', '27', '39', '50', '51', '52', '54', '55', '57', '58', '59', '60', '61', '62', '67', '68', '70', '76', '80', '88', '89', '90'];

  // Zone H3 (Sud, Méditerranée) - Départements les plus chauds
  const h3Depts = ['04', '05', '06', '11', '13', '2A', '2B', '30', '34', '48', '66', '83', '84'];

  if (h1Depts.includes(dept)) return 'h1';
  if (h3Depts.includes(dept)) return 'h3';
  return 'h2'; // Par défaut : zone H2
};

/**
 * Barèmes MaPrimeRénov' pour PAC air/eau
 * Montants en € selon catégorie de revenus
 */
export const MPR_RATES = {
  blue: 5000,      // Bleu (Très modeste)
  yellow: 4000,    // Jaune (Modeste)
  violet: 3000,    // Violet (Intermédiaire)
  rose: 0,         // Rose (Supérieur) - pas d'aide pour PAC seule
};

/**
 * Bonus MaPrimeRénov' supplémentaires
 */
export const MPR_BONUSES = {
  // Bonus sortie de passoire énergétique (étiquette F ou G)
  exit_energy_sieve: {
    blue: 500,
    yellow: 500,
    violet: 500,
    rose: 0,
  },
  // Bonus BBC (Bâtiment Basse Consommation) - Objectif étiquette A ou B
  bbc: {
    blue: 500,
    yellow: 500,
    violet: 500,
    rose: 0,
  },
  // Bonus accompagnement (Mon Accompagnateur Rénov')
  accompaniment: {
    blue: 0, // Déjà inclus dans le forfait
    yellow: 0,
    violet: 0,
    rose: 0,
  }
};

/**
 * Taux d'écrêtement (plafond de cumul des aides)
 * % maximum de la dépense éligible pouvant être couvert par les aides
 */
export const CEILING_RATES = {
  blue: 0.90,      // 90% max
  yellow: 0.75,    // 75% max
  violet: 0.60,    // 60% max
  rose: 0.40,      // 40% max
};

/**
 * Dépense éligible maximum pour une PAC air/eau
 */
export const MAX_ELIGIBLE_EXPENSE = 12000; // €

/**
 * Bonus de remplacement d'ancien système
 * Montants supplémentaires selon type de chauffage remplacé
 */
export const REPLACEMENT_BONUSES = {
  coal: 800,      // Charbon
  fuel: 1200,     // Fioul
  gas: 400,       // Gaz
  electric: 200,  // Électrique (convecteurs)
  none: 0         // Pas de remplacement
};

/**
 * Critères d'éligibilité technique PAC air/eau
 */
export const TECHNICAL_CRITERIA = {
  etas_min: {
    low_temp: 126,      // Basse température
    medium_temp: 111,   // Moyenne température
    high_temp: 111,     // Haute température
  },
  regulator_class_min: 4, // Classe IV minimum
  certifications_required: ['NF PAC', 'Eurovent', 'CE'],
};

/**
 * Labels et noms affichables
 */
export const LABELS = {
  categories: {
    blue: 'MaPrimeRénov\' Bleu (Très modeste)',
    yellow: 'MaPrimeRénov\' Jaune (Modeste)',
    violet: 'MaPrimeRénov\' Violet (Intermédiaire)',
    rose: 'MaPrimeRénov\' Rose (Supérieur)',
  },
  cee_profiles: {
    very_modest: 'Prime Énergie Très modeste',
    modest: 'Prime Énergie Modeste',
    classic: 'Prime Énergie Classique',
  }
};

export default {
  RESOURCE_THRESHOLDS,
  getMPRCategory,
  CEE_RATES,
  getClimateZone,
  MPR_RATES,
  MPR_BONUSES,
  CEILING_RATES,
  MAX_ELIGIBLE_EXPENSE,
  REPLACEMENT_BONUSES,
  TECHNICAL_CRITERIA,
  LABELS
};
