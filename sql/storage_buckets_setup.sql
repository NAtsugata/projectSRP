-- ============================================================
-- CONFIGURATION DES BUCKETS STORAGE POUR SUPABASE
-- ============================================================
-- Ce fichier crée les buckets et configure les permissions RLS
-- pour permettre l'upload/download des fichiers

-- ============================================================
-- 1. CRÉATION DES BUCKETS (si non existants)
-- ============================================================

-- Bucket pour les fichiers d'intervention (photos, documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intervention-files',
  'intervention-files',
  true,  -- Fichiers publiquement accessibles
  10485760,  -- 10 MB max par fichier
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- Bucket pour le coffre-fort
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-files',
  'vault-files',
  true,  -- Fichiers publiquement accessibles
  10485760,  -- 10 MB max par fichier
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760;

-- ============================================================
-- 2. POLITIQUES RLS POUR INTERVENTION-FILES
-- ============================================================

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can upload intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view intervention files" ON storage.objects;

-- Politique: UPLOAD - Tous les utilisateurs authentifiés peuvent uploader
CREATE POLICY "Users can upload intervention files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'intervention-files'
);

-- Politique: SELECT - Tous peuvent voir les fichiers (bucket public)
CREATE POLICY "Public can view intervention files"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'intervention-files'
);

-- Politique: DELETE - Seuls les admins peuvent supprimer
CREATE POLICY "Admins can delete intervention files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'intervention-files'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- ============================================================
-- 3. POLITIQUES RLS POUR VAULT-FILES
-- ============================================================

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can upload vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete vault files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vault files" ON storage.objects;

-- Politique: UPLOAD - Tous les utilisateurs authentifiés peuvent uploader
CREATE POLICY "Users can upload vault files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vault-files'
);

-- Politique: SELECT - Tous peuvent voir les fichiers (bucket public)
CREATE POLICY "Public can view vault files"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'vault-files'
);

-- Politique: DELETE - Admins ou propriétaire peuvent supprimer
CREATE POLICY "Users can delete own vault files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vault-files'
  AND (
    -- Admin peut tout supprimer
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
    -- Utilisateur peut supprimer ses propres fichiers
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- ============================================================
-- 4. VÉRIFICATION
-- ============================================================

-- Vérifier que les buckets sont bien créés
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id IN ('intervention-files', 'vault-files');

-- Vérifier les politiques
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%intervention%' OR policyname LIKE '%vault%'
ORDER BY policyname;
