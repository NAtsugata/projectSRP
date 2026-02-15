// src/services/profileService.js
// Service de gestion des profils utilisateurs

import { supabase } from '../lib/supabaseClient';

export const profileService = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async getAllProfiles() {
    console.log('🔍 getAllProfiles called');
    console.log('🔑 Supabase URL:', supabase.supabaseUrl);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, is_admin, employee_id, avatar_url, organization_id')
      .order('full_name');

    console.log('📊 getAllProfiles result:', { data, error, count: data?.length });

    if (error) {
      console.error('❌ getAllProfiles error:', error);
    }

    return { data, error };
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  }
};

export default profileService;
