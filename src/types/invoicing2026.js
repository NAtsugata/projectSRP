/**
 * ============================================================
 * TYPES & CONSTANTES - CONFORMITÉ FACTURATION 2026
 * ============================================================
 * Définitions pour e-invoicing, e-reporting, Factur-X, ISCA
 * ============================================================
 */

// =====================================================
// CONSTANTES GÉNÉRALES 2026
// =====================================================

export const COMPLIANCE_2026 = {
  DEADLINE_CERTIFICATION: '2026-08-31',
  START_EINVOICING_LARGE: '2026-09-01',  // Grandes entreprises + ETI
  START_EINVOICING_SME: '2027-09-01',    // PME, TPE, micro-entreprises
  PENALTY_MISSING_MENTION: 15,           // €/mention
  PENALTY_MISSING_MENTION_MAX_PERCENT: 25, // % du montant facture
  PENALTY_EREPORTING_OMISSION: 250,      // €
  PENALTY_EREPORTING_MAX_ANNUAL: 15000,  // €/an
  PENALTY_NO_CERTIFICATION: 7500         // €/logiciel
};

// =====================================================
// NATURE D'OPÉRATION (MENTION OBLIGATOIRE 2026)
// =====================================================

export const OPERATION_NATURE = {
  BIEN: {
    code: 'BIEN',
    label: 'Livraison de biens',
    description: 'Vente de marchandises, matériel, équipements'
  },
  SERVICE: {
    code: 'SERVICE',
    label: 'Prestation de services',
    description: 'Main-d\'œuvre, conseils, maintenance, etc.'
  },
  MIXTE: {
    code: 'MIXTE',
    label: 'Opération mixte',
    description: 'Fourniture + pose, matériel + services'
  }
};

// =====================================================
// MODES DE TVA
// =====================================================

export const VAT_MODE = {
  STANDARD: {
    code: 'STANDARD',
    label: 'TVA standard (collecte)',
    description: 'Collecte de la TVA par le vendeur'
  },
  AUTOLIQUIDATION: {
    code: 'AUTOLIQUIDATION',
    label: 'Autoliquidation',
    description: 'TVA due et payée par l\'acheteur'
  },
  EXEMPT: {
    code: 'EXEMPT',
    label: 'Exonéré de TVA',
    description: 'Opération exonérée (export, formation, santé)'
  },
  MARGIN: {
    code: 'MARGIN',
    label: 'Régime de la marge',
    description: 'Biens d\'occasion, œuvres d\'art'
  },
  FRANCHISE: {
    code: 'FRANCHISE',
    label: 'Franchise en base',
    description: 'CA < 37 500€ (mention "TVA non applicable, art. 293 B du CGI")'
  }
};

// =====================================================
// RAISONS AUTOLIQUIDATION
// =====================================================

export const AUTOLIQUIDATION_REASON = {
  SUBCONTRACTING_BTP: {
    code: 'SUBCONTRACTING_BTP',
    label: 'Sous-traitance BTP',
    legalReference: 'Art. 283-2 nonies du CGI',
    mention: 'Autoliquidation - TVA due par le preneur (Art. 283-2 nonies CGI)'
  },
  INTRA_EU_GOODS: {
    code: 'INTRA_EU_GOODS',
    label: 'Livraison intracommunautaire de biens',
    legalReference: 'Art. 262 ter I du CGI / Art. 138 Directive 2006/112/CE',
    mention: 'Exonération TVA - Livraison intracommunautaire (Art. 262 ter I CGI)'
  },
  INTRA_EU_SERVICES: {
    code: 'INTRA_EU_SERVICES',
    label: 'Prestation de services intracommunautaire',
    legalReference: 'Art. 196 Directive 2006/112/CE',
    mention: 'Autoliquidation - TVA due par le preneur (Art. 196 Directive 2006/112/CE)'
  },
  IMPORT: {
    code: 'IMPORT',
    label: 'Importation de biens (hors UE)',
    legalReference: 'Art. 293 A du CGI',
    mention: 'Autoliquidation TVA à l\'importation (Art. 293 A CGI)'
  },
  REVERSE_CHARGE_OTHER: {
    code: 'REVERSE_CHARGE_OTHER',
    label: 'Autre cas d\'autoliquidation',
    legalReference: 'À préciser',
    mention: 'Autoliquidation - TVA due par le preneur'
  }
};

