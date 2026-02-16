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
      // Essayer d'abord avec organization_id
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, is_admin, avatar_url, organization_id')
        .order('full_name');

      console.log('[DEBUG] getAllProfiles result:', {
        data,
        error,
        count: data?.length,
        errorMessage: error?.message,
        errorCode: error?.code
      });

      // Si erreur sur organization_id, réessayer sans
      if (error && (error.message?.includes('organization_id') || error.code === '42703')) {
        console.warn('[DEBUG] getAllProfiles: organization_id not found, retrying without it');
        const { data: data2, error: error2 } = await supabase
          .from('profiles')
          .select('id, full_name, is_admin, avatar_url')
          .order('full_name');
        console.log('[DEBUG] getAllProfiles retry result:', { data: data2, error: error2 });
        return { data: data2, error: error2 };
      }

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
