# Scripts de Build

Ce dossier contient les scripts automatiques exécutés pendant le build.

## 📥 download-yolo-model.js

**Objectif** : Télécharger automatiquement le modèle YOLO pendant le déploiement Vercel.

### Comment ça fonctionne ?

1. **Exécution automatique** :
   - Avant chaque build (`npm run prebuild`)
   - Après l'installation des dépendances (`npm run postinstall`)

2. **Source du modèle** :
   - URL : `https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.onnx`
   - Modèle : YOLOv8 Nano (~6 MB)
   - Format : ONNX (optimisé pour le web)

3. **Destination** :
   - Fichier : `public/models/document_detector.onnx`
   - Accessible via : `/models/document_detector.onnx`

### Fonctionnalités

✅ **Intelligent** : Ne télécharge que si le fichier n'existe pas ou est invalide

✅ **Progression** : Affiche le pourcentage de téléchargement

✅ **Validation** : Vérifie la taille du fichier (> 1 MB)

✅ **Gestion des erreurs** : Suit les redirections HTTP et gère les erreurs

### Utilisation manuelle

```bash
# Télécharger le modèle localement
npm run postinstall

# Ou directement avec Node
node scripts/download-yolo-model.js
```

### Variables d'environnement (optionnel)

Aucune configuration nécessaire ! Le script fonctionne out-of-the-box.

### Dépannage

**Le modèle ne se télécharge pas ?**
- Vérifiez votre connexion Internet
- Vérifiez que le dossier `public/models/` existe
- Exécutez manuellement : `node scripts/download-yolo-model.js`

**Le fichier est trop petit ?**
- Le script valide automatiquement la taille (> 1 MB)
- En cas d'erreur, le fichier est supprimé et le script échoue

### Pour les déploiements Vercel

Vercel exécute automatiquement :
1. `npm install` (déclenche `postinstall`)
2. `npm run build` (déclenche `prebuild`)

Le modèle est donc téléchargé **avant** le build et disponible dans le dossier `build/models/`.

---

## 🔒 Sécurité

- Le script utilise HTTPS uniquement
- Source officielle : GitHub Releases d'Ultralytics
- Validation de la taille du fichier
- Pas de code exécuté dynamiquement

## 📚 En savoir plus

- [Documentation YOLO](../public/models/README.md)
- [Ultralytics GitHub](https://github.com/ultralytics/ultralytics)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
