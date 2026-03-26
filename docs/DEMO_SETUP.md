# Guide de Configuration - Compte de Démonstration

Ce guide explique comment configurer l'environnement de démonstration complet pour le Portail SRP.

## Vue d'ensemble

L'environnement de démonstration permet de présenter toutes les fonctionnalités de l'application sans risque d'affecter les données réelles. Il comprend :

- ✅ Organisation dédiée isolée par RLS (Row Level Security)
- ✅ 4 comptes utilisateurs avec rôles différents
- ✅ Données réalistes (clients, interventions, dépenses, etc.)
- ✅ Bannière visuelle indiquant le mode démo
- ✅ Protection contre l'envoi d'emails/SMS réels
- ✅ Capacité de réinitialisation rapide

## Prérequis

- ✅ Accès au projet Supabase (Dashboard)
- ✅ Accès à la base de données PostgreSQL (SQL Editor)
- ✅ Application React déployée et fonctionnelle
- ✅ Migrations existantes appliquées (`multi_tenant_setup.sql`, etc.)

## Installation

### Étape 1 : Exécuter les migrations SQL

Exécutez les scripts SQL suivants **dans l'ordre** via Supabase SQL Editor :

#### 1.1 - Ajouter les colonnes de démonstration

```bash
# Fichier: /sql/add_demo_features.sql
```

Ce script ajoute 3 colonnes à la table `organizations` :
- `is_demo` (boolean) - Flag pour identifier les orgs de démo
- `demo_reset_frequency` (text) - Fréquence de réinitialisation
- `demo_last_reset` (timestamp) - Date de dernière réinitialisation

**Vérification :**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name LIKE 'demo%';
```

#### 1.2 - Créer l'organisation de démonstration

```bash
# Fichier: /sql/create_demo_organization.sql
```

Ce script crée l'organisation "SRP DEMO - Service de Plomberie" avec :
- Slug: `demo-srp`
- Plan: `premium` (toutes les fonctionnalités)
- Flag: `is_demo = true`

**Vérification :**
```sql
SELECT id, name, slug, is_demo, plan
FROM organizations
WHERE slug = 'demo-srp';
```

Notez l'UUID de l'organisation, vous en aurez besoin plus tard.

### Étape 2 : Créer les utilisateurs via Supabase Auth

⚠️ **IMPORTANT** : Cette étape doit être faite manuellement via le Dashboard Supabase.

1. Allez sur **Supabase Dashboard** → **Authentication** → **Users**
2. Cliquez sur **"Add user"** (ou "Invite user")
3. Créez **4 utilisateurs** avec ces informations :

| Rôle | Email | Mot de passe | Nom complet |
|------|-------|--------------|-------------|
| Owner/Admin | `demo-admin@example.com` | `Demo2024!Admin` | Jean Martin |
| Manager | `demo-manager@example.com` | `Demo2024!Manager` | Sophie Dubois |
| Technicien 1 | `demo-tech1@example.com` | `Demo2024!Tech` | Marc Lefebvre |
| Technicien 2 | `demo-tech2@example.com` | `Demo2024!Tech` | Julie Roux |

4. **Notez les UUIDs** générés pour chaque utilisateur (colonne `id` dans la table `auth.users`)

**Astuce** : Pour récupérer les UUIDs des utilisateurs créés :
```sql
SELECT id, email
FROM auth.users
WHERE email LIKE 'demo-%@example.com'
ORDER BY email;
```

### Étape 3 : Créer les profils et rôles

#### 3.1 - Éditer le script avec les UUIDs

Ouvrez le fichier `/sql/seed_demo_users.sql` et **remplacez les UUIDs placeholders** par les vrais UUIDs obtenus à l'étape 2 :

```sql
-- ⚠️ REMPLACER CES UUIDs PAR CEUX GÉNÉRÉS PAR SUPABASE AUTH ⚠️
jean_id uuid := '00000000-0000-0000-0000-000000000001';  -- REMPLACER
sophie_id uuid := '00000000-0000-0000-0000-000000000002';  -- REMPLACER
marc_id uuid := '00000000-0000-0000-0000-000000000003';  -- REMPLACER
julie_id uuid := '00000000-0000-0000-0000-000000000004';  -- REMPLACER
```

Remplacez par vos vrais UUIDs, par exemple :
```sql
jean_id uuid := 'a1b2c3d4-5678-90ab-cdef-123456789abc';
sophie_id uuid := 'b2c3d4e5-6789-01bc-def1-23456789abcd';
marc_id uuid := 'c3d4e5f6-7890-12cd-ef12-3456789abcde';
julie_id uuid := 'd4e5f6a7-8901-23de-f123-456789abcdef';
```

#### 3.2 - Exécuter le script

```bash
# Fichier: /sql/seed_demo_users.sql (après modification)
```

Ce script crée :
- 4 profils dans la table `profiles`
- 4 rôles dans la table `organization_roles`

**Vérification :**
```sql
SELECT p.full_name, p.email, r.role
FROM profiles p
JOIN organization_roles r ON r.user_id = p.id
WHERE p.organization_id = (SELECT id FROM organizations WHERE slug = 'demo-srp');
```

Vous devriez voir 4 lignes avec les rôles : owner, manager, technician, technician.

### Étape 4 : Peupler les données de démonstration

```bash
# Fichier: /sql/seed_demo_data.sql
```

Ce script crée toutes les données de test :
- 8 clients (particuliers, entreprises, administrations)
- ~15 interventions (terminées, en cours, planifiées)
- 4 contrats de maintenance
- 10+ dépenses
- 7 demandes de congés
- 4 templates de checklist
- 3 documents CERFA

**Vérification :**
```sql
SELECT
  (SELECT COUNT(*) FROM clients WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'demo-srp')) as clients,
  (SELECT COUNT(*) FROM interventions WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'demo-srp')) as interventions,
  (SELECT COUNT(*) FROM expenses WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'demo-srp')) as expenses,
  (SELECT COUNT(*) FROM maintenance_contracts WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'demo-srp')) as contrats;
