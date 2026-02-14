-- ============================================================
-- MULTI-TENANCY - Isolation des données par organisation
-- ============================================================
-- Phase 2 de la préparation à la commercialisation.
-- Chaque client/entreprise a sa propre organisation isolée.
--
-- IMPORTANT: Exécuter dans Supabase SQL Editor après backup.
-- Exécuter APRÈS security_hardening.sql
-- ============================================================

-- ============================================================
-- 1. TABLE ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,           -- URL-friendly identifier (ex: "srp-digne")
    logo_url text,
    address text,
    phone text,
    email text,
    siret text,
    plan text DEFAULT 'standard',         -- 'trial', 'standard', 'premium'
    max_users integer DEFAULT 50,
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',          -- Config spécifique (timezone, langue, etc.)
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Index pour recherche rapide par slug
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- ============================================================
-- 2. AJOUTER organization_id AUX TABLES EXISTANTES
-- ============================================================

-- PROFILES : Chaque utilisateur appartient à une organisation
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- INTERVENTIONS
ALTER TABLE public.interventions
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- EXPENSES
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- LEAVE_REQUESTS
ALTER TABLE public.leave_requests
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- VAULT_DOCUMENTS
ALTER TABLE public.vault_documents
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- CERFA_DOCUMENTS
ALTER TABLE public.cerfa_documents
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- INTERVENTION_TEMPLATES
ALTER TABLE public.intervention_templates
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- MAINTENANCE_CONTRACTS
ALTER TABLE public.maintenance_contracts
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- CHECKLIST_TEMPLATES
ALTER TABLE public.checklist_templates
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- EMPLOYEE_ABSENCES
ALTER TABLE public.employee_absences
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- SCANNED_DOCUMENTS
ALTER TABLE public.scanned_documents
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- ============================================================
-- 3. INDEX pour performance des requêtes filtrées par org
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_interventions_org ON public.interventions(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON public.leave_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_vault_documents_org ON public.vault_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_org ON public.maintenance_contracts(organization_id);

-- ============================================================
-- 4. HELPER FUNCTION : Récupérer l'organization_id de l'utilisateur courant
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 5. TABLE ROLES PAR ORGANISATION (remplace is_admin à terme)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'technician',  -- 'owner', 'admin', 'manager', 'technician'
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_roles_user ON public.organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_org_roles_org ON public.organization_roles(organization_id);

-- ============================================================
-- 6. SUPER ADMIN (gestion de la plateforme)
-- ============================================================
-- Le super admin est identifié par un flag séparé sur profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- ============================================================
-- 7. HELPER FUNCTION : Vérifier le rôle dans l'organisation
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_org_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_roles
        WHERE user_id = auth.uid()
        AND organization_id = public.current_user_org_id()
        AND role = required_role
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_roles
        WHERE user_id = auth.uid()
        AND organization_id = public.current_user_org_id()
        AND role IN ('owner', 'admin')
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND is_super_admin = true
    );
$$;

-- ============================================================
-- 8. RLS SUR ORGANIZATIONS
-- ============================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own organization" ON public.organizations
FOR SELECT TO authenticated USING (
    id = public.current_user_org_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

CREATE POLICY "Super admin manage organizations" ON public.organizations
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- ============================================================
-- 9. RLS SUR ORGANIZATION_ROLES
-- ============================================================
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View org roles" ON public.organization_roles
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
);

CREATE POLICY "Admin manage org roles" ON public.organization_roles
FOR ALL TO authenticated USING (
    public.is_org_admin()
) WITH CHECK (
    public.is_org_admin()
);

-- ============================================================
-- 10. MIGRATION DES DONNÉES EXISTANTES
-- ============================================================
-- Créer une organisation par défaut pour les données existantes
-- À exécuter UNE SEULE FOIS lors de la migration initiale

DO $$
DECLARE
    default_org_id uuid;
BEGIN
    -- Créer l'organisation par défaut seulement si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = 'default') THEN
        INSERT INTO public.organizations (name, slug, plan)
        VALUES ('Organisation par défaut', 'default', 'standard')
        RETURNING id INTO default_org_id;

        -- Assigner tous les profils existants à cette organisation
        UPDATE public.profiles SET organization_id = default_org_id WHERE organization_id IS NULL;

        -- Assigner toutes les données existantes
        UPDATE public.interventions SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.expenses SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.leave_requests SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.vault_documents SET organization_id = default_org_id WHERE organization_id IS NULL;
        UPDATE public.maintenance_contracts SET organization_id = default_org_id WHERE organization_id IS NULL;

        -- Créer les rôles pour les admins existants
        INSERT INTO public.organization_roles (organization_id, user_id, role)
        SELECT default_org_id, id, 'admin'
        FROM public.profiles
        WHERE is_admin = true
        ON CONFLICT DO NOTHING;

        -- Créer les rôles pour les non-admins
        INSERT INTO public.organization_roles (organization_id, user_id, role)
        SELECT default_org_id, id, 'technician'
        FROM public.profiles
        WHERE is_admin = false OR is_admin IS NULL
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Migration terminée: organisation "default" créée avec ID %', default_org_id;
    ELSE
        RAISE NOTICE 'Organisation "default" existe déjà, migration ignorée';
    END IF;
END $$;

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'SUCCESS - Multi-tenant setup complete' as result;
SELECT count(*) as organizations FROM public.organizations;
SELECT count(*) as profiles_with_org FROM public.profiles WHERE organization_id IS NOT NULL;
SELECT count(*) as org_roles FROM public.organization_roles;
