import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// --- Configuration Supabase ---
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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

// Fonction pour nettoyer les noms de fichiers
const sanitizeFileName = (fileName) => {
  // Remplace les espaces et les caractères non autorisés par des tirets
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  console.log('🧹 Nom de fichier nettoyé:', fileName, '->', cleaned);
  return cleaned;
};

export const storageService = {
  async uploadInterventionFile(file, interventionId, folder = 'report') {
    try {
      console.log('📤 Upload fichier intervention:', {
        fileName: file.name,
        size: Math.round(file.size / 1024) + 'KB',
        type: file.type,
        interventionId,
        folder
      });

      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `${interventionId}/${folder}/${fileName}`;

      console.log('🗂️ Chemin de stockage:', filePath);

      const { error } = await supabase.storage.from('intervention-files').upload(filePath, file);

      if (error) {
        console.error('❌ Erreur upload vers storage:', error);
        return { publicURL: null, error };
      }

      const { data } = supabase.storage.from('intervention-files').getPublicUrl(filePath);
      const publicURL = data.publicUrl;

      console.log('✅ Fichier uploadé avec succès:', publicURL);
      return { publicURL, error: null };

    } catch (error) {
      console.error('❌ Erreur générale upload intervention:', error);
      return { publicURL: null, error };
    }
  },

  async uploadVaultFile(file, userId) {
    try {
      console.log('📤 Upload fichier coffre-fort:', {
        fileName: file.name,
        size: Math.round(file.size / 1024) + 'KB',
        userId
      });

      const cleanFileName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}_${cleanFileName}`;
      const filePath = `${userId}/${fileName}`;

      console.log('🗂️ Chemin de stockage vault:', filePath);

      const { error } = await supabase.storage.from('vault-files').upload(filePath, file);

      if (error) {
        console.error('❌ Erreur upload vers vault storage:', error);
        return { publicURL: null, filePath: null, error };
      }

      const { data } = supabase.storage.from('vault-files').getPublicUrl(filePath);
      const publicURL = data.publicUrl;

      console.log('✅ Fichier vault uploadé avec succès:', publicURL);
      return { publicURL, filePath: filePath, error: null };

    } catch (error) {
      console.error('❌ Erreur générale upload vault:', error);
      return { publicURL: null, filePath: null, error };
    }
  },

  async deleteVaultFile(filePath) {
    console.log('🗑️ Suppression fichier vault:', filePath);
    const { error } = await supabase.storage.from('vault-files').remove([filePath]);
    if (error) {
      console.error('❌ Erreur suppression fichier vault:', error);
    } else {
      console.log('✅ Fichier vault supprimé avec succès');
    }
    return { error };
  },

  async deleteInterventionFolder(interventionId) {
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

    const { error: removeError } = await supabase.storage
      .from('intervention-files')
      .remove(filePaths);

    if (removeError) {
      console.error('❌ Erreur suppression fichiers intervention:', removeError);
    } else {
      console.log('✅ Dossier intervention supprimé avec succès');
    }

    return { error: removeError };
  }
}

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

  // ✅ CORRECTION PRINCIPALE: Fonction updateIntervention améliorée
  async updateIntervention(id, updates) {
    try {
      console.log('🔄 Mise à jour intervention', id, 'avec:', {
        hasReport: !!updates.report,
        status: updates.status,
        isArchived: updates.is_archived
      });

      // ✅ S'assurer que les objets complexes sont correctement sérialisés
      const sanitizedUpdates = { ...updates };

      // Si on met à jour le rapport, s'assurer qu'il est correctement formaté
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

        // Log détaillé des fichiers
        if (sanitizedUpdates.report.files.length > 0) {
          console.log('📁 Fichiers dans le rapport:');
          sanitizedUpdates.report.files.forEach((file, index) => {
            console.log(`  ${index + 1}. ${file.name} (${file.type}) - ${file.url}`);
          });
        }
      }

      // ✅ EXÉCUTION DE LA MISE À JOUR
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
        // On continue quand même la suppression en base
      }

      // Puis supprimer l'intervention de la base (les cascades supprimeront les relations)
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