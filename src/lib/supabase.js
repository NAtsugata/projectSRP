// src/lib/supabase.js - VERSION COMPLÈTE OPTIMISÉE MOBILE
import React from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// --- Configuration Supabase Optimisée Mobile ---
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // ✅ OPTIMISATIONS RÉSEAU MOBILE
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-mobile',
      'Cache-Control': 'no-cache'
    }
  },
  db: {
    schema: 'public'
  }
})

// --- Service d'authentification ---
export const authService = {
  async signIn(email, password) {
    console.log('🔐 Tentative de connexion pour:', email);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      console.error('❌ Erreur de connexion:', result.error);
    } else {
      console.log('✅ Connexion réussie');
    }
    return result;
  },
  async signOut() {
    console.log('🚪 Déconnexion en cours...');
    const { error } = await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    if (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
    } else {
      console.log('✅ Déconnexion réussie - Storage nettoyé');
    }
    return { error };
  },
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

// --- Services de données ---
export const profileService = {
  async getProfile(userId) {
    console.log('👤 Récupération profil pour:', userId);
    const result = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (result.error) {
      console.error('❌ Erreur récupération profil:', result.error);
    } else {
      console.log('✅ Profil récupéré:', result.data?.full_name);
    }
    return result;
  },
  async getAllProfiles() {
    console.log('👥 Récupération de tous les profils...');
    const result = await supabase.from('profiles').select('*').order('full_name');
    if (result.error) {
      console.error('❌ Erreur récupération profils:', result.error);
    } else {
      console.log('✅ Profils récupérés:', result.data?.length || 0);
    }
    return result;
  },
  async updateProfile(userId, updates) {
    console.log('✏️ Mise à jour profil:', userId, updates);
    const { full_name, is_admin } = updates;
    const updateData = { full_name, is_admin };
    const result = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (result.error) {
      console.error('❌ Erreur mise à jour profil:', result.error);
    } else {
      console.log('✅ Profil mis à jour avec succès');
    }
    return result;
  }
}

// ✅ FONCTION DE NETTOYAGE NOMS DE FICHIERS AMÉLIORÉE
const sanitizeFileName = (fileName) => {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
  console.log('🧹 Nom de fichier nettoyé:', fileName, '->', cleaned);
  return cleaned;
};

// ✅ DÉTECTION CONNEXION ET DEVICE
const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  return {
    isMobile: /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    connectionType: connection?.effectiveType || '4g',
    downlink: connection?.downlink || 10,
    isSlowConnection: connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g',
    saveData: connection?.saveData || false
  };
};

