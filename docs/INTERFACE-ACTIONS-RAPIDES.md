# Accueil et actions rapides — 3 novembre 2026

## Changements

Le choix final remplace le concept futuriste par le modèle 2 « cuivre lumineux ». `workspace-luminous.css` applique une navigation ivoire, des surfaces claires, des accents cuivre satinés et des ombres douces. Le thème clair redevient la valeur par défaut. Les préférences enregistrées restent respectées et la feuille futuriste n'est plus importée.

- Direction visuelle cuivre : navigation anthracite, accents cuivrés et orangés, fonds ivoire chaud et surfaces brunes en mode sombre. Palette partagée dans `src/styles/workspace-copper.css` ; les couleurs des statuts restent distinctes.
- Le troisième concept « cuivre futuriste » est appliqué par `src/styles/workspace-futurist.css` : graphite fumé, bordures et boutons lumineux, relief des panneaux et graphiques cuivrés. Les couleurs des succès et alertes restent distinctes. Le mode sombre devient la valeur par défaut en l'absence de préférence enregistrée ; les choix existants et le mode automatique restent respectés.

- Accueil visuel sur le tableau de bord et le planning administrateur : salutation, date de Paris et raccourcis repliables.
- Bouton Actions rapides accessible dans l'en-tête, avec dialogue natif, recherche, navigation clavier et fermeture par Échap.
- Raccourcis vers le planning, le scan, les demandes personnelles et les dossiers, dérivés de la navigation autorisée du compte.
- Les demandes de congés et de frais suivent les modules accessibles. Aucun raccourci de création d'intervention ou de revue du gérant n'est proposé aux employés.
- Lien de scan `documents?scan=photo` : ouvre le scanner après chargement des documents, puis retire le paramètre pour permettre sa fermeture normale.
- Cartes et tableaux harmonisés, thèmes clair et sombre, points de rupture mobile et respect des préférences de mouvement réduit.
- L'accueil existant des employés reste prioritaire : aucun second bandeau n'est ajouté à leur planning.

## Vérification et limites

110 tests Node passent, dont deux nouveaux contrôles sur les raccourcis et les changements d'accès.
Les tests PDF ne sont pas exécutables sur cette installation : `pdf-lib` manque.
La compilation est bloquée par l'absence de Vite. L'installation depuis le registre npm échoue avec EACCES ; le cache local ne contient pas tous les fichiers requis (ENOTCACHED).
L'accès GitHub depuis le terminal est indisponible et le connecteur n'a pas accès au commit du dépôt (404).
Un aperçu HTML isolé utilisant les feuilles de style du projet et des données fictives a été vérifié dans Chrome sur ordinateur et à 390 pixels, ainsi que le basculement clair/sombre. Aucun débordement horizontal n'est constaté dans cet aperçu. Ce contrôle ne remplace pas la vérification des composants React de l'application complète. Aucune publication de cette version n'a été réalisée. Les fichiers restent dans le dépôt local ; les modifications préexistantes Documents et scanner sont conservées.

## Reprise

1. Rétablir l'accès npm et exécuter `npm ci` avec un cache accessible en écriture.
2. Exécuter `node --test tests/*.test.mjs` et `npm run build`.
3. Vérifier les raccourcis, le retour de focus du dialogue et le scan sur ordinateur et à 360/390 pixels, en clair et sombre, sans enregistrer de données réelles.
4. Publier sur le projet Vercel existant après la réussite de ces contrôles.