```

### Étape 5 : Déployer les composants UI

Les fichiers suivants ont déjà été créés dans le code source :

- ✅ `/src/components/DemoBanner.jsx` - Composant bannière
- ✅ `/src/components/DemoBanner.css` - Styles de la bannière
- ✅ `/src/components/layout/AppLayout.jsx` - Intégration de la bannière (modifié)
- ✅ `/src/utils/demoModeHelper.js` - Helpers pour la protection

**Action requise :** Redéployer l'application React pour appliquer les changements UI.

```bash
# Si vous utilisez Vercel, Netlify, ou autre plateforme
git add .
git commit -m "feat: Add demo mode with banner and data protection"
git push origin main

# Ou build local
npm run build
```

### Étape 6 : Vérifications finales

#### 6.1 - Tester la connexion

1. Ouvrez l'application dans le navigateur
2. Connectez-vous avec `demo-admin@example.com` / `Demo2024!Admin`
3. **Vous devriez voir** :
   - ✅ La bannière orange "ENVIRONNEMENT DE DÉMONSTRATION" en haut
   - ✅ Le dashboard avec des données
   - ✅ Accès à toutes les fonctionnalités admin

#### 6.2 - Tester l'isolation des données

1. Connectez-vous avec un compte non-démo (votre compte principal)
2. **Vous ne devriez PAS voir** :
   - ❌ La bannière de démo
   - ❌ Les clients/interventions de démo
   - ❌ Les données de l'organisation demo-srp

Cela confirme que le RLS fonctionne correctement.

#### 6.3 - Tester différents rôles

Connectez-vous avec chaque compte pour vérifier les permissions :

| Compte | Rôle | Accès |
|--------|------|-------|
| demo-admin | Owner | Dashboard, toutes les fonctionnalités admin |
| demo-manager | Manager | Planning, validation des demandes |
| demo-tech1 | Technician | Interventions assignées, dépenses, congés |
| demo-tech2 | Technician | Interventions assignées, dépenses, congés |

## Réinitialisation des données

Pour remettre les données de démo à zéro (après accumulation ou tests) :

### Méthode 1 : Reset complet avec re-peuplement

```bash
# 1. Supprimer toutes les données
psql $DATABASE_URL -f sql/reset_demo_data.sql

