-- ============================================================
-- FIX: Politique RLS profiles qui bloque la connexion
-- ============================================================
-- PROBLÈME : La politique "View profiles" filtrait par organization_id
-- mais current_user_org_id() a besoin de lire profiles pour fonctionner
-- → récursion / blocage quand organization_id est NULL
--
-- SOLUTION : Ajouter une politique "View own profile" qui permet
-- toujours à un utilisateur de lire son propre profil (id = auth.uid())
-- ============================================================

-- 1. Fonction helper pour vérifier super admin sans récursion
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
        false
    );
$$;

-- 2. Supprimer les anciennes politiques sur profiles
DROP POLICY IF EXISTS "View profiles" ON public.profiles;
DROP POLICY IF EXISTS "View own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

-- 3. Politique : chaque utilisateur voit TOUJOURS son propre profil
CREATE POLICY "View own profile" ON public.profiles
FOR SELECT TO authenticated USING (
    id = auth.uid()
);

-- 4. Politique : voir les profils de la même organisation (+ super admin)
CREATE POLICY "View profiles" ON public.profiles
FOR SELECT TO authenticated USING (
    organization_id = public.current_user_org_id()
    OR public.current_user_is_super_admin()
);

-- 5. Politique : modifier son propre profil
CREATE POLICY "Update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (
    id = auth.uid()
) WITH CHECK (
    id = auth.uid()
);

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'SUCCESS - Profiles RLS fixed, login should work now' as result;
