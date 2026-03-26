# Guide d'Utilisation - Compte de Démonstration

Guide pratique pour utiliser l'environnement de démonstration du Portail SRP lors de présentations, formations ou tests.

## Identifiants de Connexion

### Comptes Disponibles

| Rôle | Email | Mot de passe | Accès |
|------|-------|--------------|-------|
| **Administrateur** | `demo-admin@example.com` | `Demo2024!Admin` | Accès complet à toutes les fonctionnalités |
| **Manager** | `demo-manager@example.com` | `Demo2024!Manager` | Planning, validation, rapports |
| **Technicien 1** | `demo-tech1@example.com` | `Demo2024!Tech` | Interventions, dépenses, congés |
| **Technicien 2** | `demo-tech2@example.com` | `Demo2024!Tech` | Interventions, dépenses, congés |

💡 **Conseil** : Commencez toujours par le compte **Administrateur** pour une vue d'ensemble complète.

## Reconnaissance du Mode Démo

Lorsque vous êtes connecté avec un compte de démonstration, vous verrez :

✅ **Bannière orange en haut** de l'écran :
```
⚠ ENVIRONNEMENT DE DÉMONSTRATION
Les données sont fictives et peuvent être réinitialisées
```

Cette bannière confirme que vous êtes bien en mode démo et que les données ne sont pas réelles.

## Scénarios de Démonstration

### Scénario 1 : Vue d'ensemble rapide (5 minutes)

**Objectif** : Montrer les principales fonctionnalités de l'application.

**Compte** : `demo-admin@example.com`

1. **Dashboard** (`/dashboard`)
   - Statistiques du mois en cours
   - Graphiques d'activité
   - Interventions récentes
   - État des dépenses

2. **Planning** (`/planning`)
   - Vue Gantt des interventions
   - Filtres par technicien, date, statut
   - Affectation rapide

3. **Clients** (`/clients`)
   - Liste des clients (particuliers, entreprises)
   - Fiche client avec historique
   - Gestion des contacts

4. **Interventions** (depuis Planning)
   - Créer une nouvelle intervention
   - Visualiser une intervention terminée
   - Voir photos et signatures

---

### Scénario 2 : Workflow Intervention Complète (10-15 minutes)

**Objectif** : Démontrer le cycle complet d'une intervention.

**Comptes utilisés** : Admin (planification) + Technicien (exécution)

#### Phase 1 : Planification (Admin)

1. **Se connecter** avec `demo-admin@example.com`

2. **Créer une nouvelle intervention** :
   - Aller sur `/planning`
   - Cliquer "Nouvelle intervention"
   - Sélectionner un client existant (ex: "Dupont Pierre")
   - Service : "Installation robinetterie"
   - Date : Aujourd'hui
   - Affecter à : Marc Lefebvre (demo-tech1)
   - Sauvegarder

3. **Visualiser dans le Gantt** :
   - Voir l'intervention apparaître dans le planning
   - Démontrer les filtres (par technicien, par date)

#### Phase 2 : Exécution (Technicien)

1. **Se déconnecter et reconnecter** avec `demo-tech1@example.com`

2. **Accéder aux interventions du jour** :
   - Aller sur `/planning` ou `/agenda`
   - Voir l'intervention assignée

3. **Compléter l'intervention** :
   - Ouvrir le détail de l'intervention
   - Ajouter une photo (simuler la capture)
   - Compléter la checklist
   - Ajouter des notes
   - Demander la signature client (simuler)
   - Marquer comme "Terminée"

4. **Créer une dépense associée** :
   - Aller sur `/expenses`
   - Nouvelle dépense
   - Catégorie : "Fournitures"
   - Montant : 45,00 €
   - Description : "Mitigeur + raccords"
   - Joindre reçu (optionnel)

#### Phase 3 : Validation (Admin)

1. **Reconnecter** avec `demo-admin@example.com`

2. **Valider la dépense** :
   - Aller sur `/expenses`
   - Filtrer "En attente"
   - Approuver la dépense de Marc

3. **Générer un rapport** :
   - Voir l'intervention terminée dans `/archives`
   - Exporter en PDF si besoin

---

### Scénario 3 : Gestion Administrative (10 minutes)

**Objectif** : Montrer les fonctionnalités de gestion RH et administrative.

**Compte** : `demo-admin@example.com`

#### A. Gestion des Congés

1. **Aller sur** `/leaves`
2. **Voir les demandes en attente** :
   - Sophie Dubois : Vacances été (11 jours)
   - Marc Lefebvre : Pont Pentecôte (2 jours)
3. **Approuver/rejeter** une demande
4. **Visualiser le calendrier** des absences

#### B. Gestion des Utilisateurs

