-- ============================================================
-- CRÉATION DES UTILISATEURS DE TEST
-- ============================================================
-- IMPORTANT: Avant d'exécuter ce script, créez les utilisateurs
-- via Supabase Dashboard > Authentication > Add User
--
-- Utilisateurs à créer :
-- 1. nico@test.com (Admin - accès à tout SAUF facturation)
-- 2. sophie@test.com (Manager)
-- 3. marc@test.com (Technicien)
-- 4. julie@test.com (Technicienne)
--
-- Mot de passe pour tous : Test2024!
--
-- Puis remplacez les UUIDs ci-dessous par ceux générés
-- ============================================================

DO $$
DECLARE
  demo_org_id uuid;

  -- ⚠️ REMPLACER CES UUIDs PAR CEUX GÉNÉRÉS PAR SUPABASE AUTH ⚠️
  nico_id uuid := '156097ea-ffb8-4ecb-9688-1e58313cd1f8';  -- nico@test.com
  sophie_id uuid := '00000000-0000-0000-0000-000000000002';  -- sophie@test.com
  marc_id uuid := '00000000-0000-0000-0000-000000000003';  -- marc@test.com
  julie_id uuid := '00000000-0000-0000-0000-000000000004';  -- julie@test.com

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
  RAISE NOTICE 'Admin (sans facturation):';
  RAISE NOTICE '  Email: nico@test.com';
  RAISE NOTICE '  Mot de passe: Test2024!';
  RAISE NOTICE '  Nom: Nico Martin';
  RAISE NOTICE '  Accès: Dashboard, Planning, Interventions, Clients, Congés, etc.';
  RAISE NOTICE '  ⛔ PAS d''accès: Facturation';
  RAISE NOTICE '';
  RAISE NOTICE 'Manager:';
  RAISE NOTICE '  Email: sophie@test.com';
  RAISE NOTICE '  Mot de passe: Test2024!';
  RAISE NOTICE '  Nom: Sophie Dubois';
  RAISE NOTICE '';
  RAISE NOTICE 'Technicien:';
  RAISE NOTICE '  Email: marc@test.com';
  RAISE NOTICE '  Mot de passe: Test2024!';
  RAISE NOTICE '  Nom: Marc Lefebvre';
  RAISE NOTICE '';
  RAISE NOTICE 'Technicienne:';
  RAISE NOTICE '  Email: julie@test.com';
  RAISE NOTICE '  Mot de passe: Test2024!';
  RAISE NOTICE '  Nom: Julie Roux';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

END $$;
