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
 * Barèmes Prime Énergie (CEE) 2026 pour PAC air/eau
 * Basés sur BAR-TH-171 révisé au 01/01/2026
 * Montants en € selon zone climatique, surface et niveau de revenus
 *
 * IMPORTANT : Forfaits moyens estimés
 * En réalité, le montant exact dépend du calcul kWh cumac × prix CEE
 * Hypothèses : ETAS > 140%, Prix CEE Précarité ~11€/MWhc, Classique ~7.8€/MWhc
 */
export const CEE_RATES = {
  // Maisons individuelles
  house: {
    h1: {
      // Zone H1 (Nord, Est) - climat froid
      small: {
        // < 70 m²
        very_modest: 3500,  // Bleu + Jaune (Coup de pouce × 5)
        classic: 2200,      // Violet + Rose (CEE classique)
      },
      medium: {
        // 70-90 m²
        very_modest: 4400,
        classic: 2750,
      },
      large: {
        // > 90 m²
        very_modest: 5300,
        classic: 3300,
      },
    },
    h2: {
      // Zone H2 (Ouest, Centre)
      small: {
        very_modest: 3200,
        classic: 2000,
      },
      medium: {
        very_modest: 4000,
        classic: 2500,
      },
      large: {
        very_modest: 4800,
        classic: 3000,
      },
    },
    h3: {
      // Zone H3 (Sud, Méditerranée)
      small: {
        very_modest: 2600,
        classic: 1600,
      },
      medium: {
        very_modest: 3200,
        classic: 2000,
      },
      large: {
        very_modest: 3800,
        classic: 2400,
      },
    },
  },
  // Appartements
  apartment: {
    h1: {
      small: {
        // < 35 m²
        very_modest: 2200,
        classic: 1400,
      },
      medium: {
        // 35-60 m²
        very_modest: 3000,
        classic: 1900,
      },
      large: {
        // > 60 m²
        very_modest: 4000,
        classic: 2500,
      },
    },
    h2: {
      small: {
        very_modest: 2000,
        classic: 1250,
      },
      medium: {
        very_modest: 2700,
        classic: 1700,
      },
      large: {
        very_modest: 3600,
        classic: 2250,
      },
    },
    h3: {
      small: {
        very_modest: 1600,
        classic: 1000,
      },
      medium: {
        very_modest: 2200,
        classic: 1400,
      },
      large: {
        very_modest: 2900,
        classic: 1800,
      },
    },
  },
};

/**
 * Détermination de la zone climatique selon code postal
 * @param {string} postalCode - Code postal
 * @returns {string} - 'h1', 'h2', 'h3'
 */
export const getClimateZone = (postalCode) => {
  const dept = String(postalCode || '').substring(0, 2);

  // Zone H1 (Nord, Est, Île-de-France, Rhône-Alpes, Massif Central)
  // Liste officielle RT2012 / fiches CEE
  const h1Depts = [
    '01', '02', '03', '05', '08', '10', '14', '15', '19', '21', '23', '25',
    '27', '28', '38', '39', '42', '43', '45', '51', '52', '54', '55', '57',
    '58', '59', '60', '61', '62', '63', '67', '68', '69', '70', '71', '73',
    '74', '75', '76', '77', '78', '80', '87', '88', '89', '90', '91', '92',
    '93', '94', '95',
  ];

  // Zone H3 (Méditerranée) — les codes postaux corses commencent par 20
  const h3Depts = ['06', '11', '13', '20', '30', '34', '66', '83', '84'];

  if (h1Depts.includes(dept)) return 'h1';
  if (h3Depts.includes(dept)) return 'h3';
  return 'h2'; // Ouest / Sud-Ouest / Centre-Ouest
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
 * Plafonds d'écrêtement 2026 (montants absolus maximum)
 * Montant maximum total des aides cumulées (CEE + MaPrimeRénov' + Bonus)
 */
export const CEILING_ABSOLUTE = {
  blue: 10800,     // 10 800€ maximum total
  yellow: 9000,    // 9 000€ maximum total
  violet: 7200,    // 7 200€ maximum total
  rose: 4800,      // 4 800€ maximum total (si éligible)
};

/**
 * Taux d'écrêtement alternatifs (% du coût des travaux)
 * Utilisé si le plafond absolu n'est pas atteint
 */
export const CEILING_RATES = {
  blue: 0.90,      // 90% max du coût
  yellow: 0.75,    // 75% max du coût
  violet: 0.60,    // 60% max du coût
  rose: 0.40,      // 40% max du coût
};

/**
 * Dépense éligible maximum pour une PAC air/eau
 */
export const MAX_ELIGIBLE_EXPENSE = 12000; // €

/**
 * Bonus de remplacement d'ancien système
 * Montants supplémentaires selon type de chauffage remplacé
 * Barèmes 2026 officiels
 */
export const REPLACEMENT_BONUSES = {
  coal: {
    // Charbon
    blue: 800,
    yellow: 800,
    violet: 400,
    rose: 0,
  },
  fuel: {
    // Fioul
    blue: 1200,
    yellow: 800,
    violet: 400,
    rose: 0,
  },
  gas: {
    // Gaz
    blue: 400,
    yellow: 400,
    violet: 0,
    rose: 0,
  },
  electric: {
    // Électrique (convecteurs)
    blue: 0,
    yellow: 0,
    violet: 0,
    rose: 0,
  },
  none: {
    // Pas de remplacement
    blue: 0,
    yellow: 0,
    violet: 0,
    rose: 0,
  },
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
  CEILING_ABSOLUTE,
  MAX_ELIGIBLE_EXPENSE,
  REPLACEMENT_BONUSES,
  TECHNICAL_CRITERIA,
  LABELS
};
