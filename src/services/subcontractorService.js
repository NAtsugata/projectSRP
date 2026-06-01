// src/services/subcontractorService.js
// Service de gestion des sous-traitants. Fichier autonome et additif.

import { supabase } from '../lib/supabaseClient';
import { getOrgId } from '../utils/orgHelper';

export const subcontractorService = {
  async getAll() {
    return await supabase
      .from('subcontractors')
      .select('*')
      .order('company_name', { ascending: true });
  },

  async create(data) {
    const orgId = getOrgId();
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      organization_id: orgId,
      company_name: data.company_name,
      contact_name: data.contact_name || null,
      email: data.email || null,
      phone: data.phone || null,
      siret: data.siret || null,
      trades: Array.isArray(data.trades) ? data.trades : [],
      notes: data.notes || null,
      is_active: data.is_active !== false,
      created_by: userData?.user?.id || null,
    };
    return await supabase.from('subcontractors').insert([payload]).select().single();
  },

  async update(id, updates) {
    return await supabase
      .from('subcontractors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
  },

  async remove(id) {
    return await supabase.from('subcontractors').delete().eq('id', id);
  },
};

export default subcontractorService;
