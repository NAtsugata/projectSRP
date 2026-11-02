# Assistant de demandes personnelles

Accessible aux employés et responsables connectés via « Assistant SRP » et « Mes demandes ». Les modules congés et dépenses respectent les modules et menus déjà disponibles pour l'entreprise.

Le traitement du français est local et déterministe, sans appel à un modèle payant. Il prépare les congés/absences (dates et motif) et les notes de frais (date, montant EUR, catégorie, description). Les valeurs ambiguës restent à compléter. L'utilisateur vérifie le formulaire, ajoute éventuellement trois justificatifs de 5 Mo maximum chacun et confirme explicitement l'envoi. Les demandes sont enregistrées en attente, sans approbation automatique.

Le brouillon est transmis dans l'état du routeur, expire après trente minutes et reste lié au compte et à l'organisation. L'envoi vérifie l'identité authentifiée et l'organisation du profil puis impose ces identifiants et le statut pending. Le suivi lit uniquement les cinquante demandes personnelles les plus récentes. Un identifiant stable évite de réinsérer une demande après un échec réseau. Les justificatifs sont stockés dans le bucket existant expense-receipts. Les politiques serveur existantes restent applicables.

Le formulaire utilise les colonnes présentes dans la base : aucun champ type ou days_count n'est ajouté aux congés. Leur qualification et décompte restent du ressort du responsable. L'assistant planning est conservé pour les responsables. Les formulaires historiques restent disponibles.

Vérifications : 100 tests automatisés réussis ; compilation locale des modules et styles ; essai navigateur avec données fictives pour les dates françaises, le préremplissage, la conservation après panne, la nouvelle tentative, le suivi et le changement de compte ; viewport mobile de 390 px sans débordement horizontal. Les insertions de validation de schéma en base ont été annulées dans une transaction. Aucun congé ni remboursement réel n'a été créé pour tester.
