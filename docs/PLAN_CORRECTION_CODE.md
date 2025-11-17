# Plan de Correction Complet - Audit Code

**Date**: 17 Novembre 2025
**Version**: 1.0
**Temps total estimé**: 4 semaines

---

## 📋 Vue d'ensemble

| Priorité | Nombre | Temps estimé |
|----------|--------|--------------|
| 🔴 Critique | 3 problèmes | 2-3 jours |
| 🟠 Élevée | 5 problèmes | 3-4 jours |
| 🟡 Moyenne | 7 problèmes | 5-7 jours |
| 🟢 Faible | 5 problèmes | 2-3 jours |
| **TOTAL** | **20 problèmes** | **12-17 jours** |

---

## 🚨 SEMAINE 1 - PROBLÈMES CRITIQUES (Priorité maximale)

### 🔴 Jour 1-2 : Correction des crashes garantis

#### ✅ TÂCHE 1.1 : Fixer scannedDocumentsService
**Temps**: 2-3h
**Impact**: CRASH de l'app au scan de documents
**Fichiers**:
- `src/services/scannedDocumentsService.js`

**Actions**:
1. Remplacer `storageService.uploadFile()` par une méthode existante
2. Ajouter les méthodes manquantes dans `storageService`
3. Tester le scan de documents

**Code à modifier**:
```javascript
// Ligne 68 - AVANT
const uploadResult = await storageService.uploadFile(
  file,
  `scanned-docs/${userId}/${Date.now()}-${file.name}`
);

// APRÈS
const uploadResult = await storageService.uploadInterventionFile(
  file,
  userId,
  'scanned-docs',
  (progress) => console.log(`Upload: ${progress}%`)
);

// Ligne 178 - AVANT
await storageService.deleteFile(filePath);

// APRÈS
await storageService.deleteInterventionFile(fileUrl);
```

**Tests**:
- [ ] Scanner un document
- [ ] Upload réussi
- [ ] Supprimer un document
- [ ] Pas de crash

---

#### ✅ TÂCHE 1.2 : Nettoyer les fuites mémoire URL.createObjectURL
**Temps**: 4-5h
**Impact**: CRASH sur mobile après utilisations multiples
**Fichiers** (10 fichiers):
- `src/pages/InterventionDetailView.js:228`
- `src/pages/DocumentScannerView.js:369,454,559,621`
- `src/utils/yoloDetector.js:350`
- `src/hooks/useMobileFileManager.js:113`
- `src/hooks/useMobileUpload.js:131`
- `src/utils/imageOptimizer.js:106`
- `src/pages/IRShowerFormsView.js:374`

**Pattern de correction** (à appliquer partout):
```javascript
// AVANT
const preview = URL.createObjectURL(file);
item.preview = preview;

// APRÈS
const [objectUrls, setObjectUrls] = useState([]);

const preview = URL.createObjectURL(file);
item.preview = preview;
setObjectUrls(prev => [...prev, preview]);

// Cleanup
useEffect(() => {
  return () => {
    objectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
  };
}, [objectUrls]);
```

**Checklist par fichier**:
- [ ] InterventionDetailView.js - Ajouter cleanup
- [ ] DocumentScannerView.js - 4 endroits à corriger
- [ ] yoloDetector.js - Ajouter cleanup
- [ ] useMobileFileManager.js - Ajouter cleanup
- [ ] useMobileUpload.js - Ajouter cleanup
- [ ] imageOptimizer.js - Ajouter cleanup
- [ ] IRShowerFormsView.js - Ajouter cleanup

**Tests**:
- [ ] Ouvrir/fermer détails intervention 20 fois
- [ ] Scanner 10 documents d'affilée
- [ ] Vérifier RAM stable (DevTools Memory)
- [ ] Tester sur mobile iOS/Android

---

### 🔴 Jour 3 : Suppression console.log production

#### ✅ TÂCHE 1.3 : Créer système de logging conditionnel
**Temps**: 3-4h
**Impact**: Performance + Sécurité
**Fichiers**: 42 fichiers (315 occurrences)

