-- =====================================================
-- INVOICES & QUOTES TABLES
-- Phase A2: Facturation et devis
-- =====================================================

-- =====================================================
-- TABLE: invoices (Factures)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  intervention_id BIGINT REFERENCES interventions(id) ON DELETE SET NULL,

  -- Status workflow: draft → sent → paid / overdue / cancelled
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),

  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  sent_date DATE,

  -- Montants
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,

  -- Paiement
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),

  -- Texte
  notes TEXT,
  terms TEXT,
  footer TEXT,

  -- PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABLE: invoice_items (Lignes de facture)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'unite',
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE: quotes (Devis)
-- =====================================================
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  intervention_id BIGINT REFERENCES interventions(id) ON DELETE SET NULL,

  -- Status workflow: draft → sent → accepted → converted / rejected / expired
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),

  -- Si converti en facture
  converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- Dates
  issue_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  accepted_date DATE,
  sent_date DATE,

  -- Montants
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,

  -- Texte
  notes TEXT,
  terms TEXT,

  -- PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- TABLE: quote_items (Lignes de devis)
-- =====================================================
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'unite',
  unit_price DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS: Auto-numbering
-- =====================================================

-- Function to generate invoice number (FAC-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(invoice_number FROM 'FAC-' || v_year || '-(\d+)')
        AS INTEGER
      )
    ),
    0
  ) + 1
  INTO v_seq
  FROM invoices
  WHERE invoice_number LIKE 'FAC-' || v_year || '-%';

  RETURN 'FAC-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Function to generate quote number (DEV-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(quote_number FROM 'DEV-' || v_year || '-(\d+)')
        AS INTEGER
      )
    ),
    0
  ) + 1
  INTO v_seq
  FROM quotes
  WHERE quote_number LIKE 'DEV-' || v_year || '-%';

  RETURN 'DEV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Trigger function for invoice auto-numbering
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Trigger function for quote auto-numbering
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := public.generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Invoice auto-numbering trigger
DROP TRIGGER IF EXISTS trigger_auto_invoice_number ON invoices;
CREATE TRIGGER trigger_auto_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Quote auto-numbering trigger
DROP TRIGGER IF EXISTS trigger_auto_quote_number ON quotes;
CREATE TRIGGER trigger_auto_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_number();

-- Updated_at triggers
DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

DROP TRIGGER IF EXISTS trigger_quotes_updated_at ON quotes;
CREATE TRIGGER trigger_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Invoices: Organization isolation
DROP POLICY IF EXISTS invoices_org_isolation ON invoices;
CREATE POLICY invoices_org_isolation ON invoices
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Invoice items: Through invoice organization
DROP POLICY IF EXISTS invoice_items_org_isolation ON invoice_items;
CREATE POLICY invoice_items_org_isolation ON invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Quotes: Organization isolation
DROP POLICY IF EXISTS quotes_org_isolation ON quotes;
CREATE POLICY quotes_org_isolation ON quotes
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Quote items: Through quote organization
DROP POLICY IF EXISTS quote_items_org_isolation ON quote_items;
CREATE POLICY quote_items_org_isolation ON quote_items
  FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- INDEXES
-- =====================================================

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_intervention ON invoices(intervention_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Invoice items indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_position ON invoice_items(invoice_id, position);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_intervention ON quotes(intervention_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);
CREATE INDEX IF NOT EXISTS idx_quotes_issue_date ON quotes(issue_date);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);

-- Quote items indexes
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_position ON quote_items(quote_id, position);

-- =====================================================
-- VIEWS
-- =====================================================

-- Invoice statistics view
CREATE OR REPLACE VIEW invoice_stats WITH (security_invoker = on) AS
SELECT
  organization_id,
  COUNT(*) AS total_invoices,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
  COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
  COALESCE(SUM(total), 0) AS total_amount,
  COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) AS paid_amount,
  COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0) AS pending_amount,
  COALESCE(SUM(total) FILTER (WHERE status = 'overdue'), 0) AS overdue_amount
FROM invoices
GROUP BY organization_id;

