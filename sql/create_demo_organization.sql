-- ============================================================
-- CRÉATION DE L'ORGANISATION DE DÉMONSTRATION
-- ============================================================
-- Crée une organisation dédiée aux démonstrations avec
-- toutes les fonctionnalités activées (plan premium)
-- ============================================================

INSERT INTO public.organizations (
  name,
  slug,
  plan,
  max_users,
  is_active,
  is_demo,
  email,
  phone,
  address,
  city,
  postal_code,
  siret,
  settings
) VALUES (
  'SRP DEMO - Service de Plomberie',
  'demo-srp',
  'premium',
  10,
  true,
  true,
  'demo@example.com',
  '+33 4 92 00 00 00',
  '15 Boulevard de la Liberté',
  'Digne-les-Bains',
  '04000',
  '12345678900001',
  jsonb_build_object(
    'demo_mode', true,
    'demo_banner_text', 'ENVIRONNEMENT DE DÉMONSTRATION',
    'timezone', 'Europe/Paris',
    'locale', 'fr-FR',
    'allow_data_export', false,
    'restrict_external_emails', true
  )
)
ON CONFLICT (slug) DO UPDATE SET
  is_demo = true,
  plan = 'premium',
  settings = EXCLUDED.settings,
  updated_at = NOW();

-- Afficher l'ID de l'organisation créée
DO $$
DECLARE
  demo_org_id uuid;
BEGIN
  SELECT id INTO demo_org_id FROM organizations WHERE slug = 'demo-srp';
  RAISE NOTICE 'Organisation de démonstration créée avec succès';
  RAISE NOTICE 'ID: %', demo_org_id;
  RAISE NOTICE 'Slug: demo-srp';
  RAISE NOTICE 'Nom: SRP DEMO - Service de Plomberie';
END $$;
