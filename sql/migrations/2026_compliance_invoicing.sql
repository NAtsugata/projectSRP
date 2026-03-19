-- =====================================================
-- MIGRATION 2026 - CONFORMITÉ FACTURATION ÉLECTRONIQUE
-- =====================================================
-- Date: Mars 2026
-- Auteur: Système de conformité 2026
-- Objectif: Mise en conformité avec obligations e-invoicing/e-reporting
-- =====================================================

-- =====================================================
-- 1. NOUVELLES MENTIONS OBLIGATOIRES 2026
-- =====================================================

-- Adresse de livraison (si différente de facturation)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_address JSONB DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS delivery_address JSONB DEFAULT NULL;

COMMENT ON COLUMN invoices.delivery_address IS 'Adresse de livraison si différente de l''adresse de facturation (obligation 2026)';
COMMENT ON COLUMN quotes.delivery_address IS 'Adresse de livraison si différente de l''adresse de facturation';

-- Nature de l'opération (BIEN, SERVICE, MIXTE)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS operation_nature VARCHAR(20) DEFAULT 'SERVICE'
  CHECK (operation_nature IN ('BIEN', 'SERVICE', 'MIXTE'));
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS operation_nature VARCHAR(20) DEFAULT 'SERVICE'
  CHECK (operation_nature IN ('BIEN', 'SERVICE', 'MIXTE'));

COMMENT ON COLUMN invoices.operation_nature IS 'Nature opération: BIEN (livraison), SERVICE (prestation), MIXTE (obligation 2026)';

-- Option TVA sur les débits
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_on_debit_option BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN invoices.vat_on_debit_option IS 'Option pour paiement TVA sur débits (mention obligatoire si activée - 2026)';

-- SIREN client (OBLIGATOIRE pour e-invoicing B2B)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS siren VARCHAR(9) DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_professional BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN clients.siren IS 'SIREN du client (OBLIGATOIRE pour facturation électronique B2B - 2026)';
COMMENT ON COLUMN clients.is_professional IS 'Client professionnel (true) ou particulier (false) - détermine flux e-invoicing vs e-reporting';

-- =====================================================
-- 2. MODES DE TVA & AUTOLIQUIDATION
-- =====================================================

