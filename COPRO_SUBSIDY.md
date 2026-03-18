# 🏢 Calculateur MaPrimeRénov' Copropriété

## 📋 Vue d'Ensemble

Module complet pour calculer les aides **MaPrimeRénov' Copropriété** pour travaux de rénovation énergétique sur parties communes.

**Différence clé avec logements individuels** : Pas de condition de revenus pour l'aide de base !

---

## ✨ Fonctionnalités

| Fonctionnalité | Description | Montant |
|----------------|-------------|---------|
| 🏢 **Aide de base** | 25% des travaux | Max 25 000€/logement |
| 🎁 **Bonus collectifs** | Sortie passoire, BBC, fragile | +10% à +40% |
| 👥 **Aides individuelles** | Par copropriétaire selon revenus | 3000€ Bleu, 1500€ Jaune |
| 🤝 **Accompagnement** | Mon Accompagnateur Rénov' | 100% pris en charge |
| ⚡ **CEE** | Certificats Économies Énergie | Selon travaux |

---

## 🚀 Utilisation

### **Import du Sélecteur de Mode**

```jsx
import { SubsidyModeSelector } from './components/subsidy';

function App() {
  return <SubsidyModeSelector />;
}
```

Le sélecteur permet de choisir entre **Logement Individuel** et **Copropriété**.

### **Import Direct du Calculateur Copropriété**

```jsx
import { SubsidyCoproCalculator } from './components/subsidy';

function CoproPage() {
  return <SubsidyCoproCalculator />;
}
```

---

## 📐 Règles de Calcul

### **1. Aide de Base (25%)**

```javascript
Aide de base = Coût total × 25%
Plafonnée à : 25 000 € × Nombre de logements
```

**Exemple :**
- Travaux : 500 000 €
- 20 logements
- Aide de base = 125 000 € (plafonné à 500 000 € max)

### **2. Bonus Collectifs Cumulables**

| Bonus | Condition | Taux | Plafond/logement |
|-------|-----------|------|------------------|
| **Sortie passoire** | F/G → E min | +10% | 10 000 € |
| **BBC** | Atteindre A ou B | +10% | 10 000 € |
| **Sortie passoire + BBC** | F/G → A/B | +20% | 10 000 € |
| **Copropriété fragile** | Difficulté financière | +20% | 3 000 € |

**Note** : Sortie passoire + BBC donne directement +20% (pas 10%+10%)

### **3. Aides Individuelles**

Par copropriétaire selon catégorie de revenus :

| Catégorie | Montant/logement |
|-----------|------------------|
| **Bleu** (Très modeste) | 3 000 € |
| **Jaune** (Modeste) | 1 500 € |
| **Violet** (Intermédiaire) | 0 € |
| **Rose** (Supérieur) | 0 € |

### **4. Accompagnement**

Obligatoire et pris en charge à 100% :
- **≤ 50 logements** : 600 € HT / logement
- **> 50 logements** : 420 € HT / logement

---

## 💡 Exemples Pratiques

### **Exemple 1 : Copropriété Mixte Standard**

**Données :**
- 20 logements, bâtiment 25 ans
- Travaux : 500 000 €
- Gain énergétique : 40%
- Pas de sortie passoire, pas de BBC
- Pas fragile
- Répartition : 30% Bleu, 40% Jaune, 20% Violet, 10% Rose

**Calcul :**
```
Aide de base (25%) : 125 000 €
Bonus collectifs : 0 €
Total collectif : 125 000 €

Aides individuelles :
  - 6 logements Bleu × 3000 = 18 000 €
  - 8 logements Jaune × 1500 = 12 000 €
  - 4 logements Violet × 0 = 0 €
  - 2 logements Rose × 0 = 0 €
Total individuel : 30 000 €

CEE estimé : 60 000 €

TOTAL : 215 000 €
Soit 10 750 €/logement

Reste à charge : 285 000 € (14 250 €/logement)
```

---

### **Exemple 2 : Sortie de Passoire Énergétique**

**Données :**
- 50 logements, bâtiment 30 ans
- Travaux : 1 200 000 €
- Gain énergétique : 50%
- **Sortie passoire F → D**
- Pas de BBC
- Copropriété sociale : 60% Bleu, 30% Jaune

**Calcul :**
```
Aide de base (25%) : 300 000 €
Bonus sortie passoire (+10%) : 120 000 €
Total collectif : 420 000 €

Aides individuelles :
  - 30 logements Bleu × 3000 = 90 000 €
  - 15 logements Jaune × 1500 = 22 500 €
  - 5 logements Violet/Rose = 0 €
Total individuel : 112 500 €

CEE estimé : 150 000 €

TOTAL : 682 500 €
Soit 13 650 €/logement (56.9% des travaux)

Reste à charge : 517 500 € (10 350 €/logement)
```

---

### **Exemple 3 : Rénovation BBC avec Copro Fragile**

**Données :**
- 30 logements, bâtiment 40 ans
- Travaux : 900 000 €
- Gain énergétique : 60%
- **Sortie passoire G → A (BBC)**
- **Copropriété fragile**

**Calcul :**
```
Aide de base (25%) : 225 000 €
Bonus sortie passoire + BBC (+20%) : 180 000 €
  (plafonné à 10k€/logement = 300k€, OK)
Bonus copro fragile (+20%) : 90 000 €
  (plafonné à 3k€/logement = 90k€, OK)
Total collectif : 495 000 €

Aides individuelles : 90 000 € (estimation)
CEE estimé : 90 000 €

TOTAL : 675 000 €
Soit 22 500 €/logement (75% des travaux !)

Reste à charge : 225 000 € (7 500 €/logement)
```

