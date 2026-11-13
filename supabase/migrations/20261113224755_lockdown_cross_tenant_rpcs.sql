-- Portail SRP — verrouillage des fonctions SECURITY DEFINER appelables par tout compte connecté
-- Vérifié le 13/11/2026 sur la base de production :
--   * aucune de ces fonctions n'est appelée par le front (src/)
--   * aucune n'est utilisée par une policy RLS ni par une valeur par défaut
--   * create_notification n'est appelée que par notify_* (SECURITY DEFINER) : le REVOKE ne casse pas les triggers
-- À placer dans supabase/migrations/ puis appliquer.


-- 1. Fonctions inutilisées par l'application : plus d'appel direct possible via /rest/v1/rpc
REVOKE EXECUTE ON FUNCTION public.check_pv_integrity(uuid)                                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_cerfa_counters()                                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cerfa_counter(uuid, text, integer)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_cerfa_counter(uuid, text, integer, integer)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_cerfa_counter(uuid, text, integer)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_cerfa_counter(text, integer)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_last_km_for_user(uuid, uuid)                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, jsonb)   FROM PUBLIC, anon, authenticated;

-- Les appels serveur (service_role) restent possibles
GRANT EXECUTE ON FUNCTION public.check_pv_integrity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_cerfa_counters() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cerfa_counter(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_cerfa_counter(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_cerfa_counter(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_cerfa_counter(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_last_km_for_user(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, jsonb) TO service_role;

-- 2. Numérotation devis / factures : les triggers set_invoice_number / set_quote_number
--    s'exécutent avec les droits de l'appelant, donc EXECUTE doit rester.
--    On refuse simplement toute organisation autre que celle de l'utilisateur connecté.
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_org_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org_id     uuid := COALESCE(p_org_id, v_caller_org);
  v_year       integer := EXTRACT(YEAR FROM NOW())::integer;
  v_seq        integer;
BEGIN
  IF auth.uid() IS NOT NULL AND v_org_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'Organisation non autorisée (code: wrong_org)';
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation manquante (code: no_org)';
  END IF;
  INSERT INTO public.invoice_counters (organization_id, year, invoice_seq)
  VALUES (v_org_id, v_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET invoice_seq = invoice_counters.invoice_seq + 1, updated_at = NOW()
  RETURNING invoice_seq INTO v_seq;
  RETURN 'FAC-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_quote_number(p_org_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org_id     uuid := COALESCE(p_org_id, v_caller_org);
  v_year       integer := EXTRACT(YEAR FROM NOW())::integer;
  v_seq        integer;
BEGIN
  IF auth.uid() IS NOT NULL AND v_org_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'Organisation non autorisée (code: wrong_org)';
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation manquante (code: no_org)';
  END IF;
  INSERT INTO public.invoice_counters (organization_id, year, quote_seq)
  VALUES (v_org_id, v_year, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET quote_seq = invoice_counters.quote_seq + 1, updated_at = NOW()
  RETURNING quote_seq INTO v_seq;
  RETURN 'DEV-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

