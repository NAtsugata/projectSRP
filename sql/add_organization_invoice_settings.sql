-- =====================================================
-- ORGANIZATION INVOICE SETTINGS
-- Ajoute les champs pour personnaliser les devis/factures
-- =====================================================

-- Ajouter les colonnes pour les paramètres de facturation
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invoice_settings JSONB DEFAULT '{
  "default_terms": "Conditions de règlement : 30 jours fin de mois.\nTout retard de paiement entraînera des pénalités de retard.",
  "default_footer": "",
  "default_payment_terms": 30,
  "default_tax_rate": 20,
  "quote_validity_days": 30,
  "show_logo_on_documents": true,
  "show_siret": true,
  "bank_details": {
    "iban": "",
    "bic": "",
    "bank_name": ""
  },
  "legal_mentions": ""
}'::JSONB;

-- Colonne pour le numéro de TVA intracommunautaire
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vat_number TEXT;

-- Colonne pour l'APE/NAF
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ape_code TEXT;

-- Colonne pour le capital social
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS share_capital TEXT;

-- Colonne pour la forme juridique
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS legal_form TEXT;

-- Colonne pour le RCS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS rcs TEXT;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN organizations.invoice_settings IS 'Paramètres de facturation: termes par défaut, mentions légales, coordonnées bancaires';
COMMENT ON COLUMN organizations.vat_number IS 'Numéro de TVA intracommunautaire';
COMMENT ON COLUMN organizations.ape_code IS 'Code APE/NAF';
COMMENT ON COLUMN organizations.share_capital IS 'Capital social';
COMMENT ON COLUMN organizations.legal_form IS 'Forme juridique (SARL, SAS, etc.)';
COMMENT ON COLUMN organizations.rcs IS 'Numéro RCS';
