-- ========================================
-- MIGRATIONS SQL POUR SUPABASE
-- ========================================
-- À exécuter dans Supabase SQL Editor
--
-- Tables créées:
-- 1. employee_absences - Gestion des absences employés
-- 2. intervention_templates - Modèles d'interventions
--
-- ========================================

-- ========================================
-- 1. TABLE: employee_absences
-- ========================================
-- Gestion des absences et congés des employés

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

-- ========================================
-- 2. TABLE: intervention_templates
-- ========================================
-- Modèles d'interventions réutilisables
-- Peut être personnel (user_id) ou public (user_id = NULL pour admins)

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

-- ========================================
-- 3. MIGRATION: Système de paiement notes de frais
-- ========================================
-- Ajoute le tracking des paiements pour les notes de frais

-- Ajouter les colonnes de paiement à la table expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id);

-- Créer un index sur is_paid pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_expenses_is_paid ON expenses(is_paid);

-- Créer un index composite pour filtrer les notes approuvées non payées
CREATE INDEX IF NOT EXISTS idx_expenses_status_paid ON expenses(status, is_paid);

-- Ajouter un commentaire sur les colonnes pour documentation
COMMENT ON COLUMN expenses.is_paid IS 'Indique si la note de frais a été payée/remboursée';
COMMENT ON COLUMN expenses.paid_date IS 'Date à laquelle la note de frais a été marquée comme payée';
COMMENT ON COLUMN expenses.paid_by IS 'ID de l''admin qui a marqué la note comme payée';

-- ========================================
-- MIGRATION DES DONNÉES (OPTIONNEL)
-- ========================================
-- Une fois les tables créées, vous pouvez migrer les données
-- depuis localStorage en appelant ces fonctions depuis la console:
--
-- import { migrateAbsencesToSupabase } from './lib/absenceService';
-- import { migrateTemplatesToSupabase } from './lib/templateService';
--
-- await migrateAbsencesToSupabase();
-- await migrateTemplatesToSupabase();
--
-- ========================================

-- ========================================
-- VÉRIFICATION
-- ========================================
-- Pour vérifier que tout fonctionne:
--
-- SELECT * FROM employee_absences;
-- SELECT * FROM intervention_templates;
-- SELECT * FROM expenses WHERE is_paid = true;
--
-- ========================================
