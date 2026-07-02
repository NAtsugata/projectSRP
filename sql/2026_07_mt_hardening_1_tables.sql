-- ============================================================
-- MULTI-TENANT HARDENING (1/3) - Politiques RLS des tables
-- ============================================================
-- Corrige les fuites inter-organisations détectées lors de
-- l'audit de commercialisation :
--   - politiques héritées "tout utilisateur authentifié"
--   - politiques admin globales (non limitées à l'organisation)
--   - bug de tautologie sur intervention_briefing_documents
-- À exécuter dans le SQL Editor Supabase (déjà appliqué via MCP).
-- ============================================================

-- ============================================================
-- 0. HELPERS
-- ============================================================

-- Cast uuid sans erreur (les chemins storage peuvent contenir du texte libre)
CREATE OR REPLACE FUNCTION public.uuid_or_null(t text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    RETURN t::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

-- Organisation d'un profil donné (SECURITY DEFINER pour éviter la récursion RLS)
CREATE OR REPLACE FUNCTION public.profile_org(p_user uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT organization_id FROM public.profiles WHERE id = p_user;
$$;

-- Re-création des helpers existants avec search_path fixé (hygiène advisors)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND is_admin = true
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM public.profiles WHERE id = (SELECT auth.uid())),
        false
    );
$$;

-- ============================================================
-- 1. CONTRACT_EQUIPMENT - retirer les politiques "tout authentifié"
--    (les politiques contract_equipment_* scopées org restent)
-- ============================================================
DROP POLICY IF EXISTS "equipment_select" ON public.contract_equipment;
DROP POLICY IF EXISTS "equipment_insert" ON public.contract_equipment;
DROP POLICY IF EXISTS "equipment_update" ON public.contract_equipment;
DROP POLICY IF EXISTS "equipment_delete" ON public.contract_equipment;

-- ============================================================
-- 2. CONTRACT_HISTORY - retirer les politiques "tout authentifié"
-- ============================================================
DROP POLICY IF EXISTS "history_select" ON public.contract_history;
DROP POLICY IF EXISTS "history_insert" ON public.contract_history;
DROP POLICY IF EXISTS "history_delete" ON public.contract_history;

-- ============================================================
-- 3. CONTRACT_VISITS - retirer USING(true) et admin global
-- ============================================================
DROP POLICY IF EXISTS "visits_select" ON public.contract_visits;
DROP POLICY IF EXISTS "visits_insert" ON public.contract_visits;
DROP POLICY IF EXISTS "visits_update" ON public.contract_visits;
DROP POLICY IF EXISTS "visits_delete" ON public.contract_visits;

-- ============================================================
-- 4. CHECKLIST_TEMPLATES - retirer les politiques "tout authentifié"
-- ============================================================
DROP POLICY IF EXISTS "checklist_tpl_select" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_tpl_insert" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_tpl_update" ON public.checklist_templates;
DROP POLICY IF EXISTS "checklist_tpl_delete" ON public.checklist_templates;

-- ============================================================
-- 5. CHECKLISTS - admin limité à sa propre organisation
-- ============================================================
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
DROP POLICY IF EXISTS "checklists_update" ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete" ON public.checklists;

CREATE POLICY "checklists_select" ON public.checklists
FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND public.profile_org(user_id) = public.current_user_org_id())
);

CREATE POLICY "checklists_insert" ON public.checklists
FOR INSERT TO authenticated WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND public.profile_org(user_id) = public.current_user_org_id())
);

CREATE POLICY "checklists_update" ON public.checklists
FOR UPDATE TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND public.profile_org(user_id) = public.current_user_org_id())
) WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND public.profile_org(user_id) = public.current_user_org_id())
);

CREATE POLICY "checklists_delete" ON public.checklists
FOR DELETE TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND public.profile_org(user_id) = public.current_user_org_id())
);

-- ============================================================
-- 6. ELECTRONIC_SIGNATURES - admin limité à son organisation
-- ============================================================
DROP POLICY IF EXISTS "Users can view own signatures" ON public.electronic_signatures;

