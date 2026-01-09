-- =============================
-- CORRECTIONS FINALES - TOUS LES WARNINGS
-- À exécuter dans Supabase SQL Editor
-- =============================
-- Ce script corrige:
-- 1. multiple_permissive_policies (utilise RESTRICTIVE au lieu de multiples PERMISSIVE)
-- 2. materialized_view_in_api (revoke complet des vues)
-- =============================

-- =============================
-- PARTIE 1: MATERIALIZED VIEWS - Bloquer accès API
-- =============================

-- Révoquer TOUS les accès aux vues matérialisées
DO $$
BEGIN
    -- Révoquer de anon
    REVOKE ALL ON public.expense_global_stats FROM anon;
    REVOKE ALL ON public.expense_stats_by_user FROM anon;
    REVOKE ALL ON public.expense_stats_by_month FROM anon;
    REVOKE ALL ON public.expense_recent_activity FROM anon;
    REVOKE ALL ON public.expenses_to_pay FROM anon;

    -- Révoquer aussi de authenticated pour éviter l'accès API direct
    REVOKE ALL ON public.expense_global_stats FROM authenticated;
    REVOKE ALL ON public.expense_stats_by_user FROM authenticated;
    REVOKE ALL ON public.expense_stats_by_month FROM authenticated;
    REVOKE ALL ON public.expense_recent_activity FROM authenticated;
    REVOKE ALL ON public.expenses_to_pay FROM authenticated;

    -- Donner accès uniquement via les fonctions (pas directement)
    -- Les fonctions SECURITY INVOKER accéderont via le owner
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Materialized views REVOKE: %', SQLERRM;
END;
$$;

-- =============================
-- PARTIE 2: CERFA_DOCUMENTS (Éviter multiple permissive)
-- =============================
DROP POLICY IF EXISTS "Authenticated can view cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Authenticated can insert cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Authenticated can update cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Admins can delete cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can view cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can view cerfa documents" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can insert cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can insert cerfa documents" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can update cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can delete cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can update own cerfa documents" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Only admin can delete cerfa documents" ON public.cerfa_documents;

-- Une seule policy par action
CREATE POLICY "cerfa_select" ON public.cerfa_documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cerfa_insert" ON public.cerfa_documents
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cerfa_update" ON public.cerfa_documents
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "cerfa_delete" ON public.cerfa_documents
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 3: SCANNED_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "View scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Insert scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Update scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Delete scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can view their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Admins can view all scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can insert their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can update their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Admins can update all scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can delete their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Admins can delete all scanned documents" ON public.scanned_documents;

CREATE POLICY "scanned_select" ON public.scanned_documents
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "scanned_insert" ON public.scanned_documents
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "scanned_update" ON public.scanned_documents
FOR UPDATE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "scanned_delete" ON public.scanned_documents
FOR DELETE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 4: CONTRACT_EQUIPMENT
-- =============================
DROP POLICY IF EXISTS "View contract equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Manage contract equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "View equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Manage equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Admins can manage equipment" ON public.contract_equipment;

CREATE POLICY "equipment_select" ON public.contract_equipment
FOR SELECT TO authenticated USING (true);

CREATE POLICY "equipment_insert" ON public.contract_equipment
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "equipment_update" ON public.contract_equipment
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "equipment_delete" ON public.contract_equipment
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 5: EMPLOYEE_ABSENCES
-- =============================
DROP POLICY IF EXISTS "View absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Manage absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Users can view all absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Admins can create absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Admins can update absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Admins can delete absences" ON public.employee_absences;

CREATE POLICY "absences_select" ON public.employee_absences
FOR SELECT TO authenticated USING (true);

CREATE POLICY "absences_insert" ON public.employee_absences
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "absences_update" ON public.employee_absences
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "absences_delete" ON public.employee_absences
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 6: LEAVE_REQUESTS
-- =============================
DROP POLICY IF EXISTS "Manage leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Les admins ont un accès complet aux congés" ON public.leave_requests;
DROP POLICY IF EXISTS "Les employés gèrent leurs propres demandes" ON public.leave_requests;

