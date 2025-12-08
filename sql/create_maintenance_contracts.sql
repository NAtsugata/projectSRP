-- ========================================
-- MIGRATION: Contrats de Maintenance
-- Version: 2.0
-- ========================================
-- À exécuter dans Supabase SQL Editor
-- 
-- Tables créées:
-- 1. maintenance_contracts - Contrats d'abonnement clients
-- 2. contract_visits - Visites périodiques planifiées
-- 3. contract_equipment - Équipements associés aux contrats
-- 4. contract_history - Historique des modifications
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
  client_secondary_phone VARCHAR(20), -- Téléphone secondaire
  client_notes TEXT, -- Notes spécifiques au client
  
  -- Localisation pour planification
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  access_instructions TEXT, -- Instructions d'accès (code porte, étage, etc.)
  
  -- Détails du contrat
  contract_type TEXT NOT NULL DEFAULT 'entretien_general',
  -- Types: 'entretien_chaudiere', 'climatisation', 'plomberie_generale', 'pompe_chaleur', 
  --        'chauffe_eau', 'adoucisseur', 'vmc', 'multi_equipements', 'autre'
  
  contract_number VARCHAR(50) UNIQUE, -- Numéro de contrat unique
  
  -- Période du contrat
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN DEFAULT false, -- Renouvellement automatique
  
  -- Fréquence des visites
  frequency TEXT NOT NULL DEFAULT 'annual',
  -- Options: 'monthly', 'bimonthly', 'quarterly', 'biannual', 'annual'
  visits_per_year INTEGER GENERATED ALWAYS AS (
    CASE frequency
      WHEN 'monthly' THEN 12
      WHEN 'bimonthly' THEN 6
      WHEN 'quarterly' THEN 4
      WHEN 'biannual' THEN 2
      WHEN 'annual' THEN 1
      ELSE 1
    END
  ) STORED,
  
  -- Tarification
  price DECIMAL(10, 2), -- Prix total annuel
  price_per_visit DECIMAL(10, 2), -- Prix par visite
  payment_method TEXT DEFAULT 'invoice', -- 'invoice', 'direct_debit', 'check', 'cash'
  billing_period TEXT DEFAULT 'annual', -- 'monthly', 'quarterly', 'annual', 'upfront'
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'active',
  -- Options: 'draft', 'active', 'on_hold', 'expired', 'cancelled', 'pending_renewal'
  
  -- Alertes et rappels
  renewal_reminder_days INTEGER DEFAULT 30, -- Jours avant expiration pour alerter
  visit_reminder_days INTEGER DEFAULT 7, -- Jours avant visite pour rappel
  send_email_reminders BOOLEAN DEFAULT true,
  send_sms_reminders BOOLEAN DEFAULT false,
  
  -- Priorité et SLA
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  response_time_hours INTEGER DEFAULT 48, -- Délai de réponse garanti
  
  -- Notes additionnelles
  notes TEXT,
  internal_notes TEXT, -- Notes internes (non visibles client)
  equipment_details TEXT, -- Détails équipement (marque, modèle, n° série) - DEPRECATED: utiliser contract_equipment
  
  -- Documents attachés
  contract_document_url TEXT, -- URL du PDF du contrat signé
  
  -- Technicien préféré
  preferred_technician_id UUID REFERENCES profiles(id),
  
  -- Métadonnées
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT valid_contract_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_frequency CHECK (frequency IN ('monthly', 'bimonthly', 'quarterly', 'biannual', 'annual')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'on_hold', 'expired', 'cancelled', 'pending_renewal')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('invoice', 'direct_debit', 'check', 'cash')),
  CONSTRAINT valid_billing_period CHECK (billing_period IN ('monthly', 'quarterly', 'annual', 'upfront'))
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_contracts_client_name ON maintenance_contracts(client_name);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON maintenance_contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON maintenance_contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON maintenance_contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_number ON maintenance_contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_priority ON maintenance_contracts(priority);
CREATE INDEX IF NOT EXISTS idx_contracts_preferred_tech ON maintenance_contracts(preferred_technician_id);
CREATE INDEX IF NOT EXISTS idx_contracts_renewal_alert ON maintenance_contracts(end_date, renewal_reminder_days) 
  WHERE status = 'active';

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
-- 2. TABLE: contract_equipment
-- ========================================
-- Équipements couverts par chaque contrat

