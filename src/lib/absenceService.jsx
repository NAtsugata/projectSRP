// src/lib/absenceService.js
// Service Supabase pour gérer les absences des employés

import { supabase } from './supabase';
import { safeStorage } from '../utils/safeStorage';
import logger from '../utils/logger';

const STORAGE_KEY = 'employee_absences'; // Fallback localStorage

/**
 * Créer une nouvelle absence
 * @param {Object} absence - Données de l'absence
 * @returns {Promise<{data, error}>}
 */
export const createAbsence = async (absence) => {
  try {
    logger.log('➕ Création absence:', absence);

    const { data, error } = await supabase
      .from('employee_absences')
      .insert([{
        employee_id: absence.employeeId,
        start_date: absence.startDate,
        end_date: absence.endDate,
        reason: absence.reason || 'Congés',
        notes: absence.notes || null
      }])
      .select();

    if (error) {
      logger.error('❌ Erreur création absence:', error);
      logger.error('Code erreur:', error.code, 'Message:', error.message, 'Details:', error.details);

      // Fallback localStorage si table n'existe pas
      if (error.code === '42P01' || error.code === 'PGRST116') {
        logger.warn('⚠️ Table absences non trouvée, utilisation localStorage');
        return createAbsenceFallback(absence);
      }

      // Erreur de contrainte unique (si elle existe)
      if (error.code === '23505') {
        logger.error('⚠️ Contrainte unique violée - une absence similaire existe déjà');
        return { data: null, error: { message: 'Une absence similaire existe déjà pour cet employé' } };
      }

      throw error;
    }

    logger.log('✅ Absence créée avec succès, data:', data);
    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur générale création absence:', error);
    return { data: null, error };
  }
};

/**
 * Récupérer toutes les absences
 * @returns {Promise<{data, error}>}
 */
export const getAllAbsences = async () => {
  try {
    logger.log('📋 Récupération absences...');

    const { data, error } = await supabase
      .from('employee_absences')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      logger.error('❌ Erreur récupération absences:', error);

      // Fallback localStorage
      if (error.code === '42P01') {
        logger.warn('⚠️ Table absences non trouvée, utilisation localStorage');
        return getAllAbsencesFallback();
      }

      throw error;
    }

    logger.log('✅ Absences récupérées:', data.length);
    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur générale récupération absences:', error);
    return { data: null, error };
  }
};

/**
 * Supprimer une absence
 * @param {string} absenceId - ID de l'absence
 * @returns {Promise<{error}>}
 */
export const deleteAbsence = async (absenceId) => {
  try {
    logger.log('🗑️ Suppression absence:', absenceId);

    const { error } = await supabase
      .from('employee_absences')
      .delete()
      .eq('id', absenceId);

    if (error) {
      logger.error('❌ Erreur suppression absence:', error);

      // Fallback localStorage
      if (error.code === '42P01') {
        logger.warn('⚠️ Table absences non trouvée, utilisation localStorage');
        return deleteAbsenceFallback(absenceId);
      }

      throw error;
    }

    logger.log('✅ Absence supprimée avec succès');
    return { error: null };

  } catch (error) {
    logger.error('❌ Erreur générale suppression absence:', error);
    return { error };
  }
};

/**
 * Modifier une absence existante
 * @param {string} absenceId - ID de l'absence
 * @param {Object} updates - Données à mettre à jour
 * @returns {Promise<{data, error}>}
 */
