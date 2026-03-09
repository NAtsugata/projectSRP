-- ============================================
-- Migration: Fix RLS policies for intervention_assignments
-- Date: 2026-03-09
-- Description: Corriger les politiques RLS pour permettre l'insertion
--              d'assignations sans exiger organization_id dans la table
-- ============================================

-- Étape 1: Supprimer les anciennes politiques (si elles existent)
DROP POLICY IF EXISTS insert_own_org ON intervention_assignments;
DROP POLICY IF EXISTS select_own_org ON intervention_assignments;
DROP POLICY IF EXISTS update_own_org ON intervention_assignments;
DROP POLICY IF EXISTS delete_own_org ON intervention_assignments;

-- Étape 2: Créer une politique SELECT (lecture)
-- Autoriser la lecture des assignations pour les interventions de l'organisation
CREATE POLICY select_via_intervention ON intervention_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM interventions
      WHERE interventions.id = intervention_assignments.intervention_id
      AND interventions.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- Étape 3: Créer une politique INSERT (création)
-- Autoriser l'insertion si l'intervention appartient à l'organisation
CREATE POLICY insert_via_intervention ON intervention_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interventions
      WHERE interventions.id = intervention_assignments.intervention_id
      AND interventions.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- Étape 4: Créer une politique UPDATE (modification)
CREATE POLICY update_via_intervention ON intervention_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM interventions
      WHERE interventions.id = intervention_assignments.intervention_id
      AND interventions.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM interventions
      WHERE interventions.id = intervention_assignments.intervention_id
      AND interventions.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- Étape 5: Créer une politique DELETE (suppression)
CREATE POLICY delete_via_intervention ON intervention_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM interventions
      WHERE interventions.id = intervention_assignments.intervention_id
      AND interventions.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

-- Étape 6: Vérifier que RLS est activé
ALTER TABLE intervention_assignments ENABLE ROW LEVEL SECURITY;

-- Étape 7: Index pour performance (optionnel mais recommandé)
CREATE INDEX IF NOT EXISTS idx_intervention_assignments_intervention_id
ON intervention_assignments(intervention_id);

-- ============================================
-- Notes:
--
-- Ces politiques vérifient l'organization_id via la table 'interventions'
-- au lieu d'exiger la colonne 'organization_id' dans 'intervention_assignments'.
--
-- Avantage: Pas besoin d'ajouter organization_id dans la table de liaison
-- Performance: L'index sur intervention_id rend le JOIN rapide
--
-- Test après migration:
-- 1. Créer une intervention
-- 2. Assigner des techniciens via EditTeamModal
-- 3. Vérifier qu'il n'y a pas d'erreur RLS
-- ============================================
