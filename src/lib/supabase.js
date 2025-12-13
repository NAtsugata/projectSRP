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

// Initialise Supabase client avec optimisations mobile
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-mobile',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
    fetch: (url, options = {}) => {
      // Timeout de 30 secondes pour les requêtes mobiles
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
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
    // Nettoyer les données (retirer les champs UI-only qui ne sont pas dans la BDD)
    const {
      assignedUserIds: _1,
      files: _2,
      briefingFiles: _3,
      ...cleanData
    } = interventionData;

    // Sanitize integer fields (convert empty strings to null)
    if (cleanData.km_start === '') cleanData.km_start = null;
    if (cleanData.km_end === '') cleanData.km_end = null;

    // 1. Créer l'intervention
    const { data: intervention, error } = await supabase
      .from('interventions')
      .insert([cleanData])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création intervention:', error);
      return { error };
    }

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
    console.log('📦 storageService: uploadVaultFile started', { userId, fileName: file.name });
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `vault/${fileName}`;

    console.log('📦 storageService: uploading to', filePath);
    const { error: uploadError } = await supabase.storage
      .from('vault-files')
      .upload(filePath, file);

    console.log('📦 storageService: upload result', { uploadError });

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from('vault-files')
      .getPublicUrl(filePath);

    return { publicURL: publicUrl, filePath, error: null };
  },

  async uploadInterventionFile(file, interventionId, folder = 'general', onProgress) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${interventionId}/${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName; // Le bucket est la racine

    // Note: Supabase JS SDK ne supporte pas onProgress nativement dans upload() simple
    // On utilise upload() standard
    const { error: uploadError } = await supabase.storage
      .from('intervention-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from('intervention-files')
      .getPublicUrl(filePath);

    // Simuler progression 100%
    if (onProgress) onProgress(100);

    return { publicURL: publicUrl, filePath, error: null };
  },

  async deleteInterventionFile(urlOrPath) {
    // Extraire le path de l'URL si nécessaire
    let path = urlOrPath;
    if (urlOrPath.includes('supabase')) {
      const parts = urlOrPath.split('/public/intervention-files/');
      if (parts.length > 1) path = parts[1];
    }

    return await supabase.storage
      .from('intervention-files')
      .remove([path]);
  },

  // Generic methods for other services (like scannedDocumentsService)
  async uploadFile(file, path, bucket = 'vault-files') {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return { publicURL: publicUrl, filePath: path, error: null };
  },

  async deleteFile(path, bucket = 'vault-files') {
    return await supabase.storage
      .from(bucket)
      .remove([path]);
  }
};

// --- MAINTENANCE CONTRACTS SERVICE ---

