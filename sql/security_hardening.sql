-- ============================================================
-- SECURITY HARDENING - Préparation commercialisation
-- ============================================================
-- Corrige les vulnérabilités de sécurité identifiées dans l'audit.
-- IMPORTANT: Exécuter dans Supabase SQL Editor après backup.
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_intervention(intervention_bid bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intervention_assignments
    WHERE intervention_id = intervention_bid
    AND user_id = auth.uid()
  );
$$;

-- ============================================================
-- 1. INTERVENTIONS (id = bigint)
-- ============================================================
DROP POLICY IF EXISTS "View interventions" ON public.interventions;
DROP POLICY IF EXISTS "Update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin manage interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin insert interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin delete interventions" ON public.interventions;

CREATE POLICY "View interventions" ON public.interventions
FOR SELECT TO authenticated USING (
    public.is_admin() OR public.is_assigned_to_intervention(id)
);

CREATE POLICY "Update interventions" ON public.interventions
FOR UPDATE TO authenticated USING (
    public.is_admin() OR public.is_assigned_to_intervention(id)
) WITH CHECK (
    public.is_admin() OR public.is_assigned_to_intervention(id)
);

CREATE POLICY "Admin insert interventions" ON public.interventions
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete interventions" ON public.interventions
FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 2. INTERVENTION_ASSIGNMENTS (intervention_id = bigint, user_id = uuid)
-- ============================================================
DROP POLICY IF EXISTS "View assignments" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Admin manage assignments" ON public.intervention_assignments;

CREATE POLICY "View assignments" ON public.intervention_assignments
FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Admin manage assignments" ON public.intervention_assignments
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 3. PROFILES (id = uuid)
-- ============================================================
DROP POLICY IF EXISTS "View profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin delete profiles" ON public.profiles;

CREATE POLICY "View profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (
    id = auth.uid() OR public.is_admin()
) WITH CHECK (
    id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Admin insert profiles" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admin delete profiles" ON public.profiles
FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 4. CERFA_DOCUMENTS (has created_by = uuid)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert cerfa" ON public.cerfa_documents;
DROP POLICY IF EXISTS "Insert cerfa" ON public.cerfa_documents;

CREATE POLICY "Insert cerfa" ON public.cerfa_documents
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin() OR created_by = auth.uid()
);

-- ============================================================
-- 5. INTERVENTION_TEMPLATES (has user_id = uuid)
-- ============================================================
DROP POLICY IF EXISTS "Create templates" ON public.intervention_templates;

CREATE POLICY "Create templates" ON public.intervention_templates
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- 6. MAINTENANCE_REPORTS (pas de created_by, pas de user_id)
-- ============================================================
DROP POLICY IF EXISTS "Update maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Create maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "reports_update" ON public.maintenance_reports;
DROP POLICY IF EXISTS "reports_insert" ON public.maintenance_reports;

CREATE POLICY "Update maintenance reports" ON public.maintenance_reports
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Create maintenance reports" ON public.maintenance_reports
FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. CONTRACT_HISTORY (has performed_by = uuid)
-- ============================================================
DROP POLICY IF EXISTS "Insert contract history" ON public.contract_history;

CREATE POLICY "Insert contract history" ON public.contract_history
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin() OR performed_by = auth.uid()
);

-- ============================================================
-- 8. LEAVE_REQUESTS (status = 'En attente'/'Approuvé'/'Rejeté')
-- ============================================================
DROP POLICY IF EXISTS "Manage leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "View leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Create leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Update leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Delete leave requests" ON public.leave_requests;

CREATE POLICY "View leave requests" ON public.leave_requests
FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Create leave requests" ON public.leave_requests
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update leave requests" ON public.leave_requests
FOR UPDATE TO authenticated USING (
    (user_id = auth.uid() AND status = 'En attente') OR public.is_admin()
) WITH CHECK (
    (user_id = auth.uid() AND status = 'En attente') OR public.is_admin()
);

CREATE POLICY "Delete leave requests" ON public.leave_requests
FOR DELETE TO authenticated USING (
    (user_id = auth.uid() AND status = 'En attente') OR public.is_admin()
);

-- ============================================================
-- 9. STORAGE BUCKETS - Passer en privé
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'intervention-files';
UPDATE storage.buckets SET public = false WHERE id = 'vault-files';

-- ============================================================
-- 10. STORAGE POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Public can view intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own vault files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated view intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Delete intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated view vault files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload vault files" ON storage.objects;
DROP POLICY IF EXISTS "Delete vault files" ON storage.objects;

-- INTERVENTION FILES
CREATE POLICY "Authenticated view intervention files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'intervention-files');

CREATE POLICY "Authenticated upload intervention files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'intervention-files');

CREATE POLICY "Delete intervention files" ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'intervention-files'
    AND (
        public.is_admin()
        OR (storage.foldername(name))[1] IN (
            SELECT DISTINCT intervention_id::text
            FROM public.intervention_assignments
            WHERE user_id = auth.uid()
        )
    )
);

-- VAULT FILES
CREATE POLICY "Authenticated view vault files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'vault-files');

CREATE POLICY "Authenticated upload vault files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vault-files');

CREATE POLICY "Delete vault files" ON storage.objects
FOR DELETE TO authenticated USING (
    bucket_id = 'vault-files'
    AND (
        public.is_admin()
        OR (storage.foldername(name))[1] = auth.uid()::text
    )
);

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'SUCCESS - Security hardening applied' as result;
SELECT id, name, public FROM storage.buckets WHERE id IN ('intervention-files', 'vault-files');
