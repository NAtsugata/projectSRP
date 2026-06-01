-- Phase 1 — Métiers du bâtiment par utilisateur (multi-métiers)
--
-- Stocke des codes métier stables (ex: 'electricien', 'plombier') correspondant
-- à la liste canonique src/constants/buildingTrades.js. Ces codes seront
-- réutilisés par les phases suivantes : lots de chantier par métier et
-- tableau de bord d'avancement du maître d'œuvre.
--
-- Un utilisateur peut avoir plusieurs métiers (tableau). N'affecte aucun accès.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trades text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.trades IS
  'Métiers du bâtiment de l''utilisateur (codes stables). Un utilisateur peut avoir plusieurs métiers.';
