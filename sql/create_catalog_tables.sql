-- =====================================================
-- CATALOGUE PRODUITS/SERVICES & TEMPLATES DEVIS
-- Phase A2-BIS: Amelioration systeme devis
-- =====================================================

-- =====================================================
-- TABLE: catalog_items (Fournitures et Main d'oeuvre)
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

  -- Type : 'product' (fourniture) ou 'service' (main d'oeuvre)
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('product', 'service')),

  -- Categorie (ex: "Plomberie", "Electricite", "Main d'oeuvre")
  category VARCHAR(100),

  -- Reference interne (code article)
  reference VARCHAR(50),

  -- Description
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Tarification
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'unite', -- unite, heure, jour, m2, ml, forfait

  -- TVA
  tax_rate DECIMAL(5,2) DEFAULT 20.00, -- 20%, 10%, 5.5%, 0%

  -- Stock (optionnel, pour fournitures)
  track_stock BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 0,

  -- Metadonnees
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false, -- Apparait en premier dans les listes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABLE: catalog_categories (Categories personnalisees)
-- =====================================================
CREATE TABLE IF NOT EXISTS catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('product', 'service', 'both')),
  color VARCHAR(7), -- Hex color pour UI
  icon VARCHAR(50), -- Nom icone (optionnel)
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: tax_rates (Taux TVA personnalises)
-- =====================================================
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(50) NOT NULL, -- "TVA 20%", "TVA reduite 10%", etc.
  rate DECIMAL(5,2) NOT NULL,
  description TEXT, -- "Taux normal", "Travaux renovation", etc.
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: quote_templates (Modeles de devis)
-- =====================================================
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,

  -- Contenu du template
  header_text TEXT, -- Texte d'introduction
  footer_text TEXT, -- Mentions legales
  terms_text TEXT, -- Conditions generales
  validity_days INTEGER DEFAULT 30, -- Validite par defaut

  -- Style PDF
  show_logo BOOLEAN DEFAULT true,
  show_reference BOOLEAN DEFAULT true,
  show_item_description BOOLEAN DEFAULT true,
  show_discount_column BOOLEAN DEFAULT false,
  primary_color VARCHAR(7) DEFAULT '#3B82F6', -- Couleur principale

  -- Metadonnees
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Catalog items indexes
CREATE INDEX IF NOT EXISTS idx_catalog_items_org ON catalog_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_type ON catalog_items(item_type);
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_catalog_items_reference ON catalog_items(reference);
CREATE INDEX IF NOT EXISTS idx_catalog_items_name ON catalog_items(name);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON catalog_items(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_catalog_items_favorite ON catalog_items(organization_id, is_favorite) WHERE is_favorite = true;

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_catalog_categories_org ON catalog_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_catalog_categories_type ON catalog_categories(item_type);
CREATE INDEX IF NOT EXISTS idx_catalog_categories_position ON catalog_categories(organization_id, position);

-- Tax rates indexes
CREATE INDEX IF NOT EXISTS idx_tax_rates_org ON tax_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_default ON tax_rates(organization_id, is_default) WHERE is_default = true;

-- Quote templates indexes
CREATE INDEX IF NOT EXISTS idx_quote_templates_org ON quote_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_templates_default ON quote_templates(organization_id, is_default) WHERE is_default = true;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

-- Catalog items: Organization isolation
DROP POLICY IF EXISTS catalog_items_org_isolation ON catalog_items;
CREATE POLICY catalog_items_org_isolation ON catalog_items
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Categories: Organization isolation
DROP POLICY IF EXISTS catalog_categories_org_isolation ON catalog_categories;
CREATE POLICY catalog_categories_org_isolation ON catalog_categories
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Tax rates: Organization isolation
DROP POLICY IF EXISTS tax_rates_org_isolation ON tax_rates;
CREATE POLICY tax_rates_org_isolation ON tax_rates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Quote templates: Organization isolation
DROP POLICY IF EXISTS quote_templates_org_isolation ON quote_templates;
CREATE POLICY quote_templates_org_isolation ON quote_templates
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Catalog items updated_at trigger
DROP TRIGGER IF EXISTS trigger_catalog_items_updated_at ON catalog_items;
CREATE TRIGGER trigger_catalog_items_updated_at
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION update_catalog_updated_at();

-- Quote templates updated_at trigger
DROP TRIGGER IF EXISTS trigger_quote_templates_updated_at ON quote_templates;
CREATE TRIGGER trigger_quote_templates_updated_at
  BEFORE UPDATE ON quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_catalog_updated_at();

-- =====================================================
-- FUNCTION: Initialize default tax rates for organization
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_tax_rates(p_organization_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if organization already has tax rates
  IF NOT EXISTS (SELECT 1 FROM tax_rates WHERE organization_id = p_organization_id) THEN
    INSERT INTO tax_rates (organization_id, name, rate, description, is_default, position) VALUES
      (p_organization_id, 'TVA 20%', 20.00, 'Taux normal', true, 1),
      (p_organization_id, 'TVA 10%', 10.00, 'Travaux renovation (plus de 2 ans)', false, 2),
      (p_organization_id, 'TVA 5.5%', 5.50, 'Travaux amelioration energetique', false, 3),
      (p_organization_id, 'Exonere (0%)', 0.00, 'Sans TVA', false, 4);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- =====================================================
-- FUNCTION: Search catalog items
-- =====================================================
CREATE OR REPLACE FUNCTION search_catalog_items(
  p_organization_id UUID,
  p_search_term TEXT DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_active_only BOOLEAN DEFAULT true,
  p_favorites_first BOOLEAN DEFAULT true,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  item_type VARCHAR,
  category VARCHAR,
  reference VARCHAR,
  name VARCHAR,
  description TEXT,
  unit_price DECIMAL,
  unit VARCHAR,
  tax_rate DECIMAL,
  is_favorite BOOLEAN,
  stock_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.item_type,
    ci.category,
    ci.reference,
    ci.name,
    ci.description,
    ci.unit_price,
    ci.unit,
    ci.tax_rate,
    ci.is_favorite,
    ci.stock_quantity
  FROM public.catalog_items ci
  WHERE ci.organization_id = p_organization_id
    AND (NOT p_active_only OR ci.is_active = true)
    AND (p_item_type IS NULL OR ci.item_type = p_item_type)
    AND (p_category IS NULL OR ci.category = p_category)
    AND (
      p_search_term IS NULL
      OR ci.name ILIKE '%' || p_search_term || '%'
      OR ci.reference ILIKE '%' || p_search_term || '%'
      OR ci.description ILIKE '%' || p_search_term || '%'
    )
  ORDER BY
    CASE WHEN p_favorites_first THEN ci.is_favorite END DESC NULLS LAST,
    ci.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- VIEWS
-- =====================================================

-- Catalog statistics view
CREATE OR REPLACE VIEW catalog_stats WITH (security_invoker = on) AS
SELECT
  organization_id,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE item_type = 'product') AS product_count,
  COUNT(*) FILTER (WHERE item_type = 'service') AS service_count,
  COUNT(*) FILTER (WHERE is_favorite = true) AS favorite_count,
  COUNT(*) FILTER (WHERE track_stock = true AND stock_quantity <= min_stock_alert) AS low_stock_count
FROM catalog_items
WHERE is_active = true
GROUP BY organization_id;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE catalog_items IS 'Catalogue des produits (fournitures) et services (main d oeuvre)';
COMMENT ON TABLE catalog_categories IS 'Categories personnalisees pour le catalogue';
COMMENT ON TABLE tax_rates IS 'Taux de TVA configures par organisation';
COMMENT ON TABLE quote_templates IS 'Modeles de devis personnalisables';

COMMENT ON COLUMN catalog_items.item_type IS 'Type: product (fourniture) ou service (main d oeuvre)';
COMMENT ON COLUMN catalog_items.unit IS 'Unite: unite, heure, jour, m2, ml, forfait';
COMMENT ON COLUMN catalog_items.tax_rate IS 'Taux TVA par defaut pour cet article';
COMMENT ON COLUMN catalog_items.is_favorite IS 'Affiche en priorite dans les selections';

COMMENT ON COLUMN tax_rates.is_default IS 'Taux utilise par defaut pour les nouveaux devis';
COMMENT ON COLUMN quote_templates.validity_days IS 'Nombre de jours de validite du devis';
