-- ============================================================
-- CHANTIERS DOCUMENTS V2 : versioning, obsolescence, notifications
-- de dépôt, log de consultation, assignation par lot à la création.
-- ============================================================
-- 1. Versioning : redéposer un plan corrigé crée une v2 rattachée au
--    même groupe ; les versions précédentes passent automatiquement en
--    « obsolète » (jamais d'écrasement : nouveau fichier, ancien conservé).
-- 2. Statut obsolète manuel : marquer un document remplacé sans le
--    supprimer (traçabilité / preuve en cas de litige).
-- 3. Notification in-app : au dépôt d'un document sur un lot, les
--    membres du lot sont prévenus (tout le chantier si document global).
-- 4. Log de consultation : qui a ouvert quel document, et quand.
-- 5. create_chantier_with_lots v2 : chaque lot peut être assigné à un
--    intervenant dès la création.
-- ============================================================

-- ============================================================
-- 1. VERSIONING + STATUT
-- ============================================================
ALTER TABLE public.chantier_documents
    ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS document_group_id uuid,
    ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'actif'
        CHECK (status IN ('actif','obsolete'));

UPDATE public.chantier_documents SET document_group_id = id WHERE document_group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cdocs_group ON public.chantier_documents(document_group_id);

-- Avant insertion : groupe par défaut, numéro de version automatique,
-- cohérence du groupe (même chantier).
CREATE OR REPLACE FUNCTION public.cdocs_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.document_group_id IS NULL THEN
        NEW.document_group_id := NEW.id;
        NEW.version := 1;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.chantier_documents
            WHERE document_group_id = NEW.document_group_id
              AND chantier_id = NEW.chantier_id
        ) THEN
            RAISE EXCEPTION 'Groupe de document invalide (code: invalid_group)';
        END IF;
        SELECT COALESCE(MAX(version),0) + 1 INTO NEW.version
        FROM public.chantier_documents
        WHERE document_group_id = NEW.document_group_id;
    END IF;
    NEW.is_current := true;
    NEW.status := 'actif';
    RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cdocs_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cdocs_before_insert ON public.chantier_documents;
CREATE TRIGGER trg_cdocs_before_insert BEFORE INSERT ON public.chantier_documents
FOR EACH ROW EXECUTE FUNCTION public.cdocs_before_insert();

-- Après insertion : les versions précédentes du groupe deviennent
-- obsolètes, puis notification aux entreprises concernées.
CREATE OR REPLACE FUNCTION public.cdocs_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_chantier_name text; v_lot_name text; v_title text; v_body text;
BEGIN
    UPDATE public.chantier_documents
    SET is_current = false, status = 'obsolete'
    WHERE document_group_id = NEW.document_group_id
      AND id <> NEW.id AND is_current;

    SELECT name INTO v_chantier_name FROM public.chantiers WHERE id = NEW.chantier_id;
    IF NEW.lot_id IS NOT NULL THEN
        SELECT name INTO v_lot_name FROM public.chantier_lots WHERE id = NEW.lot_id;
    END IF;

    v_title := CASE WHEN NEW.version > 1
        THEN 'Document mis à jour (v' || NEW.version || ') : ' || NEW.title
        ELSE 'Nouveau document : ' || NEW.title END;
    v_body := CASE WHEN NEW.version > 1
        THEN 'Une nouvelle version du document « ' || NEW.title || ' » remplace la précédente sur le chantier ' || COALESCE(v_chantier_name,'')
        ELSE 'Le document « ' || NEW.title || ' » a été déposé sur le chantier ' || COALESCE(v_chantier_name,'') END
        || COALESCE(' — lot ' || v_lot_name, '') || '.';

    INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
    SELECT NEW.organization_id, m.user_id, 'chantier_document', v_title, v_body,
           jsonb_build_object('chantier_id', NEW.chantier_id, 'lot_id', NEW.lot_id,
                              'document_id', NEW.id, 'version', NEW.version)
    FROM (
        SELECT DISTINCT user_id FROM public.chantier_lot_members
        WHERE chantier_id = NEW.chantier_id
          AND (NEW.lot_id IS NULL OR lot_id = NEW.lot_id)
          AND user_id IS DISTINCT FROM auth.uid()
    ) m;

    RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cdocs_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cdocs_after_insert ON public.chantier_documents;
CREATE TRIGGER trg_cdocs_after_insert AFTER INSERT ON public.chantier_documents
FOR EACH ROW EXECUTE FUNCTION public.cdocs_after_insert();

-- Contrainte notifications : nouveau type 'chantier_document'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
CHECK (type = ANY (ARRAY['intervention_assigned','expense_approved','expense_rejected',
    'leave_approved','leave_rejected','intervention_reminder','cerfa_expiring',
    'new_client','chantier_alerte','chantier_document']));

