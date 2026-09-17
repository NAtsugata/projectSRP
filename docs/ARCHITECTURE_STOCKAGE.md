# Architecture de stockage des fichiers

> Objectif : une organisation claire et tenable à l'échelle (50 entreprises × 100 employés),
> où la base de données ne contient **que des métadonnées** et où chaque entreprise est
> isolée, mesurée et limitée.

## 1. Principes

| Principe | Mise en œuvre |
|---|---|
| **Aucun fichier dans la base** | Les fichiers vivent dans Supabase Storage. Les tables ne stockent que `{ bucket, path, name, size, mime }`. Les anciens justificatifs de dépenses en base64 sont migrables depuis Réglages → Stockage (originaux conservés dans `expenses.receipts_legacy_base64`). |
| **Une seule convention de chemin** | `{organisation_id}/…` en tête de **tous** les chemins. Le premier dossier suffit à isoler une entreprise dans les politiques RLS. |
| **Registre central** | `storage_registry` = une ligne par fichier (bucket, chemin, organisation, employé, intervention, catégorie, taille, MIME), synchronisée automatiquement par trigger sur `storage.objects`. C'est la source des quotas, des statistiques et de la détection des orphelins. |
| **Quota par entreprise** | `organizations.storage_used_bytes` (compteur maintenu par trigger) et `organizations.storage_quota_bytes` (null = défaut du plan). L'upload est **refusé** au-delà du quota (`code: storage_quota_exceeded`). |
| **Accès privé, URL signées** | Tous les buckets sont privés sauf `organization-assets` (logos). Les lectures passent par des URL signées (1 h), mises en cache côté client (`storageService.resolveFileUrl`). |
| **Images compressées avant envoi** | `compressImage` (≤ 1600 px, ≈ 300 ko) — une photo de téléphone de 4 Mo ne doit jamais partir telle quelle. |
| **Rien n'est supprimé automatiquement** | Suppression explicite (avec la dépense) ou via l'outil « Fichiers orphelins » des réglages. Les justificatifs comptables ne sont jamais purgés sans action de l'administrateur. |

## 2. Arborescence canonique

```
{org_id}/
├── interventions/{intervention_id}/{dossier}/…      bucket intervention-files
├── employees/{user_id}/
│   ├── expenses/{expense_id}/{horodatage}_{aléa}.jpg  bucket expense-receipts
│   ├── vault/…                                        bucket vault-files
│   ├── scans/…  signatures/…  ir-shower/…
├── chantiers/{chantier_id}/docs|media/…               buckets chantier-docs / chantier-media
├── cerfa/…                                            bucket cerfa-documents
├── quotes/{quote_id}/…                                bucket quote-attachments
└── assets/…  (logo.png)                               bucket organization-assets (public)
```

Les anciens chemins (`{user_id}/…`, `{intervention_id}/…`, `cerfa/…`) restent lisibles :
`storage_classify()` sait les rattacher à une organisation, et le registre les catalogue.
**Ne jamais déplacer un fichier existant** : ses chemins sont référencés en base.

## 3. Buckets et limites

| Bucket | Contenu | Taille max | Types |
|---|---|---|---|
| `expense-receipts` | Justificatifs de dépenses | 5 Mo | images, PDF |
| `intervention-files` | Rapports, pièces jointes, audio | 10 Mo | images, PDF, Office, audio |
| `intervention-photos` | Photos d'intervention | 10 Mo | images |
| `vault-files` | Coffre-fort employé | 10 Mo | libre |
| `cerfa-documents` | CERFA générés | 10 Mo | PDF, images |
| `chantier-docs` / `chantier-media` | Documents / photos de chantier | 50 Mo / 25 Mo | validés côté client |
| `quote-attachments` | Pièces jointes devis | 10 Mo | images, PDF |
| `signature-files` | Signatures électroniques | 2 Mo | images |
| `organization-assets` | Logo (public) | 2 Mo | images |

## 4. Quotas

- Défaut par plan (`org_storage_quota_bytes`) : **5 Go** (essai), **25 Go** (premium), **100 Go** (enterprise).
  Surcharge possible par organisation via `organizations.storage_quota_bytes`.
- Le compteur `storage_used_bytes` est exact (recalculé à partir du registre lors de la migration,
  puis maintenu à chaque ajout/suppression).
- Contrôle bloquant : trigger `trg_enforce_storage_quota` (BEFORE INSERT sur `storage.objects`).
  Conçu pour ne **jamais** bloquer un upload pour une autre raison qu'un dépassement de quota.
- Interface : Réglages → 💾 Stockage (barre d'usage, répartition par catégorie).

## 5. Cycle de vie

| Événement | Comportement |
|---|---|
| Création d'une dépense | `expenseService.createExpense` génère l'identifiant, compresse et envoie les photos dans `expense-receipts`, insère les métadonnées (`expense_receipts` + `expenses.receipts`). |
| Suppression d'une dépense | Les chemins sont lus **avant** la suppression, la ligne est supprimée (cascade sur `expense_receipts`), puis les fichiers sont retirés du bucket. |
| Suppression d'une intervention / d'un chantier | Les fichiers restent : ils apparaissent dans « Fichiers orphelins » (RPC `storage_orphans`) où l'administrateur peut les supprimer. |
| Employé licencié / supprimé | Les fichiers appartiennent à l'**organisation** (registre figé) et restent accessibles aux administrateurs. |
| Départ d'une organisation (résiliation) | Tout est sous `{org_id}/…` : suppression ou export d'un préfixe unique. |

## 6. Capacité (ordre de grandeur)

50 entreprises × 100 employés = 5 000 utilisateurs.
Hypothèse : 10 dépenses/employé/mois × 2 photos × 300 ko = **6 Mo / employé / mois**, soit ≈ 30 Go/mois
pour l'ensemble, côté Storage (facturé au Go, sans effet sur les performances de la base).
La base de données, elle, ne grossit que de quelques centaines d'octets par fichier (registre + métadonnées) :
≈ 100 000 fichiers/mois → ≈ 50 Mo/mois.

## 7. Code

- `src/services/storageService.js` : `uploadExpenseReceipt`, `resolveFileUrl` (cache), `removeFiles`,
  `getOrganizationUsage`, `listOrphans`, `dataUrlToBlob`.
- `src/services/expenseService.js` : `createExpense`, `getExpenseReceipts`, `deleteExpense*`, `migrateLegacyReceipts`.
- `src/components/admin/StorageSettingsPanel.jsx` : onglet Stockage.
- SQL : `sql/2026_07_storage_reorganization.sql` (convention + registre) puis
  `sql/2026_09_storage_architecture.sql` (tailles, quotas, cycle de vie).

## 8. Règles pour ajouter un nouveau type de fichier

1. Choisir le bucket (ou en créer un avec `file_size_limit` et `allowed_mime_types`).
2. Construire le chemin avec `getOrgId()` en tête : `{org}/{domaine}/{entité}/{fichier}`.
3. Stocker en base uniquement `{ bucket, path, name, size, mime }` ; afficher via `resolveFileUrl`.
4. Compresser les images avant envoi.
5. Prévoir la suppression des fichiers avec l'entité parente (ou s'appuyer sur l'outil orphelins).
