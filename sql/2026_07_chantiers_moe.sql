-- ============================================================
-- MODULE SUIVI DE CHANTIER (MOE) — distinct des interventions
-- ============================================================
-- 1. Hiérarchie : le MOE (admin de l'organisation) crée les chantiers,
--    zones et lots, et assigne les entreprises/employés. Les membres
--    n'accèdent qu'aux lots/zones qui leur sont assignés (RLS).
-- 2. Visibilité : avancement par lot/zone (status + progress), journal
--    d'audit inaltérable "qui a fait quoi et quand" (chantier_events).
-- 3. Notifications ciblées : RPC send_chantier_alert (un lot OU tout
--    le chantier) via la table notifications existante.
-- 4. Zéro perte média : bucket chantier-media SANS politique DELETE,
--    lignes chantier_media en soft-delete uniquement (restauration MOE),
--    horodatage + lot + zone + auteur obligatoires à la soumission.
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chantiers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    name text NOT NULL,
    client_name text,
    address text,
    description text,
    status text NOT NULL DEFAULT 'preparation'
        CHECK (status IN ('preparation','en_cours','receptionne','clos')),
    start_date date,
    end_date date,
    created_by uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chantier_zones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    name text NOT NULL,
    description text,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chantier_lots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    name text NOT NULL,                       -- corps de métier (ex: Plomberie)
    trade_code text,
    subcontractor_id bigint REFERENCES public.subcontractors(id) ON DELETE SET NULL,
    cahier_des_charges text,
    status text NOT NULL DEFAULT 'a_demarrer'
        CHECK (status IN ('a_demarrer','en_cours','termine','valide')),
    progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chantier_lot_members (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lot_id uuid NOT NULL REFERENCES public.chantier_lots(id) ON DELETE CASCADE,
    chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE (lot_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chantier_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.chantier_lots(id) ON DELETE CASCADE,
    zone_id uuid REFERENCES public.chantier_zones(id) ON DELETE SET NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'a_faire'
        CHECK (status IN ('a_faire','en_cours','fait','valide')),
    done_by uuid,
    done_at timestamptz,
    validated_by uuid,
    validated_at timestamptz,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Médias : preuve visuelle. Lot + auteur + horodatage OBLIGATOIRES.
-- Jamais de suppression physique (soft delete + restauration MOE).
CREATE TABLE IF NOT EXISTS public.chantier_media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.chantier_lots(id) ON DELETE CASCADE,
    zone_id uuid REFERENCES public.chantier_zones(id) ON DELETE SET NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id),
    uploaded_by uuid NOT NULL,
    uploader_name text,                        -- dénormalisé : survit au départ de l'auteur
    company_name text,                         -- entreprise du lot au moment de l'envoi
    file_path text NOT NULL,
    file_name text,
    caption text,
    taken_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_by uuid,
    deleted_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Journal d'audit INALTÉRABLE : insertion seule, jamais de modification.
-- chantier_id sans CASCADE (SET NULL) + noms dénormalisés : le journal
-- survit à la suppression du chantier, de l'utilisateur, du lot.
CREATE TABLE IF NOT EXISTS public.chantier_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid NOT NULL,
    chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL,
    chantier_name text,
    lot_id uuid,
    lot_name text,
    zone_id uuid,
    zone_name text,
    actor_id uuid,
    actor_name text,
    company_name text,
    event_type text NOT NULL,
    details jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index (FK + accès fréquents)
CREATE INDEX IF NOT EXISTS idx_chantiers_org ON public.chantiers(organization_id);
CREATE INDEX IF NOT EXISTS idx_chantier_zones_chantier ON public.chantier_zones(chantier_id);
CREATE INDEX IF NOT EXISTS idx_chantier_lots_chantier ON public.chantier_lots(chantier_id);
CREATE INDEX IF NOT EXISTS idx_chantier_lots_sub ON public.chantier_lots(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_clm_lot ON public.chantier_lot_members(lot_id);
CREATE INDEX IF NOT EXISTS idx_clm_user ON public.chantier_lot_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clm_chantier ON public.chantier_lot_members(chantier_id);
CREATE INDEX IF NOT EXISTS idx_ctasks_lot ON public.chantier_tasks(lot_id);
CREATE INDEX IF NOT EXISTS idx_ctasks_chantier ON public.chantier_tasks(chantier_id);
CREATE INDEX IF NOT EXISTS idx_ctasks_zone ON public.chantier_tasks(zone_id);
CREATE INDEX IF NOT EXISTS idx_cmedia_chantier ON public.chantier_media(chantier_id);
CREATE INDEX IF NOT EXISTS idx_cmedia_lot ON public.chantier_media(lot_id);
CREATE INDEX IF NOT EXISTS idx_cmedia_zone ON public.chantier_media(zone_id);
CREATE INDEX IF NOT EXISTS idx_cevents_chantier ON public.chantier_events(chantier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cevents_org ON public.chantier_events(organization_id);

-- ============================================================
-- 2. HELPERS D'ACCÈS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_chantier_member(p_chantier uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.chantier_lot_members m
        WHERE m.chantier_id = p_chantier AND m.user_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.is_lot_member(p_lot uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.chantier_lot_members m
        WHERE m.lot_id = p_lot AND m.user_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.is_chantier_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chantier_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_lot_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_lot_member(uuid) TO authenticated;

-- updated_at automatique
CREATE OR REPLACE FUNCTION public.chantier_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_chantiers ON public.chantiers;
CREATE TRIGGER trg_touch_chantiers BEFORE UPDATE ON public.chantiers
FOR EACH ROW EXECUTE FUNCTION public.chantier_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_chantier_lots ON public.chantier_lots;
CREATE TRIGGER trg_touch_chantier_lots BEFORE UPDATE ON public.chantier_lots
FOR EACH ROW EXECUTE FUNCTION public.chantier_touch_updated_at();
DROP TRIGGER IF EXISTS trg_touch_chantier_tasks ON public.chantier_tasks;
CREATE TRIGGER trg_touch_chantier_tasks BEFORE UPDATE ON public.chantier_tasks
FOR EACH ROW EXECUTE FUNCTION public.chantier_touch_updated_at();

-- ============================================================
-- 3. JOURNAL D'AUDIT (traçabilité absolue)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_chantier_event(
    p_org uuid, p_chantier uuid, p_lot uuid, p_zone uuid,
    p_type text, p_details jsonb DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_actor_name text; v_chantier_name text; v_lot_name text;
    v_zone_name text; v_company text;
BEGIN
    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;
    SELECT name INTO v_chantier_name FROM public.chantiers WHERE id = p_chantier;
    IF p_lot IS NOT NULL THEN
        SELECT l.name, s.company_name INTO v_lot_name, v_company
        FROM public.chantier_lots l
        LEFT JOIN public.subcontractors s ON s.id = l.subcontractor_id
        WHERE l.id = p_lot;
    END IF;
    IF p_zone IS NOT NULL THEN
        SELECT name INTO v_zone_name FROM public.chantier_zones WHERE id = p_zone;
    END IF;

    INSERT INTO public.chantier_events
        (organization_id, chantier_id, chantier_name, lot_id, lot_name,
         zone_id, zone_name, actor_id, actor_name, company_name, event_type, details)
    VALUES
        (p_org, p_chantier, v_chantier_name, p_lot, v_lot_name,
         p_zone, v_zone_name, v_actor, v_actor_name, v_company, p_type, COALESCE(p_details,'{}'));
END; $$;

REVOKE ALL ON FUNCTION public.log_chantier_event(uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;

-- Triggers d'audit automatiques
CREATE OR REPLACE FUNCTION public.audit_chantier_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r record; v_type text; v_details jsonb := '{}'; v_lot uuid; v_zone uuid; v_chantier uuid;
BEGIN
    r := COALESCE(NEW, OLD);
    v_chantier := CASE TG_TABLE_NAME WHEN 'chantiers' THEN r.id ELSE r.chantier_id END;
    v_lot := CASE TG_TABLE_NAME
                WHEN 'chantier_lots' THEN r.id
                WHEN 'chantier_lot_members' THEN r.lot_id
                WHEN 'chantier_tasks' THEN r.lot_id
                WHEN 'chantier_media' THEN r.lot_id
                ELSE NULL END;
    v_zone := CASE TG_TABLE_NAME
                WHEN 'chantier_zones' THEN r.id
                WHEN 'chantier_tasks' THEN r.zone_id
                WHEN 'chantier_media' THEN r.zone_id
                ELSE NULL END;

    IF TG_TABLE_NAME = 'chantiers' THEN
        v_type := CASE TG_OP WHEN 'INSERT' THEN 'chantier_cree' ELSE 'chantier_modifie' END;
        IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
            v_type := 'chantier_statut'; v_details := jsonb_build_object('de',OLD.status,'vers',NEW.status);
        END IF;
    ELSIF TG_TABLE_NAME = 'chantier_zones' THEN
        v_type := CASE TG_OP WHEN 'INSERT' THEN 'zone_creee' WHEN 'DELETE' THEN 'zone_supprimee' ELSE 'zone_modifiee' END;
        v_details := jsonb_build_object('nom', r.name);
    ELSIF TG_TABLE_NAME = 'chantier_lots' THEN
        v_type := CASE TG_OP WHEN 'INSERT' THEN 'lot_cree' WHEN 'DELETE' THEN 'lot_supprime' ELSE 'lot_modifie' END;
        IF TG_OP='UPDATE' THEN
            IF NEW.status IS DISTINCT FROM OLD.status THEN
                v_type := 'lot_statut'; v_details := jsonb_build_object('de',OLD.status,'vers',NEW.status);
            ELSIF NEW.progress IS DISTINCT FROM OLD.progress THEN
                v_type := 'lot_avancement'; v_details := jsonb_build_object('de',OLD.progress,'vers',NEW.progress);
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'chantier_lot_members' THEN
        v_type := CASE TG_OP WHEN 'INSERT' THEN 'membre_ajoute' ELSE 'membre_retire' END;
        SELECT jsonb_build_object('membre', p.full_name) INTO v_details
        FROM public.profiles p WHERE p.id = r.user_id;
    ELSIF TG_TABLE_NAME = 'chantier_tasks' THEN
        v_type := CASE TG_OP WHEN 'INSERT' THEN 'tache_creee' WHEN 'DELETE' THEN 'tache_supprimee' ELSE 'tache_modifiee' END;
        v_details := jsonb_build_object('titre', r.title);
        IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
            v_type := CASE NEW.status WHEN 'valide' THEN 'tache_validee' WHEN 'fait' THEN 'tache_faite' ELSE 'tache_statut' END;
            v_details := jsonb_build_object('titre',NEW.title,'de',OLD.status,'vers',NEW.status);
        END IF;
    ELSIF TG_TABLE_NAME = 'chantier_media' THEN
        IF TG_OP='INSERT' THEN v_type := 'photo_ajoutee';
        ELSIF TG_OP='UPDATE' AND NEW.is_deleted AND NOT OLD.is_deleted THEN v_type := 'photo_supprimee';
        ELSIF TG_OP='UPDATE' AND NOT NEW.is_deleted AND OLD.is_deleted THEN v_type := 'photo_restauree';
        ELSE v_type := 'photo_modifiee'; END IF;
        v_details := jsonb_build_object('fichier', r.file_name, 'horodatage', r.taken_at);
    END IF;

    PERFORM public.log_chantier_event(r.organization_id, v_chantier, v_lot, v_zone, v_type, v_details);
    RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON FUNCTION public.audit_chantier_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_chantiers ON public.chantiers;
CREATE TRIGGER trg_audit_chantiers AFTER INSERT OR UPDATE ON public.chantiers
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_changes();
DROP TRIGGER IF EXISTS trg_audit_zones ON public.chantier_zones;
CREATE TRIGGER trg_audit_zones AFTER INSERT OR UPDATE OR DELETE ON public.chantier_zones
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_changes();
DROP TRIGGER IF EXISTS trg_audit_lots ON public.chantier_lots;
CREATE TRIGGER trg_audit_lots AFTER INSERT OR UPDATE OR DELETE ON public.chantier_lots
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_changes();
DROP TRIGGER IF EXISTS trg_audit_members ON public.chantier_lot_members;
CREATE TRIGGER trg_audit_members AFTER INSERT OR DELETE ON public.chantier_lot_members
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_changes();
DROP TRIGGER IF EXISTS trg_audit_tasks ON public.chantier_tasks;
CREATE TRIGGER trg_audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.chantier_tasks
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_changes();
DROP TRIGGER IF EXISTS trg_audit_media ON public.chantier_media;
CREATE TRIGGER trg_audit_media AFTER INSERT OR UPDATE ON public.chantier_media
FOR EACH ROW EXECUTE FUNCTION public.audit_chantier_changes();

-- Journal inaltérable : modification/suppression interdites (même admin)
CREATE OR REPLACE FUNCTION public.forbid_chantier_event_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF; -- maintenance DB directe
    RAISE EXCEPTION 'Le journal d''audit est inaltérable (code: audit_immutable)';
END; $$;
REVOKE ALL ON FUNCTION public.forbid_chantier_event_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_forbid_event_change ON public.chantier_events;
CREATE TRIGGER trg_forbid_event_change BEFORE UPDATE OR DELETE ON public.chantier_events
FOR EACH ROW EXECUTE FUNCTION public.forbid_chantier_event_change();

-- ============================================================
-- 4. GARDE-FOUS TÂCHES ET MÉDIAS
-- ============================================================
-- Tâches : une entreprise peut passer a_faire/en_cours/fait ; seule
-- la MOE valide ; une tâche validée ne se modifie plus (sauf MOE).
CREATE OR REPLACE FUNCTION public.chantier_task_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_admin() THEN
        IF NEW.status = 'valide' AND OLD.status IS DISTINCT FROM 'valide' THEN
            NEW.validated_by := auth.uid(); NEW.validated_at := now();
        END IF;
        RETURN NEW;
    END IF;
    -- membre du lot (non MOE)
    IF OLD.status = 'valide' THEN
        RAISE EXCEPTION 'Tâche validée par la MOE : modification interdite (code: task_locked)';
    END IF;
    IF NEW.status = 'valide' THEN
        RAISE EXCEPTION 'Seule la maîtrise d''œuvre peut valider une tâche (code: moe_only)';
    END IF;
    -- seuls le statut (hors valide) et rien d'autre
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.lot_id IS DISTINCT FROM OLD.lot_id OR NEW.zone_id IS DISTINCT FROM OLD.zone_id THEN
        RAISE EXCEPTION 'Seule la MOE peut modifier le cahier des charges (code: moe_only)';
    END IF;
    IF NEW.status = 'fait' AND OLD.status IS DISTINCT FROM 'fait' THEN
        NEW.done_by := auth.uid(); NEW.done_at := now();
    END IF;
    RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.chantier_task_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_task_guard ON public.chantier_tasks;
CREATE TRIGGER trg_task_guard BEFORE UPDATE ON public.chantier_tasks
FOR EACH ROW EXECUTE FUNCTION public.chantier_task_guard();

-- Médias : jamais de DELETE ; soft-delete par l'auteur ou la MOE ;
-- restauration MOE uniquement ; contexte (lot/zone/auteur/horodatage) figé.
CREATE OR REPLACE FUNCTION public.chantier_media_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF auth.uid() IS NULL THEN RETURN OLD; END IF; -- maintenance directe
        RAISE EXCEPTION 'Suppression définitive interdite : preuve de chantier (code: media_immutable)';
    END IF;

    -- Contexte immuable pour tout le monde
    IF NEW.file_path IS DISTINCT FROM OLD.file_path
       OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
       OR NEW.taken_at IS DISTINCT FROM OLD.taken_at
       OR NEW.lot_id IS DISTINCT FROM OLD.lot_id
       OR NEW.chantier_id IS DISTINCT FROM OLD.chantier_id THEN
        IF auth.uid() IS NOT NULL THEN
            RAISE EXCEPTION 'Contexte du média inaltérable (code: media_immutable)';
        END IF;
    END IF;

    IF auth.uid() IS NULL OR public.is_admin() THEN
        IF NEW.is_deleted AND NOT OLD.is_deleted THEN
            NEW.deleted_by := auth.uid(); NEW.deleted_at := now();
        END IF;
        RETURN NEW;
    END IF;

    -- Non-admin : uniquement soft-delete de SES propres médias (+ légende)
    IF NOT NEW.is_deleted AND OLD.is_deleted THEN
        RAISE EXCEPTION 'Seule la MOE peut restaurer un média (code: moe_only)';
    END IF;
    IF NEW.is_deleted AND NOT OLD.is_deleted THEN
        IF OLD.uploaded_by <> auth.uid() THEN
            RAISE EXCEPTION 'Vous ne pouvez retirer que vos propres médias (code: not_owner)';
        END IF;
        NEW.deleted_by := auth.uid(); NEW.deleted_at := now();
    END IF;
    RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.chantier_media_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_media_guard ON public.chantier_media;
CREATE TRIGGER trg_media_guard BEFORE UPDATE OR DELETE ON public.chantier_media
FOR EACH ROW EXECUTE FUNCTION public.chantier_media_guard();

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_lot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantier_events ENABLE ROW LEVEL SECURITY;

-- CHANTIERS : MOE tout ; membres = lecture des chantiers où ils ont un lot
CREATE POLICY chantiers_select ON public.chantiers FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR public.is_chantier_member(id)));
CREATE POLICY chantiers_insert ON public.chantiers FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());
CREATE POLICY chantiers_update ON public.chantiers FOR UPDATE TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin())
WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY chantiers_delete ON public.chantiers FOR DELETE TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin());

-- ZONES : lecture pour les membres du chantier ; écriture MOE
CREATE POLICY czones_select ON public.chantier_zones FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR public.is_chantier_member(chantier_id)));
CREATE POLICY czones_write ON public.chantier_zones FOR ALL TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin())
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());

