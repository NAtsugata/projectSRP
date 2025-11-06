// src/services/checklistService.js - SERVICE CHECKLISTS D'INTERVENTION
import { supabase } from '../lib/supabase';

/**
 * Service pour gérer les checklists d'intervention plomberie
 *
 * Structure tables:
 * - checklist_templates: Templates créés par admin
 * - checklists: Instances assignées aux employés
 */

const checklistService = {
  // ==================== TEMPLATES ====================

  /**
   * Récupérer tous les templates (admin)
   */
  async getAllTemplates() {
    try {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur getAllTemplates:', error);
      return { data: null, error };
    }
  },

  /**
   * Créer un template (admin)
   */
  async createTemplate({ name, description, category, items }) {
    try {
      const templateData = {
        name: name.trim(),
        description: description?.trim() || null,
        category,
        items: JSON.stringify(items), // JSONB
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('checklist_templates')
        .insert([templateData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Template créé:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur createTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre à jour un template (admin)
   */
  async updateTemplate({ id, name, description, category, items }) {
    try {
      const updateData = {
        name: name.trim(),
        description: description?.trim() || null,
        category,
        items: JSON.stringify(items),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('checklist_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Template mis à jour:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur updateTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un template (admin)
   */
  async deleteTemplate(templateId) {
    try {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      console.log('✅ Template supprimé:', templateId);
      return { data: true, error: null };
    } catch (error) {
      console.error('❌ Erreur deleteTemplate:', error);
      return { data: null, error };
    }
  },

  // ==================== CHECKLISTS ====================

  /**
   * Assigner une checklist à une intervention (admin)
   * Crée une checklist pour CHAQUE employé assigné à l'intervention
   */
  async assignChecklistToIntervention(interventionId, templateId, assignedUserIds) {
    try {
      // Récupérer le template
      const { data: template, error: templateError } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Créer une checklist pour chaque employé
      const checklistsToCreate = assignedUserIds.map(userId => ({
        intervention_id: interventionId,
        template_id: templateId,
        template_name: template.name,
        user_id: userId,
        items_state: JSON.stringify({}), // Initialement vide
        photos: JSON.stringify({}),
        notes: JSON.stringify({}),
        status: 'pending',
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('checklists')
        .insert(checklistsToCreate)
        .select();

      if (error) throw error;

      console.log('✅ Checklists assignées:', data.length);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur assignChecklistToIntervention:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer toutes les checklists (admin)
   */
  async getAllChecklists() {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur getAllChecklists:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer les checklists d'un employé
   */
  async getUserChecklists(userId) {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur getUserChecklists:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer les checklists d'une intervention
   */
  async getInterventionChecklists(interventionId) {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('intervention_id', interventionId);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur getInterventionChecklists:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre à jour une checklist (employé)
   */
  async updateChecklist({ id, itemsState, photos, notes, status, completedAt }) {
    try {
      const updateData = {
        items_state: JSON.stringify(itemsState),
        photos: JSON.stringify(photos),
        notes: JSON.stringify(notes),
        status: status || 'in_progress',
        updated_at: new Date().toISOString()
      };

      if (completedAt) {
        updateData.completed_at = completedAt;
      }

      const { data, error } = await supabase
        .from('checklists')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Checklist mise à jour:', data);
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur updateChecklist:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer une checklist (admin)
   */
  async deleteChecklist(checklistId) {
    try {
      const { error } = await supabase
        .from('checklists')
        .delete()
        .eq('id', checklistId);

      if (error) throw error;

      console.log('✅ Checklist supprimée:', checklistId);
      return { data: true, error: null };
    } catch (error) {
      console.error('❌ Erreur deleteChecklist:', error);
      return { data: null, error };
    }
  },

  /**
   * Obtenir statistiques checklists
   */
  async getChecklistStats(userId = null) {
    try {
      let query = supabase.from('checklists').select('status');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        pending: data.filter(c => c.status === 'pending').length,
        inProgress: data.filter(c => c.status === 'in_progress').length,
        completed: data.filter(c => c.status === 'completed').length
      };

      return { data: stats, error: null };
    } catch (error) {
      console.error('❌ Erreur getChecklistStats:', error);
      return { data: null, error };
    }
  }
};

export default checklistService;