**Étape 1 - Améliorer le logger existant**:
```javascript
// src/utils/logger.js - AMÉLIORER
const isDev = process.env.NODE_ENV === 'development';
const isDebug = localStorage.getItem('debug_mode') === 'true';

export default {
  log: (...args) => {
    if (isDev || isDebug) console.log(...args);
  },

  error: (...args) => {
    console.error(...args); // Toujours logger les erreurs
  },

  warn: (...args) => {
    if (isDev || isDebug) console.warn(...args);
  },

  emoji: (emoji, ...args) => {
    if (isDev || isDebug) console.log(emoji, ...args);
  },

  // Nouveau: pour la production critique
  production: (...args) => {
    // Envoyer à un service de monitoring (Sentry, etc.)
    if (!isDev) {
      // sendToMonitoring(args);
    }
  }
};
```

**Étape 2 - Script de remplacement automatique**:
```bash
# Créer un script Node.js
node scripts/replace-console-logs.js
```

**Étape 3 - Remplacement manuel pour cas spéciaux**:
Top 10 fichiers prioritaires:
1. [ ] src/lib/supabase.js (10 console.log)
2. [ ] src/pages/InterventionDetailView.js (21)
3. [ ] src/pages/ExpensesView.js (35)
4. [ ] src/services/expenseService.js (13)
5. [ ] src/pages/DocumentScannerView.js (18)
6. [ ] src/App.js (8)
7. [ ] src/hooks/useMobileUpload.js (12)
8. [ ] src/pages/IRShowerFormsView.js (15)
9. [ ] src/utils/documentDetector.js (9)
10. [ ] src/components/DocumentCropPreview.js (7)

**Pattern de remplacement**:
```javascript
// AVANT
console.log('User ID:', userId);
console.log('🔄 Upload started');

// APRÈS
logger.log('User ID:', userId);
logger.emoji('🔄', 'Upload started');

// Pour les erreurs - GARDER
console.error('Error:', error); // OK, toujours garder
```

**Tests**:
- [ ] Build production sans warnings
- [ ] Console vide en production
- [ ] Logs visibles en dev
- [ ] debug_mode=true fonctionne

---

## 🟠 SEMAINE 2 - PROBLÈMES SÉRIEUX

### 🟠 Jour 4-5 : Sécurisation JSON et localStorage

#### ✅ TÂCHE 2.1 : Wrapper sécurisé pour localStorage
**Temps**: 2-3h
**Fichiers**:
- Créer `src/utils/safeStorage.js`
- Modifier tous les accès localStorage

**Code du wrapper**:
```javascript
// src/utils/safeStorage.js
export const safeStorage = {
  getItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item;
    } catch (error) {
      console.error('localStorage.getItem failed:', error);
      return null;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded');
        // Nettoyer les vieilles données
        this.clearOldData();
      }
      console.error('localStorage.setItem failed:', error);
      return false;
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('localStorage.removeItem failed:', error);
      return false;
    }
  },

  getJSON(key, defaultValue = null) {
    try {
      const item = this.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('JSON.parse failed for key:', key, error);
      this.removeItem(key); // Supprimer donnée corrompue
      return defaultValue;
    }
  },

  setJSON(key, value) {
    try {
      const json = JSON.stringify(value);
      return this.setItem(key, json);
    } catch (error) {
      console.error('JSON.stringify failed:', error);
      return false;
    }
  },

  clearOldData() {
    // Supprimer données > 7 jours
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('_timestamp')) {
        const timestamp = this.getJSON(key);
        if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
          const dataKey = key.replace('_timestamp', '');
          this.removeItem(dataKey);
          this.removeItem(key);
        }
      }
    });
  }
};
```