-- LOTS : un membre ne voit QUE ses lots ; écriture MOE
CREATE POLICY clots_select ON public.chantier_lots FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR public.is_lot_member(id)));
CREATE POLICY clots_write ON public.chantier_lots FOR ALL TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin())
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());

-- MEMBRES : MOE gère ; chacun voit les membres de ses lots
CREATE POLICY clm_select ON public.chantier_lot_members FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR user_id = (SELECT auth.uid()) OR public.is_lot_member(lot_id)));
CREATE POLICY clm_write ON public.chantier_lot_members FOR ALL TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin())
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());

-- TÂCHES : membre du lot lit et met à jour (garde-fou trigger) ; MOE tout
CREATE POLICY ctasks_select ON public.chantier_tasks FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR public.is_lot_member(lot_id)));
CREATE POLICY ctasks_insert ON public.chantier_tasks FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_user_org_id() AND public.is_admin());
CREATE POLICY ctasks_update ON public.chantier_tasks FOR UPDATE TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR public.is_lot_member(lot_id)))
WITH CHECK (organization_id = public.current_user_org_id());
CREATE POLICY ctasks_delete ON public.chantier_tasks FOR DELETE TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin());

-- MÉDIAS : membre voit les médias de ses lots (non supprimés) ; MOE voit tout
CREATE POLICY cmedia_select ON public.chantier_media FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR (public.is_lot_member(lot_id) AND is_deleted = false)));
CREATE POLICY cmedia_insert ON public.chantier_media FOR INSERT TO authenticated
WITH CHECK (organization_id = public.current_user_org_id()
       AND uploaded_by = (SELECT auth.uid())
       AND (public.is_admin() OR public.is_lot_member(lot_id)));
