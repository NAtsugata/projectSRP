// src/services/clientService.js
// Service de gestion des clients (CRM)

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { withOrgId, getOrgId } from '../utils/orgHelper';

export const clientService = {
  /**
   * Recuperer tous les clients de l'organisation
   * @param {Object} options - Options de filtrage
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getClients(options = {}) {
    const {
      searchTerm = null,
      clientType = null,
      city = null,
      isActive = true,
      limit = 100,
      offset = 0
    } = options;

    try {
      let query = supabase
        .from('clients')
        .select(`
          *,
          client_contacts (
            id,
            first_name,
            last_name,
            role,
            email,
            phone,
            is_primary
          )
        `)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      // Filtres
      if (isActive !== null) {
        query = query.eq('is_active', isActive);
      }

      if (clientType) {
        query = query.eq('client_type', clientType);
      }

      if (city) {
        query = query.ilike('city', `%${city}%`);
      }

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.log('📇 getClients:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getClients:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer un client par son ID
   * @param {string} clientId - ID du client
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getClientById(clientId) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          client_contacts (
            id,
            first_name,
            last_name,
            role,
            email,
            phone,
            mobile,
            is_primary,
            receives_invoices,
            receives_reports,
            notes
          )
        `)
        .eq('id', clientId)
        .single();

      if (error) throw error;

      logger.log('📇 getClientById:', clientId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getClientById:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer un nouveau client
   * @param {Object} clientData - Donnees du client
   * @param {Array} contacts - Contacts associes
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createClient(clientData, contacts = []) {
    try {
      // Creer le client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([withOrgId(clientData)])
        .select()
        .single();

      if (clientError) throw clientError;

      // Creer les contacts si fournis
      if (contacts && contacts.length > 0) {
        const contactsWithRefs = contacts.map(contact => ({
          ...contact,
          client_id: client.id,
          organization_id: getOrgId()
        }));

        const { error: contactsError } = await supabase
          .from('client_contacts')
          .insert(contactsWithRefs);

        if (contactsError) {
          logger.error('⚠️ Erreur creation contacts:', contactsError);
        }
      }

      logger.log('✅ Client cree:', client.id);
      return { data: client, error: null };
    } catch (error) {
      logger.error('❌ Erreur createClient:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour un client
   * @param {string} clientId - ID du client
   * @param {Object} updates - Modifications
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateClient(clientId, updates) {
    try {
      // Nettoyer les updates pour eviter d'envoyer des champs vides ou undefined
      const cleanedUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanedUpdates[key] = value;
        }
      }

      const { data, error, count } = await supabase
        .from('clients')
        .update({
          ...cleanedUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId)
        .select();

      if (error) throw error;

      // Verifier si la mise a jour a reussi (au moins 1 ligne modifiee)
      if (!data || data.length === 0) {
        throw new Error('Impossible de modifier le client. Verifiez vos permissions.');
      }

      logger.log('✅ Client mis a jour:', clientId, cleanedUpdates);
      return { data: data[0], error: null };
    } catch (error) {
      logger.error('❌ Erreur updateClient:', error);
      return { data: null, error };
    }
  },

  /**
   * Desactiver un client (soft delete)
   * @param {string} clientId - ID du client
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deactivateClient(clientId) {
    return this.updateClient(clientId, { is_active: false });
  },

  /**
   * Reactiver un client
   * @param {string} clientId - ID du client
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async reactivateClient(clientId) {
    return this.updateClient(clientId, { is_active: true });
  },

  /**
   * Supprimer definitivement un client
   * @param {string} clientId - ID du client
   * @returns {Promise<{error: Object}>}
   */
  async deleteClient(clientId) {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      logger.log('🗑️ Client supprime:', clientId);
      return { error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteClient:', error);
      return { error };
    }
  },

  // ==========================================
  // Gestion des contacts
  // ==========================================

  /**
   * Ajouter un contact a un client
   * @param {string} clientId - ID du client
   * @param {Object} contactData - Donnees du contact
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async addContact(clientId, contactData) {
    try {
      const { data, error } = await supabase
        .from('client_contacts')
        .insert([{
          ...contactData,
          client_id: clientId,
          organization_id: getOrgId()
        }])
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Contact ajoute:', data.id);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur addContact:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour un contact
   * @param {string} contactId - ID du contact
   * @param {Object} updates - Modifications
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateContact(contactId, updates) {
    try {
      const { data, error } = await supabase
        .from('client_contacts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ Contact mis a jour:', contactId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateContact:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un contact
   * @param {string} contactId - ID du contact
   * @returns {Promise<{error: Object}>}
   */
  async deleteContact(contactId) {
    try {
      const { error } = await supabase
        .from('client_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      logger.log('🗑️ Contact supprime:', contactId);
      return { error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteContact:', error);
      return { error };
    }
  },

  /**
   * Definir un contact comme principal
   * @param {string} clientId - ID du client
   * @param {string} contactId - ID du contact
   * @returns {Promise<{error: Object}>}
   */
  async setPrimaryContact(clientId, contactId) {
    try {
      // D'abord, retirer le flag primary de tous les contacts du client
      await supabase
        .from('client_contacts')
        .update({ is_primary: false })
        .eq('client_id', clientId);

      // Puis definir le nouveau contact principal
      const { error } = await supabase
        .from('client_contacts')
        .update({ is_primary: true })
        .eq('id', contactId);

      if (error) throw error;

      logger.log('✅ Contact principal defini:', contactId);
      return { error: null };
    } catch (error) {
      logger.error('❌ Erreur setPrimaryContact:', error);
      return { error };
    }
  },

  // ==========================================
  // Historique et statistiques
  // ==========================================

  /**
   * Recuperer l'historique des interventions d'un client
   * @param {string} clientId - ID du client
   * @param {number} limit - Nombre max de resultats
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getClientInterventions(clientId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          *,
          intervention_assignments (
            user_id,
            profiles (full_name)
          )
        `)
        .eq('client_id', clientId)
        .order('scheduled_dates', { ascending: false })
        .limit(limit);

      if (error) throw error;

      logger.log('📋 getClientInterventions:', { clientId, count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getClientInterventions:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer les contrats de maintenance d'un client
   * @param {string} clientId - ID du client
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getClientContracts(clientId) {
    try {
      // Note: maintenance_contracts n'a pas de client_id, retourner un tableau vide pour l'instant
      // TODO: Ajouter client_id a maintenance_contracts si necessaire
      return { data: [], error: null };
    } catch (error) {
      logger.error('❌ Erreur getClientContracts:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer les statistiques d'un client
   * @param {string} clientId - ID du client
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getClientStats(clientId) {
    try {
      // Compter les interventions par statut
      const { data: interventions, error: intError } = await supabase
        .from('interventions')
        .select('id, status')
        .eq('client_id', clientId);

      if (intError) throw intError;

      const stats = {
        totalInterventions: interventions?.length || 0,
        completedInterventions: interventions?.filter(i => i.status === 'completed').length || 0,
        pendingInterventions: interventions?.filter(i => i.status === 'pending').length || 0,
        inProgressInterventions: interventions?.filter(i => i.status === 'in_progress').length || 0,
        activeContracts: 0 // maintenance_contracts n'a pas de client_id
      };

      return { data: stats, error: null };
    } catch (error) {
      logger.error('❌ Erreur getClientStats:', error);
      return { data: null, error };
    }
  },

  /**
   * Recherche rapide de clients (pour autocomplete dans le formulaire intervention)
   * @param {string} searchTerm - Terme de recherche
   * @param {number} limit - Nombre max de resultats
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async searchClients(searchTerm, limit = 10) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return { data: [], error: null };
      }

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company_name, email, phone, mobile, address, address_complement, postal_code, city')
        .eq('is_active', true)
        .or(`name.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%`)
        .order('name')
        .limit(limit);

      if (error) throw error;

      return { data: data || [], error: null };
    } catch (error) {
      logger.error('❌ Erreur searchClients:', error);
      return { data: [], error };
    }
  },

  /**
   * Creer ou retrouver un client a partir des infos d'une intervention
   * Si un client avec le meme nom existe deja, on le retourne.
   * Sinon, on le cree.
   * @param {Object} interventionData - Donnees de l'intervention (client, address, client_phone, client_email)
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getOrCreateClientFromIntervention(interventionData) {
    try {
      const clientName = interventionData.client?.trim();
      if (!clientName) return { data: null, error: null };

      // Chercher un client existant avec le meme nom
      const { data: existing, error: searchError } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', clientName)
        .limit(1)
        .single();

      if (existing && !searchError) {
        // Client existant trouve - mettre a jour ses infos si manquantes
        const updates = {};
        if (interventionData.address && !existing.address) updates.address = interventionData.address;
        if (interventionData.client_phone && !existing.phone) updates.phone = interventionData.client_phone;
        if (interventionData.client_email && !existing.email) updates.email = interventionData.client_email;

        if (Object.keys(updates).length > 0) {
          await supabase.from('clients').update(updates).eq('id', existing.id);
        }

        return { data: existing, error: null };
      }

      // Creer un nouveau client
      const newClient = {
        name: clientName,
        phone: interventionData.client_phone || null,
        email: interventionData.client_email || null,
        address: interventionData.address || null,
      };

      const { data: created, error: createError } = await supabase
        .from('clients')
        .insert([withOrgId(newClient)])
        .select('id, name')
        .single();

      if (createError) {
        logger.warn('⚠️ Impossible de creer le client automatiquement:', createError);
        return { data: null, error: createError };
      }

      logger.log('✅ Client auto-cree depuis intervention:', created.name);
      return { data: created, error: null };
    } catch (error) {
      // Ne pas bloquer la creation d'intervention si la creation client echoue
      logger.warn('⚠️ Erreur getOrCreateClientFromIntervention:', error);
      return { data: null, error };
    }
  },

  /**
   * Migration: extraire les clients uniques depuis les interventions existantes
   * A executer une seule fois pour importer les clients historiques
   * @returns {Promise<{imported: number, skipped: number, error: Object}>}
   */
  async extractClientsFromInterventions() {
    try {
      // Recuperer toutes les interventions avec infos client
      const { data: interventions, error: fetchError } = await supabase
        .from('interventions')
        .select('client, address, client_phone, client_email, organization_id, created_by')
        .not('client', 'is', null)
        .neq('client', '');

      if (fetchError) throw fetchError;

      if (!interventions || interventions.length === 0) {
        return { imported: 0, skipped: 0, error: null };
      }

      // Recuperer les clients existants pour eviter les doublons
      const { data: existingClients } = await supabase
        .from('clients')
        .select('name, organization_id');

      const existingSet = new Set(
        (existingClients || []).map(c => `${c.name?.toLowerCase()}|${c.organization_id}`)
      );

      // Deduplication par nom+org
      const uniqueClients = new Map();
      for (const i of interventions) {
        const key = `${i.client?.toLowerCase()}|${i.organization_id}`;
        if (!existingSet.has(key) && !uniqueClients.has(key)) {
          uniqueClients.set(key, {
            name: i.client,
            phone: i.client_phone || null,
            email: i.client_email || null,
            address: i.address || null,
            organization_id: i.organization_id,
            created_by: i.created_by
          });
        }
      }

      if (uniqueClients.size === 0) {
        return { imported: 0, skipped: interventions.length, error: null };
      }

      // Inserer par batch de 50
      const clientsArray = Array.from(uniqueClients.values());
      let imported = 0;
      const batchSize = 50;

      for (let i = 0; i < clientsArray.length; i += batchSize) {
        const batch = clientsArray.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('clients')
          .insert(batch);

        if (!insertError) {
          imported += batch.length;
        } else {
          logger.warn('⚠️ Erreur batch insert clients:', insertError);
        }
      }

      logger.log(`✅ Migration clients: ${imported} importes, ${interventions.length - imported} ignores`);
      return { imported, skipped: interventions.length - imported, error: null };
    } catch (error) {
      logger.error('❌ Erreur extractClientsFromInterventions:', error);
      return { imported: 0, skipped: 0, error };
    }
  },

  /**
   * Exporter les clients au format CSV
   * @returns {Promise<string>}
   */
  async exportClientsCSV() {
    try {
      const { data: clients, error } = await this.getClients({ isActive: null, limit: 10000 });

      if (error) throw error;

      const headers = ['Nom', 'Societe', 'Type', 'Email', 'Telephone', 'Adresse', 'Code postal', 'Ville', 'Actif'];
      const rows = clients.map(c => [
        c.name,
        c.company_name || '',
        c.client_type,
        c.email || '',
        c.phone || '',
        c.address || '',
        c.postal_code || '',
        c.city || '',
        c.is_active ? 'Oui' : 'Non'
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');

      return csv;
    } catch (error) {
      logger.error('❌ Erreur exportClientsCSV:', error);
      throw error;
    }
  }
};

export default clientService;
