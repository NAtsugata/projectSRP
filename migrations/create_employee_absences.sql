-- Migration: Create employee_absences table
-- Run this in Supabase SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS employee_absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT 'Congés',
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
DROP POLICY IF EXISTS "Users can view all absences" ON employee_absences;
CREATE POLICY "Users can view all absences"
  ON employee_absences FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Les utilisateurs authentifiés peuvent créer des absences
DROP POLICY IF EXISTS "Admins can create absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can create absences" ON employee_absences;
CREATE POLICY "Authenticated users can create absences"
  ON employee_absences FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Les utilisateurs authentifiés peuvent modifier des absences
DROP POLICY IF EXISTS "Admins can update absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can update absences" ON employee_absences;
CREATE POLICY "Authenticated users can update absences"
  ON employee_absences FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy: Les utilisateurs authentifiés peuvent supprimer des absences
DROP POLICY IF EXISTS "Admins can delete absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can delete absences" ON employee_absences;
CREATE POLICY "Authenticated users can delete absences"
  ON employee_absences FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_employee_absences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employee_absences_updated_at ON employee_absences;
CREATE TRIGGER employee_absences_updated_at
  BEFORE UPDATE ON employee_absences
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_absences_updated_at();
