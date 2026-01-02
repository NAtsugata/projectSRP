// src/services/profileService.js
// Service de gestion des profils utilisateurs

import { supabase } from '../lib/supabaseClient';

export const profileService = {
  async getProfile(userId) {
    return await supabase.from('profiles').select('*').eq('id', userId).single();
  },

  async getAllProfiles() {
    return await supabase.from('profiles').select('*').order('full_name');
  },

  async updateProfile(userId, updates) {
    return await supabase.from('profiles').update(updates).eq('id', userId);
  }
};

export default profileService;
