-- Gestion des sous-traitants (entreprises externes intervenant sur les chantiers)
--
-- 100% additif : table org-scoped + colonne subcontractor_id sur intervention_lots.
-- Un lot peut être réalisé par un employé interne (assigned_user_id) OU par un
-- sous-traitant (subcontractor_id). N'altère aucun flux existant.

CREATE TABLE IF NOT EXISTS public.subcontractors (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL,
  company_name    text NOT NULL,
  contact_name    text,
  email           text,
  phone           text,
  siret           text,
  trades          text[] NOT NULL DEFAULT '{}'::text[],
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subcontractors IS
  'Sous-traitants (entreprises externes) intervenant sur les chantiers.';

CREATE INDEX IF NOT EXISTS idx_subcontractors_org ON public.subcontractors (organization_id);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- Helper : admin OU permission manage_chantiers active.
CREATE OR REPLACE FUNCTION public.can_manage_chantiers()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.employee_permissions ep
    WHERE ep.user_id = (SELECT auth.uid())
      AND ep.permission_code = 'manage_chantiers'
      AND (ep.expires_at IS NULL OR ep.expires_at > now())
  );
$$;

CREATE POLICY subcontractors_select ON public.subcontractors
  FOR SELECT USING (organization_id = public.current_user_org_id());

CREATE POLICY subcontractors_insert ON public.subcontractors
  FOR INSERT WITH CHECK (organization_id = public.current_user_org_id() AND public.can_manage_chantiers());

CREATE POLICY subcontractors_update ON public.subcontractors
  FOR UPDATE
  USING (organization_id = public.current_user_org_id() AND public.can_manage_chantiers())
  WITH CHECK (organization_id = public.current_user_org_id() AND public.can_manage_chantiers());

CREATE POLICY subcontractors_delete ON public.subcontractors
  FOR DELETE USING (organization_id = public.current_user_org_id() AND public.can_manage_chantiers());

-- Lien lot -> sous-traitant.
ALTER TABLE public.intervention_lots
  ADD COLUMN IF NOT EXISTS subcontractor_id bigint
  REFERENCES public.subcontractors(id) ON DELETE SET NULL;
