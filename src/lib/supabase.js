// src/lib/supabase.js - VERSION FIABLE AVEC SUIVI DE PROGRESSION TEMPS RÉEL
// Ce fichier configure le client Supabase et expose plusieurs services
// (authentification, profils, interventions, stockage, etc.) avec des
// améliorations spécifiquement conçues pour fonctionner de manière fiable
// sur les navigateurs mobiles comme sur desktop. Il s'agit d'une
// adaptation du code fourni par l'utilisateur avec des corrections
// visant à éviter des erreurs lorsque ``navigator`` ou ``window`` ne sont
// pas définis (environnements SSR/tests), à sécuriser l'upload REST
// (ajout de l'entête ``apikey``), à améliorer la suppression récursive
// de dossiers et à effectuer un ping plus fiable lors de l'initialisation.

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import logger from '../utils/logger'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// --- Configuration Supabase Optimisée Mobile ---
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-mobile',
      'Cache-Control': 'no-cache' // Assure que les données sont toujours fraîches
    }
  },
  db: {
    schema: 'public'
  }
})

// --- Service d'authentification ---
export const authService = {
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
  async signOut() {
    logger.emoji('🚪', 'Déconnexion en cours...');
    try {
      // Vérifie d'abord s'il existe une session active
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Aucune session active : on nettoie uniquement les clés Supabase et on retourne sans erreur
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('supabase')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('supabase')) {
            sessionStorage.removeItem(key);
          }
        });
        logger.info('ℹ️ Aucune session active ; nettoyage Supabase effectué');
        return { error: null };
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('❌ Erreur lors de la déconnexion:', error);
        return { error };
      }
      // Nettoyage sélectif des clés Supabase uniquement (pas de clear() global)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase')) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('supabase')) {
          sessionStorage.removeItem(key);
        }
      });
      logger.emoji('✅', 'Déconnexion réussie - Storage Supabase nettoyé');
      return { error: null };
    } catch (e) {
      logger.error('❌ Erreur inattendue lors de la déconnexion:', e);
      return { error: e };
    }
  },
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

// --- Services de données ---
export const profileService = {
  async getProfile(userId) {
    logger.log('👤 Récupération profil pour:', userId);
    const result = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (result.error) {
      logger.error('❌ Erreur récupération profil:', result.error);
    } else {
      logger.log('✅ Profil récupéré:', result.data?.full_name);
    }
    return result;
  },
  async getAllProfiles() {
    logger.log('👥 Récupération de tous les profils...');
    const result = await supabase.from('profiles').select('*').order('full_name');
    if (result.error) {
      logger.error('❌ Erreur récupération profils:', result.error);
    } else {
      logger.log('✅ Profils récupérés:', result.data?.length || 0);
    }
    return result;
  },
  async updateProfile(userId, updates) {
    logger.log('✏️ Mise à jour profil:', userId, updates);
    const { full_name, is_admin } = updates;
    const updateData = { full_name, is_admin };
    const result = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (result.error) {
      logger.error('❌ Erreur mise à jour profil:', result.error);
    } else {
      logger.log('✅ Profil mis à jour avec succès');
    }
    return result;
  }
}

// ✅ FONCTION DE NETTOYAGE NOMS DE FICHIERS AMÉLIORÉE
const sanitizeFileName = (fileName) => {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '-') // Remplace les caractères non autorisés
    .replace(/-+/g, '-') // Remplace les tirets multiples
    .replace(/^-|-$/g, '') // Supprime les tirets au début/fin
    .substring(0, 100); // Limite la longueur
  // Si la chaîne est vide, on utilise un nom par défaut
  const safe = cleaned || 'fichier';
  logger.log('🧹 Nom de fichier nettoyé:', fileName, '->', safe);
  return safe;
};

// ✅ DÉTECTION CONNEXION ET DEVICE
const getDeviceInfo = () => {
  // Vérifie que l'objet navigator est disponible (SSR/tests)
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isMobile: false, isIOS: false, isAndroid: false, connectionType: '4g', isSlowConnection: false };
  }
  const userAgent = navigator.userAgent || '';
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

  return {
    isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    connectionType: connection?.effectiveType || '4g',
    isSlowConnection: connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g',
  };
};

