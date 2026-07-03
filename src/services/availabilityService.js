// src/services/availabilityService.js
// Disponibilité des employés pour les affectations d'intervention.
//
// Un employé est indisponible s'il a une absence (maladie, congé approuvé,
// autre) couvrant la période visée. Les employés 'licencié' sont filtrés
// séparément via leur statut (voir utils/employeeAvailability).

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export const availabilityService = {
  /**
   * IDs des employés absents sur une période [startDate, endDate].
   * Une seule requête ; la RLS restreint déjà à l'organisation courante.
   * @param {string} startDate - 'YYYY-MM-DD'
   * @param {string} [endDate] - 'YYYY-MM-DD' (défaut = startDate)
   * @returns {Promise<{ ids: Set<string>, error: any }>}
   */
  async getUnavailableIds(startDate, endDate = null) {
    if (!startDate) return { ids: new Set(), error: null };
    const end = endDate || startDate;
    const { data, error } = await supabase
      .from('employee_absences')
      .select('employee_id')
      .lte('start_date', end)
      .gte('end_date', startDate);

    if (error) {
      logger.warn('[availabilityService] Erreur récupération absences:', error.message);
      return { ids: new Set(), error };
    }
    return { ids: new Set((data || []).map(a => a.employee_id)), error: null };
  },
};

export default availabilityService;
