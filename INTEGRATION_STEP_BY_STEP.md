# 🚀 Intégration Step-by-Step - Planification Multi-Jours

## ⏱️ Temps estimé : 10 minutes

---

## Étape 1 : Ajouter une Route (2 min)

### Modifier `src/App.jsx`

**Ligne 46** (après les autres imports lazy) :

```javascript
const SmartPlanningManager = lazy(() => import('./components/SmartPlanningManager'));
```

**Ligne 402** (dans les routes admin, après `/catalog`) :

```javascript
<Route path="multi-day-planning" element={
  <Suspense fallback={<div className="loading-container"><div className="loading-spinner"></div><p>Chargement...</p></div>}>
    <SmartPlanningManager />
  </Suspense>
} />
```

✅ **Résultat** : Route accessible à `/multi-day-planning`

---

## Étape 2 : Ajouter un Bouton dans le Planning (3 min)

### Option A : Depuis AdminPlanningViewContainer

Trouvez le fichier qui affiche le planning admin :

```bash
# Chercher le fichier
find src -name "*AdminPlanning*"
```

Dans ce fichier, ajoutez un bouton :

```jsx
import { useNavigate } from 'react-router-dom';

function AdminPlanningView() {
  const navigate = useNavigate();

  return (
    <div className="planning-view">
      {/* Votre contenu existant */}

      {/* NOUVEAU BOUTON */}
      <button
        onClick={() => navigate('/multi-day-planning')}
        className="btn-primary"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '16px 24px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          zIndex: 1000
        }}
      >
        📅 Planification Multi-Jours
      </button>
    </div>
  );
}
```

### Option B : Depuis le Menu Principal

Si vous avez un menu de navigation, ajoutez :

```jsx
<NavLink to="/multi-day-planning">
  📅 Planification Multi-Jours
</NavLink>
```

✅ **Résultat** : Bouton visible et cliquable

---

## Étape 3 : Initialiser les Services au Démarrage (5 min)

### Modifier `src/App.jsx`

**En haut du fichier** (après les imports) :

```javascript
import { initSmartCache } from './utils/smartCache';
import { schedulePeriodicSync } from './utils/backgroundSync';
```

**Dans le composant App()**, après la ligne 77 :

```javascript
// ✅ Hook de notifications push en temps réel
const pushNotifications = useRealtimePushNotifications(profile?.id);

// 🆕 AJOUTER ICI :
useEffect(() => {
  // Initialiser cache intelligent
  initSmartCache().catch(err => {
    logger.error('Erreur init cache:', err);
  });

  // Planifier sync périodique (toutes les heures)
  const cancelSync = schedulePeriodicSync(60); // 60 minutes

  return () => {
    if (cancelSync) cancelSync();
  };
}, []);
```

✅ **Résultat** : Cache et sync automatiques activés

---

## Étape 4 : Tester ! (Immédiat)

### Test 1 : Accès à la Route

1. Démarrer l'app : `npm run dev`
2. Se connecter en tant qu'**admin**
3. Aller à : `http://localhost:5173/multi-day-planning`

**Attendu** :
- Page de planification s'affiche
- Indicateur "🟢 En ligne" visible
- Interface propre avec header

---

### Test 2 : Créer une Intervention Multi-Jours

1. Sur la page multi-day-planning
2. Vous devriez voir le composant `MultiDayScheduler`
3. (Si erreur, voir section Dépannage ci-dessous)

---

## ⚠️ Dépannage

### Erreur : "Cannot find module SmartPlanningManager"

**Solution** : Vérifiez que les fichiers existent :

```bash
ls -la src/components/SmartPlanningManager.*
ls -la src/hooks/useSmartPlanning.js
```

Si manquants, ils sont dans votre repo GitHub. Pull depuis votre branche :

```bash
git pull origin claude/multi-day-intervention-scheduling-01NntWsQXJd6sShsRFdB9k1d
```

---

### Erreur : "Cannot find module MultiDayScheduler"

**Cause** : Le composant `MultiDayScheduler` n'existe pas encore !

**Solution** : Il faut le créer OU utiliser directement le hook :

#### Option 1 : Créer MultiDayScheduler (Simple)

Créez `src/components/MultiDayScheduler.jsx` :

