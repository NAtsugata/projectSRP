-- ============================================================
-- ARCHITECTURE DE STOCKAGE : registre enrichi, quotas par organisation,
-- contrôle à l'upload, cycle de vie, justificatifs de dépenses.
-- Complète sql/2026_07_storage_reorganization.sql (convention {org}/...).
-- Appliquée en production le 17/09/2026 (migration
-- "storage_architecture_quotas_lifecycle"). Voir docs/ARCHITECTURE_STOCKAGE.md
-- ============================================================

-- A. Registre : taille et type MIME (source des quotas)
ALTER TABLE public.storage_registry ADD COLUMN IF NOT EXISTS size_bytes bigint NOT NULL DEFAULT 0;
ALTER TABLE public.storage_registry ADD COLUMN IF NOT EXISTS mime_type text;
UPDATE public.storage_registry r
SET size_bytes = coalesce((o.metadata->>'size')::bigint, 0),
    mime_type  = o.metadata->>'mimetype'
FROM storage.objects o
WHERE o.bucket_id = r.bucket_id AND o.name = r.object_name;

-- B. Organisations : quota (nullable = défaut du plan) et usage (compteur)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;
UPDATE public.organizations o
SET storage_used_bytes = coalesce((SELECT sum(r.size_bytes) FROM public.storage_registry r WHERE r.organization_id = o.id), 0);

CREATE OR REPLACE FUNCTION public.org_storage_quota_bytes(p_org uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(o.storage_quota_bytes,
    CASE o.plan WHEN 'enterprise' THEN 100 * 1024::bigint * 1024 * 1024
                WHEN 'premium'    THEN  25 * 1024::bigint * 1024 * 1024
                ELSE                     5 * 1024::bigint * 1024 * 1024 END)
  FROM public.organizations o WHERE o.id = p_org;
$$;
REVOKE ALL ON FUNCTION public.org_storage_quota_bytes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_storage_quota_bytes(uuid) TO authenticated;

-- C. Compteur d'usage maintenu par trigger sur le registre
CREATE OR REPLACE FUNCTION public.storage_registry_usage_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.organization_id IS NOT NULL THEN
    UPDATE public.organizations
    SET storage_used_bytes = greatest(0, storage_used_bytes - OLD.size_bytes)
    WHERE id = OLD.organization_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.organization_id IS NOT NULL THEN
    UPDATE public.organizations
    SET storage_used_bytes = storage_used_bytes + NEW.size_bytes
    WHERE id = NEW.organization_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.storage_registry_usage_sync() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_storage_registry_usage ON public.storage_registry;
CREATE TRIGGER trg_storage_registry_usage
  AFTER INSERT OR DELETE OR UPDATE OF size_bytes, organization_id ON public.storage_registry
  FOR EACH ROW EXECUTE FUNCTION public.storage_registry_usage_sync();

-- D. Synchronisation registre <- storage.objects : capter taille & MIME
CREATE OR REPLACE FUNCTION public.sync_storage_registry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.storage_registry WHERE bucket_id = OLD.bucket_id AND object_name = OLD.name;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND (OLD.name <> NEW.name OR OLD.bucket_id <> NEW.bucket_id) THEN
        DELETE FROM public.storage_registry WHERE bucket_id = OLD.bucket_id AND object_name = OLD.name;
    END IF;
    INSERT INTO public.storage_registry
        (bucket_id, object_name, organization_id, user_id, intervention_id, category, size_bytes, mime_type)
    SELECT NEW.bucket_id, NEW.name,
           COALESCE(c.organization_id, public.current_user_org_id()),
           c.user_id, c.intervention_id, c.category,
           coalesce((NEW.metadata->>'size')::bigint, 0), NEW.metadata->>'mimetype'
    FROM public.storage_classify(NEW.bucket_id, NEW.name) c
    ON CONFLICT (bucket_id, object_name) DO UPDATE
        SET organization_id = COALESCE(EXCLUDED.organization_id, public.storage_registry.organization_id),
            user_id         = COALESCE(EXCLUDED.user_id, public.storage_registry.user_id),
            intervention_id = COALESCE(EXCLUDED.intervention_id, public.storage_registry.intervention_id),
            category        = COALESCE(EXCLUDED.category, public.storage_registry.category),
            size_bytes      = CASE WHEN EXCLUDED.size_bytes > 0 THEN EXCLUDED.size_bytes ELSE public.storage_registry.size_bytes END,
            mime_type       = COALESCE(EXCLUDED.mime_type, public.storage_registry.mime_type);
    RETURN NEW;
EXCEPTION WHEN others THEN
    RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_storage_registry ON storage.objects;
CREATE TRIGGER trg_sync_storage_registry
    AFTER INSERT OR DELETE OR UPDATE OF name, bucket_id, metadata ON storage.objects
    FOR EACH ROW EXECUTE FUNCTION public.sync_storage_registry();

-- E. Quota bloquant à l'upload (seule cause de blocage : quota dépassé ;
--    toute erreur interne laisse passer l'upload)
CREATE OR REPLACE FUNCTION public.enforce_storage_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_size bigint := 0; v_used bigint := 0; v_quota bigint;
BEGIN
  BEGIN
    SELECT c.organization_id INTO v_org FROM public.storage_classify(NEW.bucket_id, NEW.name) c;
    IF v_org IS NULL THEN v_org := public.current_user_org_id(); END IF;
    IF v_org IS NULL THEN RETURN NEW; END IF;
    v_size  := coalesce((NEW.metadata->>'size')::bigint, 0);
    SELECT storage_used_bytes INTO v_used FROM public.organizations WHERE id = v_org;
    v_quota := public.org_storage_quota_bytes(v_org);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF v_quota IS NOT NULL AND coalesce(v_used, 0) + v_size > v_quota THEN
    RAISE EXCEPTION 'Quota de stockage atteint pour cette organisation (code: storage_quota_exceeded)';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_storage_quota() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enforce_storage_quota ON storage.objects;
CREATE TRIGGER trg_enforce_storage_quota
  BEFORE INSERT ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota();

-- F. Usage pour l'interface (organisation courante)
CREATE OR REPLACE FUNCTION public.org_storage_usage()
RETURNS TABLE(used_bytes bigint, quota_bytes bigint, files bigint, by_category jsonb, legacy_expenses bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.storage_used_bytes,
         public.org_storage_quota_bytes(o.id),
         (SELECT count(*) FROM public.storage_registry r WHERE r.organization_id = o.id),
         (SELECT coalesce(jsonb_object_agg(s.cat, s.b), '{}'::jsonb)
            FROM (SELECT coalesce(r.category, 'autre') AS cat, sum(r.size_bytes) AS b
                  FROM public.storage_registry r WHERE r.organization_id = o.id GROUP BY 1) s),
         (SELECT count(*) FROM public.expenses e
           WHERE e.organization_id = o.id AND e.receipts_count > 0
             AND NOT EXISTS (SELECT 1 FROM public.expense_receipts er
                             WHERE er.expense_id = e.id AND er.storage_path IS NOT NULL))
  FROM public.organizations o WHERE o.id = public.current_user_org_id();
$$;
REVOKE ALL ON FUNCTION public.org_storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_storage_usage() TO authenticated;

-- G. Fichiers orphelins (admin) : entité parente supprimée
CREATE OR REPLACE FUNCTION public.storage_orphans()
RETURNS TABLE(bucket_id text, object_name text, category text, size_bytes bigint, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    SELECT r.*, storage.foldername(r.object_name) AS parts
    FROM public.storage_registry r
    WHERE r.organization_id = public.current_user_org_id() AND public.is_admin()
  )
  SELECT r.bucket_id, r.object_name, r.category, r.size_bytes, 'dépense supprimée'
  FROM r WHERE r.parts[2] = 'employees' AND r.parts[4] = 'expenses'
    AND public.uuid_or_null(r.parts[5]) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = public.uuid_or_null(r.parts[5]))
  UNION ALL
  SELECT r.bucket_id, r.object_name, r.category, r.size_bytes, 'intervention supprimée'
  FROM r WHERE r.intervention_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.interventions i WHERE i.id = r.intervention_id)
  UNION ALL
  SELECT r.bucket_id, r.object_name, r.category, r.size_bytes, 'chantier supprimé'
  FROM r WHERE r.parts[2] = 'chantiers' AND public.uuid_or_null(r.parts[3]) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.chantiers c WHERE c.id = public.uuid_or_null(r.parts[3]));
