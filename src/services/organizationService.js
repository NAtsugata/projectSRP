// src/services/organizationService.js
// Service de gestion des organisations (multi-tenancy)

import { supabase } from '../lib/supabaseClient';

export const organizationService = {
  /**
   * Récupérer l'organisation de l'utilisateur courant
   */
  async getCurrentOrganization(orgId) {
    if (!orgId) return { data: null, error: null };
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, logo_url, plan, max_users, is_active, settings')
      .eq('id', orgId)
      .single();
    return { data, error };
  },

  /**
   * Récupérer le rôle de l'utilisateur dans son organisation
   */
  async getUserRole(userId, orgId) {
    if (!userId || !orgId) return { data: null, error: null };
    const { data, error } = await supabase
      .from('organization_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', orgId)
      .single();
    return { data, error };
  },

  /**
   * Lister les membres de l'organisation
   */
  async getOrganizationMembers(orgId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, employee_id, avatar_url, is_admin')
      .eq('organization_id', orgId)
      .order('full_name');
    return { data, error };
  },

  /**
   * Mettre à jour les infos de l'organisation (admin org uniquement)
   */
  async updateOrganization(orgId, updates) {
    const { data, error } = await supabase
      .from('organizations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', orgId)
      .select()
      .single();
    return { data, error };
  },

  /**
   * Assigner un rôle à un utilisateur dans l'organisation
   */
  async setUserRole(orgId, userId, role) {
    const { data, error } = await supabase
      .from('organization_roles')
      .upsert({
        organization_id: orgId,
        user_id: userId,
        role,
      }, { onConflict: 'organization_id,user_id' })
      .select()
      .single();
    return { data, error };
  },
};

export default organizationService;
