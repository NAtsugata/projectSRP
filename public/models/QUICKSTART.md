# 🚀 Guide de Démarrage Rapide - YOLO Document Detection

Ce guide vous aide à tester rapidement la détection YOLO dans votre scanner de documents.

## Option 1 : Test Rapide avec YOLOv8n (Recommandé pour débuter)

### Étape 1 : Installer les dépendances Python

```bash
pip install ultralytics onnx onnxruntime
```

### Étape 2 : Exporter un modèle YOLOv8n

Le script téléchargera automatiquement YOLOv8n (6MB) et l'exportera en ONNX :

```bash
cd public/models
python export_yolo_model.py --model yolov8n.pt --download
```

Cela créera `document_detector.onnx` dans le dossier actuel.

### Étape 3 : Tester dans l'application

1. Lancez votre application React : `npm start`
2. Ouvrez le scanner de documents
3. Cliquez sur **"YOLO (IA)"** pour activer le détecteur YOLO
4. Vous devriez voir **"🤖 YOLO"** en haut à droite de la caméra
5. Pointez vers un document et testez !

---

## Option 2 : Entraîner un Modèle Personnalisé (Pour meilleurs résultats)

### Pourquoi un modèle personnalisé ?

- ✅ Détection spécifique aux documents
- ✅ Meilleure précision
- ✅ Moins de faux positifs
- ✅ Reconnaissance de vos types de documents

### Étape 1 : Préparer le dataset

Créez un dataset annoté de documents :

```
my_document_dataset/
  images/
    train/
      doc001.jpg
      doc002.jpg
      ...
    val/
      doc051.jpg
      doc052.jpg
      ...
  labels/
    train/
      doc001.txt  # Format YOLO: class x_center y_center width height
      doc002.txt
      ...
    val/
      doc051.txt
      doc052.txt
      ...
  data.yaml
```

**data.yaml** :
```yaml
path: /path/to/my_document_dataset
train: images/train
val: images/val

nc: 1  # Nombre de classes (1 = document)
names: ['document']
```

### Étape 2 : Annoter vos images

Utilisez l'un de ces outils :
- [Roboflow](https://roboflow.com/) - Interface web facile
- [LabelImg](https://github.com/heartexlabs/labelImg) - Outil desktop
- [CVAT](https://cvat.org/) - Annotation collaborative

### Étape 3 : Entraîner le modèle

```python
from ultralytics import YOLO

# Charger un modèle pré-entraîné comme base
model = YOLO('yolov8n.pt')  # ou yolov8s.pt pour plus de précision

# Entraîner sur votre dataset
results = model.train(
    data='my_document_dataset/data.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    patience=50,
    device=0  # 0 = GPU, 'cpu' = CPU
)

# Le meilleur modèle sera sauvegardé dans:
# runs/detect/train/weights/best.pt
```

### Étape 4 : Exporter en ONNX

```bash
python export_yolo_model.py \
  --model runs/detect/train/weights/best.pt \
  --output my_document_detector.onnx
```

### Étape 5 : Utiliser votre modèle

1. Copiez le fichier ONNX : `cp my_document_detector.onnx public/models/`
2. Mettez à jour `DocumentScannerView.js` ligne 34 :
   ```javascript
   const [yoloModelPath] = useState('/models/my_document_detector.onnx');
   ```
3. Redémarrez l'application

---

## Option 3 : Utiliser un Modèle Pré-entraîné Existant

### DocLayout-YOLO (Spécialisé pour documents)

⚠️ **Note** : DocLayout-YOLO détecte les **éléments** de documents (titres, paragraphes, images), pas les **bords** du document. Il n'est donc **pas adapté** pour un scanner de documents.

Si vous voulez quand même l'essayer :

```bash
pip install doclayout-yolo

# Télécharger le modèle
wget https://huggingface.co/wybxc/DocLayout-YOLO-DocStructBench-onnx/resolve/main/model.onnx -O doclayout.onnx
```

---

## 🐛 Dépannage

### Le modèle ne se charge pas

**Erreur** : `Failed to load ONNX model`

**Solutions** :
1. Vérifiez que le fichier existe : `ls -lh public/models/document_detector.onnx`
2. Vérifiez le chemin dans `DocumentScannerView.js`
3. Regardez la console du navigateur (F12) pour plus de détails
4. Assurez-vous que le modèle est bien au format ONNX (opset 12)

### Le modèle est trop lent

**Solutions** :
1. Utilisez YOLOv8n (nano) au lieu de m ou l
2. Réduisez la taille d'entrée :
   ```python
   python export_yolo_model.py --model yolov8n.pt --img-size 320
   ```
3. Le GPU (WebGL) est automatiquement utilisé quand disponible

### Pas de détection

**Solutions** :
1. Vérifiez que vous utilisez bien un modèle entraîné pour détecter des documents
2. YOLOv8n générique détecte 80 classes d'objets mais **pas de documents**
3. Pour de vrais résultats, entraînez un modèle personnalisé (Option 2)

### Fallback vers OpenCV

Si YOLO échoue au chargement, l'application revient automatiquement à OpenCV.

---

## 📊 Comparaison des Options

| Option | Temps Setup | Précision | Vitesse | Recommandation |
|--------|-------------|-----------|---------|----------------|
| **YOLOv8n générique** | 5 min | ⭐⭐ | ⚡⚡⚡ | Test rapide uniquement |
| **Modèle personnalisé** | 2-4h | ⭐⭐⭐⭐⭐ | ⚡⚡ | **Production** ✅ |
| **OpenCV actuel** | 0 min | ⭐⭐⭐ | ⚡⚡⚡ | Backup / Fallback |

---

## 🎯 Prochaines Étapes

1. **Testez avec YOLOv8n** pour voir l'infrastructure fonctionner
2. **Collectez des images** de vos documents typiques
3. **Annotez 100-200 images** pour l'entraînement
4. **Entraînez votre modèle** personnalisé
5. **Profitez** d'une détection de documents ultra-précise ! 🎉

---

## 💡 Conseils Pro

- **Dataset varié** : Différents angles, éclairages, types de documents
- **Augmentation de données** : Ultralytics fait ça automatiquement
- **Validation** : Gardez 20% de vos images pour la validation
- **Itération** : Ajoutez des images problématiques au dataset et re-entraînez

---

## 📚 Ressources

- [Documentation Ultralytics](https://docs.ultralytics.com/)
- [YOLO Training Tutorial](https://docs.ultralytics.com/modes/train/)
- [Roboflow Tutorials](https://blog.roboflow.com/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)

**Besoin d'aide ?** Ouvrez une issue sur GitHub ou consultez la documentation !
