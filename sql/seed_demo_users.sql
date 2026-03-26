-- ============================================================
-- CRÉATION DE L'UTILISATEUR DE TEST
-- ============================================================
-- IMPORTANT: Avant d'exécuter ce script, créez l'utilisateur
-- via Supabase Dashboard > Authentication > Add User
--
-- Utilisateur à créer :
-- Email: nico@test.com
-- Mot de passe: Test2024!
--
-- Puis remplacez l'UUID ci-dessous par celui généré
-- ============================================================

DO $$
DECLARE
  demo_org_id uuid;

  -- ⚠️ REMPLACER CET UUID PAR CELUI GÉNÉRÉ PAR SUPABASE AUTH ⚠️
  nico_id uuid := '00000000-0000-0000-0000-000000000001';  -- nico@test.com

BEGIN
  -- Récupérer l'ID de l'organisation démo
  SELECT id INTO demo_org_id FROM organizations WHERE slug = 'demo-srp';

  IF demo_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation de démonstration non trouvée. Exécutez d''abord create_demo_organization.sql';
  END IF;

  RAISE NOTICE 'Organisation démo trouvée: %', demo_org_id;

  -- Créer le profil pour Nico
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
      'Nico',
      'nico@test.com',
      demo_org_id,
      true,  -- est admin
      '+33 6 12 34 56 78',
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

  RAISE NOTICE '✓ Profil créé pour Nico';

  -- Assigner le rôle owner
  INSERT INTO public.organization_roles (
    organization_id,
    user_id,
    role,
    created_at
  ) VALUES
    (demo_org_id, nico_id, 'owner', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;

  RAISE NOTICE '✓ Rôle assigné';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'UTILISATEUR DE TEST CRÉÉ';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Admin/Owner:';
  RAISE NOTICE '  Email: nico@test.com';
  RAISE NOTICE '  Mot de passe: Test2024!';
  RAISE NOTICE '  Nom: Nico';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

END $$;
