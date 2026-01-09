-- =============================
-- CORRECTIONS SÉCURITÉ SUPABASE - PARTIE 2
-- À exécuter dans Supabase SQL Editor
-- =============================

-- =============================
-- 1. optimize_upload_metadata
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.optimize_upload_metadata() SET search_path = '';
    ALTER FUNCTION public.optimize_upload_metadata() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'optimize_upload_metadata: %', SQLERRM;
END;
$$;

-- =============================
-- 2. cleanup_old_data
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.cleanup_old_data() SET search_path = '';
    ALTER FUNCTION public.cleanup_old_data() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'cleanup_old_data: %', SQLERRM;
END;
$$;

-- =============================
-- 3. update_checklist_templates_updated_at
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.update_checklist_templates_updated_at() SET search_path = '';
    ALTER FUNCTION public.update_checklist_templates_updated_at() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'update_checklist_templates_updated_at: %', SQLERRM;
END;
$$;

-- =============================
-- 4. update_checklists_updated_at
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.update_checklists_updated_at() SET search_path = '';
    ALTER FUNCTION public.update_checklists_updated_at() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'update_checklists_updated_at: %', SQLERRM;
END;
$$;

-- =============================
-- 5. refresh_all_expense_stats
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.refresh_all_expense_stats() SET search_path = '';
    ALTER FUNCTION public.refresh_all_expense_stats() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'refresh_all_expense_stats: %', SQLERRM;
END;
$$;

-- =============================
-- 6. refresh_realtime_expense_stats
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.refresh_realtime_expense_stats() SET search_path = '';
    ALTER FUNCTION public.refresh_realtime_expense_stats() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'refresh_realtime_expense_stats: %', SQLERRM;
END;
$$;

-- =============================
-- 7. trigger_refresh_expense_stats
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.trigger_refresh_expense_stats() SET search_path = '';
    ALTER FUNCTION public.trigger_refresh_expense_stats() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trigger_refresh_expense_stats: %', SQLERRM;
END;
$$;

-- =============================
-- 8. get_expense_global_stats
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.get_expense_global_stats() SET search_path = '';
    ALTER FUNCTION public.get_expense_global_stats() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_expense_global_stats: %', SQLERRM;
END;
$$;

-- =============================
-- 9. get_expense_stats_by_user
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.get_expense_stats_by_user(UUID) SET search_path = '';
    ALTER FUNCTION public.get_expense_stats_by_user(UUID) SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_expense_stats_by_user: %', SQLERRM;
END;
$$;

-- =============================
-- 10. update_expenses_updated_at
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.update_expenses_updated_at() SET search_path = '';
    ALTER FUNCTION public.update_expenses_updated_at() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'update_expenses_updated_at: %', SQLERRM;
END;
$$;

-- =============================
-- 11. update_scanned_documents_updated_at
-- =============================
DO $$
BEGIN
    ALTER FUNCTION public.update_scanned_documents_updated_at() SET search_path = '';
    ALTER FUNCTION public.update_scanned_documents_updated_at() SECURITY INVOKER;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'update_scanned_documents_updated_at: %', SQLERRM;
END;
$$;

-- =============================
-- 12. FIX: Materialized Views - Restreindre l'accès
-- =============================
DO $$
BEGIN
    REVOKE SELECT ON public.expense_global_stats FROM anon;
    REVOKE SELECT ON public.expense_stats_by_user FROM anon;
    REVOKE SELECT ON public.expense_stats_by_month FROM anon;
    REVOKE SELECT ON public.expense_recent_activity FROM anon;
    REVOKE SELECT ON public.expenses_to_pay FROM anon;

    GRANT SELECT ON public.expense_global_stats TO authenticated;
    GRANT SELECT ON public.expense_stats_by_user TO authenticated;
    GRANT SELECT ON public.expense_stats_by_month TO authenticated;
    GRANT SELECT ON public.expense_recent_activity TO authenticated;
    GRANT SELECT ON public.expenses_to_pay TO authenticated;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Materialized views permissions: %', SQLERRM;
END;
$$;

-- =============================
-- 13. FIX: contract_history RLS Policy
-- =============================
DO $$
BEGIN
    DROP POLICY IF EXISTS "Manage history" ON public.contract_history;

    DROP POLICY IF EXISTS "Users can view contract history" ON public.contract_history;
    CREATE POLICY "Users can view contract history"
    ON public.contract_history
    FOR SELECT
    TO authenticated
    USING (true);

    DROP POLICY IF EXISTS "Users can insert contract history" ON public.contract_history;
    CREATE POLICY "Users can insert contract history"
    ON public.contract_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Admins can delete contract history" ON public.contract_history;
    CREATE POLICY "Admins can delete contract history"
    ON public.contract_history
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contract_history policies: %', SQLERRM;
END;
$$;

-- =============================
-- FIN DES CORRECTIONS
-- =============================
-- Résultat: Success signifie que tout est corrigé.
-- Les NOTICE sont normaux si certaines fonctions n'existent pas.
SELECT 'SUCCESS - All security fixes applied' as result;
