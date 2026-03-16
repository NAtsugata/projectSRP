# 🎨 Guide du Système de Thèmes

Le système de thèmes permet de basculer entre un **thème clair** et un **thème sombre** harmonisés avec la charte graphique cuivre/noir.

---

## ✅ Installation Terminée

Le système de thèmes est déjà installé et configuré ! Voici ce qui a été créé :

### **Fichiers Installés**

```
✅ src/styles/design-system.css          # Variables CSS + thème dark
✅ src/hooks/useTheme.js                 # Hook React pour gérer le thème
✅ src/components/ThemeToggle.jsx        # Bouton de toggle
✅ src/components/ThemeToggle.css        # Styles du toggle
```

### **Composants de Signature Mis à Jour**

```
✅ src/components/signatures/ElectronicSignaturePad.css  # Utilise les variables
✅ src/components/signatures/SignatureViewer.css         # Utilise les variables
```

---

## 🚀 Utilisation Rapide

### **1. Ajouter le Toggle de Thème**

```jsx
import ThemeToggle from './components/ThemeToggle';

function MyApp() {
  return (
    <div>
      <header>
        <ThemeToggle />  {/* Bouton simple */}
      </header>
      {/* Reste de l'app */}
    </div>
  );
}
```

### **2. Utiliser le Hook**

```jsx
import useTheme from './hooks/useTheme';

function MyComponent() {
  const { isDark, isLight, toggleTheme, setDarkMode, setLightMode } = useTheme();

  return (
    <div>
      <p>Thème actuel : {isDark ? 'Sombre' : 'Clair'}</p>
      <button onClick={toggleTheme}>Basculer</button>
      <button onClick={setDarkMode}>Mode Sombre</button>
      <button onClick={setLightMode}>Mode Clair</button>
    </div>
  );
}
```

### **3. Menu Déroulant (Light / Dark / Auto)**

```jsx
import { ThemeToggleMenu } from './components/ThemeToggle';

function Header() {
  return (
    <header>
      <ThemeToggleMenu />
    </header>
  );
}
```

---

## 🎨 Palette de Couleurs

### **Thème Clair (par défaut)**

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg-primary` | `#ffffff` | Fond principal (cartes, modals) |
| `--bg-secondary` | `#f9fafb` | Fond secondaire |
| `--bg-app` | `#f5f5f7` | Fond de l'application |
| `--text-primary` | `#111827` | Texte principal |
| `--text-secondary` | `#4b5563` | Texte secondaire |
| `--color-primary` | `#b87333` | Cuivre (boutons, liens) |
| `--border-color` | `#e5e7eb` | Bordures |

### **Thème Sombre**

| Variable | Valeur | Usage |
|----------|--------|-------|
| `--bg-primary` | `#0f1419` | Noir profond |
| `--bg-secondary` | `#1a1f26` | Gris très sombre |
| `--bg-app` | `#0a0d11` | Noir intense |
| `--text-primary` | `#e5e7eb` | Blanc cassé |
| `--text-secondary` | `#9ca3af` | Gris clair |
| `--color-primary` | `#d4a574` | Cuivre lumineux |
| `--border-color` | `#2d3139` | Gris sombre |

---

## 📦 Variables CSS Disponibles

### **Couleurs**

```css
/* Couleurs primaires */
--color-primary
--color-copper
--color-copper-light
--color-copper-dark

/* Backgrounds */
--bg-primary
--bg-secondary
--bg-tertiary
--bg-app

/* Texte */
--text-primary
--text-secondary
--text-tertiary
--text-muted
--text-inverse

/* Bordures */
--border-color
--border-color-light
--border-color-dark

/* Semantic */
--color-success, --color-warning, --color-danger
```

### **Spacing**

```css
--spacing-xs    /* 4px */
--spacing-sm    /* 8px */
--spacing-md    /* 16px */
--spacing-lg    /* 24px */
--spacing-xl    /* 32px */
--spacing-2xl   /* 48px */
--spacing-3xl   /* 64px */
```

### **Border Radius**

```css
--radius-sm     /* 6px */
--radius-md     /* 8px */
--radius-lg     /* 12px */
--radius-xl     /* 16px */
--radius-2xl    /* 24px */
--radius-full   /* 9999px - cercle */
```

### **Shadows**

```css
--shadow-xs
--shadow-sm
--shadow-md
--shadow-lg
--shadow-xl
--shadow-2xl
--shadow-inner
```

### **Transitions**

```css
--transition-fast    /* 150ms */
--transition-base    /* 200ms */
--transition-slow    /* 300ms */
--transition-slower  /* 500ms */
```

### **Typography**

```css
/* Tailles */
--text-xs, --text-sm, --text-base, --text-lg, --text-xl, --text-2xl, etc.

/* Poids */
--font-light, --font-normal, --font-medium, --font-semibold, --font-bold

/* Line heights */
--leading-none, --leading-tight, --leading-normal, --leading-relaxed
```

---

## 🔧 Hook `useTheme`

### **API Complète**

