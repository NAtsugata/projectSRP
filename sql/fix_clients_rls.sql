-- =============================
-- CORRECTIONS RLS POUR CLIENTS
-- A executer dans Supabase SQL Editor
-- =============================
-- Ce script corrige les politiques RLS pour permettre
-- la modification des clients (standard, VIP, prospect)
-- =============================

-- =============================
-- 1. CLIENTS
-- =============================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS clients_org_isolation ON public.clients;
DROP POLICY IF EXISTS "View clients" ON public.clients;
DROP POLICY IF EXISTS "Create clients" ON public.clients;
DROP POLICY IF EXISTS "Update clients" ON public.clients;
DROP POLICY IF EXISTS "Delete clients" ON public.clients;

-- Politique pour voir les clients
-- Les admins voient tous les clients, les autres voient ceux de leur organisation
CREATE POLICY "View clients" ON public.clients
FOR SELECT TO authenticated USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- Politique pour creer des clients
CREATE POLICY "Create clients" ON public.clients
FOR INSERT TO authenticated WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- Politique pour modifier des clients (inclut standard, VIP, prospect)
CREATE POLICY "Update clients" ON public.clients
FOR UPDATE TO authenticated USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
) WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- Politique pour supprimer des clients (admins seulement)
CREATE POLICY "Delete clients" ON public.clients
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 2. CLIENT_CONTACTS
-- =============================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS client_contacts_org_isolation ON public.client_contacts;
DROP POLICY IF EXISTS "View client contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Create client contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Update client contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Delete client contacts" ON public.client_contacts;

-- Politique pour voir les contacts
CREATE POLICY "View client contacts" ON public.client_contacts
FOR SELECT TO authenticated USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- Politique pour creer des contacts
CREATE POLICY "Create client contacts" ON public.client_contacts
FOR INSERT TO authenticated WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- Politique pour modifier des contacts
CREATE POLICY "Update client contacts" ON public.client_contacts
FOR UPDATE TO authenticated USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
) WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- Politique pour supprimer des contacts
CREATE POLICY "Delete client contacts" ON public.client_contacts
FOR DELETE TO authenticated USING (
    organization_id IN (
        SELECT organization_id FROM public.profiles WHERE id = (select auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND is_admin = true)
);

-- =============================
-- 3. VERIFICATION (optionnel)
-- =============================
-- Verifier que les politiques sont creees correctement
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('clients', 'client_contacts');

-- =============================
-- FIN
-- =============================
SELECT 'SUCCESS - Clients RLS policies fixed' as result;
