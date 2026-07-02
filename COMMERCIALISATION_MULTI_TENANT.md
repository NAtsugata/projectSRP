# Audit & durcissement multi-tenant — Commercialisation

> Audit complet du système SQL réalisé le 02/07/2026 sur la base live.
> Objectif : permettre à plusieurs entreprises (organisations) d'utiliser
> le logiciel sans qu'AUCUNE donnée ne passe de l'une à l'autre, avec
> création de comptes self-service et quotas d'abonnement.

## État AVANT l'audit — failles trouvées

### 🔴 Critiques (fuites inter-organisations, corrigées)

| # | Faille | Impact |
|---|--------|--------|
| 1 | Bucket `vault-files` (coffre-fort numérique) : politiques « tout utilisateur authentifié » en lecture/écriture/suppression | N'importe quel utilisateur de n'importe quelle organisation pouvait lire, écraser ou supprimer les documents du coffre-fort de tous les autres |
| 2 | Storage : 6 politiques admin **globales** sans filtre bucket ni organisation (`Les admins peuvent gérer…`, `admin 5ouebl_*`) | Un admin de l'entreprise A gérait TOUS les fichiers de l'entreprise B (tous buckets) |
| 3 | `create_organization_with_admin` appelable par tout utilisateur via `/rest/v1/rpc/` | Escalade de privilèges : n'importe qui pouvait se promouvoir admin ou détourner un utilisateur d'une autre org |
| 4 | `contract_equipment`, `contract_history` : politiques héritées « tout authentifié » (CRUD) | Lecture/écriture inter-org des équipements et historiques de contrats |
| 5 | `contract_visits` : `USING (true)` en lecture + écritures admin global | Visites de maintenance lisibles par tous, modifiables par tout admin |
| 6 | `checklist_templates` : politiques héritées « tout authentifié » (CRUD) | Modèles de checklist partagés/modifiables entre orgs |
| 7 | `intervention_briefing_documents` : bug de tautologie (`ia.intervention_id = ia.intervention_id`) + admin global | Documents de briefing visibles par quiconque avait ≥1 assignation |
| 8 | `checklists`, `electronic_signatures`, `push_subscriptions` : `is_admin()` global non scopé | Un admin d'une org lisait les données des autres orgs |
| 9 | Storage `expense-receipts`, `signature-files`, `cerfa-documents`, `intervention-photos`, `intervention-files` : parties admin non scopées | Lecture/suppression inter-org pour les admins |

### 🟠 Manques commerciaux (ajoutés)

