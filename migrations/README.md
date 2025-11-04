# Migrations Base de Données - Coffre-fort Numérique

## Migration: add_vault_features.sql

Cette migration ajoute les fonctionnalités avancées au coffre-fort numérique.

### Colonnes ajoutées :

| Colonne | Type | Description |
|---------|------|-------------|
| `file_size` | BIGINT | Taille du fichier en octets |
| `description` | TEXT | Description optionnelle du document |
| `tags` | TEXT[] | Tags/étiquettes pour la recherche |
| `is_favorite` | BOOLEAN | Indicateur de document favori (défaut: FALSE) |

### Comment exécuter la migration :

#### Option 1: Via Supabase Dashboard (Recommandé)

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans **SQL Editor** (icône </> dans le menu latéral)
3. Cliquez sur **+ New query**
4. Copiez le contenu du fichier `add_vault_features.sql`
5. Collez-le dans l'éditeur
6. Cliquez sur **Run** (ou appuyez sur Ctrl+Enter)
7. Vérifiez les messages de sortie pour confirmer que les colonnes ont été ajoutées

#### Option 2: Via CLI Supabase

```bash
# Si vous avez supabase CLI installé
supabase db push --db-url "votre-database-url"
```

#### Option 3: Via psql

```bash
psql postgresql://your-connection-string -f migrations/add_vault_features.sql
```

### Vérification de la migration :

Après avoir exécuté la migration, vous pouvez vérifier que les colonnes ont été ajoutées :

```sql
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'vault_documents'
ORDER BY ordinal_position;
```

Vous devriez voir les 4 nouvelles colonnes : `file_size`, `description`, `tags`, et `is_favorite`.

### Que faire si la migration échoue ?

#### Erreur : "Table vault_documents does not exist"
La table n'existe pas encore. Créez-la d'abord :

```sql
CREATE TABLE vault_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    -- Les colonnes avancées seront ajoutées par la migration
);
```

#### Erreur : "Permission denied"
Assurez-vous d'avoir les droits d'administration sur la base de données.

### Rollback (Annulation)

Si vous souhaitez annuler la migration :

```sql
ALTER TABLE vault_documents
    DROP COLUMN IF EXISTS file_size,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS tags,
    DROP COLUMN IF EXISTS is_favorite;
```

⚠️ **Attention**: Cela supprimera toutes les données de ces colonnes !

### RLS (Row Level Security)

Les politiques RLS existantes continuent de s'appliquer aux nouvelles colonnes. Assurez-vous que :

- Les employés peuvent lire leurs propres documents (y compris les nouvelles colonnes)
- Les employés peuvent mettre à jour `is_favorite` sur leurs propres documents
- Les admins peuvent créer/mettre à jour tous les documents

Exemple de politique pour permettre aux employés de mettre à jour leurs favoris :

```sql
CREATE POLICY "Users can update their own favorites"
ON vault_documents
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Notes importantes :

1. **Compatibilité descendante** : Le code fonctionne même si les colonnes n'existent pas (mode dégradé)
2. **Données existantes** : Les documents existants auront NULL pour les nouvelles colonnes
3. **Performance** : L'ajout de colonnes sur une table vide ou petite est instantané
4. **Backup** : Faites toujours un backup avant d'exécuter une migration sur production

### Support :

Si vous rencontrez des problèmes, vérifiez :
1. Les logs Supabase
2. Les messages d'erreur dans la console du navigateur (F12)
3. Les logs du serveur (côté Node.js si applicable)
