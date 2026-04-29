# Machine Learning pour l'Auto-Assignation des Interventions

## 🧠 Comment ça Marche ?

### 1. **Collecte des Données Historiques**

On enregistre chaque intervention passée avec :

```javascript
{
  // CARACTÉRISTIQUES (Features)
  intervention_type: "Plomberie",
  urgency_level: 3,           // 1-5
  estimated_duration: 2,       // heures
  postal_code: "75001",
  day_of_week: "Lundi",
  hour_of_day: 14,
  client_type: "Particulier",

  // RÉSULTAT (Label)
  assigned_to: "emp_123",
  success_metrics: {
    completed_on_time: true,
    client_satisfaction: 4.5,  // 1-5
    no_return_visit: true
  }
}
```

### 2. **Extraction des Patterns**

Le ML va découvrir des patterns comme :

```
✅ Jean (emp_123) :
   - Excellent en plomberie urgente (95% succès)
   - Performant dans le 75001-75008
   - Meilleur le matin (8h-12h)
   - Spécialiste particuliers

✅ Marie (emp_456) :
   - Experte électricité (98% succès)
   - Efficace en périphérie (93-95)
   - Après-midi = pic de performance
   - Préfère clients professionnels
```

### 3. **Algorithmes Possibles**

#### **Option A : Régression Logistique** (Simple, rapide)
```
Score(technicien, intervention) =
  w1×compétence + w2×distance + w3×disponibilité + w4×historique
```

#### **Option B : Random Forest** (Plus précis)
- Arbre de décisions multiples
- Chaque arbre vote pour le meilleur technicien
- Consensus final

#### **Option C : Neural Network** (Le plus puissant, mais complexe)
```
Input Layer (features) → Hidden Layers → Output (score par technicien)
```

---

## 💻 Implémentation Concrète

### **Phase 1 : Collecte des Données**

```javascript
// src/utils/mlDataCollector.js

export const recordInterventionOutcome = async (intervention, outcome) => {
  const trainingData = {
    // Features
    features: {
      type: intervention.type,
      urgency: getUrgentCount(intervention),
      duration: intervention.estimated_duration || 2,
      postal: intervention.address?.match(/\d{5}/)?.[0],
      dayOfWeek: new Date(intervention.date).getDay(),
      hour: parseInt(intervention.time?.split(':')[0] || 8),
      clientType: intervention.client_type,
      hasFollowUp: hasSAV(intervention)
    },

    // Labels (résultat)
    outcome: {
      employeeId: intervention.assigned_to[0],
      completedOnTime: outcome.completed_on_time,
      satisfaction: outcome.client_satisfaction,
      duration: outcome.actual_duration,
      noReturnNeeded: !outcome.follow_up_created
    },

    timestamp: new Date().toISOString()
  };

  // Stocker dans IndexedDB ou envoyer au serveur
  await saveTrainingData(trainingData);
};
```

### **Phase 2 : Entraînement du Modèle** (Côté serveur ou browser)

```javascript
// src/ml/assignmentModel.js

import * as tf from '@tensorflow/tfjs'; // TensorFlow.js pour le browser

class AssignmentPredictor {
  constructor() {
    this.model = null;
    this.employees = [];
  }

  async train(historicalData) {
    // 1. Préparer les données
    const X = historicalData.map(d => this.encodeFeatures(d.features));
    const y = historicalData.map(d => this.encodeOutcome(d.outcome));

    // 2. Créer le réseau de neurones
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 20, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 10, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Score 0-1
      ]
    });

    // 3. Compiler
    this.model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    // 4. Entraîner
    await this.model.fit(tf.tensor2d(X), tf.tensor2d(y), {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2
    });

    console.log('✅ Modèle entraîné !');
  }

  encodeFeatures(features) {
    // Convertir en nombres
    return [
      this.typeToNumber(features.type),
      features.urgency / 5,
      features.duration / 8,
      this.postalToRegion(features.postal),
      features.dayOfWeek / 7,
      features.hour / 24,
      features.clientType === 'Professionnel' ? 1 : 0,
      features.hasFollowUp ? 1 : 0,
      // ... autres features
    ];
  }

  async predict(intervention, employees) {
    const predictions = [];

    for (const employee of employees) {
      // Encoder l'intervention + l'employé
      const features = this.encodeFeatures({
        ...intervention,
        employeeId: employee.id
      });

      // Prédire le score de succès
      const score = await this.model.predict(tf.tensor2d([features])).data();

      predictions.push({
        employee,
        mlScore: score[0] * 100, // 0-100
        confidence: this.calculateConfidence(score[0])
      });
    }

    return predictions.sort((a, b) => b.mlScore - a.mlScore);
  }

  calculateConfidence(score) {
    // Si score proche de 0.5 = incertain
    // Si score proche de 0 ou 1 = très confiant
    return Math.abs(score - 0.5) * 2;
  }
}
```

### **Phase 3 : Intégration avec l'Auto-Assignation**