**Fichiers à modifier** (6 fichiers):
- [ ] src/pages/ExpensesView.js (lignes 22, 27, 69, 70, 82, 90, 111, 115)
- [ ] src/lib/supabase.js (lignes 65-73)
- [ ] src/hooks/useMobileUpload.js
- [ ] src/pages/IRShowerFormsView.js
- [ ] src/hooks/useLocalStorage.js
- [ ] src/services/expenseService.js

**Pattern de remplacement**:
```javascript
// AVANT
const saved = localStorage.getItem('key');
const data = saved ? JSON.parse(saved) : default;
localStorage.setItem('key', JSON.stringify(value));

// APRÈS
import { safeStorage } from '../utils/safeStorage';
const data = safeStorage.getJSON('key', default);
safeStorage.setJSON('key', value);
```

**Tests**:
- [ ] Mode privé (localStorage désactivé)
- [ ] Quota dépassé (remplir localStorage)
- [ ] Données corrompues (modifier manuellement)
- [ ] Pas de crash

---

#### ✅ TÂCHE 2.2 : Fixer race conditions realtime
**Temps**: 3-4h
**Fichier**: `src/App.js:236-260`

**Solution - Debouncer les refreshs**:
```javascript
// AVANT - App.js
const sub = supabase
  .channel('app-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
    refreshData(profile); // ❌ Appelé 8 fois simultanément
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => {
    refreshData(profile);
  })
  // ...

// APRÈS
import { debounce } from 'lodash'; // ou créer une fonction debounce

const refreshDebounced = useCallback(
  debounce((prof) => {
    console.log('🔄 Refresh debounced triggered');
    refreshData(prof);
  }, 1000, { leading: true, trailing: true }),
  []
);

useEffect(() => {
  if (!profile?.id) return;

  const sub = supabase
    .channel('app-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => refreshDebounced(profile)
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'interventions' },
      () => refreshDebounced(profile)
    )
    // ... autres tables
    .subscribe();

  return () => {
    refreshDebounced.cancel(); // Annuler debounce en cours
    sub.unsubscribe();
  };
}, [profile?.id, refreshDebounced]);
```

**Alternative - Créer debounce maison**:
```javascript
// src/utils/debounce.js
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
```

**Tests**:
- [ ] Modifier plusieurs tables rapidement
- [ ] Un seul refresh appelé (debounced)
- [ ] Pas de données perdues
- [ ] Pas de doublons

---

#### ✅ TÂCHE 2.3 : Cleanup subscriptions realtime
**Temps**: 2h
**Fichier**: `src/hooks/usePushNotifications.js:87-160`

**Code actuel (BUGUÉ)**:
```javascript
useEffect(() => {
  if (!userId || !enabled) return; // ❌ Pas de cleanup

  const channel = supabase
    .channel('interventions-changes')
    .on(...)
    .subscribe();

  // ❌ MANQUE le return cleanup
}, [userId, enabled]);
```

**Code corrigé**:
```javascript
useEffect(() => {
  if (!userId || !enabled || !isNotificationEnabled()) {
    return; // Pas besoin de cleanup si pas de subscription
  }

  logger.log('📡 Starting realtime subscription for notifications');

  const interventionChannel = supabase
    .channel('interventions-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'interventions' },
      handleInterventionChange
    )
    .subscribe((status) => {
      logger.log('📡 Subscription status:', status);
    });

  // ✅ CLEANUP
  return () => {
    logger.log('📡 Cleaning up realtime subscription');
    interventionChannel.unsubscribe();
  };
}, [userId, enabled, handleInterventionChange]);
```

**Vérifier aussi**:
- [ ] App.js subscriptions (déjà OK normalement)
- [ ] Autres hooks custom avec subscriptions

**Tests**:
- [ ] Monter/démonter composant 10 fois
- [ ] Vérifier dans Supabase Dashboard: 1 seule connexion active
- [ ] Pas de connexions zombies

---

#### ✅ TÂCHE 2.4 : Fixer stale closures useLocalStorage
**Temps**: 1h
**Fichier**: `src/hooks/useLocalStorage.js:40`

