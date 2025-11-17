# Planification Multi-Jours pour les Interventions

## Description

Cette fonctionnalité permet de planifier une même intervention sur plusieurs jours différents, par exemple si une intervention n'est pas terminée ou nécessite plusieurs jours de travail espacés.

## Utilisation

### Créer une intervention multi-jours

1. Ouvrez le formulaire de création d'intervention
2. Remplissez les informations habituelles (client, adresse, service, etc.)
3. Sélectionnez une date dans le champ "Date"
4. Dans la section "📅 Planification multi-jours", cliquez sur "Ajouter la date au planning"
5. Répétez les étapes 3-4 pour chaque date souhaitée (ex: le 1er, le 6, le 12)
6. Les dates s'affichent dans la liste avec la possibilité de les retirer
7. Soumettez le formulaire

### Modifier les dates d'une intervention existante (Admin uniquement)

1. Ouvrez les détails de l'intervention
2. Faites défiler vers la section "📅 Planification multi-jours"
3. Pour ajouter une date :
   - Sélectionnez la date dans le champ
   - Cliquez sur "Ajouter"
4. Pour retirer une date :
   - Cliquez sur l'icône ❌ à côté de la date
5. Les modifications sont sauvegardées automatiquement

### Affichage

#### Dans le planning
- L'intervention affiche toutes les dates planifiées dans une section spéciale
- Les dates sont listées de manière condensée (ex: "1 janv., 6 janv., 12 janv.")

#### Dans l'agenda
- L'intervention apparaît sur chaque date planifiée
- Une indication visuelle montre qu'il s'agit d'une intervention multi-jours

## Mise en œuvre technique

### Base de données

Exécutez le script SQL suivant pour ajouter le support multi-jours :

```sql
-- Voir sql/add_multi_day_scheduling.sql
ALTER TABLE interventions
ADD COLUMN IF NOT EXISTS scheduled_dates JSONB;
```

### Structure des données

Le champ `scheduled_dates` est un tableau JSON de dates au format ISO (YYYY-MM-DD) :

```json
{
  "client": "Client Exemple",
  "date": "2025-01-01",
  "scheduled_dates": ["2025-01-01", "2025-01-06", "2025-01-12"]
}
```

### Composants modifiés

1. **InterventionForm.js** - Ajout de la gestion multi-dates lors de la création
2. **InterventionCard.js** - Affichage des dates planifiées
3. **AgendaView.js** - Expansion des interventions multi-jours dans l'agenda
4. **supabase.js** - Support du champ scheduled_dates lors de la création
5. **ScheduledDatesEditor.js** - Nouveau composant pour éditer les dates d'interventions existantes
6. **InterventionDetailView.js** - Intégration de l'éditeur de dates (admin uniquement)
7. **App.js** - Ajout de la fonction handleUpdateScheduledDates

### Rétrocompatibilité

Les interventions existantes sans `scheduled_dates` continuent de fonctionner normalement avec leur date unique.

## Exemples d'utilisation

### Cas 1 : Intervention inachevée
Une intervention planifiée le 1er janvier n'a pas pu être terminée. Vous pouvez ajouter le 3 janvier et le 5 janvier pour finaliser le travail.

### Cas 2 : Travail étalé
Un chantier nécessite des visites les 1er, 6 et 12 du mois. Créez une seule intervention avec ces trois dates.

### Cas 3 : Suivi régulier
Pour un suivi régulier (ex: tous les lundis du mois), ajoutez chaque lundi comme date planifiée.

## Notes importantes

- Les dates sont triées automatiquement par ordre chronologique
- Vous ne pouvez pas ajouter deux fois la même date
- Le champ "Date" principal reste obligatoire (première date d'intervention)
- L'heure est commune à toutes les dates planifiées
