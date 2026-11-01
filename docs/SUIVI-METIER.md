# Suivi métier et demandes de retour au gérant

La page `/followups` rassemble les contrôles arrivés à échéance et permet de consulter tous les dossiers avec filtres et pagination. Les fiches intervention, chantier et devis Odoo affichent le suivi métier : À traiter, Planifié, En cours, En attente, Procédure, Annulé, Terminé. Le motif, l'auteur, l'heure et la prochaine action sont conservés dans un historique en lecture seule.

Le retour du gérant est interprété localement, sans fournisseur d'IA ni API payante. « On attend la pièce vendredi » propose En attente et vendredi comme prochain contrôle ; « dossier chez l'assurance » propose Procédure. Une négation ou plusieurs statuts contradictoires demandent un choix explicite. Le statut et la date restent visibles et modifiables avant application. Une annulation ou une fin de travaux exige un motif et une confirmation, vérifiés aussi côté serveur.

Le suivi métier reste distinct de la facturation. Les devis et factures Odoo sont en lecture seule et restent accessibles uniquement au titulaire de la connexion. Une facture finale ne clôture pas silencieusement le suivi métier. Pour les interventions, les statuts usuels sont synchronisés avec le planning ; En attente et Procédure sont conservés dans le suivi métier. Pour les chantiers, Planifié et En cours se reflètent dans la phase technique ; la fin du suivi ne vaut pas réception administrative du chantier.

## Relances

L'activation désigne le compte administrateur qui l'effectue comme responsable initial et inscrit les interventions et chantiers actifs de son entité. Les devis Odoo non entièrement facturés sont inscrits lorsqu'ils sont consultés, par lots de 25. Leurs anciens marquages En cours sont conservés. L'activation globale SRP n'a pas été exécutée : la vérification automatique d'autorisation demande un accord explicite pour cette création durable sur tous les dossiers de l'entité.

Le compteur des anciens dossiers démarre à l'activation. Un rendez-vous futur n'est relancé qu'après sa date passée de sept jours, sauf contrôle explicitement choisi par le responsable. Une modification métier réelle ou un retour daté repart sur une nouvelle période. Une consultation, le rafraîchissement Odoo ou l'ouverture d'un document ne réinitialisent pas le compteur. Les évolutions des tâches, lots et documents métier de chantier sont prises en compte.

Supabase Cron exécute une requête SQL à la minute 17 de chaque heure, même quand l'application est fermée. Une demande interne est créée une seule fois par évolution du dossier ; un retour ou une progression résout la précédente demande. Les dossiers terminés, annulés, archivés ou supprimés ne sont plus relancés. Le badge « À suivre » et la page du gérant présentent les contrôles échus. Aucun email, SMS ou appel à un service externe n'est envoyé.

## Sécurité et validation

Les tables ont une RLS par entité et par propriétaire pour les devis privés. Les clients peuvent lire les objets autorisés ; ils ne peuvent pas modifier directement les statuts, échéances, demandes ou historiques. Les écritures passent par une commande transactionnelle dont le cœur privé vérifie l'identité Auth, l'organisation et le rôle stocké en base. Les paramètres d'organisation du navigateur ne sont jamais utilisés pour accorder l'accès. Le wrapper public est SECURITY INVOKER ; le cœur privé SECURITY DEFINER est intentionnel pour imposer le protocole d'écriture et les contrôles métier. Le worker planifié n'est pas exécutable par les comptes connectés ou anonymes.

Les révisions empêchent d'écraser une décision concurrente ; un identifiant stable et un digest empêchent le double enregistrement d'un retour. Les essais en base ont été effectués dans des transactions annulées : réponse, rejeu, conflit de révision, confirmation obligatoire, synchronisation du planning, création et évolution d'un chantier, unicité des relances et refus d'accès hors entité. Un essai distinct valide la conservation d'un ancien devis En cours. Aucun dossier ni rendez-vous d'essai n'a été conservé.

74 tests locaux réussis, compilation des modules et CSS réussie. Contrôle des composants réels avec données fictives : retour En attente avec contrôle vendredi, confirmation explicite de clôture, historique et listes. La base et les migrations sont en place ; l'activation globale attend un accord explicite.

## CERFA en mode clair

Les formulaires utilisaient des fonds sombres fixes avec des textes hérités du mode clair. Les formulaires 15497, 15498, 1301 et la fenêtre CERFA utilisent désormais les couleurs du thème. Le 1301 reçoit aussi une mise en page dédiée, avec colonnes adaptées au mobile. Contrôle des trois écrans sur fond blanc et texte foncé, puis en sombre ; aucun débordement horizontal à 390 pixels. Le moteur de remplissage des PDF officiels est inchangé et ses tests passent.
