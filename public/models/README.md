# Modèles YOLO pour la Détection de Documents

Ce dossier contient les modèles ONNX utilisés pour la détection de documents.

## ☁️ **NOUVEAU : Déploiement Vercel avec CDN**

Pour un déploiement sur **Vercel**, l'application utilise maintenant un modèle YOLO hébergé sur **Hugging Face CDN**.

✅ **Aucun fichier local nécessaire** - Le modèle est chargé automatiquement depuis :
```
https://huggingface.co/Xenova/yolov8n/resolve/main/onnx/model.onnx
```

✅ **Configuration automatique** - Aucune modification nécessaire pour Vercel

✅ **Fonctionnement en local** - Le modèle se télécharge automatiquement au premier chargement

---

## 📥 Comment obtenir un modèle YOLO (développement local)

### Option 1 : Modèle YOLOv8 Nano (Test rapide)

Pour tester rapidement, téléchargez un modèle YOLOv8n pré-entraîné :

```bash
# Installer ultralytics
pip install ultralytics

# Exporter YOLOv8n en ONNX
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt').export(format='onnx')"

# Copier le fichier généré ici
cp yolov8n.onnx /path/to/projectSRP/public/models/
```

### Option 2 : Entraîner votre propre modèle (Recommandé)

Pour une détection optimale de documents, entraînez un modèle personnalisé :

#### 1. Préparez vos données

Créez un dataset avec des images de documents annotées :
- Format YOLO : fichiers .txt avec les bounding boxes
- Structure :
  ```
  dataset/
    images/
      train/
      val/
    labels/
      train/
      val/
    data.yaml
  ```

#### 2. Entraînez le modèle

```python
from ultralytics import YOLO

# Charger un modèle pré-entraîné
model = YOLO('yolov8n.pt')

# Entraîner sur votre dataset
results = model.train(
    data='dataset/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    name='document_detector'
)

# Exporter en ONNX
model.export(format='onnx')
```

#### 3. Copiez le modèle

```bash
cp runs/detect/document_detector/weights/best.onnx public/models/document_detector.onnx
```

### Option 3 : Utiliser DocLayout-YOLO (Spécialisé documents)

Téléchargez un modèle pré-entraîné pour l'analyse de layout de documents :

```bash
# Installer doclayout-yolo
pip install doclayout-yolo

# Télécharger depuis Hugging Face
# https://huggingface.co/wybxc/DocLayout-YOLO-DocStructBench-onnx
```

⚠️ **Note** : DocLayout-YOLO détecte les éléments de document (titre, paragraphe, image), pas les bords du document pour scanner.

## 📝 Configuration dans l'application

Une fois votre modèle .onnx copié dans ce dossier, mettez à jour le chemin dans `DocumentScannerView.js` :

```javascript
const MODEL_PATH = '/models/votre_modele.onnx';
```

## 🎯 Formats de sortie supportés

Le détecteur YOLO actuel supporte :
- **Object Detection** : Bounding boxes [x1, y1, x2, y2]
- **Conversion automatique** : Les bounding boxes sont converties en 4 coins pour le scanner

## 📊 Modèles recommandés

| Modèle | Taille | Vitesse | Précision | Usage |
|--------|--------|---------|-----------|-------|
| YOLOv8n | ~6 MB | ⚡⚡⚡ | ⭐⭐ | Test rapide |
| YOLOv8s | ~22 MB | ⚡⚡ | ⭐⭐⭐ | Production |
| YOLOv8m | ~50 MB | ⚡ | ⭐⭐⭐⭐ | Haute précision |
| Custom | Variable | Variable | ⭐⭐⭐⭐⭐ | Spécialisé documents |

## 🔗 Ressources utiles

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)
- [ONNX Model Zoo](https://github.com/onnx/models)
- [DocLayout-YOLO](https://github.com/opendatalab/DocLayout-YOLO)
- [Roboflow - Datasets](https://universe.roboflow.com/)

## ⚙️ Optimisation

Pour optimiser les performances :
- Utilisez un modèle nano (n) ou small (s) pour le web
- Réduisez la taille d'entrée si possible (320x320 au lieu de 640x640)
- Activez la quantification lors de l'export ONNX

```python
model.export(format='onnx', simplify=True, opset=12)
```
