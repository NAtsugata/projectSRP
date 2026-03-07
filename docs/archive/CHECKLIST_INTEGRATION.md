# 📋 SYSTÈME DE CHECKLIST PLOMBERIE - GUIDE D'INTÉGRATION

## 🎯 Vue d'ensemble

Ce système permet aux **admins** de créer des templates de checklist et de les assigner aux interventions. Les **employés** remplissent ensuite ces checklists avec photos et notes.

---

## 📂 Fichiers créés

### Pages
- `src/pages/AdminChecklistTemplatesView.js` - Gestion templates (admin)
- `src/pages/ChecklistView.js` - Remplir checklists (employés)

### Composants
- `src/components/intervention/AssignChecklistButton.js` - Bouton pour assigner depuis intervention

### Services
- `src/services/checklistService.js` - API Supabase complète

### Base de données
- `src/database/checklists_tables.sql` - Script SQL (2 tables + 3 templates exemples)

---

## 🔧 ÉTAPES D'INTÉGRATION

### 1️⃣ Créer les tables Supabase

**Exécutez dans Supabase SQL Editor:**
```bash
# Copier le contenu de: src/database/checklists_tables.sql
# Coller dans Supabase SQL Editor
# Cliquer "Run"
```

Ceci va créer:
- ✅ Table `checklist_templates`
- ✅ Table `checklists`
- ✅ Policies RLS
- ✅ 3 templates exemples (Installation chauffe-eau, Réparation fuite, Entretien chaudière)

---

### 2️⃣ Modifier App.js

**Ajouts nécessaires dans `src/App.js`:**

```javascript
// === IMPORTS ===
import checklistService from './services/checklistService';
const ChecklistView = lazy(() => import('./pages/ChecklistView'));
const AdminChecklistTemplatesView = lazy(() => import('./pages/AdminChecklistTemplatesView'));

// === STATES ===
const [checklistTemplates, setChecklistTemplates] = useState([]);
const [checklists, setChecklists] = useState([]);

// === REFRESH DATA ===
// Dans la fonction refreshData(), ajouter:
const [templatesRes, checklistsRes] = await Promise.all([
  checklistService.getAllTemplates(),
  isAdmin ? checklistService.getAllChecklists() : checklistService.getUserChecklists(userId)
]);

if (templatesRes.error) throw templatesRes.error;
setChecklistTemplates(templatesRes.data || []);

if (checklistsRes.error) throw checklistsRes.error;
setChecklists(checklistsRes.data || []);

// === HANDLERS ===
// Templates (Admin)
const handleCreateTemplate = async (templateData) => {
  const { error } = await checklistService.createTemplate(templateData);
  if (error) {
    showToast(`Erreur: ${error.message}`, 'error');
  } else {
    showToast('Template créé !', 'success');
    await refreshData(profile);
  }
};

const handleUpdateTemplate = async (templateData) => {
  const { error } = await checklistService.updateTemplate(templateData);
  if (error) {
    showToast(`Erreur: ${error.message}`, 'error');
  } else {
    showToast('Template mis à jour !', 'success');
    await refreshData(profile);
  }
};

const handleDeleteTemplate = async (templateId) => {
  const { error } = await checklistService.deleteTemplate(templateId);
  if (error) {
    showToast(`Erreur: ${error.message}`, 'error');
  } else {
    showToast('Template supprimé', 'success');
    await refreshData(profile);
  }
};

// Assigner checklist (Admin)
const handleAssignChecklist = async (interventionId, templateId) => {
  const intervention = interventions.find(i => i.id === interventionId);
  if (!intervention || !intervention.assigned_users) {
    showToast('Aucun employé assigné à cette intervention', 'error');
    return;
  }

  const { error } = await checklistService.assignChecklistToIntervention(
    interventionId,
    templateId,
    intervention.assigned_users
  );

  if (error) {
    showToast(`Erreur: ${error.message}`, 'error');
  } else {
    showToast('Checklist assignée !', 'success');
    await refreshData(profile);
  }
};

// Mettre à jour checklist (Employé)
const handleUpdateChecklist = async (checklistData) => {
  const { error } = await checklistService.updateChecklist(checklistData);
  if (error) {
    showToast(`Erreur: ${error.message}`, 'error');
    throw error;
  } else {
    await refreshData(profile);
  }
};

// === NAVIGATION ===
// Ajouter dans navItems (admin):
{ id: 'checklist-templates', label: 'Checklists', icon: <CheckCircleIcon /> }

// Ajouter dans navItems (employé):
{ id: 'checklists', label: 'Checklists', icon: <CheckCircleIcon /> }

// === ROUTES ===
// Route Admin:
<Route path="checklist-templates" element={
  <Suspense fallback={<div>Chargement...</div>}>
    <AdminChecklistTemplatesView
      templates={checklistTemplates}
      onCreateTemplate={handleCreateTemplate}
      onUpdateTemplate={handleUpdateTemplate}
      onDeleteTemplate={handleDeleteTemplate}
    />
  </Suspense>
} />

// Route Employé:
<Route path="checklists" element={
  <Suspense fallback={<div>Chargement...</div>}>
    <ChecklistView
      checklists={checklists}
      templates={checklistTemplates}
      interventions={interventions}
      onUpdateChecklist={handleUpdateChecklist}
      profile={profile}
    />
  </Suspense>
} />
```

