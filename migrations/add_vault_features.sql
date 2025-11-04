-- Migration: Ajout des fonctionnalités avancées au coffre-fort
-- Date: 2025-01-04
-- Description: Ajoute les colonnes file_size, description, tags et is_favorite à la table vault_documents

-- Vérifier si les colonnes existent déjà avant de les ajouter
DO $$
BEGIN
    -- Ajout de la colonne file_size (taille du fichier en octets)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='vault_documents' AND column_name='file_size') THEN
        ALTER TABLE vault_documents ADD COLUMN file_size BIGINT;
        RAISE NOTICE 'Colonne file_size ajoutée';
    ELSE
        RAISE NOTICE 'Colonne file_size existe déjà';
    END IF;

    -- Ajout de la colonne description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='vault_documents' AND column_name='description') THEN
        ALTER TABLE vault_documents ADD COLUMN description TEXT;
        RAISE NOTICE 'Colonne description ajoutée';
    ELSE
        RAISE NOTICE 'Colonne description existe déjà';
    END IF;

    -- Ajout de la colonne tags (tableau de texte)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='vault_documents' AND column_name='tags') THEN
        ALTER TABLE vault_documents ADD COLUMN tags TEXT[];
        RAISE NOTICE 'Colonne tags ajoutée';
    ELSE
        RAISE NOTICE 'Colonne tags existe déjà';
    END IF;

    -- Ajout de la colonne is_favorite (booléen avec valeur par défaut FALSE)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='vault_documents' AND column_name='is_favorite') THEN
        ALTER TABLE vault_documents ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE NOT NULL;
        RAISE NOTICE 'Colonne is_favorite ajoutée';
    ELSE
        RAISE NOTICE 'Colonne is_favorite existe déjà';
    END IF;
END $$;

-- Mise à jour des documents existants : définir is_favorite à FALSE s'il est NULL
UPDATE vault_documents SET is_favorite = FALSE WHERE is_favorite IS NULL;

-- Commentaires sur les colonnes pour documentation
COMMENT ON COLUMN vault_documents.file_size IS 'Taille du fichier en octets';
COMMENT ON COLUMN vault_documents.description IS 'Description optionnelle du document ajoutée par l''admin';
COMMENT ON COLUMN vault_documents.tags IS 'Tags/étiquettes pour faciliter la recherche et le classement';
COMMENT ON COLUMN vault_documents.is_favorite IS 'Indique si le document est marqué comme favori par l''employé';

-- Affichage de la structure finale
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'vault_documents'
ORDER BY ordinal_position;
