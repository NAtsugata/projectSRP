// src/services/maintenanceContractService.js
// Service de gestion des contrats de maintenance

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { withOrgId } from '../utils/orgHelper';

export const maintenanceContractService = {
  // ========== CONTRATS ==========

  async getContracts(filters = {}) {
    try {
      let query = supabase
        .from('maintenance_contracts')
        .select('*')
        .order('end_date', { ascending: true })
        .limit(200);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.type) {
        query = query.eq('contract_type', filters.type);
      }

      return await query;
    } catch (error) {
      logger.error('Erreur getContracts:', error);
      return { data: [], error };
    }
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
      .insert([withOrgId(data)])
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
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      return await supabase
        .from('maintenance_contracts')
        .select('*')
        .in('status', ['active', 'pending_renewal'])
        .lte('end_date', futureDate.toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: true });
    } catch (error) {
      logger.error('Erreur getExpiringContracts:', error);
      return { data: [], error };
    }
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

    return {
      total: contracts.length,
      active: contracts.filter(c => c.status === 'active').length,
      expired: contracts.filter(c => c.status === 'expired').length,
      pendingRenewal: contracts.filter(c => c.status === 'pending_renewal').length,
      totalRevenue: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + (parseFloat(c.price) || 0), 0)
    };
  },

  // ========== HISTORIQUE ==========

  async getContractHistory(contractId) {
    try {
      const { data, error } = await supabase
        .from('contract_history')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.warn('Historique non disponible:', error.message);
        return { data: [], error: null };
      }
      return { data: data || [], error: null };
    } catch (e) {
      logger.warn('Erreur récupération historique:', e);
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
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        logger.warn('Équipements non disponibles:', error.message);
        return { data: [], error: null };
      }
      return { data: data || [], error: null };
    } catch (e) {
      logger.warn('Erreur récupération équipements:', e);
      return { data: [], error: null };
    }
  },

  async addEquipment(contractId, data) {
    const { data: equipment, error } = await supabase
      .from('contract_equipment')
      .insert([withOrgId({ ...data, contract_id: contractId })])
      .select()
      .single();

    if (error) {
      logger.error('Error adding equipment:', error);
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
      logger.error('Error updating equipment:', error);
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
      logger.error('Error deleting equipment:', error);
      return { error };
    }
    return { error: null };
  },

  // ========== RAPPORTS D'ENTRETIEN ==========

  async createMaintenanceReport(contractId, reportData) {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .insert([withOrgId({ ...reportData, contract_id: contractId })])
      .select()
      .single();

    if (error) {
      logger.error('Error creating report:', error);
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
      logger.error('Error deleting report:', error);
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
        .order('intervention_date', { ascending: false })
        .limit(100);

      if (error) {
        logger.warn('Rapports non disponibles:', error.message);
        return { data: [], error: null };
      }
      return { data: data || [], error: null };
    } catch (e) {
      logger.warn('Erreur récupération rapports:', e);
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
      logger.error('Error fetching report:', error);
      return { error };
    }
    return { data, error: null };
  },

  // ========== DÉTAILS COMPLETS ==========

  async getContractWithDetails(contractId) {
    const { data: contract, error: contractError } = await supabase
      .from('maintenance_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError) return { error: contractError };

    // Récupérer le technicien préféré
    let preferredTechnician = null;
    if (contract.preferred_technician_id) {
      const { data: tech } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', contract.preferred_technician_id)
        .single();
      preferredTechnician = tech;
    }

    // Récupérer les données associées
    const { data: visits } = await this.getContractVisits(contractId);
    const { data: equipment } = await this.getContractEquipment(contractId);
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

export default maintenanceContractService;
