-- Script SQL pour ajouter les nouveaux champs aux interventions
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter les champs de contact
ALTER TABLE interventions
ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS client_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(100);

-- 2. Ajouter les champs de kilométrage
ALTER TABLE interventions
ADD COLUMN IF NOT EXISTS km_start INTEGER,
ADD COLUMN IF NOT EXISTS km_end INTEGER;

-- 3. Commentaires pour documentation
COMMENT ON COLUMN interventions.client_phone IS 'Téléphone principal du client';
COMMENT ON COLUMN interventions.secondary_phone IS 'Téléphone secondaire (fournisseur, autre contact)';
COMMENT ON COLUMN interventions.client_email IS 'Email du client (optionnel)';
COMMENT ON COLUMN interventions.ticket_number IS 'Numéro de ticket/référence de l''appel';
COMMENT ON COLUMN interventions.km_start IS 'Kilométrage de départ (pour remboursement)';
COMMENT ON COLUMN interventions.km_end IS 'Kilométrage de fin (pour remboursement)';

-- Vérifier les colonnes existantes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'interventions'
ORDER BY ordinal_position;