**Code actuel (BUGUÉ)**:
```javascript
const setValue = useCallback((value) => {
  const valueToStore = value instanceof Function ? value(storedValue) : value;
  setStoredValue(valueToStore);
  window.localStorage.setItem(key, JSON.stringify(valueToStore));
}, [key, storedValue]); // ❌ storedValue cause re-création constante
```

**Code corrigé**:
```javascript
const setValue = useCallback((value) => {
  setStoredValue(currentValue => {
    // Utiliser functional update pour éviter stale closure
    const valueToStore = value instanceof Function
      ? value(currentValue)
      : value;

    try {
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }

    return valueToStore;
  });
}, [key]); // ✅ Seulement key dans les deps
```

**Tests**:
- [ ] Appels multiples setValue
- [ ] Pas de re-render inutiles
- [ ] Valeur correcte persistée

---

#### ✅ TÂCHE 2.5 : Fixer localStorage dans signOut
**Temps**: 30min
**Fichier**: `src/lib/supabase.js:65-73`

**Code corrigé**:
```javascript
const cleanupStorage = () => {
  try {
    // Nettoyage sécurisé des clés Supabase
    const keysToRemove = [];

    // Collecter les clés d'abord
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('supabase')) {
        keysToRemove.push(key);
      }
    }

    // Supprimer ensuite
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Failed to remove key:', key, e);
      }
    });

    // Nettoyage des clés d'application
    appKeysToClean.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        console.error('Failed to remove app key:', key, e);
      }
    });

    logger.log('🧹 Storage nettoyé');
  } catch (error) {
    console.error('❌ Erreur nettoyage storage:', error);
    // Fallback: forcer reload pour nettoyer
    window.location.reload();
  }
};
```

---

## 🟡 SEMAINE 3 - PROBLÈMES MOYENS

### 🟡 Jour 6-7 : Sécurité et validation

#### ✅ TÂCHE 3.1 : Améliorer sanitization XSS
**Temps**: 3-4h
**Fichier**: `src/utils/validators.js`

**Installer DOMPurify**:
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

**Code amélioré**:
```javascript
// validators.js
import DOMPurify from 'dompurify';

export const sanitizeString = (str, options = {}) => {
  if (typeof str !== 'string') return '';

  const {
    maxLength = 1000,
    allowHTML = false,
    allowedTags = [],
    allowedAttributes = []
  } = options;

  // Si pas de HTML autorisé, tout supprimer
  if (!allowHTML) {
    return DOMPurify.sanitize(str, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    })
    .trim()
    .substring(0, maxLength);
  }

  // Sinon, sanitizer avec tags autorisés
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    KEEP_CONTENT: true
  })
  .trim()
  .substring(0, maxLength);
};

// Variantes spécialisées
export const sanitizeInput = (str) => sanitizeString(str, { maxLength: 500 });
export const sanitizeTextarea = (str) => sanitizeString(str, { maxLength: 5000 });
export const sanitizeHTML = (str) => sanitizeString(str, {
  allowHTML: true,
  allowedTags: ['b', 'i', 'u', 'strong', 'em', 'p', 'br'],
  maxLength: 10000
});
```

**Utiliser partout**:
```javascript
// AVANT
const description = values.description.trim();

// APRÈS
import { sanitizeTextarea } from '../utils/validators';
const description = sanitizeTextarea(values.description);
```

**Tests**:
- [ ] Tester avec `<script>alert('XSS')</script>`
- [ ] Tester avec `javascript:alert('XSS')`
- [ ] Tester avec `<img src=x onerror=alert('XSS')>`
- [ ] Vérifier que texte légitime passe

---

#### ✅ TÂCHE 3.2 : Centraliser limites fichiers
**Temps**: 1h
**Créer**: `src/config/fileUpload.js`

