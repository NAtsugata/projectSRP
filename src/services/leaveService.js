// src/services/leaveService.js
// Service de gestion des demandes de congés

import { supabase } from '../lib/supabaseClient';

export const leaveService = {
  async getLeaveRequests(userId = null) {
    let query = supabase.from('leave_requests').select('*, profiles(full_name)');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    return { data, error };
  },

  async createLeaveRequest(requestData) {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert([requestData])
      .select()
      .single();
    return { data, error };
  },

  // Méthode principale pour mise à jour (utilisée par le hook)
  async updateLeaveRequest(id, updates) {
    const { data, error } = await supabase
      .from('leave_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // Alias pour compatibilité - met à jour uniquement le status
  async updateRequestStatus(id, status) {
    return this.updateLeaveRequest(id, { status });
  },

  async deleteLeaveRequest(id) {
    const { data, error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', id);
    return { data, error };
  }
};

export default leaveService;