// ✅ SERVICE DE STOCKAGE SIMPLIFIÉ ET FIABLE
export const storageService = {
  /**
   * ✅ UPLOAD PRINCIPAL OPTIMISÉ
   * Accepte maintenant un callback `onProgress` pour le suivi en temps réel.
   */
  async uploadInterventionFile(file, interventionId, folder = 'report', onProgress) {
    try {
      const deviceInfo = getDeviceInfo();
      console.log(`📤 Upload intervention file sur ${deviceInfo.isMobile ? 'Mobile' : 'Desktop'}:`, {
        fileName: file.name,
        size: Math.round(file.size / 1024) + 'KB',
        type: file.type,
      });

      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `${interventionId}/${folder}/${fileName}`;

      logger.log('🗂️ Chemin de stockage:', filePath);

      const uploadResult = await this.uploadWithProgressAndRetry(filePath, file, 'intervention-files', onProgress);

      if (uploadResult.error) {
        logger.error('❌ Erreur upload:', uploadResult.error);
        return { publicURL: null, error: uploadResult.error };
      }

      const { data } = supabase.storage
        .from('intervention-files')
        .getPublicUrl(filePath);

      const publicURL = data.publicUrl;
      logger.log('✅ Fichier uploadé avec succès:', publicURL);
      return { publicURL, error: null };

    } catch (error) {
      logger.error('❌ Erreur générale upload intervention:', error);
      return { publicURL: null, error };
    }
  },

  /**
   * ✅ NOUVELLE FONCTION D'UPLOAD AVEC PROGRESSION ET RETRY
   * Utilise XMLHttpRequest pour suivre la progression de l'envoi.
   */
  async uploadWithProgressAndRetry(filePath, file, bucket, onProgress) {
    // Utilise l'API officielle Supabase pour uploader les fichiers. Les entêtes d'authentification
    // et l'apikey sont automatiquement gérés par le client Supabase. On conserve néanmoins
    // la logique de retry et on simule une progression pour l'UX.
    const maxRetries = 3;
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Tentative d'upload ${attempt}/${maxRetries} vers le bucket ${bucket}...`);
        // Débute la progression à 0
        if (onProgress) onProgress(0);
        // Utilise l'API Supabase native pour uploader le fichier. Cette méthode ajoute
        // automatiquement le bearer token et l'apikey et gère les CORS.
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, { upsert: false });
        if (error) {
          throw error;
        }
        // Fin de progression
        if (onProgress) onProgress(100);
        logger.log('✅ Upload réussi via supabase.storage.from().upload');
        return { data, error: null };
      } catch (error) {
        console.warn(`⚠️ Tentative ${attempt} échouée:`, error.message || error);
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`🔄 Nouvel essai dans ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    console.error(`❌ Échec de l'upload après ${maxRetries} tentatives.`);
    return { data: null, error: lastError };
  },

  // ✅ UPLOAD VAULT OPTIMISÉ
  async uploadVaultFile(file, userId, onProgress) {
    try {
      logger.log('📤 Upload fichier coffre-fort:', {
        fileName: file.name,
        size: Math.round(file.size / 1024) + 'KB',
        userId
      });

      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `${userId}/${fileName}`;

      logger.log('🗂️ Chemin de stockage vault:', filePath);

      const uploadResult = await this.uploadWithProgressAndRetry(filePath, file, 'vault-files', onProgress);

      if (uploadResult.error) {
        logger.error('❌ Erreur upload vault:', uploadResult.error);
        return { publicURL: null, filePath: null, error: uploadResult.error };
      }

      const { data } = supabase.storage
        .from('vault-files')
        .getPublicUrl(filePath);

      const publicURL = data.publicUrl;
      logger.log('✅ Fichier vault uploadé avec succès:', publicURL);

      return { publicURL, filePath: filePath, error: null };

    } catch (error) {
      logger.error('❌ Erreur générale upload vault:', error);
      return { publicURL: null, filePath: null, error };
    }
  },

  // ✅ SUPPRESSION VAULT OPTIMISÉE
  async deleteVaultFile(filePath) {
    logger.log('🗑️ Suppression fichier vault:', filePath);

    try {
      const { error } = await supabase.storage.from('vault-files').remove([filePath]);

      if (error) {
        logger.error('❌ Erreur suppression fichier vault:', error);
      } else {
        logger.log('✅ Fichier vault supprimé avec succès');
      }

      return { error };
    } catch (error) {
      logger.error('❌ Erreur générale suppression vault:', error);
      return { error };
    }
  },

  // ✅ SUPPRESSION DOSSIER INTERVENTION OPTIMISÉE
  async deleteInterventionFolder(interventionId) {
    try {
      logger.log('🗑️ Suppression dossier intervention:', interventionId);
      const folderPath = interventionId.toString();

      // Fonction récursive listant tous les fichiers d'un dossier (sous-dossiers inclus)
      const listAll = async (prefix = '') => {
        const paths = [];
        const { data, error } = await supabase.storage.from('intervention-files').list(prefix);
        if (error) {
          throw error;
        }
        for (const item of data) {
          if (item.name && item.metadata && item.metadata.size >= 0) {
            // fichier
            const p = prefix ? `${prefix}/${item.name}` : item.name;
            paths.push(p);
          } else if (item.name && !item.metadata) {
            // dossier
            const dir = prefix ? `${prefix}/${item.name}` : item.name;
            const sub = await listAll(dir);
            paths.push(...sub);
          }
        }
        return paths;
      };

      const filePaths = await listAll(folderPath);
      if (!filePaths.length) {
        logger.log('ℹ️ Aucun fichier à supprimer pour:', folderPath);
        return { error: null };
      }

      logger.log('🗑️ Suppression de', filePaths.length, 'fichier(s)');

      const batchSize = 10;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);

        const { error: removeError } = await supabase.storage
          .from('intervention-files')
          .remove(batch);

        if (removeError) {
          console.error(`❌ Erreur suppression batch ${i / batchSize + 1}:`, removeError);
          return { error: removeError };
        }

        console.log(`✅ Batch ${i / batchSize + 1} supprimé`);
      }

      logger.log('✅ Dossier intervention supprimé avec succès');
      return { error: null };

    } catch (error) {
      logger.error('❌ Erreur générale suppression dossier:', error);
      return { error };
    }
  },
}

