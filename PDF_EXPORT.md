# 📄 Export PDF avec Mentions Légales

## Vue d'Ensemble

Système d'export PDF professionnel intégré dans les calculateurs de primes énergétiques avec **mentions légales obligatoires** conformes à la réglementation.

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| 📄 **Export PDF** | Génération PDF via impression navigateur |
| ⚖️ **Mentions légales** | Disclaimer complet et conforme |
| 🎨 **Styles optimisés** | Mise en page A4 professionnelle |
| 📅 **Horodatage** | Date et heure de génération |
| 🔗 **Sources officielles** | Liens vers France Rénov', ANAH |
| 📞 **Contacts** | Numéros et sites officiels |

---

## 🚀 Utilisation

### **Automatique dans les Résultats**

Le bouton **"📄 Exporter PDF"** est automatiquement disponible dans :
- `SubsidyResult` (logements individuels)
- `SubsidyCoproResult` (copropriétés)

```jsx
// Déjà intégré - aucune action nécessaire
<button className="btn btn-primary" onClick={handlePDFExport}>
  📄 Exporter PDF
</button>
```

### **Utilisation Manuelle**

```jsx
import { exportToPDF, preparePDFExport } from './utils/pdfExport';

// Dans votre composant
const handleExport = () => {
  const pdfData = preparePDFExport({
    type: 'individual', // ou 'copro'
    title: 'Mon Estimation',
    data: formData,
  });

  exportToPDF(pdfData.metadata.title, {
    filename: pdfData.filename,
  });
};
```

---

## ⚖️ Mentions Légales Incluses

### **Sections Obligatoires**

1. **📋 Nature du Document**
   - Document indicatif non contractuel
   - Basé sur les barèmes en vigueur
   - Date de génération

2. **⚠️ Avertissements**
   - Vérification obligatoire par organismes officiels
   - Conditions d'éligibilité à valider
   - Évolution possible des barèmes
   - Montants CEE variables

3. **✅ Obligations et Recommandations**
   - Devis RGE obligatoire
   - Dépôt AVANT travaux
   - Accompagnement recommandé/obligatoire
   - Audit énergétique selon cas
   - Cumul des aides et écrêtement

4. **🔗 Sources Officielles**
   - France Rénov' (france-renov.gouv.fr)
   - ANAH (anah.fr)
   - Ministère Transition Écologique
   - Barèmes CEE

5. **📞 Contacts**
   - France Rénov' : 0 808 800 700
   - Espace conseil local
   - Mon Accompagnateur Rénov'

6. **⏰ Validité**
   - Année en cours
   - Révision périodique

7. **🚫 Limitation de Responsabilité**
   - Aucune garantie d'octroi
   - Divergence possible avec montants réels
   - Évolution des conditions

---

## 🎨 Rendu PDF

### **Format**
- **Taille** : A4 (210 × 297 mm)
- **Marges** : 2 cm haut/bas, 1.5 cm gauche/droite
- **Police** : 11pt (texte), 8pt (mentions légales)

### **Structure**

```
┌─────────────────────────────────────┐
│ EN-TÊTE                             │
│ Titre + Sous-titre + Date           │
├─────────────────────────────────────┤
│                                     │
│ RÉSULTATS DÉTAILLÉS                 │
│ - Carte principale                  │
│ - Détails CEE                       │
│ - Détails MaPrimeRénov'             │
│ - Tableau comparatif (si applicable)│
│                                     │
├─────────────────────────────────────┤
│ MENTIONS LÉGALES                    │
│ (Nouvelle page)                     │
│ - Nature du document                │
│ - Avertissements                    │
│ - Obligations                       │
│ - Sources                           │
│ - Contacts                          │
│ - Limitation responsabilité         │
├─────────────────────────────────────┤
│ PIED DE PAGE                        │
│ "Document indicatif non contractuel"│
└─────────────────────────────────────┘
```

### **Optimisations**

- ✅ Gradients remplacés par couleurs solides
- ✅ Liens avec URL affichée
- ✅ Pas de saut de page intempestif
- ✅ Noir & blanc compatible
- ✅ Éléments interactifs masqués

---

## 📐 API Reference

### **exportToPDF(title, options)**

Déclenche l'export PDF.

**Paramètres :**
```javascript
exportToPDF(
  'Estimation Primes Énergétiques', // Titre
  {
    filename: 'estimation-2026-03-18.pdf', // Nom fichier (optionnel)
    beforePrint: () => console.log('Avant impression'), // Callback (optionnel)
    afterPrint: () => console.log('Après impression'), // Callback (optionnel)
  }
)
```

### **preparePDFExport(options)**

Prépare les métadonnées du PDF.

**Paramètres :**
```javascript
const pdfData = preparePDFExport({
  type: 'individual', // ou 'copro'
  title: 'Mon Estimation',
  data: {
    postal_code: '75001',
    housing_count: 20,
    // ...autres données
  }
});

// Retourne :
{
  filename: 'estimation-logement-individuel-75001-2026-03-18.pdf',
  reference: 'EST-INDIVIDUAL-LMNO1234',
  metadata: {
    title: 'Mon Estimation',
    subtitle: 'CEE + MaPrimeRénov\'',
    date: Date,
    reference: 'EST-INDIVIDUAL-LMNO1234',
  }
}
```

### **generateFilename(type, data)**

Génère un nom de fichier intelligent.

