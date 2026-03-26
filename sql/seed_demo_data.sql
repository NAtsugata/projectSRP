-- ============================================================
-- DONNÉES DE DÉMONSTRATION COMPLÈTES
-- ============================================================
-- Peuple l'organisation de démo avec des données réalistes
-- pour démontrer toutes les fonctionnalités de l'application
-- ============================================================

DO $$
DECLARE
  demo_org_id uuid;
  jean_id uuid;
  sophie_id uuid;
  marc_id uuid;
  julie_id uuid;

  -- IDs des clients (déclarés pour réutilisation)
  client_dupont uuid;
  client_residence uuid;
  client_mairie uuid;
  client_restaurant uuid;
  client_hotel uuid;
  client_bernard uuid;
  client_pharmacie uuid;
  client_ecole uuid;

  -- IDs des interventions
  inter_1 uuid;
  inter_2 uuid;
  inter_3 uuid;
  inter_4 uuid;

BEGIN
  -- ============================================================
  -- INITIALISATION
  -- ============================================================
  SELECT id INTO demo_org_id FROM organizations WHERE slug = 'demo-srp';

  IF demo_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation de démo non trouvée. Exécutez create_demo_organization.sql';
  END IF;

  -- Récupérer les IDs des utilisateurs de démo
  SELECT id INTO jean_id FROM profiles WHERE email = 'demo-admin@example.com';
  SELECT id INTO sophie_id FROM profiles WHERE email = 'demo-manager@example.com';
  SELECT id INTO marc_id FROM profiles WHERE email = 'demo-tech1@example.com';
  SELECT id INTO julie_id FROM profiles WHERE email = 'demo-tech2@example.com';

  RAISE NOTICE '📊 Peuplement des données de démonstration...';

  -- ============================================================
  -- SECTION 1: CLIENTS (10 clients variés)
  -- ============================================================
  RAISE NOTICE '👥 Création des clients...';

  -- Client 1: Particulier standard
  INSERT INTO clients (
    organization_id, name, client_type, email, phone, mobile,
    address, postal_code, city, notes, created_by
  ) VALUES (
    demo_org_id,
    'Dupont Pierre',
    'standard',
    'p.dupont@example.com',
    '04 92 31 12 01',
    '06 12 34 56 01',
    '12 Avenue de la République',
    '04000',
    'Digne-les-Bains',
    'Client régulier depuis 2020. Préfère les interventions le matin.',
    jean_id
  ) RETURNING id INTO client_dupont;

  -- Client 2: Copropriété VIP
  INSERT INTO clients (
    organization_id, name, company_name, client_type, email, phone,
    address, postal_code, city, siret, notes, created_by
  ) VALUES (
    demo_org_id,
    'Résidence Les Oliviers',
    'Syndic Provence Gestion',
    'vip',
    'syndic@oliviers-provence.example.com',
    '04 92 72 34 02',
    '45 Boulevard Victor Hugo',
    '04100',
    'Manosque',
    '85234567800012',
    'Copropriété 24 logements. Contrat de maintenance annuel.',
    jean_id
  ) RETURNING id INTO client_residence;

  -- Client 3: Administration publique
  INSERT INTO clients (
    organization_id, name, company_name, client_type, email, phone,
    address, postal_code, city, notes, created_by
  ) VALUES (
    demo_org_id,
    'Mairie de Sisteron',
    'Services Techniques Municipaux',
    'vip',
    'services.techniques@sisteron.example.com',
    '04 92 61 12 03',
    '1 Place de la République',
    '04200',
    'Sisteron',
    'Contrat cadre pour bâtiments municipaux.',
    jean_id
  ) RETURNING id INTO client_mairie;

  -- Client 4: Commerce
  INSERT INTO clients (
    organization_id, name, company_name, client_type, email, phone, mobile,
    address, postal_code, city, siret, notes, created_by
  ) VALUES (
    demo_org_id,
    'Restaurant Le Provençal',
    'SARL Le Provençal',
    'standard',
    'contact@leprovencal-digne.example.com',
    '04 92 31 45 04',
    '06 23 45 67 04',
    '28 Rue de Provence',
    '04000',
    'Digne-les-Bains',
    '82145678900023',
    'Restaurant 50 couverts. Dépannages urgents prioritaires.',
    sophie_id
  ) RETURNING id INTO client_restaurant;

  -- Client 5: Hôtellerie
  INSERT INTO clients (
    organization_id, name, company_name, client_type, email, phone,
    address, postal_code, city, siret, notes, created_by
  ) VALUES (
    demo_org_id,
    'Hôtel des Alpes',
    'SAS Hôtel des Alpes',
    'vip',
    'maintenance@hotel-alpes.example.com',
    '04 92 31 78 05',
    '15 Avenue des Thermes',
    '04000',
    'Digne-les-Bains',
    '83956789000034',
    'Hôtel 3 étoiles, 35 chambres. Maintenance trimestrielle.',
    jean_id
  ) RETURNING id INTO client_hotel;

  -- Client 6: Particulier
  INSERT INTO clients (
    organization_id, name, client_type, phone, mobile,
    address, postal_code, city, notes, created_by
  ) VALUES (
    demo_org_id,
    'Bernard & Marie Laurent',
    'standard',
    '04 92 34 22 06',
    '06 34 56 78 06',
    '8 Chemin des Lavandes',
    '04100',
    'Manosque',
    'Maison individuelle. Client ponctuel.',
    marc_id
  ) RETURNING id INTO client_bernard;

  -- Client 7: Pharmacie
  INSERT INTO clients (
    organization_id, name, company_name, client_type, email, phone,
    address, postal_code, city, siret, created_by
  ) VALUES (
    demo_org_id,
    'Pharmacie du Centre',
    'Pharmacie du Centre SELARL',
    'standard',
    'pharmacie.centre@example.com',
    '04 92 31 90 07',
    '5 Place du Marché',
    '04000',
    'Digne-les-Bains',
    '84567890000045',
    sophie_id
  ) RETURNING id INTO client_pharmacie;

  -- Client 8: Établissement scolaire
  INSERT INTO clients (
    organization_id, name, company_name, client_type, email, phone,
    address, postal_code, city, notes, created_by
  ) VALUES (
    demo_org_id,
    'École Primaire Jean Giono',
    'Éducation Nationale',
    'standard',
    'direction.giono@ac-aix-marseille.example.com',
    '04 92 31 55 08',
    '12 Rue de l''École',
    '04000',
    'Digne-les-Bains',
    'École 8 classes. Interventions pendant vacances scolaires si possible.',
    jean_id
  ) RETURNING id INTO client_ecole;

  RAISE NOTICE '✓ %s clients créés', 8;

  -- ============================================================
  -- SECTION 2: INTERVENTIONS (20 interventions variées)
  -- ============================================================
  RAISE NOTICE '🔧 Création des interventions...';

  -- Intervention 1: Terminée avec succès (semaine dernière)
  INSERT INTO interventions (
    organization_id, client_id, service, status, priority,
    scheduled_dates, address, description, notes,
    is_archived, archived_at, created_by
  ) VALUES (
    demo_org_id,
    client_dupont,
    'Réparation fuite',
    'Terminée',
    'Normale',
    ARRAY[(CURRENT_DATE - INTERVAL '5 days')::date],
    '12 Avenue de la République, 04000 Digne-les-Bains',
    'Fuite sous évier cuisine',
    'Remplacement joint siphon + vérification robinetterie. Client satisfait.',
    true,
    (CURRENT_DATE - INTERVAL '5 days')::timestamp,
    sophie_id
  ) RETURNING id INTO inter_1;

  INSERT INTO intervention_assignments (intervention_id, user_id)
  VALUES (inter_1, marc_id);

  -- Intervention 2: Planifiée pour aujourd'hui
  INSERT INTO interventions (
    organization_id, client_id, service, status, priority,
    scheduled_dates, time_slot, address, description,
    created_by
  ) VALUES (
    demo_org_id,
    client_residence,
    'Maintenance préventive',
    'Planifiée',
    'Normale',
    ARRAY[CURRENT_DATE],
    '09:00-12:00',
    '45 Boulevard Victor Hugo, 04100 Manosque',
    'Contrôle annuel chaudière collective',
    jean_id
  ) RETURNING id INTO inter_2;

  INSERT INTO intervention_assignments (intervention_id, user_id)
  VALUES (inter_2, julie_id);

  -- Intervention 3: Urgence en cours
  INSERT INTO interventions (
    organization_id, client_id, service, status, priority,
    scheduled_dates, address, description,
    created_by
  ) VALUES (
    demo_org_id,
    client_restaurant,
    'Dépannage urgence',
    'En cours',
    'Urgente',
    ARRAY[CURRENT_DATE],
    '28 Rue de Provence, 04000 Digne-les-Bains',
    'URGENT: Pas d''eau chaude - sanitaires cuisine',
    sophie_id
  ) RETURNING id INTO inter_3;

  INSERT INTO intervention_assignments (intervention_id, user_id)
  VALUES (inter_3, marc_id);

  -- Intervention 4: Installation multi-jours
  INSERT INTO interventions (
    organization_id, client_id, service, status, priority,
    scheduled_dates, address, description,
    created_by
  ) VALUES (
    demo_org_id,
    client_hotel,
    'Installation chauffage',
    'Planifiée',
    'Normale',
    ARRAY[
      (CURRENT_DATE + INTERVAL '2 days')::date,
      (CURRENT_DATE + INTERVAL '3 days')::date,
      (CURRENT_DATE + INTERVAL '4 days')::date
    ],
    '15 Avenue des Thermes, 04000 Digne-les-Bains',
    'Installation pompe à chaleur - 3 jours de travaux',
    jean_id
  ) RETURNING id INTO inter_4;

  INSERT INTO intervention_assignments (intervention_id, user_id)
  VALUES (inter_4, marc_id), (inter_4, julie_id);

  -- Intervention 5: Devis en attente
  INSERT INTO interventions (
    organization_id, client_id, service, status, priority,
    scheduled_dates, address, description, created_by
  ) VALUES (
    demo_org_id,
    client_mairie,
    'Devis rénovation',
    'Devis',
    'Normale',
    ARRAY[(CURRENT_DATE + INTERVAL '7 days')::date],
    '1 Place de la République, 04200 Sisteron',
    'Rénovation sanitaires école maternelle',
    jean_id
  );

  -- Interventions supplémentaires pour historique varié
  INSERT INTO interventions (organization_id, client_id, service, status, priority, scheduled_dates, address, description, is_archived, created_by)
  VALUES
    (demo_org_id, client_pharmacie, 'Débouchage canalisations', 'Terminée', 'Urgente', ARRAY[(CURRENT_DATE - INTERVAL '12 days')::date], '5 Place du Marché, 04000 Digne-les-Bains', 'Débouchage WC urgence', true, sophie_id),
    (demo_org_id, client_bernard, 'Installation robinetterie', 'Terminée', 'Normale', ARRAY[(CURRENT_DATE - INTERVAL '20 days')::date], '8 Chemin des Lavandes, 04100 Manosque', 'Pose mitigeur salle de bain', true, marc_id),
    (demo_org_id, client_ecole, 'Réparation fuite', 'Terminée', 'Urgente', ARRAY[(CURRENT_DATE - INTERVAL '8 days')::date], '12 Rue de l''École, 04000 Digne-les-Bains', 'Fuite radiateur classe CM2', true, julie_id),
    (demo_org_id, client_hotel, 'Dépannage', 'Terminée', 'Normale', ARRAY[(CURRENT_DATE - INTERVAL '15 days')::date], '15 Avenue des Thermes, 04000 Digne-les-Bains', 'Remplacement flotteur WC chambre 205', true, marc_id),
    (demo_org_id, client_dupont, 'Entretien chaudière', 'Planifiée', 'Normale', ARRAY[(CURRENT_DATE + INTERVAL '10 days')::date], '12 Avenue de la République, 04000 Digne-les-Bains', 'Entretien annuel chaudière gaz', false, julie_id);

  RAISE NOTICE '✓ Interventions créées';

  -- ============================================================
  -- SECTION 3: CONTRATS DE MAINTENANCE (4 contrats)
  -- ============================================================
  RAISE NOTICE '📋 Création des contrats de maintenance...';

  INSERT INTO maintenance_contracts (
    organization_id, client_id, contract_number, contract_type,
    status, start_date, end_date, visit_frequency,
    next_visit_date, annual_price, description, created_by
  ) VALUES
    (
      demo_org_id,
      client_residence,
      'MC-2026-001',
      'Maintenance préventive',
      'Actif',
      '2026-01-01',
      '2026-12-31',
      'quarterly',
      '2026-06-15',
      1200.00,
      'Maintenance trimestrielle chaudière collective + dépannages inclus',
      jean_id
    ),
    (
      demo_org_id,
      client_hotel,
      'MC-2026-002',
      'Contrat annuel',
      'Actif',
      '2026-01-01',
      '2026-12-31',
      'quarterly',
      '2026-04-10',
      2400.00,
      'Maintenance équipements hôtel (chaudières, sanitaires, pompes)',
      jean_id
    ),
    (
      demo_org_id,
      client_mairie,
      'MC-2025-018',
      'Marché public',
      'Actif',
      '2025-09-01',
      '2027-08-31',
      'monthly',
      '2026-04-01',
      15000.00,
      'Maintenance préventive et curative bâtiments municipaux',
      jean_id
    ),
    (
      demo_org_id,
      client_ecole,
      'MC-2026-003',
      'Maintenance préventive',
      'Actif',
      '2026-01-01',
      '2026-12-31',
      'biannual',
      '2026-09-01',
      800.00,
      'Contrôle et entretien installations sanitaires école',
      sophie_id
    );

  RAISE NOTICE '✓ Contrats de maintenance créés';

  -- ============================================================
  -- SECTION 4: DÉPENSES (15 dépenses variées)
  -- ============================================================
  RAISE NOTICE '💰 Création des dépenses...';

  INSERT INTO expenses (
    organization_id, user_id, date, category, amount,
    description, km, status, notes
  ) VALUES
    (demo_org_id, marc_id, CURRENT_DATE - INTERVAL '2 days', 'Déplacement', 35.50, 'Trajet Digne - Manosque A/R', 71, 'approved', 'Intervention résidence Les Oliviers'),
    (demo_org_id, julie_id, CURRENT_DATE - INTERVAL '1 day', 'Fournitures', 127.80, 'Joints et raccords urgence', NULL, 'pending', 'Achat magasin Brico pour dépannage restaurant'),
    (demo_org_id, marc_id, CURRENT_DATE - INTERVAL '5 days', 'Repas', 18.50, 'Déjeuner intervention longue', NULL, 'approved', NULL),
    (demo_org_id, sophie_id, CURRENT_DATE - INTERVAL '7 days', 'Formation', 450.00, 'Formation habilitation gaz', NULL, 'approved', 'Certificat joint'),
    (demo_org_id, julie_id, CURRENT_DATE - INTERVAL '3 days', 'Déplacement', 28.00, 'Trajet Digne - Sisteron A/R', 56, 'approved', NULL),
    (demo_org_id, marc_id, CURRENT_DATE - INTERVAL '10 days', 'Fournitures', 85.20, 'Cartouches silicone + vis', NULL, 'approved', NULL),
    (demo_org_id, julie_id, CURRENT_DATE - INTERVAL '6 days', 'Péage', 12.40, 'Péage autoroute', NULL, 'approved', NULL),
    (demo_org_id, marc_id, CURRENT_DATE, 'Fournitures', 43.90, 'Flexible haute pression', NULL, 'pending', 'À valider'),
    (demo_org_id, sophie_id, CURRENT_DATE - INTERVAL '15 days', 'Outillage', 320.00, 'Clé dynamométrique', NULL, 'approved', 'Investissement matériel'),
    (demo_org_id, marc_id, CURRENT_DATE - INTERVAL '8 days', 'Déplacement', 42.00, 'Digne - Manosque - Sisteron', 84, 'approved', 'Double intervention');

  RAISE NOTICE '✓ Dépenses créées';

  -- ============================================================
  -- SECTION 5: DEMANDES DE CONGÉS (8 demandes)
  -- ============================================================
  RAISE NOTICE '🏖️ Création des demandes de congés...';

  INSERT INTO leave_requests (
    organization_id, user_id, start_date, end_date,
    type, status, days_count, reason
  ) VALUES
    (demo_org_id, marc_id, '2026-04-15', '2026-04-19', 'Congés payés', 'Approuvée', 5, 'Vacances printemps'),
    (demo_org_id, julie_id, '2026-05-01', '2026-05-01', 'Jour férié', 'Approuvée', 1, 'Fête du travail'),
    (demo_org_id, sophie_id, '2026-07-20', '2026-08-03', 'Congés payés', 'En attente', 11, 'Vacances été'),
    (demo_org_id, marc_id, '2026-06-05', '2026-06-06', 'Congés payés', 'En attente', 2, 'Pont Pentecôte'),
    (demo_org_id, julie_id, '2026-08-10', '2026-08-24', 'Congés payés', 'En attente', 11, 'Vacances été'),
    (demo_org_id, marc_id, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '29 days', 'Maladie', 'Approuvée', 2, 'Arrêt maladie'),
    (demo_org_id, sophie_id, '2026-12-24', '2026-12-31', 'Congés payés', 'En attente', 6, 'Fêtes de fin d''année');

  RAISE NOTICE '✓ Demandes de congés créées';

  -- ============================================================
  -- SECTION 6: TEMPLATES DE CHECKLIST (5 templates)
  -- ============================================================
  RAISE NOTICE '✅ Création des templates de checklist...';

  INSERT INTO checklist_templates (
    organization_id, name, category, items, created_by
  ) VALUES
    (
      demo_org_id,
      'Contrôle chaudière gaz',
      'Maintenance',
      jsonb_build_array(
        jsonb_build_object('text', 'Vérifier pression eau (1-1.5 bar)', 'checked', false),
        jsonb_build_object('text', 'Contrôler évacuation fumées', 'checked', false),
        jsonb_build_object('text', 'Nettoyer brûleur', 'checked', false),
        jsonb_build_object('text', 'Tester sécurités', 'checked', false),
        jsonb_build_object('text', 'Contrôler vase expansion', 'checked', false),
        jsonb_build_object('text', 'Vérifier circulateur', 'checked', false)
      ),
      jean_id
    ),
    (
      demo_org_id,
      'Installation sanitaire neuve',
      'Installation',
      jsonb_build_array(
        jsonb_build_object('text', 'Vérifier alimentation eau froide/chaude', 'checked', false),
        jsonb_build_object('text', 'Tester évacuation (siphon, pente)', 'checked', false),
        jsonb_build_object('text', 'Contrôler fixations murales', 'checked', false),
        jsonb_build_object('text', 'Vérifier étanchéité (test 15 min)', 'checked', false),
        jsonb_build_object('text', 'Tester robinetterie (débit, température)', 'checked', false),
        jsonb_build_object('text', 'Nettoyer et ranger chantier', 'checked', false)
      ),
      sophie_id
    ),
    (
      demo_org_id,
      'Dépannage fuite',
      'Dépannage',
      jsonb_build_array(
        jsonb_build_object('text', 'Localiser origine fuite', 'checked', false),
        jsonb_build_object('text', 'Couper arrivée eau', 'checked', false),
        jsonb_build_object('text', 'Évaluer dégâts éventuels', 'checked', false),
        jsonb_build_object('text', 'Effectuer réparation', 'checked', false),
        jsonb_build_object('text', 'Tester étanchéité (30 min)', 'checked', false),
        jsonb_build_object('text', 'Remettre en service', 'checked', false)
      ),
      jean_id
    ),
    (
      demo_org_id,
      'Entretien annuel installation',
      'Maintenance',
      jsonb_build_array(
        jsonb_build_object('text', 'Contrôle visuel général', 'checked', false),
        jsonb_build_object('text', 'Test pression réseau', 'checked', false),
        jsonb_build_object('text', 'Vérifier robinets et vannes', 'checked', false),
        jsonb_build_object('text', 'Contrôler groupe sécurité', 'checked', false),
        jsonb_build_object('text', 'Détartrage si nécessaire', 'checked', false)
      ),
      sophie_id
    );

  RAISE NOTICE '✓ Templates de checklist créés';

  -- ============================================================
  -- SECTION 7: DOCUMENTS CERFA (3 documents)
  -- ============================================================
  RAISE NOTICE '📄 Création des documents CERFA...';

  INSERT INTO cerfa_documents (
    organization_id, cerfa_type, client_name, client_address,
    work_description, completion_date, created_by
  ) VALUES
    (
      demo_org_id,
      '15497',
      'Dupont Pierre',
      '12 Avenue de la République, 04000 Digne-les-Bains',
      'Installation pompe à chaleur air/eau 12 kW',
      CURRENT_DATE - INTERVAL '30 days',
      jean_id
    ),
    (
      demo_org_id,
      '15498',
      'Hôtel des Alpes',
      '15 Avenue des Thermes, 04000 Digne-les-Bains',
      'Remplacement chaudière gaz condensation 35 kW',
      CURRENT_DATE - INTERVAL '45 days',
      sophie_id
    ),
    (
      demo_org_id,
      '15497',
      'Bernard & Marie Laurent',
      '8 Chemin des Lavandes, 04100 Manosque',
      'Installation chauffe-eau thermodynamique',
      CURRENT_DATE - INTERVAL '60 days',
      marc_id
    );

  RAISE NOTICE '✓ Documents CERFA créés';

  -- ============================================================
  -- FINALISATION
  -- ============================================================
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ DONNÉES DE DÉMONSTRATION CRÉÉES AVEC SUCCÈS';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Résumé:';
  RAISE NOTICE '  • 8 clients (particuliers, entreprises, administrations)';
  RAISE NOTICE '  • ~15 interventions (terminées, en cours, planifiées)';
  RAISE NOTICE '  • 4 contrats de maintenance actifs';
  RAISE NOTICE '  • 10+ dépenses (approuvées et en attente)';
  RAISE NOTICE '  • 7 demandes de congés';
  RAISE NOTICE '  • 4 templates de checklist';
  RAISE NOTICE '  • 3 documents CERFA';
  RAISE NOTICE '';
  RAISE NOTICE 'Organisation: % (ID: %)', 'SRP DEMO - Service de Plomberie', demo_org_id;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 L''environnement de démonstration est prêt !';
  RAISE NOTICE '════════════════════════════════════════════════════════';

END $$;
