#!/usr/bin/env python3
"""
Script pour exporter un modèle YOLO en format ONNX
pour la détection de documents dans le navigateur

Usage:
    # Pour un modèle générique YOLOv8n (test rapide)
    python export_yolo_model.py --model yolov8n.pt

    # Pour votre modèle personnalisé
    python export_yolo_model.py --model path/to/your/best.pt --output document_detector.onnx

Requirements:
    pip install ultralytics onnx onnxruntime
"""

import argparse
from pathlib import Path
from ultralytics import YOLO


def export_yolo_to_onnx(model_path, output_path=None, img_size=640, simplify=True):
    """
    Exporte un modèle YOLO en format ONNX optimisé pour le web

    Args:
        model_path: Chemin vers le modèle .pt
        output_path: Nom du fichier ONNX de sortie (optionnel)
        img_size: Taille d'entrée du modèle (default: 640)
        simplify: Simplifier le graphe ONNX (default: True)
    """
    print(f"📦 Chargement du modèle: {model_path}")
    model = YOLO(model_path)

    print(f"🔄 Export en ONNX...")
    print(f"   - Taille d'entrée: {img_size}x{img_size}")
    print(f"   - Simplification: {simplify}")

    # Exporter en ONNX
    export_path = model.export(
        format='onnx',
        imgsz=img_size,
        simplify=simplify,
        opset=12,  # ONNX opset compatible avec onnxruntime-web
        dynamic=False  # Taille fixe pour de meilleures performances
    )

    # Renommer si un nom personnalisé est spécifié
    if output_path:
        export_file = Path(export_path)
        output_file = Path(output_path)
        export_file.rename(output_file)
        final_path = output_file
    else:
        final_path = Path(export_path)

    print(f"✅ Modèle exporté avec succès: {final_path}")
    print(f"📊 Taille du fichier: {final_path.stat().st_size / 1024 / 1024:.2f} MB")

    return final_path


def download_pretrained_model(model_name='yolov8n'):
    """
    Télécharge un modèle pré-entraîné YOLOv8

    Args:
        model_name: Nom du modèle (yolov8n, yolov8s, yolov8m, etc.)
    """
    print(f"📥 Téléchargement du modèle pré-entraîné: {model_name}")
    model = YOLO(f'{model_name}.pt')
    return f'{model_name}.pt'


def main():
    parser = argparse.ArgumentParser(
        description='Exporte un modèle YOLO en ONNX pour la détection de documents'
    )
    parser.add_argument(
        '--model',
        type=str,
        default='yolov8n.pt',
        help='Chemin vers le modèle YOLO (.pt)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='document_detector.onnx',
        help='Nom du fichier ONNX de sortie'
    )
    parser.add_argument(
        '--img-size',
        type=int,
        default=640,
        help='Taille d\'entrée du modèle (default: 640)'
    )
    parser.add_argument(
        '--no-simplify',
        action='store_true',
        help='Ne pas simplifier le graphe ONNX'
    )
    parser.add_argument(
        '--download',
        action='store_true',
        help='Télécharger un modèle pré-entraîné si non présent'
    )

    args = parser.parse_args()

    # Vérifier si le modèle existe, sinon le télécharger
    model_path = Path(args.model)
    if not model_path.exists() and args.download:
        model_name = model_path.stem
        download_pretrained_model(model_name)

    # Exporter le modèle
    try:
        onnx_path = export_yolo_to_onnx(
            args.model,
            args.output,
            args.img_size,
            not args.no_simplify
        )

        print("\n" + "="*60)
        print("🎉 Export terminé avec succès!")
        print("="*60)
        print(f"\n📁 Copiez le fichier vers votre projet:")
        print(f"   cp {onnx_path} /path/to/projectSRP/public/models/")
        print(f"\n🔧 Mettez à jour le chemin dans DocumentScannerView.js:")
        print(f"   const [yoloModelPath] = useState('/models/{onnx_path.name}');")
        print("\n💡 Pour entraîner un modèle personnalisé:")
        print("   1. Préparez un dataset annoté (format YOLO)")
        print("   2. Entraînez: model = YOLO('yolov8n.pt')")
        print("   3. model.train(data='dataset.yaml', epochs=100)")
        print("   4. Exportez: python export_yolo_model.py --model runs/detect/train/weights/best.pt")

    except Exception as e:
        print(f"❌ Erreur lors de l'export: {e}")
        return 1

    return 0


if __name__ == '__main__':
    exit(main())
