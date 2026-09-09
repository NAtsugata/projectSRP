// src/services/storageService.js
// Service de gestion du stockage de fichiers Supabase
// Utilise des signed URLs pour l'accès sécurisé aux fichiers privés

import { supabase } from '../lib/supabaseClient';
import { sanitizeFilename } from '../utils/sanitize';
import { getOrgId } from '../utils/orgHelper';
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
    // Si le fichier n'existe pas, c'est normal (supprimé du storage mais encore en BDD)
    // On ne log que les autres erreurs
    if (error.message && !error.message.includes('Object not found')) {
      logger.error('Error creating signed URL:', error);
    }
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
    // Arborescence canonique : {org}/employees/{user}/vault/...
    // (repli sur l'ancien schéma si l'organisation n'est pas encore chargée)
    const orgId = getOrgId();
    const filePath = orgId
      ? `${orgId}/employees/${userId}/vault/${Date.now()}.${fileExt}`
      : `vault/${userId}/${Date.now()}.${fileExt}`;

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
    // Arborescence canonique : {org}/interventions/{id}/{dossier}/...
    const orgId = getOrgId();
    const baseName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = orgId
      ? `${orgId}/interventions/${interventionId}/${folder}/${baseName}`
      : `${interventionId}/${folder}/${baseName}`;

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
    // Arborescence canonique : {org}/employees/{user}/ir-shower/...
    const orgId = getOrgId();
    const baseName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = orgId
      ? `${orgId}/employees/${userId}/ir-shower/${baseName}`
      : `${userId}/ir-shower/${baseName}`;

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
  },

  /**
   * Extraire le chemin de fichier d'une URL Supabase
   */
  extractFilePath(url, bucket = 'intervention-files') {
    if (!url || typeof url !== 'string') return null;

    // Pattern pour les signed URLs: /storage/v1/object/sign/bucket-name/path?token=...
    // Pattern pour les public URLs: /storage/v1/object/public/bucket-name/path
    const signedPattern = new RegExp(`/storage/v1/object/sign/${bucket}/(.+?)(?:\\?|$)`);
    const publicPattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+?)(?:\\?|$)`);

    const match = url.match(signedPattern) || url.match(publicPattern);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }

    // Fallback: chercher après le nom du bucket
    const parts = url.split(`/${bucket}/`);
    if (parts.length > 1) {
      let path = parts[1];
      // Nettoyer les query params
      if (path.includes('?')) {
        path = path.split('?')[0];
      }
      return decodeURIComponent(path);
    }

    return null;
  },

  /**
   * Rafraîchir les URLs de tous les fichiers d'un rapport d'intervention
   * Retourne les fichiers avec les nouvelles URLs signées
   */
  async refreshReportFileUrls(files, bucket = 'intervention-files') {
    if (!Array.isArray(files) || files.length === 0) {
      return files;
    }

    const refreshedFiles = await Promise.all(
      files.map(async (file) => {
        // Si pas d'URL ou URL locale (blob:), ne pas rafraîchir
        if (!file.url || file.url.startsWith('blob:') || file.url.startsWith('data:')) {
          return file;
        }

        // Extraire le chemin du fichier
        const filePath = this.extractFilePath(file.url, bucket);
        if (!filePath) {
          logger.warn('Impossible d\'extraire le chemin du fichier:', file.url);
          return file;
        }

        try {
          // Générer une nouvelle signed URL
          const newUrl = await getSignedUrl(bucket, filePath);
          logger.log('✅ URL rafraîchie pour:', filePath);
          return { ...file, url: newUrl };
        } catch (error) {
          logger.error('Erreur rafraîchissement URL:', error);
          return file;
        }
      })
    );

    return refreshedFiles;
  }
};

export default storageService;
