// src/lib/templateService.js
// Service Supabase pour gérer les modèles d'interventions

import { supabase } from './supabase';
import { safeStorage } from '../utils/safeStorage';
import logger from '../utils/logger';

const STORAGE_KEY = 'intervention_templates'; // Fallback localStorage

/**
 * Créer un nouveau modèle
 * @param {Object} template - Données du modèle
 * @param {string} userId - ID de l'utilisateur (optionnel)
 * @returns {Promise<{data, error}>}
 */
export const createTemplate = async (template, userId = null) => {
  try {
    logger.log('➕ Création modèle:', template);

    const { data, error } = await supabase
      .from('intervention_templates')
      .insert([{
        user_id: userId,
        name: template.name,
        client: template.client || null,
        service: template.service || null,
        address: template.address || null,
        estimated_duration: template.estimated_duration || 2,
        type: template.type || null,
        notes: template.notes || null
      }])
      .select();

    if (error) {
      logger.error('❌ Erreur création modèle:', error);

      // Fallback localStorage si table n'existe pas
      if (error.code === '42P01') {
        logger.warn('⚠️ Table templates non trouvée, utilisation localStorage');
        return createTemplateFallback(template);
      }

      throw error;
    }

    logger.log('✅ Modèle créé avec succès');
    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur générale création modèle:', error);
    return { data: null, error };
  }
};

/**
 * Récupérer tous les modèles
 * @param {string} userId - ID de l'utilisateur (optionnel, pour filtrer par utilisateur)
 * @returns {Promise<{data, error}>}
 */
