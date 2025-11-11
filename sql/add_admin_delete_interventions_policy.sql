-- ================================================================
-- POLITIQUE RLS: Permettre aux admins de supprimer les interventions
-- ================================================================
-- Ce script ajoute une politique RLS permettant aux administrateurs
-- de supprimer n'importe quelle intervention.
--
-- À exécuter dans le SQL Editor de Supabase:
-- 1. Aller dans Supabase Dashboard
-- 2. Cliquer sur "SQL Editor"
-- 3. Copier-coller ce script
-- 4. Cliquer sur "Run"
-- ================================================================

-- Supprimer la politique si elle existe déjà
DROP POLICY IF EXISTS "Admins can delete interventions" ON public.interventions;

-- Créer la politique permettant aux admins de supprimer
CREATE POLICY "Admins can delete interventions"
ON public.interventions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Vérification: Afficher toutes les politiques sur la table interventions
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'interventions'
ORDER BY policyname;
