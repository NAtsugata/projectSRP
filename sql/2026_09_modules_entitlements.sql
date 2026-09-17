-- ============================================================
-- MODULES VENDABLES SÉPARÉMENT : catalogue, formules, droits par organisation,
-- évaluation, RPC UI/super-admin, verrou en écriture.
-- Appliquée en production le 17/09/2026 (migration "modules_entitlements").
-- Voir docs/MODULES_ET_ABONNEMENTS.md
-- ============================================================

-- 1. Catalogue
CREATE TABLE IF NOT EXISTS public.app_modules (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  category text,
  is_core boolean NOT NULL DEFAULT false,
  price_monthly_cents integer,
  sort_order integer NOT NULL DEFAULT 100
);
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_modules_select ON public.app_modules;
CREATE POLICY app_modules_select ON public.app_modules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS app_modules_write ON public.app_modules;
CREATE POLICY app_modules_write ON public.app_modules FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_modules TO authenticated;

INSERT INTO public.app_modules (key, label, description, category, sort_order) VALUES
 ('chantiers',      'Suivi de chantier',       'Chantiers, lots, zones, documents et photos (maîtrise d''œuvre)', 'terrain',    10),
 ('smart-planning', 'Planning intelligent',    'Planification multi-jours et affectation automatique',           'terrain',    20),
 ('agenda',         'Agenda',                  'Vue agenda / calendrier des interventions',                       'terrain',    30),
 ('archives',       'Archives',                'Interventions archivées et historique',                           'terrain',    40),
 ('checklists',     'Checklists',              'Listes de contrôle et modèles',                                   'terrain',    50),
 ('ir-docs',        'IR Douche',               'Formulaires IR Douche',                                           'terrain',    60),
 ('leaves',         'Congés',                  'Demandes et validation des congés',                               'gestion',    70),
 ('expenses',       'Notes de frais',          'Dépenses, justificatifs et validation',                           'gestion',    80),
 ('vault',          'Coffre-fort',             'Documents partagés par employé',                                  'gestion',    90),
 ('documents',      'Mes documents',           'Documents personnels et scans',                                   'gestion',   100),
 ('monthly-export', 'Export comptable',        'Export mensuel des interventions, frais et absences',             'gestion',   110),
 ('clients',        'Clients',                 'Fichier clients et contacts',                                     'commercial', 120),
 ('invoices',       'Devis & factures',        'Devis, factures, relances',                                       'commercial', 130),
 ('catalog',        'Catalogue',               'Articles et prestations',                                         'commercial', 140),
 ('contracts',      'Contrats de maintenance', 'Contrats, équipements, visites',                                  'commercial', 150),
 ('cerfa',          'CERFA',                   'Génération et suivi des CERFA',                                   'conformite', 160),
 ('aides',          'Aides d''État',           'Calculateur CEE / MaPrimeRénov''',                                'conformite', 170)
ON CONFLICT (key) DO NOTHING;

-- 2. Formules : modules inclus par plan
CREATE TABLE IF NOT EXISTS public.plan_modules (
  plan text NOT NULL,
  module_key text NOT NULL REFERENCES public.app_modules(key) ON DELETE CASCADE,
  PRIMARY KEY (plan, module_key)
);
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_modules_select ON public.plan_modules;
CREATE POLICY plan_modules_select ON public.plan_modules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS plan_modules_write ON public.plan_modules;
CREATE POLICY plan_modules_write ON public.plan_modules FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_modules TO authenticated;

INSERT INTO public.plan_modules (plan, module_key)
SELECT p, k FROM (VALUES
  ('free',    ARRAY['agenda']),
  ('starter', ARRAY['agenda','leaves','expenses','documents','checklists','archives']),
  ('pro',     ARRAY['agenda','leaves','expenses','documents','checklists','archives','clients','invoices','catalog','contracts','vault','monthly-export','cerfa','aides','ir-docs']),
  ('premium', ARRAY['agenda','leaves','expenses','documents','checklists','archives','clients','invoices','catalog','contracts','vault','monthly-export','cerfa','aides','ir-docs']),
  ('enterprise', ARRAY['agenda','leaves','expenses','documents','checklists','archives','clients','invoices','catalog','contracts','vault','monthly-export','cerfa','aides','ir-docs','chantiers','smart-planning'])
) AS t(p, keys), unnest(t.keys) AS k
ON CONFLICT DO NOTHING;

