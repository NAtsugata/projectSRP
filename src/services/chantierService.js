// src/services/chantierService.js
// Suivi de chantier MOE : chantiers, zones, lots, membres, tâches,
// médias (zéro perte) et alertes ciblées.

import { supabase } from '../lib/supabaseClient';
import { getOrgId, withOrgId } from '../utils/orgHelper';
import { sanitizeFilename } from '../utils/sanitize';

const SIGNED_URL_EXPIRY = 3600;

export const chantierService = {
  // ===== Chantiers =====
  async getChantiers() {
    const { data, error } = await supabase
      .from('chantiers')
      .select('*, chantier_lots(id, name, status, progress)')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getChantier(id) {
    const { data, error } = await supabase
      .from('chantiers')
      .select(`*,
        chantier_zones (*),
        chantier_lots (*,
          subcontractors ( id, company_name ),
          chantier_lot_members ( id, user_id, profiles ( id, full_name ) )
        )`)
      .eq('id', id)
      .single();
    return { data, error };
  },

  async createChantier(fields) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('chantiers')
      .insert(withOrgId({ ...fields, created_by: user?.id }))
      .select()
      .single();
    return { data, error };
  },

  /** Créer un chantier ET ses lots prédéfinis en un seul appel. */
  async createChantierWithLots({ name, client_name, address, start_date, end_date, lots }) {
    const { data, error } = await supabase.rpc('create_chantier_with_lots', {
      p_name: name,
      p_client: client_name || null,
      p_address: address || null,
      p_start: start_date || null,
      p_end: end_date || null,
      p_lots: (lots && lots.length) ? lots : null,
    });
    return { id: data, error };
  },

  async updateChantier(id, updates) {
    const { data, error } = await supabase
      .from('chantiers').update(updates).eq('id', id).select().single();
    return { data, error };
  },

  // ===== Zones =====
  async createZone(chantierId, name, description = '') {
    const { data, error } = await supabase
      .from('chantier_zones')
      .insert(withOrgId({ chantier_id: chantierId, name, description }))
      .select().single();
    return { data, error };
  },

  async deleteZone(zoneId) {
    const { error } = await supabase.from('chantier_zones').delete().eq('id', zoneId);
    return { error };
  },

  // ===== Lots =====
  async createLot(chantierId, fields) {
    const { data, error } = await supabase
      .from('chantier_lots')
      .insert(withOrgId({ chantier_id: chantierId, ...fields }))
      .select().single();
    return { data, error };
  },

  async updateLot(lotId, updates) {
    const { data, error } = await supabase
      .from('chantier_lots').update(updates).eq('id', lotId).select().single();
    return { data, error };
  },

  async deleteLot(lotId) {
    const { error } = await supabase.from('chantier_lots').delete().eq('id', lotId);
    return { error };
  },

  async addLotMember(lot, userId) {
    const { error } = await supabase
      .from('chantier_lot_members')
      .insert(withOrgId({ lot_id: lot.id, chantier_id: lot.chantier_id, user_id: userId }));
    return { error };
  },

  async removeLotMember(memberId) {
    const { error } = await supabase.from('chantier_lot_members').delete().eq('id', memberId);
    return { error };
  },

  // ===== Tâches (cahier des charges) =====
  async getTasks(chantierId) {
    const { data, error } = await supabase
      .from('chantier_tasks')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('sort_order').order('created_at');
    return { data, error };
  },

  async createTask(chantierId, lotId, zoneId, title, description = '') {
    const { data, error } = await supabase
      .from('chantier_tasks')
      .insert(withOrgId({ chantier_id: chantierId, lot_id: lotId, zone_id: zoneId || null, title, description }))
      .select().single();
    return { data, error };
  },

  async setTaskStatus(taskId, status) {
    const { data, error } = await supabase
      .from('chantier_tasks').update({ status }).eq('id', taskId).select().single();
    return { data, error };
  },

  async deleteTask(taskId) {
    const { error } = await supabase.from('chantier_tasks').delete().eq('id', taskId);
    return { error };
  },

  // ===== Médias (preuves visuelles — zéro perte) =====
  async getMedia(chantierId) {
    const { data, error } = await supabase
      .from('chantier_media')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('taken_at', { ascending: false });
    return { data, error };
  },

  /**
   * Upload d'une preuve visuelle : lot obligatoire, zone si définie,
   * auteur + horodatage figés côté base. Fichier stocké dans un bucket
   * sans aucune politique de suppression.
   */
  async uploadMedia({ chantier, lot, zoneId, file, caption, uploaderName, companyName }) {
    const orgId = getOrgId();
    if (!orgId) return { error: { message: 'Organisation inconnue' } };
    if (!lot?.id) return { error: { message: 'Le lot est obligatoire' } };

    const { data: { user } } = await supabase.auth.getUser();
    const safeName = sanitizeFilename(file.name || 'photo.jpg');
    const path = `${orgId}/chantiers/${chantier.id}/${lot.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from('chantier-media')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) return { error: upErr };

    const { data, error } = await supabase
      .from('chantier_media')
      .insert(withOrgId({
        chantier_id: chantier.id,
        lot_id: lot.id,
        zone_id: zoneId || null,
        uploaded_by: user?.id,
        uploader_name: uploaderName || null,
        company_name: companyName || lot.subcontractors?.company_name || null,
        file_path: path,
        file_name: safeName,
        caption: caption || null,
      }))
      .select().single();

    if (error) return { error };
    return { data, error: null };
  },

  async getMediaUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('chantier-media')
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);
    return { url: data?.signedUrl || null, error };
  },

  /** Retrait (soft delete) : le fichier et la ligne sont conservés. */
  async softDeleteMedia(mediaId) {
    const { error } = await supabase
      .from('chantier_media').update({ is_deleted: true }).eq('id', mediaId);
    return { error };
  },

  /** Restauration (MOE uniquement). */
  async restoreMedia(mediaId) {
    const { error } = await supabase
      .from('chantier_media').update({ is_deleted: false }).eq('id', mediaId);
    return { error };
  },

  // ===== Documents de référence (MOE) =====
  async getDocuments(chantierId) {
    const { data, error } = await supabase
      .from('chantier_documents')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async uploadDocument({ chantier, lotId, category, title, file, uploaderName }) {
    const orgId = getOrgId();
    if (!orgId) return { error: { message: 'Organisation inconnue' } };
    const { data: { user } } = await supabase.auth.getUser();
    const safeName = sanitizeFilename(file.name || 'document');
    const path = `${orgId}/chantiers/${chantier.id}/documents/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from('chantier-docs')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) return { error: upErr };

    const { data, error } = await supabase
      .from('chantier_documents')
      .insert(withOrgId({
        chantier_id: chantier.id,
        lot_id: lotId || null,
        category: category || 'autre',
        title: title || safeName,
        file_path: path,
        file_name: safeName,
        uploaded_by: user?.id,
        uploader_name: uploaderName || null,
      }))
      .select().single();
    return { data, error };
  },

  async getDocumentUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('chantier-docs')
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);
    return { url: data?.signedUrl || null, error };
  },

  async deleteDocument(doc) {
    // Retire l'enregistrement puis le fichier (MOE uniquement, RLS)
    const { error } = await supabase.from('chantier_documents').delete().eq('id', doc.id);
    if (!error && doc.file_path) {
      await supabase.storage.from('chantier-docs').remove([doc.file_path]);
    }
    return { error };
  },

  // ===== Journal d'audit (MOE) =====
  async getJournal(chantierId, limit = 100) {
    const { data, error } = await supabase
      .from('chantier_events')
      .select('*')
      .eq('chantier_id', chantierId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  // ===== Alertes ciblées =====
  async sendAlert(chantierId, title, message, lotId = null) {
    const { data, error } = await supabase.rpc('send_chantier_alert', {
      p_chantier: chantierId,
      p_title: title,
      p_message: message,
      p_lot: lotId,
    });
    return { count: data, error };
  },
};

export default chantierService;
