-- ==========================================
-- MIGRATION: Ajout politique RLS pour suppression admin des notes de frais
-- ==========================================
-- À exécuter dans Supabase SQL Editor
-- Permet aux administrateurs de supprimer n'importe quelle note de frais

-- Policy: Les admins peuvent supprimer n'importe quelle note de frais
CREATE POLICY "Admins can delete any expense"
    ON public.expenses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- Vérification
-- SELECT * FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Admins can delete any expense';
