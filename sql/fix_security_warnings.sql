-- =============================
-- CORRECTIONS SÉCURITÉ SUPABASE
-- À exécuter dans Supabase SQL Editor
-- =============================
-- Ce script corrige les warnings du Supabase Linter concernant:
-- - SECURITY DEFINER avec search_path mutable
-- - Fonctions sans search_path explicite
-- =============================

-- =============================
-- 1. CERFA - get_next_cerfa_numero
-- =============================
CREATE OR REPLACE FUNCTION get_next_cerfa_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    next_num INTEGER;
BEGIN
    next_num := nextval('public.cerfa_numero_seq');
    RETURN 'CERFA-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- =============================
-- 2. MAINTENANCE CONTRACTS - Triggers
-- =============================

-- Trigger update_contracts_updated_at
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
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

-- Trigger update_visits_updated_at
CREATE OR REPLACE FUNCTION update_visits_updated_at()
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
-- 3. generate_contract_number
-- =============================
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_year TEXT;
    v_sequence INTEGER;
    v_number TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(contract_number FROM 'CT-' || v_year || '-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO v_sequence
    FROM public.maintenance_contracts
    WHERE contract_number LIKE 'CT-' || v_year || '-%';

    v_number := 'CT-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');

    RETURN v_number;
END;
$$;