CREATE POLICY "signatures_select" ON public.electronic_signatures
FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND public.profile_org(user_id) = public.current_user_org_id())
);

-- ============================================================
-- 7. INTERVENTION_BRIEFING_DOCUMENTS
--    - corrige le bug de tautologie (ia.intervention_id = ia.intervention_id)
--    - scope org via interventions.organization_id
-- ============================================================
DROP POLICY IF EXISTS "briefing_select" ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "briefing_insert" ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "briefing_update" ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "briefing_delete" ON public.intervention_briefing_documents;

CREATE POLICY "briefing_select" ON public.intervention_briefing_documents
FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.interventions i
        WHERE i.id = intervention_briefing_documents.intervention_id
          AND i.organization_id = public.current_user_org_id()
    )
);

CREATE POLICY "briefing_insert" ON public.intervention_briefing_documents
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin() AND EXISTS (
        SELECT 1 FROM public.interventions i
        WHERE i.id = intervention_briefing_documents.intervention_id
          AND i.organization_id = public.current_user_org_id()
    )
);

CREATE POLICY "briefing_update" ON public.intervention_briefing_documents
FOR UPDATE TO authenticated USING (
    public.is_admin() AND EXISTS (
        SELECT 1 FROM public.interventions i
        WHERE i.id = intervention_briefing_documents.intervention_id
          AND i.organization_id = public.current_user_org_id()
    )
);

CREATE POLICY "briefing_delete" ON public.intervention_briefing_documents
FOR DELETE TO authenticated USING (
    public.is_admin() AND EXISTS (
        SELECT 1 FROM public.interventions i
        WHERE i.id = intervention_briefing_documents.intervention_id
          AND i.organization_id = public.current_user_org_id()
    )
);

-- ============================================================
-- 8. PUSH_SUBSCRIPTIONS - admin limité à son organisation
-- ============================================================
DROP POLICY IF EXISTS "push_select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_delete" ON public.push_subscriptions;

CREATE POLICY "push_select" ON public.push_subscriptions
FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND organization_id = public.current_user_org_id())
);

CREATE POLICY "push_delete" ON public.push_subscriptions
FOR DELETE TO authenticated USING (
    user_id = (SELECT auth.uid())
    OR (public.is_admin() AND organization_id = public.current_user_org_id())
);

-- ============================================================
-- 9. EXPENSES - resserrage intra-org : propriétaire ou admin
--    (avant : tout membre de l'org lisait/modifiait les frais des autres)
-- ============================================================
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;

CREATE POLICY "expenses_select" ON public.expenses
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (user_id = (SELECT auth.uid()) OR public.is_admin())
);

CREATE POLICY "expenses_insert" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (user_id = (SELECT auth.uid()) OR public.is_admin())
);

CREATE POLICY "expenses_update" ON public.expenses
FOR UPDATE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (user_id = (SELECT auth.uid()) OR public.is_admin())
) WITH CHECK (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "expenses_delete" ON public.expenses
FOR DELETE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (user_id = (SELECT auth.uid()) OR public.is_admin())
);

-- ============================================================
-- 10. EMPLOYEE_INVITATIONS - update/delete réservés aux admins
-- ============================================================
DROP POLICY IF EXISTS "invitations_update" ON public.employee_invitations;

CREATE POLICY "invitations_update" ON public.employee_invitations
FOR UPDATE TO authenticated USING (
    organization_id = public.current_user_org_id() AND public.is_admin()
) WITH CHECK (
    organization_id = public.current_user_org_id() AND public.is_admin()
);

DROP POLICY IF EXISTS "invitations_delete" ON public.employee_invitations;
CREATE POLICY "invitations_delete" ON public.employee_invitations
FOR DELETE TO authenticated USING (
    organization_id = public.current_user_org_id() AND public.is_admin()
);

SELECT 'SUCCESS - hardening 1/3 (tables) applied' AS result;