-- Mode de TVA
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_mode VARCHAR(30) DEFAULT 'STANDARD'
  CHECK (vat_mode IN ('STANDARD', 'AUTOLIQUIDATION', 'EXEMPT', 'MARGIN', 'FRANCHISE'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS autoliquidation_reason VARCHAR(50) DEFAULT NULL
  CHECK (autoliquidation_reason IS NULL OR autoliquidation_reason IN (
    'SUBCONTRACTING_BTP',      -- Sous-traitance BTP
    'INTRA_EU_GOODS',          -- Livraison intracommunautaire biens
    'INTRA_EU_SERVICES',       -- Prestations services intra-EU
    'IMPORT',                  -- Importation
    'REVERSE_CHARGE_OTHER'     -- Autres cas autoliquidation
  ));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS autoliquidation_legal_reference TEXT DEFAULT NULL;

COMMENT ON COLUMN invoices.vat_mode IS 'Mode TVA: STANDARD (collecte normale), AUTOLIQUIDATION (client paie), EXEMPT, MARGIN (marge), FRANCHISE';
COMMENT ON COLUMN invoices.autoliquidation_reason IS 'Raison autoliquidation si vat_mode = AUTOLIQUIDATION';
COMMENT ON COLUMN invoices.autoliquidation_legal_reference IS 'Référence légale (ex: Art. 283-2 CGI, Art. 196 Directive 2006/112/CE)';

-- =====================================================
-- 3. FACTUR-X & E-INVOICING
-- =====================================================

-- Format Factur-X
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS facturx_profile VARCHAR(20) DEFAULT 'BASIC'
  CHECK (facturx_profile IN ('MINIMUM', 'BASIC_WL', 'BASIC', 'EN16931', 'EXTENDED'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS facturx_xml TEXT DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS facturx_generated_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS facturx_profile VARCHAR(20) DEFAULT 'BASIC';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS facturx_xml TEXT DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS facturx_generated_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN invoices.facturx_profile IS 'Profil Factur-X: MINIMUM, BASIC_WL, BASIC (recommandé), EN16931, EXTENDED';
COMMENT ON COLUMN invoices.facturx_xml IS 'XML EN 16931 embarqué dans le PDF/A-3 (Factur-X)';

-- Statut transmission PPF/PDP
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoicing_status VARCHAR(20) DEFAULT 'NOT_SENT'
  CHECK (einvoicing_status IN ('NOT_SENT', 'PENDING', 'DEPOSITED', 'REJECTED', 'ACCEPTED', 'PAID'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoicing_platform VARCHAR(20) DEFAULT NULL
  CHECK (einvoicing_platform IS NULL OR einvoicing_platform IN ('PPF', 'PDP_CHORUS', 'PDP_OTHER'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoicing_sent_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoicing_deposited_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS einvoicing_rejected_reason TEXT DEFAULT NULL;

COMMENT ON COLUMN invoices.einvoicing_status IS 'Statut e-invoicing: NOT_SENT, PENDING, DEPOSITED, REJECTED, ACCEPTED, PAID';
COMMENT ON COLUMN invoices.einvoicing_platform IS 'Plateforme utilisée: PPF (public), PDP_CHORUS, PDP_OTHER';

-- =====================================================
-- 4. E-REPORTING
-- =====================================================

-- Flux e-reporting (B2C, International)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ereporting_required BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ereporting_status VARCHAR(20) DEFAULT 'NOT_REQUIRED'
  CHECK (ereporting_status IN ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ereporting_type VARCHAR(30) DEFAULT NULL
  CHECK (ereporting_type IS NULL OR ereporting_type IN ('B2C', 'EXPORT', 'INTRA_EU', 'IMPORT'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ereporting_sent_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN invoices.ereporting_required IS 'E-reporting requis (B2C, international, etc.)';
COMMENT ON COLUMN invoices.ereporting_type IS 'Type e-reporting: B2C (particuliers), EXPORT, INTRA_EU, IMPORT';

-- =====================================================
-- 5. ACOMPTES (RÉFORME 2023 - TVA EXIGIBLE)
-- =====================================================

CREATE TABLE IF NOT EXISTS down_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Lien avec la facture d'acompte (elle-même une invoice)
  down_payment_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Montants
  amount_ht DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL, -- TVA EXIGIBLE sur l'acompte !
  amount_ttc DECIMAL(10,2) NOT NULL,

  -- Dates
  paid_date DATE NOT NULL,

  -- Statut
  deducted_on_final BOOLEAN DEFAULT FALSE,
  deducted_at TIMESTAMPTZ DEFAULT NULL,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_down_payments_final_invoice ON down_payments(final_invoice_id);
CREATE INDEX IF NOT EXISTS idx_down_payments_organization ON down_payments(organization_id);

COMMENT ON TABLE down_payments IS 'Acomptes facturés (réforme 2023 - TVA exigible sur acomptes pour livraisons de biens)';
COMMENT ON COLUMN down_payments.vat_amount IS 'TVA EXIGIBLE sur l''acompte (réforme 2023 Art. 269 CGI)';
COMMENT ON COLUMN down_payments.deducted_on_final IS 'Acompte déduit sur facture finale';

-- =====================================================
-- 6. CERTIFICATION ISCA (NF525/LNE)
-- =====================================================

-- Journal d'audit inaltérable
CREATE TABLE IF NOT EXISTS invoice_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Référence document
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('INVOICE', 'QUOTE', 'CREDIT_NOTE', 'DOWN_PAYMENT')),
  document_number VARCHAR(50) NOT NULL,

  -- Type d'événement
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
    'CREATE', 'UPDATE', 'DELETE', 'SEND', 'PAID', 'CANCEL', 'CONVERT'
  )),

  -- Données ISCA
  data_snapshot JSONB NOT NULL,           -- Snapshot complet des données
  hash_sha256 VARCHAR(64) NOT NULL,       -- Hash SHA-256 du snapshot
  previous_hash VARCHAR(64) DEFAULT NULL, -- Hash précédent (chaînage)

  -- Signature électronique (optionnel mais recommandé)
  digital_signature TEXT DEFAULT NULL,
  signature_timestamp TIMESTAMPTZ DEFAULT NULL,

  -- Utilisateur
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON invoice_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_invoice ON invoice_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_quote ON invoice_audit_log(quote_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON invoice_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_hash ON invoice_audit_log(hash_sha256);

COMMENT ON TABLE invoice_audit_log IS 'Journal d''audit inaltérable pour certification ISCA (NF525/LNE)';
COMMENT ON COLUMN invoice_audit_log.hash_sha256 IS 'Hash SHA-256 du snapshot (inaltérabilité)';
COMMENT ON COLUMN invoice_audit_log.previous_hash IS 'Hash de l''entrée précédente (chaînage cryptographique)';

-- =====================================================
-- 7. MENTIONS SECTORIELLES SPÉCIFIQUES
-- =====================================================

-- BTP - Assurance décennale
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS insurance_decennial JSONB DEFAULT NULL;

COMMENT ON COLUMN organizations.insurance_decennial IS 'Assurance décennale (BTP): {insurer, policyNumber, geographicZone, validUntil}';

-- Services à la Personne (SAP)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sap_agreement_number VARCHAR(50) DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sap_valid_until DATE DEFAULT NULL;

COMMENT ON COLUMN organizations.sap_agreement_number IS 'Numéro agrément Services à la Personne';

-- Santé / Appareillage
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS health_license_number VARCHAR(50) DEFAULT NULL;

-- =====================================================
-- 8. ARCHIVAGE FISCAL
-- =====================================================

CREATE TABLE IF NOT EXISTS fiscal_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,

  -- Période
  archive_year INTEGER NOT NULL,
  archive_type VARCHAR(20) NOT NULL CHECK (archive_type IN ('INVOICES', 'QUOTES', 'FULL')),

  -- Archive
  file_path TEXT NOT NULL,          -- Chemin dans Supabase Storage
  file_size_bytes BIGINT,
  file_hash_sha256 VARCHAR(64),     -- Hash de l'archive pour intégrité

  -- Scellement (ISCA)
  sealed BOOLEAN DEFAULT FALSE,
  sealed_at TIMESTAMPTZ DEFAULT NULL,
  seal_signature TEXT DEFAULT NULL,

  -- Contenu
  invoice_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Contrainte: une seule archive par année/type/organisation
  CONSTRAINT unique_archive_per_year UNIQUE (organization_id, archive_year, archive_type)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_archives_org ON fiscal_archives(organization_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_archives_year ON fiscal_archives(archive_year);

COMMENT ON TABLE fiscal_archives IS 'Archives fiscales annuelles scellées (conservation 10 ans)';
COMMENT ON COLUMN fiscal_archives.sealed IS 'Archive scellée (inaltérable après scellement)';

-- =====================================================
-- 9. PARAMÈTRES E-INVOICING ORGANISATION
-- =====================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS einvoicing_settings JSONB DEFAULT '{
  "enabled": false,
  "platform": "PPF",
  "api_endpoint": "",
  "api_key_encrypted": "",
  "auto_send": false,
  "profile_facturx": "BASIC",
  "vat_regime": "REAL_NORMAL",
  "ereporting_frequency": "MONTHLY"
}'::JSONB;

COMMENT ON COLUMN organizations.einvoicing_settings IS 'Paramètres e-invoicing: plateforme (PPF/PDP), profil Factur-X, envoi auto, fréquence e-reporting';

-- =====================================================
-- 10. TRIGGERS & FONCTIONS
-- =====================================================

-- Fonction: Créer automatiquement une entrée audit log
CREATE OR REPLACE FUNCTION create_invoice_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_snapshot JSONB;
  v_hash VARCHAR(64);
  v_previous_hash VARCHAR(64);
  v_event_type VARCHAR(30);
BEGIN
  -- Déterminer le type d'événement
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'DELETE';
  END IF;

  -- Créer snapshot des données
  v_snapshot := to_jsonb(COALESCE(NEW, OLD));

  -- Calculer hash SHA-256 (simplifié - en production utiliser pgcrypto)
  v_hash := md5(v_snapshot::text);

  -- Récupérer le hash précédent pour chaînage
  SELECT hash_sha256 INTO v_previous_hash
  FROM invoice_audit_log
  WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
  ORDER BY created_at DESC
  LIMIT 1;

  -- Insérer dans le log
  INSERT INTO invoice_audit_log (
    organization_id,
    invoice_id,
    document_type,
    document_number,
    event_type,
    data_snapshot,
    hash_sha256,
    previous_hash,
    user_id,
    created_at
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(NEW.id, OLD.id),
    'INVOICE',
    COALESCE(NEW.invoice_number, OLD.invoice_number),
    v_event_type,
    v_snapshot,
    v_hash,
    v_previous_hash,
    auth.uid(),
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur invoices (ISCA)
DROP TRIGGER IF EXISTS trigger_invoice_audit_log ON invoices;
CREATE TRIGGER trigger_invoice_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION create_invoice_audit_entry();

-- Fonction similaire pour quotes
CREATE OR REPLACE FUNCTION create_quote_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_snapshot JSONB;
  v_hash VARCHAR(64);
  v_previous_hash VARCHAR(64);
  v_event_type VARCHAR(30);
BEGIN
  IF TG_OP = 'INSERT' THEN v_event_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN v_event_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN v_event_type := 'DELETE';
  END IF;

  v_snapshot := to_jsonb(COALESCE(NEW, OLD));
  v_hash := md5(v_snapshot::text);

  SELECT hash_sha256 INTO v_previous_hash
  FROM invoice_audit_log
  WHERE organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO invoice_audit_log (
    organization_id,
    quote_id,
    document_type,
    document_number,
    event_type,
    data_snapshot,
    hash_sha256,
    previous_hash,
    user_id,
    created_at
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(NEW.id, OLD.id),
    'QUOTE',
    COALESCE(NEW.quote_number, OLD.quote_number),
    v_event_type,
    v_snapshot,
    v_hash,
    v_previous_hash,
    auth.uid(),
    NOW()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_quote_audit_log ON quotes;
CREATE TRIGGER trigger_quote_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION create_quote_audit_entry();

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE down_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_archives ENABLE ROW LEVEL SECURITY;

-- Down payments: organization isolation
DROP POLICY IF EXISTS down_payments_org_isolation ON down_payments;
CREATE POLICY down_payments_org_isolation ON down_payments
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Audit log: READ ONLY pour tous, INSERT via trigger uniquement
DROP POLICY IF EXISTS audit_log_read_only ON invoice_audit_log;
CREATE POLICY audit_log_read_only ON invoice_audit_log
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Fiscal archives: organization isolation
DROP POLICY IF EXISTS fiscal_archives_org_isolation ON fiscal_archives;
CREATE POLICY fiscal_archives_org_isolation ON fiscal_archives
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- =====================================================
-- 12. VUES UTILES
-- =====================================================

-- Vue: Factures nécessitant e-invoicing
CREATE OR REPLACE VIEW invoices_pending_einvoicing WITH (security_invoker = on) AS
SELECT
  i.*,
  c.name AS client_name,
  c.siren AS client_siren,
  c.is_professional
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status IN ('sent', 'paid')
  AND i.einvoicing_status = 'NOT_SENT'
  AND c.is_professional = true
  AND c.siren IS NOT NULL;

-- Vue: Transactions nécessitant e-reporting
CREATE OR REPLACE VIEW invoices_pending_ereporting WITH (security_invoker = on) AS
SELECT
  i.*,
  c.name AS client_name,
  c.is_professional
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
WHERE i.status IN ('sent', 'paid')
  AND i.ereporting_required = true
  AND i.ereporting_status IN ('NOT_REQUIRED', 'PENDING');

-- =====================================================
-- FIN MIGRATION 2026
-- =====================================================

-- Version
COMMENT ON SCHEMA public IS 'Schema version: 2026.1 - E-invoicing compliance';
