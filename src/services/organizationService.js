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
      .select('id, full_name, avatar_url, is_admin')
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

  // ========== SUPER-ADMIN ==========

  /**
   * Lister toutes les organisations (super-admin)
   */
  async getAllOrganizations() {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, logo_url, plan, max_users, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    return { data, error };
  },

  /**
   * Créer une nouvelle organisation (super-admin)
   */
  async createOrganization({ name, slug, plan = 'free', max_users = 5 }) {
    const { data, error } = await supabase
      .from('organizations')
      .insert([{ name, slug, plan, max_users, is_active: true }])
      .select()
      .single();
    return { data, error };
  },

  /**
   * Activer/désactiver une organisation (super-admin)
   */
  async toggleOrganizationActive(orgId, isActive) {
    const { data, error } = await supabase
      .from('organizations')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', orgId)
      .select()
      .single();
    return { data, error };
  },

  /**
   * Compter les membres d'une organisation
   */
  async getOrganizationMemberCount(orgId) {
    const { count, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId);
    return { count: count || 0, error };
  },
};

export default organizationService;
