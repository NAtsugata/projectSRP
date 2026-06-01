// src/services/lotService.js
// Service de gestion des lots de chantier (Phase 2 — lots par métier).
// Entièrement additif : n'altère aucune table ni flux existant.

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { getOrgId } from '../utils/orgHelper';

const BUCKET = 'intervention-files';

export const lotService = {
  // Liste les lots d'une intervention (triés par date de création).
  async getLots(interventionId) {
    return await supabase
      .from('intervention_lots')
      .select('*')
      .eq('intervention_id', interventionId)
      .order('created_at', { ascending: true });
  },

  // Crée un lot (admin). organization_id + created_by injectés automatiquement.
  async createLot(interventionId, lot) {
    const orgId = getOrgId();
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      intervention_id: interventionId,
      organization_id: orgId,
      trade_code: lot.trade_code,
      title: lot.title,
      description: lot.description || null,
      assigned_user_id: lot.assigned_user_id || null,
      created_by: userData?.user?.id || null,
    };
    return await supabase
      .from('intervention_lots')
      .insert([payload])
      .select()
      .single();
  },

  // Met à jour un lot (statut, avancement, notes, assignation, photos…).
  async updateLot(lotId, updates) {
    return await supabase
      .from('intervention_lots')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', lotId)
      .select()
      .single();
  },

  async deleteLot(lotId) {
    return await supabase.from('intervention_lots').delete().eq('id', lotId);
  },

  // Upload de photos pour un lot. Réutilise le bucket existant 'intervention-files'.
  // Renvoie la liste des photos uploadées (métadonnées) ; ne modifie pas le lot ici.
  async uploadLotPhotos(interventionId, lotId, files) {
    if (!files || files.length === 0) return { data: [], error: null };
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id || null;
    const uploaded = [];

    for (const file of files) {
      try {
        const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
        const path = `${interventionId}/lots/${lotId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (upErr) {
          logger.error('Erreur upload photo lot:', upErr);
          continue;
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push({
          name: file.name || 'photo',
          path,
          url: urlData?.publicUrl || '',
          size: file.size || null,
          type: file.type || null,
          user_id: uid,
          uploaded_at: new Date().toISOString(),
        });
      } catch (e) {
        logger.error('Erreur uploadLotPhotos:', e);
      }
    }
    return { data: uploaded, error: null };
  },
};

export default lotService;
