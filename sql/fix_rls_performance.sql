-- =============================
-- CORRECTIONS PERFORMANCE RLS SUPABASE
-- À exécuter dans Supabase SQL Editor
-- =============================

-- =============================
-- 1. CERFA_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "Users can view cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can view cerfa documents" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can insert cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can insert cerfa documents" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can update cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can delete cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Users can update own cerfa documents" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Only admin can delete cerfa documents" ON public.cerfa_documents;

CREATE POLICY "Authenticated can view cerfa" ON public.cerfa_documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert cerfa" ON public.cerfa_documents
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update cerfa" ON public.cerfa_documents
FOR UPDATE TO authenticated USING (
    (select auth.uid()) = created_by OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admins can delete cerfa" ON public.cerfa_documents
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 2. SCANNED_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "Users can view their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Admins can view all scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can insert their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can update their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Admins can update all scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Users can delete their own scanned documents" ON public.scanned_documents;
DROP POLICY IF EXISTS "Admins can delete all scanned documents" ON public.scanned_documents;

CREATE POLICY "View scanned documents" ON public.scanned_documents
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Insert scanned documents" ON public.scanned_documents
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Update scanned documents" ON public.scanned_documents
FOR UPDATE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Delete scanned documents" ON public.scanned_documents
FOR DELETE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 3. CONTRACT_EQUIPMENT
-- =============================
DROP POLICY IF EXISTS "View equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Manage equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.contract_equipment;
DROP POLICY IF EXISTS "Admins can manage equipment" ON public.contract_equipment;

CREATE POLICY "View contract equipment" ON public.contract_equipment
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage contract equipment" ON public.contract_equipment
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 4. EMPLOYEE_ABSENCES
-- =============================
DROP POLICY IF EXISTS "Users can view all absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Admins can create absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Admins can update absences" ON public.employee_absences;
DROP POLICY IF EXISTS "Admins can delete absences" ON public.employee_absences;

CREATE POLICY "View absences" ON public.employee_absences
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage absences" ON public.employee_absences
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 5. LEAVE_REQUESTS
-- =============================
DROP POLICY IF EXISTS "Les admins ont un accès complet aux congés" ON public.leave_requests;
DROP POLICY IF EXISTS "Les employés gèrent leurs propres demandes" ON public.leave_requests;

CREATE POLICY "Manage leave requests" ON public.leave_requests
FOR ALL TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 6. INTERVENTION_TEMPLATES
-- =============================
DROP POLICY IF EXISTS "Users can view own and public templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can create own templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Admins can create public templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Admins can update all templates" ON public.intervention_templates;
DROP POLICY IF EXISTS "Admins can delete all templates" ON public.intervention_templates;

CREATE POLICY "View templates" ON public.intervention_templates
FOR SELECT TO authenticated USING (
    created_by = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Create templates" ON public.intervention_templates
FOR INSERT TO authenticated WITH CHECK (
    created_by = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Update templates" ON public.intervention_templates
FOR UPDATE TO authenticated USING (
    created_by = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Delete templates" ON public.intervention_templates
FOR DELETE TO authenticated USING (
    created_by = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 7. MAINTENANCE_REPORTS
-- =============================
DROP POLICY IF EXISTS "View reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Create reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Update reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Manage reports" ON public.maintenance_reports;

CREATE POLICY "View maintenance reports" ON public.maintenance_reports
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create maintenance reports" ON public.maintenance_reports
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update maintenance reports" ON public.maintenance_reports
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Delete maintenance reports" ON public.maintenance_reports
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 8. UPLOAD_MONITORING
-- =============================
DROP POLICY IF EXISTS "Users can view own upload logs" ON public.upload_monitoring;
DROP POLICY IF EXISTS "Authenticated users can insert their own upload logs" ON public.upload_monitoring;

CREATE POLICY "View upload logs" ON public.upload_monitoring
FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "Insert upload logs" ON public.upload_monitoring
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

-- =============================
-- 9. PROFILES
-- =============================
DROP POLICY IF EXISTS "Les utilisateurs peuvent gérer leur propre profil." ON public.profiles;
DROP POLICY IF EXISTS "Les admins peuvent voir tous les profils." ON public.profiles;

CREATE POLICY "View profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (
    id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 10. INTERVENTIONS
-- =============================
DROP POLICY IF EXISTS "Les admins ont un accès complet aux interventions." ON public.interventions;
DROP POLICY IF EXISTS "Les employés assignés peuvent voir leurs interventions." ON public.interventions;
DROP POLICY IF EXISTS "Les employés peuvent mettre à jour leurs propres intervention" ON public.interventions;
DROP POLICY IF EXISTS "Admins can delete interventions" ON public.interventions;

CREATE POLICY "View interventions" ON public.interventions
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.intervention_assignments WHERE intervention_id = id AND user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Update interventions" ON public.interventions
FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.intervention_assignments WHERE intervention_id = id AND user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admin manage interventions" ON public.interventions
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 11. INTERVENTION_ASSIGNMENTS
-- =============================
DROP POLICY IF EXISTS "Les employés voient leurs propres assignations" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Les admins ont un accès complet aux assignations." ON public.intervention_assignments;

CREATE POLICY "View assignments" ON public.intervention_assignments
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admin manage assignments" ON public.intervention_assignments
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 12. INTERVENTION_BRIEFING_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "Les admins ont un accès complet aux documents de préparation." ON public.intervention_briefing_documents;
DROP POLICY IF EXISTS "Les employés peuvent voir les documents de leurs interventions" ON public.intervention_briefing_documents;

CREATE POLICY "View briefing documents" ON public.intervention_briefing_documents
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.intervention_assignments ia WHERE ia.intervention_id = intervention_id AND ia.user_id = (select auth.uid())) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admin manage briefing documents" ON public.intervention_briefing_documents
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 13. NOTIFICATION_SUBSCRIPTIONS
-- =============================
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.notification_subscriptions;

CREATE POLICY "Manage own subscriptions" ON public.notification_subscriptions
FOR ALL TO authenticated USING (user_id = (select auth.uid()));

-- =============================
-- 14. CHECKLIST_TEMPLATES
-- =============================
DROP POLICY IF EXISTS "Everyone can view checklist templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admins can manage checklist templates" ON public.checklist_templates;

CREATE POLICY "View checklist templates" ON public.checklist_templates
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage checklist templates" ON public.checklist_templates
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 15. CHECKLISTS
-- =============================
DROP POLICY IF EXISTS "Users can view their own checklists" ON public.checklists;
DROP POLICY IF EXISTS "Users can update their own checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can view all checklists" ON public.checklists;
DROP POLICY IF EXISTS "Admins can manage checklists" ON public.checklists;

CREATE POLICY "View checklists" ON public.checklists
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Update checklists" ON public.checklists
FOR UPDATE TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admin manage checklists" ON public.checklists
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 16. VAULT_DOCUMENTS
-- =============================
DROP POLICY IF EXISTS "Les employés peuvent voir leurs propres documents." ON public.vault_documents;
DROP POLICY IF EXISTS "Les administrateurs ont un accès tota" ON public.vault_documents;

CREATE POLICY "View vault documents" ON public.vault_documents
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admin manage vault documents" ON public.vault_documents
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 17. MAINTENANCE_CONTRACTS
-- =============================
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admins can create contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admins can update contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.maintenance_contracts;
DROP POLICY IF EXISTS "Users can delete contracts" ON public.maintenance_contracts;

CREATE POLICY "View contracts" ON public.maintenance_contracts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage contracts" ON public.maintenance_contracts
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 18. EXPENSES
-- =============================
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete any expense" ON public.expenses;

CREATE POLICY "View expenses" ON public.expenses
FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Create expenses" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Update expenses" ON public.expenses
FOR UPDATE TO authenticated USING (
    (user_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Delete expenses" ON public.expenses
FOR DELETE TO authenticated USING (
    (user_id = (select auth.uid()) AND status = 'pending') OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 19. CONTRACT_HISTORY
-- =============================
DROP POLICY IF EXISTS "Users can view contract history" ON public.contract_history;
DROP POLICY IF EXISTS "View history" ON public.contract_history;
DROP POLICY IF EXISTS "Users can insert contract history" ON public.contract_history;
DROP POLICY IF EXISTS "Admins can delete contract history" ON public.contract_history;

CREATE POLICY "View contract history" ON public.contract_history
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert contract history" ON public.contract_history
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin delete contract history" ON public.contract_history
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 20. CONTRACT_VISITS
-- =============================
DROP POLICY IF EXISTS "Authenticated users can view visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Admins can manage visits" ON public.contract_visits;
DROP POLICY IF EXISTS "Technicians can update assigned visits" ON public.contract_visits;

CREATE POLICY "View visits" ON public.contract_visits
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Update assigned visits" ON public.contract_visits
FOR UPDATE TO authenticated USING (
    assigned_technician_id = (select auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

CREATE POLICY "Admin manage visits" ON public.contract_visits
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- FIN
-- =============================
SELECT 'SUCCESS - All RLS performance fixes applied' as result;
