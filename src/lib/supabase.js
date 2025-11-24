// src/lib/supabase.js
// Clean Supabase client and authentication service

import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger';

// Load environment variables (must be defined in .env)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables missing. Check .env file.');
  // throw new Error('Supabase URL or ANON KEY not defined');
}

// Initialise Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-mobile',
      'Cache-Control': 'no-cache',
    },
  },
  db: { schema: 'public' },
});

// Authentication service used by the app
export const authService = {
  /** Sign in with email & password */
  async signIn(email, password) {
    logger.emoji('🔐', 'Tentative de connexion pour:', email);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      logger.error('❌ Erreur de connexion:', result.error);
    } else {
      logger.emoji('✅', 'Connexion réussie');
    }
    return result;
  },

  /** Sign out and clean local storage */
  async signOut() {
    logger.emoji('🚪', 'Déconnexion en cours...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          logger.error('❌ Erreur lors de la déconnexion:', error);
        }
      }
      // Clear Supabase‑related keys from storage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('supabase')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('supabase')) sessionStorage.removeItem(k);
      });
      logger.emoji('✅', 'Déconnexion réussie');
      return { error: null };
    } catch (e) {
      logger.error('❌ Erreur inattendue lors de la déconnexion:', e);
      return { error: e };
    }
  },

  /** Subscribe to auth state changes */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  /** Get current session */
  getSession() {
    return supabase.auth.getSession();
  },
};

// --- SERVICES RESTAURÉS ---

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

export const interventionService = {
  async getInterventions(userId = null, isArchived = false) {
    let query = supabase.from('interventions').select(`
      *,
      intervention_assignments (
        user_id,
        profiles (full_name)
      )
    `);

    if (userId) {
      // Filtrer par utilisateur assigné (nécessite une jointure correcte ou filtrage post-query si RLS complexe)
      // Pour simplifier, on suppose que l'utilisateur voit ce qu'il a le droit de voir via RLS
      // Mais si on veut filtrer explicitement :
      // Note: Supabase JS syntaxe pour filtrer sur relation : !inner
      query = supabase.from('interventions').select(`
        *,
        intervention_assignments!inner (user_id)
      `).eq('intervention_assignments.user_id', userId);
    }

    if (isArchived !== null) {
      query = query.eq('is_archived', isArchived);
    }

    return await query.order('scheduled_dates', { ascending: false });
  },

  async createIntervention(interventionData, assignedUserIds = [], briefingFiles = []) {
    // 1. Créer l'intervention
    const { data: intervention, error } = await supabase
      .from('interventions')
      .insert([interventionData])
      .select()
      .single();

    if (error) return { error };

    // 2. Assigner les utilisateurs
    if (assignedUserIds && assignedUserIds.length > 0) {
      const assignments = assignedUserIds.map(userId => ({
        intervention_id: intervention.id,
        user_id: userId
      }));
      const { error: assignError } = await supabase
        .from('intervention_assignments')
        .insert(assignments);

      if (assignError) logger.error('Erreur assignation:', assignError);
    }

    // 3. Upload fichiers (simplifié)
    // TODO: Implémenter upload fichiers si nécessaire

    return { data: intervention, error: null };
  },

  async updateIntervention(id, updates) {
    return await supabase.from('interventions').update(updates).eq('id', id);
  },

  async deleteIntervention(id) {
    return await supabase.from('interventions').delete().eq('id', id);
  },

  async addBriefingDocuments(id, files) {
    // Placeholder
    return { error: null };
  }
};

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

export const storageService = {
  async uploadVaultFile(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `vault/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('vault')
      .upload(filePath, file);

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from('vault')
      .getPublicUrl(filePath);

    return { publicURL: publicUrl, filePath, error: null };
  }
};

// Export a convenient client object for the rest of the app
// defined AFTER services are declared
const supabaseClient = {
  supabase,
  authService,
  profileService,
  interventionService,
  leaveService,
  vaultService,
  storageService,
};

export default supabaseClient;
