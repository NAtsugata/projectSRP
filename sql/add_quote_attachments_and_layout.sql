-- =====================================================
-- QUOTE ATTACHMENTS & LAYOUT CUSTOMIZATION
-- Permet d'ajouter des images/PDF aux devis et de personnaliser la mise en page
-- =====================================================

-- =====================================================
-- TABLE: quote_attachments (Pi??ces jointes des devis)
-- =====================================================
CREATE TABLE IF NOT EXISTS quote_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,

  -- File info
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL, -- 'image/jpeg', 'image/png', 'application/pdf'
  file_size INTEGER, -- taille en octets
  storage_path TEXT NOT NULL, -- chemin dans Supabase Storage

  -- Display options
  position INTEGER DEFAULT 0, -- ordre d'affichage
  display_mode VARCHAR(20) DEFAULT 'thumbnail', -- 'thumbnail', 'full', 'hidden'
  caption TEXT, -- l??gende optionnelle

  -- PDF options
  include_in_pdf BOOLEAN DEFAULT true, -- inclure dans le PDF g??n??r??
  pdf_page VARCHAR(20) DEFAULT 'end', -- 'inline', 'end', 'separate'

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- ADD LAYOUT COLUMN TO QUOTES
-- =====================================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS layout JSONB DEFAULT '{
  "sections": [
    {"id": "header", "visible": true, "order": 0},
    {"id": "client", "visible": true, "order": 1},
    {"id": "dates", "visible": true, "order": 2},
    {"id": "items", "visible": true, "order": 3},
    {"id": "totals", "visible": true, "order": 4},
    {"id": "attachments", "visible": true, "order": 5},
    {"id": "notes", "visible": true, "order": 6},
    {"id": "terms", "visible": true, "order": 7},
    {"id": "signature", "visible": false, "order": 8}
  ],
  "theme": "default",
  "showLogo": true,
  "showSignatureZone": false,
  "attachmentDisplay": "end"
}'::JSONB;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE quote_attachments ENABLE ROW LEVEL SECURITY;

-- Attachments: Through quote organization
DROP POLICY IF EXISTS quote_attachments_org_isolation ON quote_attachments;
CREATE POLICY quote_attachments_org_isolation ON quote_attachments
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
CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote ON quote_attachments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_attachments_position ON quote_attachments(quote_id, position);

-- =====================================================
-- STORAGE BUCKET (Supabase)
-- =====================================================
-- Note: Ex??cuter dans Supabase Dashboard ou via l'API

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'quote-attachments',
--   'quote-attachments',
--   false,
--   10485760, -- 10MB max
--   ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE quote_attachments IS 'Pi??ces jointes des devis (images, PDF)';
COMMENT ON COLUMN quote_attachments.display_mode IS 'Mode d''affichage: thumbnail (miniature), full (taille r??elle), hidden (cach??)';
COMMENT ON COLUMN quote_attachments.pdf_page IS 'Position dans le PDF: inline (dans le corps), end (?? la fin), separate (page s??par??e)';
COMMENT ON COLUMN quotes.layout IS 'Configuration JSON de la mise en page du devis';