CREATE POLICY cmedia_update ON public.chantier_media FOR UPDATE TO authenticated
USING (organization_id = public.current_user_org_id()
       AND (public.is_admin() OR uploaded_by = (SELECT auth.uid())))
WITH CHECK (organization_id = public.current_user_org_id());
-- PAS de politique DELETE : suppression physique impossible (zéro perte)

-- JOURNAL : lecture MOE uniquement ; insertion via triggers (definer)
CREATE POLICY cevents_select ON public.chantier_events FOR SELECT TO authenticated
USING (organization_id = public.current_user_org_id() AND public.is_admin());
-- PAS de politiques INSERT/UPDATE/DELETE côté client

-- ============================================================
-- 6. STOCKAGE : bucket chantier-media (privé, AUCUNE suppression)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chantier-media', 'chantier-media', false)
ON CONFLICT (id) DO NOTHING;

-- Chemin canonique : {org}/chantiers/{chantier_id}/{lot_id}/{fichier}
DROP POLICY IF EXISTS "chantier_media_insert" ON storage.objects;
CREATE POLICY "chantier_media_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'chantier-media'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
    AND (storage.foldername(name))[2] = 'chantiers'
    AND (
        public.is_admin()
        OR public.is_lot_member(public.uuid_or_null((storage.foldername(name))[4]))
    )
);

