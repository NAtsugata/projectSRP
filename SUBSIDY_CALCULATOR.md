# 💰 Calculateur de Primes CEE & MaPrimeRénov'

## 📋 Vue d'Ensemble

Système complet de **calcul de primes énergétiques** pour l'installation de pompes à chaleur (PAC) air/eau, similaire au système CEDEO.

**Primes calculées :**
- ✅ **CEE (Certificats d'Économies d'Énergie)** - Prime Énergie
- ✅ **MaPrimeRénov'** - Aide de l'État
- ✅ **Bonus** - Sortie de passoire, BBC, remplacement chaudière
- ✅ **Écrêtement** - Respect des plafonds légaux

---

## 🎯 Fonctionnalités

| Fonctionnalité | Description | Avantage |
|----------------|-------------|----------|
| 🧮 **Formulaire multi-étapes** | 7 étapes guidées | UX optimale |
| 🎨 **Interface CEDEO-like** | Design professionnel | Familier clients |
| 📊 **4 scénarios** | Très modeste, Modeste, Classique, Supérieur | Comparaison facile |
| 🌍 **Zones climatiques** | H1, H2, H3 automatique | Calcul précis |
| 💶 **Plafonds ressources** | IDF / Autres régions | Conforme 2026 |
| ⚠️ **Éligibilité technique** | Validation ETAS, régulateur, etc. | Évite erreurs |
| 📱 **Responsive** | Mobile, tablette, desktop | Accessibilité |
| 🖨️ **Impression** | Export PDF optimisé | Documentation |

---

## 🚀 Installation & Utilisation

### **1. Import du Composant**

```jsx
import { SubsidyCalculator } from './components/subsidy';
```

### **2. Intégration dans une Page**

```jsx
import React from 'react';
import { SubsidyCalculator } from './components/subsidy';

function SubsidyPage() {
  return (
    <div className="page-container">
      <SubsidyCalculator />
    </div>
  );
}

export default SubsidyPage;
```

### **3. Utilisation Standalone (avec App.js)**

```jsx
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { SubsidyCalculator } from './components/subsidy';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/primes" element={<SubsidyCalculator />} />
      </Routes>
    </Router>
  );
}

export default App;
```

---

## 📐 Architecture

```
src/
├── components/
│   └── subsidy/
│       ├── SubsidyCalculator.jsx    # Formulaire principal
│       ├── SubsidyResult.jsx        # Affichage résultats
│       ├── SubsidyCalculator.css    # Styles
│       └── index.js                 # Exports
├── utils/
│   ├── subsidyData.js               # Barèmes CEE/MPR
│   └── subsidyCalculations.js       # Algorithmes de calcul
```

---

## 🧮 Algorithme de Calcul

### **1. Validation Technique**

Vérifie l'éligibilité selon critères techniques :
- ✅ Bâtiment > 2 ans
- ✅ ETAS ≥ 111% (ou 126% pour basse température)
- ✅ Régulateur classe ≥ IV
- ✅ Puissance, intensité, etc.

### **2. Calcul CEE (Prime Énergie)**

Montant selon **zone climatique** et **usage** :

| Zone | Chauffage seul | Chauffage + ECS |
|------|----------------|-----------------|
| **H1** (Nord) | 3636 € | 4545 € |
| **H2** (Centre) | 3300 € | 4125 € |
| **H3** (Sud) | 2700 € | 3375 € |

*Montants pour profil "Très modeste", divisés par ~1.14 pour "Modeste/Classique"*

### **3. Calcul MaPrimeRénov'**

Montant de base selon **catégorie de revenus** :

| Catégorie | Montant de base |
|-----------|-----------------|
| **Bleu** (Très modeste) | 5000 € |
| **Jaune** (Modeste) | 4000 € |
| **Violet** (Intermédiaire) | 3000 € |
| **Rose** (Supérieur) | 0 € |

**Bonus cumulables :**
- Sortie de passoire (F/G → D) : **+500 €**
- Objectif BBC (A ou B) : **+500 €**
- Remplacement fioul : **+1200 €**
- Remplacement charbon : **+800 €**
- Remplacement gaz : **+400 €**
- Remplacement électrique : **+200 €**

### **4. Écrêtement (Plafonnement)**

Le total CEE + MaPrimeRénov' **ne peut dépasser** :

| Catégorie | Plafond |
|-----------|---------|
| **Bleu** | 90% du coût |
| **Jaune** | 75% du coût |
| **Violet** | 60% du coût |
| **Rose** | 40% du coût |

**Dépense éligible maximum** : 12 000 €

---