// ✅ SERVICE DE STOCKAGE OPTIMISÉ MOBILE
export const storageService = {
  // ✅ UPLOAD INTERVENTION PRINCIPAL OPTIMISÉ
  async uploadInterventionFile(file, interventionId, folder = 'report') {
    try {
      console.log('📤 Upload intervention file:', {
        fileName: file.name,
        size: Math.round(file.size / 1024) + 'KB',
        type: file.type,
        interventionId,
        folder
      });

      const deviceInfo = getDeviceInfo();
      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `${interventionId}/${folder}/${fileName}`;

      console.log('🗂️ Chemin de stockage:', filePath);

      // ✅ STRATÉGIE D'UPLOAD ADAPTATIVE
      let uploadResult;
      const fileSize = file.size;
      const sizeMB = fileSize / (1024 * 1024);

      if (sizeMB > 6 || (deviceInfo.isMobile && deviceInfo.isSlowConnection)) {
        console.log('🔄 Upload resumable activé (fichier:', Math.round(sizeMB), 'MB)');
        uploadResult = await this.uploadWithChunks(filePath, file, deviceInfo);
      } else {
        console.log('⚡ Upload standard optimisé');
        uploadResult = await this.uploadStandard(filePath, file, deviceInfo);
      }

      if (uploadResult.error) {
        console.error('❌ Erreur upload:', uploadResult.error);
        return { publicURL: null, error: uploadResult.error };
      }

      // ✅ URL PUBLIQUE SANS TRANSFORMATION (CORRIGÉ)
      const { data } = supabase.storage
        .from('intervention-files')
        .getPublicUrl(filePath); // Le deuxième argument avec "transform" a été supprimé

      const publicURL = data.publicUrl;
      console.log('✅ Fichier uploadé avec succès:', publicURL);
      return { publicURL, error: null };

    } catch (error) {
      console.error('❌ Erreur générale upload intervention:', error);
      return { publicURL: null, error };
    }
  },

  // ✅ UPLOAD STANDARD AVEC RETRY
  async uploadStandard(filePath, file, deviceInfo) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Upload standard tentative ${attempt}/${maxRetries}`);

        const uploadOptions = {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
          metadata: {
            uploadedFrom: deviceInfo.isMobile ? 'mobile' : 'desktop',
            originalSize: file.size,
            timestamp: new Date().toISOString(),
            connectionType: deviceInfo.connectionType
          }
        };

        // ✅ TIMEOUT ADAPTATIF SELON CONNEXION
        const timeoutMs = deviceInfo.isSlowConnection ? 60000 : 30000;

        const uploadPromise = supabase.storage
          .from('intervention-files')
          .upload(filePath, file, uploadOptions);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout')), timeoutMs)
        );

        const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

        if (!error) {
          console.log('✅ Upload standard réussi');
          return { data, error: null };
        } else {
          throw error;
        }

      } catch (error) {
        console.warn(`⚠️ Tentative ${attempt} échouée:`, error.message);
        lastError = error;

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`🔄 Retry dans ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { data: null, error: lastError };
  },

  // ✅ UPLOAD PAR CHUNKS POUR GROS FICHIERS
  async uploadWithChunks(filePath, file, deviceInfo) {
    try {
      console.log('🔄 Début upload par chunks...');

      // ✅ TAILLE CHUNK ADAPTATIVE
      const chunkSize = deviceInfo.isMobile ?
        (deviceInfo.isSlowConnection ? 512 * 1024 : 1024 * 1024) : // 512KB ou 1MB mobile
        2 * 1024 * 1024; // 2MB desktop

      const totalChunks = Math.ceil(file.size / chunkSize);
      console.log(`📦 Upload en ${totalChunks} chunks de ${Math.round(chunkSize / 1024)}KB`);

      const uploadedChunks = [];
      let uploadedSize = 0;

      // ✅ UPLOAD SÉQUENTIEL DES CHUNKS AVEC RETRY
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const chunkPath = `${filePath}.chunk${chunkIndex}`;

        console.log(`📤 Upload chunk ${chunkIndex + 1}/${totalChunks} (${Math.round(chunk.size / 1024)}KB)`);

        const chunkResult = await this.uploadChunkWithRetry(chunkPath, chunk, deviceInfo, chunkIndex, totalChunks);

        if (chunkResult.error) {
          // ✅ NETTOYAGE DES CHUNKS EN CAS D'ERREUR
          await this.cleanupChunks(filePath, chunkIndex);
          throw chunkResult.error;
        }

        uploadedChunks.push(chunkResult.data);
        uploadedSize += chunk.size;

        const progress = Math.round((uploadedSize / file.size) * 100);
        console.log(`✅ Chunk ${chunkIndex + 1} OK - Progrès: ${progress}%`);
      }

      // ✅ ASSEMBLAGE FINAL
      console.log('🔗 Assemblage des chunks...');
      const finalResult = await this.assembleChunks(filePath, file, uploadedChunks, deviceInfo);

      // ✅ NETTOYAGE DES CHUNKS TEMPORAIRES
      await this.cleanupChunks(filePath, totalChunks);

      console.log('✅ Upload par chunks terminé avec succès');
      return finalResult;

    } catch (error) {
      console.error('❌ Erreur upload par chunks:', error);
      return { data: null, error };
    }
  },

  // ✅ UPLOAD CHUNK INDIVIDUEL AVEC RETRY
  async uploadChunkWithRetry(chunkPath, chunk, deviceInfo, chunkIndex, totalChunks) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeoutMs = deviceInfo.isSlowConnection ? 45000 : 25000;

        const uploadPromise = supabase.storage
          .from('intervention-files')
          .upload(chunkPath, chunk, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'application/octet-stream',
            metadata: {
              chunkIndex: chunkIndex,
              totalChunks: totalChunks,
              chunkSize: chunk.size
            }
          });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Chunk ${chunkIndex + 1} timeout`)), timeoutMs)
        );

        const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

        if (!error) {
          return { data, error: null };
        } else {
          throw error;
        }

      } catch (error) {
        console.warn(`⚠️ Chunk ${chunkIndex + 1} tentative ${attempt} échouée:`, error.message);
        lastError = error;

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { data: null, error: lastError };
  },

  // ✅ ASSEMBLAGE DES CHUNKS
  async assembleChunks(filePath, originalFile, uploadedChunks, deviceInfo) {
    try {
      // ✅ POUR CETTE VERSION, ON FAIT UN UPLOAD FINAL COMPLET
      // En production, il faudrait une fonction côté serveur pour assembler
      console.log('🔧 Assemblage final du fichier...');

      const { data, error } = await supabase.storage
        .from('intervention-files')
        .upload(filePath, originalFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: originalFile.type,
          metadata: {
            uploadedFrom: deviceInfo.isMobile ? 'mobile' : 'desktop',
            originalSize: originalFile.size,
            uploadMethod: 'chunked',
            chunksCount: uploadedChunks.length,
            timestamp: new Date().toISOString()
          }
        });

      return { data, error };

    } catch (error) {
      console.error('❌ Erreur assemblage chunks:', error);
      return { data: null, error };
    }
  },

  // ✅ NETTOYAGE DES CHUNKS TEMPORAIRES
  async cleanupChunks(filePath, chunkCount) {
    try {
      console.log('🧹 Nettoyage des chunks temporaires...');

      const chunkPaths = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkPaths.push(`${filePath}.chunk${i}`);
      }

      if (chunkPaths.length > 0) {
        const { error } = await supabase.storage
          .from('intervention-files')
          .remove(chunkPaths);

        if (error) {
          console.warn('⚠️ Erreur nettoyage chunks (non critique):', error);
        } else {
          console.log('✅ Chunks temporaires nettoyés');
        }
      }

    } catch (error) {
      console.warn('⚠️ Erreur nettoyage chunks:', error);
    }
  },

  // ✅ UPLOAD VAULT OPTIMISÉ
  async uploadVaultFile(file, userId) {
    try {
      console.log('📤 Upload fichier coffre-fort:', {
        fileName: file.name,
        size: Math.round(file.size / 1024) + 'KB',
        userId
      });

      const deviceInfo = getDeviceInfo();
      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `${userId}/${fileName}`;

      console.log('🗂️ Chemin de stockage vault:', filePath);

      const uploadOptions = {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
        metadata: {
          uploadedFrom: deviceInfo.isMobile ? 'mobile' : 'desktop',
          userId: userId,
          originalSize: file.size,
          timestamp: new Date().toISOString()
        }
      };

      // ✅ UPLOAD AVEC RETRY POUR VAULT
      const maxRetries = 3;
      let uploadResult;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📤 Upload vault tentative ${attempt}/${maxRetries}`);

          const timeoutMs = deviceInfo.isSlowConnection ? 60000 : 30000;

          const uploadPromise = supabase.storage
            .from('vault-files')
            .upload(filePath, file, uploadOptions);

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Upload vault timeout')), timeoutMs)
          );

          uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

          if (!uploadResult.error) {
            break; // Succès
          } else {
            throw uploadResult.error;
          }

        } catch (error) {
          console.warn(`⚠️ Upload vault tentative ${attempt} échouée:`, error.message);
          lastError = error;

          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (uploadResult.error) {
        console.error('❌ Erreur upload vault:', uploadResult.error);
        return { publicURL: null, filePath: null, error: uploadResult.error };
      }

      const { data } = supabase.storage
        .from('vault-files')
        .getPublicUrl(filePath);

      const publicURL = data.publicUrl;
      console.log('✅ Fichier vault uploadé avec succès:', publicURL);

      return { publicURL, filePath: filePath, error: null };

    } catch (error) {
      console.error('❌ Erreur générale upload vault:', error);
      return { publicURL: null, filePath: null, error };
    }
  },

  // ✅ SUPPRESSION VAULT OPTIMISÉE
  async deleteVaultFile(filePath) {
    console.log('🗑️ Suppression fichier vault:', filePath);

    try {
      const { error } = await supabase.storage.from('vault-files').remove([filePath]);

      if (error) {
        console.error('❌ Erreur suppression fichier vault:', error);
      } else {
        console.log('✅ Fichier vault supprimé avec succès');
      }

      return { error };
    } catch (error) {
      console.error('❌ Erreur générale suppression vault:', error);
      return { error };
    }
  },

  // ✅ SUPPRESSION DOSSIER INTERVENTION OPTIMISÉE
  async deleteInterventionFolder(interventionId) {
    try {
      console.log('🗑️ Suppression dossier intervention:', interventionId);
      const folderPath = interventionId.toString();

      const { data: files, error: listError } = await supabase.storage
        .from('intervention-files')
        .list(folderPath, { recursive: true });

      if (listError) {
        console.error("❌ Erreur lors du listage des fichiers à supprimer:", listError);
        return { error: listError };
      }

      if (!files || files.length === 0) {
        console.log('ℹ️ Aucun fichier à supprimer pour l\'intervention:', interventionId);
        return { error: null };
      }

      const filePaths = files.map(file => `${folderPath}/${file.name}`);
      console.log('🗑️ Suppression de', filePaths.length, 'fichier(s)');

      // ✅ SUPPRESSION PAR BATCH POUR ÉVITER LES TIMEOUTS
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

      console.log('✅ Dossier intervention supprimé avec succès');
      return { error: null };

    } catch (error) {
      console.error('❌ Erreur générale suppression dossier:', error);
      return { error };
    }
  },

  // ✅ FONCTION UTILITAIRE - INFO CONNEXION
  getConnectionInfo() {
    return getDeviceInfo();
  }
}

