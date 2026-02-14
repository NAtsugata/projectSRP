// src/services/vaultService.js
// Service de gestion du coffre-fort de documents

import { supabase } from '../lib/supabaseClient';

export const vaultService = {
  async getVaultDocuments() {
    const { data, error } = await supabase
      .from('vault_documents')
      .select('id, user_id, title, description, file_url, file_name, file_type, category, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500);
    return { data, error };
  },

  async getVaultDocument(id) {
    const { data, error } = await supabase
      .from('vault_documents')
      .select('id, user_id, title, description, file_url, file_name, file_type, file_size, category, metadata, created_at, updated_at')
      .eq('id', id)
      .single();
    return { data, error };
  },

  async createVaultDocument(documentData) {
    const { data, error } = await supabase
      .from('vault_documents')
      .insert([documentData])
      .select()
      .single();
    return { data, error };
  },

  async updateVaultDocument(id, updates) {
    const { data, error } = await supabase
      .from('vault_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async deleteVaultDocument(id) {
    const { data, error } = await supabase
      .from('vault_documents')
      .delete()
      .eq('id', id);
    return { data, error };
  }
};

export default vaultService;
