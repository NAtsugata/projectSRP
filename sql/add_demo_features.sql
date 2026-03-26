-- ============================================================
-- AJOUT DES FONCTIONNALITÉS DE DÉMONSTRATION
-- ============================================================
-- Ajoute les colonnes nécessaires pour identifier et gérer
-- les organisations de démonstration
-- ============================================================

-- Ajouter les colonnes de démonstration à la table organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_reset_frequency text DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS demo_last_reset timestamp with time zone;

-- Ajouter un index pour optimiser les requêtes sur les orgs de démo
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo
  ON public.organizations(is_demo)
  WHERE is_demo = true;

-- Commentaires pour documentation
COMMENT ON COLUMN public.organizations.is_demo IS 'Indique si cette organisation est utilisée pour des démonstrations';
COMMENT ON COLUMN public.organizations.demo_reset_frequency IS 'Fréquence de réinitialisation automatique (never, daily, weekly)';
COMMENT ON COLUMN public.organizations.demo_last_reset IS 'Date et heure de la dernière réinitialisation des données';
