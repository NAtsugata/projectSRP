-- ============================================================
-- DISPONIBILITÉ DES EMPLOYÉS
-- ============================================================
-- Un employé n'est proposé pour une intervention QUE s'il est
-- disponible à la date visée :
--   - statut 'actif' (les 'licencié' n'apparaissent jamais dans
--     les listes d'affectation, mais leurs données restent)
--   - aucune absence datée couvrant la date (maladie, congé, autre)
--
-- Source unique de vérité pour les absences : table employee_absences.
-- Un congé APPROUVÉ crée automatiquement une absence (trigger), de
-- sorte que planning, agenda et affectations partagent la même logique.
-- ============================================================

-- ============================================================
-- 1. STATUT EMPLOYÉ : défaut 'actif', valeurs normalisées
-- ============================================================
ALTER TABLE public.profiles
    ALTER COLUMN employee_status SET DEFAULT 'actif';

UPDATE public.profiles SET employee_status = 'actif'
WHERE employee_status IS NULL OR btrim(employee_status) = '';

CREATE INDEX IF NOT EXISTS idx_profiles_status_org
    ON public.profiles(organization_id, employee_status);

-- ============================================================
-- 2. LIER LES ABSENCES AUX CONGÉS (source + traçabilité)
-- ============================================================
ALTER TABLE public.employee_absences
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS leave_request_id bigint REFERENCES public.leave_requests(id) ON DELETE CASCADE;

-- Une seule absence auto par demande de congé
CREATE UNIQUE INDEX IF NOT EXISTS uidx_absence_leave
    ON public.employee_absences(leave_request_id)
    WHERE leave_request_id IS NOT NULL;

-- Recherche rapide des absences couvrant une période, par organisation
CREATE INDEX IF NOT EXISTS idx_absences_org_dates
    ON public.employee_absences(organization_id, start_date, end_date);

-- ============================================================
-- 3. CONGÉ APPROUVÉ  ->  ABSENCE (et retrait si non approuvé)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_leave_to_absence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_approved boolean;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.employee_absences WHERE leave_request_id = OLD.id;
        RETURN OLD;
    END IF;

    -- Statut approuvé, tolérant aux variantes (Approuvée / approved / ...)
    v_approved := lower(unaccent_lite(NEW.status)) LIKE 'approuv%'
               OR lower(NEW.status) LIKE 'approved%';

    IF v_approved THEN
        INSERT INTO public.employee_absences
            (employee_id, organization_id, start_date, end_date, reason, notes, source, leave_request_id)
        VALUES
            (NEW.user_id, NEW.organization_id, NEW.start_date, NEW.end_date,
             COALESCE(NULLIF(NEW.reason, ''), 'Congés'),
             'Créé automatiquement depuis une demande de congé approuvée',
             'leave', NEW.id)
        ON CONFLICT (leave_request_id) WHERE leave_request_id IS NOT NULL
        DO UPDATE SET
            employee_id = EXCLUDED.employee_id,
            organization_id = EXCLUDED.organization_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            reason = EXCLUDED.reason,
            updated_at = now();
    ELSE
        -- Repassé en attente / rejeté / annulé : on retire l'absence auto
        DELETE FROM public.employee_absences WHERE leave_request_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- Petit helper de dé-accentuation (évite la dépendance à l'extension unaccent)
CREATE OR REPLACE FUNCTION public.unaccent_lite(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT translate(COALESCE(t, ''),
                     'àâäáãéèêëíìîïóòôöõúùûüçñ',
                     'aaaaaeeeeiiiiooooouuuucn');
$$;

REVOKE ALL ON FUNCTION public.sync_leave_to_absence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_leave_to_absence ON public.leave_requests;
CREATE TRIGGER trg_sync_leave_to_absence
    AFTER INSERT OR UPDATE OF status, start_date, end_date, user_id OR DELETE
    ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.sync_leave_to_absence();

-- ============================================================
-- 4. BACKFILL : congés déjà approuvés -> absences
-- ============================================================
INSERT INTO public.employee_absences
    (employee_id, organization_id, start_date, end_date, reason, notes, source, leave_request_id)
SELECT lr.user_id, lr.organization_id, lr.start_date, lr.end_date,
       COALESCE(NULLIF(lr.reason, ''), 'Congés'),
       'Créé automatiquement depuis une demande de congé approuvée', 'leave', lr.id
FROM public.leave_requests lr
WHERE (lower(public.unaccent_lite(lr.status)) LIKE 'approuv%'
       OR lower(lr.status) LIKE 'approved%')
ON CONFLICT (leave_request_id) WHERE leave_request_id IS NOT NULL DO NOTHING;

-- ============================================================
-- 5. RPC : IDs des employés disponibles sur une période
--    (statut actif + aucune absence couvrant [start, end])
--    Scopé à l'organisation de l'appelant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.available_employee_ids(
    p_start date,
    p_end date DEFAULT NULL
)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.id
    FROM public.profiles p
    WHERE p.organization_id = public.current_user_org_id()
      AND COALESCE(p.employee_status, 'actif') = 'actif'
      AND NOT EXISTS (
          SELECT 1 FROM public.employee_absences a
          WHERE a.employee_id = p.id
            AND a.start_date <= COALESCE(p_end, p_start)
            AND a.end_date   >= p_start
      );
$$;

REVOKE ALL ON FUNCTION public.available_employee_ids(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_employee_ids(date, date) TO authenticated;

-- ============================================================
-- 6. ALIGNER deactivate/reactivate_employee sur 'licencié'/'actif'
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
    SET employee_status = 'licencié', is_admin = false
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

    UPDATE public.profiles SET employee_status = 'actif' WHERE id = p_user_id;
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_employee(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reactivate_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_employee(uuid) TO authenticated;

SELECT 'SUCCESS - employee availability applied' AS result;
