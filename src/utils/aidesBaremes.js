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

// ============================================================
// AIDES COMPLÉMENTAIRES 2026
// ============================================================

/**
 * ÉCO-PTZ (Prêt à Taux Zéro)
 * Prêt sans intérêts pour financer le reste à charge
 */
export const ECO_PTZ = {
  MONTANTS: {
    UN_POSTE: 15000,      // 1 poste de travaux
    DEUX_POSTES: 25000,   // 2 postes de travaux
    TROIS_POSTES: 30000,  // 3 postes et plus
    RENOVATION_GLOBALE: 50000  // Rénovation d'ampleur
  },
  DUREE_MAX: 15, // ans
  CONDITIONS: {
    sans_plafond_revenus: true,
    anciennete_logement: 2, // ans minimum
    residence_principale: true,
    prolonge_jusqua: '2027-12-31'
  }
};

/**
 * Calcule le montant éco-PTZ disponible
 * @param {number} resteACharge - Reste à charge après autres aides
 * @param {number} nbPostes - Nombre de postes de travaux (1-3+)
 * @returns {number} Montant du prêt disponible
 */
export function calculerEcoPTZ(resteACharge, nbPostes = 1) {
  let plafond = ECO_PTZ.MONTANTS.UN_POSTE;

  if (nbPostes >= 3) {
    plafond = ECO_PTZ.MONTANTS.TROIS_POSTES;
  } else if (nbPostes === 2) {
    plafond = ECO_PTZ.MONTANTS.DEUX_POSTES;
  }

  // Le prêt ne peut pas dépasser le reste à charge ni le plafond
  return Math.min(resteACharge, plafond);
}

/**
 * TVA RÉDUITE à 5.5%
 * Économie fiscale automatique sur les travaux éligibles
 */
export const TVA_REDUITE = {
  TAUX_NORMAL: 20,      // %
  TAUX_REDUIT: 5.5,     // %
  ECONOMIE: 14.5,       // % d'économie
  CONDITIONS: {
    anciennete_logement: 2, // ans minimum
    residence_principale_ou_secondaire: true,
    pac_air_air_exclue: true, // PAC Air/Air NON éligible
    artisan_rge_obligatoire: true
  }
};

/**
 * Calcule l'économie de TVA
 * @param {number} montantHT - Montant HT des travaux
 * @param {string} typePAC - Type de PAC
 * @returns {Object} Économie et montants TTC
 */
export function calculerEconomieTVA(montantHT, typePAC) {
  // PAC Air/Air non éligible à la TVA réduite
  if (typePAC === 'AIR_AIR') {
    return {
      tvaAppliquee: TVA_REDUITE.TAUX_NORMAL,
      montantTTC: montantHT * (1 + TVA_REDUITE.TAUX_NORMAL / 100),
      economie: 0
    };
  }

  const montantTTC_Normal = montantHT * (1 + TVA_REDUITE.TAUX_NORMAL / 100);
  const montantTTC_Reduit = montantHT * (1 + TVA_REDUITE.TAUX_REDUIT / 100);
  const economie = montantTTC_Normal - montantTTC_Reduit;

  return {
    tvaAppliquee: TVA_REDUITE.TAUX_REDUIT,
    montantTTC: montantTTC_Reduit,
    economie: economie
  };
}

/**
 * MaPrimeRénov' COPROPRIÉTÉ
 * Pour travaux en parties communes
 */
export const MAPRIMERENOV_COPRO = {
  // Taux selon gain énergétique
  TAUX_30: 0.30,  // Gain ≥ 35%
  TAUX_45: 0.45,  // Gain ≥ 50%

  // Plafonds
  PLAFOND_PAR_LOGEMENT: 25000, // € HT par logement

  // Bonus
  BONUS_SORTIE_PASSOIRE: 0.10,  // +10% si sortie F/G
  BONUS_COPRO_FRAGILE: 0.20,    // +20% si impayés ≥ 8%

  // Primes individuelles
  PRIME_MODESTE: 1500,          // € pour revenus modestes
  PRIME_TRES_MODESTE: 3000,     // € pour revenus très modestes

  CONDITIONS: {
    min_residence_principale: 0.65,  // 65% pour ≤20 lots
    min_residence_principale_grande: 0.75, // 75% pour >20 lots
    anciennete: 15,  // ans
    gain_energie_min: 0.35,  // 35%
    gain_energie_bonus: 0.50, // 50%
    amo_obligatoire: true,
    audit_obligatoire: true
  }
};

/**
 * Calcule l'aide MaPrimeRénov' Copropriété
 * @param {Object} params - Paramètres du calcul
 * @returns {Object} Détail de l'aide copro
 */
