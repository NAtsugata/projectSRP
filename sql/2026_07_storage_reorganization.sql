-- ============================================================
-- RÉORGANISATION DU STOCKAGE PAR ENTREPRISE / INTERVENTION / EMPLOYÉ
-- ============================================================
-- Objectifs :
--   1. Chaque fichier est catalogué dans un REGISTRE central
--      (entreprise → intervention → employé → catégorie), avec
--      l'organisation FIGÉE au moment du rattachement.
--      → Les fichiers restent visibles par l'entreprise même si
--        l'employé est licencié, désactivé ou supprimé.
--   2. Nouvelle arborescence canonique pour tous les futurs uploads :
--        {org_id}/interventions/{intervention_id}/...
--        {org_id}/employees/{user_id}/{vault|scans|signatures|expenses|ir-shower}/...
--        {org_id}/cerfa/...   {org_id}/quotes/{quote_id}/...
--   3. RIEN N'EST DÉPLACÉ NI SUPPRIMÉ : les fichiers existants restent
--      à leur emplacement (les chemins sont référencés partout en base,
--      un déplacement physique casserait ces références). Le registre
--      les classe logiquement.
--   4. RPC deactivate_employee / reactivate_employee : licenciement
--      propre (compte bloqué, données 100% conservées).
--   5. FK CASCADE → SET NULL sur l'historique lié aux profils
--      (absences, congés, partages de coffre) : supprimer un profil
--      n'efface plus son historique.
-- ============================================================

-- ============================================================
-- 1. REGISTRE CENTRAL DES FICHIERS
--    (pas de FK sur user_id / intervention_id : les entrées doivent
--     SURVIVRE à la suppression d'un profil ou d'une intervention)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.storage_registry (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bucket_id text NOT NULL,
    object_name text NOT NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id uuid,            -- employé lié (sans FK, volontairement)
    intervention_id bigint,  -- intervention liée (sans FK, volontairement)
    category text,           -- vault, scans, signatures, expenses, ir-shower,
                             -- interventions, photos, cerfa, quotes, assets...
    registered_at timestamp with time zone DEFAULT now(),
    UNIQUE (bucket_id, object_name)
);

CREATE INDEX IF NOT EXISTS idx_storage_registry_org ON public.storage_registry(organization_id);
CREATE INDEX IF NOT EXISTS idx_storage_registry_user ON public.storage_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_registry_intervention ON public.storage_registry(intervention_id);

