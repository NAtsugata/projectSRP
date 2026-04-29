# 🐛 Debug Authentification Hors Ligne

## Étape 1 : Vérifier que la session est sauvegardée

### Test en ligne (OBLIGATOIRE EN PREMIER)

1. **Ouvrir la console** (F12)
2. **Se connecter avec internet activé**
3. **Vérifier les logs** :

```
✅ Logs attendus :
[AuthService] État connexion: 🌐 En ligne
✅ Connexion réussie
[OfflineAuth] ✅ Données auth sauvegardées pour mode hors ligne
[OfflineDB] Session en cache
[OfflineDB] Credentials en cache (hashés)
[OfflineDB] Données utilisateur en cache
```

### Vérifier IndexedDB

4. **Application > IndexedDB > srp-offline-db**
5. **Vérifier les stores** :

| Store | Key | Devrait contenir |
|-------|-----|------------------|
| `auth` | `session` | `{ key: 'session', value: {...}, timestamp: ... }` |
| `auth` | `credentials` | `{ key: 'credentials', email: '...', passwordHash: '...', timestamp: ... }` |
| `userData` | `current_user` | `{ key: 'current_user', id: '...', email: '...', full_name: '...', ... }` |

❌ **Si ces données sont absentes** : Le problème est dans la sauvegarde !

---

## Étape 2 : Tester les fonctions de debug

### Exécuter dans la console

```javascript
// 1. Importer le module de test
import('./src/utils/testOfflineAuth.js').then(m => {
  window.testOfflineAuth = m.testOfflineAuth;
  window.showOfflineState = m.showOfflineState;
  testOfflineAuth();
});

// 2. Afficher l'état actuel
showOfflineState();
```

✅ **Résultat attendu** :
```
=== ÉTAT AUTHENTIFICATION HORS LIGNE ===

📦 AUTH STORE:
  ✅ session: { key: 'session', value: {...}, timestamp: ... }
  ✅ credentials: { key: 'credentials', email: '...', passwordHash: '...', timestamp: ... }

👤 USER DATA STORE:
  ✅ User: { id: '...', email: '...', full_name: '...', ... }

🔄 SYNC QUEUE:
  0 opération(s) en attente
```

❌ **Si des données manquent** : Problème de sauvegarde lors de la connexion en ligne

---

## Étape 3 : Tester la connexion hors ligne

### Activer le mode offline

1. **Chrome DevTools** : F12 > Network > "Offline"
2. **Se déconnecter** (si connecté)
3. **Saisir email/password** (EXACTEMENT les mêmes que lors de la connexion en ligne)
4. **Cliquer "Se connecter"**

### Logs attendus

```
[AuthService] 🔐 Tentative de connexion pour: votre@email.com
[AuthService] État connexion: 📴 Hors ligne
📴 Mode hors ligne - Utilisation du cache local
[AuthService] Appel de signInOffline...

[OfflineAuth] 🔍 Tentative de connexion hors ligne pour: votre@email.com
[OfflineAuth] 1/4 Vérification validité session...
[OfflineAuth] Session valide: true
[OfflineAuth] 2/4 Hash du mot de passe...
[OfflineAuth] Hash généré: abc123...
[OfflineAuth] 3/4 Vérification credentials...
[OfflineAuth] Credentials valides: true
[OfflineAuth] 4/4 Récupération session et user data...
[OfflineAuth] Session récupérée: Oui
[OfflineAuth] User data récupéré: Oui
[OfflineAuth] ✅ Connexion hors ligne réussie

[AuthService] Résultat signInOffline: { success: true, session: {...}, user: {...}, isOfflineMode: true }
📴 Connexion hors ligne réussie
```

---

## Diagnostics des erreurs

### ❌ Erreur : "Session expirée"

**Logs :**
```
[OfflineAuth] Session valide: false
[OfflineAuth] ❌ Session expirée (> 7 jours)
```

**Solution :**
- Se reconnecter avec internet pour recréer le cache
- Ou modifier le timestamp dans IndexedDB (debug uniquement)

---

### ❌ Erreur : "Email ou mot de passe incorrect"

**Logs :**
```
[OfflineAuth] Credentials valides: false
[OfflineAuth] ❌ Credentials invalides
```

**Causes possibles :**

1. **Mot de passe différent** : Vous devez utiliser EXACTEMENT le même mot de passe
2. **Email différent** : Vérifier la casse (majuscules/minuscules)
3. **Hash pas sauvegardé** : Vérifier dans IndexedDB si `credentials.passwordHash` existe

**Test manuel du hash :**
```javascript
// Dans la console
const encoder = new TextEncoder();
const data = encoder.encode('VOTRE_MOT_DE_PASSE');
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
console.log('Hash:', hash);

// Comparer avec IndexedDB > auth > credentials > passwordHash
```

---

### ❌ Erreur : "Données utilisateur introuvables"

**Logs :**
```
[OfflineAuth] Session récupérée: Non
[OfflineAuth] User data récupéré: Non
[OfflineAuth] ❌ Données manquantes
```

**Solution :**
1. Vérifier IndexedDB (voir Étape 1)
2. Si vide : Se reconnecter avec internet
3. Vérifier les logs de sauvegarde lors de la connexion en ligne

---

### ❌ Pas de logs du tout

**Causes possibles :**

1. **Service pas importé** : Vérifier que `offlineAuthService` est bien importé dans `authService.js`
2. **Erreur JavaScript** : Vérifier la console pour des erreurs
3. **IndexedDB bloqué** : Vérifier les paramètres du navigateur (cookies, stockage)

**Vérifications :**
```javascript
// Dans la console
import('../services/offlineAuthService.js').then(m => {
  console.log('Module chargé:', m);
  console.log('Fonctions disponibles:', Object.keys(m));
});
```

---

## Cas particuliers

### Mode navigation privée

- ⚠️ IndexedDB peut être limité ou effacé
- Session hors ligne fonctionne mais disparaît à la fermeture

### Navigateurs mobiles (iOS Safari)

- ⚠️ Peut avoir des quotas de stockage différents
- Parfois nécessite une interaction utilisateur pour IndexedDB

### Extensions navigateur

- ⚠️ Certaines extensions bloquent IndexedDB
- Tester en mode incognito sans extensions

---

## Solution ultime : Réinitialisation complète

```javascript
// 1. Vider tout le cache
indexedDB.deleteDatabase('srp-offline-db');
localStorage.clear();
sessionStorage.clear();

// 2. Recharger la page
location.reload();

// 3. Se reconnecter avec internet

// 4. Vérifier IndexedDB (devrait être rempli)

// 5. Tester mode offline
```

---

## Checklist de debug

- [ ] Connexion en ligne réussie (logs ✅ Données auth sauvegardées)
- [ ] IndexedDB contient `auth/session`, `auth/credentials`, `userData/current_user`
- [ ] `showOfflineState()` affiche toutes les données
- [ ] Même email utilisé (vérifier la casse)
- [ ] Même mot de passe utilisé
- [ ] Mode offline activé (DevTools ou Mode Avion)
- [ ] Logs de connexion offline visibles dans la console
- [ ] Pas d'erreur JavaScript dans la console

---

## Support

Si le problème persiste :

1. **Copier tous les logs de la console** (F12 > Console > Clic droit > Save as...)
2. **Screenshot de IndexedDB** (F12 > Application > IndexedDB > srp-offline-db)
3. **Navigateur et version** (ex: Chrome 131.0.6778.109)
4. **Système d'exploitation** (ex: Windows 11, macOS Sonoma, Ubuntu 22.04)

Avec ces informations, je pourrai identifier le problème précis.
