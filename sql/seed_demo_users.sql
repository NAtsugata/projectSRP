-- ============================================================
-- CRÉATION DES UTILISATEURS DE TEST
-- ============================================================
-- IMPORTANT: Seul nico@test.com est un vrai compte (créé dans Auth)
-- Les autres (Sophie, Marc, Julie) sont des utilisateurs FICTIFS
-- pour peupler le dashboard et les données de démonstration
--
-- Utilisateur réel à créer dans Supabase Auth :
-- - Email: nico@test.com
-- - Mot de passe: Test2024!
-- - UUID: 156097ea-ffb8-4ecb-9688-1e58313cd1f8 (déjà créé)
--
-- Utilisateurs fictifs (générés automatiquement):
-- - Sophie Dubois (Manager)
-- - Marc Lefebvre (Technicien)
-- - Julie Roux (Technicienne)
-- ============================================================

DO $$
DECLARE
  demo_org_id uuid;

  -- Seul Nico est un vrai utilisateur avec authentification
  nico_id uuid := '156097ea-ffb8-4ecb-9688-1e58313cd1f8';

  -- Utilisateurs fictifs (UUIDs générés automatiquement)
  sophie_id uuid := gen_random_uuid();
  marc_id uuid := gen_random_uuid();
  julie_id uuid := gen_random_uuid();

BEGIN
  -- Récupérer l'ID de l'organisation démo
  SELECT id INTO demo_org_id FROM organizations WHERE slug = 'demo-srp';

  IF demo_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation de démonstration non trouvée. Exécutez d''abord create_demo_organization.sql';
  END IF;

  RAISE NOTICE 'Organisation démo trouvée: %', demo_org_id;

  -- Créer les profils pour chaque utilisateur
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    organization_id,
    is_admin,
    phone,
    created_at,
    updated_at
  ) VALUES
    (
      nico_id,
      'Nico Martin',
      'nico@test.com',
      demo_org_id,
      true,  -- Admin mais sans accès facturation
      '+33 6 12 34 56 78',
      NOW(),
      NOW()
    ),
    (
      sophie_id,
      'Sophie Dubois',
      'sophie@test.com',
      demo_org_id,
      false,
      '+33 6 23 45 67 89',
      NOW(),
      NOW()
    ),
    (
      marc_id,
      'Marc Lefebvre',
      'marc@test.com',
      demo_org_id,
      false,
      '+33 6 34 56 78 90',
      NOW(),
      NOW()
    ),
    (
      julie_id,
      'Julie Roux',
      'julie@test.com',
      demo_org_id,
      false,
      '+33 6 45 67 89 01',
      NOW(),
      NOW()
    )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    is_admin = EXCLUDED.is_admin,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  RAISE NOTICE '✓ Profils créés pour 4 utilisateurs';

  -- Assigner les rôles organisationnels
  INSERT INTO public.organization_roles (
    organization_id,
    user_id,
    role,
    created_at
  ) VALUES
    (demo_org_id, nico_id, 'admin', NOW()),      -- Admin (pas owner pour bloquer facturation)
    (demo_org_id, sophie_id, 'manager', NOW()),
    (demo_org_id, marc_id, 'technician', NOW()),
    (demo_org_id, julie_id, 'technician', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;

  RAISE NOTICE '✓ Rôles assignés';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'UTILISATEURS DE TEST CRÉÉS';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 COMPTE RÉEL (peut se connecter):';
  RAISE NOTICE '  Email: nico@test.com';
  RAISE NOTICE '  Mot de passe: Test2024!';
  RAISE NOTICE '  Nom: Nico Martin';
  RAISE NOTICE '  Rôle: Admin';
  RAISE NOTICE '  Accès: Dashboard, Planning, Interventions, Clients, Congés, etc.';
  RAISE NOTICE '  ⛔ PAS d''accès: Facturation';
  RAISE NOTICE '';
  RAISE NOTICE '👥 UTILISATEURS FICTIFS (pour peupler les données):';
  RAISE NOTICE '  - Sophie Dubois (Manager) - ID: %', sophie_id;
  RAISE NOTICE '  - Marc Lefebvre (Technicien) - ID: %', marc_id;
  RAISE NOTICE '  - Julie Roux (Technicienne) - ID: %', julie_id;
  RAISE NOTICE '';
  RAISE NOTICE '💡 Ces utilisateurs fictifs apparaissent dans le dashboard,';
  RAISE NOTICE '   les interventions, les dépenses, etc. mais ne peuvent';
  RAISE NOTICE '   PAS se connecter à l''application.';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

END $$;
