-- ============================================================
-- DIAGNOSTIC ET CORRECTION DES IDs EMPLOYÉS
-- ============================================================
-- Ce script vérifie et corrige le problème où profiles.id
-- ne correspond pas à auth.users.id (auth.uid())
-- ============================================================

-- ============================================================
-- ÉTAPE 1: DIAGNOSTIC - Vérifier la correspondance des IDs
-- ============================================================

-- Voir tous les utilisateurs auth et leurs profils correspondants
SELECT
    au.id as auth_user_id,
    au.email as auth_email,
    p.id as profile_id,
    p.email as profile_email,
    p.full_name,
    p.is_admin,
    CASE
        WHEN au.id = p.id THEN '✅ OK'
        WHEN p.id IS NULL THEN '❌ PAS DE PROFIL'
        ELSE '❌ ID DIFFÉRENT'
    END as status
FROM auth.users au
LEFT JOIN public.profiles p ON au.email = p.email
ORDER BY p.is_admin DESC, p.full_name;

-- ============================================================
-- ÉTAPE 2: Voir les profils qui n'ont pas de correspondance auth
-- ============================================================
SELECT
    p.id as profile_id,
    p.email,
    p.full_name,
    p.is_admin,
    '⚠️ Profil sans utilisateur auth correspondant' as status
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
WHERE au.id IS NULL;

-- ============================================================
-- ÉTAPE 3: Voir les intervention_assignments avec mauvais IDs
-- ============================================================
SELECT
    ia.id as assignment_id,
    ia.intervention_id,
    ia.user_id as assigned_user_id,
    p.full_name as profile_name,
    au.email as auth_email,
    CASE
        WHEN au.id IS NOT NULL THEN '✅ OK'
        ELSE '❌ USER_ID INVALIDE'
    END as status
FROM public.intervention_assignments ia
LEFT JOIN public.profiles p ON ia.user_id = p.id
LEFT JOIN auth.users au ON ia.user_id = au.id
ORDER BY status DESC, ia.intervention_id;

-- ============================================================
-- ÉTAPE 4: CORRECTION - Mettre à jour profiles.id pour correspondre à auth.users.id
-- ⚠️ ATTENTION: Exécutez d'abord les SELECT ci-dessus pour vérifier!
-- ============================================================

-- Cette requête met à jour profiles.id pour qu'il corresponde à auth.users.id
-- basé sur l'email (qui doit être identique)

/*
-- DÉCOMMENTEZ ET EXÉCUTEZ SEULEMENT APRÈS AVOIR VÉRIFIÉ LE DIAGNOSTIC

-- D'abord, désactiver temporairement les contraintes FK
BEGIN;

-- Créer une table temporaire avec les mappings
CREATE TEMP TABLE id_mapping AS
SELECT
    p.id as old_profile_id,
    au.id as new_profile_id,
    p.email
FROM public.profiles p
JOIN auth.users au ON au.email = p.email
WHERE p.id != au.id;

-- Afficher les mappings pour vérification
SELECT * FROM id_mapping;

-- Mettre à jour intervention_assignments d'abord (FK vers profiles)
UPDATE public.intervention_assignments ia
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE ia.user_id = m.old_profile_id;

-- Mettre à jour checklists
UPDATE public.checklists c
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE c.user_id = m.old_profile_id;

-- Mettre à jour expenses
UPDATE public.expenses e
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE e.user_id = m.old_profile_id;

-- Mettre à jour leave_requests
UPDATE public.leave_requests lr
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE lr.user_id = m.old_profile_id;

-- Mettre à jour vault_documents
UPDATE public.vault_documents vd
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE vd.user_id = m.old_profile_id;

-- Mettre à jour scanned_documents
UPDATE public.scanned_documents sd
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE sd.user_id = m.old_profile_id;

-- Mettre à jour notification_subscriptions
UPDATE public.notification_subscriptions ns
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE ns.user_id = m.old_profile_id;

-- Mettre à jour upload_monitoring
UPDATE public.upload_monitoring um
SET user_id = m.new_profile_id
FROM id_mapping m
WHERE um.user_id = m.old_profile_id;

-- Finalement, mettre à jour profiles.id
-- ⚠️ Ceci nécessite de supprimer et recréer le profil car id est PK
-- Alternative: si vous ne pouvez pas changer l'ID, recréez les profils

-- Pour chaque profil avec un mauvais ID:
-- 1. Supprimer l'ancien profil
-- 2. Insérer un nouveau profil avec le bon ID

DELETE FROM public.profiles
WHERE id IN (SELECT old_profile_id FROM id_mapping);

INSERT INTO public.profiles (id, email, full_name, is_admin, created_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    COALESCE((au.raw_user_meta_data->>'is_admin')::boolean, false),
    au.created_at
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.profiles);

COMMIT;

*/

-- ============================================================
-- ÉTAPE 5: VÉRIFICATION APRÈS CORRECTION
-- ============================================================
-- Réexécutez l'ÉTAPE 1 pour vérifier que tout est OK

SELECT 'Exécutez les SELECT de diagnostic ci-dessus pour identifier le problème' as instruction;
