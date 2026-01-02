// src/services/storageService.js
// Service de gestion du stockage de fichiers Supabase

import { supabase } from '../lib/supabaseClient';
import { sanitizeFilename } from '../utils/sanitize';

export const storageService = {
  async uploadVaultFile(file, userId) {
    const safeName = sanitizeFilename(file.name);
    console.log('📦 storageService: uploadVaultFile started', { userId, fileName: safeName });
    const fileExt = safeName.split('.').pop().toLowerCase();
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

    const { data: { publicUrl } } = supabase.storage
      .from('intervention-files')
      .getPublicUrl(filePath);

    if (onProgress) onProgress(100);

    return { publicURL: publicUrl, filePath, error: null };
  },

  async deleteInterventionFile(urlOrPath) {
    let path = urlOrPath;
    if (urlOrPath.includes('supabase')) {
      const parts = urlOrPath.split('/public/intervention-files/');
      if (parts.length > 1) path = parts[1];
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

export default storageService;
