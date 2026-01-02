// src/services/interventionService.js
// Service de gestion des interventions

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

export const interventionService = {
  async getInterventions(userId = null, isArchived = false) {
    let query = supabase.from('interventions').select(`
      *,
      intervention_assignments (
        user_id,
        profiles (full_name)
      )
    `);

    if (userId) {
      query = supabase.from('interventions').select(`
        *,
        intervention_assignments!inner (user_id)
      `).eq('intervention_assignments.user_id', userId);
    }

    if (isArchived !== null) {
      query = query.eq('is_archived', isArchived);
    }

    return await query.order('scheduled_dates', { ascending: false });
  },

  async createIntervention(interventionData, assignedUserIds = [], briefingFiles = []) {
    // Nettoyer les données (retirer les champs UI-only)
    const {
      assignedUserIds: _1,
      files: _2,
      briefingFiles: _3,
      ...cleanData
    } = interventionData;

    // Sanitize integer fields
    if (cleanData.km_start === '') cleanData.km_start = null;
    if (cleanData.km_end === '') cleanData.km_end = null;

    // 1. Créer l'intervention
    const { data: intervention, error } = await supabase
      .from('interventions')
      .insert([cleanData])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création intervention:', error);
      return { error };
    }

    // 2. Assigner les utilisateurs
    if (assignedUserIds && assignedUserIds.length > 0) {
      const assignments = assignedUserIds.map(userId => ({
        intervention_id: intervention.id,
        user_id: userId
      }));
      const { error: assignError } = await supabase
        .from('intervention_assignments')
        .insert(assignments);

      if (assignError) logger.error('Erreur assignation:', assignError);
    }

    return { data: intervention, error: null };
  },

  async updateIntervention(id, updates) {
    return await supabase.from('interventions').update(updates).eq('id', id);
  },

  async deleteIntervention(id) {
    return await supabase.from('interventions').delete().eq('id', id);
  },

  async addBriefingDocuments(id, files) {
    // Placeholder
    return { error: null };
  },

  // Exposer supabase pour les hooks qui en ont besoin temporairement
  supabase
};

export default interventionService;