-- Quote statistics view
CREATE OR REPLACE VIEW quote_stats WITH (security_invoker = on) AS
SELECT
  organization_id,
  COUNT(*) AS total_quotes,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_count,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
  COUNT(*) FILTER (WHERE status = 'converted') AS converted_count,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  COALESCE(SUM(total), 0) AS total_amount,
  COALESCE(SUM(total) FILTER (WHERE status = 'accepted'), 0) AS accepted_amount,
  COALESCE(SUM(total) FILTER (WHERE status = 'converted'), 0) AS converted_amount
FROM quotes
GROUP BY organization_id;

-- Overdue invoices view
CREATE OR REPLACE VIEW overdue_invoices WITH (security_invoker = on) AS
SELECT
  i.*,
  c.name AS client_name,
  c.email AS client_email,
  c.phone AS client_phone,
  CURRENT_DATE - i.due_date AS days_overdue
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status = 'sent'
  AND i.due_date < CURRENT_DATE;

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Get invoice statistics for current organization
CREATE OR REPLACE FUNCTION get_invoice_stats()
RETURNS TABLE (
  total_invoices BIGINT,
  draft_count BIGINT,
  sent_count BIGINT,
  paid_count BIGINT,
  overdue_count BIGINT,
  cancelled_count BIGINT,
  total_amount NUMERIC,
  paid_amount NUMERIC,
  pending_amount NUMERIC,
  overdue_amount NUMERIC
) AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM profiles WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_invoices,
    COUNT(*) FILTER (WHERE status = 'draft')::BIGINT AS draft_count,
    COUNT(*) FILTER (WHERE status = 'sent')::BIGINT AS sent_count,
    COUNT(*) FILTER (WHERE status = 'paid')::BIGINT AS paid_count,
    COUNT(*) FILTER (WHERE status = 'overdue')::BIGINT AS overdue_count,
    COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT AS cancelled_count,
    COALESCE(SUM(total), 0)::NUMERIC AS total_amount,
    COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0)::NUMERIC AS paid_amount,
    COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0)::NUMERIC AS pending_amount,
    COALESCE(SUM(total) FILTER (WHERE status = 'overdue'), 0)::NUMERIC AS overdue_amount
  FROM invoices
  WHERE organization_id = v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Get revenue by month for a specific year
CREATE OR REPLACE FUNCTION get_revenue_by_month(p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS TABLE (
  month INTEGER,
  month_name TEXT,
  invoiced_amount NUMERIC,
  paid_amount NUMERIC,
  invoice_count BIGINT
) AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM profiles WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    EXTRACT(MONTH FROM i.issue_date)::INTEGER AS month,
    TO_CHAR(i.issue_date, 'Month') AS month_name,
    COALESCE(SUM(i.total), 0)::NUMERIC AS invoiced_amount,
    COALESCE(SUM(i.total) FILTER (WHERE i.status = 'paid'), 0)::NUMERIC AS paid_amount,
    COUNT(*)::BIGINT AS invoice_count
  FROM invoices i
  WHERE i.organization_id = v_org_id
    AND EXTRACT(YEAR FROM i.issue_date) = p_year
  GROUP BY EXTRACT(MONTH FROM i.issue_date), TO_CHAR(i.issue_date, 'Month')
  ORDER BY month;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Mark overdue invoices (to be called by a scheduled job)
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices
  SET status = 'overdue', updated_at = NOW()
  WHERE status = 'sent'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE invoices IS 'Factures clients';
COMMENT ON TABLE invoice_items IS 'Lignes de facture';
COMMENT ON TABLE quotes IS 'Devis clients';
COMMENT ON TABLE quote_items IS 'Lignes de devis';

COMMENT ON COLUMN invoices.status IS 'Statut: draft (brouillon), sent (envoyee), paid (payee), overdue (en retard), cancelled (annulee)';
COMMENT ON COLUMN invoices.tax_rate IS 'Taux de TVA par defaut (20%)';
COMMENT ON COLUMN invoices.payment_method IS 'Mode de paiement: virement, cheque, cb, especes';

COMMENT ON COLUMN quotes.status IS 'Statut: draft, sent, accepted, rejected, expired, converted';
COMMENT ON COLUMN quotes.converted_invoice_id IS 'Reference a la facture creee si le devis a ete converti';