export const getAllTemplates = async (userId = null) => {
  try {
    logger.log('📋 Récupération modèles...');

    let query = supabase
      .from('intervention_templates')
      .select('*')
      .order('created_at', { ascending: false });

    // Filtrer par utilisateur si spécifié
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`); // Templates personnels + publics
    }

    const { data, error } = await query;

    if (error) {
      logger.error('❌ Erreur récupération modèles:', error);

      // Fallback localStorage
      if (error.code === '42P01') {
        logger.warn('⚠️ Table templates non trouvée, utilisation localStorage');
        return getAllTemplatesFallback();
      }

      throw error;
    }

    logger.log('✅ Modèles récupérés:', data.length);
    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur générale récupération modèles:', error);
    return { data: null, error };
  }
};

/**
 * Mettre à jour un modèle
 * @param {string} templateId - ID du modèle
 * @param {Object} updates - Modifications à apporter
 * @returns {Promise<{data, error}>}
 */
export const updateTemplate = async (templateId, updates) => {
  try {
    logger.log('✏️ Mise à jour modèle:', templateId, updates);

    const { data, error } = await supabase
      .from('intervention_templates')
      .update({
        name: updates.name,
        client: updates.client,
        service: updates.service,
        address: updates.address,
        estimated_duration: updates.estimated_duration,
        type: updates.type,
        notes: updates.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select();

    if (error) {
      logger.error('❌ Erreur mise à jour modèle:', error);

      // Fallback localStorage
      if (error.code === '42P01') {
        logger.warn('⚠️ Table templates non trouvée, utilisation localStorage');
        return updateTemplateFallback(templateId, updates);
      }

      throw error;
    }

    logger.log('✅ Modèle mis à jour avec succès');
    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur générale mise à jour modèle:', error);
    return { data: null, error };
  }
};

/**
 * Supprimer un modèle
 * @param {string} templateId - ID du modèle
 * @returns {Promise<{error}>}
 */
export const deleteTemplate = async (templateId) => {
  try {
    logger.log('🗑️ Suppression modèle:', templateId);

    const { error } = await supabase
      .from('intervention_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      logger.error('❌ Erreur suppression modèle:', error);

      // Fallback localStorage
      if (error.code === '42P01') {
        logger.warn('⚠️ Table templates non trouvée, utilisation localStorage');
        return deleteTemplateFallback(templateId);
      }

      throw error;
    }

    logger.log('✅ Modèle supprimé avec succès');
    return { error: null };

  } catch (error) {
    logger.error('❌ Erreur générale suppression modèle:', error);
    return { error };
  }
};

/**
 * Créer une intervention à partir d'un modèle
 * @param {Object} template - Modèle source
 * @param {Object} overrides - Valeurs à surcharger
 * @returns {Object} - Nouvelle intervention
 */
export const createFromTemplate = (template, overrides = {}) => {
  return {
    client: template.client || '',
    service: template.service || '',
    address: template.address || '',
    estimated_duration: template.estimated_duration || 2,
    type: template.type || '',
    notes: template.notes || '',
    ...overrides,
    status: 'planned',
    created_at: new Date().toISOString()
  };
};

/**
 * Créer un modèle à partir d'une intervention
 * @param {Object} intervention - Intervention source
 * @param {string} templateName - Nom du modèle
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{data, error}>}
 */
export const createTemplateFromIntervention = async (intervention, templateName, userId = null) => {
  const template = {
    name: templateName,
    client: intervention.client,
    service: intervention.service,
    address: intervention.address,
    estimated_duration: intervention.estimated_duration,
    type: intervention.type,
    notes: intervention.notes
  };

  return createTemplate(template, userId);
};

// ========== FALLBACK LOCALSTORAGE ==========
// (Utilisé si la table n'existe pas encore dans Supabase)

const createTemplateFallback = (template) => {
  const templates = safeStorage.getJSON(STORAGE_KEY, []);
  const newTemplate = {
    id: `template-${Date.now()}`,
    name: template.name,
    client: template.client,
    service: template.service,
    address: template.address,
    estimated_duration: template.estimated_duration || 2,
    type: template.type,
    notes: template.notes,
    created_at: new Date().toISOString()
  };
  templates.push(newTemplate);
  safeStorage.setJSON(STORAGE_KEY, templates);
  return { data: [newTemplate], error: null };
};

const getAllTemplatesFallback = () => {
  const templates = safeStorage.getJSON(STORAGE_KEY, []);
  return { data: templates, error: null };
};

const updateTemplateFallback = (templateId, updates) => {
  const templates = safeStorage.getJSON(STORAGE_KEY, []);
  const index = templates.findIndex(t => t.id === templateId);

  if (index !== -1) {
    templates[index] = {
      ...templates[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    safeStorage.setJSON(STORAGE_KEY, templates);
    return { data: [templates[index]], error: null };
  }

  return { data: null, error: new Error('Template not found') };
};

const deleteTemplateFallback = (templateId) => {
  const templates = safeStorage.getJSON(STORAGE_KEY, []);
  const updated = templates.filter(t => t.id !== templateId);
  safeStorage.setJSON(STORAGE_KEY, updated);
  return { error: null };
};

// ========== SCRIPT MIGRATION (à exécuter une fois) ==========
/**
 * Migrer les modèles de localStorage vers Supabase
 * À appeler manuellement une fois que la table est créée
 */
export const migrateTemplatesToSupabase = async (userId = null) => {
  try {
    const localTemplates = safeStorage.getJSON(STORAGE_KEY, []);
    if (localTemplates.length === 0) {
      logger.log('ℹ️ Aucun modèle à migrer');
      return { success: true, migrated: 0 };
    }

    logger.log('🔄 Migration de', localTemplates.length, 'modèles vers Supabase...');

    const templatesToInsert = localTemplates.map(t => ({
      user_id: userId,
      name: t.name,
      client: t.client,
      service: t.service,
      address: t.address,
      estimated_duration: t.estimated_duration || 2,
      type: t.type,
      notes: t.notes
    }));

    const { error } = await supabase
      .from('intervention_templates')
      .insert(templatesToInsert);

    if (error) throw error;

    // Supprimer de localStorage après migration réussie
    safeStorage.removeItem(STORAGE_KEY);

    logger.log('✅ Migration réussie:', localTemplates.length, 'modèles');
    return { success: true, migrated: localTemplates.length };

  } catch (error) {
    logger.error('❌ Erreur migration modèles:', error);
    return { success: false, error };
  }
};

// ========== CRÉATION TABLE SQL (à exécuter dans Supabase SQL Editor) ==========
/*
CREATE TABLE IF NOT EXISTS intervention_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  service TEXT,
  address TEXT,
  estimated_duration NUMERIC(4,2) DEFAULT 2.0,
  type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_duration CHECK (estimated_duration > 0)
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_templates_user ON intervention_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_name ON intervention_templates(name);

-- RLS (Row Level Security)
ALTER TABLE intervention_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leurs propres modèles + modèles publics (user_id null)
CREATE POLICY "Users can view own and public templates"
  ON intervention_templates FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (user_id = auth.uid() OR user_id IS NULL)
  );

-- Policy: Les utilisateurs peuvent créer leurs propres modèles
CREATE POLICY "Users can create own templates"
  ON intervention_templates FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    user_id = auth.uid()
  );

-- Policy: Les utilisateurs peuvent modifier leurs propres modèles
CREATE POLICY "Users can update own templates"
  ON intervention_templates FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    user_id = auth.uid()
  );

-- Policy: Les utilisateurs peuvent supprimer leurs propres modèles
CREATE POLICY "Users can delete own templates"
  ON intervention_templates FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    user_id = auth.uid()
  );

-- Policy: Les admins peuvent créer des modèles publics
CREATE POLICY "Admins can create public templates"
  ON intervention_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    ) AND user_id IS NULL
  );

-- Policy: Les admins peuvent modifier tous les modèles
CREATE POLICY "Admins can update all templates"
  ON intervention_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Policy: Les admins peuvent supprimer tous les modèles
CREATE POLICY "Admins can delete all templates"
  ON intervention_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
*/