```javascript
// src/config/fileUpload.js
export const FILE_SIZE_LIMITS = {
  intervention: 10 * 1024 * 1024,      // 10 MB
  vault: 20 * 1024 * 1024,             // 20 MB
  expense: 10 * 1024 * 1024,           // 10 MB
  scanned: 15 * 1024 * 1024,           // 15 MB
  briefing: 10 * 1024 * 1024,          // 10 MB
};

export const FILE_COUNT_LIMITS = {
  intervention: 20,
  vault: 50,
  expense: 5,
  scanned: 10,
  briefing: 10,
};

export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  all: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx']
};

export const validateFile = (file, type) => {
  const maxSize = FILE_SIZE_LIMITS[type];

  if (!file) {
    return { valid: false, error: 'Aucun fichier' };
  }

  if (file.size > maxSize) {
    const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `Fichier trop volumineux (max ${sizeMB}MB)`
    };
  }

  return { valid: true };
};
```

**Remplacer partout**:
```javascript
// AVANT
if (file.size > 10 * 1024 * 1024) {
  setError('Fichier trop gros');
}

// APRÈS
import { validateFile, FILE_SIZE_LIMITS } from '../config/fileUpload';
const validation = validateFile(file, 'intervention');
if (!validation.valid) {
  setError(validation.error);
}
```

---

#### ✅ TÂCHE 3.3 : Ajouter Error Boundaries
**Temps**: 2h

**Améliorer ErrorBoundary existant**:
```javascript
// src/components/ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Envoyer à monitoring (Sentry, etc.)
    // logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>😕 Oups, une erreur est survenue</h1>
          <p>Nous sommes désolés pour la gêne occasionnée.</p>

          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '1rem', textAlign: 'left' }}>
              <summary>Détails de l'erreur</summary>
              <pre style={{
                background: '#f5f5f5',
                padding: '1rem',
                overflow: 'auto'
              }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              className="btn btn-primary"
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="btn btn-secondary"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Entourer les routes critiques dans App.js**:
```javascript
// App.js
import ErrorBoundary from './components/ErrorBoundary';

<Route path="/planning" element={
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      <AdminPlanningView {...} />
    </Suspense>
  </ErrorBoundary>
} />

<Route path="/planning/:interventionId" element={
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      <InterventionDetailView {...} />
    </Suspense>
  </ErrorBoundary>
} />

// Etc. pour toutes les routes
```

**Tests**:
- [ ] Lancer une erreur volontaire
- [ ] ErrorBoundary attrape
- [ ] Bouton reset fonctionne
- [ ] Détails visible en dev uniquement

---

### 🟡 Jour 8-9 : Optimisations et nettoyage

#### ✅ TÂCHE 3.4 : Dédupliquer code commun
**Temps**: 3h

**Créer utils partagés**:
```javascript
// src/utils/formatters.js
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`;
};

export const formatDate = (dateString, format = 'short') => {
  if (!dateString) return '';

  const date = new Date(dateString);

  const formats = {
    short: {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    },
    long: {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    },
    time: {
      hour: '2-digit',
      minute: '2-digit'
    }
  };

  return date.toLocaleDateString('fr-FR', formats[format] || formats.short);
};

export const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};
```

**Remplacer partout**:
- [ ] InterventionForm.js
- [ ] ExpensesView.js
- [ ] AdminExpensesView.js
- [ ] FileUploader.js
- [ ] Etc.

---

#### ✅ TÂCHE 3.5 : Optimiser images compression
**Temps**: 2h

**Centraliser dans un service**:
```javascript
// src/services/imageCompression.js
import imageCompression from 'browser-image-compression';

const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg'
};

export const compressImage = async (file, options = {}) => {
  try {
    const finalOptions = { ...DEFAULT_OPTIONS, ...options };
    const compressed = await imageCompression(file, finalOptions);

    logger.log('Image compressed:', {
      original: formatFileSize(file.size),
      compressed: formatFileSize(compressed.size),
      reduction: `${((1 - compressed.size / file.size) * 100).toFixed(0)}%`
    });

    return compressed;
  } catch (error) {
    console.error('Compression failed:', error);
    return file; // Fallback sur original
  }
};

export const compressMultiple = async (files, options = {}) => {
  return Promise.all(
    files.map(file => compressImage(file, options))
  );
};
```

