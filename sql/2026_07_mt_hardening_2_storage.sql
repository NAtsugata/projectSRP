-- ============================================================
-- MULTI-TENANT HARDENING (2/3) - Politiques Storage
-- ============================================================
-- Failles corrigées :
--   - vault-files ouvert à TOUT utilisateur authentifié (lecture/écriture/suppression)
--   - politiques admin globales sans filtre bucket ni organisation
--   - politique "employés interventions" avec tautologie cassée
--   - suppressions admin non limitées à l'organisation
-- Conventions de chemins (constatées en base) :
--   vault-files          : {user_id}/... , vault/{user_id}/... , scanned-docs/{user_id}/...
--   intervention-files   : {intervention_id(bigint)}/... , {user_id}/ir-shower/...
--   intervention-photos  : {org_id}/{user_id}/...
--   cerfa-documents      : {org_id}/... (nouveau) , cerfa/... (legacy, scopé via table)
--   expense-receipts     : {user_id}/...
--   signature-files      : {user_id}/...
--   organization-assets  : {org_id}/... (bucket public : logos)
--   quote-attachments    : {org_id}/quotes/{quote_id}/...
-- ============================================================

-- Helper : propriétaire (user_id) déduit du chemin d'un objet vault-files
CREATE OR REPLACE FUNCTION public.storage_owner_uuid(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN parts[1] IN ('vault', 'scanned-docs') THEN public.uuid_or_null(parts[2])
        ELSE public.uuid_or_null(parts[1])
    END
    FROM (SELECT storage.foldername(p_name) AS parts) s;
$$;

-- ============================================================
-- 1. SUPPRESSION des politiques dangereuses
-- ============================================================
-- vault-files ouvert à tous les authentifiés
DROP POLICY IF EXISTS "Authenticated upload vault files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated view vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete vault files" ON storage.objects;
DROP POLICY IF EXISTS "Delete vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own vault files" ON storage.objects;
DROP POLICY IF EXISTS "Users can access their own folder." ON storage.objects;
DROP POLICY IF EXISTS "Les employés peuvent accéder à leur propre dossier de coffre" ON storage.objects;

-- Admin global, sans filtre bucket ni organisation
DROP POLICY IF EXISTS "Les admins peuvent gérer tous les fichiers d'intervention." ON storage.objects;
DROP POLICY IF EXISTS "Les admins peuvent gérer tous les fichiers du coffre-fort." ON storage.objects;
DROP POLICY IF EXISTS "admin 5ouebl_0" ON storage.objects;
DROP POLICY IF EXISTS "admin 5ouebl_1" ON storage.objects;
DROP POLICY IF EXISTS "admin 5ouebl_2" ON storage.objects;
DROP POLICY IF EXISTS "admin 5ouebl_3" ON storage.objects;

-- Politique cassée (tautologie) sans filtre bucket
DROP POLICY IF EXISTS "Les employés peuvent gérer les fichiers de leurs intervention" ON storage.objects;

-- Politiques avec admin global à re-scoper
DROP POLICY IF EXISTS "cerfa_delete" ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin can delete intervention photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own signature files" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_delete" ON storage.objects;
DROP POLICY IF EXISTS "intervention_files_select" ON storage.objects;
DROP POLICY IF EXISTS "intervention_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "intervention_files_update" ON storage.objects;
DROP POLICY IF EXISTS "intervention_files_delete" ON storage.objects;

-- Doublons organization-assets
DROP POLICY IF EXISTS "Users can update organization assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload organization assets" ON storage.objects;

-- ============================================================
-- 2. VAULT-FILES : propriétaire + admin de la même organisation
-- ============================================================
CREATE POLICY "vault_owner_all" ON storage.objects
FOR ALL TO authenticated
USING (
    bucket_id = 'vault-files'
    AND public.storage_owner_uuid(name) = (SELECT auth.uid())
) WITH CHECK (
    bucket_id = 'vault-files'
    AND public.storage_owner_uuid(name) = (SELECT auth.uid())
);

CREATE POLICY "vault_org_admin_all" ON storage.objects
FOR ALL TO authenticated
USING (
    bucket_id = 'vault-files'
    AND public.is_admin()
    AND public.profile_org(public.storage_owner_uuid(name)) = public.current_user_org_id()
) WITH CHECK (
    bucket_id = 'vault-files'
    AND public.is_admin()
    AND public.profile_org(public.storage_owner_uuid(name)) = public.current_user_org_id()
);

-- ============================================================
-- 3. INTERVENTION-FILES : dossier utilisateur OU intervention de l'org
-- ============================================================
CREATE POLICY "intervention_files_org_all" ON storage.objects
FOR ALL TO authenticated
USING (
    bucket_id = 'intervention-files'
    AND (
        public.uuid_or_null((storage.foldername(name))[1]) = (SELECT auth.uid())
        OR (
            (storage.foldername(name))[1] ~ '^[0-9]+$'
            AND EXISTS (
                SELECT 1 FROM public.interventions i
                WHERE i.id = ((storage.foldername(name))[1])::bigint
                  AND i.organization_id = public.current_user_org_id()
            )
        )
        OR (
            public.is_admin()
            AND public.profile_org(public.uuid_or_null((storage.foldername(name))[1]))
                = public.current_user_org_id()
        )
    )
) WITH CHECK (
    bucket_id = 'intervention-files'
    AND (
        public.uuid_or_null((storage.foldername(name))[1]) = (SELECT auth.uid())
        OR (
            (storage.foldername(name))[1] ~ '^[0-9]+$'
            AND EXISTS (
                SELECT 1 FROM public.interventions i
                WHERE i.id = ((storage.foldername(name))[1])::bigint
                  AND i.organization_id = public.current_user_org_id()
            )
        )
        OR (
            public.is_admin()
            AND public.profile_org(public.uuid_or_null((storage.foldername(name))[1]))
                = public.current_user_org_id()
        )
    )
);

-- ============================================================
-- 4. EXPENSE-RECEIPTS : propriétaire + admin org-scopé
--    (la politique d'insert "own folder" existante est conservée)
-- ============================================================
CREATE POLICY "expense_receipts_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'expense-receipts'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR (
            public.is_admin()
            AND public.profile_org(public.uuid_or_null((storage.foldername(name))[1]))
                = public.current_user_org_id()
        )
    )
);