---

### 3️⃣ Ajouter bouton dans AdminPlanningView

**Dans `src/pages/AdminPlanningView.js`:**

```javascript
// === IMPORT ===
import AssignChecklistButton from '../components/intervention/AssignChecklistButton';

// === PROPS ===
// Ajouter dans les props du composant:
function AdminPlanningView({
  ...existingProps,
  checklistTemplates, // Nouveau
  onAssignChecklist   // Nouveau
}) {

// === DANS LE RENDER ===
// À côté des boutons Archive/Delete dans la carte intervention:
<AssignChecklistButton
  intervention={intervention}
  templates={checklistTemplates}
  onAssignChecklist={onAssignChecklist}
/>
```

**Puis dans App.js, passer les props:**

```javascript
<AdminPlanningView
  ...existingProps
  checklistTemplates={checklistTemplates}
  onAssignChecklist={handleAssignChecklist}
/>
```

---

## 🎬 WORKFLOW COMPLET

### Admin crée un template:
1. Va dans "Checklists" (nav admin)
2. Clique "Nouveau Template"
3. Nomme le template: "Installation WC"
4. Sélectionne catégorie: "Installation"
5. Ajoute des items:
   - "Vérifier arrivée d'eau" ⚠️ Obligatoire
   - "Installer WC" ⚠️ Obligatoire 📷 Photo requise
   - "Tester chasse d'eau" ⚠️ Obligatoire
   - "Nettoyer zone" (optionnel)
6. Sauvegarde

### Admin assigne à une intervention:
1. Va dans Planning
2. Trouve l'intervention "Installation WC chez M. Dupont"
3. Clique bouton "Checklist" sur la carte
4. Sélectionne template "Installation WC"
5. Clique "Assigner"
6. ✅ Checklist créée automatiquement pour CHAQUE employé assigné

### Employé remplit la checklist:
1. Va dans "Checklists" (nav employé)
2. Voit "Installation WC - M. Dupont" (En cours 0%)
3. Clique dessus
4. Coche chaque item au fur et à mesure
5. Ajoute des photos pour items marqués 📷
6. Ajoute des notes si besoin
7. Sauvegarde régulièrement
8. Quand tout est OK: clique "Terminer"
9. ⚠️ Système vérifie items/photos obligatoires
10. ✅ Checklist verrouillée (completed)

---

## 🎨 Features

### ✅ Templates (Admin)
- Créer des templates réutilisables
- 6 catégories: Installation, Réparation, Entretien, Dépannage, Diagnostic, Mise en service
- Items avec options:
  - ⚠️ Obligatoire (doit être coché)
  - 📷 Photo requise (doit avoir au moins 1 photo)
  - Catégorie libre (ex: "Sécurité")
- Réorganiser items (↑ ↓)
- Modifier/Supprimer templates

### ✅ Assignation (Admin)
- Assigner depuis la carte intervention
- Créé automatiquement pour tous les employés
- Lié à l'intervention

### ✅ Remplissage (Employé)
- Vue liste avec progression %
- Statuts: En cours / Terminée
- Cocher items
- Ajouter photos multiples par item
- Ajouter notes texte par item
- Sauvegarde progression
- Validation finale (vérifie items obligatoires + photos)
- Checklist verrouillée après validation

### ✅ Mobile-ready
- Style cuivré intégré
- Touch-friendly
- Capture photo directe
- Sticky actions bar
- Responsive

---

## 📊 Structure Base de Données

### Table `checklist_templates`
```
id: UUID
name: TEXT (ex: "Installation chauffe-eau")
description: TEXT
category: TEXT (installation|reparation|...)
items: JSONB [{id, text, required, photoRequired, category}]
created_at, updated_at: TIMESTAMP
```

### Table `checklists`
```
id: UUID
intervention_id: UUID → interventions
template_id: UUID → checklist_templates
template_name: TEXT (copie du nom)
user_id: UUID → users (employé assigné)
items_state: JSONB {itemId: {checked, timestamp}}
photos: JSONB {itemId: [{id, url, name, timestamp}]}
notes: JSONB {itemId: "texte note"}
status: TEXT (pending|in_progress|completed)
completed_at: TIMESTAMP
created_at, updated_at: TIMESTAMP
```

---

## 🎯 Templates Exemples Inclus

Le script SQL crée automatiquement 3 templates:

1. **Installation Chauffe-eau** (10 items)
   - Vérifications électriques
   - Raccordements
   - Groupe de sécurité
   - Photos obligatoires
   - Tests

2. **Réparation Fuite** (9 items)
   - Sécurité
   - Diagnostic avec photo
   - Réparation
   - Tests étanchéité
   - Validation

3. **Entretien Chaudière Gaz** (10 items)
   - Contrôles sécurité
   - Nettoyages
   - Mesures CO/CO2
   - Tests
   - Attestation

Vous pouvez modifier/supprimer ces templates depuis l'interface admin.

---

## ✨ C'est prêt!

Une fois les étapes 1-3 faites, le système est 100% fonctionnel!

Les employés verront automatiquement leurs checklists assignées dans leur page. 🚀