$$;
REVOKE ALL ON FUNCTION public.storage_orphans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_orphans() TO authenticated;

-- H. Justificatifs : sauvegarde des anciens base64 (jamais purgée automatiquement),
--    insertion des métadonnées par l'admin (migration), audit allégé
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipts_legacy_base64 jsonb;
DROP POLICY IF EXISTS receipt_insert ON public.expense_receipts;
CREATE POLICY receipt_insert ON public.expense_receipts FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_org_id()
              AND (user_id = (SELECT auth.uid()) OR public.is_admin()));

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_action text; v_record_id text; v_user_name text; v_org_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action := 'delete'; v_record_id := OLD.id::text; v_org_id := OLD.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_record_id := NEW.id::text; v_org_id := NEW.organization_id;
  ELSE
    v_action := 'create'; v_record_id := NEW.id::text; v_org_id := NEW.organization_id;
  END IF;
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = (SELECT auth.uid());
  INSERT INTO public.audit_logs (organization_id, user_id, user_name, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_org_id, (SELECT auth.uid()), v_user_name, v_action, TG_TABLE_NAME, v_record_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) - 'receipts' - 'receipts_legacy_base64' ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) - 'receipts' - 'receipts_legacy_base64' ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- I. Limites des buckets qui n'en avaient pas
UPDATE storage.buckets SET file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
  WHERE id = 'cerfa-documents';
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'chantier-docs';   -- 50 Mo (types validés côté client)
UPDATE storage.buckets SET file_size_limit = 26214400 WHERE id = 'chantier-media';  -- 25 Mo
UPDATE storage.buckets SET file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/svg+xml','image/webp']
  WHERE id = 'signature-files';
