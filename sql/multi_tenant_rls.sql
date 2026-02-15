-- ============================================================
-- MULTI-TENANT RLS - Isolation des données par organisation
-- ============================================================
-- À exécuter APRÈS multi_tenant_setup.sql
-- Ces politiques remplacent les existantes pour ajouter
-- le filtre organization_id à toutes les tables.
-- ============================================================

-- ============================================================
-- 1. PROFILES - Voir son propre profil + ceux de son organisation
-- ============================================================
DROP POLICY IF EXISTS "View profiles" ON public.profiles;
DROP POLICY IF EXISTS "View own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

-- Chaque utilisateur peut TOUJOURS voir son propre profil (évite la récursion RLS)
CREATE POLICY "View own profile" ON public.profiles
FOR SELECT TO authenticated USING (
    id = auth.uid()
);

-- Voir les profils de la même organisation (ou super admin voit tout)
CREATE POLICY "View profiles" ON public.profiles
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    OR public.current_user_is_super_admin()
);

-- Chaque utilisateur peut modifier son propre profil
CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (
    id = auth.uid()
) WITH CHECK (
    id = auth.uid()
);

-- ============================================================
-- 2. INTERVENTIONS - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View interventions" ON public.interventions;
DROP POLICY IF EXISTS "Update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin insert interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin delete interventions" ON public.interventions;

CREATE POLICY "View interventions" ON public.interventions
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (public.is_admin() OR public.is_assigned_to_intervention(id))
);

CREATE POLICY "Update interventions" ON public.interventions
FOR UPDATE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (public.is_admin() OR public.is_assigned_to_intervention(id))
) WITH CHECK (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "Admin insert interventions" ON public.interventions
FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
);

CREATE POLICY "Admin delete interventions" ON public.interventions
FOR DELETE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
);

-- ============================================================
-- 3. EXPENSES - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View expenses" ON public.expenses;
DROP POLICY IF EXISTS "Create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Delete expenses" ON public.expenses;

CREATE POLICY "View expenses" ON public.expenses
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (user_id = auth.uid() OR public.is_admin())
);

CREATE POLICY "Create expenses" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id()
    AND user_id = auth.uid()
);

CREATE POLICY "Update expenses" ON public.expenses
FOR UPDATE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND ((user_id = auth.uid() AND status = 'pending') OR public.is_admin())
);

CREATE POLICY "Delete expenses" ON public.expenses
FOR DELETE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND ((user_id = auth.uid() AND status = 'pending') OR public.is_admin())
);

-- ============================================================
-- 4. LEAVE_REQUESTS - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Create leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Update leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Delete leave requests" ON public.leave_requests;

CREATE POLICY "View leave requests" ON public.leave_requests
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (user_id = auth.uid() OR public.is_admin())
);

CREATE POLICY "Create leave requests" ON public.leave_requests
FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id()
    AND user_id = auth.uid()
);

CREATE POLICY "Update leave requests" ON public.leave_requests
FOR UPDATE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND ((user_id = auth.uid() AND status = 'En attente') OR public.is_admin())
);

CREATE POLICY "Delete leave requests" ON public.leave_requests
FOR DELETE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND ((user_id = auth.uid() AND status = 'En attente') OR public.is_admin())
);

-- ============================================================
-- 5. VAULT_DOCUMENTS - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View vault documents" ON public.vault_documents;
DROP POLICY IF EXISTS "Admin manage vault documents" ON public.vault_documents;

CREATE POLICY "View vault documents" ON public.vault_documents
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND (user_id = auth.uid() OR public.is_admin())
);

CREATE POLICY "Admin manage vault documents" ON public.vault_documents
FOR ALL TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
) WITH CHECK (
    organization_id = public.current_user_org_id()
);

-- ============================================================
-- 6. MAINTENANCE_CONTRACTS - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admin manage contracts" ON public.maintenance_contracts;

CREATE POLICY "View contracts" ON public.maintenance_contracts
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "Admin manage contracts" ON public.maintenance_contracts
FOR ALL TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
) WITH CHECK (
    organization_id = public.current_user_org_id()
);

-- ============================================================
-- 7. CERFA_DOCUMENTS - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Insert cerfa" ON public.cerfa_documents;

CREATE POLICY "View cerfa" ON public.cerfa_documents
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "Insert cerfa" ON public.cerfa_documents
FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id()
    AND (public.is_admin() OR created_by = auth.uid())
);

-- ============================================================
-- 8. CHECKLIST_TEMPLATES - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View checklist templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admin manage checklist templates" ON public.checklist_templates;

CREATE POLICY "View checklist templates" ON public.checklist_templates
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "Admin manage checklist templates" ON public.checklist_templates
FOR ALL TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
) WITH CHECK (
    organization_id = public.current_user_org_id()
);

-- ============================================================
-- 9. INTERVENTION_TEMPLATES - Filtrées par organisation
-- ============================================================
DROP POLICY IF EXISTS "View templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Create templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Update templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Delete templates" ON public.intervention_templates;

CREATE POLICY "View templates" ON public.intervention_templates
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "Create templates" ON public.intervention_templates
FOR INSERT TO authenticated WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
);

CREATE POLICY "Update templates" ON public.intervention_templates
FOR UPDATE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
);

CREATE POLICY "Delete templates" ON public.intervention_templates
FOR DELETE TO authenticated USING (
    organization_id = public.current_user_org_id()
    AND public.is_admin()
);

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'SUCCESS - Multi-tenant RLS applied' as result;
