# 🔧 INSTRUCTIONS SUPABASE - À EXÉCUTER IMMÉDIATEMENT

## ⚠️ PROBLÈMES ACTUELS

Sans ces scripts SQL, les fonctionnalités suivantes **NE FONCTIONNENT PAS** :

- ❌ Employés ne peuvent pas uploader d'images dans les interventions
- ❌ Impossible de supprimer des images/documents d'interventions
- ❌ Admin ne peut pas supprimer de notes de frais
- ❌ **Admin ne peut pas supprimer d'interventions**
- ❌ Erreur lors de la création de notes de frais (catégories manquantes)

---

## 📋 SCRIPTS SQL À EXÉCUTER (DANS L'ORDRE)

### 1️⃣ **PERMISSIONS STOCKAGE** (CRITIQUE pour upload/suppression)

**Fichier:** `sql/storage_buckets_setup.sql`

**Ce que ça fait:**
- ✅ Permet aux employés d'uploader des images
- ✅ Permet aux admins de supprimer des images/documents
- ✅ Tout le monde peut voir les fichiers publics

**Comment exécuter:**
1. Ouvrez **Supabase Dashboard** → **SQL Editor**
2. Cliquez sur **New query**
3. Copiez-collez TOUT le contenu de `sql/storage_buckets_setup.sql`
4. Cliquez sur **Run**
5. Vérifiez qu'il n'y a pas d'erreurs

---

### 2️⃣ **CATÉGORIES NOTES DE FRAIS**

**Fichier:** `sql/update_expenses_categories.sql`

**Ce que ça fait:**
- ✅ Ajoute les catégories : phone, parking, fuel
- ✅ Évite l'erreur "expenses_category_check"

**Comment exécuter:**
1. **SQL Editor** → **New query**
2. Copiez-collez le contenu de `sql/update_expenses_categories.sql`
3. **Run**

---

### 3️⃣ **SUPPRESSION ADMIN NOTES DE FRAIS**

**Fichier:** `sql/add_admin_delete_expenses_policy.sql`

**Ce que ça fait:**
- ✅ Permet aux admins de supprimer n'importe quelle note de frais

**Comment exécuter:**
1. **SQL Editor** → **New query**
2. Copiez-collez le contenu de `sql/add_admin_delete_expenses_policy.sql`
3. **Run**

---

### 4️⃣ **SUPPRESSION ADMIN INTERVENTIONS** (NOUVEAU)

**Fichier:** `sql/add_admin_delete_interventions_policy.sql`

**Ce que ça fait:**
- ✅ Permet aux admins de supprimer n'importe quelle intervention
- ✅ Active le bouton de suppression dans le planning

**Comment exécuter:**
1. **SQL Editor** → **New query**
2. Copiez-collez le contenu de `sql/add_admin_delete_interventions_policy.sql`
3. **Run**

---

## ✅ VÉRIFICATION

Après avoir exécuté les 4 scripts, vérifiez :

### Test 1 : Upload d'images
1. Connectez-vous en tant qu'employé
2. Ouvrez une intervention
3. Cliquez sur "Choisir des fichiers"
4. Sélectionnez une photo
5. ✅ La photo devrait s'uploader sans erreur

### Test 2 : Suppression d'images
1. Connectez-vous en tant qu'admin
2. Ouvrez une intervention avec des photos
3. Vous devriez voir un bouton **×** rouge en haut à droite de chaque image
4. Cliquez dessus
5. Confirmez la suppression
6. ✅ L'image devrait disparaître

### Test 3 : Notes de frais
1. Créez une note de frais avec catégorie "Téléphone"
2. ✅ Pas d'erreur de contrainte
3. En tant qu'admin, essayez de supprimer la note
4. ✅ La suppression fonctionne

### Test 4 : Suppression d'interventions
1. Connectez-vous en tant qu'admin
2. Allez dans le Planning
3. Cliquez sur le bouton de suppression (poubelle) d'une intervention
4. Confirmez la suppression
5. ✅ L'intervention devrait disparaître

---

## 🆘 EN CAS D'ERREUR

### Erreur : "policy already exists"
→ C'est normal ! Les scripts gèrent déjà ce cas avec `DROP POLICY IF EXISTS`
→ Continuez, l'erreur peut être ignorée

### Erreur : "relation does not exist"
→ Vérifiez que vous êtes dans le bon projet Supabase
→ Vérifiez que les tables existent (`expenses`, `profiles`, etc.)

### Erreur : "permission denied"
→ Assurez-vous d'être connecté avec un compte admin Supabase
→ Vérifiez vos permissions RLS

---

## 📞 RÉSUMÉ RAPIDE

```sql
-- 1. Exécuter storage_buckets_setup.sql
-- 2. Exécuter update_expenses_categories.sql
-- 3. Exécuter add_admin_delete_expenses_policy.sql
-- 4. Exécuter add_admin_delete_interventions_policy.sql
```

**Une fois fait, TOUTES les fonctionnalités devraient fonctionner !** ✨
