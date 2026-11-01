# Assistant planning et suivi Odoo

L'assistant est disponible pour les administrateurs dans le bouton flottant « Assistant planning », sur ordinateur et mobile. Aucun fournisseur d'IA ni API payante n'est appelé. Il reconnaît des commandes françaises structurées, pas toutes les formulations d'une conversation libre.

Exemple : « Tiemoko et Seb rendez-vous chez Leneutre demain et après-demain à 9h pendant 1h ». Les personnes et le client doivent exister dans l'entité courante. Un prénom abrégé ambigu demande une précision. Les dates sont calculées en Europe/Paris. Sans heure ni durée, l'interface propose un créneau de 1h, affiché avant création.

La création groupée vérifie à nouveau les appartenances, absences, congés et chevauchements côté base. Toutes les interventions et affectations du lot sont enregistrées ensemble. Une même demande rejouée ne crée pas de doublon. Les interventions anciennes sans heure ou durée bloquent prudemment la journée des personnes affectées. Horaires proposés : 08h–12h et 13h–18h. Les jours explicitement demandés peuvent inclure un week-end.

Les interventions à traiter correspondent aux interventions actives non terminées dont la date est aujourd'hui ou passée, limitées aux cinq plus anciennes. Un créneau suggéré pour une intervention existante renvoie vers sa fiche pour la déplacer, afin de ne pas la dupliquer. Les changements d'interventions sont reçus par Supabase Realtime ; une coupure réseau nécessite de rouvrir/actualiser. Les verrous sérialisent les créations entre assistants ; les anciens formulaires manuels n'utilisent pas encore ces verrous.

La page « Devis Odoo » est protégée côté serveur par l'identité du titulaire SRP et son organisation. Elle affiche 25 devis par page, cherche par référence/client, permet de marquer « À traiter » ou « En cours » et déduit « Traité » de la facturation complète comptabilisée. Acompte, brouillon, annulation, données tronquées et avoir ne déclenchent pas seuls ce statut. Les montants, devis et factures sont présentés séparément avec leur devise ; « Traité » ne signifie pas « Payé ». Aucun devis ni facture Odoo n'est modifié. Les statuts de travail sont privés au titulaire. La lecture Odoo se rafraîchit toutes les 30 secondes quand la page est visible.

## Validation du 1 novembre 2026

- 48 tests locaux réussis : sécurité du connecteur, CERFA, classement des factures, parser et disponibilités, suivi existant.
- Compilation des modules internes et CSS réussie ; le build Vite complet est effectué par Vercel.
- Test réel du RPC sous rôle authenticated dans une transaction intégralement annulée : création, rejeu idempotent, refus d'un chevauchement. Aucun rendez-vous d'essai conservé.
- Fonction SQL SECURITY INVOKER, exécution anonyme révoquée ; RLS activée sur les deux nouvelles tables.
- Les avis de sécurité Supabase ne signalent pas ces nouveaux objets. Des avertissements antérieurs sur 54 fonctions SECURITY DEFINER appelables par les comptes connectés et la protection des mots de passe compromis restent à examiner avant une commercialisation. La présence d'un avertissement n'établit pas à elle seule une fuite ; les contrôles de chaque fonction doivent être revus.

L'audit de sécurité global du SaaS et la gestion de connexions Odoo propres à chaque futur client restent nécessaires. La connexion SRP actuelle n'est jamais une connexion commune à tous les clients.