## 📊 Exemples Pratiques

### **Exemple 1 : Installation Standard**

**Projet :**
- Propriétaire occupant
- Bâtiment > 15 ans
- Code postal : 75012 (Paris, zone H1)
- Surface : 100 m²
- PAC basse température, ETAS 135%
- Chauffage + ECS
- Coût : 10 000 €
- Foyer : 2 personnes, RFR : 25 000 € (Bleu)

**Résultat :**
- CEE : 4545 €
- MaPrimeRénov' : 5000 €
- **Total avant écrêtement** : 9545 €
- Écrêtement 90% : max 9000 €
- **Prime finale** : **9000 €**

---

### **Exemple 2 : Avec Remplacement Fioul**

**Projet :**
- Propriétaire bailleur
- Remplacement chaudière fioul
- Code postal : 33000 (Bordeaux, zone H2)
- Surface : 120 m²
- PAC moyenne température, ETAS 115%
- Chauffage seul
- Coût : 8 000 €
- Foyer : 3 personnes, RFR : 40 000 € (Jaune)

**Résultat :**
- CEE : 2887.5 €
- MaPrimeRénov' de base : 4000 €
- Bonus remplacement fioul : +1200 €
- **Total MaPrimeRénov'** : 5200 €
- **Total avant écrêtement** : 8087.5 €
- Écrêtement 75% : max 6000 €
- **Prime finale** : **6000 €**

---

### **Exemple 3 : Revenu Élevé**

**Projet :**
- Propriétaire
- Code postal : 06000 (Nice, zone H3)
- PAC haute température, ETAS 118%
- Coût : 12 000 €
- Foyer : 4 personnes, RFR : 80 000 € (Rose)

**Résultat :**
- CEE : 2362.5 €
- MaPrimeRénov' : 0 € (pas d'aide Rose pour PAC seule)
- **Total** : 2362.5 €
- Écrêtement 40% : max 4800 €
- **Prime finale** : **2362.5 €**

---

## 🎓 Utilisation Programmatique

### **Calcul Direct (sans UI)**

```javascript
import { calculateFullSubsidy } from './utils/subsidyCalculations';

const formData = {
  // Identité
  applicant_type: 'owner',
  entity_type: 'individual',

  // Bâtiment
  building_age: 'more_than_15',
  postal_code: '75012',
  heated_surface: 100,

  // PAC
  application_type: 'low_temp',
  usage: 'heating_and_dhw',
  has_regulator: true,
  regulator_class: 5,
  etas: 135,
  thermal_power: 8,
  starting_intensity: 'mono_45A',

  // Configuration
  has_other_heating: false,
  emitter_type: 'radiant',
  has_dhw_system: false,

  // Contexte
  replacement_type: 'fuel',
  has_exit_sieve: false,
  has_bbc_target: false,

  // Financier
  project_cost: 10000,
  rfr: 25000,
  household_size: 2,
};

const result = calculateFullSubsidy(formData);

console.log(result);
// {
//   eligible: true,
//   reasons: ['✅ Critères techniques respectés'],
//   climate_zone: 'H1',
//   scenarios: [...],
//   recommended_scenario: {...},
//   project_cost: 10000
// }
```

### **Vérification d'Éligibilité**

```javascript
import { validateTechnicalEligibility } from './utils/subsidyCalculations';

const pacSpecs = {
  application_type: 'low_temp',
  etas: 135,
  regulator_class: 5,
  has_regulator: true,
  building_age: 'more_than_15',
};

const eligibility = validateTechnicalEligibility(pacSpecs);

console.log(eligibility);
// {
//   eligible: true,
//   reasons: ['✅ Critères techniques respectés']
// }
```

### **Calcul pour un Profil Spécifique**

```javascript
import { calculateForProfile } from './utils/subsidyCalculations';

const result = calculateForProfile(formData, 'modest');
// Calcule uniquement pour le profil "Modeste"
```

---

## 📋 Données de Référence

### **Plafonds de Ressources 2026**

**Île-de-France :**

| Personnes | Bleu | Jaune | Violet | Rose |
|-----------|------|-------|--------|------|
| 1 | ≤ 23 541 € | ≤ 28 657 € | ≤ 40 018 € | > 40 018 € |
| 2 | ≤ 34 551 € | ≤ 42 058 € | ≤ 58 827 € | > 58 827 € |
| 3 | ≤ 41 493 € | ≤ 50 513 € | ≤ 70 382 € | > 70 382 € |
| 4 | ≤ 48 447 € | ≤ 58 981 € | ≤ 82 839 € | > 82 839 € |
| 5+ | ≤ 55 427 € | ≤ 67 473 € | ≤ 94 844 € | > 94 844 € |

