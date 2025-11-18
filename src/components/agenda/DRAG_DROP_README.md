# Drag & Drop pour l'Agenda - Guide d'utilisation

## Vue d'ensemble

Le système de glisser-déposer (drag & drop) permet de réorganiser facilement les interventions dans l'agenda en les déplaçant avec la souris.

## Fonctionnalités

### ✅ Ce qui est déjà implémenté

1. **Glisser une intervention**
   - Cliquez et maintenez sur une carte d'intervention
   - Déplacez-la vers un nouvel emplacement
   - Relâchez pour déposer

2. **Validation automatique**
   - Détection des conflits d'horaires
   - Vérification de la charge de travail
   - Indicateur visuel (vert = OK, rouge = conflit)

3. **Feedback visuel**
   - Carte en transparence pendant le drag
   - Zone de drop avec bordure en pointillés
   - Icône et message de confirmation/erreur

4. **Sécurité**
   - Impossible de déposer sur le même emplacement
   - Validation côté client avant l'envoi

### ⚠️ Ce qui reste à faire

**Connexion à la base de données Supabase** : Actuellement, le drag & drop détecte et valide les déplacements mais ne les enregistre PAS dans la base de données.

## Intégration avec Supabase

Pour connecter le drag & drop à votre base de données, suivez ces étapes :

### 1. Modifier `src/pages/AgendaView.js`

Trouvez la fonction `handleInterventionMove` (ligne ~153) et remplacez-la par :

```javascript
const handleInterventionMove = useCallback(async (moveData) => {
  try {
    logger.log('AgendaView: Déplacement d\'intervention...', {
      interventionId: moveData.intervention.id,
      from: { date: moveData.intervention.date, time: moveData.intervention.time },
      to: { date: moveData.targetDate, time: moveData.targetTime }
    });

    // Mettre à jour dans Supabase
    const { error } = await supabase
      .from('interventions')
      .update({
        date: moveData.targetDate,
        time: moveData.targetTime,
        employee_id: moveData.targetEmployeeId
      })
      .eq('id', moveData.intervention.id);

    if (error) throw error;

    // Optionnel : Afficher une notification de succès
    toast.success('Intervention déplacée avec succès');

    // Recharger les données
    await onRefreshInterventions(); // À implémenter selon votre logique
  } catch (error) {
    console.error('Erreur lors du déplacement:', error);
    toast.error('Impossible de déplacer l\'intervention');
  }
}, []);
```

### 2. Mettre à jour les assignments

Si votre intervention utilise une table `intervention_assignments` pour les employés :

```javascript
// Supprimer les anciens assignments
await supabase
  .from('intervention_assignments')
  .delete()
  .eq('intervention_id', moveData.intervention.id);

// Créer le nouvel assignment
if (moveData.targetEmployeeId) {
  await supabase
    .from('intervention_assignments')
    .insert({
      intervention_id: moveData.intervention.id,
      user_id: moveData.targetEmployeeId
    });
}
```

### 3. Gestion des interventions multi-jours

Pour les interventions avec `scheduled_dates` :

```javascript
// Mettre à jour le tableau des dates planifiées
const newScheduledDates = [
  ...moveData.intervention.scheduled_dates.filter(d => d !== moveData.intervention.date),
  moveData.targetDate
];

await supabase
  .from('interventions')
  .update({ scheduled_dates: newScheduledDates })
  .eq('id', moveData.intervention.id);
```

## Personnalisation

### Désactiver le drag & drop

Dans `AgendaView.js` :

```javascript
<AgendaDay
  ...
  enableDragDrop={false}  // Désactive le drag & drop
/>
```

### Modifier les validations

Éditez `src/utils/agendaHelpers.js` > `validateInterventionMove` :

```javascript
export const validateInterventionMove = ({
  intervention,
  targetDate,
  targetTime,
  targetEmployeeId,
  allInterventions,
  employees
}) => {
  // Ajoutez vos règles de validation personnalisées ici

  // Exemple : Bloquer les déplacements dans le passé
  if (new Date(targetDate) < new Date()) {
    return {
      valid: false,
      reason: 'Impossible de planifier dans le passé'
    };
  }

  // ... reste du code
};
```

## Structure des composants

```
src/components/agenda/
├── DraggableIntervention.js    # Wrapper pour rendre une intervention draggable
├── DraggableIntervention.css   # Styles pour le drag
├── DroppableTimeSlot.js         # Zone de drop
├── DroppableTimeSlot.css        # Styles pour le drop
└── AgendaDay.js                 # Composant principal (intégré)

src/utils/
└── agendaHelpers.js             # Fonctions de validation et helpers
```

## API des composants

### DraggableIntervention

```javascript
<DraggableIntervention
  intervention={intervention}      // Objet intervention
  onDragStart={(itv) => {}}       // Callback au début du drag
  onDragEnd={(itv) => {}}         // Callback à la fin du drag
  disabled={false}                 // Désactiver le drag
>
  {children}
</DraggableIntervention>
```

### DroppableTimeSlot

```javascript
<DroppableTimeSlot
  date="2025-01-15"                       // Date cible
  time="08:00"                             // Heure cible
  employeeId="user-123"                    // ID employé cible
  onDrop={(dropInfo) => {}}               // Callback au drop
  onValidateDrop={(dropInfo) => true}    // Validation avant drop
  disabled={false}                         // Désactiver le drop
>
  {children}
</DroppableTimeSlot>
```

## Debugging

Pour voir les logs de drag & drop, ouvrez la console du navigateur (F12) :

```javascript
// Dans la console, vous verrez :
AgendaView: Intervention drag & drop {
  interventionId: "123",
  from: { date: "2025-01-15", time: "08:00" },
  to: { date: "2025-01-16", time: "10:00", employeeId: "user-456" }
}
```

## Support mobile

Le drag & drop utilise l'API HTML5 native qui peut avoir un support limité sur mobile. Pour une meilleure expérience mobile, envisagez d'ajouter :

- Touch events polyfill
- Gestes tactiles alternatifs (tap + sélection)
- Mode d'édition dédié mobile

## Questions fréquentes

**Q : Le drag & drop ne fonctionne pas, pourquoi ?**
R : Vérifiez que `enableDragDrop={true}` et que `onInterventionMove` est défini.

**Q : Comment changer les couleurs des indicateurs ?**
R : Modifiez `DroppableTimeSlot.css` > `.drop-indicator`

**Q : Peut-on drag & drop entre différents jours ?**
R : Oui, mais actuellement limité à la vue courante. Pour drag entre semaines/mois, il faut étendre la logique.

**Q : Comment ajouter des permissions (ex: admin seulement) ?**
R : Passez une prop `canEdit={userRole === 'admin'}` à AgendaDay et utilisez-la pour `disabled={!canEdit}`.

## Roadmap

- [ ] Support mobile tactile amélioré
- [ ] Drag & drop entre ResourceView
- [ ] Animation de confirmation après drop réussi
- [ ] Undo/Redo du drag & drop
- [ ] Batch drag (déplacer plusieurs interventions à la fois)

---

**Dernière mise à jour** : Phase 2 - Drag & Drop
**Version** : 1.0.0
