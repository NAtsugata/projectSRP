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
    console.log('[DEBUG] getAllProfiles: calling supabase...');
    try {
      // Utiliser select('*') pour récupérer toutes les colonnes existantes
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      console.log('[DEBUG] getAllProfiles result:', {
        data,
        error,
        count: data?.length,
        errorMessage: error?.message,
        columns: data?.[0] ? Object.keys(data[0]) : []
      });

      return { data, error };
    } catch (e) {
      console.error('[DEBUG] getAllProfiles exception:', e);
      return { data: null, error: e };
    }
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
