-- =============================
-- CORRECTIONS SÉCURITÉ SUPABASE - PARTIE 2
-- À exécuter dans Supabase SQL Editor
-- =============================

-- =============================
-- 1. optimize_upload_metadata
-- =============================
CREATE OR REPLACE FUNCTION optimize_upload_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================
-- 2. cleanup_old_data
-- =============================
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    -- Nettoyage des anciennes données (à adapter selon votre logique)
    NULL;
END;
$$;

-- =============================
-- 3. update_checklist_templates_updated_at
-- =============================
CREATE OR REPLACE FUNCTION update_checklist_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================
-- 4. update_checklists_updated_at
-- =============================
CREATE OR REPLACE FUNCTION update_checklists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================
-- 5. refresh_all_expense_stats
-- =============================
CREATE OR REPLACE FUNCTION refresh_all_expense_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expense_global_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expense_stats_by_user;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expense_stats_by_month;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expense_recent_activity;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expenses_to_pay;
EXCEPTION WHEN OTHERS THEN
    -- Si CONCURRENTLY échoue, essayer sans
    REFRESH MATERIALIZED VIEW public.expense_global_stats;
    REFRESH MATERIALIZED VIEW public.expense_stats_by_user;
    REFRESH MATERIALIZED VIEW public.expense_stats_by_month;
    REFRESH MATERIALIZED VIEW public.expense_recent_activity;
    REFRESH MATERIALIZED VIEW public.expenses_to_pay;
END;
$$;

-- =============================
-- 6. refresh_realtime_expense_stats
-- =============================
CREATE OR REPLACE FUNCTION refresh_realtime_expense_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expense_global_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expense_recent_activity;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.expenses_to_pay;
EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.expense_global_stats;
    REFRESH MATERIALIZED VIEW public.expense_recent_activity;
    REFRESH MATERIALIZED VIEW public.expenses_to_pay;
END;
$$;

-- =============================
-- 7. trigger_refresh_expense_stats
-- =============================
CREATE OR REPLACE FUNCTION trigger_refresh_expense_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    PERFORM public.refresh_realtime_expense_stats();
    RETURN NULL;
END;
$$;

-- =============================
-- 8. get_expense_global_stats
-- =============================
CREATE OR REPLACE FUNCTION get_expense_global_stats()
RETURNS TABLE (
    total_count BIGINT,
    total_amount NUMERIC,
    pending_count BIGINT,
    pending_amount NUMERIC,
    approved_count BIGINT,
    approved_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_count,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE e.status = 'pending')::BIGINT as pending_count,
        COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'pending'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE e.status = 'approved')::BIGINT as approved_count,
        COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'approved'), 0) as approved_amount
    FROM public.expenses e;
END;
$$;

-- =============================
-- 9. get_expense_stats_by_user
-- =============================
CREATE OR REPLACE FUNCTION get_expense_stats_by_user(p_user_id UUID)
RETURNS TABLE (
    total_count BIGINT,
    total_amount NUMERIC,
    pending_count BIGINT,
    pending_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_count,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE e.status = 'pending')::BIGINT as pending_count,
        COALESCE(SUM(e.amount) FILTER (WHERE e.status = 'pending'), 0) as pending_amount
    FROM public.expenses e
    WHERE e.user_id = p_user_id;
END;
$$;

-- =============================
-- 10. update_expenses_updated_at
-- =============================
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================
-- 11. update_scanned_documents_updated_at
-- =============================
CREATE OR REPLACE FUNCTION update_scanned_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =============================
-- 12. FIX: Materialized Views - Restreindre l'accès
-- =============================
-- Révoquer l'accès anon et ne garder que authenticated

REVOKE SELECT ON public.expense_global_stats FROM anon;
REVOKE SELECT ON public.expense_stats_by_user FROM anon;
REVOKE SELECT ON public.expense_stats_by_month FROM anon;
REVOKE SELECT ON public.expense_recent_activity FROM anon;
REVOKE SELECT ON public.expenses_to_pay FROM anon;

-- S'assurer que authenticated a accès
GRANT SELECT ON public.expense_global_stats TO authenticated;
GRANT SELECT ON public.expense_stats_by_user TO authenticated;
GRANT SELECT ON public.expense_stats_by_month TO authenticated;
GRANT SELECT ON public.expense_recent_activity TO authenticated;
GRANT SELECT ON public.expenses_to_pay TO authenticated;

-- =============================
-- 13. FIX: contract_history RLS Policy
-- =============================
-- Supprimer la policy trop permissive et la remplacer

DROP POLICY IF EXISTS "Manage history" ON public.contract_history;

-- Politique de lecture: tous les utilisateurs authentifiés
CREATE POLICY "Users can view contract history"
ON public.contract_history
FOR SELECT
TO authenticated
USING (true);

-- Politique d'insertion: seulement les utilisateurs authentifiés
CREATE POLICY "Users can insert contract history"
ON public.contract_history
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

-- Politique de suppression: seulement les admins
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

-- =============================
-- FIN DES CORRECTIONS
-- =============================
