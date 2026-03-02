-- Migration: Fix RLS policies for employee_absences table
-- Run this in Supabase SQL Editor to fix the "impossible to add absences" issue
-- Date: 2026-03-02

-- ============================================
-- PROBLÈME: Les anciennes politiques RLS ne permettaient
-- qu'aux admins de créer/modifier/supprimer des absences.
-- SOLUTION: Permettre à tous les utilisateurs authentifiés.
-- ============================================

-- Supprimer les anciennes politiques restrictives (admin-only)
DROP POLICY IF EXISTS "Admins can create absences" ON employee_absences;
DROP POLICY IF EXISTS "Admins can update absences" ON employee_absences;
DROP POLICY IF EXISTS "Admins can delete absences" ON employee_absences;

-- Supprimer les nouvelles politiques si elles existent déjà (pour éviter les doublons)
DROP POLICY IF EXISTS "Authenticated users can create absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can update absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can delete absences" ON employee_absences;

-- Créer les nouvelles politiques pour tous les utilisateurs authentifiés
CREATE POLICY "Authenticated users can create absences"
  ON employee_absences FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update absences"
  ON employee_absences FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete absences"
  ON employee_absences FOR DELETE
  USING (auth.role() = 'authenticated');

-- Vérification: Afficher les politiques actives
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'employee_absences';
