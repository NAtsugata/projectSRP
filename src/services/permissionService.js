// src/services/permissionService.js
// Service de gestion des permissions employes

import { supabase } from '../lib/supabaseClient';

export const permissionService = {
  // Obtenir toutes les permissions disponibles
  async getAvailablePermissions() {
    const { data, error } = await supabase
      .from('available_permissions')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    return { data, error };
  },

  // Obtenir les permissions d'un utilisateur
  async getUserPermissions(userId) {
    const { data, error } = await supabase
      .from('employee_permissions')
      .select(`
        *,
        permission:available_permissions(code, name, description, category)
      `)
      .eq('user_id', userId);
    return { data, error };
  },

  // Accorder une permission a un utilisateur
  async grantPermission(userId, permissionCode, options = {}) {
    const { expiresAt = null, organizationId = null } = options;

    // Obtenir l'utilisateur courant pour granted_by
    const { data: currentUser } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('employee_permissions')
      .upsert({
        user_id: userId,
        permission_code: permissionCode,
        granted_by: currentUser?.user?.id,
        expires_at: expiresAt,
        organization_id: organizationId
      }, {
        onConflict: 'user_id,permission_code,organization_id'
      })
      .select()
      .single();
    return { data, error };
  },

  // Revoquer une permission
  async revokePermission(userId, permissionCode) {
    const { data, error } = await supabase
      .from('employee_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_code', permissionCode);
    return { data, error };
  },

  // Revoquer toutes les permissions d'un utilisateur
  async revokeAllPermissions(userId) {
    const { data, error } = await supabase
      .from('employee_permissions')
      .delete()
      .eq('user_id', userId);
    return { data, error };
  },

  // Mettre a jour les permissions en masse pour un utilisateur
  async updateUserPermissions(userId, permissionCodes, organizationId = null) {
    // D'abord supprimer toutes les permissions existantes
    await supabase
      .from('employee_permissions')
      .delete()
      .eq('user_id', userId);

    // Puis ajouter les nouvelles permissions
    if (permissionCodes.length === 0) {
      return { data: [], error: null };
    }

    const { data: currentUser } = await supabase.auth.getUser();

    const permissionsToInsert = permissionCodes.map(code => ({
      user_id: userId,
      permission_code: code,
      granted_by: currentUser?.user?.id,
      organization_id: organizationId
    }));

    const { data, error } = await supabase
      .from('employee_permissions')
      .insert(permissionsToInsert)
      .select();

    return { data, error };
  },

  // Verifier si l'utilisateur courant a une permission
  async checkCurrentUserPermission(permissionCode) {
    const { data, error } = await supabase
      .rpc('current_user_has_permission', { p_permission_code: permissionCode });
    return { hasPermission: data || false, error };
  },

  // Obtenir les documents partages avec un utilisateur
  async getSharedDocuments(userId) {
    const { data, error } = await supabase
      .from('shared_vault_access')
      .select(`
        *,
        document:vault_documents(*)
      `)
      .eq('shared_with_user_id', userId)
      .or('expires_at.is.null,expires_at.gt.now()');
    return { data, error };
  },

  // Partager un document avec un utilisateur
  async shareDocument(documentId, userId, options = {}) {
    const { canDownload = true, canView = true, expiresAt = null, organizationId = null } = options;

    const { data: currentUser } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('shared_vault_access')
      .upsert({
        document_id: documentId,
        shared_with_user_id: userId,
        shared_by_user_id: currentUser?.user?.id,
        can_download: canDownload,
        can_view: canView,
        expires_at: expiresAt,
        organization_id: organizationId
      }, {
        onConflict: 'document_id,shared_with_user_id'
      })
      .select()
      .single();
    return { data, error };
  },

  // Revoquer l'acces a un document partage
  async revokeDocumentAccess(documentId, userId) {
    const { data, error } = await supabase
      .from('shared_vault_access')
      .delete()
      .eq('document_id', documentId)
      .eq('shared_with_user_id', userId);
    return { data, error };
  },

  // Obtenir tous les partages d'un document
  async getDocumentShares(documentId) {
    const { data, error } = await supabase
      .from('shared_vault_access')
      .select(`
        *,
        shared_with:profiles!shared_with_user_id(id, full_name, email)
      `)
      .eq('document_id', documentId);
    return { data, error };
  },

  // Mettre a jour les partages d'un document en masse
  async updateDocumentShares(documentId, userIds, organizationId = null) {
    // Supprimer les partages existants
    await supabase
      .from('shared_vault_access')
      .delete()
      .eq('document_id', documentId);

    if (userIds.length === 0) {
      return { data: [], error: null };
    }

    const { data: currentUser } = await supabase.auth.getUser();

    const sharesToInsert = userIds.map(userId => ({
      document_id: documentId,
      shared_with_user_id: userId,
      shared_by_user_id: currentUser?.user?.id,
      can_download: true,
      can_view: true,
      organization_id: organizationId
    }));

    const { data, error } = await supabase
      .from('shared_vault_access')
      .insert(sharesToInsert)
      .select();

    return { data, error };
  }
};

export default permissionService;
