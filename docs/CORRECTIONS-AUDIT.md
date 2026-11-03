# Corrections de l'audit du 2 novembre 2026

Les demandes de congés de l'ancien écran utilisent désormais l'envoi personnel vérifié, les colonnes réelles de la base et un identifiant explicite. La validation précède l'envoi et les mutations attendent réellement la réponse. Les six mutations de dépenses rejettent les erreurs retournées par leur service.

Le cache des dépenses est stocké par entreprise, compte et rôle ; les anciennes données partagées ne sont plus utilisées. Une liste vide remplace le précédent instantané. Les clés React Query incluent l'identité et l'entreprise. Les opérations hors ligne sont désormais liées au compte et à son entreprise ; les opérations historiques sans identité sont conservées mais ne sont plus rejouées automatiquement.

La migration employee_request_access_hardening ajoute des politiques restrictives aux politiques d'entreprise existantes : affectations réservées aux responsables ; congés personnels en lecture et insertion pending, décisions réservées aux responsables ; création d'interventions administrative et modifications limitées aux interventions affectées ; protection des champs de validation et paiement des dépenses par trigger SECURITY INVOKER. Les employés ne peuvent supprimer que leurs dépenses encore en attente.

Vérification : tests serveur employee_access.sql exécutés avec de vraies identités authentifiées dans une transaction annulée, sans demande conservée ; insertion personnelle autorisée, auto-approbation de dépense refusée, approbation de congé par employé sans effet, changement d'affectation refusé, lecture des autres congés refusée, lecture et modification par le responsable autorisées. Tests du cache et des six erreurs de mutation ajoutés. Compilation locale des modules et styles réussie.

Le conseiller de sécurité Supabase ne signale pas de nouveau problème pour cette migration. Il conserve des avertissements préexistants sur des fonctions SECURITY DEFINER et la protection des mots de passe compromis ; ils ne sont pas corrigés globalement par cette modification.