---

## 🧮 Calcul Programmatique

```javascript
import { calculateFullCoproSubsidy } from './utils/subsidyCoproCalculations';

const coproData = {
  // Copropriété
  building_age: 25,
  postal_code: '75012',
  housing_count: 20,
  principal_residence_rate: 0.80, // 80%

  // Travaux
  total_cost: 500000,
  energy_gain: 40, // %
  work_categories: ['insulation', 'heating'],

  // Bonus
  has_exit_sieve: false,
  has_bbc_target: false,
  is_fragile: false,

  // Accompagnement
  has_accompaniment: true,

  // Distribution copropriétaires (optionnel)
  distribution: {
    blue: 0.30,
    yellow: 0.40,
    violet: 0.20,
    rose: 0.10,
  },
};

const result = calculateFullCoproSubsidy(coproData);

console.log('Total aide collective:', result.total_collective);
console.log('Total avec individuelles:', result.total_with_individual);
console.log('Total avec CEE:', result.total_with_cee);
console.log('Par logement:', result.per_housing.with_cee);
console.log('Reste à charge:', result.remaining_cost);
```

---

## ✅ Conditions d'Éligibilité

| Critère | Minimum Requis |
|---------|----------------|
| **Âge du bâtiment** | 15 ans |
| **Résidences principales** | 75% minimum |
| **Gain énergétique** | 35% minimum |
| **Accompagnement** | Obligatoire (Mon Accompagnateur Rénov') |
| **Audit énergétique** | Obligatoire avant travaux |

---

## 📊 Tableau Comparatif Individuel vs Copropriété

| Critère | Logement Individuel | Copropriété |
|---------|-------------------|-------------|
| **Aide de base** | 0-5000€ selon revenus | 25% travaux (max 25k€/log) |
| **Condition revenus** | ✅ Pour montant | ❌ Pour aide de base |
| **Âge bâtiment** | > 2 ans | > 15 ans |
| **Gain énergétique** | Aucun minimum | 35% minimum |
| **Accompagnement** | Optionnel | Obligatoire |
| **Type travaux** | Logement individuel | Parties communes |
| **Aides individuelles** | Non | Oui (3k€ Bleu, 1.5k€ Jaune) |

---

## 🎓 Bonnes Pratiques

### **1. Choisir le Bon Profil de Distribution**

Le système propose 4 profils prédéfinis :
- **Mixte** : 30% Bleu, 40% Jaune, 20% Violet, 10% Rose
- **Sociale** : 60% Bleu, 30% Jaune, 10% Violet
- **Standard** : 20% Bleu, 30% Jaune, 30% Violet, 20% Rose
- **Aisée** : 10% Jaune, 30% Violet, 60% Rose

Choisir le profil proche de votre copropriété pour estimer les aides individuelles.

### **2. Maximiser les Bonus**

Pour obtenir le maximum d'aides :
1. Viser la **sortie de passoire + BBC** (+20% au lieu de +10%+10%)
2. Si copropriété en difficulté, demander le statut **copro fragile** (+20% supplémentaires)
3. Prévoir **accompagnement** (obligatoire et gratuit)

### **3. Planifier les Travaux**

L'aide couvre **maximum 25 000 €/logement** en collectif.
- Copro 20 logements → Max 500 000 € d'aide
- Copro 50 logements → Max 1 250 000 € d'aide

Si travaux > plafond, reste à charge augmente.

---

## 🔧 API Reference

### **calculateFullCoproSubsidy(formData)**

Calcule le récapitulatif complet.

**Paramètres :**
```javascript
{
  building_age: number,           // Âge en années
  postal_code: string,            // Code postal
  housing_count: number,          // Nombre de logements
  principal_residence_rate: number, // 0-1 (ex: 0.75 = 75%)
  total_cost: number,             // Coût total travaux HT
  energy_gain: number,            // % gain énergétique
  work_categories: string[],      // Types de travaux
  has_exit_sieve: boolean,        // Sortie passoire
  has_bbc_target: boolean,        // Objectif BBC
  is_fragile: boolean,            // Copro fragile
  has_accompaniment: boolean,     // Accompagnement
  distribution: {                 // Optionnel
    blue: number,    // 0-1
    yellow: number,
    violet: number,
    rose: number,
  }
}
```

**Retour :**
```javascript
{
  eligible: boolean,
  reasons: string[],
  base_help: {...},
  collective_bonuses: {...},
  accompaniment: {...},
  individual_bonuses: {...},
  cee: {...},
  total_collective: number,
  total_with_individual: number,
  total_with_cee: number,
  per_housing: {...},
  remaining_cost: number,
}
```

---

## 🚀 Prochaines Améliorations

- [ ] **CEE détaillés** : Calcul précis selon type de travaux
- [ ] **Audit énergétique** : Intégration DPE avant/après
- [ ] **Planning financier** : Échelonnement paiements
- [ ] **Export PDF** : Dossier complet pour assemblée générale
- [ ] **Comparaison scénarios** : Plusieurs options de travaux
- [ ] **Historique** : Sauvegarde simulations

---

## 📚 Références

- **MaPrimeRénov' Copropriété** : [france-renov.gouv.fr/coproprietes](https://france-renov.gouv.fr)
- **ANAH** : [anah.fr](https://www.anah.fr)
- **Mon Accompagnateur Rénov'** : Liste des accompagnateurs agréés

---

**Version** : 1.0
**Date** : 2026-03-18
**Auteur** : Claude Code Agent
**Session** : https://claude.ai/code/session_01NntWsQXJd6sShsRFdB9k1d
