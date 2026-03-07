# Mode Hors Ligne - Documentation

## 🎯 Objectif

Permettre aux utilisateurs de:
1. **Se connecter** même sans connexion internet
2. **Créer des PDF CERFA** hors ligne
3. **Travailler normalement** avec synchronisation automatique au retour en ligne

---

## ✨ Fonctionnalités

### 1. Authentification Hors Ligne

#### Comment ça fonctionne

- **Première connexion** : Lors de la connexion avec internet, les credentials sont hashés (SHA-256) et stockés de manière sécurisée dans IndexedDB
- **Session cachée** : La session Supabase est sauvegardée localement (valide 7 jours)
- **Connexion hors ligne** : L'utilisateur peut se connecter avec ses identifiants habituels, même sans internet
- **Vérification** : Les credentials sont vérifiés localement contre le hash stocké

#### Sécurité

- ✅ Mot de passe JAMAIS stocké en clair (uniquement hash SHA-256)
- ✅ Session stockée dans IndexedDB (isolé par domaine)
- ✅ Expiration automatique après 7 jours
- ✅ Nettoyage complet lors de la déconnexion

### 2. Génération de PDF CERFA Hors Ligne

#### PDFs disponibles

Les formulaires CERFA suivants sont **entièrement disponibles hors ligne** :
- **CERFA 15497-04** : Fiche d'intervention fluides frigorigènes
- **CERFA 15498** : Attestation de capacité
- **CERFA 1301-SD** : Autre formulaire

#### Pourquoi ça fonctionne

- Les PDF sont **importés comme assets Vite** → inclus dans le bundle JS
- La bibliothèque `pdf-lib` fonctionne **entièrement côté client** (pas besoin de serveur)
- Numérotation automatique stockée en `localStorage`
- Génération instantanée, aucune dépendance réseau

### 3. Synchronisation Automatique

#### Queue de synchronisation

Toutes les actions effectuées hors ligne sont automatiquement mises en file d'attente :
- Création/modification d'interventions
- Ajout de dépenses
- Demandes de congés
- Mise à jour de checklists

#### Déclencheurs de sync

La synchronisation se déclenche automatiquement dans ces cas :
1. **Retour en ligne** : Détection du passage offline → online
2. **Démarrage de l'app** : Si en ligne, sync après 5 secondes
3. **Manuel** : Bouton "Synchroniser" dans l'indicateur hors ligne

#### Gestion des conflits

- **Retry automatique** : 3 tentatives par opération
- **Abandonnées** : Les opérations qui échouent 3 fois sont supprimées et loggées
- **Notification** : L'utilisateur est informé du nombre d'actions synchronisées

---

## 🗂️ Architecture Technique

### Stores IndexedDB

| Store | Description |
|-------|-------------|
| `auth` | Session et credentials hashés |
| `userData` | Profil utilisateur et permissions |
| `interventions` | Cache des interventions |
| `profiles` | Cache des profils/utilisateurs |
| `expenses` | Cache des dépenses |
| `contracts` | Cache des contrats |
| `syncQueue` | File d'attente de synchronisation |
| `meta` | Métadonnées (dernière sync, etc.) |

### Service Worker (v4)

**Stratégies de cache** :
- **Assets statiques** : Cache-First (JS, CSS, images)
- **API Supabase** : Network-First avec fallback cache
- **Navigation** : Network-First, fallback vers index.html
- **Modèle YOLO** : Pré-chargé en arrière-plan

**Assets pré-cachés** :
```javascript
- /
- /offline.html
- /index.html
- /manifest.json
- /favicon.ico
- /logo192.png
- /models/best.onnx (arrière-plan)
```

### Nouveaux Services

#### `/src/services/offlineAuthService.js`

```javascript
// Sauvegarder après connexion réussie
await saveAuthData(session, email, password, userProfile);

// Connexion hors ligne
const result = await signInOffline(email, password);

// Nettoyer lors de la déconnexion
await clearOfflineAuth();

// Synchroniser les données essentielles
await syncOfflineData(supabase, userId);
```

#### `/src/utils/offlineStorage.js` (v2)

```javascript
// Auth
await cacheAuthSession(session);
await cacheAuthCredentials(email, passwordHash);
const session = await getCachedAuthSession();
const isValid = await isSessionValid(); // 7 jours

// Données
await cacheUserData(profile);
await cacheInterventions(interventions);
await cacheProfiles(profiles);

// Queue de sync (déjà existant)
await addToSyncQueue({ type, table, action, data });
const operations = await getPendingSyncOperations();
```

#### `/src/utils/syncService.js`

Service de synchronisation déjà existant, étendu pour supporter :
- CREATE/UPDATE/DELETE pour expenses
- CREATE/UPDATE pour interventions
- CREATE pour leave_requests
- UPDATE pour checklists

---

## 📱 Composants UI

### OfflineIndicator