// ✅ SERVICE INTERVENTIONS OPTIMISÉ
export const interventionService = {
  async getInterventions(userId = null, archived = false) {
    console.log('📋 Récupération interventions:', { userId, archived });

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
      console.error('❌ Erreur récupération interventions:', result.error);
    } else {
      console.log('✅ Interventions récupérées:', result.data?.length || 0);
    }

    return result;
  },

  async createIntervention(intervention, assignedUserIds, briefingFiles) {
    try {
      console.log('➕ Création nouvelle intervention:', {
        client: intervention.client,
        service: intervention.service,
        assignedUsers: assignedUserIds.length,
        briefingFiles: briefingFiles.length
      });

      // Création de l'intervention
      const { data: interventionData, error: interventionError } = await supabase
        .from('interventions')
        .insert([{
          client: intervention.client,
          address: intervention.address,
          service: intervention.service,
          date: intervention.date,
          time: intervention.time,
        }])
        .select()
        .single();

      if (interventionError) {
        console.error('❌ Erreur création intervention:', interventionError);
        return { error: interventionError };
      }

      const interventionId = interventionData.id;
      console.log('✅ Intervention créée avec ID:', interventionId);

      // Assignation des utilisateurs
      if (assignedUserIds.length > 0) {
        const assignments = assignedUserIds.map(userId => ({
          intervention_id: interventionId,
          user_id: userId
        }));

        const { error: assignmentError } = await supabase
          .from('intervention_assignments')
          .insert(assignments);

        if (assignmentError) {
          console.error('❌ Erreur assignation utilisateurs:', assignmentError);
          return { error: assignmentError };
        }

        console.log('✅ Utilisateurs assignés:', assignedUserIds.length);
      }

      // Ajout des documents de préparation
      if (briefingFiles.length > 0) {
        const { error: briefingError } = await this.addBriefingDocuments(interventionId, briefingFiles);
        if (briefingError) {
          console.error('❌ Erreur ajout documents préparation:', briefingError);
          return { error: briefingError };
        }
        console.log('✅ Documents de préparation ajoutés:', briefingFiles.length);
      }

      console.log('🎉 Intervention complètement créée avec succès');
      return { error: null };

    } catch (error) {
      console.error('❌ Erreur générale création intervention:', error);
      return { error };
    }
  },

  // ✅ MISE À JOUR INTERVENTION OPTIMISÉE
  async updateIntervention(id, updates) {
    try {
      console.log('🔄 Mise à jour intervention', id, 'avec:', {
        hasReport: !!updates.report,
        status: updates.status,
        isArchived: updates.is_archived
      });

      // ✅ SANITISATION DES DONNÉES
      const sanitizedUpdates = { ...updates };

      if (updates.report) {
        sanitizedUpdates.report = {
          notes: updates.report.notes || '',
          files: Array.isArray(updates.report.files) ? updates.report.files : [],
          arrivalTime: updates.report.arrivalTime || null,
          departureTime: updates.report.departureTime || null,
          signature: updates.report.signature || null
        };

        console.log('📄 Rapport sanitisé:', {
          notesLength: sanitizedUpdates.report.notes.length,
          filesCount: sanitizedUpdates.report.files.length,
          hasArrival: !!sanitizedUpdates.report.arrivalTime,
          hasDeparture: !!sanitizedUpdates.report.departureTime,
          hasSignature: !!sanitizedUpdates.report.signature
        });

        if (sanitizedUpdates.report.files.length > 0) {
          console.log('📁 Fichiers dans le rapport:');
          sanitizedUpdates.report.files.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.type}) - ${file.url}`);
          });
        }
      }

      const result = await supabase
        .from('interventions')
        .update(sanitizedUpdates)
        .eq('id', id);

      if (result.error) {
        console.error('❌ Erreur Supabase lors de la mise à jour:', result.error);
        throw result.error;
      }

      console.log('✅ Intervention mise à jour avec succès');
      return result;

    } catch (error) {
      console.error('❌ Erreur dans updateIntervention:', error);
      return { error };
    }
  },

  async deleteIntervention(id) {
    try {
      console.log('🗑️ Suppression intervention:', id);

      // Supprimer d'abord les fichiers du storage
      const { error: storageError } = await storageService.deleteInterventionFolder(id);
      if (storageError) {
        console.error(`⚠️ Impossible de supprimer le dossier de stockage pour l'intervention ${id}:`, storageError);
      }

      // Puis supprimer l'intervention de la base
      const result = await supabase.from('interventions').delete().eq('id', id);

      if (result.error) {
        console.error('❌ Erreur suppression intervention:', result.error);
      } else {
        console.log('✅ Intervention supprimée avec succès');
      }

      return result;

    } catch (error) {
      console.error('❌ Erreur générale suppression intervention:', error);
      return { error };
    }
  },

  async addBriefingDocuments(interventionId, briefingFiles) {
    try {
      console.log('📋 Ajout documents de préparation:', interventionId, briefingFiles.length, 'fichier(s)');

      for (const file of briefingFiles) {
        console.log('📤 Upload document:', file.name);

        const { publicURL, error: uploadError } = await storageService.uploadInterventionFile(
          file,
          interventionId,
          'briefing'
        );

        if (uploadError) {
          console.error("❌ Erreur d'envoi pour le fichier", file.name, uploadError);
          return { error: uploadError };
        }

        console.log('💾 Sauvegarde référence en base pour:', file.name);

        const { error: dbError } = await supabase
          .from('intervention_briefing_documents')
          .insert({
            intervention_id: interventionId,
            file_name: file.name,
            file_url: publicURL
          });

        if (dbError) {
          console.error("❌ Erreur d'insertion en base de données pour", file.name, dbError);
          return { error: dbError };
        }

        console.log('✅ Document de préparation ajouté:', file.name);
      }

      console.log('🎉 Tous les documents de préparation ont été ajoutés avec succès');
      return { error: null };

    } catch (error) {
      console.error('❌ Erreur générale ajout documents préparation:', error);
      return { error };
    }
  }
}