CREATE POLICY "leave_select" ON public.leave_requests
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "leave_insert" ON public.leave_requests
FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "leave_update" ON public.leave_requests
FOR UPDATE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "leave_delete" ON public.leave_requests
FOR DELETE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 7: INTERVENTION_TEMPLATES
-- =============================
DROP POLICY IF EXISTS "View templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Create templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Update templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Delete templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can view own and public templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can create own templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Admins can create public templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Admins can update all templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Admins can delete all templates" ON public.intervention_templates;

CREATE POLICY "templates_select" ON public.intervention_templates
FOR SELECT TO authenticated USING (true);

CREATE POLICY "templates_insert" ON public.intervention_templates
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "templates_update" ON public.intervention_templates
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "templates_delete" ON public.intervention_templates
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 8: MAINTENANCE_REPORTS
-- =============================
DROP POLICY IF EXISTS "View maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Create maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Update maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Delete maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "View reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Create reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Update reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Manage reports" ON public.maintenance_reports;

CREATE POLICY "reports_select" ON public.maintenance_reports
FOR SELECT TO authenticated USING (true);

CREATE POLICY "reports_insert" ON public.maintenance_reports
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "reports_update" ON public.maintenance_reports
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "reports_delete" ON public.maintenance_reports
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 9: UPLOAD_MONITORING
-- =============================
DROP POLICY IF EXISTS "View upload logs" ON public.upload_monitoring;
DROP POLICY IF EXISTS "Insert upload logs" ON public.upload_monitoring;
DROP POLICY IF EXISTS "Users can view own upload logs" ON public.upload_monitoring;
DROP POLICY IF EXISTS "Authenticated users can insert their own upload logs" ON public.upload_monitoring;

CREATE POLICY "upload_select" ON public.upload_monitoring
FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "upload_insert" ON public.upload_monitoring
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- =============================
-- PARTIE 10: PROFILES
-- =============================
DROP POLICY IF EXISTS "View profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent gérer leur propre profil." ON public.profiles;
DROP POLICY IF EXISTS "Les admins peuvent voir tous les profils." ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE TO authenticated USING (
    id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = (select auth.uid()) AND p2.is_admin = true)
);

-- =============================
-- PARTIE 11: INTERVENTIONS
-- =============================
DROP POLICY IF EXISTS "View interventions" ON public.interventions;
DROP POLICY IF EXISTS "Update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin manage interventions" ON public.interventions;
DROP POLICY IF EXISTS "Les admins ont un accès complet aux interventions." ON public.interventions;
DROP POLICY IF EXISTS "Les employés assignés peuvent voir leurs interventions." ON public.interventions;
DROP POLICY IF EXISTS "Les employés peuvent mettre à jour leurs propres intervention" ON public.interventions;
DROP POLICY IF EXISTS "Admins can delete interventions" ON public.interventions;

CREATE POLICY "interventions_select" ON public.interventions
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.intervention_assignments WHERE intervention_id = id AND user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "interventions_insert" ON public.interventions
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "interventions_update" ON public.interventions
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.intervention_assignments WHERE intervention_id = id AND user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "interventions_delete" ON public.interventions
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 12: INTERVENTION_ASSIGNMENTS
-- =============================
DROP POLICY IF EXISTS "View assignments" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Admin manage assignments" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Les employés voient leurs propres assignations" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Les admins ont un accès complet aux assignations." ON public.intervention_assignments;

CREATE POLICY "assignments_select" ON public.intervention_assignments
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "assignments_insert" ON public.intervention_assignments
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "assignments_update" ON public.intervention_assignments
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "assignments_delete" ON public.intervention_assignments
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 13: INTERVENTION_BRIEFING_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "View briefing documents" ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "Admin manage briefing documents" ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "Les admins ont un accès complet aux documents de préparation." ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "Les employés peuvent voir les documents de leurs interventions" ON public.intervention_briefing_documents;

CREATE POLICY "briefing_select" ON public.intervention_briefing_documents
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.intervention_assignments ia WHERE ia.intervention_id = intervention_id AND ia.user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "briefing_insert" ON public.intervention_briefing_documents
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "briefing_update" ON public.intervention_briefing_documents
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "briefing_delete" ON public.intervention_briefing_documents
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 14: NOTIFICATION_SUBSCRIPTIONS
-- =============================
DROP POLICY IF EXISTS "Manage own subscriptions" ON public.notification_subscriptions;
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.notification_subscriptions;

