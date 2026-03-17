/**
 * ============================================================
 * BARÈMES OFFICIELS DES AIDES 2026
 * ============================================================
 * Sources:
 * - MaPrimeRénov': https://www.economie.gouv.fr/particuliers/maprimerenov
 * - CEE/Coup de pouce: https://www.ecologie.gouv.fr/dispositif-des-certificats-deconomies-denergie
 * - Dernière mise à jour: Mars 2026
 * ============================================================
 */

// ============================================================
// PLAFONDS DE REVENUS MaPrimeRénov' 2026
// ============================================================

/**
 * Plafonds de revenus fiscaux de référence (RFR)
 * Basés sur le RFR de l'année N-1 (2025 pour demandes 2026)
 */
export const PLAFONDS_REVENUS = {
  // Île-de-France
  IDF: {
    BLEU: [23541, 34551, 41493, 48447, 55427],     // Très modestes
    JAUNE: [28657, 42058, 50513, 58981, 67473],    // Modestes
    VIOLET: [40018, 58827, 70382, 81978, 93623],   // Intermédiaires
    ROSE: [Infinity, Infinity, Infinity, Infinity, Infinity] // Supérieurs (au-delà de Violet)
  },
  // Hors Île-de-France
  HORS_IDF: {
    BLEU: [17009, 24875, 29917, 34948, 40002],     // Très modestes
    JAUNE: [21805, 31889, 38349, 44802, 51281],    // Modestes
    VIOLET: [30549, 44907, 54071, 63235, 72400],   // Intermédiaires
    ROSE: [Infinity, Infinity, Infinity, Infinity, Infinity] // Supérieurs
  }
};

/**
 * Labels pour chaque catégorie
 */
export const CATEGORIES_LABELS = {
  BLEU: 'Très modestes (Bleu)',
  JAUNE: 'Modestes (Jaune)',
  VIOLET: 'Intermédiaires (Violet)',
  ROSE: 'Supérieurs (Rose)'
};

// ============================================================
// MONTANTS MaPrimeRénov' 2026 - POMPES À CHALEUR
// ============================================================

/**
 * Montants des aides MaPrimeRénov' selon le type de PAC et la catégorie
 * Mis à jour pour 2026
 */
export const MAPRIMERENOV_PAC = {
  // Pompe à chaleur Air/Eau
  AIR_EAU: {
    BLEU: 5000,    // Très modestes
    JAUNE: 4000,   // Modestes
    VIOLET: 3000,  // Intermédiaires
    ROSE: 0        // Non éligible
  },
  // Pompe à chaleur Géothermique ou Eau/Eau
  GEOTHERMIQUE: {
    BLEU: 11000,   // Très modestes
    JAUNE: 9000,   // Modestes
    VIOLET: 6000,  // Intermédiaires
    ROSE: 0        // Non éligible
  },
  // Pompe à chaleur Air/Air - NON ÉLIGIBLE à MaPrimeRénov'
  AIR_AIR: {
    BLEU: 0,
    JAUNE: 0,
    VIOLET: 0,
    ROSE: 0
  }
};

/**
 * Plafonds de dépenses éligibles MaPrimeRénov'
 */
export const PLAFONDS_DEPENSES_MPR = {
  AIR_EAU: 12000,
  GEOTHERMIQUE: 18000,
  AIR_AIR: 0
};

// ============================================================
// CEE (Certificats d'Économies d'Énergie) 2026
// ============================================================

/**
 * Prime CEE standard (avant bonification Coup de Pouce)
 * Montants moyens indicatifs selon zone climatique H1
 */
export const CEE_STANDARD = {
  AIR_EAU: {
    BASE: 500,  // Montant de base
    PAR_M2: 10  // Par m² chauffé (plafonné à 100 m²)
  },
  GEOTHERMIQUE: {
    BASE: 800,
    PAR_M2: 15
  },
  AIR_AIR: {
    BASE: 0,    // Non éligible
    PAR_M2: 0
  }
};

/**
 * Bonifications "Coup de Pouce Chauffage" 2026
 * Prolongé jusqu'au 31/12/2026
 */
export const COUP_DE_POUCE_BONIFICATION = {
  AIR_EAU: 3,        // Multiplication par 3
  GEOTHERMIQUE: 5,   // Multiplication par 5
  AIR_AIR: 0         // Non éligible
};

/**
 * Montants Coup de Pouce selon revenus (modestes vs autres)
 * Valeurs pour remplacement chaudière gaz/fioul par PAC
 */
export const COUP_DE_POUCE_MONTANTS = {
  AIR_EAU: {
    MODESTE: 5000,      // Revenus modestes (Bleu + Jaune)
    AUTRE: 4000         // Autres revenus (Violet + Rose)
  },
  GEOTHERMIQUE: {
    MODESTE: 5000,
    AUTRE: 4000
  },
  AIR_AIR: {
    MODESTE: 0,
    AUTRE: 0
  }
};

// ============================================================
// CONDITIONS D'ÉLIGIBILITÉ
// ============================================================

/**
 * Conditions pour MaPrimeRénov'
 */
export const CONDITIONS_MPR = {
  anciennete_logement: 15,  // ans minimum
  residence_principale: true,
  rge_obligatoire: true,
  proprietaire: true
};

/**
 * Conditions pour CEE/Coup de Pouce
 */
