# Connexion Odoo et Claude — activation

Le serveur utilise le projet Supabase existant, sur l'offre Free vérifiée le 1 novembre 2026. Aucun compte payant, abonnement, crédit IA ou base supplémentaire n'est créé. Il n'appelle aucune API de génération Anthropic. Les limites normales du compte Claude et les quotas Supabase s'appliquent.

## Ce qui est prêt

- Le bloc « Préremplir depuis Odoo » des trois CERFA recherche un contact puis charge ses coordonnées et celles de l'entreprise.
- La fonction `srp-odoo` vérifie l'utilisateur auprès de Supabase Auth, son profil administrateur et son organisation. Elle utilise la clé publique pour appliquer les droits RLS existants ; aucune clé service_role n'est utilisée.
- Claude dispose uniquement des outils `rechercher_clients`, `lire_entreprise`, `preparer_cerfa`. Il ne peut ni modifier Odoo, ni signer, ni lire les dépenses, ni administrer le portail.
- Les liens préparés par Claude contiennent un jeton chiffré AES-GCM, valable dix minutes. Ils exigent une session administrateur de la bonne organisation. Le jeton est retiré de l'adresse après chargement.
- Les signatures et les mesures techniques ne sont jamais déduites des données client.

## Secrets à renseigner dans Supabase

Tableau de bord : https://supabase.com/dashboard/project/hvswbkbwomvwhnqglmbe/functions/secrets

| Nom | Valeur |
| --- | --- |
| `ODOO_URL` | `https://srp04.odoo.com` |
| `ODOO_API_KEY` | Clé API créée dans les préférences de votre compte Odoo ; ne pas la transmettre dans une conversation |
| `ODOO_COMPANY_ID` | Identifiant numérique de la société SRP dans Odoo, à vérifier avant activation |
| `ODOO_ORGANIZATION_ID` | Identifiant de votre organisation affiché dans « Configuration de la connexion » du bloc Odoo d'un CERFA, une fois connecté au portail |
| `ODOO_OWNER_USER_ID` | Identifiant Supabase Auth du titulaire autorisé ; même un autre administrateur de cette organisation est refusé |
| `PORTAL_URL` | `https://portail-srp.vercel.app` |
| `SRP_MCP_TOKEN` | Secret aléatoire d'au moins 32 caractères, différent de la clé Odoo |
| `ALLOWED_ORIGINS` | Facultatif : autres origines exactes autorisées, séparées par des virgules, sans slash final |

`SUPABASE_URL` et `SUPABASE_ANON_KEY` sont fournis automatiquement par Supabase. Aucune valeur secrète ne doit porter le préfixe `VITE_`, ni être enregistrée dans Git.

Un générateur de secret intégré à votre gestionnaire de mots de passe convient à `SRP_MCP_TOKEN`. Utiliser au moins 32 caractères aléatoires. La rotation de ce secret déconnecte Claude et invalide les liens encore en attente.

L'absence de configuration refuse l'accès aux données ; elle n'empêche pas le remplissage manuel habituel. Le serveur n'enregistre jamais les valeurs des secrets dans sa réponse.

## Connecter Claude

Dans Personnaliser → Connecteurs → Ajouter un connecteur personnalisé :

- Nom : **SRP — Odoo et CERFA**
- URL : `https://hvswbkbwomvwhnqglmbe.supabase.co/functions/v1/srp-odoo/mcp`
- Le même transport est aussi accepté à la racine `.../srp-odoo` avec le même jeton, notamment pour le test intégré Supabase.
- Authentification : identifiant fixe dans les en-têtes de requête (sans OAuth)
- En-tête : `Authorization`
- Valeur : `Bearer ` suivi de votre `SRP_MCP_TOKEN`

Ce jeton donne accès aux trois outils ci-dessus avec les droits Odoo de la clé serveur. Ne partagez pas ce connecteur avec d'autres utilisateurs. L'ajout doit être effectué par le titulaire du compte après lecture des droits demandés.

Exemple de demande : « Recherche le client Martin et prépare son CERFA 15498 ». Ouvrir le lien renvoyé avec une session portail active, contrôler les travaux et recueillir les signatures, puis générer le PDF.

## Contrôle avant de déclarer la connexion opérationnelle

1. Le bloc Odoo affiche la recherche de clients après configuration.
2. Une recherche lit un vrai contact Odoo, avec le bon code postal.
3. Les trois CERFA reçoivent le nom, l'adresse et l'entreprise attendus.
4. Claude liste les trois outils et renvoie un lien réellement utilisable.
5. Vérifier qu'une session non autorisée ne peut pas ouvrir ce lien.

Le 1 novembre 2026, la clé créée par l'utilisateur a été enregistrée dans les secrets Supabase. Un appel réel de `lire_entreprise` depuis le test de fonction Supabase a renvoyé les coordonnées de SRP et son SIRET avec `isError: false`. Le SIRET est récupéré dans `company_registry` lorsque le champ français du contact est absent, sans confondre un SIREN à neuf chiffres avec un SIRET.

Le connecteur est connecté dans Claude avec trois outils en lecture seule et une approbation requise. Le 1 novembre 2026, le commit 5791183 a été publié sur le domaine principal après une promotion Vercel réussie. Dans la session du titulaire, les devis Odoo réels et la proposition de rendez-vous ont été vérifiés sans créer de rendez-vous. Les vérifications et limites du planning et des devis sont décrites dans PLANNING-ET-DEVIS.md.

## Isolation de cette connexion

La connexion déployée est dédiée à SRP. Le serveur exige l'identité Auth exacte du titulaire, son appartenance à l'organisation configurée et son rôle administrateur. Ces trois contrôles s'appliquent aussi au statut et aux liens préremplis ; le rôle super-administrateur d'un autre compte ne les contourne pas. Les liens sont liés au titulaire et à l'entité et deviennent invalides si le titulaire configuré change.

Le jeton du connecteur Claude est un identifiant technique privé associé à cette connexion SRP. Il ne dépend pas de l'onglet Chrome ouvert : il autorise les trois outils depuis le compte Claude où il a été installé. Sa possession permet de l'utiliser ; le révoquer exige sa rotation et la mise à jour du connecteur Claude. Il n'accorde ni modification d'Odoo ni signature automatique.

Les brouillons des trois pages CERFA sont séparés par identifiant d'entité, identifiant d'utilisateur et type de formulaire. Les formulaires sont remontés lors d'un changement d'identité ou d'entité. Les anciens brouillons sans propriétaire explicite restent conservés dans leur ancien stockage ; ils ne sont pas automatiquement attribués à un utilisateur.

Avant commercialisation : chaque client doit disposer de sa propre connexion et de ses propres secrets, résolus côté serveur. Cette configuration SRP unique ne doit pas être réutilisée comme connexion commune du SaaS. L'audit global des politiques RLS, du stockage des documents et des autres caches locaux du logiciel reste distinct de ces contrôles du connecteur.
