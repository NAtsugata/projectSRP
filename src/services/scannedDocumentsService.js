// src/services/scannedDocumentsService.js - SERVICE DOCUMENTS SCANNÉS
import { supabase, storageService } from '../lib/supabase';
import { sanitizeFilename } from '../utils/sanitize';
import logger from '../utils/logger';
import { withOrgId } from '../utils/orgHelper';

/**
 * Échappe les caractères spéciaux pour les requêtes SQL LIKE
 * Prévient les injections SQL via les wildcards
 * @param {string} str - Chaîne à échapper
 * @returns {string} Chaîne échappée
 */
const escapeSQLLike = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[%_\\]/g, '\\$&');
};

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

const SCANNED_DOC_LIST_COLUMNS = 'id, user_id, title, description, file_url, file_name, file_type, thumbnail_url, tags, category, created_at';

const scannedDocumentsService = {
  /**
   * Récupérer tous les documents d'un utilisateur
   */
  async getUserDocuments(userId) {
    try {
      const { data, error } = await supabase
        .from('scanned_documents')
        .select(SCANNED_DOC_LIST_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      logger.error('❌ Erreur getUserDocuments:', error);
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
        .select(SCANNED_DOC_LIST_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      logger.error('❌ Erreur getAllDocuments:', error);
      return { data: null, error };
    }
  },

  /**
   * Créer un document scanné (avec upload vers Storage)
   */
  async createDocument({ userId, title, description = '', category = 'autre', tags = [], file, metadata = {} }) {
    try {
      // 1. Upload le fichier vers Supabase Storage
      // Sanitize le nom de fichier pour éviter path traversal
      const safeFileName = sanitizeFilename(file.name);
      const uploadResult = await storageService.uploadFile(
        file,
        `scanned-docs/${userId}/${Date.now()}-${safeFileName}`
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
        file_name: safeFileName, // Utiliser le nom sanitizé
        file_size: file.size,
        file_type: file.type,
        thumbnail_url: thumbnailUrl,
        tags,
        category,
        metadata
      };

      const { data, error } = await supabase
        .from('scanned_documents')
        .insert([withOrgId(docData)])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur createDocument:', error);
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
          logger.error(`Erreur upload fichier ${i + 1}:`, result.error);
          continue;
        }

        results.push(result.data);
      }

      return { data: results, error: null };
    } catch (error) {
      logger.error('❌ Erreur createMultipleDocuments:', error);
      return { data: null, error };
    }
  },

  /**
   * Sauvegarder des documents scannés depuis le scanner
   * Convertit les blobs en fichiers et les upload
   * @param {Array} scannedDocs - Documents du scanner avec blob/url
   * @param {Object} metadata - { title, category, user_id, tags, description }
   */
  async saveDocuments(scannedDocs, metadata = {}) {
    try {
      const { title = 'Document scanné', category = 'autre', user_id, tags = [], description = '' } = metadata;

      if (!user_id) {
        throw new Error('user_id est requis pour sauvegarder les documents');
      }

      if (!scannedDocs || scannedDocs.length === 0) {
        throw new Error('Aucun document à sauvegarder');
      }

      const results = [];

      for (let i = 0; i < scannedDocs.length; i++) {
        const doc = scannedDocs[i];
        const docTitle = scannedDocs.length > 1 ? `${title} (${i + 1}/${scannedDocs.length})` : title;

        // Convertir le blob en File si nécessaire
        let file;
        if (doc.blob instanceof Blob) {
          const fileName = `scan_${Date.now()}_${i + 1}.jpg`;
          file = new File([doc.blob], fileName, { type: doc.blob.type || 'image/jpeg' });
        } else if (doc.url && doc.url.startsWith('data:')) {
          // Convertir dataURL en File
          const response = await fetch(doc.url);
          const blob = await response.blob();
          const fileName = `scan_${Date.now()}_${i + 1}.jpg`;
          file = new File([blob], fileName, { type: 'image/jpeg' });
        } else {
          logger.warn(`Document ${i + 1} n'a pas de blob valide, ignoré`);
          continue;
        }

        const result = await this.createDocument({
          userId: user_id,
          title: docTitle,
          description,
          category,
          tags,
          file,
          metadata: {
            scannedAt: doc.timestamp || new Date().toISOString(),
            enhanceMode: doc.enhanceMode || 'original',
            rotation: doc.rotation || 0,
            wasDetected: doc.wasDetected || false
          }
        });

        if (result.error) {
          logger.error(`Erreur sauvegarde document ${i + 1}:`, result.error);
          continue;
        }

        results.push(result.data);
      }

      if (results.length === 0) {
        throw new Error('Aucun document n\'a pu être sauvegardé');
      }

      logger.log(`✅ ${results.length}/${scannedDocs.length} documents sauvegardés`);
      return { data: results, error: null };
    } catch (error) {
      logger.error('❌ Erreur saveDocuments:', error);
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
      logger.error('❌ Erreur updateDocument:', error);
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
      logger.error('❌ Erreur deleteDocument:', error);
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
        .select(SCANNED_DOC_LIST_COLUMNS);

      // Filtre par utilisateur si pas admin
      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      // Recherche textuelle (avec échappement des caractères spéciaux SQL)
      if (searchTerm) {
        const safeTerm = escapeSQLLike(searchTerm);
        query = query.or(`title.ilike.%${safeTerm}%,description.ilike.%${safeTerm}%`);
      }

      query = query.order('created_at', { ascending: false }).limit(200);

      const { data, error } = await query;

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      logger.error('❌ Erreur searchDocuments:', error);
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
        .select(SCANNED_DOC_LIST_COLUMNS)
        .eq('category', category);

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      query = query.order('created_at', { ascending: false }).limit(200);

      const { data, error } = await query;

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      logger.error('❌ Erreur getDocumentsByCategory:', error);
      return { data: null, error };
    }
  }
};

export default scannedDocumentsService;