---

#### ✅ TÂCHE 3.6 : Vérifier SQL injection
**Temps**: 1h
**Fichier**: `src/services/scannedDocumentsService.js:212`

**Code actuel**:
```javascript
query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
```

**Code sécurisé**:
```javascript
// Échapper les caractères spéciaux SQL
const escapeSQLLike = (str) => {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
};

const safeSearchTerm = escapeSQLLike(searchTerm);
query = query.or(`title.ilike.%${safeSearchTerm}%,description.ilike.%${safeSearchTerm}%`);
```

---

## 🟢 SEMAINE 4 - AMÉLIORATIONS

### 🟢 Jour 10-11 : UX et qualité

#### ✅ TÂCHE 4.1 : Remplacer alert() par toasts
**Temps**: 2h
**Fichiers**:
- `src/components/planning/InterventionForm.js`
- `src/components/intervention/ScheduledDatesEditor.js`
- `src/pages/AdminExpensesView.js`

**Utiliser showToast existant**:
```javascript
// AVANT
if (!dateValue) {
  alert('Veuillez sélectionner une date d\'abord');
  return;
}

// APRÈS
if (!dateValue) {
  showToast('Veuillez sélectionner une date d\'abord', 'warning');
  return;
}
```

**Passer showToast en props si nécessaire**:
```javascript
// Dans App.js
<InterventionForm
  users={users}
  onSubmit={handleSubmit}
  showToast={showToast}  // ← Ajouter
/>
```

---

#### ✅ TÂCHE 4.2 : Ajouter PropTypes
**Temps**: 3h

**Installer**:
```bash
npm install prop-types
```

**Exemple pour tous les composants**:
```javascript
// InterventionForm.js
import PropTypes from 'prop-types';

InterventionForm.propTypes = {
  initialValues: PropTypes.shape({
    client: PropTypes.string,
    address: PropTypes.string,
    service: PropTypes.string,
    date: PropTypes.string,
    time: PropTypes.string,
  }),
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    full_name: PropTypes.string.isRequired,
    is_admin: PropTypes.bool,
  })).isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};

InterventionForm.defaultProps = {
  initialValues: {
    client: '',
    address: '',
    // ...
  },
  isSubmitting: false,
};
```

**Priorité par composants** (faire les plus critiques):
1. [ ] InterventionForm
2. [ ] InterventionCard
3. [ ] ExpensesView
4. [ ] ScheduledDatesEditor
5. [ ] ErrorBoundary
6. [ ] Tous les autres

---

#### ✅ TÂCHE 4.3 : Tests unitaires de base
**Temps**: 4h

**Setup Jest + React Testing Library**:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Créer tests prioritaires**:
```javascript
// src/utils/__tests__/validators.test.js
import { sanitizeString, validateEmail, validatePhone } from '../validators';

describe('validators', () => {
  describe('sanitizeString', () => {
    it('should remove XSS attempts', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('<script>');
    });

    it('should limit length', () => {
      const long = 'a'.repeat(2000);
      const result = sanitizeString(long);
      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('not-an-email')).toBe(false);
    });
  });
});

// src/utils/__tests__/safeStorage.test.js
import { safeStorage } from '../safeStorage';

describe('safeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should handle JSON correctly', () => {
    const data = { foo: 'bar' };
    safeStorage.setJSON('test', data);
    const result = safeStorage.getJSON('test');
    expect(result).toEqual(data);
  });

  it('should handle corrupted data', () => {
    localStorage.setItem('test', 'not-json');
    const result = safeStorage.getJSON('test', { default: true });
    expect(result).toEqual({ default: true });
  });
});
```

**Coverage cible**: 60% minimum

---

### 🟢 Jour 12 : Documentation et finalisation

#### ✅ TÂCHE 4.4 : Documenter les corrections
**Temps**: 2h

