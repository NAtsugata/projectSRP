-- ============================================================
-- MULTI-TENANT HARDENING (4/4) - Verrouillage des privilèges RPC
-- ============================================================
-- Suite aux advisors Supabase :
--   - create_organization_with_admin était appelable par TOUT
--     utilisateur authentifié via /rest/v1/rpc/ et permettait de
--     rattacher/promouvoir n'importe quel utilisateur → verrouillée
--   - fonctions trigger retirées de l'API REST
--   - helpers de policies interdits au rôle anon
-- ============================================================

-- 1. create_organization_with_admin : réservée au super admin
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
    p_org_name text,
    p_org_slug text,
    p_admin_user_id uuid,
    p_siret text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
BEGIN
    -- Réservé au super admin plateforme (ou accès direct DB)
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_super_admin = true
    ) THEN
        RAISE EXCEPTION 'Réservé au super administrateur (code: not_super_admin)';
    END IF;

    INSERT INTO public.organizations (name, slug, siret, phone, address)
    VALUES (p_org_name, p_org_slug, p_siret, p_phone, p_address)
    RETURNING id INTO v_org_id;

    PERFORM set_config('app.org_management', 'on', true);

    UPDATE public.profiles
    SET organization_id = v_org_id, is_admin = true, role = 'admin'
    WHERE id = p_admin_user_id;

    INSERT INTO public.organization_roles (user_id, organization_id, role)
    VALUES (p_admin_user_id, v_org_id, 'owner')
    ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'owner';

    RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_admin(text, text, uuid, text, text, text) FROM PUBLIC, anon;

-- 2. Fonctions trigger : jamais appelables via l'API REST
REVOKE ALL ON FUNCTION public.enforce_org_user_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_org_billing_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. Helpers de policies : nécessaires à authenticated, interdits à anon
REVOKE ALL ON FUNCTION public.profile_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_org(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.storage_owner_uuid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_owner_uuid(text) TO authenticated;
REVOKE ALL ON FUNCTION public.uuid_or_null(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uuid_or_null(text) TO authenticated;
REVOKE ALL ON FUNCTION public.can_manage_chantiers() FROM anon;

SELECT 'SUCCESS - hardening 4/4 (rpc lockdown) applied' AS result;
