// src/services/interventionService.js
// Service de gestion des interventions

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { withOrgId } from '../utils/orgHelper';

export const interventionService = {
  async getInterventions(userId = null, isArchived = false) {
    logger.log('📋 getInterventions called with:', { userId, isArchived });

    let query;

    if (userId) {
      // Requête pour un employé spécifique - utiliser inner join pour filtrer
      query = supabase
        .from('interventions')
        .select(`
          *,
          client_data:clients (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            city
          ),
          intervention_assignments!inner (
            user_id,
            profiles (full_name)
          )
        `)
        .eq('intervention_assignments.user_id', userId);

      logger.log('📋 Filtering interventions for user:', userId);
    } else {
      // Requête admin - toutes les interventions
      query = supabase
        .from('interventions')
        .select(`
          *,
          client_data:clients (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            city
          ),
          intervention_assignments (
            user_id,
            profiles (full_name)
          )
        `);
    }

    if (isArchived !== null) {
      query = query.eq('is_archived', isArchived);
    }

    const result = await query.order('scheduled_dates', { ascending: false }).limit(500);

    logger.log('📋 getInterventions result:', {
      count: result.data?.length || 0,
      error: result.error?.message
    });

    return result;
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
      .insert([withOrgId(cleanData)])
      .select()
      .single();

    if (error) {
      logger.error('❌ Erreur création intervention:', error);
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

  async updateAssignments(interventionId, newUserIds) {
    // 1. Supprimer les anciennes assignations
    const { error: deleteError } = await supabase
      .from('intervention_assignments')
      .delete()
      .eq('intervention_id', interventionId);

    if (deleteError) {
      logger.error('❌ Erreur suppression anciennes assignations:', deleteError);
      return { error: deleteError };
    }

    // 2. Créer les nouvelles assignations
    if (newUserIds && newUserIds.length > 0) {
      const assignments = newUserIds.map(userId => ({
        intervention_id: interventionId,
        user_id: userId
      }));

      const { error: insertError } = await supabase
        .from('intervention_assignments')
        .insert(assignments);

      if (insertError) {
        logger.error('❌ Erreur création nouvelles assignations:', insertError);
        return { error: insertError };
      }
    }

    logger.log('✅ Assignations mises à jour pour intervention', interventionId);
    return { error: null };
  },

  /**
   * Met à jour les assignations journalières d'une intervention multi-jours
   * @param {string} interventionId
   * @param {Object} dailyAssignments - { "2026-02-03": ["userId1","userId2"], ... }
   */
  async updateDailyAssignments(interventionId, dailyAssignments) {
    const { error } = await supabase
      .from('interventions')
      .update({ daily_assignments: dailyAssignments })
      .eq('id', interventionId);

    if (error) {
      logger.error('❌ Erreur MAJ assignations journalières:', error);
      return { error };
    }

    logger.log('✅ Assignations journalières mises à jour pour', interventionId);
    return { error: null };
  },

  async addBriefingDocuments(interventionId, files) {
    if (!files || files.length === 0) return { data: [], error: null };

    try {
      const uploaded = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${interventionId}/briefing/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('intervention-files')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          logger.error('Erreur upload briefing:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('intervention-files')
          .getPublicUrl(fileName);

        uploaded.push({
          name: file.name,
          path: fileName,
          url: urlData?.publicUrl || '',
          size: file.size,
          type: file.type
        });
      }

      // Mettre à jour l'intervention avec les documents de briefing
      if (uploaded.length > 0) {
        const { data: current } = await supabase
          .from('interventions')
          .select('briefing_documents')
          .eq('id', interventionId)
          .single();

        const existing = current?.briefing_documents || [];
        const allDocs = [...existing, ...uploaded];

        await supabase
          .from('interventions')
          .update({ briefing_documents: allDocs })
          .eq('id', interventionId);
      }

      logger.log('Briefing documents ajoutés:', uploaded.length);
      return { data: uploaded, error: null };
    } catch (error) {
      logger.error('Erreur addBriefingDocuments:', error);
      return { data: [], error };
    }
  }
};

export default interventionService;