1. **Aller sur** `/users`
2. **Voir la liste des employés** :
   - Jean Martin (Owner)
   - Sophie Dubois (Manager)
   - Marc Lefebvre (Technician)
   - Julie Roux (Technician)
3. **Modifier les permissions** (démonstration)
4. **Ajouter un nouveau rôle** (simulation)

#### C. Documents et Coffre-fort

1. **Coffre-fort** (`/vault`) :
   - Documents personnels des employés
   - Certificats, diplômes
   - Gestion des permissions d'accès

2. **Documents scannés** (`/documents`) :
   - Scanner un document (simulation avec photo)
   - Détection automatique des contours
   - Export en PDF

---

### Scénario 4 : Fonctionnalités Avancées (15 minutes)

**Objectif** : Présenter les fonctionnalités spécifiques et différenciantes.

**Compte** : `demo-admin@example.com`

#### A. Contrats de Maintenance

1. **Aller sur** `/contracts`
2. **Voir les contrats actifs** :
   - Résidence Les Oliviers (trimestriel, 1 200 €/an)
   - Hôtel des Alpes (trimestriel, 2 400 €/an)
   - Mairie de Sisteron (mensuel, 15 000 €/an)
3. **Consulter un contrat** :
   - Détails du client
   - Équipements sous contrat
   - Historique des visites
   - Prochaine visite planifiée
4. **Planifier une visite de maintenance**

#### B. Documents CERFA

1. **Aller sur** `/cerfa`
2. **Voir les documents générés** :
   - CERFA 15497 (Installation PAC)
   - CERFA 15498 (Chaudière)
3. **Créer un nouveau CERFA** :
   - Sélectionner le type (15497, 15498, 1301)
   - Remplir automatiquement depuis intervention
   - Générer le PDF

#### C. Facturation

1. **Aller sur** `/invoices`
2. **Créer une facture** :
   - Sélectionner client
   - Ajouter lignes depuis interventions
   - Calculer TVA automatiquement
   - Aperçu PDF
3. **Exporter pour comptabilité** (`/monthly-export`)

#### D. Calculateur d'Aides État

1. **Aller sur** `/calculateur-aides`
2. **Simuler une installation** :
   - Type : Pompe à chaleur
   - Revenus client : Modestes
   - Calcul automatique MaPrimeRénov'
   - CEE et autres aides

---

## Données de Démonstration Disponibles

### Clients (8)

| Nom | Type | Ville |
|-----|------|-------|
| Dupont Pierre | Particulier | Digne-les-Bains |
| Résidence Les Oliviers | Copropriété VIP | Manosque |
| Mairie de Sisteron | Administration | Sisteron |
| Restaurant Le Provençal | Commerce | Digne-les-Bains |
| Hôtel des Alpes | Hôtellerie VIP | Digne-les-Bains |
| Bernard & Marie Laurent | Particulier | Manosque |
| Pharmacie du Centre | Commerce | Digne-les-Bains |
| École Primaire Jean Giono | Établissement | Digne-les-Bains |

### Interventions (~15)