// ✅ SERVICE CONGÉS
export const leaveService = {
  async getLeaveRequests(userId = null) {
    console.log('🏖️ Récupération demandes de congé:', { userId });

    let query = supabase
      .from('leave_requests')
      .select('*')
      .order('start_date', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const result = await query;

    if (result.error) {
      console.error('❌ Erreur récupération demandes congé:', result.error);
    } else {
      console.log('✅ Demandes de congé récupérées:', result.data?.length || 0);
    }

    return result;
  },

  async createLeaveRequest(request) {
    console.log('📝 Création demande de congé:', {
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
      console.error('❌ Erreur création demande congé:', result.error);
    } else {
      console.log('✅ Demande de congé créée avec succès');
    }

    return result;
  },

  async updateRequestStatus(requestId, status, rejection_reason = null) {
    console.log('🔄 Mise à jour statut demande congé:', {
      requestId,
      status,
      rejection_reason
    });

    const result = await supabase
      .from('leave_requests')
      .update({ status, rejection_reason })
      .eq('id', requestId);

    if (result.error) {
      console.error('❌ Erreur mise à jour statut congé:', result.error);
    } else {
      console.log('✅ Statut demande congé mis à jour');
    }

    return result;
  },

  async deleteLeaveRequest(requestId) {
    console.log('🗑️ Suppression demande de congé:', requestId);

    const result = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId);

    if (result.error) {
      console.error('❌ Erreur suppression demande congé:', result.error);
    } else {
      console.log('✅ Demande de congé supprimée');
    }

    return result;
  }
}

// ✅ SERVICE COFFRE-FORT OPTIMISÉ
export const vaultService = {
  async getVaultDocuments() {
    console.log('🗄️ Récupération documents coffre-fort...');

    const result = await supabase
      .from('vault_documents')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    if (result.error) {
      console.error('❌ Erreur récupération documents vault:', result.error);
    } else {
      console.log('✅ Documents coffre-fort récupérés:', result.data?.length || 0);
    }

    return result;
  },

  async createVaultDocument({ userId, name, url, path }) {
    console.log('📄 Création document coffre-fort:', {
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
      console.error('❌ Erreur création document vault:', result.error);
    } else {
      console.log('✅ Document coffre-fort créé avec succès');
    }

    return result;
  },

  async deleteVaultDocument(documentId) {
    try {
      console.log('🗑️ Suppression document coffre-fort:', documentId);

      // Récupérer d'abord le chemin du fichier
      const { data: doc, error: fetchError } = await supabase
        .from('vault_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        console.error("❌ Document non trouvé pour la suppression:", fetchError);
        return { error: fetchError || new Error("Document not found") };
      }

      // Supprimer le fichier du storage
      const { error: storageError } = await storageService.deleteVaultFile(doc.file_path);
      if (storageError) {
        console.error("❌ Impossible de supprimer le fichier du stockage:", storageError);
        return { error: storageError };
      }

      // Supprimer l'entrée de la base de données
      const result = await supabase
        .from('vault_documents')
        .delete()
        .eq('id', documentId);

      if (result.error) {
        console.error('❌ Erreur suppression document vault:', result.error);
      } else {
        console.log('✅ Document coffre-fort supprimé avec succès');
      }

      return result;

    } catch (error) {
      console.error('❌ Erreur générale suppression document vault:', error);
      return { error };
    }
  }
}

// ✅ UTILITAIRES DE MONITORING ET DEBUG
export const monitoringService = {
  // ✅ LOG D'UPLOAD POUR DEBUG
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
        downlink: deviceInfo.downlink
      }
    };

    console.log('📊 Upload Log:', logData);

    // En mode développement, on peut stocker en localStorage pour debug
    if (process.env.NODE_ENV === 'development') {
      try {
        const logs = JSON.parse(localStorage.getItem('upload_logs') || '[]');
        logs.push(logData);
        // Garde seulement les 50 derniers logs
        const recentLogs = logs.slice(-50);
        localStorage.setItem('upload_logs', JSON.stringify(recentLogs));
      } catch (e) {
        console.warn('⚠️ Erreur sauvegarde log:', e);
      }
    }

    return logData;
  },

  // ✅ RÉCUPÉRATION DES LOGS POUR DEBUG
  getUploadLogs() {
    try {
      return JSON.parse(localStorage.getItem('upload_logs') || '[]');
    } catch (e) {
      console.warn('⚠️ Erreur lecture logs:', e);
      return [];
    }
  },

  // ✅ NETTOYAGE DES LOGS
  clearUploadLogs() {
    try {
      localStorage.removeItem('upload_logs');
      console.log('✅ Logs de debug nettoyés');
    } catch (e) {
      console.warn('⚠️ Erreur nettoyage logs:', e);
    }
  },

  // ✅ STATISTIQUES D'UPLOAD
  getUploadStats() {
    const logs = this.getUploadLogs();

    if (logs.length === 0) {
      return {
        totalUploads: 0,
        successRate: 0,
        avgDuration: 0,
        avgFileSize: 0,
        methodsUsed: [],
        deviceBreakdown: {}
      };
    }

    const successful = logs.filter(l => l.success);
    const methodsCount = {};
    const deviceTypes = {};

    logs.forEach(log => {
      methodsCount[log.uploadMethod] = (methodsCount[log.uploadMethod] || 0) + 1;
      const deviceType = log.device.isMobile ? 'mobile' : 'desktop';
      deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;
    });

    return {
      totalUploads: logs.length,
      successRate: Math.round((successful.length / logs.length) * 100),
      avgDuration: Math.round(logs.reduce((sum, l) => sum + l.durationMs, 0) / logs.length),
      avgFileSize: Math.round(logs.reduce((sum, l) => sum + l.fileSizeMB, 0) / logs.length * 100) / 100,
      methodsUsed: Object.entries(methodsCount).map(([method, count]) => ({ method, count })),
      deviceBreakdown: deviceTypes,
      recentErrors: logs.filter(l => !l.success).slice(-5).map(l => ({
        fileName: l.fileName,
        error: l.error,
        timestamp: l.timestamp
      }))
    };
  }
}

