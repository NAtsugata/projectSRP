// src/services/storageService.js
// Service de gestion du stockage de fichiers Supabase
// Utilise des signed URLs pour l'accès sécurisé aux fichiers privés

import { supabase } from '../lib/supabaseClient';
import { sanitizeFilename } from '../utils/sanitize';
import logger from '../utils/logger';

// Durée de validité des signed URLs (1 heure)
const SIGNED_URL_EXPIRY = 3600;

/**
 * Génère une signed URL pour accéder à un fichier privé
 */
async function getSignedUrl(bucket, filePath) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (error) {
    logger.error('Error creating signed URL:', error);
    // Fallback: tenter l'URL publique (rétrocompatibilité pendant migration)
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    return publicUrl;
  }

  return data.signedUrl;
}

export const storageService = {
  /**
   * Génère une signed URL pour un fichier existant
   */
  getSignedUrl,

  async uploadVaultFile(file, userId) {
    const safeName = sanitizeFilename(file.name);
    logger.log('storageService: uploadVaultFile started', { userId, fileName: safeName });
    const fileExt = safeName.split('.').pop().toLowerCase();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `vault/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('vault-files')
      .upload(filePath, file);

    if (uploadError) return { error: uploadError };

    const signedUrl = await getSignedUrl('vault-files', filePath);

    return { publicURL: signedUrl, filePath, error: null };
  },

  async uploadInterventionFile(file, interventionId, folder = 'general', onProgress) {
    const safeName = sanitizeFilename(file.name);
    const fileExt = safeName.split('.').pop().toLowerCase();
    const fileName = `${interventionId}/${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('intervention-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) return { error: uploadError };

    const signedUrl = await getSignedUrl('intervention-files', filePath);

    if (onProgress) onProgress(100);

    return { publicURL: signedUrl, filePath, error: null };
  },

  async deleteInterventionFile(urlOrPath) {
    let path = urlOrPath;
    if (urlOrPath.includes('supabase')) {
      const parts = urlOrPath.split('/intervention-files/');
      if (parts.length > 1) {
        path = parts[1];
        // Nettoyer les query params des signed URLs
        if (path.includes('?')) {
          path = path.split('?')[0];
        }
      }
    }

    return await supabase.storage
      .from('intervention-files')
      .remove([path]);
  },

  async uploadFile(file, path, bucket = 'vault-files') {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file);

    if (uploadError) return { error: uploadError };

    const signedUrl = await getSignedUrl(bucket, path);

    return { publicURL: signedUrl, filePath: path, error: null };
  },

  async deleteFile(path, bucket = 'vault-files') {
    return await supabase.storage
      .from(bucket)
      .remove([path]);
  },

  // Upload pour les formulaires IR Douche et notes de frais
  async uploadExpenseFile(file, userId, onProgress) {
    const safeName = sanitizeFilename(file.name);
    const fileExt = safeName.split('.').pop().toLowerCase();
    const fileName = `${userId}/ir-shower/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('intervention-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return { publicURL: null, error: uploadError };
    }

    const signedUrl = await getSignedUrl('intervention-files', filePath);

    if (onProgress) onProgress(100);

    return { publicURL: signedUrl, filePath, error: null };
  },

  /**
   * Rafraîchir une signed URL expirée à partir du filePath stocké
   */
  async refreshSignedUrl(filePath, bucket = 'intervention-files') {
    return await getSignedUrl(bucket, filePath);
  }
};

export default storageService;
