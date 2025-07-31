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
    return supabase.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    return { error };
  },
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

// --- Services de données ---

export const profileService = {
  async getProfile(userId) {
    return await supabase.from('profiles').select('*').eq('id', userId).single();
  },
  async getAllProfiles() {
    return await supabase.from('profiles').select('*').order('full_name');
  },
  async updateProfile(userId, updates) {
    const { full_name, is_admin } = updates;
    const updateData = { full_name, is_admin };
    return await supabase.from('profiles').update(updateData).eq('id', userId);
  }
}

export const storageService = {
  async uploadInterventionFile(file, interventionId, folder = 'report') {
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${interventionId}/${folder}/${fileName}`;
    const { error } = await supabase.storage.from('intervention-files').upload(filePath, file);
    if (error) return { publicURL: null, error };
    const { data } = supabase.storage.from('intervention-files').getPublicUrl(filePath);
    return { publicURL: data.publicUrl, error: null };
  },

  // CORRIGÉ: La fonction retourne maintenant l'URL publique et le chemin du fichier.
  async uploadVaultFile(file, userId) {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${userId}/${fileName}`;
      const { error } = await supabase.storage.from('vault-files').upload(filePath, file);
      if (error) return { publicURL: null, filePath: null, error };
      const { data } = supabase.storage.from('vault-files').getPublicUrl(filePath);
      return { publicURL: data.publicUrl, filePath: filePath, error: null };
  },

  async deleteVaultFile(filePath) {
      const { error } = await supabase.storage.from('vault-files').remove([filePath]);
      return { error };
  },
  async deleteInterventionFolder(interventionId) {
    const folderPath = interventionId.toString();
    const { data: files, error: listError } = await supabase.storage.from('intervention-files').list(folderPath, { recursive: true });
    if (listError) {
        console.error("Erreur lors du listage des fichiers à supprimer:", listError);
        return { error: listError };
    }
    if (!files || files.length === 0) return { error: null };
    const filePaths = files.map(file => `${folderPath}/${file.name}`);
    const { error: removeError } = await supabase.storage.from('intervention-files').remove(filePaths);
    return { error: removeError };
  }
}

export const interventionService = {
  // ... (service intervention inchangé)
  async getInterventions(userId = null, archived = false) {
    let query = supabase.from('interventions').select('*, intervention_assignments(profiles(full_name)), intervention_briefing_documents(*)').eq('is_archived', archived).order('date', { ascending: true }).order('time', { ascending: true });
    if (userId) {
      query = query.filter('intervention_assignments.user_id', 'eq', userId);
    }
    return await query;
  },
  async createIntervention(intervention, assignedUserIds, briefingFiles) {
    const { data: interventionData, error: interventionError } = await supabase.from('interventions').insert([{ client: intervention.client, address: intervention.address, service: intervention.service, date: intervention.date, time: intervention.time, }]).select().single();
    if (interventionError) return { error: interventionError };
    const interventionId = interventionData.id;
    const assignments = assignedUserIds.map(userId => ({ intervention_id: interventionId, user_id: userId }));
    const { error: assignmentError } = await supabase.from('intervention_assignments').insert(assignments);
    if (assignmentError) return { error: assignmentError };
    for (const file of briefingFiles) {
        const { publicURL, error: uploadError } = await storageService.uploadInterventionFile(file, interventionId, 'briefing');
        if (uploadError) return { error: uploadError };
        await supabase.from('intervention_briefing_documents').insert({ intervention_id: interventionId, file_name: file.name, file_url: publicURL });
    }
    return { error: null };
  },
  async updateIntervention(id, updates) {
    return await supabase.from('interventions').update(updates).eq('id', id);
  },
  async deleteIntervention(id) {
    const { error: storageError } = await storageService.deleteInterventionFolder(id);
    if (storageError) console.error(`Impossible de supprimer le dossier de stockage pour l'intervention ${id}:`, storageError);
    return await supabase.from('interventions').delete().eq('id', id);
  }
}

export const leaveService = {
  // ... (service leave inchangé)
  async getLeaveRequests(userId = null) {
    let query = supabase.from('leave_requests').select('*').order('start_date', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    return await query;
  },
  async createLeaveRequest(request) {
    const { userName, startDate, endDate, reason, userId } = request;
    return await supabase.from('leave_requests').insert([{ user_id: userId, user_name: userName, start_date: startDate, end_date: endDate, reason: reason, status: 'En attente' }]);
  },
  async updateRequestStatus(requestId, status, rejection_reason = null) {
    return await supabase.from('leave_requests').update({ status, rejection_reason }).eq('id', requestId);
  },
  async deleteLeaveRequest(requestId) {
    return await supabase.from('leave_requests').delete().eq('id', requestId);
  }
}

// NOUVEAU: Service pour gérer les documents du coffre-fort dans la base de données
export const vaultService = {
  async getVaultDocuments() {
    // On récupère aussi le nom de l'employé pour l'affichage
    return await supabase.from('vault_documents').select('*, profiles(full_name)').order('created_at', { ascending: false });
  },

  async createVaultDocument({ userId, name, url, path }) {
    return await supabase.from('vault_documents').insert([{
      user_id: userId,
      file_name: name,
      file_url: url,
      file_path: path, // On sauvegarde le chemin pour pouvoir le supprimer du stockage
    }]);
  },

  async deleteVaultDocument(documentId) {
    const { data: doc, error: fetchError } = await supabase.from('vault_documents').select('file_path').eq('id', documentId).single();
    if (fetchError || !doc) {
      console.error("Document non trouvé pour la suppression:", fetchError);
      return { error: fetchError || new Error("Document not found") };
    }

    const { error: storageError } = await storageService.deleteVaultFile(doc.file_path);
    if (storageError) {
      console.error("Impossible de supprimer le fichier du stockage:", storageError);
      // On arrête ici pour ne pas avoir un enregistrement sans fichier
      return { error: storageError };
    }

    return await supabase.from('vault_documents').delete().eq('id', documentId);
  }
}

// Le service payslip n'est plus nécessaire si on utilise vaultService,
// mais je le laisse au cas où vous l'utilisiez ailleurs.
export const payslipService = {
    async getPayslips(userId) {
      const { data: fileList, error: listError } = await supabase.storage.from('vault-files').list(userId);
      if (listError) return { data: [], error: listError };
      if (!fileList || fileList.length === 0) return { data: [], error: null };
      const filePaths = fileList.map(file => `${userId}/${file.name}`);
      const { data: signedUrls, error: urlError } = await supabase.storage.from('vault-files').createSignedUrls(filePaths, 3600);
      if (urlError) return { data: [], error: urlError };
      const filesWithUrls = signedUrls.map((urlData, index) => ({
          id: fileList[index].id,
          name: fileList[index].name,
          path: filePaths[index],
          url: urlData.signedUrl
      }));
      return { data: filesWithUrls, error: null };
    }
}