// =====================================================
// PROFILS FACTUR-X (FORMAT E-INVOICING)
// =====================================================

export const FACTURX_PROFILE = {
  MINIMUM: {
    code: 'MINIMUM',
    label: 'MINIMUM',
    description: 'Données d\'en-tête et de pied uniquement (SIREN, montants totaux)',
    complexity: 1,
    recommended: false
  },
  BASIC_WL: {
    code: 'BASIC_WL',
    label: 'BASIC WL (Without Lines)',
    description: 'Données essentielles sans détail des lignes',
    complexity: 2,
    recommended: false
  },
  BASIC: {
    code: 'BASIC',
    label: 'BASIC',
    description: 'Détail des lignes (quantité, prix unitaire, libellé) - RECOMMANDÉ',
    complexity: 3,
    recommended: true // ✅ Profil recommandé pour PME/TPE
  },
  EN16931: {
    code: 'EN16931',
    label: 'EN 16931 (Norme européenne)',
    description: 'Conformité totale norme sémantique européenne',
    complexity: 4,
    recommended: false
  },
  EXTENDED: {
    code: 'EXTENDED',
    label: 'EXTENDED',
    description: 'Données métiers spécifiques (logistique, taxes complexes)',
    complexity: 5,
    recommended: false
  }
};

// =====================================================
// STATUTS E-INVOICING
// =====================================================

export const EINVOICING_STATUS = {
  NOT_SENT: {
    code: 'NOT_SENT',
    label: 'Non envoyée',
    color: 'gray',
    icon: '⏸️'
  },
  PENDING: {
    code: 'PENDING',
    label: 'En cours d\'envoi',
    color: 'warning',
    icon: '⏳'
  },
  DEPOSITED: {
    code: 'DEPOSITED',
    label: 'Déposée sur PPF/PDP',
    color: 'info',
    icon: '📤'
  },
  REJECTED: {
    code: 'REJECTED',
    label: 'Rejetée',
    color: 'danger',
    icon: '❌'
  },
  ACCEPTED: {
    code: 'ACCEPTED',
    label: 'Acceptée par le client',
    color: 'success',
    icon: '✅'
  },
  PAID: {
    code: 'PAID',
    label: 'Payée',
    color: 'success',
    icon: '💰'
  }
};

// =====================================================
// PLATEFORMES E-INVOICING
// =====================================================

export const EINVOICING_PLATFORM = {
  PPF: {
    code: 'PPF',
    label: 'PPF (Portail Public de Facturation)',
    description: 'Plateforme publique gratuite (Chorus Pro étendu)',
    url: 'https://portail-facture.fr',
    free: true
  },
  PDP_CHORUS: {
    code: 'PDP_CHORUS',
    label: 'PDP Chorus Pro',
    description: 'Plateforme de Dématérialisation Partenaire (Chorus)',
    free: false
  },
  PDP_OTHER: {
    code: 'PDP_OTHER',
    label: 'Autre PDP certifiée',
    description: 'Plateforme privée immatriculée DGFiP',
    free: false
  }
};

// =====================================================
// TYPES E-REPORTING
// =====================================================

export const EREPORTING_TYPE = {
  B2C: {
    code: 'B2C',
    label: 'Ventes B2C (particuliers)',
    description: 'Ventes au détail, services aux particuliers',
    frequency: 'Selon régime TVA'
  },
  EXPORT: {
    code: 'EXPORT',
    label: 'Exportations (hors UE)',
    description: 'Ventes vers pays tiers',
    frequency: 'Selon régime TVA'
  },
  INTRA_EU: {
    code: 'INTRA_EU',
    label: 'Opérations intracommunautaires',
    description: 'Achats/ventes intra-UE',
    frequency: 'Selon régime TVA'
  },
  IMPORT: {
    code: 'IMPORT',
    label: 'Importations',
    description: 'Achats depuis pays tiers (déjà géré douanes)',
    frequency: 'N/A'
  }
};