export const updateAbsence = async (absenceId, updates) => {
  try {
    logger.log('✏️ Modification absence:', absenceId, updates);

    const { data, error } = await supabase
      .from('employee_absences')
      .update({
        employee_id: updates.employeeId,
        start_date: updates.startDate,
        end_date: updates.endDate,
        reason: updates.reason || 'Congés',
        notes: updates.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', absenceId)
      .select();

    if (error) {
      logger.error('❌ Erreur modification absence:', error);

      // Fallback localStorage
      if (error.code === '42P01' || error.code === 'PGRST116') {
        logger.warn('⚠️ Table absences non trouvée, utilisation localStorage');
        return updateAbsenceFallback(absenceId, updates);
      }

      throw error;
    }

    logger.log('✅ Absence modifiée avec succès, data:', data);
    return { data, error: null };

  } catch (error) {
    logger.error('❌ Erreur générale modification absence:', error);
    return { data: null, error };
  }
};

/**
 * Vérifier si une absence chevauche des absences existantes
 * @param {string} employeeId - ID de l'employé
 * @param {string} startDate - Date de début (YYYY-MM-DD)
 * @param {string} endDate - Date de fin (YYYY-MM-DD)
 * @param {string} excludeId - ID à exclure (pour édition)
 * @returns {Promise<{hasOverlap: boolean, overlapping: Array}>}
 */
export const checkAbsenceOverlap = async (employeeId, startDate, endDate, excludeId = null) => {
  try {
    logger.log('🔍 Vérification chevauchement:', { employeeId, startDate, endDate, excludeId });

    // Requête pour trouver les absences qui chevauchent la période
    let query = supabase
      .from('employee_absences')
      .select('id, start_date, end_date, reason')
      .eq('employee_id', employeeId)
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('❌ Erreur vérification chevauchement:', error);

      // Fallback localStorage
      if (error.code === '42P01') {
        return checkAbsenceOverlapFallback(employeeId, startDate, endDate, excludeId);
      }

      throw error;
    }

    const hasOverlap = data && data.length > 0;
    logger.log(hasOverlap ? '⚠️ Chevauchements trouvés:' : '✅ Aucun chevauchement', data);

    return {
      hasOverlap,
      overlapping: data || []
    };

  } catch (error) {
    logger.error('❌ Erreur générale vérification chevauchement:', error);
    return { hasOverlap: false, overlapping: [], error };
  }
};

/**
 * Exporter les absences en CSV
 * @param {Array} absences - Liste des absences
 * @param {Array} employees - Liste des employés
 * @param {Object} dateRange - Plage de dates optionnelle
 */
export const exportAbsencesToCSV = (absences, employees, dateRange = {}) => {
  const headers = [
    'Employé',
    'Date début',
    'Date fin',
    'Durée (jours)',
    'Type',
    'Notes'
  ];

  // Map employés pour lookup rapide
  const employeesMap = {};
  employees.forEach(e => { employeesMap[e.id] = e; });

  const rows = absences.map(absence => {
    const empId = absence.employeeId || absence.employee_id;
    const emp = employeesMap[empId];
    const startDate = absence.startDate || absence.start_date;
    const endDate = absence.endDate || absence.end_date;
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;

    return [
      emp?.full_name || emp?.name || 'Inconnu',
      startDate,
      endDate,
      days,
      absence.reason || 'Non spécifié',
      (absence.notes || '').replace(/"/g, '""') // Échapper les guillemets
    ];
  });

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n');

  // Téléchargement
  const BOM = '\uFEFF'; // Pour Excel UTF-8
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `absences_export_${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  logger.log('📥 Export CSV généré:', absences.length, 'absences');
};

/**
 * Vérifier si un employé est absent à une date donnée
 * @param {string} employeeId - ID de l'employé
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<boolean>}
 */
export const isEmployeeAbsent = async (employeeId, date) => {
  try {
    const { data, error } = await supabase
      .from('employee_absences')
      .select('id')
      .eq('employee_id', employeeId)
      .lte('start_date', date)
      .gte('end_date', date);

    if (error) {
      // Fallback localStorage
      if (error.code === '42P01') {
        return isEmployeeAbsentFallback(employeeId, date);
      }
      throw error;
    }

    return data && data.length > 0;

  } catch (error) {
    logger.error('❌ Erreur vérification absence:', error);
    return false;
  }
};

/**
 * Récupérer les employés absents à une date donnée
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<Array>}
 */
export const getAbsentEmployees = async (date) => {
  try {
    const { data, error } = await supabase
      .from('employee_absences')
      .select('employee_id')
      .lte('start_date', date)
      .gte('end_date', date);

    if (error) {
      // Fallback localStorage
      if (error.code === '42P01') {
        return getAbsentEmployeesFallback(date);
      }
      throw error;
    }

    return data ? data.map(a => a.employee_id) : [];

  } catch (error) {
    logger.error('❌ Erreur récupération employés absents:', error);
    return [];
  }
};

// ========== FALLBACK LOCALSTORAGE ==========
// (Utilisé si la table n'existe pas encore dans Supabase)

const createAbsenceFallback = (absence) => {
  try {
    const absences = safeStorage.getJSON(STORAGE_KEY, []);
    logger.log('📦 Fallback localStorage - absences existantes:', absences.length);

    // Générer un ID unique avec timestamp + random pour éviter les collisions
    const uniqueId = `absence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newAbsence = {
      id: uniqueId,
      employee_id: absence.employeeId,
      start_date: absence.startDate,
      end_date: absence.endDate,
      reason: absence.reason,
      notes: absence.notes,
      created_at: new Date().toISOString()
    };

    absences.push(newAbsence);
    const saved = safeStorage.setJSON(STORAGE_KEY, absences);

    if (!saved) {
      logger.error('❌ Fallback: échec sauvegarde localStorage');
      return { data: null, error: { message: 'Erreur sauvegarde localStorage' } };
    }

    logger.log('✅ Fallback: absence sauvegardée, total:', absences.length);
    return { data: [newAbsence], error: null };
  } catch (error) {
    logger.error('❌ Fallback: erreur création absence:', error);
    return { data: null, error };
  }
};

const getAllAbsencesFallback = () => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  return { data: absences, error: null };
};

