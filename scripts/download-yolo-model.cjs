#!/usr/bin/env node
/**
 * Script pour télécharger le modèle YOLO pendant le build Vercel
 * Télécharge depuis GitHub Releases d'Ultralytics
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Modèle YOLO depuis ONNX Model Zoo (Microsoft)
// Alternative: YOLOv8n depuis un autre CDN fiable
const MODEL_URL = 'https://storage.googleapis.com/ailia-models/yolov8/yolov8n.onnx';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'models');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'document_detector.onnx');

console.log('🚀 Téléchargement du modèle YOLO pour la détection de documents...');

// Vérifier si le fichier existe déjà
if (fs.existsSync(OUTPUT_FILE)) {
  const stats = fs.statSync(OUTPUT_FILE);
  if (stats.size > 1000000) { // > 1 MB
    console.log('✅ Modèle YOLO déjà présent et valide (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB)');
    process.exit(0);
  } else {
    console.log('⚠️  Fichier existant invalide, re-téléchargement...');
    fs.unlinkSync(OUTPUT_FILE);
  }
}

// Créer le dossier si nécessaire
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Fonction pour suivre les redirections
function downloadFile(url, dest, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error('❌ Trop de redirections');
    process.exit(1);
  }

  const file = fs.createWriteStream(dest);
  let downloadedSize = 0;
  let totalSize = 0;

  https.get(url, (response) => {
    // Gérer les redirections
    if (response.statusCode === 301 || response.statusCode === 302) {
      const redirectUrl = response.headers.location;
      console.log(`🔄 Redirection vers: ${redirectUrl}`);
      file.close();
      fs.unlinkSync(dest);
      return downloadFile(redirectUrl, dest, redirectCount + 1);
    }

    if (response.statusCode !== 200) {
      console.error(`❌ Erreur HTTP: ${response.statusCode}`);
      file.close();
      fs.unlinkSync(dest);
      process.exit(1);
    }

    totalSize = parseInt(response.headers['content-length'], 10);
    console.log(`📦 Taille du fichier: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
      process.stdout.write(`\r⏳ Téléchargement: ${progress}%`);
    });

    response.pipe(file);

    file.on('finish', () => {
      file.close();
      process.stdout.write('\n');

      // Vérifier la taille du fichier téléchargé
      const stats = fs.statSync(dest);
      if (stats.size < 1000000) {
        console.error('❌ Fichier téléchargé trop petit (probablement invalide)');
        fs.unlinkSync(dest);
        process.exit(1);
      }

      console.log(`✅ Modèle YOLO téléchargé avec succès! (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`📁 Emplacement: ${OUTPUT_FILE}`);
    });

  }).on('error', (err) => {
    file.close();
    fs.unlinkSync(dest);
    console.error('❌ Erreur de téléchargement:', err.message);
    process.exit(1);
  });
}

downloadFile(MODEL_URL, OUTPUT_FILE);