**Autres régions :**

| Personnes | Bleu | Jaune | Violet | Rose |
|-----------|------|-------|--------|------|
| 1 | ≤ 17 009 € | ≤ 21 805 € | ≤ 30 549 € | > 30 549 € |
| 2 | ≤ 24 875 € | ≤ 31 889 € | ≤ 44 907 € | > 44 907 € |
| 3 | ≤ 29 917 € | ≤ 38 349 € | ≤ 54 071 € | > 54 071 € |
| 4 | ≤ 34 948 € | ≤ 44 802 € | ≤ 63 235 € | > 63 235 € |
| 5+ | ≤ 40 002 € | ≤ 51 281 € | ≤ 72 400 € | > 72 400 € |

### **Zones Climatiques**

| Zone | Régions | Départements (exemples) |
|------|---------|-------------------------|
| **H1** | Nord, Est, montagnes | 02, 08, 54, 57, 59, 62, 67, 68, 88, 90 |
| **H2** | Centre, Ouest | 16, 17, 18, 21, 22, 28, 29, 35, 36, 37, ... |
| **H3** | Sud, Méditerranée | 04, 05, 06, 11, 13, 30, 34, 66, 83, 84, 2A, 2B |

---

## 🔧 Personnalisation

### **Modifier les Barèmes**

Éditer `src/utils/subsidyData.js` :

```javascript
export const MPR_RATES = {
  blue: 5500,   // Au lieu de 5000
  yellow: 4500, // Au lieu de 4000
  // ...
};
```

### **Ajouter un Bonus**

```javascript
export const MPR_BONUSES = {
  // Existants...
  exit_energy_sieve: {...},
  bbc: {...},

  // Nouveau bonus
  solar_panels: {
    blue: 1000,
    yellow: 800,
    violet: 500,
    rose: 0,
  }
};
```

### **Personnaliser le Style**

Éditer `src/components/subsidy/SubsidyCalculator.css` :

```css
.subsidy-card {
  /* Changer le dégradé */
  background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
}
```

---

## 📱 Responsive Design

Le formulaire s'adapte automatiquement :
- **Desktop** (>768px) : Formulaire large, tableau complet
- **Tablette** (768px) : Layout optimisé
- **Mobile** (<768px) : Formulaire en colonne, tableau scrollable

---

## 🖨️ Impression

Mode impression optimisé :
- Masquage des boutons de navigation
- Conservation des tableaux et résultats
- Format A4 adapté

**Utilisation :**
```javascript
window.print(); // Déclenché par le bouton "Imprimer"
```

---

## ⚠️ Limitations & Notes

### **Limitations Actuelles**

1. **Géolocalisation** : Zone climatique basée sur code postal (approximation)
2. **Certifications** : Pas de vérification NF PAC/Eurovent
3. **Accompagnateur Rénov'** : Bonus non encore implémenté
4. **Copropriété** : Barèmes spécifiques non inclus

### **Conformité Légale**

✅ Barèmes 2026 (valides jusqu'au 31/12/2026)
✅ Plafonds de ressources officiels
✅ Zones climatiques RT 2012
✅ Écrêtement selon réglementation

⚠️ **Important** : Ce calculateur est indicatif. Les montants réels dépendent de l'instruction du dossier par France Rénov' et les organismes CEE.

---

## 🚀 Évolutions Futures

- [ ] **API gouvernementale** : Connexion à l'API France Rénov'
- [ ] **Géolocalisation précise** : GPS pour zone climatique exacte
- [ ] **Base de données PAC** : Catalogue avec ETAS préenregistrés
- [ ] **Simulation audit énergétique** : DPE avant/après
- [ ] **Export PDF** : Génération document professionnel
- [ ] **Historique** : Sauvegarde des simulations
- [ ] **Comparateur installateurs** : Devis multiples

---

## 📚 Références

- **MaPrimeRénov'** : [maprimerenov.gouv.fr](https://www.maprimerenov.gouv.fr)
- **CEE** : [ecologie.gouv.fr](https://www.ecologie.gouv.fr/dispositif-des-certificats-deconomies-denergie)
- **France Rénov'** : [france-renov.gouv.fr](https://france-renov.gouv.fr)
- **ADEME** : [ademe.fr](https://www.ademe.fr)

---

**Version** : 1.0
**Date** : 2026-03-18
**Auteur** : Claude Code Agent
**Session** : https://claude.ai/code/session_01NntWsQXJd6sShsRFdB9k1d