const deleteAbsenceFallback = (absenceId) => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  const updated = absences.filter(a => a.id !== absenceId);
  safeStorage.setJSON(STORAGE_KEY, updated);
  return { error: null };
};

const updateAbsenceFallback = (absenceId, updates) => {
  try {
    const absences = safeStorage.getJSON(STORAGE_KEY, []);
    const index = absences.findIndex(a => a.id === absenceId);

    if (index === -1) {
      return { data: null, error: { message: 'Absence non trouvée' } };
    }

    const updatedAbsence = {
      ...absences[index],
      employee_id: updates.employeeId,
      start_date: updates.startDate,
      end_date: updates.endDate,
      reason: updates.reason,
      notes: updates.notes,
      updated_at: new Date().toISOString()
    };

    absences[index] = updatedAbsence;
    safeStorage.setJSON(STORAGE_KEY, absences);

    return { data: [updatedAbsence], error: null };
  } catch (error) {
    return { data: null, error };
  }
};

const checkAbsenceOverlapFallback = (employeeId, startDate, endDate, excludeId = null) => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  const overlapping = absences.filter(absence => {
    if (absence.employee_id !== employeeId) return false;
    if (excludeId && absence.id === excludeId) return false;

    const aStart = absence.start_date;
    const aEnd = absence.end_date;

    // Vérifier le chevauchement
    return aStart <= endDate && aEnd >= startDate;
  });

  return {
    hasOverlap: overlapping.length > 0,
    overlapping
  };
};

const isEmployeeAbsentFallback = (employeeId, date) => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  return absences.some(absence =>
    absence.employee_id === employeeId &&
    date >= absence.start_date &&
    date <= absence.end_date
  );
};

const getAbsentEmployeesFallback = (date) => {
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  return absences
    .filter(absence => date >= absence.start_date && date <= absence.end_date)
    .map(absence => absence.employee_id);
};

// ========== SCRIPT MIGRATION (à exécuter une fois) ==========
/**
 * Migrer les absences de localStorage vers Supabase
 * À appeler manuellement une fois que la table est créée
 */
export const migrateAbsencesToSupabase = async () => {
  try {
    const localAbsences = safeStorage.getJSON(STORAGE_KEY, []);
    if (localAbsences.length === 0) {
      logger.log('ℹ️ Aucune absence à migrer');
      return { success: true, migrated: 0 };
    }

    logger.log('🔄 Migration de', localAbsences.length, 'absences vers Supabase...');

    const absencesToInsert = localAbsences.map(a => ({
      employee_id: a.employee_id || a.employeeId,
      start_date: a.start_date || a.startDate,
      end_date: a.end_date || a.endDate,
      reason: a.reason,
      notes: a.notes
    }));

    const { error } = await supabase
      .from('employee_absences')
      .insert(absencesToInsert);

    if (error) throw error;

    // Supprimer de localStorage après migration réussie
    safeStorage.removeItem(STORAGE_KEY);

    logger.log('✅ Migration réussie:', localAbsences.length, 'absences');
    return { success: true, migrated: localAbsences.length };

  } catch (error) {
    logger.error('❌ Erreur migration absences:', error);
    return { success: false, error };
  }
};

// ========== CRÉATION TABLE SQL (à exécuter dans Supabase SQL Editor) ==========
/*
CREATE TABLE IF NOT EXISTS employee_absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_absences_employee ON employee_absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON employee_absences(start_date, end_date);

-- RLS (Row Level Security)
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs connectés peuvent voir toutes les absences
CREATE POLICY "Users can view all absences"
  ON employee_absences FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Les utilisateurs authentifiés peuvent créer des absences
CREATE POLICY "Authenticated users can create absences"
  ON employee_absences FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Les utilisateurs authentifiés peuvent modifier des absences
CREATE POLICY "Authenticated users can update absences"
  ON employee_absences FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy: Les utilisateurs authentifiés peuvent supprimer des absences
CREATE POLICY "Authenticated users can delete absences"
  ON employee_absences FOR DELETE
  USING (auth.role() = 'authenticated');
*/
