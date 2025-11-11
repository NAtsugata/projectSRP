// src/services/scannedDocumentsService.js - SERVICE DOCUMENTS SCANNÉS
import { supabase, storageService } from '../lib/supabase';

/**
 * Service pour gérer les documents scannés des utilisateurs
 *
 * Structure table "scanned_documents":
 * - id: UUID
 * - user_id: UUID (référence auth.users)
 * - title: VARCHAR(255)
 * - description: TEXT
 * - file_url: TEXT (URL Supabase Storage)
 * - file_name: VARCHAR(500)
 * - file_size: INTEGER
 * - file_type: VARCHAR(100)
 * - thumbnail_url: TEXT
 * - tags: TEXT[] (array de tags)
 * - category: VARCHAR(100) (facture, contrat, rapport, personnel, administratif, autre)
 * - created_at: TIMESTAMPTZ
 * - updated_at: TIMESTAMPTZ
 * - metadata: JSONB
 */

const scannedDocumentsService = {
  /**
   * Récupérer tous les documents d'un utilisateur
   */
  async getUserDocuments(userId) {
    try {
      const { data, error } = await supabase
        .from('scanned_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('❌ Erreur getUserDocuments:', error);
      return { data: null, error };
    }
  },

  /**
   * Récupérer tous les documents (admin seulement)
   */
  async getAllDocuments() {
    try {
      const { data, error } = await supabase
        .from('scanned_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('❌ Erreur getAllDocuments:', error);
      return { data: null, error };
    }
  },

  /**
   * Créer un document scanné (avec upload vers Storage)
   */
  async createDocument({ userId, title, description = '', category = 'autre', tags = [], file, metadata = {} }) {
    try {
      // 1. Upload le fichier vers Supabase Storage
      const uploadResult = await storageService.uploadFile(
        file,
        `scanned-docs/${userId}/${Date.now()}-${file.name}`
      );

      if (uploadResult.error) throw uploadResult.error;

      // 2. Créer le thumbnail si c'est une image
      let thumbnailUrl = null;
      if (file.type.startsWith('image/')) {
        thumbnailUrl = uploadResult.publicURL; // Peut être amélioré avec un vrai thumbnail
      }

      // 3. Insérer dans la base de données
      const docData = {
        user_id: userId,
        title,
        description,
        file_url: uploadResult.publicURL,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        thumbnail_url: thumbnailUrl,
        tags,
        category,
        metadata
      };

      const { data, error } = await supabase
        .from('scanned_documents')
        .insert([docData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur createDocument:', error);
      return { data: null, error };
    }
  },

  /**
   * Créer plusieurs documents en batch
   */
  async createMultipleDocuments({ userId, title, category, tags = [], files, description = '' }) {
    try {
      const results = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docTitle = files.length > 1 ? `${title} (${i + 1}/${files.length})` : title;

        const result = await this.createDocument({
          userId,
          title: docTitle,
          description,
          category,
          tags,
          file
        });

        if (result.error) {
          console.error(`Erreur upload fichier ${i + 1}:`, result.error);
          continue;
        }

        results.push(result.data);
      }

      return { data: results, error: null };
    } catch (error) {
      console.error('❌ Erreur createMultipleDocuments:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre à jour un document
   */
  async updateDocument(documentId, updates) {
    try {
      const { data, error } = await supabase
        .from('scanned_documents')
        .update(updates)
        .eq('id', documentId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erreur updateDocument:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un document (et son fichier dans Storage)
   */
  async deleteDocument(documentId, fileUrl) {
    try {
      // 1. Supprimer le fichier du Storage
      if (fileUrl) {
        // Extraire le path du fichier depuis l'URL
        const urlParts = fileUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'object') + 2; // Après 'object/public/'
        const filePath = urlParts.slice(bucketIndex).join('/');

        if (filePath) {
          await storageService.deleteFile(filePath);
        }
      }

      // 2. Supprimer l'entrée de la base de données
      const { error } = await supabase
        .from('scanned_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('❌ Erreur deleteDocument:', error);
      return { error };
    }
  },

  /**
   * Rechercher des documents
   */
  async searchDocuments(userId, searchTerm, isAdmin = false) {
    try {
      let query = supabase
        .from('scanned_documents')
        .select('*');

      // Filtre par utilisateur si pas admin
      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      // Recherche textuelle
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('❌ Erreur searchDocuments:', error);
      return { data: null, error };
    }
  },

  /**
   * Filtrer par catégorie
   */
  async getDocumentsByCategory(userId, category, isAdmin = false) {
    try {
      let query = supabase
        .from('scanned_documents')
        .select('*')
        .eq('category', category);

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('❌ Erreur getDocumentsByCategory:', error);
      return { data: null, error };
    }
  }
};

export default scannedDocumentsService;
