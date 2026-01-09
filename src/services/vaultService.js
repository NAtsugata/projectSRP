// src/services/vaultService.js
// Service de gestion du coffre-fort de documents

import { supabase } from '../lib/supabaseClient';

export const vaultService = {
  async getVaultDocuments() {
    const { data, error } = await supabase
      .from('vault_documents')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getVaultDocument(id) {
    const { data, error } = await supabase
      .from('vault_documents')
      .select('*')
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
