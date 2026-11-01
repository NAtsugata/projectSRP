# Refonte du portail SRP

La navigation, les couleurs, les cartes, les formulaires et les listes partagent désormais une interface claire avec des accents orange SRP, et une variante anthracite. Le logo existant est conservé. Le thème choisi se synchronise entre les commandes du menu et celles du téléphone.

## Utilisation

- Les pages sont regroupées par activité, gestion, équipe, documents et administration. Les modules masqués et les permissions existantes continuent de filtrer tous les accès du menu.
- Le champ « Accéder à une page » recherche uniquement les pages accessibles. `Ctrl K` place le curseur dans ce champ ; Échap ferme les résultats.
- Le tableau de bord présente les indicateurs, un suivi des interventions filtrable et le résumé du mois. Tous les graphiques existants restent disponibles dans « Analyses détaillées ».
- Les chantiers proposent une recherche par nom, client ou adresse, un filtre de statut ou d’échéance dépassée, et un tri par échéance, nom ou avancement. Le détail donne un accès direct aux tâches et aux documents.
- Sur téléphone, la navigation reste en bas, le menu complet s’ouvre dans une fenêtre modale, les formulaires restent accessibles, et les tableaux larges disposent de leur propre défilement. Le planning utilise la liste par défaut sur un nouveau téléphone ; un choix de vue déjà enregistré est conservé.

Les changements d’interface n’ajoutent aucune dépendance et ne modifient ni les services de données, ni les règles d’accès, ni les documents PDF, ni le fonctionnement hors ligne.

## Vérification effectuée

- `node --test tests/workspace-tracking.test.mjs` : huit tests réussis sur les dates locales, les interventions sur plusieurs jours, les urgences, les échéances, les filtres et la préférence de planning mobile.
- Analyse syntaxique de 348 fichiers JavaScript/JSX et compilation des modules internes et du CSS, avec les dépendances npm laissées externes : réussies sans avertissement.
- Aperçu de contrôle local avec les véritables composants d’interface et des données fictives clairement identifiées : tableau de bord, clients, facturation, catalogue et chantiers. Contrôles aux largeurs de téléphone de 320 et 390 pixels, navigation du menu mobile, recherche de pages, filtres de chantier, réinitialisation et synchronisation du thème.
- Aucune erreur de console relevée dans cet aperçu. Le contrôle ne constitue pas une validation des services distants ou des fonctions PDF.

## Vérifications restantes sur l’environnement connecté

L’installation exacte des dépendances et `npm run build` n’ont pas pu être exécutés dans la session locale, faute d’accès réseau et de dépendances disponibles dans le cache. L’aperçu de contrôle utilise des dépendances React de cache et remplace ses services de données ; il est séparé du code livré et ne contient aucune simulation dans la branche applicative.

Avant publication, exécuter `npm ci`, `npm run build` et les tests du dépôt dans l’environnement habituel, puis vérifier les principales actions avec un compte autorisé sur le déploiement de prévisualisation Vercel : connexion, création et modification, fichiers, signatures, PDF et mode hors ligne. L’accès du connecteur à l’équipe Vercel doit être validé pour consulter les résultats du déploiement depuis cette connexion.