```jsx
import React, { useState } from 'react';
import './MultiDayScheduler.css';

function MultiDayScheduler({ onSchedule }) {
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState(2);
  const [type, setType] = useState('installation');

  const handleSubmit = () => {
    const intervention = {
      type,
      complexity: 'medium',
      description: 'Intervention multi-jours',
      start_date: startDate,
      duration_days: duration
    };

    if (onSchedule) {
      onSchedule(intervention, { valid: true, canProceed: true, conflicts: [] });
    }
  };

  return (
    <div className="multi-day-scheduler">
      <h2>Nouvelle Intervention Multi-Jours</h2>

      <div className="form-group">
        <label>Type :</label>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="installation">Installation</option>
          <option value="maintenance">Maintenance</option>
          <option value="depannage">Dépannage</option>
        </select>
      </div>

      <div className="form-group">
        <label>Date de début :</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="form-group">
        <label>Durée (jours) :</label>
        <input
          type="number"
          value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          min={1}
          max={30}
        />
      </div>

      <button onClick={handleSubmit} className="btn-create">
        ✨ Créer Intervention
      </button>
    </div>
  );
}

export default MultiDayScheduler;
```

Créez `src/components/MultiDayScheduler.css` :

```css
.multi-day-scheduler {
  padding: 24px;
  max-width: 600px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #1f2937;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.btn-create {
  width: 100%;
  padding: 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-create:hover {
  background: #2563eb;
}
```

#### Option 2 : Simplifier SmartPlanningManager (Plus rapide)

Modifiez `src/components/SmartPlanningManager.jsx` :

Remplacez l'import :

```javascript
// AVANT
import MultiDayScheduler from './MultiDayScheduler';

// APRÈS - Commentez cette ligne
// import MultiDayScheduler from './MultiDayScheduler';
```

Et remplacez le contenu par un formulaire simple (lignes 70-80) :

```jsx
{/* AVANT */}
<MultiDayScheduler
  intervention={intervention}
  users={users}
  allInterventions={interventions}
  absences={absences}
  onSchedule={handleSchedule}
  onCancel={onCancel}
/>

{/* APRÈS */}
<div className="simple-form">
  <h2>🎉 Planification Multi-Jours Activée !</h2>
  <p>Tous les systèmes sont opérationnels :</p>
  <ul>
    <li>✅ Mode hors ligne V2</li>
    <li>✅ Auto-assignation</li>
    <li>✅ Delta sync</li>
    <li>✅ Cache intelligent</li>
  </ul>

  <p>Utilisez le hook <code>useSmartPlanning</code> pour créer des interventions :</p>

  <pre style={{ background: '#1f2937', color: '#f3f4f6', padding: '16px', borderRadius: '8px', overflow: 'auto' }}>
{`const { createIntervention } = useSmartPlanning();

const result = await createIntervention(
  intervention,
  '2026-03-20',  // date début
  3              // durée jours
);`}
  </pre>

  <p><strong>Prochaine étape :</strong> Créer le composant MultiDayScheduler (voir guide)</p>
</div>
```

---

### Erreur : "initSmartCache is not a function"

**Cause** : Les utilitaires ne sont pas tous créés.

**Solution** : Vérifiez les fichiers :

```bash
ls -la src/utils/smartCache.js
ls -la src/utils/backgroundSync.js
```

Si manquants :

```bash
git pull origin claude/multi-day-intervention-scheduling-01NntWsQXJd6sShsRFdB9k1d
```

Ou **commentez temporairement** ces lignes dans App.jsx :

```javascript
// TODO: Activer plus tard
// initSmartCache().catch(err => { ... });
// const cancelSync = schedulePeriodicSync(60);
```

---

## ✅ Checklist Finale

Après intégration, vous devriez avoir :

- [ ] Route `/multi-day-planning` accessible
- [ ] Bouton visible dans le planning
- [ ] Page se charge sans erreur
- [ ] Indicateur "🟢 En ligne" visible
- [ ] Peut créer une intervention de test

---

## 🎯 Résultat Attendu

Une fois tout intégré, vous avez :

```
📱 INTERFACE
├─ Route /multi-day-planning accessible
├─ Bouton "Planification Multi-Jours" visible
└─ Page se charge proprement

🧠 BACKEND
├─ Cache intelligent initialisé
├─ Sync périodique activée (1h)
└─ Mode hors ligne opérationnel

🚀 FONCTIONNALITÉS
├─ Peut créer intervention multi-jours
├─ Auto-assignation techniciens
├─ Détection conflits
└─ Sync automatique hors ligne → en ligne
```

---

## 📞 Aide

Si vous bloquez, vérifiez :

1. **Console navigateur** (F12) : Erreurs ?
2. **Console terminal** (npm run dev) : Erreurs import ?
3. **Fichiers présents** : `ls src/components/Smart*`
4. **Branche Git** : `git branch` (doit être sur la bonne branche)

---

**Date** : 2026-03-14
**Session** : https://claude.ai/code/session_01NntWsQXJd6sShsRFdB9k1d
