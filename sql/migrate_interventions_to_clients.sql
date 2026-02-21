-- ============================================
-- Migration: Extraire les clients existants des interventions
-- vers la table clients
-- ============================================

-- Inserer les clients uniques depuis les interventions existantes
-- On groupe par (client, address) pour eviter les doublons
INSERT INTO clients (
  organization_id,
  name,
  phone,
  email,
  address,
  created_by
)
SELECT DISTINCT ON (i.client, i.address)
  i.organization_id,
  i.client AS name,
  i.client_phone AS phone,
  i.client_email AS email,
  i.address,
  i.created_by
FROM interventions i
WHERE i.client IS NOT NULL
  AND i.client != ''
  AND NOT EXISTS (
    -- Eviter d'inserer des clients qui existent deja
    SELECT 1 FROM clients c
    WHERE c.name = i.client
      AND c.organization_id = i.organization_id
  )
ORDER BY i.client, i.address, i.created_at DESC;

-- Lier les interventions aux clients crees
UPDATE interventions i
SET client_id = c.id
FROM clients c
WHERE i.client = c.name
  AND i.organization_id = c.organization_id
  AND i.client_id IS NULL;
