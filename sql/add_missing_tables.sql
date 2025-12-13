-- =====================================================
-- TABLES MANQUANTES - VERSION SIMPLIFIÉE
-- Copiez et exécutez dans Supabase SQL Editor
-- =====================================================

-- 1. TABLE: contract_equipment
CREATE TABLE IF NOT EXISTS contract_equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  equipment_type TEXT NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  installation_date DATE,
  warranty_end_date DATE,
  location TEXT,
  condition TEXT DEFAULT 'good',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLE: contract_history
CREATE TABLE IF NOT EXISTS contract_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changes JSONB,
  performed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Activer RLS
ALTER TABLE contract_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies - Lecture pour tous les utilisateurs authentifiés
CREATE POLICY "View equipment" ON contract_equipment FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "View history" ON contract_history FOR SELECT USING (auth.role() = 'authenticated');

-- 5. Policies - Gestion pour admins
CREATE POLICY "Manage equipment" ON contract_equipment FOR ALL USING (true);
CREATE POLICY "Manage history" ON contract_history FOR ALL USING (true);
