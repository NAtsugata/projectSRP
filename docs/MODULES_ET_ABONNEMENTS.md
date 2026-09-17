# Modules vendus séparément & abonnements

> Objectif : vendre chaque fonctionnalité séparément — par formule (bouquet) ou à la carte —
> avec un verrouillage réel par entreprise, pas seulement un menu masqué.

## 1. Le modèle

| Notion | Où | Rôle |
|---|---|---|
| **Module** | table `app_modules` | Une fonctionnalité vendable (clé, libellé, description, catégorie, prix indicatif). 17 modules aujourd'hui ; les pages « cœur » (tableau de bord, planning, utilisateurs, réglages) ne sont jamais vendues séparément. |
| **Formule** | table `plan_modules` | Bouquet de modules inclus par plan (`free`, `starter`, `pro`, `premium`, `enterprise`). Modifiable sans déploiement. |
| **Droit explicite** | table `organization_modules` | Par entreprise et par module : activé/désactivé, origine (`plan` / `addon` = option à la carte / `trial` = essai / `manual`), date de fin. **Prime sur la formule.** |

Règle d'évaluation (`org_has_module(org, clé)`) : module cœur → oui ; droit explicite → sa valeur (et non expiré) ;
sinon → inclus dans la formule de l'entreprise ?

## 2. Où le verrou s'applique

1. **Menu** (ordinateur et mobile) : les modules non inclus n'apparaissent pas.
2. **Pages** : une URL directe vers un module non inclus affiche l'écran « Ce module n'est pas inclus dans votre abonnement » (composant `ModuleGate`).
3. **Base de données** : toute **création ou modification** dans les tables du module est refusée (`code: module_not_active`), même en contournant l'interface. La **lecture reste possible** : une entreprise dont un module expire garde l'accès à ses données (consultation, export) — elle ne peut plus en produire.

Le super-administrateur (vous) n'est jamais bloqué.

## 3. Vendre / activer un module

Page **Organisations** (super-admin) → bouton 🧩 sur la carte de l'entreprise :

- **Selon la formule** : le module suit le plan de l'entreprise.
- **Option à la carte** : activé en plus de la formule (vente séparée).
- **Essai** : activé jusqu'à une date ; expire tout seul.
- **Manuel** : dérogation (ex. désactiver un module pourtant inclus dans la formule).

Tout changement est immédiat (les utilisateurs voient le menu se mettre à jour au prochain chargement, au plus tard 5 minutes).

Devenir super-administrateur (une fois, en SQL) : `UPDATE profiles SET is_super_admin = true WHERE email = '…';`

## 4. Ce que voit le client

- Réglages → **Modules du menu** : les modules inclus peuvent être masqués/affichés par le chef d'entreprise ; les modules non inclus sont indiqués « non inclus dans votre abonnement ».
- Écran de module verrouillé : nom, description, rappel que les données sont conservées, invitation à contacter le fournisseur.

## 5. Modules et tables verrouillées

| Module | Pages | Tables (écriture refusée si désactivé) |
|---|---|---|
| chantiers | /chantiers | chantiers, chantier_lots/zones/tasks/documents/media |
| smart-planning | /multi-day-planning | — (interface) |
| agenda, archives, ir-docs, monthly-export, aides | pages dédiées | — (interface) |
| checklists | /checklists, /checklist-templates | checklists, checklist_templates |
| leaves | /leaves, /admin-leaves | leave_requests, employee_absences |
| expenses | /expenses, /admin-expenses | expenses, expense_receipts |
| vault | /vault, /admin-vault | vault_documents, shared_vault_access |
| documents | /documents | scanned_documents |
| clients | /clients | clients, client_contacts |
| invoices | /invoices, /quotes/* | invoices, invoice_items, quotes, quote_* |
| catalog | /catalog | catalog_items, catalog_categories |
| contracts | /contracts | maintenance_contracts, contract_*, maintenance_reports |
| cerfa | /cerfa, /cerfa-form* | cerfa_documents |

## 6. Mise en place sans régression

À l'activation du système, **toutes les organisations existantes ont reçu un droit explicite « activé » sur tous les modules**
(origine `manual`). Rien n'a changé pour elles ; vous retirez ensuite ce que vous voulez, entreprise par entreprise.

## 7. Facturation

`app_modules.price_monthly_cents` est indicatif. Les colonnes Stripe existent déjà sur `organizations`
(`stripe_customer_id`, `stripe_subscription_id`) : l'étape suivante est de faire piloter `organization_modules`
par les webhooks Stripe (abonnement = formule, produits additionnels = options). Le modèle de données est prêt pour ça.

## 8. Code

- `src/services/moduleService.js`, `src/hooks/useModules.js`
- `src/components/ModuleGate.jsx` (garde de page + écran verrouillé + `withModule`)
- `src/components/admin/OrganizationModulesModal.jsx` (super-admin)
- `src/App.jsx` : pages enveloppées via `withModule('clé', Page)`
- SQL : `sql/2026_09_modules_entitlements.sql`
