-- ============================================================
-- CHANTIERS : simplification + documents MOE + lots prédéfinis
-- ============================================================
-- 1. create_chantier_with_lots : créer un chantier ET ses lots en un
--    seul appel (gros chantier = lots prédéfinis en 1 clic).
-- 2. chantier_documents : documents de référence déposés par le MOE
--    (plans, plan d'exécution, CCTP, permis...). Lisibles par les
--    membres du chantier ; gérés par le MOE.
-- ============================================================

-- ============================================================
-- 1. DOCUMENTS DE RÉFÉRENCE (MOE)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chantier_documents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
    lot_id uuid REFERENCES public.chantier_lots(id) ON DELETE SET NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    category text NOT NULL DEFAULT 'autre'
        CHECK (category IN ('plan','plan_execution','cctp','permis','dpgf','planning','autre')),
    title text NOT NULL,
    file_path text NOT NULL,
    file_name text,
    uploaded_by uuid,
    uploader_name text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdocs_chantier ON public.chantier_documents(chantier_id);
CREATE INDEX IF NOT EXISTS idx_cdocs_lot ON public.chantier_documents(lot_id);
CREATE INDEX IF NOT EXISTS idx_cdocs_org ON public.chantier_documents(organization_id);

ALTER TABLE public.chantier_documents ENABLE ROW LEVEL SECURITY;

-- MOE gère ; membres du chantier lisent (et, si le doc est rattaché à un lot,
-- uniquement les membres de ce lot).
CREATE POLICY cdocs_select ON public.chantier_documents FOR SELECT TO authenticated
USING (
    organization_id = public.current_user_org_id()
    AND (
        public.is_admin()
        OR (lot_id IS NULL AND public.is_chantier_member(chantier_id))
        OR (lot_id IS NOT NULL AND public.is_lot_member(lot_id))
    )
);
CREATE POLICY cdocs_insert ON public.chantier_documents FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin()
            AND uploaded_by = (SELECT auth.uid()));
CREATE POLICY cdocs_update ON public.chantier_documents FOR UPDATE TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin())
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());
CREATE POLICY cdocs_delete ON public.chantier_documents FOR DELETE TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin());

-- Audit : dépôt/suppression de document
CREATE OR REPLACE FUNCTION public.audit_chantier_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record := COALESCE(NEW, OLD); v_type text;
BEGIN
    v_type := CASE TG_OP WHEN 'INSERT' THEN 'document_ajoute'
                         WHEN 'DELETE' THEN 'document_supprime'
                         ELSE 'document_modifie' END;
    PERFORM public.log_chantier_event(
        r.organization_id, r.chantier_id, r.lot_id, NULL, v_type,
        jsonb_build_object('titre', r.title, 'categorie', r.category, 'fichier', r.file_name)
    );
    RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE ALL ON FUNCTION public.audit_chantier_document() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_cdocs ON public.chantier_documents;
CREATE TRIGGER trg_audit_cdocs AFTER INSERT OR UPDATE OR DELETE ON public.chantier_documents
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_document();

-- Stockage documents MOE : bucket privé.
-- Chemin : {org}/chantiers/{chantier}/documents/...
INSERT INTO storage.buckets (id, name, public)
VALUES ('chantier-docs', 'chantier-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chantier_docs_insert" ON storage.objects;
CREATE POLICY "chantier_docs_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'chantier-docs'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
    AND (storage.foldername(name))[2] = 'chantiers'
    AND public.is_admin()
);
DROP POLICY IF EXISTS "chantier_docs_select" ON storage.objects;
CREATE POLICY "chantier_docs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'chantier-docs'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
    AND (
        public.is_admin()
        OR public.is_chantier_member(public.uuid_or_null((storage.foldername(name))[3]))
    )
);
DROP POLICY IF EXISTS "chantier_docs_delete" ON storage.objects;
CREATE POLICY "chantier_docs_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'chantier-docs'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
    AND public.is_admin()
);

-- ============================================================
-- 2. CRÉATION EN UN CLIC : chantier + lots prédéfinis
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_chantier_with_lots(
    p_name text,
    p_client text DEFAULT NULL,
    p_address text DEFAULT NULL,
    p_start date DEFAULT NULL,
    p_end date DEFAULT NULL,
    p_lots text[] DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_org uuid := public.current_user_org_id();
    v_id uuid;
    v_lot text;
    v_i int := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Réservé à la maîtrise d''œuvre (code: moe_only)';
    END IF;
    IF COALESCE(btrim(p_name),'') = '' THEN
        RAISE EXCEPTION 'Nom du chantier requis (code: invalid_input)';
    END IF;

    INSERT INTO public.chantiers (organization_id, name, client_name, address, start_date, end_date, created_by, status)
    VALUES (v_org, btrim(p_name), NULLIF(btrim(COALESCE(p_client,'')),''), NULLIF(btrim(COALESCE(p_address,'')),''),
            p_start, p_end, auth.uid(), 'en_cours')
    RETURNING id INTO v_id;

    IF p_lots IS NOT NULL THEN
        FOREACH v_lot IN ARRAY p_lots LOOP
            IF btrim(COALESCE(v_lot,'')) <> '' THEN
                INSERT INTO public.chantier_lots (chantier_id, organization_id, name, sort_order)
                VALUES (v_id, v_org, btrim(v_lot), v_i);
                v_i := v_i + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.create_chantier_with_lots(text,text,text,date,date,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chantier_with_lots(text,text,text,date,date,text[]) TO authenticated;

SELECT 'SUCCESS - documents + création en un clic' AS result;
