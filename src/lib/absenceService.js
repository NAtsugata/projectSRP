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

      // Fallback localStorage si table n'existe pas
      if (error.code === '42P01') {
        logger.warn('⚠️ Table absences non trouvée, utilisation localStorage');
        return createAbsenceFallback(absence);
      }

      throw error;
    }

    logger.log('✅ Absence créée avec succès');
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
  const absences = safeStorage.getJSON(STORAGE_KEY, []);
  const newAbsence = {
    id: `absence-${Date.now()}`,
    employee_id: absence.employeeId,
    start_date: absence.startDate,
    end_date: absence.endDate,
    reason: absence.reason,
    notes: absence.notes,
    created_at: new Date().toISOString()
  };
  absences.push(newAbsence);
  safeStorage.setJSON(STORAGE_KEY, absences);
  return { data: [newAbsence], error: null };
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

-- Policy: Les admins peuvent créer des absences
CREATE POLICY "Admins can create absences"
  ON employee_absences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Policy: Les admins peuvent modifier des absences
CREATE POLICY "Admins can update absences"
  ON employee_absences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Policy: Les admins peuvent supprimer des absences
CREATE POLICY "Admins can delete absences"
  ON employee_absences FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
*/
