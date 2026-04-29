# 🧪 Comment Tester le Mode Hors Ligne

## Méthode 1 : DevTools (Recommandé)

1. Ouvrir votre application : `npm run dev`
2. Ouvrir Chrome DevTools (F12)
3. Aller dans l'onglet **Network**
4. Cocher **"Offline"** dans le menu déroulant
5. Rafraîchir la page

✅ **Résultat attendu :**
- Vous voyez l'indicateur "🔴 Hors ligne"
- L'application charge depuis le cache
- Vous pouvez créer/modifier (sera synced au retour)

---

## Méthode 2 : Couper le WiFi

1. Ouvrir votre application
2. Couper votre WiFi / Ethernet
3. Rafraîchir la page

✅ **Résultat attendu :**
- Bannière "Mode hors ligne actif"
- Cache local utilisé
- Queue de sync activée

---

## Méthode 3 : Service Worker (Production uniquement)

Le mode hors ligne COMPLET ne fonctionne qu'en **production** car il utilise les Service Workers.

```bash
# Build production
npm run build

# Servir en production
npm run preview
# ou
npx serve -s dist

# Puis tester avec DevTools Offline
```

---

## Ce Qui Devrait Fonctionner Hors Ligne

### ✅ Actuellement Implémenté

- [x] Authentification (session en cache)
- [x] Profil utilisateur (cache IndexedDB)
- [x] Lecture des données existantes
- [x] Indicateur visuel "Hors ligne"

### 🟡 Nouveau Système (à intégrer)

- [ ] Création interventions multi-jours hors ligne
- [ ] Auto-assignation techniciens hors ligne
- [ ] Queue de sync avec delta
- [ ] Résolution conflits automatique

---

## Debug

Si le mode hors ligne ne fonctionne pas :

1. **Vérifier la console** :
   ```javascript
   // Devrait afficher :
   📴 Mode hors ligne détecté - Vérification session cache
   ✅ Session hors ligne trouvée
   📴 [App] Mode hors ligne détecté - Chargement profil depuis cache
   ```

2. **Vérifier IndexedDB** :
   - DevTools → Application → IndexedDB
   - Chercher : `srp-offline-storage`
   - Vérifier présence de : `profiles`, `interventions`, etc.

3. **Vérifier Service Worker** :
   - DevTools → Application → Service Workers
   - Devrait afficher : "Activated and running"

---

## Cas d'Usage Réels

### Technicien sur le Terrain

```
1. Technicien se connecte au bureau (WiFi)
   → Données chargées et mises en cache

2. Technicien part en intervention (perd le réseau)
   → Indicateur "🔴 Hors ligne" s'affiche
   → Peut consulter ses interventions du jour
   → Peut remplir un rapport hors ligne

3. Technicien modifie une intervention
   → Sauvegardé localement
   → Badge "1 modification en attente"

4. Technicien retrouve le réseau
   → Détection automatique "🟢 En ligne"
   → Sync automatique (delta uniquement)
   → Notification "✅ Synchronisé"
```

---

**Date** : 2026-03-14
**Session** : https://claude.ai/code/session_01NntWsQXJd6sShsRFdB9k1d