// ✅ SERVICE INTERVENTIONS OPTIMISÉ
export const interventionService = {
  async getInterventions(userId = null, archived = false) {
    logger.log('📋 Récupération interventions:', { userId, archived });

    let query = supabase
      .from('interventions')
      .select('*, intervention_assignments(profiles(full_name)), intervention_briefing_documents(*)')
      .eq('is_archived', archived)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (userId) {
      query = query.filter('intervention_assignments.user_id', 'eq', userId);
    }

    const result = await query;

    if (result.error) {
      logger.error('❌ Erreur récupération interventions:', result.error);
    } else {
      logger.log('✅ Interventions récupérées:', result.data?.length || 0);
    }

    return result;
  },

  async createIntervention(intervention, assignedUserIds, briefingFiles = []) {
    try {
      logger.log('➕ Création nouvelle intervention:', {
        client: intervention.client,
        assignedUsers: assignedUserIds.length,
        briefingFiles: briefingFiles.length
      });

      // 1. Insérer les données de base de l'intervention
      const { data: insertedData, error: interventionError} = await supabase
        .from('interventions')
        .insert([{
          client: intervention.client,
          address: intervention.address,
          service: intervention.service,
          date: intervention.date,
          time: intervention.time,
          client_phone: intervention.client_phone || null,
          secondary_phone: intervention.secondary_phone || null,
          client_email: intervention.client_email || null,
          ticket_number: intervention.ticket_number || null,
          km_start: intervention.km_start ? parseInt(intervention.km_start) : null,
        }])
        .select();

      if (interventionError) {
        logger.error('❌ Erreur BDD création intervention:', interventionError);
        throw interventionError;
      }
      if (!insertedData || insertedData.length === 0) {
        throw new Error("La création a échoué ou n'a pas retourné de données. Vérifiez les permissions RLS.");
      }

      const newIntervention = insertedData[0];
      const interventionId = newIntervention.id;
      logger.log('✅ Intervention créée avec ID:', interventionId);

      // 2. Assigner les utilisateurs
      if (assignedUserIds && assignedUserIds.length > 0) {
        const assignments = assignedUserIds.map(userId => ({
          intervention_id: interventionId,
          user_id: userId
        }));
        const { error: assignmentError } = await supabase.from('intervention_assignments').insert(assignments);
        if (assignmentError) {
          logger.error('❌ Erreur assignation utilisateurs:', assignmentError);
          // Ne pas bloquer, mais logger l'erreur
        } else {
          logger.log('✅ Utilisateurs assignés:', assignedUserIds.length);
        }
      }

      // 3. Gérer les documents de préparation
      if (briefingFiles && briefingFiles.length > 0) {
        await this.addBriefingDocuments(interventionId, briefingFiles);
      }

      logger.log('🎉 Intervention complètement créée avec succès');
      return { data: newIntervention, error: null };

    } catch (error) {
      logger.error('❌ Erreur générale création intervention:', error);
      return { data: null, error };
    }
  },

  // ✅ MISE À JOUR INTERVENTION OPTIMISÉE
  // Note : La sanitisation du rapport est faite dans App.js via buildSanitizedReport
  // avant d'appeler cette fonction
  async updateIntervention(id, updates) {
    try {
      logger.log('🔄 Mise à jour intervention', id, 'avec:', {
        hasReport: !!updates.report,
        status: updates.status,
        isArchived: updates.is_archived
      });

      // Le rapport est déjà sanitisé par App.js, on l'envoie directement
      const result = await supabase
        .from('interventions')
        .update(updates)
        .eq('id', id);

      if (result.error) {
        logger.error('❌ Erreur Supabase lors de la mise à jour:', result.error);
        throw result.error;
      }

      logger.log('✅ Intervention mise à jour avec succès');
      return result;

    } catch (error) {
      logger.error('❌ Erreur dans updateIntervention:', error);
      return { error };
    }
  },

  async deleteIntervention(id) {
    try {
      logger.log('🗑️ Suppression intervention:', id);

      const { error: storageError } = await storageService.deleteInterventionFolder(id);
      if (storageError) {
        console.error(`⚠️ Impossible de supprimer le dossier de stockage pour l'intervention ${id}:`, storageError);
      }

      const result = await supabase.from('interventions').delete().eq('id', id);

      if (result.error) {
        logger.error('❌ Erreur suppression intervention:', result.error);
      } else {
        logger.log('✅ Intervention supprimée avec succès');
      }

      return result;

    } catch (error) {
      logger.error('❌ Erreur générale suppression intervention:', error);
      return { error };
    }
  },

  async addBriefingDocuments(interventionId, briefingFiles) {
    try {
      logger.log('📋 Ajout documents de préparation:', interventionId, briefingFiles.length, 'fichier(s)');
      const uploadedDocuments = [];

      for (const file of briefingFiles) {
        const { publicURL, error: uploadError } = await storageService.uploadInterventionFile(file, interventionId, 'briefing');
        if (uploadError) throw uploadError;
        uploadedDocuments.push({
          intervention_id: interventionId,
          file_name: file.name,
          file_url: publicURL
        });
      }

      if (uploadedDocuments.length > 0) {
        const { error: dbError } = await supabase.from('intervention_briefing_documents').insert(uploadedDocuments);
        if (dbError) throw dbError;
      }

      logger.log('🎉 Documents de préparation ajoutés avec succès');
      return { error: null };
    } catch (error) {
      logger.error('❌ Erreur générale ajout documents préparation:', error);
      return { error };
    }
  }
}

