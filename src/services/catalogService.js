// src/services/catalogService.js
// Service de gestion du catalogue produits/services et templates devis

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { withOrgId, getOrgId } from '../utils/orgHelper';

export const catalogService = {
  // =====================================================
  // CATALOG ITEMS (Produits et Services)
  // =====================================================

  /**
   * Recuperer tous les articles du catalogue
   * @param {Object} options - Options de filtrage
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getCatalogItems(options = {}) {
    const {
      itemType = null,
      category = null,
      searchTerm = null,
      activeOnly = true,
      favoritesFirst = true,
      limit = 100,
      offset = 0
    } = options;

    try {
      let query = supabase
        .from('catalog_items')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      if (itemType) {
        query = query.eq('item_type', itemType);
      }

      if (category) {
        query = query.eq('category', category);
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,reference.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.log('📦 getCatalogItems:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getCatalogItems:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer un article par son ID
   * @param {string} itemId - ID de l'article
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getCatalogItemById(itemId) {
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (error) throw error;

      logger.log('📦 getCatalogItemById:', itemId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getCatalogItemById:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer un nouvel article catalogue
   * @param {Object} itemData - Donnees de l'article
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createCatalogItem(itemData) {
    try {
      const itemToCreate = withOrgId({
        ...itemData,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });

      const { data, error } = await supabase
        .from('catalog_items')
        .insert([itemToCreate])
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ createCatalogItem:', data.name);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur createCatalogItem:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour un article catalogue
   * @param {string} itemId - ID de l'article
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateCatalogItem(itemId, updates) {
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ updateCatalogItem:', itemId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateCatalogItem:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un article (soft delete via is_active = false)
   * @param {string} itemId - ID de l'article
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteCatalogItem(itemId) {
    try {
      const { data, error } = await supabase
        .from('catalog_items')
        .update({ is_active: false })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

      logger.log('🗑️ deleteCatalogItem:', itemId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteCatalogItem:', error);
      return { data: null, error };
    }
  },

  /**
   * Basculer le statut favori d'un article
   * @param {string} itemId - ID de l'article
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async toggleFavorite(itemId) {
    try {
      // Recuperer l'etat actuel
      const { data: item, error: fetchError } = await supabase
        .from('catalog_items')
        .select('is_favorite')
        .eq('id', itemId)
        .single();

      if (fetchError) throw fetchError;

      // Basculer
      const { data, error } = await supabase
        .from('catalog_items')
        .update({ is_favorite: !item.is_favorite })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;

      logger.log('⭐ toggleFavorite:', itemId, !item.is_favorite);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur toggleFavorite:', error);
      return { data: null, error };
    }
  },

  /**
   * Recherche rapide dans le catalogue
   * @param {string} searchTerm - Terme de recherche
   * @param {string} itemType - Type d'article (optionnel)
   * @param {number} limit - Nombre max de resultats
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async searchCatalogItems(searchTerm, itemType = null, limit = 20) {
    try {
      // Essayer d'utiliser la fonction RPC
      const orgId = getOrgId();
      const { data, error } = await supabase.rpc('search_catalog_items', {
        p_organization_id: orgId,
        p_search_term: searchTerm,
        p_item_type: itemType,
        p_category: null,
        p_active_only: true,
        p_favorites_first: true,
        p_limit: limit,
        p_offset: 0
      });

      if (error) {
        // Fallback: recherche cote client
        return await this.getCatalogItems({
          searchTerm,
          itemType,
          limit,
          activeOnly: true,
          favoritesFirst: true
        });
      }

      logger.log('🔍 searchCatalogItems:', { term: searchTerm, count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur searchCatalogItems:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // CATEGORIES
  // =====================================================

  /**
   * Recuperer toutes les categories
   * @param {string} itemType - Filtrer par type (product, service, both)
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getCategories(itemType = null) {
    try {
      let query = supabase
        .from('catalog_categories')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (itemType) {
        query = query.or(`item_type.eq.${itemType},item_type.eq.both`);
      }

      const { data, error } = await query;

      if (error) throw error;

      logger.log('📂 getCategories:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getCategories:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer une nouvelle categorie
   * @param {Object} categoryData - Donnees de la categorie
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createCategory(categoryData) {
    try {
      // Obtenir la position max
      const { data: existing } = await supabase
        .from('catalog_categories')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existing?.length > 0 ? existing[0].position + 1 : 0;

      const categoryToCreate = withOrgId({
        ...categoryData,
        position: categoryData.position ?? nextPosition
      });

      const { data, error } = await supabase
        .from('catalog_categories')
        .insert([categoryToCreate])
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ createCategory:', data.name);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur createCategory:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour une categorie
   * @param {string} categoryId - ID de la categorie
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateCategory(categoryId, updates) {
    try {
      const { data, error } = await supabase
        .from('catalog_categories')
        .update(updates)
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ updateCategory:', categoryId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateCategory:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer une categorie
   * @param {string} categoryId - ID de la categorie
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteCategory(categoryId) {
    try {
      const { data, error } = await supabase
        .from('catalog_categories')
        .update({ is_active: false })
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;

      logger.log('🗑️ deleteCategory:', categoryId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteCategory:', error);
      return { data: null, error };
    }
  },

  /**
   * Reordonner les categories
   * @param {Array} categoryIds - IDs dans le nouvel ordre
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async reorderCategories(categoryIds) {
    try {
      const updates = categoryIds.map((id, index) =>
        supabase
          .from('catalog_categories')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);

      logger.log('🔄 reorderCategories:', categoryIds.length);
      return { data: { success: true }, error: null };
    } catch (error) {
      logger.error('❌ Erreur reorderCategories:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // TAX RATES (Taux TVA)
  // =====================================================

  /**
   * Recuperer tous les taux de TVA
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getTaxRates() {
    try {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;

      logger.log('💰 getTaxRates:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getTaxRates:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer le taux de TVA par defaut
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getDefaultTaxRate() {
    try {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Fallback: retourner 20% si pas de taux par defaut
      if (!data) {
        return { data: { rate: 20, name: 'TVA 20%' }, error: null };
      }

      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getDefaultTaxRate:', error);
      return { data: { rate: 20, name: 'TVA 20%' }, error: null };
    }
  },

  /**
   * Creer un nouveau taux de TVA
   * @param {Object} rateData - Donnees du taux
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createTaxRate(rateData) {
    try {
      // Obtenir la position max
      const { data: existing } = await supabase
        .from('tax_rates')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existing?.length > 0 ? existing[0].position + 1 : 0;

      const rateToCreate = withOrgId({
        ...rateData,
        position: rateData.position ?? nextPosition
      });

      const { data, error } = await supabase
        .from('tax_rates')
        .insert([rateToCreate])
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ createTaxRate:', data.name);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur createTaxRate:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour un taux de TVA
   * @param {string} rateId - ID du taux
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateTaxRate(rateId, updates) {
    try {
      const { data, error } = await supabase
        .from('tax_rates')
        .update(updates)
        .eq('id', rateId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ updateTaxRate:', rateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateTaxRate:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un taux de TVA
   * @param {string} rateId - ID du taux
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteTaxRate(rateId) {
    try {
      const { data, error } = await supabase
        .from('tax_rates')
        .update({ is_active: false })
        .eq('id', rateId)
        .select()
        .single();

      if (error) throw error;

      logger.log('🗑️ deleteTaxRate:', rateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteTaxRate:', error);
      return { data: null, error };
    }
  },

  /**
   * Definir un taux comme taux par defaut
   * @param {string} rateId - ID du taux
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async setDefaultTaxRate(rateId) {
    try {
      // Retirer l'ancien defaut
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('is_default', true);

      // Definir le nouveau defaut
      const { data, error } = await supabase
        .from('tax_rates')
        .update({ is_default: true })
        .eq('id', rateId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ setDefaultTaxRate:', rateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur setDefaultTaxRate:', error);
      return { data: null, error };
    }
  },

  /**
   * Initialiser les taux de TVA par defaut pour une organisation
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async initializeDefaultTaxRates() {
    try {
      const orgId = getOrgId();
      const { data, error } = await supabase.rpc('initialize_tax_rates', {
        p_organization_id: orgId
      });

      if (error) throw error;

      logger.log('✅ initializeDefaultTaxRates');
      return { data: { success: true }, error: null };
    } catch (error) {
      logger.error('❌ Erreur initializeDefaultTaxRates:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // QUOTE TEMPLATES (Modeles de devis)
  // =====================================================

  /**
   * Recuperer tous les modeles de devis
   * @returns {Promise<{data: Array, error: Object}>}
   */
  async getQuoteTemplates() {
    try {
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      logger.log('📄 getQuoteTemplates:', { count: data?.length || 0 });
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getQuoteTemplates:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer un modele par son ID
   * @param {string} templateId - ID du modele
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getQuoteTemplateById(templateId) {
    try {
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      logger.log('📄 getQuoteTemplateById:', templateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getQuoteTemplateById:', error);
      return { data: null, error };
    }
  },

  /**
   * Recuperer le modele par defaut
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getDefaultQuoteTemplate() {
    try {
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Retourner un template par defaut si aucun n'existe
      if (!data) {
        return {
          data: {
            name: 'Modele par defaut',
            header_text: '',
            footer_text: '',
            terms_text: 'Devis gratuit et sans engagement. Validite 30 jours.',
            validity_days: 30,
            show_logo: true,
            show_reference: true,
            show_item_description: true,
            show_discount_column: false,
            primary_color: '#3B82F6'
          },
          error: null
        };
      }

      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getDefaultQuoteTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Creer un nouveau modele de devis
   * @param {Object} templateData - Donnees du modele
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async createQuoteTemplate(templateData) {
    try {
      const templateToCreate = withOrgId(templateData);

      const { data, error } = await supabase
        .from('quote_templates')
        .insert([templateToCreate])
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ createQuoteTemplate:', data.name);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur createQuoteTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Mettre a jour un modele de devis
   * @param {string} templateId - ID du modele
   * @param {Object} updates - Mises a jour
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async updateQuoteTemplate(templateId, updates) {
    try {
      const { data, error } = await supabase
        .from('quote_templates')
        .update(updates)
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ updateQuoteTemplate:', templateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur updateQuoteTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Supprimer un modele de devis
   * @param {string} templateId - ID du modele
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async deleteQuoteTemplate(templateId) {
    try {
      const { data, error } = await supabase
        .from('quote_templates')
        .update({ is_active: false })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      logger.log('🗑️ deleteQuoteTemplate:', templateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur deleteQuoteTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Definir un modele comme modele par defaut
   * @param {string} templateId - ID du modele
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async setDefaultQuoteTemplate(templateId) {
    try {
      // Retirer l'ancien defaut
      await supabase
        .from('quote_templates')
        .update({ is_default: false })
        .eq('is_default', true);

      // Definir le nouveau defaut
      const { data, error } = await supabase
        .from('quote_templates')
        .update({ is_default: true })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      logger.log('✅ setDefaultQuoteTemplate:', templateId);
      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur setDefaultQuoteTemplate:', error);
      return { data: null, error };
    }
  },

  /**
   * Dupliquer un modele de devis
   * @param {string} templateId - ID du modele a dupliquer
   * @param {string} newName - Nouveau nom
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async duplicateQuoteTemplate(templateId, newName) {
    try {
      // Recuperer le modele original
      const { data: original, error: fetchError } = await this.getQuoteTemplateById(templateId);
      if (fetchError) throw fetchError;

      // Creer la copie
      const { id, created_at, updated_at, ...templateData } = original;
      const duplicateData = {
        ...templateData,
        name: newName || `${original.name} (copie)`,
        is_default: false
      };

      return await this.createQuoteTemplate(duplicateData);
    } catch (error) {
      logger.error('❌ Erreur duplicateQuoteTemplate:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // IMPORT / EXPORT
  // =====================================================

  /**
   * Importer des articles depuis un CSV
   * @param {Array} csvData - Donnees CSV parsees
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async importCatalogCSV(csvData) {
    try {
      const orgId = getOrgId();
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const itemsToInsert = csvData.map(row => ({
        organization_id: orgId,
        item_type: row.type || row.item_type || 'product',
        category: row.category || row.categorie || null,
        reference: row.reference || row.ref || null,
        name: row.name || row.nom || row.description,
        description: row.description_detail || row.details || null,
        unit_price: parseFloat(row.price || row.prix || row.unit_price || 0),
        unit: row.unit || row.unite || 'unite',
        tax_rate: parseFloat(row.tva || row.tax_rate || 20),
        is_active: true,
        is_favorite: false,
        created_by: userId
      })).filter(item => item.name); // Filtrer les lignes sans nom

      const { data, error } = await supabase
        .from('catalog_items')
        .insert(itemsToInsert)
        .select();

      if (error) throw error;

      logger.log('📥 importCatalogCSV:', { count: data?.length || 0 });
      return { data: { imported: data?.length || 0 }, error: null };
    } catch (error) {
      logger.error('❌ Erreur importCatalogCSV:', error);
      return { data: null, error };
    }
  },

  /**
   * Exporter le catalogue en CSV
   * @param {Object} filters - Filtres
   * @returns {Promise<{data: string, error: Object}>}
   */
  async exportCatalogCSV(filters = {}) {
    try {
      const { data: items, error } = await this.getCatalogItems({
        ...filters,
        limit: 10000
      });

      if (error) throw error;

      const headers = [
        'Type',
        'Reference',
        'Nom',
        'Description',
        'Categorie',
        'Prix HT',
        'Unite',
        'TVA %',
        'Favori',
        'Stock'
      ];

      const rows = items.map(item => [
        item.item_type,
        item.reference || '',
        item.name,
        item.description || '',
        item.category || '',
        item.unit_price,
        item.unit,
        item.tax_rate,
        item.is_favorite ? 'Oui' : 'Non',
        item.track_stock ? item.stock_quantity : ''
      ]);

      const csv = [
        headers.join(';'),
        ...rows.map(row => row.map(cell =>
          typeof cell === 'string' && (cell.includes(';') || cell.includes('\n'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(';'))
      ].join('\n');

      logger.log('📤 exportCatalogCSV:', { count: items.length });
      return { data: csv, error: null };
    } catch (error) {
      logger.error('❌ Erreur exportCatalogCSV:', error);
      return { data: null, error };
    }
  },

  // =====================================================
  // STATISTIQUES
  // =====================================================

  /**
   * Obtenir les statistiques du catalogue
   * @returns {Promise<{data: Object, error: Object}>}
   */
  async getCatalogStats() {
    try {
      const { data, error } = await supabase
        .from('catalog_stats')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Fallback si la vue n'existe pas ou est vide
      if (!data) {
        const { data: items } = await this.getCatalogItems({ limit: 10000 });
        const stats = {
          total_items: items?.length || 0,
          product_count: items?.filter(i => i.item_type === 'product').length || 0,
          service_count: items?.filter(i => i.item_type === 'service').length || 0,
          favorite_count: items?.filter(i => i.is_favorite).length || 0,
          low_stock_count: items?.filter(i =>
            i.track_stock && i.stock_quantity <= i.min_stock_alert
          ).length || 0
        };
        return { data: stats, error: null };
      }

      return { data, error: null };
    } catch (error) {
      logger.error('❌ Erreur getCatalogStats:', error);
      return { data: null, error };
    }
  }
};

export default catalogService;