export const CONDITIONS_CEE = {
  remplacement_chauffage: true,  // Doit remplacer un ancien système
  rge_obligatoire: true,
  delai_travaux: {
    debut_avant: '2026-12-31',
    fin_avant: '2027-12-31'
  }
};

/**
 * Performances minimales requises (ETAS = Efficacité Énergétique Saisonnière)
 */
export const PERFORMANCES_MINIMALES = {
  AIR_EAU: {
    ETAS_MIN: 111,      // %
    ETAS_OPTIMAL: 140   // % pour bonus maximal
  },
  GEOTHERMIQUE: {
    ETAS_MIN: 126,
    ETAS_OPTIMAL: 150
  }
};

// ============================================================
// FONCTIONS DE CALCUL
// ============================================================

/**
 * Détermine la catégorie de revenus d'un ménage
 * @param {number} rfr - Revenu Fiscal de Référence
 * @param {number} nbPersonnes - Nombre de personnes (1-5+)
 * @param {boolean} isIDF - True si Île-de-France
 * @returns {string} 'BLEU', 'JAUNE', 'VIOLET', ou 'ROSE'
 */
export function determinerCategorie(rfr, nbPersonnes, isIDF = false) {
  const plafonds = isIDF ? PLAFONDS_REVENUS.IDF : PLAFONDS_REVENUS.HORS_IDF;
  const index = Math.min(nbPersonnes - 1, 4); // Max 5 personnes dans le tableau

  if (rfr <= plafonds.BLEU[index]) return 'BLEU';
  if (rfr <= plafonds.JAUNE[index]) return 'JAUNE';
  if (rfr <= plafonds.VIOLET[index]) return 'VIOLET';
  return 'ROSE';
}

/**
 * Vérifie si le ménage est considéré "modeste" pour le Coup de Pouce
 * @param {string} categorie - 'BLEU', 'JAUNE', 'VIOLET', ou 'ROSE'
 * @returns {boolean}
 */
export function estModeste(categorie) {
  return categorie === 'BLEU' || categorie === 'JAUNE';
}

/**
 * Calcule le montant MaPrimeRénov' pour une PAC
 * @param {string} typePAC - 'AIR_EAU', 'GEOTHERMIQUE', ou 'AIR_AIR'
 * @param {string} categorie - 'BLEU', 'JAUNE', 'VIOLET', ou 'ROSE'
 * @returns {number} Montant en euros
 */
export function calculerMaPrimeRenov(typePAC, categorie) {
  return MAPRIMERENOV_PAC[typePAC]?.[categorie] || 0;
}

/**
 * Calcule le montant CEE + Coup de Pouce
 * @param {string} typePAC - 'AIR_EAU', 'GEOTHERMIQUE', ou 'AIR_AIR'
 * @param {string} categorie - Catégorie de revenus
 * @param {number} surfaceChauffee - Surface en m² (plafonné à 100)
 * @param {boolean} avecCoupDePouce - Activer le Coup de Pouce
 * @returns {number} Montant en euros
 */
export function calculerCEE(typePAC, categorie, surfaceChauffee = 100, avecCoupDePouce = true) {
  // Si Coup de Pouce activé, utiliser les montants forfaitaires
  if (avecCoupDePouce && COUP_DE_POUCE_MONTANTS[typePAC]) {
    const modeste = estModeste(categorie);
    return modeste
      ? COUP_DE_POUCE_MONTANTS[typePAC].MODESTE
      : COUP_DE_POUCE_MONTANTS[typePAC].AUTRE;
  }

  // Sinon calcul CEE standard
  const surface = Math.min(surfaceChauffee, 100); // Plafonné à 100 m²
  const cee = CEE_STANDARD[typePAC];
  if (!cee) return 0;

  return cee.BASE + (cee.PAR_M2 * surface);
}

/**
 * Calcule le total des aides disponibles
 * @param {Object} params - Paramètres du calcul
 * @returns {Object} Détail des aides
 */
export function calculerTotalAides(params) {
  const {
    typePAC,
    rfr,
    nbPersonnes,
    isIDF,
    surfaceChauffee = 100,
    avecCoupDePouce = true,
    ancienneteLogement = 15
  } = params;

  // Déterminer la catégorie
  const categorie = determinerCategorie(rfr, nbPersonnes, isIDF);

  // Calculer chaque aide
  const mpr = ancienneteLogement >= CONDITIONS_MPR.anciennete_logement
    ? calculerMaPrimeRenov(typePAC, categorie)
    : 0;

  const cee = calculerCEE(typePAC, categorie, surfaceChauffee, avecCoupDePouce);

  // Total
  const total = mpr + cee;

  return {
    categorie,
    categorieLabel: CATEGORIES_LABELS[categorie],
    aides: {
      maPrimeRenov: mpr,
      cee: cee,
      total: total
    },
    plafondDepenses: PLAFONDS_DEPENSES_MPR[typePAC] || 0,
    tauxAide: total > 0 && params.montantTravaux
      ? Math.round((total / params.montantTravaux) * 100)
      : 0
  };
}

// ============================================================
// EXPORT PAR DÉFAUT
// ============================================================

export default {
  PLAFONDS_REVENUS,
  CATEGORIES_LABELS,
  MAPRIMERENOV_PAC,
  COUP_DE_POUCE_MONTANTS,
  determinerCategorie,
  calculerMaPrimeRenov,
  calculerCEE,
  calculerTotalAides
};