Indicateur visuel déjà existant montrant :
- 📴 **Mode hors ligne** (orange)
- 🔄 **Synchronisation en cours** (bleu)
- ⏳ **N actions en attente** (jaune)
- 📶 **Connexion rétablie** (vert)

---

## 🔧 Utilisation pour les Développeurs

### Ajouter une nouvelle opération offline

1. **Définir le type** dans `syncService.js` :
```javascript
export const SYNC_OPERATION_TYPES = {
  // ...
  CREATE_MY_ENTITY: 'CREATE_MY_ENTITY'
};
```

2. **Implémenter l'exécution** :
```javascript
case SYNC_OPERATION_TYPES.CREATE_MY_ENTITY:
  return await supabase.from('my_table').insert([payload]).select().single();
```

3. **Queueuer l'opération** lors de la création hors ligne :
```javascript
import { queueOperation, SYNC_OPERATION_TYPES } from '../utils/syncService';

if (!navigator.onLine) {
  await queueOperation(SYNC_OPERATION_TYPES.CREATE_MY_ENTITY, newEntity);
}
```

### Tester le mode hors ligne

1. **Chrome DevTools** :
   - Ouvrir DevTools (F12)
   - Onglet "Network"
   - Dropdown "No throttling" → "Offline"

2. **Mode Avion** (mobile) :
   - Activer le mode avion
   - Tester la connexion
   - Créer des PDF, modifier des données
   - Désactiver le mode avion
   - Vérifier la synchronisation automatique

---

## 🚀 Migration

### Pour les utilisateurs existants

Aucune action requise ! Le système détecte automatiquement :
1. Pas de session cachée → Connexion normale
2. Session expirée → Redemande connexion avec internet
3. Première connexion après déploiement → Sauvegarde automatique

### Compatibilité

- ✅ Chrome/Edge (desktop & mobile)
- ✅ Firefox (desktop & mobile)
- ✅ Safari (desktop & iOS)
- ✅ Samsung Internet
- ⚠️ Mode privé : Fonctionne mais cache effacé à la fermeture

---

## 🐛 Debugging

### Vérifier IndexedDB

```javascript
// Console Chrome
indexedDB.databases() // Liste toutes les DB
```

**Application > IndexedDB > srp-offline-db** :
- Inspecter les stores
- Vérifier les données en cache
- Compter les opérations dans syncQueue

### Logs

Tous les logs sont préfixés :
- `[OfflineAuth]` : Authentification hors ligne
- `[OfflineDB]` : Opérations IndexedDB
- `[SyncService]` : Synchronisation
- `[Service Worker]` : Cache et requêtes

### Forcer une synchronisation

```javascript
import { syncPendingOperations } from './utils/syncService';

// Depuis la console
await syncPendingOperations();
```

### Vider le cache

```javascript
import { clearAuthCache } from './utils/offlineStorage';
import { clearCache } from './serviceWorkerRegistration';

// Vider auth
await clearAuthCache();

// Vider Service Worker cache
clearCache();
```

---

## ⚡ Performances

### Taille du cache

- **IndexedDB** : ~2-5 MB (dépend du nombre d'interventions)
- **Service Worker Cache** : ~10-15 MB (assets + modèle YOLO)
- **Total** : ~20 MB maximum

### Quotas navigateur

Les quotas sont généralement :
- **Chrome/Edge** : ~60% de l'espace disque disponible
- **Firefox** : 10 GB par origine
- **Safari** : ~1 GB (demande permission au-delà)

L'app utilise **< 1%** du quota disponible.

---

## 📋 Checklist de Test

- [ ] Connexion normale avec internet
- [ ] Déconnexion et vérification du nettoyage
- [ ] Passage en mode hors ligne (DevTools)
- [ ] Connexion hors ligne avec credentials corrects
- [ ] Connexion hors ligne avec credentials incorrects
- [ ] Génération PDF CERFA hors ligne (15497, 15498)
- [ ] Création intervention hors ligne → queue
- [ ] Retour en ligne → sync automatique
- [ ] Bouton sync manuel
- [ ] Indicateur hors ligne visible et fonctionnel
- [ ] Session expirée après 7 jours (modifier timestamp dans IndexedDB)

---

## 🔐 Sécurité - Rappels

### ❌ À NE JAMAIS FAIRE

- Stocker le mot de passe en clair
- Exposer le hash dans les logs
- Synchroniser les credentials avec le serveur

### ✅ Bonnes Pratiques Appliquées

- Hash SHA-256 (Web Crypto API standard)
- Expiration automatique (7 jours)
- Nettoyage complet au logout
- IndexedDB isolé par domaine
- HTTPS obligatoire pour Service Worker

---

## 📞 Support

Pour toute question ou bug :
1. Vérifier les logs dans la console (F12)
2. Inspecter IndexedDB (DevTools > Application)
3. Créer une issue GitHub avec les logs

---

**Version** : 1.0 (Mars 2026)
**Dernière mise à jour** : 7 mars 2026
