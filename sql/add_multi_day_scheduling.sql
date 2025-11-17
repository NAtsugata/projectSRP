-- Script SQL pour ajouter la fonctionnalité de planification multi-jours
-- À exécuter dans Supabase SQL Editor

-- Ajouter le champ scheduled_dates pour stocker plusieurs dates de planification
ALTER TABLE interventions
ADD COLUMN IF NOT EXISTS scheduled_dates JSONB;

-- Commentaire pour documentation
COMMENT ON COLUMN interventions.scheduled_dates IS 'Tableau des dates planifiées pour cette intervention (format: ["2025-01-01", "2025-01-06", "2025-01-12"])';

-- Index pour améliorer les performances de recherche sur les dates planifiées
CREATE INDEX IF NOT EXISTS idx_interventions_scheduled_dates
ON interventions USING GIN (scheduled_dates);

-- Vérifier les colonnes existantes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'interventions'
ORDER BY ordinal_position;
