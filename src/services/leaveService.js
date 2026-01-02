// src/services/leaveService.js
// Service de gestion des demandes de congés

import { supabase } from '../lib/supabaseClient';

export const leaveService = {
  async getLeaveRequests(userId = null) {
    let query = supabase.from('leave_requests').select('*, profiles(full_name)');
    if (userId) {
      query = query.eq('user_id', userId);
    }
    return await query;
  },

  async createLeaveRequest(requestData) {
    return await supabase.from('leave_requests').insert([requestData]);
  },

  async updateRequestStatus(id, status) {
    return await supabase.from('leave_requests').update({ status }).eq('id', id);
  },

  async deleteLeaveRequest(id) {
    return await supabase.from('leave_requests').delete().eq('id', id);
  }
};

export default leaveService;