export function calculerMaPrimeRenovCopro(params) {
  const {
    montantTravauxHT,
    nbLogements,
    gainEnergetique,
    sortiePassoire = false,
    coproFragile = false,
    nbCoproprietairesModestes = 0,
    nbCoproprietairesTresModestes = 0
  } = params;

  // Déterminer le taux selon le gain énergétique
  let taux = gainEnergetique >= MAPRIMERENOV_COPRO.CONDITIONS.gain_energie_bonus
    ? MAPRIMERENOV_COPRO.TAUX_45
    : MAPRIMERENOV_COPRO.TAUX_30;

  // Ajouter les bonus
  if (sortiePassoire) {
    taux += MAPRIMERENOV_COPRO.BONUS_SORTIE_PASSOIRE;
  }
  if (coproFragile) {
    taux += MAPRIMERENOV_COPRO.BONUS_COPRO_FRAGILE;
  }

  // Calculer l'aide collective (plafonnée)
  const plafondTotal = MAPRIMERENOV_COPRO.PLAFOND_PAR_LOGEMENT * nbLogements;
  const montantEligible = Math.min(montantTravauxHT, plafondTotal);
  const aideCollective = montantEligible * taux;

  // Calculer les primes individuelles
  const primesIndividuelles =
    (nbCoproprietairesTresModestes * MAPRIMERENOV_COPRO.PRIME_TRES_MODESTE) +
    (nbCoproprietairesModestes * MAPRIMERENOV_COPRO.PRIME_MODESTE);

  const total = aideCollective + primesIndividuelles;

  return {
    aideCollective,
    primesIndividuelles,
    total,
    taux,
    details: {
      tauxBase: gainEnergetique >= 0.50 ? '45%' : '30%',
      bonusSortiePassoire: sortiePassoire ? '+10%' : '',
      bonusCoproFragile: coproFragile ? '+20%' : '',
      tauxFinal: `${Math.round(taux * 100)}%`
    }
  };
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
    ancienneteLogement = 15,
    montantTravaux = 0,
    montantHT = 0,
    incluEcoPTZ = true,
    incluTVA = true
  } = params;

  // Déterminer la catégorie
  const categorie = determinerCategorie(rfr, nbPersonnes, isIDF);

  // Calculer chaque aide DIRECTE
  const mpr = ancienneteLogement >= CONDITIONS_MPR.anciennete_logement
    ? calculerMaPrimeRenov(typePAC, categorie)
    : 0;

  const cee = calculerCEE(typePAC, categorie, surfaceChauffee, avecCoupDePouce);

  // Total aides directes (subventions)
  const totalAidesDirectes = mpr + cee;

  // Calculer le reste à charge AVANT éco-PTZ
  const resteAChargeAvantPret = Math.max(0, montantTravaux - totalAidesDirectes);

  // Éco-PTZ (prêt à taux zéro) - finance le reste à charge
  const ecoPTZ = incluEcoPTZ && ancienneteLogement >= ECO_PTZ.CONDITIONS.anciennete_logement
    ? calculerEcoPTZ(resteAChargeAvantPret, 1)
    : 0;

  // TVA réduite (économie fiscale)
  const montantHTCalcule = montantHT > 0 ? montantHT : (montantTravaux / 1.20); // Estimation si non fourni
  const tva = incluTVA ? calculerEconomieTVA(montantHTCalcule, typePAC) : null;

  // Total aides + économies
  const totalAvecTVA = totalAidesDirectes + (tva?.economie || 0);

  // Reste à charge FINAL (après subventions + TVA, avant prêt)
  const resteAChargeFinal = Math.max(0, montantTravaux - totalAvecTVA);

  return {
    categorie,
    categorieLabel: CATEGORIES_LABELS[categorie],
    aides: {
      maPrimeRenov: mpr,
      cee: cee,
      ecoPTZ: ecoPTZ,
      economieTVA: tva?.economie || 0,
      totalSubventions: totalAidesDirectes,
      totalAvecTVA: totalAvecTVA
    },
    tva: tva,
    plafondDepenses: PLAFONDS_DEPENSES_MPR[typePAC] || 0,
    resteACharge: resteAChargeFinal,
    resteAChargeAvecPret: Math.max(0, resteAChargeFinal - ecoPTZ),
    tauxAide: totalAvecTVA > 0 && montantTravaux
      ? Math.round((totalAvecTVA / montantTravaux) * 100)
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
  MAPRIMERENOV_COPRO,
  COUP_DE_POUCE_MONTANTS,
  ECO_PTZ,
  TVA_REDUITE,
  determinerCategorie,
  calculerMaPrimeRenov,
  calculerMaPrimeRenovCopro,
  calculerCEE,
  calculerEcoPTZ,
  calculerEconomieTVA,
  calculerTotalAides
};
