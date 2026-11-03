# Parcours employés et suivi du gérant

## Changements

- Intervention : désignations du devis en premier, liste longue dépliable, parcours arrivée / photos / contrôles / rapport, progression tirée des données réellement présentes. Aucun changement de statut ou clôture automatique.
- Les alertes ouvrent le bon onglet, même si son contenu n’était pas monté. Onglets contrôlables au clavier et liés à leur panneau par des attributs ARIA.
- Action principale fixe sur mobile, au-dessus de la navigation. L’assistant est décalé pour éviter cette commande.
- Statuts communs avec texte et couleur sur les interventions, congés, dépenses, demandes et dossiers de suivi. Une arrivée enregistrée ne remplace jamais un statut terminal.
- Demandes : guide commun, étapes de préparation et suivi, formulaires et historique harmonisés.
- Frais : suppression des statistiques en double. Cartes cliquables distinguant nombre de notes et montant, filtre direct par statut. Les brouillons locaux sont isolés par entité et utilisateur ; les anciens brouillons globaux ne sont pas réattribués.
- Gérant : recherche et tri sur la page chargée, priorités à revoir / bloqués / anciens, prochaine action explicite. Les compteurs annoncent leur périmètre. Aucun changement aux règles d’enregistrement ni activation des relances.
- En-tête de fiche : statut actualisé avec le rapport, équipe comptée par personnes distinctes, horaires sans secondes, contrastes et icônes adaptés aux deux thèmes.

## Vérifications

- 112 tests Node passent, dont trois cas sur les statuts terminaux, la progression et le tri/recherche du suivi.
- Compilation locale des modules internes et CSS sans avertissement ; contrôle des espaces Git.
- Banc visuel isolé utilisant les composants réels et des données fictives, sans écriture dans les services distants : arrivée, photos, onglets clavier, contrôles, alertes, recherche, cartes de frais et saisie des demandes.
- Contrôles visuels sur ordinateur, à 390 et 360 pixels, thèmes clair et sombre. Aucun débordement horizontal constaté sur les pages contrôlées.
- Ce contrôle ne remplace pas une recette métier avec de vrais dépôts de justificatifs, signature ou géolocalisation ; ces opérations n’ont pas été simulées en production.
