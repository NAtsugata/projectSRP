-- ============================================================
-- MULTI-TENANT HARDENING (3/3) - Cycle de vie commercial
-- ============================================================
-- Ajoute ce qui manquait pour une commercialisation à grande échelle :
--   1. Colonnes d'abonnement sur organizations (prêt pour Stripe)
--   2. Quota max_users appliqué en base (trigger)
--   3. Protection des champs de facturation (un admin d'org ne peut
--      pas augmenter lui-même son max_users / changer son plan)
--   4. prevent_privilege_escalation assoupli : un admin d'org peut
--      promouvoir/rétrograder les membres de SA PROPRE org
--   5. RPCs : create_organization_with_owner, invite_employee,
--      accept_invitation
--   6. handle_new_user : rattachement automatique si une invitation
--      valide existe pour l'email du nouvel inscrit
-- ============================================================

-- ============================================================
-- 1. COLONNES D'ABONNEMENT
-- ============================================================
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS subscription_ends_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS stripe_customer_id text,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Index invitations (recherche par token et par email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_invitations_token
    ON public.employee_invitations(token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email
    ON public.employee_invitations(lower(email));

-- ============================================================
-- 2. QUOTA max_users APPLIQUÉ EN BASE
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_org_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max integer;
    v_count integer;
BEGIN
    -- Seulement quand un profil rejoint une organisation
    IF NEW.organization_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
        RETURN NEW;
    END IF;

    SELECT max_users INTO v_max FROM public.organizations WHERE id = NEW.organization_id;
    IF v_max IS NULL THEN
        RETURN NEW; -- pas de limite
    END IF;

    SELECT count(*) INTO v_count
    FROM public.profiles
    WHERE organization_id = NEW.organization_id AND id <> NEW.id;

    IF v_count >= v_max THEN
        RAISE EXCEPTION 'Limite d''utilisateurs atteinte pour cette organisation (max %). Passez à un abonnement supérieur. (code: org_user_limit)', v_max;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_org_user_limit ON public.profiles;
CREATE TRIGGER trg_enforce_org_user_limit
    BEFORE INSERT OR UPDATE OF organization_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_org_user_limit();

-- ============================================================
-- 3. PROTECTION DES CHAMPS DE FACTURATION
--    Seuls le super admin, le service_role (webhook Stripe) ou les
--    fonctions internes peuvent modifier plan/quota/statut d'abonnement.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_org_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Service role (webhooks de facturation) et accès direct DB : autorisés
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    -- Fonctions internes SECURITY DEFINER
    IF current_setting('app.org_management', true) = 'on' THEN
        RETURN NEW;
    END IF;
    -- Super admin plateforme
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true) THEN
        RETURN NEW;
    END IF;

    IF (NEW.plan IS DISTINCT FROM OLD.plan)
       OR (NEW.max_users IS DISTINCT FROM OLD.max_users)
       OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
       OR (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status)
       OR (NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at)
       OR (NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id)
       OR (NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id)
       OR (NEW.is_demo IS DISTINCT FROM OLD.is_demo) THEN
        RAISE EXCEPTION 'Champs d''abonnement protégés (code: billing_protected)';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_org_billing ON public.organizations;
CREATE TRIGGER trg_protect_org_billing
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_org_billing_fields();

-- ============================================================
-- 4. PREVENT_PRIVILEGE_ESCALATION v2
--    - super admin : tout
--    - fonctions internes (app.org_management) : tout
--    - admin d'org : peut changer is_admin/role des membres de SA
--      propre org (pas lui-même, jamais is_super_admin ni organization_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Fonctions internes SECURITY DEFINER (invitations, création d'org)
    IF current_setting('app.org_management', true) = 'on' THEN
        RETURN NEW;
    END IF;

    -- Accès direct DB / service role
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Super admin plateforme
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_super_admin = true
    ) THEN
        RETURN NEW;
    END IF;

    -- Jamais modifiables par un utilisateur normal
    IF (NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin)
       OR (NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
        RAISE EXCEPTION 'Modification de privilèges non autorisée (code: priv_escalation)';
    END IF;

    -- is_admin / role : admin d'org sur les membres de sa propre org uniquement
    IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin)
       OR (NEW.role IS DISTINCT FROM OLD.role) THEN
        IF public.is_admin()
           AND OLD.organization_id IS NOT NULL
           AND OLD.organization_id = public.current_user_org_id()
           AND NEW.id <> auth.uid() THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Modification de privilèges non autorisée (code: priv_escalation)';
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================
-- 5a. RPC : CRÉATION D'ORGANISATION SELF-SERVICE
--     Un utilisateur inscrit sans organisation crée la sienne
--     et en devient owner/admin (plan trial, 5 utilisateurs).
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
    p_name text,
    p_slug text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_org uuid;
    v_slug text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Nom d''organisation invalide (code: invalid_name)';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND organization_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Vous appartenez déjà à une organisation (code: already_in_org)';
    END IF;

    v_slug := COALESCE(NULLIF(trim(p_slug), ''),
                       regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' OR EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) THEN
        v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    END IF;

    INSERT INTO public.organizations (name, slug, plan, max_users, is_active, subscription_status)
    VALUES (trim(p_name), v_slug, 'trial', 5, true, 'trial')
    RETURNING id INTO v_org;

    PERFORM set_config('app.org_management', 'on', true);

    UPDATE public.profiles
    SET organization_id = v_org, is_admin = true
    WHERE id = v_uid;

    INSERT INTO public.organization_roles (organization_id, user_id, role)
    VALUES (v_org, v_uid, 'owner')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'owner';

    RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

-- ============================================================
-- 5b. RPC : INVITER UN EMPLOYÉ (admin d'org, quota vérifié)
-- ============================================================
CREATE OR REPLACE FUNCTION public.invite_employee(
    p_email text,
    p_role text DEFAULT 'technician'
)
RETURNS TABLE (invitation_id uuid, invitation_token text, invitation_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_org uuid;
    v_max integer;
    v_members integer;
    v_pending integer;
    v_token text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;
    SELECT organization_id INTO v_org FROM public.profiles WHERE id = v_uid;
    IF v_org IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Réservé aux administrateurs d''une organisation (code: not_admin)';
    END IF;
    IF p_role NOT IN ('admin', 'manager', 'technician') THEN
        RAISE EXCEPTION 'Rôle invalide (admin, manager ou technician) (code: invalid_role)';
    END IF;

    p_email := lower(trim(p_email));
    IF p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'Adresse email invalide (code: invalid_email)';
    END IF;

    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND is_active = false) THEN
        RAISE EXCEPTION 'Organisation inactive (code: org_inactive)';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = p_email AND organization_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Cet email appartient déjà à une organisation (code: email_taken)';
    END IF;

    -- Quota : membres actuels + invitations en attente < max_users
    SELECT max_users INTO v_max FROM public.organizations WHERE id = v_org;
    IF v_max IS NOT NULL THEN
        SELECT count(*) INTO v_members FROM public.profiles WHERE organization_id = v_org;
        SELECT count(*) INTO v_pending FROM public.employee_invitations
        WHERE organization_id = v_org AND accepted_at IS NULL AND expires_at > now();
        IF v_members + v_pending >= v_max THEN
            RAISE EXCEPTION 'Limite d''utilisateurs atteinte (%/%). Passez à un abonnement supérieur. (code: org_user_limit)', v_members + v_pending, v_max;
        END IF;
    END IF;

    v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

    -- Une seule invitation active par email et par organisation
    DELETE FROM public.employee_invitations
    WHERE organization_id = v_org AND lower(email) = p_email AND accepted_at IS NULL;

    RETURN QUERY
    INSERT INTO public.employee_invitations (organization_id, invited_by, email, role, token, expires_at)
    VALUES (v_org, v_uid, p_email, p_role, v_token, now() + interval '7 days')
    RETURNING id, token, expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_employee(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_employee(text, text) TO authenticated;

-- ============================================================
-- 5c. RPC : ACCEPTER UNE INVITATION (par token)
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_email text;
    v_inv record;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentification requise (code: not_authenticated)';
    END IF;

    v_email := lower(COALESCE(auth.email(),
                              (SELECT email FROM public.profiles WHERE id = v_uid)));

    SELECT * INTO v_inv
    FROM public.employee_invitations
    WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation invalide ou expirée (code: invalid_invitation)';
    END IF;
    IF lower(v_inv.email) <> v_email THEN
        RAISE EXCEPTION 'Cette invitation est destinée à une autre adresse email (code: email_mismatch)';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_uid AND organization_id IS NOT NULL
          AND organization_id <> v_inv.organization_id
    ) THEN
        RAISE EXCEPTION 'Vous appartenez déjà à une autre organisation (code: already_in_org)';
    END IF;

    PERFORM set_config('app.org_management', 'on', true);

    -- Le trigger de quota (trg_enforce_org_user_limit) revalide la limite ici
    UPDATE public.profiles
    SET organization_id = v_inv.organization_id,
        is_admin = (v_inv.role IN ('owner', 'admin'))
    WHERE id = v_uid;

    INSERT INTO public.organization_roles (organization_id, user_id, role)
    VALUES (v_inv.organization_id, v_uid, v_inv.role)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    UPDATE public.employee_invitations SET accepted_at = now() WHERE id = v_inv.id;

    RETURN v_inv.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- ============================================================
-- 6. HANDLE_NEW_USER : rattachement automatique par invitation
--    Si un utilisateur s'inscrit avec un email invité, il rejoint
--    directement l'organisation (sans saisir de token).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv record;
BEGIN
    INSERT INTO public.profiles (id, email, full_name, is_admin)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        false
    )
    ON CONFLICT (id) DO NOTHING;

    -- Rattachement automatique si une invitation valide existe pour cet email
    SELECT * INTO v_inv
    FROM public.employee_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        BEGIN
            PERFORM set_config('app.org_management', 'on', true);

            UPDATE public.profiles
            SET organization_id = v_inv.organization_id,
                is_admin = (v_inv.role IN ('owner', 'admin'))
            WHERE id = NEW.id;

            INSERT INTO public.organization_roles (organization_id, user_id, role)
            VALUES (v_inv.organization_id, NEW.id, v_inv.role)
            ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

            UPDATE public.employee_invitations SET accepted_at = now() WHERE id = v_inv.id;
        EXCEPTION WHEN others THEN
            -- Ne jamais bloquer la création du compte (ex: quota atteint entre-temps)
            RAISE WARNING 'Auto-acceptation invitation échouée pour %: %', NEW.email, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

SELECT 'SUCCESS - hardening 3/3 (lifecycle) applied' AS result;