// =====================================================
// FRÉQUENCES E-REPORTING (SELON RÉGIME TVA)
// =====================================================

export const EREPORTING_FREQUENCY = {
  REAL_NORMAL: {
    code: 'REAL_NORMAL',
    label: 'Réel Normal (mensuel)',
    frequency: 'DECADE',  // Tous les 10 jours
    delay: 10,            // 10 jours après fin période
    description: 'Déclaration tous les 10 jours (1-10, 11-20, 21-fin)'
  },
  REAL_SIMPLIFIED: {
    code: 'REAL_SIMPLIFIED',
    label: 'Réel Simplifié',
    frequency: 'MONTHLY',
    delay: 25,  // Entre le 25 et 30 du mois suivant
    description: 'Déclaration mensuelle (avant le 30 du mois suivant)'
  },
  FRANCHISE: {
    code: 'FRANCHISE',
    label: 'Franchise en base',
    frequency: 'BIMONTHLY',
    delay: 25,
    description: 'Déclaration bimestrielle (2 mois)'
  }
};

// =====================================================
// MENTIONS SECTORIELLES
// =====================================================

export const SECTOR_SPECIFIC_MENTIONS = {
  BTP: {
    sector: 'BTP',
    required: ['insurance_decennial'],
    penalty: 75000,  // € si omise
    fields: {
      insurance_decennial: {
        insurer: 'Nom assureur',
        policyNumber: 'Numéro de contrat',
        geographicZone: 'Zone géographique couverte',
        validUntil: 'Date de validité'
      }
    }
  },
  SAP: {
    sector: 'Services à la Personne',
    required: ['sap_agreement_number'],
    fields: {
      sap_agreement_number: 'Numéro agrément SAP',
      sap_valid_until: 'Validité agrément',
      tax_benefit_notice: 'Mention crédit d\'impôt (50%)'
    }
  },
  HEALTH: {
    sector: 'Santé / Appareillage',
    required: ['health_license_number'],
    fields: {
      health_license_number: 'Numéro licence professionnelle',
      prescriber_rpps: 'RPPS du prescripteur',
      ameli_reimbursement: 'Taux prise en charge Assurance Maladie'
    }
  }
};

// =====================================================
// ÉVÉNEMENTS AUDIT (ISCA)
// =====================================================