```javascript
// src/utils/autoAssignHelper.js (amélioré)

import { AssignmentPredictor } from '../ml/assignmentModel';

const mlPredictor = new AssignmentPredictor();

export const suggestEmployeeAssignmentML = async (
  intervention,
  employees,
  allInterventions,
  options = {}
) => {
  // 1. Obtenir suggestions basiques (algorithme actuel)
  const basicSuggestions = suggestEmployeeAssignment(
    intervention,
    employees,
    allInterventions,
    options
  );

  // 2. Obtenir prédictions ML
  const mlPredictions = await mlPredictor.predict(intervention, employees);

  // 3. COMBINER les deux approches
  const combinedSuggestions = employees.map(emp => {
    const basic = basicSuggestions.find(s => s.employee.id === emp.id);
    const ml = mlPredictions.find(p => p.employee.id === emp.id);

    // Score hybride : 60% ML + 40% règles métier
    const finalScore = (ml?.mlScore || 0) * 0.6 + (basic?.score || 0) * 0.4;

    return {
      employee: emp,
      score: finalScore,
      mlScore: ml?.mlScore || 0,
      ruleScore: basic?.score || 0,
      confidence: ml?.confidence || 0,
      reasons: [
        ...(basic?.reasons || []),
        ml?.confidence > 0.7
          ? `🤖 ML haute confiance (${(ml.confidence * 100).toFixed(0)}%)`
          : `🤖 ML suggère (${(ml.mlScore).toFixed(0)}%)`
      ],
      warnings: basic?.warnings || []
    };
  });

  return combinedSuggestions
    .filter(s => s.score > 30)
    .sort((a, b) => b.score - a.score);
};
```

---

## 📊 Exemple Concret

### **Situation**
```
Nouvelle intervention :
- Type: Plomberie urgente
- Durée: 3h
- Secteur: 75015
- Jour: Mardi 14h
- Client: Particulier
```

### **Le ML Analyse**
```javascript
Historique trouvé :
- Jean a fait 45 interventions similaires → 89% succès
- Marie a fait 12 interventions similaires → 75% succès
- Paul a fait 3 interventions similaires → 100% succès (peu de données)

Calcul des scores :
┌──────────┬─────────┬────────────┬─────────────┬──────────┐
│ Employé  │ ML      │ Règles     │ Confiance  │ FINAL    │
├──────────┼─────────┼────────────┼─────────────┼──────────┤
│ Jean     │ 92      │ 85         │ 95%        │ 88.2 ⭐  │
│ Marie    │ 68      │ 75         │ 70%        │ 70.8     │
│ Paul     │ 81      │ 90         │ 45%        │ 84.6     │
└──────────┴─────────┴────────────┴─────────────┴──────────┘

Recommandation : Jean
Raison : Historique éprouvé + haute confiance ML
```

---

## 🚀 Avantages du ML

### **Apprentissage Continu**
```
Plus d'interventions → Modèle plus précis → Meilleures suggestions
```

### **Détecte des Patterns Invisibles**
```
Exemple découvert par le ML :
"Marie est 40% plus efficace les mardis après-midi
dans le 15ème arrondissement pour la plomberie"

→ Pattern qu'un humain n'aurait pas remarqué !
```

### **S'adapte aux Changements**
```
Si Jean change de secteur ou Marie monte en compétence,
le modèle s'ajuste automatiquement.
```

---

## ⚠️ Limites et Précautions

### **Besoin de Données**
- Minimum 100-200 interventions pour commencer
- Plus c'est mieux (idéal: 1000+)

### **Pas Magique**
- Le ML complète les règles métier, ne les remplace pas
- Garde toujours le contrôle humain final

### **Biais Potentiels**
```javascript
// ⚠️ Attention !
Si historiquement Jean a toujours eu les interventions faciles,
le ML le surnotera artificiellement.

→ Solution : Normaliser par difficulté d'intervention
```

---

## 🎯 Plan d'Implémentation

### **Phase 1 : Collecte** (2 semaines)
- Tracker les interventions + résultats
- Construire la base de données d'entraînement

### **Phase 2 : Prototype** (1 semaine)
- Modèle simple (régression logistique)
- Tester offline sur données historiques

### **Phase 3 : A/B Testing** (2 semaines)
- 50% suggestions ML / 50% algorithme actuel
- Comparer les résultats

### **Phase 4 : Déploiement** (1 semaine)
- Si ML meilleur → Déployer graduellement
- Monitoring continu

---

## 💡 Alternatives Simples

### **Si pas assez de données pour ML complet**

**Système de "Mémoire"** :
```javascript
// Simplement se souvenir des bonnes combinaisons
const successfulPairings = {
  "plomberie_75015": ["emp_123", "emp_456"],
  "electricite_urgent": ["emp_789"],
  // ...
};

// Suggérer en premier les combinaisons qui ont marché
```

**Scoring Adaptatif** :
```javascript
// Ajuster les poids selon le feedback
let weights = { competence: 40, distance: 30, charge: 30 };

// Si beaucoup de retours SAV sur la distance
weights.distance += 5; // Donner plus d'importance

// Auto-ajustement progressif
```

---

## ❓ Questions ?

Voulez-vous que je :
1. **Implémente un prototype ML** pour l'auto-assignation ?
2. **Commence par la collecte de données** (système de feedback) ?
3. **Fasse d'abord la version "mémoire simple"** ?

Dites-moi ce qui vous intéresse ! 🚀
