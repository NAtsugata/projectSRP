-- ============================================================
-- PERMISSIONS EMPLOYEES - Gestion granulaire des permissions
-- ============================================================
-- Permet aux admins de donner des pouvoirs specifiques aux employes
-- et de partager l'acces a certains dossiers admin
-- ============================================================

-- ============================================================
-- 1. TABLE DES PERMISSIONS DISPONIBLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.available_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,           -- Code unique de la permission
    name text NOT NULL,                   -- Nom affichable
    description text,                     -- Description de la permission
    category text NOT NULL DEFAULT 'general',  -- Categorie (general, admin, vault, etc.)
    created_at timestamp with time zone DEFAULT now()
);

-- Inserer les permissions de base
INSERT INTO public.available_permissions (code, name, description, category) VALUES
    ('view_all_interventions', 'Voir toutes les interventions', 'Permet de voir les interventions de tous les employes', 'planning'),
    ('edit_all_interventions', 'Modifier toutes les interventions', 'Permet de modifier les interventions de tous les employes', 'planning'),
    ('manage_clients', 'Gerer les clients', 'Acces a la gestion des clients', 'clients'),
    ('view_expenses_all', 'Voir toutes les depenses', 'Voir les notes de frais de tous les employes', 'expenses'),
    ('approve_expenses', 'Approuver les depenses', 'Valider ou refuser les notes de frais', 'expenses'),
    ('view_leave_requests_all', 'Voir toutes les demandes de conges', 'Voir les conges de tous les employes', 'leave'),
    ('approve_leave_requests', 'Approuver les conges', 'Valider ou refuser les demandes de conges', 'leave'),
    ('access_admin_vault', 'Acces coffre-fort admin', 'Voir les documents du coffre-fort administrateur', 'vault'),
    ('manage_vault_documents', 'Gerer les documents coffre', 'Envoyer et supprimer des documents du coffre-fort', 'vault'),
    ('view_invoices', 'Voir les factures', 'Acces a la consultation des factures', 'invoices'),
    ('create_invoices', 'Creer des factures', 'Creer et modifier des factures', 'invoices'),
    ('view_contracts', 'Voir les contrats', 'Acces aux contrats de maintenance', 'contracts'),
    ('manage_contracts', 'Gerer les contrats', 'Creer et modifier les contrats de maintenance', 'contracts'),
    ('access_catalog', 'Acces catalogue', 'Voir et utiliser le catalogue produits/services', 'catalog'),
    ('manage_catalog', 'Gerer le catalogue', 'Ajouter et modifier les elements du catalogue', 'catalog'),
    ('view_reports', 'Voir les rapports', 'Acces aux rapports et statistiques', 'reports'),
    ('manage_checklist_templates', 'Gerer les modeles de checklist', 'Creer et modifier les modeles de checklist', 'checklists')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. TABLE DES PERMISSIONS PAR EMPLOYE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission_code text NOT NULL REFERENCES public.available_permissions(code) ON DELETE CASCADE,
    granted_by uuid REFERENCES public.profiles(id),
    granted_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,  -- NULL = permanent
    organization_id uuid REFERENCES public.organizations(id),
    UNIQUE(user_id, permission_code, organization_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_employee_permissions_user ON public.employee_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_org ON public.employee_permissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_code ON public.employee_permissions(permission_code);

-- ============================================================
-- 3. TABLE DES DOSSIERS PARTAGES (Admin -> Employes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shared_vault_access (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id uuid NOT NULL REFERENCES public.vault_documents(id) ON DELETE CASCADE,
    shared_with_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shared_by_user_id uuid REFERENCES public.profiles(id),
    can_download boolean DEFAULT true,
    can_view boolean DEFAULT true,
    shared_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,  -- NULL = permanent
    organization_id uuid REFERENCES public.organizations(id),
    UNIQUE(document_id, shared_with_user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_shared_vault_user ON public.shared_vault_access(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_vault_doc ON public.shared_vault_access(document_id);

-- ============================================================
-- 4. HELPER FUNCTIONS
-- ============================================================

-- Verifier si un utilisateur a une permission specifique
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_permission_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        -- L'utilisateur a la permission directement
        SELECT 1 FROM public.employee_permissions ep
        WHERE ep.user_id = p_user_id
        AND ep.permission_code = p_permission_code
        AND (ep.expires_at IS NULL OR ep.expires_at > now())
    ) OR EXISTS (
        -- Ou c'est un admin
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_user_id
        AND (p.is_admin = true OR p.is_super_admin = true)
    );
$$;

-- Verifier si l'utilisateur courant a une permission
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT public.user_has_permission(auth.uid(), p_permission_code);
$$;

-- Obtenir toutes les permissions d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS TABLE(permission_code text, permission_name text, category text, expires_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT
        ap.code,
        ap.name,
        ap.category,
        ep.expires_at
    FROM public.employee_permissions ep
    JOIN public.available_permissions ap ON ap.code = ep.permission_code
    WHERE ep.user_id = p_user_id
    AND (ep.expires_at IS NULL OR ep.expires_at > now());
$$;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

-- Available permissions: tout le monde peut lire
ALTER TABLE public.available_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read permissions" ON public.available_permissions
FOR SELECT TO authenticated USING (true);

-- Employee permissions
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent gerer les permissions de leur organisation
CREATE POLICY "Admin manage employee permissions" ON public.employee_permissions
FOR ALL TO authenticated USING (
    (organization_id = public.current_user_org_id() AND public.is_org_admin())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
) WITH CHECK (
    (organization_id = public.current_user_org_id() AND public.is_org_admin())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true)
);

-- Les employes peuvent voir leurs propres permissions
CREATE POLICY "Users view own permissions" ON public.employee_permissions
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Shared vault access
ALTER TABLE public.shared_vault_access ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent gerer les partages
CREATE POLICY "Admin manage shared vault" ON public.shared_vault_access
FOR ALL TO authenticated USING (
    public.is_org_admin()
) WITH CHECK (
    public.is_org_admin()
);

-- Les employes peuvent voir les documents partages avec eux
CREATE POLICY "Users view shared documents" ON public.shared_vault_access
FOR SELECT TO authenticated USING (shared_with_user_id = auth.uid());

-- ============================================================
-- 6. VERIFICATION
-- ============================================================
SELECT 'SUCCESS - Employee permissions system created' as result;
SELECT count(*) as available_permissions FROM public.available_permissions;