export const AUDIT_EVENT_TYPE = {
  CREATE: {
    code: 'CREATE',
    label: 'Création',
    icon: '➕',
    color: 'success'
  },
  UPDATE: {
    code: 'UPDATE',
    label: 'Modification',
    icon: '✏️',
    color: 'warning'
  },
  DELETE: {
    code: 'DELETE',
    label: 'Suppression',
    icon: '🗑️',
    color: 'danger'
  },
  SEND: {
    code: 'SEND',
    label: 'Envoi',
    icon: '📤',
    color: 'info'
  },
  PAID: {
    code: 'PAID',
    label: 'Paiement',
    icon: '💰',
    color: 'success'
  },
  CANCEL: {
    code: 'CANCEL',
    label: 'Annulation',
    icon: '❌',
    color: 'danger'
  },
  CONVERT: {
    code: 'CONVERT',
    label: 'Conversion (devis → facture)',
    icon: '🔄',
    color: 'info'
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Vérifie si une facture nécessite e-invoicing (B2B)
 * @param {Object} invoice - Facture
 * @param {Object} client - Client
 * @returns {boolean}
 */
export const requiresEInvoicing = (invoice, client) => {
  return (
    client?.is_professional === true &&
    client?.siren &&
    client?.siren.length === 9 &&
    invoice.status !== 'draft'
  );
};

/**
 * Vérifie si une facture nécessite e-reporting (B2C/International)
 * @param {Object} invoice - Facture
 * @param {Object} client - Client
 * @returns {boolean}
 */
export const requiresEReporting = (invoice, client) => {
  // B2C (particuliers)
  if (client?.is_professional === false) {
    return true;
  }

  // Pas de SIREN = particulier ou international
  if (!client?.siren) {
    return true;
  }

  return false;
};

/**
 * Détermine le type de e-reporting
 * @param {Object} invoice - Facture
 * @param {Object} client - Client
 * @returns {string}
 */
export const getEReportingType = (invoice, client) => {
  // B2C
  if (client?.is_professional === false) {
    return EREPORTING_TYPE.B2C.code;
  }

  // International (UE ou hors UE)
  const country = client?.country?.toUpperCase();
  if (country && country !== 'FR' && country !== 'FRANCE') {
    // UE
    const EU_COUNTRIES = ['DE', 'BE', 'IT', 'ES', 'NL', 'PT', 'IE', 'LU', 'AT', /* etc */];
    if (EU_COUNTRIES.includes(country)) {
      return EREPORTING_TYPE.INTRA_EU.code;
    }
    // Hors UE
    return EREPORTING_TYPE.EXPORT.code;
  }

  return null;
};

/**
 * Obtient la mention légale d'autoliquidation
 * @param {string} reason - Raison (code)
 * @returns {string}
 */
export const getAutoliquidationMention = (reason) => {
  const config = AUTOLIQUIDATION_REASON[reason];
  return config?.mention || 'Autoliquidation - TVA due par le preneur';
};

/**
 * Calcule la sanction pour mentions manquantes
 * @param {number} missingMentionsCount - Nombre de mentions manquantes
 * @param {number} invoiceAmount - Montant facture
 * @returns {number}
 */
export const calculateMissingMentionPenalty = (missingMentionsCount, invoiceAmount) => {
  const penalty = missingMentionsCount * COMPLIANCE_2026.PENALTY_MISSING_MENTION;
  const maxPenalty = invoiceAmount * (COMPLIANCE_2026.PENALTY_MISSING_MENTION_MAX_PERCENT / 100);
  return Math.min(penalty, maxPenalty);
};

/**
 * Valide le format SIREN (9 chiffres)
 * @param {string} siren - SIREN
 * @returns {boolean}
 */
export const isValidSIREN = (siren) => {
  if (!siren) return false;
  const cleaned = siren.replace(/\s/g, '');
  return /^\d{9}$/.test(cleaned);
};

/**
 * Valide le format SIRET (14 chiffres)
 * @param {string} siret - SIRET
 * @returns {boolean}
 */
export const isValidSIRET = (siret) => {
  if (!siret) return false;
  const cleaned = siret.replace(/\s/g, '');
  return /^\d{14}$/.test(cleaned);
};

/**
 * Valide le numéro de TVA intracommunautaire FR
 * @param {string} vat - Numéro TVA
 * @returns {boolean}
 */
export const isValidVATNumber = (vat) => {
  if (!vat) return false;
  const cleaned = vat.replace(/\s/g, '').toUpperCase();
  // Format FR: FR + 2 chiffres (clé) + 9 chiffres (SIREN)
  return /^FR[0-9A-Z]{2}[0-9]{9}$/.test(cleaned);
};

export default {
  COMPLIANCE_2026,
  OPERATION_NATURE,
  VAT_MODE,
  AUTOLIQUIDATION_REASON,
  FACTURX_PROFILE,
  EINVOICING_STATUS,
  EINVOICING_PLATFORM,
  EREPORTING_TYPE,
  EREPORTING_FREQUENCY,
  SECTOR_SPECIFIC_MENTIONS,
  AUDIT_EVENT_TYPE,
  requiresEInvoicing,
  requiresEReporting,
  getEReportingType,
  getAutoliquidationMention,
  calculateMissingMentionPenalty,
  isValidSIREN,
  isValidSIRET,
  isValidVATNumber
};
