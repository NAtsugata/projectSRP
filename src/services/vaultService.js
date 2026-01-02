// src/services/vaultService.js
// Service de gestion du coffre-fort de documents

import { supabase } from '../lib/supabaseClient';

export const vaultService = {
  async getVaultDocuments() {
    return await supabase.from('vault_documents').select('*').order('created_at', { ascending: false });
  },

  async createVaultDocument(data) {
    return await supabase.from('vault_documents').insert([data]);
  },

  async deleteVaultDocument(id) {
    return await supabase.from('vault_documents').delete().eq('id', id);
  }
};

export default vaultService;
