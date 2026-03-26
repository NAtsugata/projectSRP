-- ============================================================
-- CRÉATION DES UTILISATEURS ET RÔLES DE DÉMONSTRATION
-- ============================================================
-- IMPORTANT: Avant d'exécuter ce script, créez les 4 utilisateurs
-- via Supabase Dashboard > Authentication > Add User
--
-- Utilisateurs à créer :
-- 1. demo-admin@example.com (mot de passe: Demo2024!Admin)
-- 2. demo-manager@example.com (mot de passe: Demo2024!Manager)
-- 3. demo-tech1@example.com (mot de passe: Demo2024!Tech)
-- 4. demo-tech2@example.com (mot de passe: Demo2024!Tech)
--
-- Puis remplacez les UUIDs ci-dessous par ceux générés
-- ============================================================

DO $$
DECLARE
  demo_org_id uuid;

  -- ⚠️ REMPLACER CES UUIDs PAR CEUX GÉNÉRÉS PAR SUPABASE AUTH ⚠️
  jean_id uuid := '00000000-0000-0000-0000-000000000001';  -- demo-admin@example.com
  sophie_id uuid := '00000000-0000-0000-0000-000000000002';  -- demo-manager@example.com
  marc_id uuid := '00000000-0000-0000-0000-000000000003';  -- demo-tech1@example.com
  julie_id uuid := '00000000-0000-0000-0000-000000000004';  -- demo-tech2@example.com

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
      jean_id,
      'Jean Martin',
      'demo-admin@example.com',
      demo_org_id,
      true,  -- est admin
      '+33 6 12 34 56 78',
      NOW(),
      NOW()
    ),
    (
      sophie_id,
      'Sophie Dubois',
      'demo-manager@example.com',
      demo_org_id,
      false,
      '+33 6 12 34 56 79',
      NOW(),
      NOW()
    ),
    (
      marc_id,
      'Marc Lefebvre',
      'demo-tech1@example.com',
      demo_org_id,
      false,
      '+33 6 12 34 56 80',
      NOW(),
      NOW()
    ),
    (
      julie_id,
      'Julie Roux',
      'demo-tech2@example.com',
      demo_org_id,
      false,
      '+33 6 12 34 56 81',
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
    (demo_org_id, jean_id, 'owner', NOW()),
    (demo_org_id, sophie_id, 'manager', NOW()),
    (demo_org_id, marc_id, 'technician', NOW()),
    (demo_org_id, julie_id, 'technician', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role;

  RAISE NOTICE '✓ Rôles assignés';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'UTILISATEURS DE DÉMONSTRATION CRÉÉS';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Owner/Admin:';
  RAISE NOTICE '  Email: demo-admin@example.com';
  RAISE NOTICE '  Mot de passe: Demo2024!Admin';
  RAISE NOTICE '  Nom: Jean Martin';
  RAISE NOTICE '';
  RAISE NOTICE 'Manager:';
  RAISE NOTICE '  Email: demo-manager@example.com';
  RAISE NOTICE '  Mot de passe: Demo2024!Manager';
  RAISE NOTICE '  Nom: Sophie Dubois';
  RAISE NOTICE '';
  RAISE NOTICE 'Technicien 1:';
  RAISE NOTICE '  Email: demo-tech1@example.com';
  RAISE NOTICE '  Mot de passe: Demo2024!Tech';
  RAISE NOTICE '  Nom: Marc Lefebvre';
  RAISE NOTICE '';
  RAISE NOTICE 'Technicien 2:';
  RAISE NOTICE '  Email: demo-tech2@example.com';
  RAISE NOTICE '  Mot de passe: Demo2024!Tech';
  RAISE NOTICE '  Nom: Julie Roux';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';

END $$;
