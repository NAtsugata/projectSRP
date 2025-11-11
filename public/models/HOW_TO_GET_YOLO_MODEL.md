# 📥 Comment Obtenir le Modèle YOLO

## ⚠️ Important

Le modèle YOLO **n'est PAS inclus** dans le dépôt Git car :
- Taille : ~6 MB (trop volumineux pour Git)
- Spécifique à l'utilisateur (peut être personnalisé)
- Optionnel (OpenCV fonctionne par défaut)

## 🚀 Méthode Automatique (Recommandée)

Exécutez simplement le script de téléchargement :

```bash
cd public/models
./download_yolo.sh
```

Ce script va :
1. ✅ Vérifier les dépendances Python
2. ✅ Installer ultralytics, onnx, onnxruntime si nécessaire
3. ✅ Télécharger YOLOv8n depuis GitHub
4. ✅ Le convertir en format ONNX
5. ✅ Créer `document_detector.onnx`

⏱️ **Temps estimé** : 2-5 minutes

---

## 🔧 Méthode Manuelle

### Option 1 : Avec Python

```bash
cd public/models

# Installer les dépendances
pip install ultralytics onnx onnxruntime

# Exporter le modèle
python export_yolo_model.py --model yolov8n.pt --output document_detector.onnx --download
```

### Option 2 : Téléchargement Direct

Si vous avez déjà un fichier `.onnx` YOLOv8 :

```bash
# Copiez votre modèle
cp /chemin/vers/votre/modele.onnx public/models/document_detector.onnx
```

---

## 🧪 Vérification

Une fois le modèle téléchargé, vérifiez qu'il est présent :

```bash
ls -lh public/models/document_detector.onnx
```

Vous devriez voir un fichier d'environ **6 MB**.

---

## ✅ Utilisation

1. Lancez l'application : `npm start`
2. Naviguez vers **"Mes Documents"**
3. Cliquez sur **"Scanner un document"**
4. Sélectionnez **"YOLO (IA)"** au lieu de "OpenCV (Rapide)"
5. Démarrez la caméra

Vous verrez **"🤖 YOLO"** en haut à droite de la caméra si le modèle est chargé avec succès!

---

## ⚙️ Modèle Personnalisé

Pour utiliser votre propre modèle YOLO entraîné :

1. Exportez-le en ONNX :
   ```python
   from ultralytics import YOLO
   model = YOLO('votre_modele.pt')
   model.export(format='onnx', imgsz=640, simplify=True, opset=12)
   ```

2. Copiez le fichier :
   ```bash
   cp votre_modele.onnx public/models/document_detector.onnx
   ```

---

## 🐛 Dépannage

### ❌ "Failed to load YOLO model"

**Solutions** :
1. Vérifiez que le fichier existe :
   ```bash
   ls -lh public/models/document_detector.onnx
   ```
2. Vérifiez la taille du fichier (doit être > 1 MB)
3. Réessayez le téléchargement avec `./download_yolo.sh`
4. Consultez la console du navigateur (F12) pour plus de détails

### ❌ Erreur de téléchargement

Si le script échoue avec une erreur réseau :

```bash
# Téléchargez manuellement depuis GitHub
curl -L -o yolov8n.pt https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt

# Puis exportez
python export_yolo_model.py --model yolov8n.pt --output document_detector.onnx
```

### 🔄 Fallback automatique

Si YOLO ne charge pas, l'application utilise automatiquement OpenCV. Pas de panique ! 😊

---

## 📚 Plus d'Informations

- **Guide complet** : Consultez `QUICKSTART.md`
- **Entraînement personnalisé** : Voir `README.md`
- **Script d'export** : Lisez `export_yolo_model.py`

---

## 🎯 Résumé Rapide

```bash
# Installation en une commande
cd public/models && ./download_yolo.sh
```

C'est tout! 🎉
