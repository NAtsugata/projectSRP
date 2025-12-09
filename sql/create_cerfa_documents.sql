-- =============================
-- Table: cerfa_documents
-- Stockage des PDF CERFA remplis
-- =============================

CREATE TABLE IF NOT EXISTS cerfa_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(50) NOT NULL UNIQUE,
    template_name VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    client_name VARCHAR(255),
    intervention_date DATE
);

-- Index pour la recherche
CREATE INDEX IF NOT EXISTS idx_cerfa_numero ON cerfa_documents(numero);
CREATE INDEX IF NOT EXISTS idx_cerfa_created_at ON cerfa_documents(created_at DESC);

-- Séquence pour la numérotation auto-incrémentée
CREATE SEQUENCE IF NOT EXISTS cerfa_numero_seq START 1;

-- Fonction pour générer le prochain numéro
CREATE OR REPLACE FUNCTION get_next_cerfa_numero()
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
BEGIN
    next_num := nextval('cerfa_numero_seq');
    RETURN 'CERFA-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE cerfa_documents ENABLE ROW LEVEL SECURITY;

-- Politique de lecture: tous les utilisateurs authentifiés peuvent voir
CREATE POLICY "Users can view cerfa documents" ON cerfa_documents
    FOR SELECT USING (auth.role() = 'authenticated');

-- Politique d'insertion: tous les utilisateurs authentifiés peuvent créer
CREATE POLICY "Users can insert cerfa documents" ON cerfa_documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Politique de mise à jour: seulement le créateur ou admin
CREATE POLICY "Users can update own cerfa documents" ON cerfa_documents
    FOR UPDATE USING (
        auth.uid() = created_by OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Politique de suppression: seulement admin
CREATE POLICY "Only admin can delete cerfa documents" ON cerfa_documents
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Créer le bucket storage pour les CERFA
-- (à exécuter dans Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('cerfa-documents', 'cerfa-documents', false);