CREATE TABLE IF NOT EXISTS contract_equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Lien vers le contrat
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  
  -- Informations équipement
  equipment_type TEXT NOT NULL, -- 'chaudiere', 'climatisation', 'cumulus', etc.
  brand VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  installation_date DATE,
  warranty_end_date DATE,
  
  -- Localisation dans le bâtiment
  location TEXT, -- 'Sous-sol', 'Cuisine', 'Salle de bain', etc.
  
  -- État et notes
  condition TEXT DEFAULT 'good', -- 'excellent', 'good', 'fair', 'poor', 'needs_replacement'
  notes TEXT,
  last_inspection_date DATE,
  next_inspection_date DATE,
  
  -- Photos
  photo_urls TEXT[], -- URLs des photos de l'équipement
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT valid_condition CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'needs_replacement'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_contract ON contract_equipment(contract_id);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON contract_equipment(equipment_type);
CREATE INDEX IF NOT EXISTS idx_equipment_warranty ON contract_equipment(warranty_end_date);

-- ========================================
-- 3. TABLE: contract_visits
-- ========================================
-- Visites périodiques planifiées pour chaque contrat

CREATE TABLE IF NOT EXISTS contract_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Lien vers le contrat
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  
  -- Planification
  scheduled_date DATE NOT NULL,
  scheduled_time TIME, -- Heure optionnelle
  scheduled_end_time TIME, -- Heure de fin estimée
  
  -- Fenêtre de temps pour le client
  time_slot TEXT, -- 'morning', 'afternoon', 'full_day', 'specific'
  
  -- Statut de la visite
  status TEXT NOT NULL DEFAULT 'pending',
  -- Options: 'pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled'
  
  -- Technicien assigné
  assigned_technician_id UUID REFERENCES profiles(id),
  
  -- Lien vers intervention (si créée)
  intervention_id BIGINT REFERENCES interventions(id) ON DELETE SET NULL,
  
  -- Confirmation client
  client_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmation_method TEXT, -- 'email', 'sms', 'phone', 'app'
  
  -- Rappels envoyés
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  -- Exécution
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES profiles(id),
  duration_minutes INTEGER, -- Durée réelle de la visite
  
  -- Notes
  notes TEXT, -- Notes de planification
  technician_notes TEXT, -- Notes du technicien après visite
  work_performed TEXT, -- Description des travaux effectués
  
  -- Pièces utilisées
  parts_used JSONB, -- [{"name": "filtre", "quantity": 1, "cost": 15.00}]
  
  -- Problèmes détectés
  issues_found TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  
  -- Signature client
  client_signature_url TEXT,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Contraintes
  CONSTRAINT valid_visit_status CHECK (status IN ('pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled')),
  CONSTRAINT valid_time_slot CHECK (time_slot IS NULL OR time_slot IN ('morning', 'afternoon', 'full_day', 'specific'))
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_visits_contract ON contract_visits(contract_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON contract_visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON contract_visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_technician ON contract_visits(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_visits_pending ON contract_visits(scheduled_date) 
  WHERE status IN ('pending', 'scheduled', 'confirmed');

-- Trigger pour mise à jour de updated_at
CREATE OR REPLACE FUNCTION update_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_visits_updated_at ON contract_visits;
CREATE TRIGGER trigger_visits_updated_at
  BEFORE UPDATE ON contract_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_visits_updated_at();

-- ========================================
-- 4. TABLE: contract_history
-- ========================================
-- Historique des modifications des contrats

CREATE TABLE IF NOT EXISTS contract_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  contract_id UUID NOT NULL REFERENCES maintenance_contracts(id) ON DELETE CASCADE,
  
  -- Type d'action
  action TEXT NOT NULL, -- 'created', 'updated', 'renewed', 'cancelled', 'suspended', 'reactivated'
  
  -- Changements
  changes JSONB, -- {"field": "status", "old_value": "active", "new_value": "suspended"}
  
  -- Auteur
  performed_by UUID REFERENCES profiles(id),
  
  -- Notes
  notes TEXT,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_contract ON contract_history(contract_id);
CREATE INDEX IF NOT EXISTS idx_history_action ON contract_history(action);
CREATE INDEX IF NOT EXISTS idx_history_date ON contract_history(created_at);

-- ========================================
-- 5. RLS (Row Level Security)
-- ========================================

-- Activer RLS
ALTER TABLE maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_history ENABLE ROW LEVEL SECURITY;

-- === Policies pour maintenance_contracts ===
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON maintenance_contracts;
CREATE POLICY "Authenticated users can view contracts"
  ON maintenance_contracts FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can create contracts" ON maintenance_contracts;
CREATE POLICY "Admins can create contracts"
  ON maintenance_contracts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update contracts" ON maintenance_contracts;
CREATE POLICY "Admins can update contracts"
  ON maintenance_contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete contracts" ON maintenance_contracts;
CREATE POLICY "Admins can delete contracts"
  ON maintenance_contracts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- === Policies pour contract_equipment ===
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON contract_equipment;
CREATE POLICY "Authenticated users can view equipment"
  ON contract_equipment FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage equipment" ON contract_equipment;
CREATE POLICY "Admins can manage equipment"
  ON contract_equipment FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- === Policies pour contract_visits ===
DROP POLICY IF EXISTS "Authenticated users can view visits" ON contract_visits;
CREATE POLICY "Authenticated users can view visits"
  ON contract_visits FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage visits" ON contract_visits;
CREATE POLICY "Admins can manage visits"
  ON contract_visits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Technicians can update assigned visits" ON contract_visits;
CREATE POLICY "Technicians can update assigned visits"
  ON contract_visits FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    assigned_technician_id = auth.uid()
  );

-- === Policies pour contract_history ===
DROP POLICY IF EXISTS "Authenticated users can view history" ON contract_history;
CREATE POLICY "Authenticated users can view history"
  ON contract_history FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "System can insert history" ON contract_history;
CREATE POLICY "System can insert history"
  ON contract_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ========================================
-- 6. FONCTIONS UTILITAIRES
-- ========================================

-- Générer un numéro de contrat unique
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(contract_number FROM 'CT-' || v_year || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM maintenance_contracts
  WHERE contract_number LIKE 'CT-' || v_year || '-%';
  
  v_number := 'CT-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Générer les visites automatiquement
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
    WHEN 'bimonthly' THEN v_interval := INTERVAL '2 months';
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
  v_visit_date := GREATEST(v_contract.start_date, CURRENT_DATE);
  
  WHILE v_visit_date <= v_contract.end_date LOOP
    INSERT INTO contract_visits (
      contract_id, 
      scheduled_date, 
      status,
      assigned_technician_id
    )
    VALUES (
      p_contract_id, 
      v_visit_date, 
      'pending',
      v_contract.preferred_technician_id
    )
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
    
    v_visit_date := v_visit_date + v_interval;
  END LOOP;
  
  -- Enregistrer dans l'historique
  INSERT INTO contract_history (contract_id, action, notes, performed_by)
  VALUES (p_contract_id, 'updated', v_count || ' visites générées', v_contract.created_by);
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour les statuts expirés
CREATE OR REPLACE FUNCTION update_expired_contracts()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_contract RECORD;
BEGIN
  -- Marquer les contrats expirés
  FOR v_contract IN 
    SELECT id, status FROM maintenance_contracts
    WHERE status = 'active' AND end_date < CURRENT_DATE
  LOOP
    UPDATE maintenance_contracts
    SET status = 'expired'
    WHERE id = v_contract.id;
    
    INSERT INTO contract_history (contract_id, action, changes)
    VALUES (v_contract.id, 'updated', '{"field": "status", "old_value": "active", "new_value": "expired"}'::jsonb);
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Marquer pour renouvellement ceux qui expirent bientôt
  UPDATE maintenance_contracts
  SET status = 'pending_renewal'
  WHERE status = 'active' 
    AND end_date <= CURRENT_DATE + (renewal_reminder_days || ' days')::INTERVAL
    AND end_date >= CURRENT_DATE;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Obtenir les contrats à renouveler
CREATE OR REPLACE FUNCTION get_contracts_pending_renewal()
RETURNS TABLE (
  id UUID,
  client_name TEXT,
  contract_number VARCHAR(50),
  end_date DATE,
  days_until_expiry INTEGER,
  auto_renew BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.id,
    mc.client_name,
    mc.contract_number,
    mc.end_date,
    (mc.end_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    mc.auto_renew
  FROM maintenance_contracts mc
  WHERE mc.status IN ('active', 'pending_renewal')
    AND mc.end_date <= CURRENT_DATE + INTERVAL '60 days'
  ORDER BY mc.end_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Obtenir les prochaines visites
CREATE OR REPLACE FUNCTION get_upcoming_visits(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  visit_id UUID,
  contract_id UUID,
  client_name TEXT,
  client_phone VARCHAR(20),
  client_address TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  time_slot TEXT,
  status TEXT,
  technician_id UUID,
  technician_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cv.id as visit_id,
    cv.contract_id,
    mc.client_name,
    mc.client_phone,
    mc.client_address,
    cv.scheduled_date,
    cv.scheduled_time,
    cv.time_slot,
    cv.status,
    cv.assigned_technician_id as technician_id,
    p.display_name as technician_name
  FROM contract_visits cv
  JOIN maintenance_contracts mc ON mc.id = cv.contract_id
  LEFT JOIN profiles p ON p.id = cv.assigned_technician_id
  WHERE cv.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days || ' days')::INTERVAL
    AND cv.status IN ('pending', 'scheduled', 'confirmed')
  ORDER BY cv.scheduled_date ASC, cv.scheduled_time ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Statistiques des contrats
CREATE OR REPLACE FUNCTION get_contract_statistics()
RETURNS TABLE (
  total_contracts BIGINT,
  active_contracts BIGINT,
  expired_contracts BIGINT,
  pending_renewal BIGINT,
  total_revenue DECIMAL(12,2),
  visits_this_month BIGINT,
  visits_completed_this_month BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_contracts,
    COUNT(*) FILTER (WHERE mc.status = 'active')::BIGINT as active_contracts,
    COUNT(*) FILTER (WHERE mc.status = 'expired')::BIGINT as expired_contracts,
    COUNT(*) FILTER (WHERE mc.status = 'pending_renewal')::BIGINT as pending_renewal,
    COALESCE(SUM(mc.price) FILTER (WHERE mc.status = 'active'), 0) as total_revenue,
    (SELECT COUNT(*) FROM contract_visits cv 
     WHERE DATE_TRUNC('month', cv.scheduled_date) = DATE_TRUNC('month', CURRENT_DATE))::BIGINT as visits_this_month,
    (SELECT COUNT(*) FROM contract_visits cv 
     WHERE DATE_TRUNC('month', cv.completed_at) = DATE_TRUNC('month', CURRENT_DATE)
     AND cv.status = 'completed')::BIGINT as visits_completed_this_month
  FROM maintenance_contracts mc;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. TRIGGERS AUTOMATIQUES
-- ========================================

-- Trigger pour générer le numéro de contrat si non fourni
CREATE OR REPLACE FUNCTION auto_generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_number IS NULL THEN
    NEW.contract_number := generate_contract_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_contract_number ON maintenance_contracts;
CREATE TRIGGER trigger_auto_contract_number
  BEFORE INSERT ON maintenance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_contract_number();

-- Trigger pour enregistrer l'historique des modifications
CREATE OR REPLACE FUNCTION log_contract_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_changes JSONB := '[]'::JSONB;
BEGIN
  -- Détecter les changements importants
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'status',
      'old_value', OLD.status,
      'new_value', NEW.status
    );
  END IF;
  
  IF OLD.end_date IS DISTINCT FROM NEW.end_date THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'end_date',
      'old_value', OLD.end_date::TEXT,
      'new_value', NEW.end_date::TEXT
    );
  END IF;
  
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'price',
      'old_value', OLD.price::TEXT,
      'new_value', NEW.price::TEXT
    );
  END IF;
  
  -- Enregistrer si des changements ont été détectés
  IF jsonb_array_length(v_changes) > 0 THEN
    INSERT INTO contract_history (contract_id, action, changes)
    VALUES (NEW.id, 'updated', v_changes);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_contract_changes ON maintenance_contracts;
CREATE TRIGGER trigger_log_contract_changes
  AFTER UPDATE ON maintenance_contracts
  FOR EACH ROW
  EXECUTE FUNCTION log_contract_changes();

-- ========================================
-- 8. VUES UTILES
-- ========================================

-- Vue des contrats avec informations complètes
CREATE OR REPLACE VIEW v_contracts_summary AS
SELECT 
  mc.*,
  p.display_name as created_by_name,
  pt.display_name as preferred_technician_name,
  (mc.end_date - CURRENT_DATE) as days_until_expiry,
  (SELECT COUNT(*) FROM contract_visits cv WHERE cv.contract_id = mc.id) as total_visits,
  (SELECT COUNT(*) FROM contract_visits cv WHERE cv.contract_id = mc.id AND cv.status = 'completed') as completed_visits,
  (SELECT COUNT(*) FROM contract_equipment ce WHERE ce.contract_id = mc.id) as equipment_count
FROM maintenance_contracts mc
LEFT JOIN profiles p ON p.id = mc.created_by
LEFT JOIN profiles pt ON pt.id = mc.preferred_technician_id;

-- Vue des visites du jour
CREATE OR REPLACE VIEW v_today_visits AS
SELECT 
  cv.*,
  mc.client_name,
  mc.client_phone,
  mc.client_address,
  mc.client_email,
  mc.access_instructions,
  p.display_name as technician_name
FROM contract_visits cv
JOIN maintenance_contracts mc ON mc.id = cv.contract_id
LEFT JOIN profiles p ON p.id = cv.assigned_technician_id
WHERE cv.scheduled_date = CURRENT_DATE
ORDER BY cv.scheduled_time ASC NULLS LAST;

-- ========================================
-- VÉRIFICATION
-- ========================================
-- Pour vérifier que tout fonctionne:
--
-- SELECT * FROM maintenance_contracts;
-- SELECT * FROM contract_visits;
-- SELECT * FROM contract_equipment;
-- SELECT * FROM contract_history;
-- SELECT * FROM v_contracts_summary;
-- SELECT * FROM v_today_visits;
-- SELECT generate_contract_visits('uuid-du-contrat');
-- SELECT * FROM get_contracts_pending_renewal();
-- SELECT * FROM get_upcoming_visits(30);
-- SELECT * FROM get_contract_statistics();
--
-- ========================================