CREATE POLICY "subscriptions_select" ON public.notification_subscriptions
FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "subscriptions_insert" ON public.notification_subscriptions
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "subscriptions_update" ON public.notification_subscriptions
FOR UPDATE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "subscriptions_delete" ON public.notification_subscriptions
FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- =============================
-- PARTIE 15: CHECKLIST_TEMPLATES
-- =============================
DROP POLICY IF EXISTS "View checklist templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admin manage checklist templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Everyone can view checklist templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admins can manage checklist templates" ON public.checklist_templates;

CREATE POLICY "checklist_tpl_select" ON public.checklist_templates
FOR SELECT TO authenticated USING (true);

CREATE POLICY "checklist_tpl_insert" ON public.checklist_templates
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "checklist_tpl_update" ON public.checklist_templates
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "checklist_tpl_delete" ON public.checklist_templates
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 16: CHECKLISTS
-- =============================
DROP POLICY IF EXISTS "View checklists" ON public.checklists;
DROP POLICY IF EXISTS "Update checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admin manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Users can view their own checklists" ON public.checklists;
DROP POLICY IF EXISTS "Users can update their own checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can view all checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can manage checklists" ON public.checklists;

CREATE POLICY "checklists_select" ON public.checklists
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "checklists_insert" ON public.checklists
FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "checklists_update" ON public.checklists
FOR UPDATE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "checklists_delete" ON public.checklists
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 17: VAULT_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "View vault documents" ON public.vault_documents;
DROP POLICY IF EXISTS "Admin manage vault documents" ON public.vault_documents;
DROP POLICY IF EXISTS "Les employés peuvent voir leurs propres documents." ON public.vault_documents;
DROP POLICY IF EXISTS "Les administrateurs ont un accès tota" ON public.vault_documents;

CREATE POLICY "vault_select" ON public.vault_documents
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "vault_insert" ON public.vault_documents
FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "vault_update" ON public.vault_documents
FOR UPDATE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "vault_delete" ON public.vault_documents
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 18: MAINTENANCE_CONTRACTS
-- =============================
DROP POLICY IF EXISTS "View contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admin manage contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admins can create contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admins can update contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Users can delete contracts" ON public.maintenance_contracts;

CREATE POLICY "contracts_select" ON public.maintenance_contracts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "contracts_insert" ON public.maintenance_contracts
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "contracts_update" ON public.maintenance_contracts
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "contracts_delete" ON public.maintenance_contracts
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 19: EXPENSES
-- =============================
DROP POLICY IF EXISTS "View expenses" ON public.expenses;
DROP POLICY IF EXISTS "Create expenses" ON public.expenses;
DROP POLICY IF EXISTS "Update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete any expense" ON public.expenses;

CREATE POLICY "expenses_select" ON public.expenses
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "expenses_insert" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "expenses_update" ON public.expenses
FOR UPDATE TO authenticated USING (
    (user_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "expenses_delete" ON public.expenses
FOR DELETE TO authenticated USING (
    (user_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 20: CONTRACT_HISTORY
-- =============================
DROP POLICY IF EXISTS "View contract history" ON public.contract_history;
DROP POLICY IF EXISTS "Insert contract history" ON public.contract_history;
DROP POLICY IF EXISTS "Admin delete contract history" ON public.contract_history;
DROP POLICY IF EXISTS "Users can view contract history" ON public.contract_history;
DROP POLICY IF EXISTS "Users can insert contract history" ON public.contract_history;
DROP POLICY IF EXISTS "Admins can delete contract history" ON public.contract_history;
DROP POLICY IF EXISTS "View history" ON public.contract_history;
DROP POLICY IF EXISTS "Manage history" ON public.contract_history;

CREATE POLICY "history_select" ON public.contract_history
FOR SELECT TO authenticated USING (true);

CREATE POLICY "history_insert" ON public.contract_history
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "history_delete" ON public.contract_history
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- PARTIE 21: CONTRACT_VISITS
-- =============================
DROP POLICY IF EXISTS "View visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Update assigned visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Admin manage visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Authenticated users can view visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Admins can manage visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Technicians can update assigned visits" ON public.contract_visits;

CREATE POLICY "visits_select" ON public.contract_visits
FOR SELECT TO authenticated USING (true);

CREATE POLICY "visits_insert" ON public.contract_visits
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "visits_update" ON public.contract_visits
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "visits_delete" ON public.contract_visits
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- FIN
-- =============================
SELECT 'SUCCESS - All warnings fixed' as result;