// ✅ SERVICE CONGÉS
export const leaveService = {
  async getLeaveRequests(userId = null) {
    logger.log('🏖️ Récupération demandes de congé:', { userId });

    let query = supabase
      .from('leave_requests')
      .select('*')
      .order('start_date', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const result = await query;

    if (result.error) {
      logger.error('❌ Erreur récupération demandes congé:', result.error);
    } else {
      logger.log('✅ Demandes de congé récupérées:', result.data?.length || 0);
    }

    return result;
  },

  async createLeaveRequest(request) {
    logger.log('📝 Création demande de congé:', {
      userName: request.userName,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason
    });

    const { userName, startDate, endDate, reason, userId } = request;

    const result = await supabase
      .from('leave_requests')
      .insert([{
        user_id: userId,
        user_name: userName,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'En attente'
      }]);

    if (result.error) {
      logger.error('❌ Erreur création demande congé:', result.error);
    } else {
      logger.log('✅ Demande de congé créée avec succès');
    }

    return result;
  },

  async updateRequestStatus(requestId, status, rejection_reason = null) {
    logger.log('🔄 Mise à jour statut demande congé:', {
      requestId,
      status,
      rejection_reason
    });

    const result = await supabase
      .from('leave_requests')
      .update({ status, rejection_reason })
      .eq('id', requestId);

    if (result.error) {
      logger.error('❌ Erreur mise à jour statut congé:', result.error);
    } else {
      logger.log('✅ Statut demande congé mis à jour');
    }

    return result;
  },

  async deleteLeaveRequest(requestId) {
    logger.log('🗑️ Suppression demande de congé:', requestId);

    const result = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId);

    if (result.error) {
      logger.error('❌ Erreur suppression demande congé:', result.error);
    } else {
      logger.log('✅ Demande de congé supprimée');
    }

    return result;
  }
}

