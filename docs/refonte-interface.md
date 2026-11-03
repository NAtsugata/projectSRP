# Refonte du portail SRP

La navigation, la connexion, les couleurs, les cartes, les formulaires et les listes partagent désormais une interface claire avec des accents orange SRP, et une variante anthracite. Le logo existant est conservé. Le thème choisi se synchronise entre les commandes du menu et celles du téléphone.

## Utilisation

- Les pages sont regroupées par activité, gestion, équipe, documents et administration. Les modules masqués et les permissions existantes continuent de filtrer tous les accès du menu.
- Le champ « Accéder à une page » recherche uniquement les pages accessibles. `Ctrl K` place le curseur dans ce champ ; Échap ferme les résultats.
- Le tableau de bord présente les indicateurs, un suivi des interventions filtrable et le résumé du mois. Tous les graphiques existants restent disponibles dans « Analyses détaillées ».
- Le résumé de l’activité propose six liens explicites vers les pages concernées. Les notes en attente affichent le nombre de notes et le montant à valider dans deux blocs séparés, avec les centimes. Le lien ouvre le statut « En attente » sur toutes les périodes ; les dépenses du mois ouvrent uniquement le mois courant. Ces filtres sont conservés dans l’URL. Les cartes de la page Dépenses appliquent également leur filtre au clic.
- Les chantiers proposent une recherche par nom, client ou adresse, un filtre de statut ou d’échéance dépassée, et un tri par échéance, nom ou avancement. Le détail donne un accès direct aux tâches et aux documents.
- Sur téléphone, la navigation reste en bas, le menu complet s’ouvre dans une fenêtre modale, les formulaires restent accessibles, et les tableaux larges disposent de leur propre défilement. Le planning utilise la liste par défaut sur un nouveau téléphone ; un choix de vue déjà enregistré est conservé.

Les changements d’interface n’ajoutent aucune dépendance et ne modifient ni les services de données, ni les règles d’accès, ni les documents PDF, ni le fonctionnement hors ligne.

## Vérification effectuée

- `node --test tests/workspace-tracking.test.mjs tests/dashboard-summary.test.mjs` : quatorze tests réussis sur les dates locales, les interventions sur plusieurs jours, les urgences, les échéances, les filtres, le planning mobile, la séparation quantité/montant, les centimes et les destinations des cartes.
- Parcours des dépenses vérifié dans l’aperçu de contrôle : une note ancienne en attente reste visible après le clic sur son résumé, la période « Tout » est sélectionnée, et le clic sur les dépenses mensuelles affiche uniquement les deux notes du mois avec un total de 14,45 € dans les données fictives.
- Analyse syntaxique de 348 fichiers JavaScript/JSX et compilation des modules internes et du CSS, avec les dépendances npm laissées externes : réussies sans avertissement.
- Aperçu de contrôle local avec les véritables composants d’interface et des données fictives clairement identifiées : tableau de bord, clients, facturation, catalogue et chantiers. Contrôles aux largeurs de téléphone de 320 et 390 pixels, navigation du menu mobile, recherche de pages, filtres de chantier, réinitialisation et synchronisation du thème.
- Aucune erreur de console relevée dans cet aperçu. Le contrôle ne constitue pas une validation des services distants ou des fonctions PDF.

## Déploiement et vérifications restantes

L’installation exacte des dépendances et `npm run build` n’ont pas pu être exécutés dans la session locale, faute d’accès réseau et de dépendances disponibles dans le cache. Le premier déploiement Vercel de la refonte (commit `63a9726`) a ensuite terminé son build complet avec le statut Ready. La page de connexion a été ouverte sur le déploiement hébergé. L’aperçu de contrôle local utilise des dépendances React de cache et remplace ses services de données ; il est séparé du code livré et ne contient aucune simulation dans la branche applicative.

Avant publication en production, vérifier les principales actions avec un compte autorisé sur le déploiement de prévisualisation Vercel : connexion, création et modification, fichiers, signatures, PDF et mode hors ligne. Le compte ouvert sur le domaine de production n’est pas automatiquement connecté sur le domaine de prévisualisation. L’accès du connecteur à l’équipe Vercel reste à valider ; l’état Ready du premier déploiement a été vérifié depuis la session Chrome autorisée de l’utilisateur.
