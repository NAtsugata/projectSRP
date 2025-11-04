# 🔐 Configuration du Coffre-Fort Numérique

## Problème rencontré

Vous avez rencontré l'erreur **"une erreur est survenue"** côté employé lors de l'accès au coffre-fort. Cela signifie que la table `vault_documents` n'existe pas encore dans votre base de données Supabase.

## Solution: Configuration en 5 étapes

### Étape 1: Accéder à Supabase Dashboard

1. Connectez-vous à votre compte Supabase: https://supabase.com/dashboard
2. Sélectionnez votre projet

### Étape 2: Créer la table vault_documents

1. Dans le menu de gauche, cliquez sur **"SQL Editor"**
2. Cliquez sur **"New query"**
3. Ouvrez le fichier `database-setup.sql` qui vient d'être créé dans votre projet
4. Copiez **TOUT le contenu** du fichier SQL
5. Collez-le dans l'éditeur SQL de Supabase
6. Cliquez sur le bouton **"Run"** (en bas à droite)
7. Vous devriez voir un message de succès ✅

### Étape 3: Créer le bucket Storage "vault"

1. Dans le menu de gauche, cliquez sur **"Storage"**
2. Cliquez sur **"Create a new bucket"**
3. Remplissez les informations:
   - **Name**: `vault`
   - **Public bucket**: **NON** (décochez cette option - le bucket doit être privé)
4. Cliquez sur **"Create bucket"**

### Étape 4: Vérifier la configuration

1. Retournez dans **"SQL Editor"**
2. Créez une nouvelle requête et exécutez:
   ```sql
   SELECT * FROM vault_documents;
   ```
   Vous devriez voir une table vide (0 rows) - c'est normal ✅

3. Allez dans **"Storage"** et vérifiez que le bucket `vault` existe

### Étape 5: Tester l'application

1. Revenez à votre application
2. Rafraîchissez la page (F5)
3. Connectez-vous en tant qu'**admin**
4. Allez dans **"Coffre-fort numérique"**
5. Essayez d'envoyer un document à un employé
6. Connectez-vous ensuite en tant qu'**employé** et vérifiez que le document apparaît

## 🎯 Fonctionnalités du Coffre-Fort

### Côté Admin
- ✅ Envoyer des documents à n'importe quel employé
- ✅ Voir tous les documents envoyés (organisés par employé)
- ✅ Télécharger n'importe quel document
- ✅ Supprimer des documents

### Côté Employé
- ✅ Voir uniquement ses propres documents
- ✅ Télécharger ses documents
- ❌ Ne peut PAS voir les documents des autres employés (sécurité RLS)

## 🔒 Sécurité (Row Level Security)

Le script SQL configure automatiquement des politiques de sécurité qui garantissent:

1. **Les employés ne peuvent voir QUE leurs propres documents**
2. **Seuls les admins peuvent créer et supprimer des documents**
3. **Les fichiers sont stockés dans un bucket privé (pas d'accès public)**
4. **Chaque employé a son propre dossier dans le storage**

## ❓ En cas de problème

### Erreur: "table vault_documents does not exist"
→ Vous n'avez pas exécuté le script SQL. Retournez à l'étape 2.

### Erreur: "bucket vault does not exist"
→ Vous n'avez pas créé le bucket. Retournez à l'étape 3.

### Erreur: "permission denied" ou "RLS policy violation"
→ Les politiques RLS ne sont pas correctement configurées. Ré-exécutez le script SQL complet.

### L'employé ne voit toujours rien
→ C'est normal si aucun document n'a encore été envoyé. Connectez-vous en tant qu'admin et envoyez un document de test.

## 📝 Variables d'environnement requises

Assurez-vous d'avoir configuré ces variables dans votre fichier `.env`:

```env
REACT_APP_SUPABASE_URL=https://votre-projet.supabase.co
REACT_APP_SUPABASE_ANON_KEY=votre-clé-anonyme
```

Ces informations se trouvent dans:
**Supabase Dashboard > Settings > API**

## ✅ Checklist finale

- [ ] Script SQL exécuté avec succès
- [ ] Bucket `vault` créé (privé)
- [ ] Variables d'environnement configurées
- [ ] Application redémarrée
- [ ] Test envoi de document (admin)
- [ ] Test visualisation (employé)

---

Si tout est configuré correctement, le coffre-fort devrait maintenant fonctionner parfaitement ! 🎉