**Créer CHANGELOG.md**:
```markdown
# Changelog - Corrections Audit Code

## [1.1.0] - 2025-11-XX

### 🔴 Critiques Corrigés
- Fix crash scannedDocumentsService (méthodes manquantes)
- Fix fuites mémoire URL.createObjectURL (10 fichiers)
- Suppression console.log production (315 instances)

### 🟠 Sérieux Corrigés
- Sécurisation JSON.parse avec try-catch
- Debounce subscriptions realtime
- Cleanup subscriptions Supabase
- Fix stale closures useLocalStorage
- Wrapper sécurisé localStorage

### 🟡 Moyens Corrigés
- DOMPurify pour sanitization XSS
- Centralisation limites fichiers
- Error Boundaries sur toutes routes
- Déduplication code formatters
- Fix SQL injection escaping

### 🟢 Améliorations
- Remplacement alert() par toasts
- Ajout PropTypes tous composants
- Tests unitaires utils critiques
- Documentation complète

### 📊 Statistiques
- 20 problèmes corrigés
- 42 fichiers modifiés
- +500 lignes ajoutées
- -315 console.log supprimés
```

---

#### ✅ TÂCHE 4.5 : Tests finaux complets
**Temps**: 3h

**Checklist finale**:

**Critiques**:
- [ ] Scanner document → upload OK
- [ ] Ouvrir/fermer intervention 20x → RAM stable
- [ ] Build prod → 0 console.log
- [ ] Mode privé → pas de crash
- [ ] localStorage plein → erreur gérée

**Sérieux**:
- [ ] Modifier 5 tables rapidement → 1 seul refresh
- [ ] Démonter composants → channels unsubscribed
- [ ] setValue() 10x → valeur correcte

**Moyens**:
- [ ] Input `<script>` → bloqué par DOMPurify
- [ ] Upload 25MB → erreur claire
- [ ] Erreur composant → ErrorBoundary affiche
- [ ] Format dates/montants → cohérent partout

**Tests Mobile**:
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] Notifications fonctionnent
- [ ] Upload photos OK
- [ ] Pas de freeze/crash

**Tests Performance**:
- [ ] Lighthouse Score > 80
- [ ] Bundle size < 1MB
- [ ] First Contentful Paint < 2s

---

## 📊 MÉTRIQUES DE SUCCÈS

### Avant corrections
- ❌ 3 crashs garantis
- ❌ 315 console.log exposés
- ❌ 10+ fuites mémoire
- ⚠️ 0 tests unitaires
- ⚠️ Sanitization insuffisante

### Après corrections
- ✅ 0 crash
- ✅ 0 console.log en prod
- ✅ 0 fuite mémoire
- ✅ 60%+ test coverage
- ✅ DOMPurify implémenté
- ✅ Error boundaries partout
- ✅ Code dédupliqué

---

## 🔧 OUTILS RECOMMANDÉS

### Pendant développement
```bash
# Linter strict
npm run lint -- --fix

# Bundle analyzer
npm install --save-dev webpack-bundle-analyzer
npm run build:analyze

# Memory profiling
# Chrome DevTools > Memory > Take snapshot
```

### Monitoring production
```bash
# Sentry pour error tracking
npm install @sentry/react

# Lighthouse CI
npm install --save-dev @lhci/cli
```

---

## 📝 NOTES IMPORTANTES

1. **Ne pas tout faire d'un coup** : Suivre l'ordre par semaine
2. **Tester après chaque tâche** : Ne pas accumuler les bugs
3. **Commit régulier** : 1 commit par tâche terminée
4. **Review de code** : Faire relire les corrections critiques
5. **Backup** : Faire un backup complet avant de commencer

---

## 🆘 EN CAS DE PROBLÈME

Si une correction casse quelque chose :
1. `git log` pour voir le dernier commit
2. `git diff` pour voir les changements
3. `git revert <commit>` pour annuler
4. Analyser le problème
5. Re-appliquer proprement

---

**Prêt à commencer ?** 🚀

Commencez par la **Semaine 1 - Jour 1 - Tâche 1.1** !
