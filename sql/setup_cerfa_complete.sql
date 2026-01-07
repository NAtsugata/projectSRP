-- =============================
-- SETUP COMPLET CERFA - Exécuter dans Supabase SQL Editor
-- =============================

-- 1. Créer la table cerfa_documents
CREATE TABLE IF NOT EXISTS cerfa_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(50) NOT NULL,
    template_name VARCHAR(100),
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    client_name VARCHAR(255),
    intervention_date DATE
);

-- 2. Index pour la recherche
CREATE INDEX IF NOT EXISTS idx_cerfa_numero ON cerfa_documents(numero);
CREATE INDEX IF NOT EXISTS idx_cerfa_client ON cerfa_documents(client_name);
CREATE INDEX IF NOT EXISTS idx_cerfa_created_at ON cerfa_documents(created_at DESC);

-- 3. RLS Policies pour la table
ALTER TABLE cerfa_documents ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can view cerfa documents" ON cerfa_documents;
DROP POLICY IF EXISTS "Users can insert cerfa documents" ON cerfa_documents;
DROP POLICY IF EXISTS "Users can update cerfa documents" ON cerfa_documents;
DROP POLICY IF EXISTS "Users can delete cerfa documents" ON cerfa_documents;

-- Lecture: tous les utilisateurs authentifiés
CREATE POLICY "Users can view cerfa documents" ON cerfa_documents
    FOR SELECT USING (auth.role() = 'authenticated');

-- Insertion: tous les utilisateurs authentifiés
CREATE POLICY "Users can insert cerfa documents" ON cerfa_documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Mise à jour: tous les utilisateurs authentifiés
CREATE POLICY "Users can update cerfa documents" ON cerfa_documents
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Suppression: tous les utilisateurs authentifiés (ou admin seulement si tu veux)
CREATE POLICY "Users can delete cerfa documents" ON cerfa_documents
    FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Créer le bucket storage (si pas déjà fait manuellement)
-- Note: Cette commande peut échouer si le bucket existe déjà, c'est normal
INSERT INTO storage.buckets (id, name, public)
VALUES ('cerfa-documents', 'cerfa-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Policies pour le storage
-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can read cerfa files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload cerfa files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete cerfa files" ON storage.objects;

-- Lecture des fichiers
CREATE POLICY "Users can read cerfa files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'cerfa-documents'
        AND auth.role() = 'authenticated'
    );

-- Upload des fichiers
CREATE POLICY "Users can upload cerfa files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'cerfa-documents'
        AND auth.role() = 'authenticated'
    );

-- Suppression des fichiers
CREATE POLICY "Users can delete cerfa files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'cerfa-documents'
        AND auth.role() = 'authenticated'
    );

-- =============================
-- FIN DU SETUP
-- =============================
