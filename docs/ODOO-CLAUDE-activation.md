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

La préparation est testée avec des réponses Odoo simulées ; la validation en direct nécessite la clé créée par l'utilisateur et reste à effectuer. Aucun test local ne doit être présenté comme une connexion Odoo réelle réussie.