ALTER TABLE public.storage_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registry_select" ON public.storage_registry;
CREATE POLICY "registry_select" ON public.storage_registry
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    OR public.current_user_is_super_admin()
);
-- Écritures uniquement via triggers/fonctions SECURITY DEFINER (aucune policy d'écriture)

GRANT SELECT ON public.storage_registry TO authenticated;

-- ============================================================
-- 2. CLASSIFICATION D'UN CHEMIN (schéma canonique + tous les legacy)
-- ============================================================
CREATE OR REPLACE FUNCTION public.storage_classify(p_bucket text, p_name text)
RETURNS TABLE(organization_id uuid, user_id uuid, intervention_id bigint, category text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    parts text[] := storage.foldername(p_name);
    p1 uuid;
    v_org uuid; v_user uuid; v_int bigint; v_cat text;
BEGIN
    p1 := public.uuid_or_null(parts[1]);

    IF p1 IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p1) THEN
        -- Schéma canonique / chemins déjà préfixés par l'organisation
        v_org := p1;
        IF parts[2] = 'interventions' THEN
            v_cat := 'interventions';
            IF parts[3] ~ '^[0-9]+$' THEN v_int := parts[3]::bigint; END IF;
        ELSIF parts[2] = 'employees' THEN
            v_user := public.uuid_or_null(parts[3]);
            v_cat := COALESCE(parts[4], 'employees');
        ELSIF parts[2] IN ('cerfa', 'quotes', 'assets') THEN
            v_cat := parts[2];
        ELSE
            v_user := public.uuid_or_null(parts[2]);
            v_cat := CASE p_bucket
                        WHEN 'intervention-photos' THEN 'photos'
                        WHEN 'organization-assets' THEN 'assets'
                        WHEN 'quote-attachments'   THEN 'quotes'
                        WHEN 'cerfa-documents'     THEN 'cerfa'
                        ELSE COALESCE(parts[2], p_bucket) END;
        END IF;

    ELSIF p1 IS NOT NULL THEN
        -- Ancien schéma : premier dossier = employé
        v_user := p1;
        v_org := public.profile_org(p1);
        v_cat := CASE p_bucket
                    WHEN 'vault-files'       THEN 'vault'
                    WHEN 'expense-receipts'  THEN 'expenses'
                    WHEN 'signature-files'   THEN 'signatures'
                    WHEN 'intervention-files' THEN COALESCE(parts[2], 'files')
                    ELSE p_bucket END;

    ELSE
        -- Anciens préfixes texte
        IF p_bucket = 'vault-files' AND parts[1] IN ('vault', 'scanned-docs') THEN
            v_user := public.uuid_or_null(parts[2]);
            v_org := public.profile_org(v_user);
            v_cat := CASE parts[1] WHEN 'vault' THEN 'vault' ELSE 'scans' END;
        ELSIF p_bucket = 'intervention-files' AND parts[1] ~ '^[0-9]+$' THEN
            v_int := parts[1]::bigint;
            SELECT i.organization_id INTO v_org FROM public.interventions i WHERE i.id = v_int;
            v_cat := 'interventions';
        ELSIF p_bucket = 'cerfa-documents' AND parts[1] = 'cerfa' THEN
            SELECT cd.organization_id INTO v_org
            FROM public.cerfa_documents cd WHERE cd.file_path = p_name LIMIT 1;
            v_cat := 'cerfa';
        END IF;
    END IF;

    RETURN QUERY SELECT v_org, v_user, v_int, v_cat;
END;
$$;

-- Lecture registre avec repli sur classification à la volée
CREATE OR REPLACE FUNCTION public.registry_lookup(p_bucket text, p_name text)
RETURNS TABLE(organization_id uuid, user_id uuid, intervention_id bigint, category text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT r.organization_id, r.user_id, r.intervention_id, r.category
    FROM public.storage_registry r
    WHERE r.bucket_id = p_bucket AND r.object_name = p_name
    UNION ALL
    SELECT c.organization_id, c.user_id, c.intervention_id, c.category
    FROM public.storage_classify(p_bucket, p_name) c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.storage_registry r2
        WHERE r2.bucket_id = p_bucket AND r2.object_name = p_name
    );
$$;

REVOKE ALL ON FUNCTION public.storage_classify(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_classify(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.registry_lookup(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registry_lookup(text, text) TO authenticated;

-- ============================================================
-- 3. BACKFILL : cataloguer TOUS les fichiers existants MAINTENANT
--    (fige l'organisation pendant que les profils existent encore ;
--     les fichiers legacy non résolubles sont rattachés à l'org 'default',
--     cohérent avec la migration multi-tenant d'origine)
-- ============================================================
INSERT INTO public.storage_registry (bucket_id, object_name, organization_id, user_id, intervention_id, category)
SELECT o.bucket_id, o.name,
       COALESCE(c.organization_id, (SELECT id FROM public.organizations WHERE slug = 'default')),
       c.user_id, c.intervention_id, c.category
FROM storage.objects o
CROSS JOIN LATERAL public.storage_classify(o.bucket_id, o.name) c
ON CONFLICT (bucket_id, object_name) DO NOTHING;

-- ============================================================
-- 4. SYNCHRONISATION AUTOMATIQUE (trigger sur storage.objects)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_storage_registry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.storage_registry
        WHERE bucket_id = OLD.bucket_id AND object_name = OLD.name;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND (OLD.name <> NEW.name OR OLD.bucket_id <> NEW.bucket_id) THEN
        DELETE FROM public.storage_registry
        WHERE bucket_id = OLD.bucket_id AND object_name = OLD.name;
    END IF;

    INSERT INTO public.storage_registry (bucket_id, object_name, organization_id, user_id, intervention_id, category)
    SELECT NEW.bucket_id, NEW.name,
           COALESCE(c.organization_id, public.current_user_org_id()),
           c.user_id, c.intervention_id, c.category
    FROM public.storage_classify(NEW.bucket_id, NEW.name) c
    ON CONFLICT (bucket_id, object_name) DO UPDATE
        SET organization_id = COALESCE(EXCLUDED.organization_id, public.storage_registry.organization_id),
            user_id         = COALESCE(EXCLUDED.user_id, public.storage_registry.user_id),
            intervention_id = COALESCE(EXCLUDED.intervention_id, public.storage_registry.intervention_id),
            category        = COALESCE(EXCLUDED.category, public.storage_registry.category);

    RETURN NEW;
EXCEPTION WHEN others THEN
    -- Le registre ne doit JAMAIS bloquer une opération fichier
    RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_storage_registry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_storage_registry ON storage.objects;
CREATE TRIGGER trg_sync_storage_registry
    AFTER INSERT OR DELETE OR UPDATE OF name, bucket_id ON storage.objects
    FOR EACH ROW EXECUTE FUNCTION public.sync_storage_registry();

-- ============================================================
-- 5. POLITIQUES STORAGE basées sur le registre
--    (s'AJOUTENT aux politiques existantes — OR logique ;
--     l'accès de l'entreprise ne dépend plus de l'existence du profil)
-- ============================================================

-- Lecture : membre = ses fichiers + fichiers "entreprise" ; admin = tout (dans son org)
DROP POLICY IF EXISTS "org_registry_select" ON storage.objects;
CREATE POLICY "org_registry_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id IN ('vault-files','intervention-files','expense-receipts','signature-files',
                  'intervention-photos','cerfa-documents','quote-attachments','organization-assets')
    AND EXISTS (
        SELECT 1 FROM public.registry_lookup(objects.bucket_id, objects.name) r
        WHERE r.organization_id = public.current_user_org_id()
          AND (
              public.is_admin()
              OR r.user_id = (SELECT auth.uid())
              OR COALESCE(r.category, '') NOT IN ('vault','scans','expenses','signatures','ir-shower')
          )
    )
);

-- Mise à jour / suppression : propriétaire ou admin de l'organisation
DROP POLICY IF EXISTS "org_registry_update" ON storage.objects;
CREATE POLICY "org_registry_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id IN ('vault-files','intervention-files','expense-receipts','signature-files',
                  'intervention-photos','cerfa-documents','quote-attachments','organization-assets')
    AND EXISTS (
        SELECT 1 FROM public.registry_lookup(objects.bucket_id, objects.name) r
        WHERE r.organization_id = public.current_user_org_id()
          AND (public.is_admin() OR r.user_id = (SELECT auth.uid()))
    )
);

DROP POLICY IF EXISTS "org_registry_delete" ON storage.objects;
CREATE POLICY "org_registry_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id IN ('vault-files','intervention-files','expense-receipts','signature-files',
                  'intervention-photos','cerfa-documents','quote-attachments','organization-assets')
    AND EXISTS (
        SELECT 1 FROM public.registry_lookup(objects.bucket_id, objects.name) r
        WHERE r.organization_id = public.current_user_org_id()
          AND (public.is_admin() OR r.user_id = (SELECT auth.uid()))
    )
);