-- 3. Droits explicites par organisation (à la carte, essai, dérogation)
CREATE TABLE IF NOT EXISTS public.organization_modules (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.app_modules(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('plan','addon','trial','manual')),
  ends_at timestamptz,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (organization_id, module_key)
);
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_modules_select ON public.organization_modules;
CREATE POLICY organization_modules_select ON public.organization_modules FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id() OR public.current_user_is_super_admin());
DROP POLICY IF EXISTS organization_modules_write ON public.organization_modules;
CREATE POLICY organization_modules_write ON public.organization_modules FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_modules TO authenticated;

-- 4. Évaluation : cœur > droit explicite (non expiré) > formule
CREATE OR REPLACE FUNCTION public.org_has_module(p_org uuid, p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_key IS NULL OR p_org IS NULL THEN true
    WHEN NOT EXISTS (SELECT 1 FROM public.app_modules m WHERE m.key = p_key) THEN true
    WHEN EXISTS (SELECT 1 FROM public.app_modules m WHERE m.key = p_key AND m.is_core) THEN true
    WHEN EXISTS (SELECT 1 FROM public.organization_modules om WHERE om.organization_id = p_org AND om.module_key = p_key)
      THEN (SELECT om.enabled AND (om.ends_at IS NULL OR om.ends_at > now())
            FROM public.organization_modules om WHERE om.organization_id = p_org AND om.module_key = p_key)
    ELSE EXISTS (SELECT 1 FROM public.plan_modules pm JOIN public.organizations o ON o.id = p_org
                 WHERE pm.plan = o.plan AND pm.module_key = p_key)
  END;
$$;
CREATE OR REPLACE FUNCTION public.current_org_has_module(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_is_super_admin() OR public.org_has_module(public.current_user_org_id(), p_key);
$$;
REVOKE ALL ON FUNCTION public.org_has_module(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_org_has_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_has_module(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_has_module(text) TO authenticated;

-- 5. RPC interface : modules effectifs de l'organisation courante
CREATE OR REPLACE FUNCTION public.org_effective_modules()
RETURNS TABLE(module_key text, label text, description text, category text, sort_order integer,
              enabled boolean, source text, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.key, m.label, m.description, m.category, m.sort_order,
         public.current_user_is_super_admin() OR public.org_has_module(public.current_user_org_id(), m.key),
         CASE WHEN om.organization_id IS NOT NULL THEN om.source
              WHEN EXISTS (SELECT 1 FROM public.plan_modules pm JOIN public.organizations o ON o.id = public.current_user_org_id()
                           WHERE pm.plan = o.plan AND pm.module_key = m.key) THEN 'plan'
              ELSE 'none' END,
         om.ends_at
  FROM public.app_modules m
  LEFT JOIN public.organization_modules om
         ON om.organization_id = public.current_user_org_id() AND om.module_key = m.key
  WHERE NOT m.is_core
  ORDER BY m.sort_order;
$$;
REVOKE ALL ON FUNCTION public.org_effective_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_effective_modules() TO authenticated;

-- 6. RPC super-admin : lecture et réglage des modules d'une organisation
CREATE OR REPLACE FUNCTION public.admin_organization_modules(p_org uuid)
RETURNS TABLE(module_key text, label text, category text, sort_order integer,
              enabled boolean, source text, ends_at timestamptz, is_explicit boolean, in_plan boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Réservé au super-administrateur (code: not_super_admin)';
  END IF;
  RETURN QUERY
  SELECT m.key, m.label, m.category, m.sort_order,
         public.org_has_module(p_org, m.key),
         coalesce(om.source, 'plan'),
         om.ends_at,
         om.organization_id IS NOT NULL,
         EXISTS (SELECT 1 FROM public.plan_modules pm JOIN public.organizations o ON o.id = p_org
                 WHERE pm.plan = o.plan AND pm.module_key = m.key)
  FROM public.app_modules m
  LEFT JOIN public.organization_modules om ON om.organization_id = p_org AND om.module_key = m.key
  WHERE NOT m.is_core
  ORDER BY m.sort_order;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_organization_module(
  p_org uuid, p_key text, p_enabled boolean, p_source text DEFAULT 'manual', p_ends_at timestamptz DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Réservé au super-administrateur (code: not_super_admin)';
  END IF;
  INSERT INTO public.organization_modules (organization_id, module_key, enabled, source, ends_at, note, updated_at, updated_by)
  VALUES (p_org, p_key, p_enabled, coalesce(p_source, 'manual'), p_ends_at, p_note, now(), auth.uid())
  ON CONFLICT (organization_id, module_key) DO UPDATE
    SET enabled = EXCLUDED.enabled, source = EXCLUDED.source, ends_at = EXCLUDED.ends_at,
        note = EXCLUDED.note, updated_at = now(), updated_by = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_organization_module(p_org uuid, p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Réservé au super-administrateur (code: not_super_admin)';
  END IF;
  DELETE FROM public.organization_modules WHERE organization_id = p_org AND module_key = p_key;
END $$;

REVOKE ALL ON FUNCTION public.admin_organization_modules(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_organization_module(uuid, text, boolean, text, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_organization_module(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_organization_modules(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_module(uuid, text, boolean, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_organization_module(uuid, text) TO authenticated;

-- 7. Verrou en écriture : module désactivé => aucune création/modification
--    (la lecture reste possible ; le super-admin n'est jamais bloqué)
CREATE OR REPLACE FUNCTION public.enforce_module_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_ok boolean := true;
BEGIN
  BEGIN
    IF public.current_user_is_super_admin() THEN RETURN NEW; END IF;
    v_org := coalesce(public.uuid_or_null(to_jsonb(NEW)->>'organization_id'), public.current_user_org_id());
    IF v_org IS NULL THEN RETURN NEW; END IF;
    v_ok := public.org_has_module(v_org, TG_ARGV[0]);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Module « % » non inclus dans l''abonnement (code: module_not_active)', TG_ARGV[0];
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_module_access() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('chantiers','chantiers'), ('chantier_lots','chantiers'), ('chantier_zones','chantiers'),
    ('chantier_tasks','chantiers'), ('chantier_documents','chantiers'), ('chantier_media','chantiers'),
    ('leave_requests','leaves'), ('employee_absences','leaves'),
    ('expenses','expenses'), ('expense_receipts','expenses'),
    ('vault_documents','vault'), ('shared_vault_access','vault'),
    ('scanned_documents','documents'),
    ('checklists','checklists'), ('checklist_templates','checklists'),
    ('maintenance_contracts','contracts'), ('contract_equipment','contracts'),
    ('contract_visits','contracts'), ('maintenance_reports','contracts'),
    ('clients','clients'), ('client_contacts','clients'),
    ('invoices','invoices'), ('invoice_items','invoices'), ('quotes','invoices'),
    ('quote_items','invoices'), ('quote_attachments','invoices'), ('quote_templates','invoices'),
    ('catalog_items','catalog'), ('catalog_categories','catalog'),
    ('cerfa_documents','cerfa')
  ) AS t(tbl, module)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_module_access ON public.%I', r.tbl);
    EXECUTE format('CREATE TRIGGER trg_module_access BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_module_access(%L)', r.tbl, r.module);
  END LOOP;
END $$;

-- 8. Aucune régression : les organisations existantes conservent tous les modules
INSERT INTO public.organization_modules (organization_id, module_key, enabled, source, note)
SELECT o.id, m.key, true, 'manual', 'Activé lors de la mise en place des modules'
FROM public.organizations o CROSS JOIN public.app_modules m
WHERE NOT m.is_core
ON CONFLICT DO NOTHING;