- **Aucune application du quota `max_users`** (la colonne existait mais rien ne l'appliquait)
- **Pas de création d'organisation self-service** (INSERT réservé super admin, aucun RPC sécurisé)
- **`employee_invitations` mort** : table présente mais aucun RPC d'acceptation, aucun lien avec l'inscription
- **`prevent_privilege_escalation` trop strict** : un admin d'org ne pouvait pas promouvoir ses propres employés (seul le super admin le pouvait)
- **Champs d'abonnement modifiables par l'admin d'org** : il pouvait augmenter lui-même son `max_users` / changer son `plan`
- **Pas de colonnes Stripe** sur `organizations`

## Ce qui a été appliqué (4 migrations, déjà en production)

Fichiers dans `sql/` (déjà appliqués via MCP, conservés pour référence) :

1. **`2026_07_mt_hardening_1_tables.sql`** — suppression des politiques héritées,
   re-scoping org de toutes les politiques fautives, helpers `uuid_or_null`,
   `profile_org`, `search_path` fixé sur les helpers.
2. **`2026_07_mt_hardening_2_storage.sql`** — refonte complète des politiques
   storage : chaque bucket isole par propriétaire et/ou organisation.
3. **`2026_07_mt_hardening_3_lifecycle.sql`** — cycle de vie commercial :
   - Colonnes `subscription_status`, `subscription_ends_at`, `stripe_customer_id`,
     `stripe_subscription_id` sur `organizations`
   - Trigger `trg_enforce_org_user_limit` : impossible de dépasser `max_users`
   - Trigger `trg_protect_org_billing` : `plan`/`max_users`/`is_active`/champs
     Stripe modifiables uniquement par le super admin ou le service role (webhook)
   - `prevent_privilege_escalation` v2 : un admin d'org peut gérer `is_admin`/`role`
     des membres de SA propre org (jamais lui-même, jamais `is_super_admin` ni
     `organization_id`)
   - **RPC `create_organization_with_owner(nom, slug?)`** : un inscrit sans org
     crée la sienne (plan `trial`, 5 utilisateurs) et devient owner/admin
   - **RPC `invite_employee(email, role)`** : admin d'org, quota vérifié
     (membres + invitations en attente < `max_users`), token valable 7 jours
   - **RPC `accept_invitation(token)`** : rattache l'invité (email vérifié)
   - **`handle_new_user`** : si un utilisateur s'inscrit avec un email invité,
     il rejoint automatiquement l'organisation
4. **`2026_07_mt_hardening_4_rpc_lockdown.sql`** — `create_organization_with_admin`
   réservée super admin, fonctions trigger retirées de l'API REST, helpers
   interdits à `anon`.

### Frontend corrigé

- `CerfaPage.jsx`, `CerfaPage15498.jsx`, `CerfaManager.jsx` : uploads CERFA
  préfixés par `{organization_id}/cerfa/…` + `organization_id` dans l'insert
  (obligatoire avec les nouvelles politiques). Les anciens fichiers `cerfa/…`
  restent accessibles via une politique legacy scopée par la table
  `cerfa_documents`.

## Vérifications effectuées (base live)

- **Test d'isolation** (JWT simulé, transaction annulée) : un owner d'une
  2ᵉ organisation voit **0** intervention, client, facture, contrat, checklist,
  signature, fichier de coffre-fort, fichier d'intervention, CERFA des autres
  orgs — uniquement son profil et son org.
- **Contre-test sans régression** : nico (admin `demo-srp`) voit toujours ses
  17 interventions, 8 clients, 4 contrats, 14 notes de frais. Les données de
  l'org `default` (78 interventions…) lui sont désormais invisibles — c'était
  la fuite.
- **Advisors Supabase** : plus aucun ERROR ; WARNs restants = fonctions RPC
  volontairement exposées à `authenticated` + protection « mot de passe
  compromis » à activer (voir ci-dessous).

## Parcours commercial cible (côté produit)

1. **Entreprise 1** s'inscrit → appelle `create_organization_with_owner('Mon Entreprise')`
   → devient owner/admin, plan `trial`, 5 utilisateurs.
2. Elle invite ses employés : `invite_employee('employe@ex.fr', 'technician')`
   → l'employé s'inscrit avec cet email → rattaché automatiquement.
3. Quota atteint → erreur `org_user_limit` → écran « Passez à un abonnement
   supérieur » → paiement Stripe → le webhook (service role) met à jour
   `max_users`/`plan`/`subscription_status`.
4. **Entreprise 2** fait pareil : aucune donnée ne circule entre les deux
   (RLS + storage + triggers, vérifié).

## Réorganisation du stockage (entreprise → intervention → employé)

> Ajoutée le 02/07/2026 (`sql/2026_07_storage_reorganization.sql`, appliquée).

**Principe : rien n'est déplacé ni supprimé.** Les chemins des fichiers sont
référencés partout en base (rapports, coffre-fort, JSON) — un déplacement
physique casserait ces références. La réorganisation est donc **logique** :

1. **Registre central `storage_registry`** : les 961 fichiers existants sont
   catalogués `entreprise → intervention → employé → catégorie`
   (interventions, vault, scans, cerfa, expenses, ir-shower, signatures,
   photos, quotes, assets). L'organisation est **figée** dans le registre :
   si l'employé est licencié, désactivé ou supprimé, l'entreprise **garde
   l'accès à 100 % de ses fichiers** (testé : départ simulé → l'admin voit
   toujours les 41 fichiers de coffre-fort de l'ex-employé).
2. **Synchronisation automatique** : trigger sur `storage.objects` — chaque
   nouvel upload est catalogué immédiatement (+ classification à la volée en
   secours via `registry_lookup`).
3. **Arborescence canonique** pour tous les NOUVEAUX uploads :
   ```
   {org_id}/interventions/{intervention_id}/{dossier}/...
   {org_id}/employees/{user_id}/vault/...
   {org_id}/employees/{user_id}/scans/...
   {org_id}/employees/{user_id}/signatures/...
   {org_id}/employees/{user_id}/ir-shower/...
   {org_id}/cerfa/...
   {org_id}/quotes/{quote_id}/...
   ```
   Code mis à jour : `storageService`, `scannedDocumentsService`,
   `electronicSignatureService`, `signatureUtils`, `useElectronicSignature`
   (+ pages CERFA déjà migrées). Les anciens chemins restent lisibles.
4. **Licenciement propre** : RPC `deactivate_employee(user_id)` — compte
   bloqué (`banned_until = infinity`), statut `inactive`, admin retiré,
   **toutes les données conservées et visibles par l'entreprise**.
   `reactivate_employee(user_id)` pour réintégrer.
5. **Historique protégé** : FK `CASCADE → SET NULL` sur `employee_absences`,
   `leave_requests`, `shared_vault_access` — supprimer un profil n'efface
   plus les absences/congés/partages.

**Flux recommandé pour un départ** : appeler `deactivate_employee`, ne PAS
supprimer le compte. Le quota `max_users` compte les profils rattachés ;
pour libérer le siège d'un employé parti, le super admin peut détacher le
profil (`organization_id = NULL`) — les fichiers restent accessibles via le
registre.

## Inscription via le site (fait)

> Ajoutée le 02/07/2026. Modèle **hybride** + **confirmation email obligatoire**.

- **`LoginScreen`** : onglets « Connexion » / « Créer un compte » (nom, email,
  mot de passe ≥ 8 car., confirmation). Après inscription → écran « Vérifiez
  votre boîte mail » avec bouton « Renvoyer l'email ».
- **`authService.signUp()` / `resendConfirmation()`** : inscription Supabase
  avec `emailRedirectTo` vers le site.
- **`OnboardingCreateOrg`** : affiché quand un utilisateur est connecté mais
  sans organisation. Deux onglets :
  - « Créer une entreprise » → RPC `create_organization_with_owner` (devient
    owner/admin, plan trial)
  - « J'ai une invitation » → RPC `accept_invitation(token)` (secours ; les
    invités par email sont déjà rattachés automatiquement à l'inscription)
- **`App.jsx`** : nouvelle porte de routage —
  `session && profile && !organization_id` → `OnboardingCreateOrg`
  (aucune régression : tous les profils existants ont déjà une organisation).

### ⚠️ Réglages Supabase Dashboard requis (1 fois)

1. **Authentication → Providers → Email → « Confirm email » = ON**
   (sinon l'inscription connecte directement sans vérifier l'email ; le code
   gère les deux cas mais le modèle choisi impose la confirmation).
2. **Authentication → URL Configuration** : ajouter l'URL du site (prod + local)
   dans *Redirect URLs* pour que le lien de confirmation revienne sur le site.
3. **Authentication → Providers → Email → « Confirm email » template** :
   personnaliser l'email si besoin (marque SRP).

## Reste à faire (hors SQL)

- [ ] **Page « Invitations » dans l'admin** : appel `invite_employee` +
  envoi de l'email d'invitation (via Edge Function ou service mail)
- [ ] **Stripe** : Edge Function webhook (`checkout.session.completed`,
  `customer.subscription.updated`) qui met à jour `organizations` avec la clé
  service role
- [ ] **Dashboard Supabase → Auth** : activer la protection « leaked password »
  (HaveIBeenPwned) — voir advisor
- [ ] Optionnel : resserrer `interventions` UPDATE (aujourd'hui tout membre de
  l'org peut modifier ; passer à admin/assigné si souhaité)
- [ ] Optionnel : politique de rétention des invitations expirées (cron de purge)