-- Insertion : schéma canonique {org}/...
DROP POLICY IF EXISTS "org_canonical_insert" ON storage.objects;
CREATE POLICY "org_canonical_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id IN ('vault-files','intervention-files','expense-receipts','signature-files',
                  'intervention-photos','cerfa-documents','quote-attachments','organization-assets')
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
    AND (
        (storage.foldername(name))[2] = 'interventions'
        OR (
            (storage.foldername(name))[2] = 'employees'
            AND ((storage.foldername(name))[3] = (SELECT auth.uid())::text OR public.is_admin())
        )
        OR (storage.foldername(name))[2] IN ('cerfa', 'quotes', 'assets')
    )
);

-- ============================================================
-- 6. FK : l'historique survit à la suppression d'un profil
--    (CASCADE → SET NULL sur les tables d'historique)
-- ============================================================
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tc.constraint_name, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
             ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = 'public'
        JOIN information_schema.referential_constraints rc
             ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND rc.delete_rule = 'CASCADE'
          AND (tc.table_name, kcu.column_name) IN (
              ('employee_absences', 'employee_id'),
              ('leave_requests', 'user_id'),
              ('shared_vault_access', 'shared_with_user_id')
          )
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.table_name, r.column_name);
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
                       r.table_name, r.constraint_name, r.column_name);
        RAISE NOTICE 'FK % sur %.% : CASCADE -> SET NULL', r.constraint_name, r.table_name, r.column_name;
    END LOOP;
END $$;

-- ============================================================
-- 7. LICENCIEMENT PROPRE : désactiver sans rien perdre
-- ============================================================
CREATE OR REPLACE FUNCTION public.deactivate_employee(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Réservé aux administrateurs (code: not_admin)';
    END IF;
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Impossible de désactiver son propre compte (code: self_deactivation)';
    END IF;
    IF public.profile_org(p_user_id) IS DISTINCT FROM public.current_user_org_id() THEN
        RAISE EXCEPTION 'Cet utilisateur n''appartient pas à votre organisation (code: wrong_org)';
    END IF;

    PERFORM set_config('app.org_management', 'on', true);

    -- Le profil et TOUTES ses données restent : seul l'accès est coupé
    UPDATE public.profiles
    SET employee_status = 'inactive', is_admin = false
    WHERE id = p_user_id;

    UPDATE auth.users SET banned_until = 'infinity' WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_employee(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Réservé aux administrateurs (code: not_admin)';
    END IF;
    IF public.profile_org(p_user_id) IS DISTINCT FROM public.current_user_org_id() THEN
        RAISE EXCEPTION 'Cet utilisateur n''appartient pas à votre organisation (code: wrong_org)';
    END IF;

    PERFORM set_config('app.org_management', 'on', true);

    UPDATE public.profiles SET employee_status = 'active' WHERE id = p_user_id;
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_employee(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reactivate_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_employee(uuid) TO authenticated;

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'SUCCESS - storage reorganization applied' AS result;
SELECT count(*) AS objets_storage FROM storage.objects;
SELECT count(*) AS entrees_registre FROM public.storage_registry;
