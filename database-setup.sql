-- ========================================
-- SCRIPT DE CRÉATION DE LA TABLE COFFRE-FORT
-- ========================================
-- Ce script doit être exécuté dans l'éditeur SQL de Supabase
-- (depuis le dashboard Supabase > SQL Editor)

-- 1. Créer la table vault_documents
CREATE TABLE IF NOT EXISTS vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_vault_documents_user_id ON vault_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_documents_created_at ON vault_documents(created_at DESC);

-- 3. Activer Row Level Security (RLS)
ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;

-- 4. Politique RLS: Les employés peuvent LIRE leurs propres documents
CREATE POLICY "Users can view their own vault documents"
  ON vault_documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Politique RLS: Les admins peuvent LIRE tous les documents
CREATE POLICY "Admins can view all vault documents"
  ON vault_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- 6. Politique RLS: Les admins peuvent CRÉER des documents pour n'importe quel utilisateur
CREATE POLICY "Admins can create vault documents"
  ON vault_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- 7. Politique RLS: Les admins peuvent SUPPRIMER n'importe quel document
CREATE POLICY "Admins can delete vault documents"
  ON vault_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- 8. Créer un trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vault_documents_updated_at
  BEFORE UPDATE ON vault_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Vérifier que le bucket 'vault' existe dans Supabase Storage
-- IMPORTANT: Vous devez créer manuellement le bucket 'vault' dans Supabase Storage
-- depuis le dashboard Supabase > Storage > Create bucket
-- Nom du bucket: vault
-- Public: NON (privé)
-- Ensuite, configurez les politiques de storage (voir ci-dessous)

-- ========================================
-- POLITIQUES DE STORAGE POUR LE BUCKET 'vault'
-- ========================================
-- Ces commandes doivent être exécutées APRÈS avoir créé le bucket 'vault'

-- Politique: Les admins peuvent UPLOADER des fichiers
CREATE POLICY "Admins can upload vault files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vault' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Politique: Les admins peuvent VOIR tous les fichiers du coffre
CREATE POLICY "Admins can view all vault files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'vault' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Politique: Les employés peuvent VOIR leurs propres fichiers
CREATE POLICY "Users can view their own vault files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'vault' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Politique: Les admins peuvent SUPPRIMER des fichiers
CREATE POLICY "Admins can delete vault files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'vault' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ========================================
-- FIN DU SCRIPT
-- ========================================

-- INSTRUCTIONS:
-- 1. Connectez-vous à votre dashboard Supabase
-- 2. Allez dans "SQL Editor"
-- 3. Créez une nouvelle requête et collez ce script
-- 4. Exécutez le script (bouton Run)
-- 5. Allez dans "Storage" et créez un bucket nommé "vault" (privé)
-- 6. Exécutez les politiques de storage ci-dessus
-- 7. Testez votre application - le coffre-fort devrait maintenant fonctionner !