CREATE POLICY "expense_receipts_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'expense-receipts'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR (
            public.is_admin()
            AND public.profile_org(public.uuid_or_null((storage.foldername(name))[1]))
                = public.current_user_org_id()
        )
    )
);

-- ============================================================
-- 5. SIGNATURE-FILES : propriétaire + admin org-scopé (lecture)
-- ============================================================
CREATE POLICY "signature_files_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'signature-files'
    AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR (
            public.is_admin()
            AND public.profile_org(public.uuid_or_null((storage.foldername(name))[1]))
                = public.current_user_org_id()
        )
    )
);

-- ============================================================
-- 6. INTERVENTION-PHOTOS : suppression par propriétaire ou admin de l'org
--    (insert/select org-scopés existants conservés)
-- ============================================================
CREATE POLICY "intervention_photos_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'intervention-photos'
    AND (
        (storage.foldername(name))[2] = (SELECT auth.uid())::text
        OR (
            public.is_admin()
            AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
        )
    )
);

-- ============================================================
-- 7. CERFA-DOCUMENTS
--    - chemin org ({org_id}/...) : insert/select existants conservés
--    - chemin legacy (cerfa/...) : accès scopé via la table cerfa_documents
-- ============================================================
CREATE POLICY "cerfa_legacy_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'cerfa-documents'
    AND (storage.foldername(name))[1] = 'cerfa'
    AND EXISTS (
        SELECT 1 FROM public.cerfa_documents cd
        WHERE cd.file_path = objects.name
          AND cd.organization_id = public.current_user_org_id()
    )
);

CREATE POLICY "cerfa_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'cerfa-documents'
    AND public.is_admin()
    AND (
        (storage.foldername(name))[1] = (public.current_user_org_id())::text
        OR (
            (storage.foldername(name))[1] = 'cerfa'
            AND EXISTS (
                SELECT 1 FROM public.cerfa_documents cd
                WHERE cd.file_path = objects.name
                  AND cd.organization_id = public.current_user_org_id()
            )
        )
    )
);

-- ============================================================
-- 8. QUOTE-ATTACHMENTS : membres de l'organisation ({org_id}/...)
-- ============================================================
CREATE POLICY "quote_attachments_org_all" ON storage.objects
FOR ALL TO authenticated
USING (
    bucket_id = 'quote-attachments'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
) WITH CHECK (
    bucket_id = 'quote-attachments'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
);

SELECT 'SUCCESS - hardening 2/3 (storage) applied' AS result;