-- Audit affiné : obsolescence / réactivation distinguées, version tracée.
CREATE OR REPLACE FUNCTION public.audit_chantier_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record := COALESCE(NEW, OLD); v_type text;
BEGIN
    v_type := CASE TG_OP
        WHEN 'INSERT' THEN 'document_ajoute'
        WHEN 'DELETE' THEN 'document_supprime'
        ELSE CASE
            WHEN OLD.status = 'actif' AND NEW.status = 'obsolete' THEN 'document_obsolete'
            WHEN OLD.status = 'obsolete' AND NEW.status = 'actif' THEN 'document_reactive'
            ELSE 'document_modifie' END
        END;
    PERFORM public.log_chantier_event(
        r.organization_id, r.chantier_id, r.lot_id, NULL, v_type,
        jsonb_build_object('titre', r.title, 'categorie', r.category,
                           'fichier', r.file_name, 'version', r.version)
    );
    RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE ALL ON FUNCTION public.audit_chantier_document() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. LOG DE CONSULTATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_document_view(p_doc uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    SELECT * INTO d FROM public.chantier_documents
    WHERE id = p_doc
      AND organization_id = public.current_user_org_id()
      AND (public.is_admin()
           OR (lot_id IS NULL AND public.is_chantier_member(chantier_id))
           OR (lot_id IS NOT NULL AND public.is_lot_member(lot_id)));
    IF d.id IS NULL THEN
        RAISE EXCEPTION 'Document introuvable (code: not_found)';
    END IF;
    PERFORM public.log_chantier_event(
        d.organization_id, d.chantier_id, d.lot_id, NULL, 'document_consulte',
        jsonb_build_object('titre', d.title, 'categorie', d.category, 'version', d.version)
    );
END; $$;
REVOKE ALL ON FUNCTION public.log_document_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_document_view(uuid) TO authenticated;

-- ============================================================
-- 3. CRÉATION AVEC ASSIGNATION PAR LOT
-- ============================================================
-- p_lots : tableau JSON [{"name": "Plomberie", "member_id": "uuid|null"}, ...]
-- (accepte aussi un tableau de chaînes pour compatibilité).
DROP FUNCTION IF EXISTS public.create_chantier_with_lots(text,text,text,date,date,text[]);

CREATE OR REPLACE FUNCTION public.create_chantier_with_lots(
    p_name text,
    p_client text DEFAULT NULL,
    p_address text DEFAULT NULL,
    p_start date DEFAULT NULL,
    p_end date DEFAULT NULL,
    p_lots jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_org uuid := public.current_user_org_id();
    v_id uuid;
    v_lot jsonb;
    v_lot_id uuid;
    v_lot_name text;
    v_member uuid;
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

    IF p_lots IS NOT NULL AND jsonb_typeof(p_lots) = 'array' THEN
        FOR v_lot IN SELECT * FROM jsonb_array_elements(p_lots) LOOP
            v_lot_name := btrim(COALESCE(
                CASE WHEN jsonb_typeof(v_lot) = 'string' THEN v_lot #>> '{}' ELSE v_lot->>'name' END, ''));
            CONTINUE WHEN v_lot_name = '';

            INSERT INTO public.chantier_lots (chantier_id, organization_id, name, sort_order)
            VALUES (v_id, v_org, v_lot_name, v_i)
            RETURNING id INTO v_lot_id;
            v_i := v_i + 1;

            v_member := NULL;
            IF jsonb_typeof(v_lot) = 'object' AND COALESCE(v_lot->>'member_id','') <> '' THEN
                BEGIN
                    v_member := (v_lot->>'member_id')::uuid;
                EXCEPTION WHEN invalid_text_representation THEN
                    v_member := NULL;
                END;
            END IF;
            IF v_member IS NOT NULL
               AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_member AND organization_id = v_org) THEN
                INSERT INTO public.chantier_lot_members (lot_id, chantier_id, organization_id, user_id)
                VALUES (v_lot_id, v_id, v_org, v_member)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.create_chantier_with_lots(text,text,text,date,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chantier_with_lots(text,text,text,date,date,jsonb) TO authenticated;

-- ============================================================
-- 4. JOURNAL : HISTORIQUE SANS FK
-- ============================================================
-- Le journal d'audit est un historique dénormalisé et inaltérable :
-- il doit survivre à la suppression d'un chantier en conservant les
-- identifiants d'origine. La FK empêchait (1) la suppression d'un
-- chantier — l'audit des suppressions en cascade insère des événements
-- alors que le chantier est déjà supprimé — et (2) aurait mis les ids
-- à NULL, effaçant la traçabilité.
ALTER TABLE public.chantier_events DROP CONSTRAINT IF EXISTS chantier_events_chantier_id_fkey;

SELECT 'SUCCESS - documents v2 (versions, obsolescence, notifications, consultation)' AS result;
