#!/bin/bash
# Script pour télécharger et exporter le modèle YOLOv8n en ONNX

set -e

echo "🚀 Téléchargement et export de YOLOv8n en ONNX"
echo "=============================================="
echo ""

# Vérifier si Python et pip sont installés
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 n'est pas installé"
    exit 1
fi

# Vérifier/installer les dépendances
echo "📦 Vérification des dépendances Python..."
pip3 install -q ultralytics onnx onnxruntime 2>&1 | grep -v "already satisfied" || true

# Télécharger et exporter le modèle
echo "📥 Téléchargement de YOLOv8n..."
python3 export_yolo_model.py --model yolov8n.pt --output document_detector.onnx --download

# Vérifier que le fichier existe
if [ -f "document_detector.onnx" ]; then
    SIZE=$(du -h document_detector.onnx | cut -f1)
    echo ""
    echo "✅ Modèle YOLO exporté avec succès!"
    echo "📁 Fichier: document_detector.onnx ($SIZE)"
    echo ""
    echo "🎉 Vous pouvez maintenant utiliser YOLO dans le scanner!"
    echo "   1. Lancez l'application: npm start"
    echo "   2. Ouvrez le scanner de documents"
    echo "   3. Cliquez sur 'YOLO (IA)'"
else
    echo "❌ Erreur: Le modèle n'a pas été créé"
    exit 1
fi