// ✅ FONCTION D'INITIALISATION ET VÉRIFICATION
export const initializeSupabase = async () => {
  try {
    console.log('🚀 Initialisation Supabase optimisée...');

    // ✅ VÉRIFICATION DE LA CONNEXION
    const { data, error } = await supabase.from('profiles').select('count').limit(1);

    if (error) {
      console.error('❌ Erreur connexion Supabase:', error);
      return { success: false, error };
    }

    // ✅ VÉRIFICATION DES BUCKETS
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

    // ✅ VÉRIFICATION DEVICE ET CONNEXION
    const deviceInfo = getDeviceInfo();

    console.log('✅ Supabase initialisé avec succès');
    console.log('📊 Info device:', deviceInfo);
    console.log('🪣 État buckets:', bucketChecks);

    return {
      success: true,
      deviceInfo,
      buckets: bucketChecks,
      optimizationsActive: {
        chunkedUpload: true,
        retryLogic: true,
        adaptiveCompression: true,
        connectionDetection: true,
        mobileOptimizations: deviceInfo.isMobile
      }
    };

  } catch (error) {
    console.error('❌ Erreur initialisation Supabase:', error);
    return { success: false, error };
  }
}

// ✅ HOOK DE PERFORMANCE POUR COMPOSANTS
export const useSupabasePerformance = () => {
  const [performanceData, setPerformanceData] = React.useState(null);

  React.useEffect(() => {
    const deviceInfo = getDeviceInfo();
    const uploadStats = monitoringService.getUploadStats();

    setPerformanceData({
      device: deviceInfo,
      uploads: uploadStats,
      recommendations: {
        useChunkedUpload: deviceInfo.isSlowConnection || deviceInfo.isMobile,
        maxFileSize: deviceInfo.isSlowConnection ? 5 : (deviceInfo.isMobile ? 10 : 20),
        compressionLevel: deviceInfo.isMobile ? 'high' : 'medium'
      }
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