-- =============================
-- 4. generate_contract_visits
-- =============================
CREATE OR REPLACE FUNCTION generate_contract_visits(p_contract_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_contract RECORD;
    v_visit_date DATE;
    v_interval INTERVAL;
    v_count INTEGER := 0;
BEGIN
    -- Récupérer le contrat
    SELECT * INTO v_contract FROM public.maintenance_contracts WHERE id = p_contract_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contrat non trouvé: %', p_contract_id;
    END IF;

    -- Définir l'intervalle selon la fréquence
    CASE v_contract.frequency
        WHEN 'monthly' THEN v_interval := INTERVAL '1 month';
        WHEN 'bimonthly' THEN v_interval := INTERVAL '2 months';
        WHEN 'quarterly' THEN v_interval := INTERVAL '3 months';
        WHEN 'biannual' THEN v_interval := INTERVAL '6 months';
        WHEN 'annual' THEN v_interval := INTERVAL '1 year';
        ELSE v_interval := INTERVAL '1 year';
    END CASE;

    -- Supprimer les visites futures non complétées
    DELETE FROM public.contract_visits
    WHERE contract_id = p_contract_id
        AND status IN ('pending', 'scheduled')
        AND scheduled_date > CURRENT_DATE;

    -- Générer les visites
    v_visit_date := GREATEST(v_contract.start_date, CURRENT_DATE);

    WHILE v_visit_date <= v_contract.end_date LOOP
        INSERT INTO public.contract_visits (
            contract_id,
            scheduled_date,
            status,
            assigned_technician_id
        )
        VALUES (
            p_contract_id,
            v_visit_date,
            'pending',
            v_contract.preferred_technician_id
        )
        ON CONFLICT DO NOTHING;
        v_count := v_count + 1;

        v_visit_date := v_visit_date + v_interval;
    END LOOP;

    -- Enregistrer dans l'historique
    INSERT INTO public.contract_history (contract_id, action, notes, performed_by)
    VALUES (p_contract_id, 'updated', v_count || ' visites générées', v_contract.created_by);

    RETURN v_count;
END;
$$;

-- =============================
-- 5. update_expired_contracts
-- =============================
CREATE OR REPLACE FUNCTION update_expired_contracts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_contract RECORD;
BEGIN
    -- Marquer les contrats expirés
    FOR v_contract IN
        SELECT id, status FROM public.maintenance_contracts
        WHERE status = 'active' AND end_date < CURRENT_DATE
    LOOP
        UPDATE public.maintenance_contracts
        SET status = 'expired'
        WHERE id = v_contract.id;

        INSERT INTO public.contract_history (contract_id, action, changes)
        VALUES (v_contract.id, 'updated', '{"field": "status", "old_value": "active", "new_value": "expired"}'::jsonb);

        v_count := v_count + 1;
    END LOOP;

    -- Marquer pour renouvellement ceux qui expirent bientôt
    UPDATE public.maintenance_contracts
    SET status = 'pending_renewal'
    WHERE status = 'active'
        AND end_date <= CURRENT_DATE + (renewal_reminder_days || ' days')::INTERVAL
        AND end_date >= CURRENT_DATE;

    RETURN v_count;
END;
$$;

-- =============================
-- 6. get_contracts_pending_renewal
-- =============================
CREATE OR REPLACE FUNCTION get_contracts_pending_renewal()
RETURNS TABLE (
    id UUID,
    client_name TEXT,
    contract_number VARCHAR(50),
    end_date DATE,
    days_until_expiry INTEGER,
    auto_renew BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc.id,
        mc.client_name,
        mc.contract_number,
        mc.end_date,
        (mc.end_date - CURRENT_DATE)::INTEGER as days_until_expiry,
        mc.auto_renew
    FROM public.maintenance_contracts mc
    WHERE mc.status IN ('active', 'pending_renewal')
        AND mc.end_date <= CURRENT_DATE + INTERVAL '60 days'
    ORDER BY mc.end_date ASC;
END;
$$;

-- =============================
-- 7. get_upcoming_visits
-- =============================
CREATE OR REPLACE FUNCTION get_upcoming_visits(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    visit_id UUID,
    contract_id UUID,
    client_name TEXT,
    client_phone VARCHAR(20),
    client_address TEXT,
    scheduled_date DATE,
    scheduled_time TIME,
    time_slot TEXT,
    status TEXT,
    technician_id UUID,
    technician_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cv.id as visit_id,
        cv.contract_id,
        mc.client_name,
        mc.client_phone,
        mc.client_address,
        cv.scheduled_date,
        cv.scheduled_time,
        cv.time_slot,
        cv.status,
        cv.assigned_technician_id as technician_id,
        p.display_name as technician_name
    FROM public.contract_visits cv
    JOIN public.maintenance_contracts mc ON mc.id = cv.contract_id
    LEFT JOIN public.profiles p ON p.id = cv.assigned_technician_id
    WHERE cv.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days || ' days')::INTERVAL
        AND cv.status IN ('pending', 'scheduled', 'confirmed')
    ORDER BY cv.scheduled_date ASC, cv.scheduled_time ASC NULLS LAST;
END;
$$;

-- =============================
-- 8. get_contract_statistics
-- =============================
CREATE OR REPLACE FUNCTION get_contract_statistics()
RETURNS TABLE (
    total_contracts BIGINT,
    active_contracts BIGINT,
    expired_contracts BIGINT,
    pending_renewal BIGINT,
    total_revenue DECIMAL(12,2),
    visits_this_month BIGINT,
    visits_completed_this_month BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_contracts,
        COUNT(*) FILTER (WHERE mc.status = 'active')::BIGINT as active_contracts,
        COUNT(*) FILTER (WHERE mc.status = 'expired')::BIGINT as expired_contracts,
        COUNT(*) FILTER (WHERE mc.status = 'pending_renewal')::BIGINT as pending_renewal,
        COALESCE(SUM(mc.price) FILTER (WHERE mc.status = 'active'), 0) as total_revenue,
        (SELECT COUNT(*) FROM public.contract_visits cv
         WHERE DATE_TRUNC('month', cv.scheduled_date) = DATE_TRUNC('month', CURRENT_DATE))::BIGINT as visits_this_month,
        (SELECT COUNT(*) FROM public.contract_visits cv
         WHERE DATE_TRUNC('month', cv.completed_at) = DATE_TRUNC('month', CURRENT_DATE)
         AND cv.status = 'completed')::BIGINT as visits_completed_this_month
    FROM public.maintenance_contracts mc;
END;
$$;

-- =============================
-- 9. auto_generate_contract_number (Trigger)
-- =============================
CREATE OR REPLACE FUNCTION auto_generate_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NEW.contract_number IS NULL THEN
        NEW.contract_number := generate_contract_number();
    END IF;
    RETURN NEW;
END;
$$;

-- =============================
-- 10. log_contract_changes (Trigger)
-- =============================
CREATE OR REPLACE FUNCTION log_contract_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_changes JSONB := '[]'::JSONB;
BEGIN
    -- Détecter les changements importants
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_changes := v_changes || jsonb_build_object(
            'field', 'status',
            'old_value', OLD.status,
            'new_value', NEW.status
        );
    END IF;

    IF OLD.end_date IS DISTINCT FROM NEW.end_date THEN
        v_changes := v_changes || jsonb_build_object(
            'field', 'end_date',
            'old_value', OLD.end_date::TEXT,
            'new_value', NEW.end_date::TEXT
        );
    END IF;

    IF OLD.price IS DISTINCT FROM NEW.price THEN
        v_changes := v_changes || jsonb_build_object(
            'field', 'price',
            'old_value', OLD.price::TEXT,
            'new_value', NEW.price::TEXT
        );
    END IF;

    -- Enregistrer si des changements ont été détectés
    IF jsonb_array_length(v_changes) > 0 THEN
        INSERT INTO public.contract_history (contract_id, action, changes)
        VALUES (NEW.id, 'updated', v_changes);
    END IF;

    RETURN NEW;
END;
$$;

-- =============================
-- 11. Recréer les vues avec SECURITY INVOKER
-- =============================

-- Supprimer et recréer la vue v_contracts_summary
DROP VIEW IF EXISTS v_contracts_summary;
CREATE VIEW v_contracts_summary
WITH (security_invoker = true)
AS
SELECT
    mc.*,
    p.display_name as created_by_name,
    pt.display_name as preferred_technician_name,
    (mc.end_date - CURRENT_DATE) as days_until_expiry,
    (SELECT COUNT(*) FROM public.contract_visits cv WHERE cv.contract_id = mc.id) as total_visits,
    (SELECT COUNT(*) FROM public.contract_visits cv WHERE cv.contract_id = mc.id AND cv.status = 'completed') as completed_visits,
    (SELECT COUNT(*) FROM public.contract_equipment ce WHERE ce.contract_id = mc.id) as equipment_count
FROM public.maintenance_contracts mc
LEFT JOIN public.profiles p ON p.id = mc.created_by
LEFT JOIN public.profiles pt ON pt.id = mc.preferred_technician_id;

-- Supprimer et recréer la vue v_today_visits
DROP VIEW IF EXISTS v_today_visits;
CREATE VIEW v_today_visits
WITH (security_invoker = true)
AS
SELECT
    cv.*,
    mc.client_name,
    mc.client_phone,
    mc.client_address,
    mc.client_email,
    mc.access_instructions,
    p.display_name as technician_name
FROM public.contract_visits cv
JOIN public.maintenance_contracts mc ON mc.id = cv.contract_id
LEFT JOIN public.profiles p ON p.id = cv.assigned_technician_id
WHERE cv.scheduled_date = CURRENT_DATE
ORDER BY cv.scheduled_time ASC NULLS LAST;

-- =============================
-- VÉRIFICATION
-- =============================
-- Exécutez cette requête pour vérifier que les fonctions sont correctement configurées:

SELECT
    p.proname as function_name,
    CASE p.prosecdef
        WHEN true THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as security_type,
    pg_get_functiondef(p.oid) LIKE '%search_path%' as has_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'get_next_cerfa_numero',
    'update_contracts_updated_at',
    'update_visits_updated_at',
    'generate_contract_number',
    'generate_contract_visits',
    'update_expired_contracts',
    'get_contracts_pending_renewal',
    'get_upcoming_visits',
    'get_contract_statistics',
    'auto_generate_contract_number',
    'log_contract_changes'
);

-- =============================
-- FIN DES CORRECTIONS
-- =============================
