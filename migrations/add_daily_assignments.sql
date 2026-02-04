-- Migration: Ajout de la colonne daily_assignments à la table interventions
-- Date: 2026-02-04
-- Description: Permet d'assigner des équipes différentes par jour pour les interventions multi-jours
-- Format: { "2026-02-03": ["userId1", "userId2"], "2026-02-04": ["userId3"] }

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='interventions' AND column_name='daily_assignments') THEN
        ALTER TABLE interventions ADD COLUMN daily_assignments JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Colonne daily_assignments ajoutée';
    ELSE
        RAISE NOTICE 'Colonne daily_assignments existe déjà';
    END IF;
END $$;

COMMENT ON COLUMN interventions.daily_assignments IS 'Assignations par jour: { "YYYY-MM-DD": ["user_id", ...], ... }';
