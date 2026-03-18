# 🚀 Quick Start - Calculateur de Primes CEE/MaPrimeRénov'

## ⚡ Utilisation Rapide

### **1. Importer le composant**

```jsx
// Dans n'importe quelle page React
import { SubsidyCalculator } from './components/subsidy';

function MyPage() {
  return <SubsidyCalculator />;
}
```

### **2. Exemple complet avec routing**

```jsx
// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SubsidyCalculator } from './components/subsidy';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/primes" element={<SubsidyCalculator />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### **3. Utiliser les fonctions de calcul directement**

```javascript
import { calculateFullSubsidy } from './utils/subsidyCalculations';

// Données minimales requises
const projectData = {
  building_age: 'more_than_15',
  postal_code: '75012',
  heated_surface: 100,
  application_type: 'low_temp',
  usage: 'heating_and_dhw',
  has_regulator: true,
  regulator_class: 5,
  etas: 135,
  thermal_power: 8,
  starting_intensity: 'mono_45A',
  has_other_heating: false,
  emitter_type: 'radiant',
  has_dhw_system: false,
  replacement_type: 'none',
  project_cost: 10000,
  rfr: 25000,
  household_size: 2,
};

const result = calculateFullSubsidy(projectData);

console.log('Éligible:', result.eligible);
console.log('Zone climatique:', result.climate_zone);
console.log('Prime recommandée:', result.recommended_scenario?.total_after_ceiling);
```

## 📊 Ce que fait le système

### **Formulaire en 7 étapes :**

1. **Identité** : Locataire/Propriétaire, Personne physique/morale
2. **Bâtiment** : Ancienneté, code postal, surface
3. **Type PAC** : Application (basse/moyenne/haute température), usage, régulateur
4. **Performances** : ETAS, puissance, intensité démarrage
5. **Configuration** : Émetteurs, système ECS, autres systèmes
6. **Remplacement** : Type d'ancien chauffage, bonus sortie passoire/BBC
7. **Financier** : Coût projet, revenu fiscal, taille du foyer

### **Résultats affichés :**

- ✅ Validation d'éligibilité technique
- 📊 Tableau comparatif 4 profils (Très modeste, Modeste, Classique, Supérieur)
- 💰 Prime CEE (Certificats Économies Énergie)
- 🏠 MaPrimeRénov' (selon revenus)
- 🎁 Bonus cumulables (remplacement, passoire, BBC)
- ⚖️ Écrêtement appliqué (90%, 75%, 60%, 40%)
- 🎯 Recommandation selon situation client

## 💡 Exemples de Résultats

### **Exemple 1 : Propriétaire modeste à Paris**

**Données :**
- Paris (75012), 100m², bâtiment > 15 ans
- PAC basse température, ETAS 135%
- Chauffage + ECS
- Coût : 10 000 €
- 2 personnes, RFR : 25 000 € → **Catégorie Bleu**

**Prime obtenue : 9 000 €**
- CEE : 4 545 €
- MaPrimeRénov' : 5 000 €
- Total avant écrêtement : 9 545 €
- Écrêtement 90% : max 9 000 €
- **Prime finale : 9 000 €**

---

### **Exemple 2 : Remplacement chaudière fioul à Bordeaux**

**Données :**
- Bordeaux (33000), 120m², bâtiment > 15 ans
- PAC moyenne température, ETAS 115%
- Chauffage seul
- **Remplacement chaudière fioul** (+1200 €)
- Coût : 8 000 €
- 3 personnes, RFR : 40 000 € → **Catégorie Jaune**

**Prime obtenue : 6 000 €**
- CEE : 2 887.5 €
- MaPrimeRénov' base : 4 000 €
- Bonus remplacement fioul : +1 200 €
- Total : 8 087.5 €
- Écrêtement 75% : max 6 000 €
- **Prime finale : 6 000 €**

---

### **Exemple 3 : Revenu élevé à Nice**

**Données :**
- Nice (06000), 100m², bâtiment > 15 ans
- PAC haute température, ETAS 118%
- Chauffage seul
- Coût : 12 000 €
- 4 personnes, RFR : 80 000 € → **Catégorie Rose**

**Prime obtenue : 2 362.5 €**
- CEE : 2 362.5 €
- MaPrimeRénov' : 0 € (pas d'aide Rose)
- **Prime finale : 2 362.5 €**

## 🎨 Personnalisation

### **Modifier les couleurs**

```css
/* src/components/subsidy/SubsidyCalculator.css */

.subsidy-card {
  /* Changer le dégradé de la carte résultat */
  background: linear-gradient(135deg, #your-color-1, #your-color-2);
}

.btn-primary {
  background: #your-brand-color;
}
```

### **Modifier les barèmes**

```javascript
// src/utils/subsidyData.js

export const MPR_RATES = {
  blue: 5500,   // Modifier les montants
  yellow: 4500,
  violet: 3000,
  rose: 0,
};
```

## 📱 Responsive

Le système s'adapte automatiquement :
- **Desktop** : Vue complète avec tableau large
- **Tablette** : Layout optimisé
- **Mobile** : Formulaire en colonne, tableau scrollable

## 🧪 Tests

```bash
# Lancer les tests
npm test subsidyCalculations.test.js
```

## 📚 Documentation Complète

Voir **SUBSIDY_CALCULATOR.md** pour :
- Architecture détaillée
- API de calcul
- Algorithmes complets
- Plafonds de ressources
- Zones climatiques
- Exemples avancés

## 🆘 Support

Problème ? Ouvrez une issue avec :
- Données du formulaire
- Résultat attendu vs obtenu
- Captures d'écran

---

**🎉 Prêt à utiliser !** Le système est 100% fonctionnel.