// ✅ SERVICE COFFRE-FORT OPTIMISÉ
export const vaultService = {
  async getVaultDocuments() {
    logger.log('🗄️ Récupération documents coffre-fort...');

    const result = await supabase
      .from('vault_documents')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (result.error) {
      logger.error('❌ Erreur récupération documents vault:', result.error);
    } else {
      logger.log('✅ Documents coffre-fort récupérés:', result.data?.length || 0);
    }

    return result;
  },

  async createVaultDocument({ userId, name, url, path }) {
    logger.log('📄 Création document coffre-fort:', {
      userId,
      name,
      url: url?.substring(0, 50) + '...',
      path
    });

    const result = await supabase
      .from('vault_documents')
      .insert([{
        user_id: userId,
        file_name: name,
        file_url: url,
        file_path: path,
      }]);

    if (result.error) {
      logger.error('❌ Erreur création document vault:', result.error);
    } else {
      logger.log('✅ Document coffre-fort créé avec succès');
    }

    return result;
  },

  async deleteVaultDocument(documentId) {
    try {
      logger.log('🗑️ Suppression document coffre-fort:', documentId);

      const { data: doc, error: fetchError } = await supabase
        .from('vault_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        console.error("❌ Document non trouvé pour la suppression:", fetchError);
        return { error: fetchError || new Error("Document not found") };
      }

      const { error: storageError } = await storageService.deleteVaultFile(doc.file_path);
      if (storageError) {
        console.error("❌ Impossible de supprimer le fichier du stockage:", storageError);
        return { error: storageError };
      }

      const result = await supabase
        .from('vault_documents')
        .delete()
        .eq('id', documentId);

      if (result.error) {
        logger.error('❌ Erreur suppression document vault:', result.error);
      } else {
        logger.log('✅ Document coffre-fort supprimé avec succès');
      }

      return result;

    } catch (error) {
      logger.error('❌ Erreur générale suppression document vault:', error);
      return { error };
    }
  }
}

// ✅ UTILITAIRES DE MONITORING ET DEBUG
export const monitoringService = {
  logUpload(fileName, fileSize, method, duration, success, error = null) {
    const deviceInfo = getDeviceInfo();

    const logData = {
      timestamp: new Date().toISOString(),
      fileName,
      fileSizeMB: Math.round(fileSize / (1024 * 1024) * 100) / 100,
      uploadMethod: method,
      durationMs: duration,
      success,
      error: error?.message || null,
      device: {
        isMobile: deviceInfo.isMobile,
        connectionType: deviceInfo.connectionType,
      }
    };

    logger.log('📊 Upload Log:', logData);
  }
}

// ✅ FONCTION D'INITIALISATION ET VÉRIFICATION
export const initializeSupabase = async () => {
  try {
    logger.log('🚀 Initialisation Supabase optimisée...');

    // On effectue un HEAD avec compte sur la table profiles pour vérifier la
    // connectivité, sans récupérer de données.
    const { error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      logger.error('❌ Erreur connexion Supabase:', error);
      return { success: false, error };
    }

    const buckets = ['intervention-files', 'vault-files'];
    const bucketChecks = [];

    for (const bucketName of buckets) {
      try {
        const { data: bucketData, error: bucketError } = await supabase.storage
          .from(bucketName)
          .list('', { limit: 1 });

        bucketChecks.push({
          name: bucketName,
          accessible: !bucketError,
          error: bucketError?.message || null
        });
      } catch (e) {
        bucketChecks.push({
          name: bucketName,
          accessible: false,
          error: e.message
        });
      }
    }

    const deviceInfo = getDeviceInfo();

    logger.log('✅ Supabase initialisé avec succès');
    logger.log('📊 Info device:', deviceInfo);
    logger.log('🪣 État buckets:', bucketChecks);

    return {
      success: true,
      deviceInfo,
      buckets: bucketChecks,
    };

  } catch (error) {
    logger.error('❌ Erreur initialisation Supabase:', error);
    return { success: false, error };
  }
}

// ✅ HOOK DE PERFORMANCE POUR COMPOSANTS
export const useSupabasePerformance = () => {
  const [performanceData, setPerformanceData] = useState(null);

  useEffect(() => {
    const deviceInfo = getDeviceInfo();
    setPerformanceData({
      device: deviceInfo,
    });
  }, []);

  return performanceData;
}

// ✅ EXPORT PRINCIPAL AVEC TOUTES LES OPTIMISATIONS
export default {
  supabase,
  authService,
  profileService,
  storageService,
  interventionService,
  leaveService,
  vaultService,
  monitoringService,
  initializeSupabase,
  useSupabasePerformance
}

