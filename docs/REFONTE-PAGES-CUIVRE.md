# Cuivre lumineux — ensemble du logiciel

La feuille `src/styles/workspace-pages.css` complète l'identité lumineuse sur les modules existants. Les fonctions et les contrôles d'accès ne changent pas.

## Portée

- Planning et agenda : navigation, filtres, calendrier, cartes d'intervention.
- Chantiers, interventions et suivi métier : en-têtes, étapes, cartes et prochaines actions.
- Clients, contrats, devis, facturation, catalogue et export comptable : listes, panneaux de détail, tableaux et statistiques.
- Congés, dépenses, demandes personnelles, utilisateurs et organisations : formulaires, filtres et fenêtres.
- Documents, coffre-fort, archives, scanner, checklists, CERFA et formulaires IR Douche : surfaces et commandes de l'interface.
- Paramètres entreprise et organisation, calculateurs d'aides, connexion et création d'organisation : palette et composants cohérents.
- Signature et justificatifs : fenêtres utilisant les couleurs du thème, y compris les fenêtres montées hors de l'application.

Les couleurs de succès, d'avertissement et de suppression restent distinctes. Les pages PDF rendues, les canevas de plan et les données de signature ne sont pas recolorés.

## Validation de publication

Compiler avec les 116 tests Node existants avant le déploiement. Contrôler les pages accessibles dans la session de l'administrateur en lecture seule, sans sauvegarder de formulaire ni créer de document ou de rendez-vous. Vérifier aussi le mode sombre et la largeur mobile sur les familles de pages représentatives.
