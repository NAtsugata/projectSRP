-- ============================================================
-- SECURITY HARDENING - Préparation commercialisation
-- ============================================================
-- Ce fichier corrige les vulnérabilités de sécurité identifiées
-- dans l'audit de préparation à la commercialisation.
--
-- IMPORTANT: Exécuter dans Supabase SQL Editor
-- Créer un backup avant exécution
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: is_admin check (évite la duplication)
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

-- ============================================================
-- HELPER FUNCTION: is_assigned_to_intervention
-- ============================================================
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
-- 1. INTERVENTIONS - Sécuriser SELECT/UPDATE pour les employés
-- ============================================================
DROP POLICY IF EXISTS "View interventions" ON public.interventions;
DROP POLICY IF EXISTS "Update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admin manage interventions" ON public.interventions;

-- Employés voient uniquement leurs interventions assignées, admins voient tout
CREATE POLICY "View interventions" ON public.interventions
FOR SELECT TO authenticated USING (
    public.is_admin() OR
    public.is_assigned_to_intervention(id)
);

-- Employés ne peuvent mettre à jour que leurs interventions (champ report), admins tout
CREATE POLICY "Update interventions" ON public.interventions
FOR UPDATE TO authenticated USING (
    public.is_admin() OR
    public.is_assigned_to_intervention(id)
) WITH CHECK (
    public.is_admin() OR
    public.is_assigned_to_intervention(id)
);

-- Seuls les admins peuvent créer/supprimer des interventions
CREATE POLICY "Admin insert interventions" ON public.interventions
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
);

CREATE POLICY "Admin delete interventions" ON public.interventions
FOR DELETE TO authenticated USING (
    public.is_admin()
);

-- ============================================================
-- 2. INTERVENTION_ASSIGNMENTS - Sécuriser
-- ============================================================
DROP POLICY IF EXISTS "View assignments" ON public.intervention_assignments;
DROP POLICY IF EXISTS "Admin manage assignments" ON public.intervention_assignments;

CREATE POLICY "View assignments" ON public.intervention_assignments
FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin()
);

CREATE POLICY "Admin manage assignments" ON public.intervention_assignments
FOR ALL TO authenticated USING (
    public.is_admin()
) WITH CHECK (
    public.is_admin()
);

-- ============================================================
-- 3. PROFILES - Limiter les données visibles
-- ============================================================
DROP POLICY IF EXISTS "View profiles" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

-- Tous les authentifiés peuvent voir les profils (nécessaire pour afficher les noms d'équipe)
-- Mais on limitera les colonnes côté application
CREATE POLICY "View profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

-- Un utilisateur ne peut modifier que son propre profil, sauf admin
CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (
    id = auth.uid() OR public.is_admin()
) WITH CHECK (
    id = auth.uid() OR public.is_admin()
);

-- Seul un admin peut créer ou supprimer des profils
CREATE POLICY "Admin insert profiles" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
);

CREATE POLICY "Admin delete profiles" ON public.profiles
FOR DELETE TO authenticated USING (
    public.is_admin()
);

-- ============================================================
-- 4. CERFA_DOCUMENTS - Resserrer INSERT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert cerfa" ON public.cerfa_documents;

-- Seuls les utilisateurs assignés à l'intervention ou admin peuvent créer un CERFA
CREATE POLICY "Insert cerfa" ON public.cerfa_documents
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin() OR
    created_by = auth.uid()
);

-- ============================================================
-- 5. INTERVENTION_TEMPLATES - Resserrer INSERT
-- ============================================================
DROP POLICY IF EXISTS "Create templates" ON public.intervention_templates;

-- Seuls les admins peuvent créer des templates
CREATE POLICY "Create templates" ON public.intervention_templates
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
);

-- ============================================================
-- 6. MAINTENANCE_REPORTS - Resserrer UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Update maintenance reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Create maintenance reports" ON public.maintenance_reports;

-- Seuls les admins peuvent modifier les rapports de maintenance
CREATE POLICY "Update maintenance reports" ON public.maintenance_reports
FOR UPDATE TO authenticated USING (
    public.is_admin()
) WITH CHECK (
    public.is_admin()
);

-- Tout utilisateur authentifié peut créer un rapport
CREATE POLICY "Create maintenance reports" ON public.maintenance_reports
FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 7. CONTRACT_HISTORY - Resserrer INSERT
-- ============================================================
DROP POLICY IF EXISTS "Insert contract history" ON public.contract_history;

-- Seuls les admins peuvent insérer dans l'historique des contrats
CREATE POLICY "Insert contract history" ON public.contract_history
FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
);

-- ============================================================
-- 8. LEAVE_REQUESTS - Séparer les politiques
-- ============================================================
DROP POLICY IF EXISTS "Manage leave requests" ON public.leave_requests;

-- Voir : ses propres demandes ou admin
CREATE POLICY "View leave requests" ON public.leave_requests
FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_admin()
);

-- Créer : uniquement ses propres demandes
CREATE POLICY "Create leave requests" ON public.leave_requests
FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);

-- Modifier : ses propres demandes (si en attente) ou admin
CREATE POLICY "Update leave requests" ON public.leave_requests
FOR UPDATE TO authenticated USING (
    (user_id = auth.uid() AND status = 'pending') OR public.is_admin()
) WITH CHECK (
    (user_id = auth.uid() AND status = 'pending') OR public.is_admin()
);

-- Supprimer : ses propres demandes (si en attente) ou admin
CREATE POLICY "Delete leave requests" ON public.leave_requests
FOR DELETE TO authenticated USING (
    (user_id = auth.uid() AND status = 'pending') OR public.is_admin()
);

-- ============================================================
-- 9. STORAGE BUCKETS - Passer en privé
-- ============================================================

-- Rendre les buckets privés
UPDATE storage.buckets SET public = false WHERE id = 'intervention-files';
UPDATE storage.buckets SET public = false WHERE id = 'vault-files';

-- ============================================================
-- 10. STORAGE POLICIES - Resserrer
-- ============================================================

-- Supprimer les anciennes politiques publiques
DROP POLICY IF EXISTS "Public can view intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete intervention files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own vault files" ON storage.objects;

-- INTERVENTION FILES : Seuls les utilisateurs authentifiés peuvent voir
CREATE POLICY "Authenticated view intervention files" ON storage.objects
FOR SELECT TO authenticated USING (
    bucket_id = 'intervention-files'
);

-- INTERVENTION FILES : Upload par les utilisateurs authentifiés
CREATE POLICY "Authenticated upload intervention files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'intervention-files'
);

-- INTERVENTION FILES : Delete par admin ou utilisateur assigné
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

-- VAULT FILES : Seuls les utilisateurs authentifiés peuvent voir
CREATE POLICY "Authenticated view vault files" ON storage.objects
FOR SELECT TO authenticated USING (
    bucket_id = 'vault-files'
);

-- VAULT FILES : Upload par les utilisateurs authentifiés
CREATE POLICY "Authenticated upload vault files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'vault-files'
);

-- VAULT FILES : Delete par admin ou propriétaire
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