# 2. Re-peupler avec les données initiales
psql $DATABASE_URL -f sql/seed_demo_data.sql
```

### Méthode 2 : Via Supabase SQL Editor

1. Copiez le contenu de `/sql/reset_demo_data.sql`
2. Exécutez dans Supabase SQL Editor
3. Attendez le message de confirmation
4. Répétez avec `/sql/seed_demo_data.sql`

**Temps estimé :** 1-2 minutes pour reset + reseed complet.

## Fréquence de réinitialisation recommandée

| Scénario | Fréquence | Méthode |
|----------|-----------|---------|
| Démonstrations régulières | Hebdomadaire | Script automatisé |
| Démonstrations occasionnelles | Avant chaque démo | Manuel |
| Formation continue | Quotidienne | Script automatisé |
| Environnement public | Hebdomadaire | Automatisé |

## Maintenance

### Vérifications mensuelles

1. **Vérifier les données** :
```sql
SELECT demo_last_reset, AGE(NOW(), demo_last_reset) as time_since_reset
FROM organizations
WHERE slug = 'demo-srp';
```

2. **Nettoyer les fichiers storage** (si applicable) :
```sql
DELETE FROM storage.objects
WHERE bucket_id IN ('intervention-files', 'vault-files')
AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM interventions
  WHERE organization_id = (SELECT id FROM organizations WHERE is_demo = true)
)
AND created_at < NOW() - INTERVAL '90 days';
```

3. **Mettre à jour les données** si nouvelles fonctionnalités :
   - Modifier `/sql/seed_demo_data.sql`
   - Exécuter reset + reseed

## Dépannage

### Problème : La bannière ne s'affiche pas

**Causes possibles :**
1. Le champ `settings.demo_mode` n'est pas à `true`
2. L'application n'a pas été redéployée
3. Le cache du navigateur

**Solutions :**
```sql
-- Vérifier les settings
SELECT settings FROM organizations WHERE slug = 'demo-srp';

-- Forcer demo_mode
UPDATE organizations
SET settings = jsonb_set(settings, '{demo_mode}', 'true'::jsonb)
WHERE slug = 'demo-srp';
```

Puis videz le cache du navigateur (Ctrl+Shift+R).

### Problème : Impossible de se connecter avec les comptes démo

**Causes possibles :**
1. Les utilisateurs n'ont pas été créés dans Supabase Auth
2. Les UUIDs dans `seed_demo_users.sql` sont incorrects
3. Les profils n'ont pas été créés

**Solutions :**
```sql
-- Vérifier si les utilisateurs existent
SELECT id, email FROM auth.users WHERE email LIKE 'demo-%@example.com';

-- Vérifier si les profils existent
SELECT id, email FROM profiles WHERE email LIKE 'demo-%@example.com';
```

Si les utilisateurs n'existent pas, recommencez l'Étape 2.

### Problème : Les données de démo sont visibles par d'autres organisations

**⚠️ CRITIQUE** : Cela indique un problème de RLS.

**Vérification :**
```sql
-- Vérifier que RLS est activé
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('clients', 'interventions', 'expenses')
AND schemaname = 'public';
```

Toutes les tables doivent avoir `rowsecurity = true`.

**Solution :**
```bash
# Ré-exécuter les policies RLS
psql $DATABASE_URL -f sql/multi_tenant_rls.sql
```

### Problème : Erreur "Organisation de démo non trouvée"

**Cause :** Le script `create_demo_organization.sql` n'a pas été exécuté ou a échoué.

**Solution :**
```sql
-- Vérifier si l'organisation existe
SELECT * FROM organizations WHERE slug = 'demo-srp';

-- Si elle n'existe pas, ré-exécuter
-- sql/create_demo_organization.sql
```

## Checklist de validation

Après installation complète, vérifiez :

- [ ] Organisation `demo-srp` créée avec `is_demo = true`
- [ ] 4 utilisateurs créés dans Supabase Auth
- [ ] 4 profils créés dans la table `profiles`
- [ ] 4 rôles assignés dans `organization_roles`
- [ ] Au moins 8 clients créés
- [ ] Au moins 10 interventions créées
- [ ] Au moins 3 contrats de maintenance créés
- [ ] Bannière visible lors de la connexion avec compte démo
- [ ] Bannière NON visible avec compte non-démo
- [ ] Données démo isolées (non visibles par autres orgs)
- [ ] Script de reset fonctionne correctement
- [ ] Documentation `DEMO_GUIDE.md` créée et accessible

## Support

En cas de problème :

1. Vérifiez les logs Supabase (Dashboard → Logs)
2. Vérifiez les logs de l'application (console navigateur)
3. Consultez le fichier `/root/.claude/plans/imperative-growing-thunder.md` pour le plan détaillé
4. Ouvrez une issue GitHub avec :
   - Description du problème
   - Étape où le problème survient
   - Messages d'erreur exacts
   - Résultats des requêtes de vérification

## Prochaines étapes

Une fois l'installation validée :

1. Lisez le [Guide d'utilisation](/docs/DEMO_GUIDE.md)
2. Préparez vos scénarios de démonstration
3. Testez tous les workflows principaux
4. Planifiez la fréquence de réinitialisation

---

**Installation réussie ?** 🎉
Vous êtes prêt à démontrer toutes les fonctionnalités du Portail SRP !