**Exemples :**
```javascript
generateFilename('individual', { postal_code: '75001' })
// → "estimation-logement-individuel-75001-2026-03-18.pdf"

generateFilename('copro', { housing_count: 50 })
// → "estimation-copropriete-50logements-2026-03-18.pdf"
```

---

## 🧩 Composant LegalNotices

### **Utilisation**

```jsx
import LegalNotices from './components/subsidy/LegalNotices';

<LegalNotices
  calculationType="individual" // ou "copro"
  generatedDate={new Date()}
/>
```

### **Props**

| Prop | Type | Défaut | Description |
|------|------|--------|-------------|
| `calculationType` | string | 'individual' | Type de calcul |
| `generatedDate` | Date | new Date() | Date de génération |

### **Sections Adaptatives**

Le composant adapte son contenu selon `calculationType` :

**Individual :**
- Mentions générales
- CEE + MaPrimeRénov'
- Accompagnement optionnel

**Copro :**
- Mentions copropriété
- Obligatoire Mon Accompagnateur Rénov'
- Vote assemblée générale requis
- Audit énergétique obligatoire

---

## 🎨 Personnalisation des Styles

### **Styles d'Impression**

Tous les styles sont dans `SubsidyCalculator.css` :

```css
@media print {
  @page {
    size: A4;
    margin: 2cm 1.5cm;
  }

  /* Vos personnalisations */
  .legal-notices {
    font-size: 9pt; /* Exemple */
  }
}
```

### **Ajouter un Logo**

Dans `LegalNotices.jsx` :

```jsx
<div className="legal-header">
  <img src="/logo.png" alt="Logo" style={{ height: '50px' }} />
  <h3>⚖️ Mentions Légales</h3>
</div>
```

### **Modifier le Pied de Page**

Dans `pdfExport.js` :

```javascript
export const generatePDFFooter = (pageNumber = null) => {
  return `
    <div class="pdf-footer">
      <p>Votre entreprise - contact@exemple.fr</p>
      <p>Document généré le ${new Date().toLocaleDateString()}</p>
    </div>
  `;
};
```

---

## 🔧 Compatibilité Navigateurs

| Navigateur | Export PDF | Qualité |
|------------|-----------|---------|
| Chrome | ✅ Excellent | ⭐⭐⭐⭐⭐ |
| Firefox | ✅ Excellent | ⭐⭐⭐⭐⭐ |
| Safari | ✅ Bon | ⭐⭐⭐⭐ |
| Edge | ✅ Excellent | ⭐⭐⭐⭐⭐ |

**Note** : Utilise `window.print()` natif du navigateur.

---

## 💡 Bonnes Pratiques

### **1. Toujours Inclure les Mentions Légales**

```jsx
// ✅ BON
<>
  {renderResults()}
  <LegalNotices calculationType="individual" />
  <div className="actions">
    <button onClick={handlePDFExport}>📄 Exporter PDF</button>
  </div>
</>

// ❌ MAUVAIS - Pas de mentions légales
<>
  {renderResults()}
  <button onClick={handlePDFExport}>📄 Exporter PDF</button>
</>
```

### **2. Nommer les Fichiers Intelligemment**

```javascript
// ✅ BON - Nom descriptif
preparePDFExport({
  type: 'copro',
  data: { housing_count: 20, postal_code: '75001' }
})
// → "estimation-copropriete-20logements-2026-03-18.pdf"

// ❌ MAUVAIS - Nom générique
'estimation.pdf'
```

### **3. Horodater les Estimations**

```jsx
// ✅ BON - Date de génération visible
<LegalNotices generatedDate={new Date()} />

// ❌ MAUVAIS - Pas de date
<LegalNotices />
```

### **4. Tester l'Impression**

Toujours tester avec :
- Chrome "Aperçu avant impression"
- Firefox "Imprimer"
- Safari "Exporter en PDF"

---

## 🚨 Avertissements Légaux

### **Obligatoire selon la Loi**

Les estimations financières de primes énergétiques **doivent** mentionner :

1. ⚖️ **Nature indicative** du document
2. ⚠️ **Obligation de vérification** auprès d'organismes officiels
3. 📅 **Date de validité** des barèmes
4. 🚫 **Limitation de responsabilité** claire

**Non-respect** = Risque juridique en cas de litige avec un client.

### **Notre Conformité**

Le composant `LegalNotices` inclut **toutes** les mentions obligatoires :

- ✅ Disclaimer complet
- ✅ Sources officielles citées
- ✅ Contacts d'organismes agréés
- ✅ Limitation de responsabilité explicite
- ✅ Horodatage du document

---

## 📚 Références Juridiques

- **Code de la consommation** : Art. L111-1 (information précontractuelle)
- **Loi Transition Énergétique** : Cadre MaPrimeRénov'
- **RGPD** : Protection données personnelles (si collecte)

---

## 🔜 Améliorations Futures

- [ ] **Signature électronique** : Signer le PDF
- [ ] **QR Code** : Lien vers dossier en ligne
- [ ] **Multi-langues** : Mentions en anglais/espagnol
- [ ] **Archivage** : Sauvegarde cloud automatique
- [ ] **Comparaison** : Générer PDF comparatif multi-scénarios

---

**Version** : 1.0
**Date** : 2026-03-18
**Conformité** : Barèmes 2026 CEE + MaPrimeRénov'
**Session** : https://claude.ai/code/session_01NntWsQXJd6sShsRFdB9k1d
