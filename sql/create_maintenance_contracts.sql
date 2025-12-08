-- ========================================
-- MIGRATION: Contrats de Maintenance
-- ========================================
-- À exécuter dans Supabase SQL Editor
-- 
-- Tables créées:
-- 1. maintenance_contracts - Contrats d'abonnement clients
-- 2. contract_visits - Visites périodiques planifiées
-- ========================================

-- ========================================
-- 1. TABLE: maintenance_contracts
-- ========================================
-- Gestion des contrats d'entretien et abonnements

CREATE TABLE IF NOT EXISTS maintenance_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Informations client
  client_name TEXT NOT NULL,
  client_address TEXT,
  client_phone VARCHAR(20),
  client_email VARCHAR(255),
  
  -- Détails du contrat
  contract_type TEXT NOT NULL DEFAULT 'entretien_general',
  -- Types: 'entretien_chaudiere', 'climatisation', 'plomberie_generale', 'pompe_chaleur', 'autre'
  
  contract_number VARCHAR(50), -- Numéro de contrat optionnel
  
  -- Période du contrat
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Fréquence des visites
  frequency TEXT NOT NULL DEFAULT 'annual',
  -- Options: 'monthly', 'quarterly', 'biannual', 'annual'
  
  -- Tarification
  price DECIMAL(10, 2),
  price_per_visit DECIMAL(10, 2),
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'active',
  -- Options: 'active', 'expired', 'cancelled', 'pending_renewal'
  
  -- Alertes
  renewal_reminder_days INTEGER DEFAULT 30, -- Jours avant expiration pour alerter
  
  -- Notes additionnelles
  notes TEXT,
  equipment_details TEXT, -- Détails équipement (marque, modèle, n° série)
  
  -- Métadonnées
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT valid_contract_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_frequency CHECK (frequency IN ('monthly', 'quarterly', 'biannual', 'annual')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'cancelled', 'pending_renewal'))
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_contracts_client_name ON maintenance_contracts(client_name);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON maintenance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON maintenance_contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON maintenance_contracts(contract_type);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contracts_updated_at ON maintenance_contracts;
CREATE TRIGGER trigger_contracts_updated_at
  BEFORE UPDATE ON maintenance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_updated_at();

-- ========================================
-- 2. TABLE: contract_visits
-- ========================================
-- Visites périodiques planifiées pour chaque contrat

CREATE TABLE IF NOT EXISTS contract_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Lien vers le contrat
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  
  -- Planification
  scheduled_date DATE NOT NULL,
  scheduled_time TIME, -- Heure optionnelle
  
  -- Statut de la visite
  status TEXT NOT NULL DEFAULT 'pending',
  -- Options: 'pending', 'scheduled', 'completed', 'missed', 'rescheduled', 'cancelled'
  
  -- Lien vers intervention (si créée)
  intervention_id UUID REFERENCES interventions(id) ON DELETE SET NULL,
  
  -- Exécution
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES profiles(id),
  
  -- Notes
  notes TEXT,
  technician_notes TEXT, -- Notes du technicien après visite
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT valid_visit_status CHECK (status IN ('pending', 'scheduled', 'completed', 'missed', 'rescheduled', 'cancelled'))
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_visits_contract ON contract_visits(contract_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON contract_visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON contract_visits(status);

-- ========================================
-- 3. RLS (Row Level Security)
-- ========================================

-- Activer RLS
ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_visits ENABLE ROW LEVEL SECURITY;

-- Policies pour maintenance_contracts
CREATE POLICY "Authenticated users can view contracts"
  ON maintenance_contracts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can create contracts"
  ON maintenance_contracts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update contracts"
  ON maintenance_contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete contracts"
  ON maintenance_contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Policies pour contract_visits
CREATE POLICY "Authenticated users can view visits"
  ON contract_visits FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage visits"
  ON contract_visits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ========================================
-- 4. FONCTION: Générer les visites automatiquement
-- ========================================

CREATE OR REPLACE FUNCTION generate_contract_visits(p_contract_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_contract RECORD;
  v_visit_date DATE;
  v_interval INTERVAL;
  v_count INTEGER := 0;
BEGIN
  -- Récupérer le contrat
  SELECT * INTO v_contract FROM maintenance_contracts WHERE id = p_contract_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat non trouvé: %', p_contract_id;
  END IF;
  
  -- Définir l'intervalle selon la fréquence
  CASE v_contract.frequency
    WHEN 'monthly' THEN v_interval := INTERVAL '1 month';
    WHEN 'quarterly' THEN v_interval := INTERVAL '3 months';
    WHEN 'biannual' THEN v_interval := INTERVAL '6 months';
    WHEN 'annual' THEN v_interval := INTERVAL '1 year';
    ELSE v_interval := INTERVAL '1 year';
  END CASE;
  
  -- Supprimer les visites futures non complétées
  DELETE FROM contract_visits 
  WHERE contract_id = p_contract_id 
    AND status IN ('pending', 'scheduled')
    AND scheduled_date > CURRENT_DATE;
  
  -- Générer les visites
  v_visit_date := v_contract.start_date;
  
  WHILE v_visit_date <= v_contract.end_date LOOP
    -- Ne pas créer de visites dans le passé
    IF v_visit_date >= CURRENT_DATE THEN
      INSERT INTO contract_visits (contract_id, scheduled_date, status)
      VALUES (p_contract_id, v_visit_date, 'pending')
      ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;
    
    v_visit_date := v_visit_date + v_interval;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. FONCTION: Mettre à jour les statuts expirés
-- ========================================

CREATE OR REPLACE FUNCTION update_expired_contracts()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE maintenance_contracts
  SET status = 'expired'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Marquer pour renouvellement ceux qui expirent bientôt
  UPDATE maintenance_contracts
  SET status = 'pending_renewal'
  WHERE status = 'active' 
    AND end_date <= CURRENT_DATE + (renewal_reminder_days || ' days')::INTERVAL;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- VÉRIFICATION
-- ========================================
-- Pour vérifier que tout fonctionne:
--
-- SELECT * FROM maintenance_contracts;
-- SELECT * FROM contract_visits;
-- SELECT generate_contract_visits('uuid-du-contrat');
--
-- ========================================
