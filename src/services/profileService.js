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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
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