export const maintenanceContractService = {
  // ========== CONTRATS ==========

  async getContracts(filters = {}) {
    let query = supabase
      .from('maintenance_contracts')
      .select('*')
      .order('end_date', { ascending: true });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.type) {
      query = query.eq('contract_type', filters.type);
    }

    return await query;
  },

  async getContractById(id) {
    return await supabase
      .from('maintenance_contracts')
      .select('*')
      .eq('id', id)
      .single();
  },

  async createContract(data) {
    const { data: contract, error } = await supabase
      .from('maintenance_contracts')
      .insert([data])
      .select()
      .single();

    if (error) return { error };

    // Générer automatiquement les visites
    if (contract) {
      await this.generateVisits(contract.id);
    }

    return { data: contract, error: null };
  },

  async updateContract(id, updates) {
    const { data, error } = await supabase
      .from('maintenance_contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    // Regénérer les visites si les dates ou la fréquence ont changé
    if (updates.start_date || updates.end_date || updates.frequency) {
      await this.generateVisits(id);
    }

    return { data, error: null };
  },

  async deleteContract(id) {
    // Les visites seront supprimées automatiquement (ON DELETE CASCADE)
    return await supabase
      .from('maintenance_contracts')
      .delete()
      .eq('id', id);
  },

  // ========== VISITES ==========

  async getContractVisits(contractId) {
    return await supabase
      .from('contract_visits')
      .select('*, maintenance_contracts(client_name)')
      .eq('contract_id', contractId)
      .order('scheduled_date', { ascending: true });
  },

  async getAllVisits(filters = {}) {
    let query = supabase
      .from('contract_visits')
      .select('*, maintenance_contracts(client_name, client_address, client_phone, contract_type)')
      .order('scheduled_date', { ascending: true });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.fromDate) {
      query = query.gte('scheduled_date', filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte('scheduled_date', filters.toDate);
    }

    return await query;
  },

  async generateVisits(contractId) {
    // Appel de la fonction SQL
    const { data, error } = await supabase.rpc('generate_contract_visits', {
      p_contract_id: contractId
    });

    if (error) {
      logger.error('Erreur génération visites:', error);
      return { error };
    }

    return { data, error: null };
  },

  async updateVisitStatus(visitId, status, notes = null) {
    const updates = { status };

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    if (notes) {
      updates.technician_notes = notes;
    }

    return await supabase
      .from('contract_visits')
      .update(updates)
      .eq('id', visitId);
  },

  async linkVisitToIntervention(visitId, interventionId) {
    return await supabase
      .from('contract_visits')
      .update({
        intervention_id: interventionId,
        status: 'scheduled'
      })
      .eq('id', visitId);
  },

  // ========== ALERTES ==========

  async getExpiringContracts(days = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await supabase
      .from('maintenance_contracts')
      .select('*')
      .in('status', ['active', 'pending_renewal'])
      .lte('end_date', futureDate.toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('end_date', { ascending: true });
  },

  async getUpcomingVisits(days = 7) {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await supabase
      .from('contract_visits')
      .select('*, maintenance_contracts(client_name, client_address, client_phone, contract_type)')
      .in('status', ['pending', 'scheduled'])
      .gte('scheduled_date', today)
      .lte('scheduled_date', futureDate.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });
  },

  async getContractStats() {
    const { data: contracts } = await supabase
      .from('maintenance_contracts')
      .select('status, price');

    if (!contracts) return null;

    const stats = {
      total: contracts.length,
      active: contracts.filter(c => c.status === 'active').length,
      expired: contracts.filter(c => c.status === 'expired').length,
      pendingRenewal: contracts.filter(c => c.status === 'pending_renewal').length,
      totalRevenue: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (parseFloat(c.price) || 0), 0)
    };

    return stats;
  },

  // ========== HISTORIQUE ==========

  async getContractHistory(contractId) {
    try {
      const { data, error } = await supabase
        .from('contract_history')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Historique non disponible:', error.message);
        return { data: [], error: null };
      }
      return { data: data || [], error: null };
    } catch (e) {
      console.warn('Erreur récupération historique:', e);
      return { data: [], error: null };
    }
  },

  // ========== ÉQUIPEMENTS ==========

  async getContractEquipment(contractId) {
    try {
      const { data, error } = await supabase
        .from('contract_equipment')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Équipements non disponibles:', error.message);
        return { data: [], error: null };
      }
      return { data: data || [], error: null };
    } catch (e) {
      console.warn('Erreur récupération équipements:', e);
      return { data: [], error: null };
    }
  },

  async addEquipment(contractId, data) {
    const { data: equipment, error } = await supabase
      .from('contract_equipment')
      .insert([{ ...data, contract_id: contractId }])
      .select()
      .single();

    if (error) {
      console.error('Error adding equipment:', error);
      return { error };
    }
    return { data: equipment, error: null };
  },

  async updateEquipment(equipmentId, updates) {
    const { data, error } = await supabase
      .from('contract_equipment')
      .update(updates)
      .eq('id', equipmentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating equipment:', error);
      return { error };
    }
    return { data, error: null };
  },

  async deleteEquipment(equipmentId) {
    const { error } = await supabase
      .from('contract_equipment')
      .delete()
      .eq('id', equipmentId);

    if (error) {
      console.error('Error deleting equipment:', error);
      return { error };
    }
    return { error: null };
  },

  // ========== RAPPORTS D'ENTRETIEN ==========

  async createMaintenanceReport(contractId, reportData) {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .insert([{ ...reportData, contract_id: contractId }])
      .select()
      .single();

    if (error) {
      console.error('Error creating report:', error);
      return { error };
    }
    return { data, error: null };
  },

  async deleteMaintenanceReport(reportId) {
    const { error } = await supabase
      .from('maintenance_reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      console.error('Error deleting report:', error);
      return { error };
    }
    return { error: null };
  },

  async getContractReports(contractId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_reports')
        .select('*')
        .eq('contract_id', contractId)
        .order('intervention_date', { ascending: false });

      if (error) {
        console.warn('Rapports non disponibles:', error.message);
        return { data: [], error: null };
      }
      return { data: data || [], error: null };
    } catch (e) {
      console.warn('Erreur récupération rapports:', e);
      return { data: [], error: null };
    }
  },

  async getReport(reportId) {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error) {
      console.error('Error fetching report:', error);
      return { error };
    }
    return { data, error: null };
  },

  // ========== DÉTAILS COMPLETS ==========

  async getContractWithDetails(contractId) {
    // Récupérer le contrat (sans relations imbriquées pour éviter les erreurs de cache)
    const { data: contract, error: contractError } = await supabase
      .from('maintenance_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError) return { error: contractError };

    // Récupérer le technicien préféré séparément si défini
    let preferredTechnician = null;
    if (contract.preferred_technician_id) {
      const { data: tech } = await supabase
        .from('profiles')
        .select('id, display_name, full_name')
        .eq('id', contract.preferred_technician_id)
        .single();
      preferredTechnician = tech;
    }

    // Récupérer les visites
    const { data: visits } = await this.getContractVisits(contractId);

    // Récupérer les équipements
    const { data: equipment } = await this.getContractEquipment(contractId);

    // Récupérer l'historique
    const { data: history } = await this.getContractHistory(contractId);

    return {
      data: {
        ...contract,
        preferred_technician: preferredTechnician,
        visits: visits || [],
        equipment: equipment || [],
        history: history || []
      },
      error: null
    };
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
  maintenanceContractService,
};

export default supabaseClient;