- **Terminées** : Réparation fuite, Installation robinetterie, Débouchage, etc.
- **En cours** : Dépannage urgence restaurant (pas d'eau chaude)
- **Planifiées** : Maintenance préventive (aujourd'hui), Installation chauffage (multi-jours)

### Contrats de Maintenance (4)

- Résidence Les Oliviers - Maintenance trimestrielle
- Hôtel des Alpes - Contrat annuel
- Mairie de Sisteron - Marché public
- École Jean Giono - Maintenance biannuelle

### Dépenses (~10)

- Déplacements, fournitures, repas, formation, outillage
- Statuts variés : approuvées, en attente

### Demandes de Congés (7)

- Vacances, jours fériés, maladie
- Différents statuts : approuvées, en attente

## Conseils pour une Bonne Démonstration

### Avant la Démonstration

1. ✅ **Vérifiez la connexion** 24h avant
2. ✅ **Testez tous les comptes** pour vous assurer qu'ils fonctionnent
3. ✅ **Préparez votre scénario** selon le public (technique, commercial, RH)
4. ✅ **Naviguez une fois** pour vous familiariser avec les données
5. ✅ **Préparez des slides** avec les identifiants si vous présentez à plusieurs

### Pendant la Démonstration

1. 🎯 **Commencez par la vue d'ensemble** (Dashboard)
2. 🎯 **Adaptez au public** :
   - Clients/commerciaux → Planning, interventions, facturation
   - Techniciens → Vue mobile, interventions terrain, scanner
   - Direction/RH → Congés, dépenses, utilisateurs, rapports
3. 🎯 **Montrez la mobilité** (responsive design)
4. 🎯 **Insistez sur l'isolation des données** (RLS, sécurité)
5. 🎯 **Démontrez la facilité d'utilisation** (UX intuitive)

### Après la Démonstration

1. 📊 **Recueillez les retours** (fonctionnalités manquantes, suggestions)
2. 🔄 **Réinitialisez les données** si vous avez créé beaucoup de contenu
3. 📝 **Documentez les questions** posées pour améliorer les prochaines démos

## Mode Hors-Ligne (PWA)

L'application fonctionne même sans connexion Internet (Progressive Web App).

**Pour démontrer** :

1. Ouvrez l'application sur mobile
2. Ajoutez-la à l'écran d'accueil
3. Activez le mode Avion
4. Consultez les interventions (cache local)
5. Créez/modifiez une intervention
6. Désactivez le mode Avion
7. Les données se synchronisent automatiquement

## Questions Fréquentes

### Q : Puis-je modifier les données de démo ?

**R** : Oui ! Vous pouvez créer, modifier, supprimer des interventions, clients, etc. C'est même recommandé pour montrer les fonctionnalités. Les données peuvent être réinitialisées à tout moment.

### Q : Les emails sont-ils vraiment envoyés ?

**R** : Non. En mode démo, tous les emails et SMS sont **simulés** et loggés dans la console, mais jamais envoyés réellement. C'est une protection intégrée.

### Q : Combien de temps puis-je garder la session ouverte ?

**R** : La session dure environ 24h. Après, vous devrez vous reconnecter.

### Q : Puis-je faire plusieurs démos en parallèle ?

**R** : Oui, plusieurs personnes peuvent se connecter simultanément avec des comptes différents. Les données sont partagées entre tous les comptes de démo (même organisation).

### Q : Comment réinitialiser les données ?

**R** : Contactez l'administrateur technique qui exécutera les scripts de reset. Le processus prend environ 2 minutes.

### Q : Les données démo sont-elles visibles par mes vrais clients ?

**R** : Non. L'isolation par organisation (RLS) garantit que les données de démo et les données réelles sont complètement séparées. Aucun risque de fuite.

## Réinitialisation des Données

Si vous avez accumulé beaucoup de données de test ou si vous voulez repartir de zéro :

**Option 1 : Demander à l'équipe technique**
Contactez l'admin qui exécutera :
```bash
psql $DATABASE_URL -f sql/reset_demo_data.sql
psql $DATABASE_URL -f sql/seed_demo_data.sql
```

**Option 2 : Auto-service** (si configuré)
- Allez sur `/settings` (compte admin)
- Section "Démo"
- Bouton "Réinitialiser les données de démo"
- Confirmer

⏱️ **Temps** : 1-2 minutes

## Limitations en Mode Démo

Pour des raisons de sécurité et de cohérence, certaines actions sont **simulées** :

- 📧 **Emails** → Loggés mais non envoyés
- 📱 **SMS** → Loggés mais non envoyés
- 💳 **Paiements** → Non disponibles
- 🔗 **Intégrations externes** → Désactivées (APIs tierces)

Ces limitations sont transparentes pour la démo et n'affectent pas l'expérience utilisateur.

## Support

### Problème pendant une démo ?

1. **La bannière ne s'affiche pas** → Videz le cache (Ctrl+Shift+R)
2. **Connexion impossible** → Vérifiez les identifiants (copier-coller)
3. **Données manquantes** → Les données ont peut-être été réinitialisées
4. **Erreur technique** → Notez le message et contactez le support

### Contact Support Technique

- 📧 Email : [support@votre-domaine.fr]
- 📞 Téléphone : [Votre numéro]
- 💬 Slack : #portail-srp-support

## Checklist Pré-Démonstration

Avant chaque présentation, vérifiez :

- [ ] Connexion testée avec `demo-admin@example.com`
- [ ] Bannière orange visible
- [ ] Au moins 5 clients visibles dans `/clients`
- [ ] Au moins 10 interventions dans `/planning`
- [ ] Dashboard affiche des statistiques
- [ ] Identifiants préparés (slide ou papier)
- [ ] Scénario choisi selon le public
- [ ] Backup internet (partage de connexion mobile)

## Ressources Additionnelles

- 📚 [Guide de configuration](./DEMO_SETUP.md) - Installation complète
- 🗺️ [Plan d'implémentation](/root/.claude/plans/imperative-growing-thunder.md) - Détails techniques
- 📖 [README principal](/README.md) - Vue d'ensemble du projet
- 🔧 [Documentation technique](/docs/) - Guides développeurs

---

**Prêt à démontrer ?** 🚀

Connectez-vous avec `demo-admin@example.com` et montrez la puissance du Portail SRP !

_Dernière mise à jour : Mars 2026_
