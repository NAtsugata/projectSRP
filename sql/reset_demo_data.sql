-- ============================================================
-- RÉINITIALISATION DES DONNÉES DE DÉMONSTRATION
-- ============================================================
-- Supprime TOUTES les données de l'organisation de démo
-- ATTENTION: Cette opération est IRRÉVERSIBLE
-- Utilisez seed_demo_data.sql pour re-peupler après reset
-- ============================================================

DO $$
DECLARE
  demo_org_id uuid;
  deleted_count integer;
  total_deleted integer := 0;
BEGIN
  -- Récupérer l'ID de l'organisation démo
  SELECT id INTO demo_org_id
  FROM organizations
  WHERE slug = 'demo-srp';

  IF demo_org_id IS NULL THEN
    RAISE EXCEPTION 'Organisation de démonstration non trouvée (slug: demo-srp)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = demo_org_id AND is_demo = true) THEN
    RAISE EXCEPTION 'SÉCURITÉ: L''organisation % n''est pas marquée comme démo. Opération annulée.', demo_org_id;
  END IF;

  RAISE NOTICE '🔄 Réinitialisation de l''organisation démo: %', demo_org_id;
  RAISE NOTICE '═══════════════════════════════════════════════════════';

  -- ============================================================
  -- SUPPRESSION DES DONNÉES (ordre des dépendances important)
  -- ============================================================

  -- 1. Assignments d'interventions
  DELETE FROM intervention_assignments
  WHERE intervention_id IN (
    SELECT id FROM interventions WHERE organization_id = demo_org_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % affectations d''interventions', deleted_count;

  -- 2. Items de checklist d'interventions
  DELETE FROM intervention_checklist_items
  WHERE intervention_id IN (
    SELECT id FROM interventions WHERE organization_id = demo_org_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % items de checklist', deleted_count;

  -- 3. Assignments quotidiens
  DELETE FROM daily_assignments
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % assignments quotidiens', deleted_count;

  -- 4. Interventions
  DELETE FROM interventions
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % interventions', deleted_count;

  -- 5. Visites de contrats
  DELETE FROM contract_visits
  WHERE contract_id IN (
    SELECT id FROM maintenance_contracts WHERE organization_id = demo_org_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % visites de contrats', deleted_count;

  -- 6. Équipements de contrats
  DELETE FROM contract_equipment
  WHERE contract_id IN (
    SELECT id FROM maintenance_contracts WHERE organization_id = demo_org_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % équipements de contrats', deleted_count;

  -- 7. Historique de contrats
  DELETE FROM contract_history
  WHERE contract_id IN (
    SELECT id FROM maintenance_contracts WHERE organization_id = demo_org_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % historiques de contrats', deleted_count;

  -- 8. Contrats de maintenance
  DELETE FROM maintenance_contracts
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % contrats de maintenance', deleted_count;

  -- 9. Dépenses
  DELETE FROM expenses
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % dépenses', deleted_count;

  -- 10. Demandes de congés
  DELETE FROM leave_requests
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % demandes de congés', deleted_count;

  -- 11. Absences employés
  DELETE FROM employee_absences
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % absences', deleted_count;

  -- 12. Documents vault
  DELETE FROM vault_documents
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % documents vault', deleted_count;

  -- 13. Documents CERFA
  DELETE FROM cerfa_documents
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % documents CERFA', deleted_count;

  -- 14. Documents scannés
  DELETE FROM scanned_documents
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % documents scannés', deleted_count;

  -- 15. Templates de checklist
  DELETE FROM checklist_templates
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % templates de checklist', deleted_count;

  -- 16. Templates d'intervention
  DELETE FROM intervention_templates
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % templates d''intervention', deleted_count;

  -- 17. Contacts clients
  DELETE FROM client_contacts
  WHERE client_id IN (
    SELECT id FROM clients WHERE organization_id = demo_org_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % contacts clients', deleted_count;

  -- 18. Clients
  DELETE FROM clients
  WHERE organization_id = demo_org_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  total_deleted := total_deleted + deleted_count;
  RAISE NOTICE '✓ Supprimé % clients', deleted_count;

  -- ============================================================
  -- MISE À JOUR DU TIMESTAMP DE RÉINITIALISATION
  -- ============================================================
  UPDATE organizations
  SET
    demo_last_reset = NOW(),
    updated_at = NOW()
  WHERE id = demo_org_id;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ RÉINITIALISATION TERMINÉE AVEC SUCCÈS';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Total d''entrées supprimées: %', total_deleted;
  RAISE NOTICE 'Organisation: % (ID: %)', 'SRP DEMO', demo_org_id;
  RAISE NOTICE 'Date de réinitialisation: %', NOW();
  RAISE NOTICE '';
  RAISE NOTICE '💡 Pour re-peupler les données:';
  RAISE NOTICE '   psql $DATABASE_URL -f seed_demo_data.sql';
  RAISE NOTICE '═══════════════════════════════════════════════════════';

END $$;
