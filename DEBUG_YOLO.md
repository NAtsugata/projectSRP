# 🔍 Guide de Diagnostic YOLO

## 🎯 Problème : Aucune visualisation pendant la caméra

Ce guide vous aide à diagnostiquer pourquoi YOLO ne détecte/n'affiche rien.

---

## ✅ **ÉTAPE 1 : Vérifier le chargement du modèle**

### Ouvrez la console du navigateur (F12)

1. Allez dans l'onglet **"Console"**
2. Sélectionnez **"YOLO (IA)"** dans le scanner
3. Cherchez ces logs :

```
🔄 Chargement du modèle YOLO ONNX...
📁 Chemin du modèle: /models/document_detector.onnx
⚙️ Configuration ONNX Runtime...
✅ Modèle YOLO chargé avec succès !
📊 Input name: images
📊 Output names: ["output0"]
🎯 MODE DEBUG ACTIVÉ - Détectera TOUS les objets
```

### ❌ Si vous voyez une ERREUR :

```
❌ Erreur lors du chargement du modèle YOLO:
```

**Solutions** :
- Le fichier `/models/document_detector.onnx` n'existe pas
- Vérifiez que Vercel a bien exécuté le script de téléchargement
- Regardez les logs de build Vercel

---

## ✅ **ÉTAPE 2 : Vérifier la détection**

### Pointez votre caméra vers N'IMPORTE QUOI

Avec le **MODE DEBUG activé**, YOLO devrait détecter :
- 📱 Téléphones
- 💻 Ordinateurs
- 📚 Livres
- 🪑 Chaises
- 👤 Personnes
- 🚗 N'importe quel objet !

### Cherchez ces logs :

```
[LIVE DETECTION] Result from yolo: {
  detected: true,
  method: "yolo",
  confidence: 0.856,
  contourLength: 4,
  contour: [...]
}
```

### ❌ Si vous voyez `detected: false` :

```
[LIVE DETECTION] Result from yolo: { detected: false }
```

**Raisons possibles** :
- Le modèle ne se charge pas
- Les dimensions de sortie YOLO sont incorrectes
- Problème de format ONNX

---

## ✅ **ÉTAPE 3 : Vérifier l'affichage**

### Si YOLO détecte mais rien ne s'affiche :

Cherchez ces logs :

```
[LIVE DETECTION] Document detected (stable)! Drawing overlay...
[LIVE DETECTION] Smoothed corners (%): [{x: 45.2, y: 32.1}, ...]
[LIVE DETECTION] Corners in pixels: [{x: 870, y: 617}, ...]
[LIVE DETECTION] Video dimensions: 1920 x 1080
[LIVE DETECTION] Overlay drawn successfully
```

### ❌ Si vous ne voyez PAS "Overlay drawn successfully" :

**Raisons possibles** :
- Le taux de succès est < 75% (pas assez stable)
- Les coins ne sont pas au bon format
- Le canvas overlay n'est pas créé

---

## 📊 **Logs Importants à Vérifier**

### Logs de l'inférence YOLO :

```
📦 YOLO output name: output0
📏 YOLO output dims: [1, 84, 8400]
📊 YOLO output data size: 705600
🔢 First 20 values: [0.123, 0.456, ...]
📊 YOLO Output dims: [1,84,8400], anchors: 8400, classes: 80
📍 Total détections avant NMS: 5
```

### Si les dimensions sont DIFFÉRENTES :

- Format attendu : `[1, 84, 8400]`
- Si différent → Le modèle n'est pas YOLOv8n standard

---

## 🔧 **Tests à Faire**

### Test 1 : OpenCV fonctionne ?

1. Sélectionnez **"OpenCV (Rapide)"**
2. Pointez vers un document blanc
3. Vous devez voir le rectangle vert

**Si OpenCV fonctionne mais pas YOLO** → Problème spécifique YOLO

### Test 2 : Le modèle existe ?

Ouvrez dans votre navigateur :
```
https://votre-site.vercel.app/models/document_detector.onnx
```

**Devrait** : Télécharger un fichier de ~12 MB
**Si 404** : Le modèle n'a pas été téléchargé pendant le build

### Test 3 : Vérifier les logs Vercel

1. Allez dans Vercel Dashboard
2. Cliquez sur votre déploiement
3. Onglet "Build Logs"
4. Cherchez :

```
🚀 Téléchargement du modèle YOLO pour la détection de documents...
📦 Taille du fichier: 12.xx MB
⏳ Téléchargement: 100%
✅ Modèle YOLO téléchargé avec succès! (12.xx MB)
```

**Si absent** : Le script `prebuild` n'a pas fonctionné

---

## 🐛 **Solutions selon les cas**

### Cas 1 : Modèle ne se charge pas (404)

```bash
# En local, téléchargez manuellement
npm run postinstall

# Vérifiez que le fichier existe
ls -lh public/models/document_detector.onnx
```

### Cas 2 : YOLO détecte mais n'affiche rien

**Vérifiez dans la console** :
- `successRate` doit être >= 0.75
- `contour.length` doit être === 4

**Solution** : Baissez le seuil de stabilité à 50% (au lieu de 75%)

### Cas 3 : Aucune détection du tout

**MODE DEBUG** est activé dans le dernier commit !
- Seuil : 0.1 (très bas)
- Accepte TOUTES les classes
- Devrait détecter n'importe quoi

**Si toujours rien** : Problème avec le modèle ONNX ou ONNX Runtime

---

## 📝 **Ce que je dois savoir**

**Copiez-collez dans votre réponse** :

1. **Le modèle se charge-t-il ?**
   - ✅ Oui / ❌ Non / ⚠️ Erreur

2. **Logs de chargement** :
   ```
   [Copiez les logs ici]
   ```

3. **Logs de détection** :
   ```
   [Copiez les logs ici]
   ```

4. **Le fichier modèle existe ?**
   - Testez : `https://votre-site.vercel.app/models/document_detector.onnx`
   - ✅ Télécharge un fichier / ❌ 404

5. **OpenCV fonctionne ?**
   - ✅ Oui / ❌ Non

---

## 🚀 **Prochaine Étape**

Une fois ces infos collectées, je pourrai :
- Identifier le problème exact
- Fournir une solution ciblée
- Corriger le code si nécessaire

**Merci !** 🎉
