// src/utils/reportHelpers.js
// Fonction centralisée pour nettoyer et valider les données de rapport d'intervention

/**
 * Construit un objet rapport sanitisé avec tous les champs requis
 * Cette fonction garantit que tous les champs sont présents et du bon type
 * @param {Object} report - Objet rapport brut à nettoyer
 * @returns {Object} Objet rapport sanitisé
 */
export const buildSanitizedReport = (report) => {
  if (!report) {
    return {
      notes: '',
      files: [],
      arrivalTime: null,
      departureTime: null,
      signature: null,
      needs: [],
      supply_requests: [],
      quick_checkpoints: [],
      blocks: null,
      arrivalGeo: null,
      departureGeo: null,
      rating: null,
      follow_up_required: false,
      parts_used: []
    };
  }

  return {
    notes: report.notes || '',
    files: Array.isArray(report.files) ? report.files : [],
    arrivalTime: report.arrivalTime || null,
    departureTime: report.departureTime || null,
    signature: report.signature || null,

    // Champs additionnels
    needs: Array.isArray(report.needs) ? report.needs : [],
    supply_requests: Array.isArray(report.supply_requests) ? report.supply_requests : [],
    quick_checkpoints: Array.isArray(report.quick_checkpoints) ? report.quick_checkpoints : [],
    blocks: report.blocks || null,
    arrivalGeo: report.arrivalGeo || null,
    departureGeo: report.departureGeo || null,
    rating: report.rating ?? null,
    follow_up_required: !!report.follow_up_required,
    parts_used: Array.isArray(report.parts_used) ? report.parts_used : []
  };
};

/**
 * Valide qu'un rapport a les champs minimums requis
 * @param {Object} report - Rapport à valider
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export const validateReport = (report) => {
  const errors = [];

  if (!report) {
    errors.push('Le rapport est requis');
    return { isValid: false, errors };
  }

  // Validation optionnelle : peut être activée selon besoins métier
  // if (!report.arrivalTime) {
  //   errors.push('L\'heure d\'arrivée est requise');
  // }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const reportHelpers = {
  buildSanitizedReport,
  validateReport
};

export default reportHelpers;
