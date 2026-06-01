-- Phase 2 — Lots de chantier par métier
--
-- Table 100% ADDITIVE : une intervention sans lot fonctionne exactement comme
-- avant. Chaque lot est rattaché à un corps de métier (trade_code, cf.
-- src/constants/buildingTrades.js). ON DELETE CASCADE : supprimer une
-- intervention supprime ses lots.
--
-- RLS calquée sur le modèle existant (intervention_photos) :
--   - lecture : tout membre de l'organisation (filtrage par métier côté UI) ;
--   - création / suppression : administrateurs uniquement ;
--   - mise à jour : admin, OU utilisateur assigné, OU ouvrier du même métier.

CREATE TABLE IF NOT EXISTS public.intervention_lots (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intervention_id  bigint NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  organization_id  uuid   NOT NULL,
  trade_code       text   NOT NULL,
  title            text   NOT NULL,
  description      text,
  status           text   NOT NULL DEFAULT 'a_venir'
                     CHECK (status IN ('a_venir', 'en_cours', 'termine', 'bloque')),
  progress         integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  photos           jsonb  NOT NULL DEFAULT '[]'::jsonb,
  notes            text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intervention_lots IS
  'Lots de chantier par corps de métier. Chaque lot est rattaché à un trade_code (cf. buildingTrades.js).';

CREATE INDEX IF NOT EXISTS idx_intervention_lots_intervention
  ON public.intervention_lots (intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_lots_trade
  ON public.intervention_lots (trade_code);

ALTER TABLE public.intervention_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY lots_select ON public.intervention_lots
  FOR SELECT
  USING (organization_id = public.current_user_org_id());

CREATE POLICY lots_insert ON public.intervention_lots
  FOR INSERT
  WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());

CREATE POLICY lots_update ON public.intervention_lots
  FOR UPDATE
  USING (
    organization_id = public.current_user_org_id()
    AND (
      public.is_admin()
      OR assigned_user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND intervention_lots.trade_code = ANY (p.trades)
      )
    )
  )
  WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY lots_delete ON public.intervention_lots
  FOR DELETE
  USING (organization_id = public.current_user_org_id() AND public.is_admin());
