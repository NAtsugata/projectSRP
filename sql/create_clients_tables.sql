-- ============================================
-- Tables CRM : Gestion des clients
-- ============================================

-- Table principale des clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Informations de base
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  client_type VARCHAR(50) DEFAULT 'standard', -- standard, vip, prospect

  -- Contact principal
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),

  -- Adresse
  address TEXT,
  address_complement VARCHAR(255),
  postal_code VARCHAR(20),
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'France',

  -- Coordonnees GPS (pour optimisation trajets)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Informations commerciales
  siret VARCHAR(20),
  tva_number VARCHAR(30),
  payment_terms INTEGER DEFAULT 30, -- Delai de paiement en jours

  -- Notes et tags
  notes TEXT,
  tags TEXT[], -- Array de tags pour categorisation

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Contraintes
  CONSTRAINT clients_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Table des contacts supplementaires par client
CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Informations du contact
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(100), -- Responsable technique, Comptabilite, Direction, etc.

  -- Coordonnees
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),

  -- Preferences
  is_primary BOOLEAN DEFAULT false, -- Contact principal
  receives_invoices BOOLEAN DEFAULT false, -- Recoit les factures
  receives_reports BOOLEAN DEFAULT false, -- Recoit les rapports d'intervention

  notes TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_clients_organization ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_organization ON client_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_primary ON client_contacts(client_id) WHERE is_primary = true;

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

CREATE TRIGGER trigger_client_contacts_updated_at
  BEFORE UPDATE ON client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

-- ============================================
-- Politiques RLS (Row Level Security)
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs ne voient que les clients de leur organisation
CREATE POLICY clients_org_isolation ON clients
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY client_contacts_org_isolation ON client_contacts
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- Migration: Ajouter client_id aux interventions
-- ============================================

-- Ajouter colonne client_id si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interventions' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE interventions ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
    CREATE INDEX idx_interventions_client ON interventions(client_id);
  END IF;
END $$;

-- ============================================
-- Vue pour statistiques clients
-- ============================================

CREATE OR REPLACE VIEW client_stats AS
SELECT
  c.id,
  c.name,
  c.organization_id,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN i.status = 'completed' THEN i.id END) as completed_interventions,
  COUNT(DISTINCT CASE WHEN i.status = 'pending' THEN i.id END) as pending_interventions,
  MAX(i.created_at) as last_intervention_date,
  COUNT(DISTINCT mc.id) as active_contracts
FROM clients c
LEFT JOIN interventions i ON i.client_id = c.id
LEFT JOIN maintenance_contracts mc ON mc.client_id = c.id AND mc.status = 'active'
GROUP BY c.id, c.name, c.organization_id;

-- ============================================
-- Fonction RPC pour recherche clients
-- ============================================

CREATE OR REPLACE FUNCTION search_clients(
  p_organization_id UUID,
  p_search_term TEXT DEFAULT NULL,
  p_client_type TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  company_name VARCHAR,
  client_type VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  city VARCHAR,
  is_active BOOLEAN,
  total_interventions BIGINT,
  last_intervention_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.company_name,
    c.client_type,
    c.email,
    c.phone,
    c.city,
    c.is_active,
    COALESCE(cs.total_interventions, 0) as total_interventions,
    cs.last_intervention_date
  FROM clients c
  LEFT JOIN client_stats cs ON cs.id = c.id
  WHERE c.organization_id = p_organization_id
    AND (p_is_active IS NULL OR c.is_active = p_is_active)
    AND (p_client_type IS NULL OR c.client_type = p_client_type)
    AND (p_city IS NULL OR c.city ILIKE '%' || p_city || '%')
    AND (
      p_search_term IS NULL
      OR c.name ILIKE '%' || p_search_term || '%'
      OR c.company_name ILIKE '%' || p_search_term || '%'
      OR c.email ILIKE '%' || p_search_term || '%'
      OR c.phone ILIKE '%' || p_search_term || '%'
    )
  ORDER BY c.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