```jsx
const {
  // État
  theme,           // 'light', 'dark', ou 'auto'
  effectiveTheme,  // 'light' ou 'dark' (résolu)
  isDark,          // boolean - true si dark
  isLight,         // boolean - true si light
  isAuto,          // boolean - true si auto

  // Actions
  toggleTheme,     // () => void - Basculer light ↔ dark
  setDarkMode,     // () => void - Forcer dark
  setLightMode,    // () => void - Forcer light
  setAutoMode,     // () => void - Mode auto (système)
  setTheme,        // (theme) => void - Définir un thème

  // Constantes
  THEMES,          // { LIGHT, DARK, AUTO }
} = useTheme();
```

### **Exemples**

#### Toggle simple
```jsx
const { toggleTheme } = useTheme();
<button onClick={toggleTheme}>🌓 Changer</button>
```

#### Forcer un thème
```jsx
const { setDarkMode } = useTheme();
<button onClick={setDarkMode}>🌙 Mode Sombre</button>
```

#### Afficher l'état
```jsx
const { isDark, effectiveTheme } = useTheme();

return (
  <div>
    <p>Thème actif : {effectiveTheme}</p>
    {isDark && <p>Mode nuit activé 🌙</p>}
  </div>
);
```

#### Mode auto (système)
```jsx
const { setAutoMode, isAuto } = useTheme();
<button onClick={setAutoMode}>
  {isAuto ? '✓' : ''} Auto (Système)
</button>
```

---

## 🎯 Composants

### **ThemeToggle (Simple)**

```jsx
import ThemeToggle from './components/ThemeToggle';

// Bouton avec icône + label
<ThemeToggle />

// Compact (juste l'icône)
<ThemeToggle compact />

// Sans label
<ThemeToggle showLabel={false} />
```

### **ThemeToggleMenu (Menu déroulant)**

```jsx
import { ThemeToggleMenu } from './components/ThemeToggle';

// Menu avec 3 options : Clair / Sombre / Auto
<ThemeToggleMenu />
```

---

## 🛠️ Créer un Composant Thématisé

### **Avec les variables CSS**

```jsx
function MyCard() {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--spacing-md)',
      boxShadow: 'var(--shadow-md)',
    }}>
      Mon contenu
    </div>
  );
}
```

### **Avec CSS externe**

```css
/* styles.css */
.my-card {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.my-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-lg);
}
```

### **Styles conditionnels selon le thème**

```jsx
import useTheme from './hooks/useTheme';

function MyComponent() {
  const { isDark } = useTheme();

  return (
    <div className={isDark ? 'my-component-dark' : 'my-component-light'}>
      {/* ... */}
    </div>
  );
}
```

---

## 🎨 Bonnes Pratiques

### ✅ **À FAIRE**

- ✅ Toujours utiliser les variables CSS (`var(--bg-primary)`)
- ✅ Utiliser les variables de spacing (`var(--spacing-md)`)
- ✅ Utiliser les variables de radius (`var(--radius-lg)`)
- ✅ Utiliser les transitions (`transition: all var(--transition-base)`)
- ✅ Tester les deux thèmes (clair ET sombre)

### ❌ **À ÉVITER**

- ❌ Hardcoder les couleurs (`#ffffff`, `#000000`)
- ❌ Hardcoder les espacements (`padding: 20px`)
- ❌ Ignorer les variables de design system
- ❌ Oublier de tester le thème sombre

---

## 🧪 Test du Système

### **1. Test Manuel**

1. Ajouter le `<ThemeToggle />` dans votre app
2. Cliquer sur le bouton
3. Vérifier que TOUS les composants changent de couleur
4. Vérifier la persistence (recharger la page)

### **2. Vérifier la Persistence**

```jsx
// Le thème est sauvegardé dans localStorage
localStorage.getItem('app-theme') // 'light', 'dark', ou 'auto'
```

### **3. Vérifier le Mode Auto**

1. Utiliser `<ThemeToggleMenu />`
2. Sélectionner "Auto (Système)"
3. Changer les préférences système de votre OS
4. Le thème devrait suivre automatiquement

---

## 📱 Responsive

Le système de thèmes fonctionne parfaitement sur :

- ✅ Desktop
- ✅ Tablette
- ✅ Mobile
- ✅ PWA

Sur mobile, le label du bouton est automatiquement masqué (juste l'icône).

---

## 🔐 Accessibilité

- ✅ `aria-label` sur les boutons
- ✅ Contraste suffisant (WCAG AA)
- ✅ Transitions douces
- ✅ Support clavier complet

---

## 🐛 Dépannage

### **Le thème ne change pas**

1. Vérifier que `design-system.css` est bien importé
2. Vérifier la console pour les erreurs
3. Vérifier que `useTheme()` est appelé correctement

### **Certains composants ne changent pas**

- Vérifier qu'ils utilisent les variables CSS (`var(--bg-primary)`)
- Remplacer les couleurs hardcodées

### **Le thème ne se sauvegarde pas**

- Vérifier que `localStorage` fonctionne
- Vérifier la console pour les erreurs

---

## 🎉 C'est Prêt !

Le système de thèmes est **100% fonctionnel** et harmonisé !

### **Prochaines Étapes**

1. ✅ Ajouter `<ThemeToggle />` dans votre header
2. ✅ Tester les deux thèmes
3. ✅ Mettre à jour vos composants custom pour utiliser les variables

**Questions ?** Consultez `src/styles/design-system.css` pour toutes les variables ! 🚀
