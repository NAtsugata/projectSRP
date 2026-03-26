# 🔧 CORRECTIF URGENT : Absences disparues (Erreur RLS 42501)

## 🚨 Problème identifié

```
Code erreur: 42501
Message: new row violates row-level security policy for table "employee_absences"
```

Les **politiques RLS** (Row-Level Security) de Supabase sont trop restrictives et **empêchent l'ajout d'absences**.

---

## ✅ Solution : Exécuter ce script SQL dans Supabase

### Étapes :

1. **Ouvrez Supabase** → [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (dans le menu de gauche)
4. Créez une nouvelle requête
5. **Copiez-collez** ce script SQL :

```sql
-- ============================================
-- FIX: Politiques RLS pour employee_absences
-- Permet à tous les utilisateurs authentifiés de gérer les absences
-- ============================================

-- Supprimer les anciennes politiques restrictives (admin-only)
DROP POLICY IF EXISTS "Admins can create absences" ON employee_absences;
DROP POLICY IF EXISTS "Admins can update absences" ON employee_absences;
DROP POLICY IF EXISTS "Admins can delete absences" ON employee_absences;

-- Supprimer les politiques actuelles pour éviter les doublons
DROP POLICY IF EXISTS "Authenticated users can create absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can update absences" ON employee_absences;
DROP POLICY IF EXISTS "Authenticated users can delete absences" ON employee_absences;
DROP POLICY IF EXISTS "Users can view all absences" ON employee_absences;

-- Créer les nouvelles politiques pour tous les utilisateurs authentifiés

-- SELECT : Tous les utilisateurs authentifiés peuvent voir les absences
CREATE POLICY "Users can view all absences"
  ON employee_absences FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT : Tous les utilisateurs authentifiés peuvent créer des absences
CREATE POLICY "Authenticated users can create absences"
  ON employee_absences FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE : Tous les utilisateurs authentifiés peuvent modifier des absences
CREATE POLICY "Authenticated users can update absences"
  ON employee_absences FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE : Tous les utilisateurs authentifiés peuvent supprimer des absences
CREATE POLICY "Authenticated users can delete absences"
  ON employee_absences FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Vérification: Afficher les politiques actives
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'employee_absences'
ORDER BY cmd;
```

6. **Cliquez sur "RUN"** pour exécuter le script
7. Vérifiez que vous voyez **4 politiques** dans les résultats (SELECT, INSERT, UPDATE, DELETE)

---

## 📋 Vérification

Après avoir exécuté le script :

1. **Rechargez** votre application (F5)
2. **Testez** l'ajout d'une absence dans le planning
3. Les absences devraient maintenant **s'afficher correctement**

---

## 🔍 Pourquoi les absences avaient "disparu" ?

Les absences n'avaient pas réellement disparu, mais :
- ❌ Impossible d'en créer de nouvelles (erreur RLS)
- ❌ Peut-être impossibles à afficher si les politiques SELECT étaient aussi restrictives

Avec ce correctif, **tous les utilisateurs authentifiés** peuvent gérer les absences.

---

## 📌 Note importante

Si vous voulez restreindre les absences (par exemple : seuls les admins peuvent gérer les absences), il faudra créer des politiques plus complexes basées sur le rôle de l'utilisateur dans la table `user_profiles`.
