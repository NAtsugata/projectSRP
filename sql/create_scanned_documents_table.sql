-- ============================================================
-- TABLE: scanned_documents
-- ============================================================
-- Documents scannés avec séparation par utilisateur
-- Seul l'admin peut voir tous les documents

CREATE TABLE IF NOT EXISTS public.scanned_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(100),
  thumbnail_url TEXT,
  tags TEXT[], -- Tags pour organiser les documents
  category VARCHAR(100), -- Catégorie du document (facture, contrat, rapport, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb -- Métadonnées supplémentaires
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_scanned_documents_user_id ON public.scanned_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_scanned_documents_created_at ON public.scanned_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanned_documents_category ON public.scanned_documents(category);

-- RLS (Row Level Security)
ALTER TABLE public.scanned_documents ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs voient uniquement leurs propres documents
CREATE POLICY "Users can view their own scanned documents"
  ON public.scanned_documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique: Les admins voient tous les documents
CREATE POLICY "Admins can view all scanned documents"
  ON public.scanned_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique: Les utilisateurs peuvent insérer leurs propres documents
CREATE POLICY "Users can insert their own scanned documents"
  ON public.scanned_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent mettre à jour leurs propres documents
CREATE POLICY "Users can update their own scanned documents"
  ON public.scanned_documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les admins peuvent mettre à jour tous les documents
CREATE POLICY "Admins can update all scanned documents"
  ON public.scanned_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique: Les utilisateurs peuvent supprimer leurs propres documents
CREATE POLICY "Users can delete their own scanned documents"
  ON public.scanned_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Politique: Les admins peuvent supprimer tous les documents
CREATE POLICY "Admins can delete all scanned documents"
  ON public.scanned_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_scanned_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scanned_documents_updated_at
  BEFORE UPDATE ON public.scanned_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_scanned_documents_updated_at();

-- Commentaires
COMMENT ON TABLE public.scanned_documents IS 'Documents scannés par les utilisateurs avec séparation et RLS';
COMMENT ON COLUMN public.scanned_documents.user_id IS 'Propriétaire du document';
COMMENT ON COLUMN public.scanned_documents.title IS 'Titre du document';
COMMENT ON COLUMN public.scanned_documents.file_url IS 'URL du fichier dans Supabase Storage';
COMMENT ON COLUMN public.scanned_documents.tags IS 'Tags pour organiser/rechercher';
COMMENT ON COLUMN public.scanned_documents.category IS 'Catégorie (facture, contrat, rapport, personnel, etc.)';