DROP POLICY IF EXISTS "chantier_media_select" ON storage.objects;
CREATE POLICY "chantier_media_select" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'chantier-media'
    AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
    AND (
        public.is_admin()
        OR public.is_lot_member(public.uuid_or_null((storage.foldername(name))[4]))
    )
);
-- PAS de politiques UPDATE/DELETE sur ce bucket : les fichiers sont figés.

-- ============================================================
-- 7. ALERTES CIBLÉES (un lot / une entreprise, ou tout le chantier)
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_chantier_alert(
    p_chantier uuid,
    p_title text,
    p_message text,
    p_lot uuid DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_org uuid; v_count integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Réservé à la maîtrise d''œuvre (code: moe_only)';
    END IF;
    SELECT organization_id INTO v_org FROM public.chantiers
    WHERE id = p_chantier AND organization_id = public.current_user_org_id();
    IF v_org IS NULL THEN
        RAISE EXCEPTION 'Chantier introuvable (code: not_found)';
    END IF;
    IF COALESCE(btrim(p_title),'') = '' OR COALESCE(btrim(p_message),'') = '' THEN
        RAISE EXCEPTION 'Titre et message requis (code: invalid_input)';
    END IF;

    WITH cibles AS (
        SELECT DISTINCT m.user_id
        FROM public.chantier_lot_members m
        WHERE m.chantier_id = p_chantier
          AND (p_lot IS NULL OR m.lot_id = p_lot)
          AND m.user_id <> auth.uid()
    ), ins AS (
        INSERT INTO public.notifications (organization_id, user_id, type, title, body, data)
        SELECT v_org, c.user_id, 'chantier_alerte', p_title, p_message,
               jsonb_build_object('chantier_id', p_chantier, 'lot_id', p_lot)
        FROM cibles c
        RETURNING 1
    )
    SELECT count(*) INTO v_count FROM ins;

    PERFORM public.log_chantier_event(
        v_org, p_chantier, p_lot, NULL, 'alerte_envoyee',
        jsonb_build_object('titre', p_title, 'cible', CASE WHEN p_lot IS NULL THEN 'chantier' ELSE 'lot' END,
                           'destinataires', v_count)
    );
    RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.send_chantier_alert(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chantier_alert(uuid,text,text,uuid) TO authenticated;

SELECT 'SUCCESS - module chantiers MOE installé' AS result;
