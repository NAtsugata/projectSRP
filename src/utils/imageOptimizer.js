// src/utils/imageOptimizer.js
// Optimisation avancée des images pour mobile

/**
 * Compresse une image de manière agressive pour mobile
 * @param {File} file - Fichier image
 * @param {Object} options - Options de compression
 * @returns {Promise<{full: File, thumbnail: Blob}>}
 */
export const optimizeImage = async (file, options = {}) => {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.7,
    thumbnailSize = 200
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // ✅ Nettoyage mémoire
      try {
        // 1. Calculer dimensions pour image full
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // 2. Créer image full compressée
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = '#FFFFFF'; // Fond blanc
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (fullBlob) => {
            if (!fullBlob) {
              reject(new Error('Échec compression image full'));
              return;
            }

            const fullFile = new File([fullBlob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });

            // 3. Créer thumbnail carré
            const thumbSize = thumbnailSize;
            const thumbCanvas = document.createElement('canvas');
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCanvas.width = thumbSize;
            thumbCanvas.height = thumbSize;

            // Crop au centre pour thumbnail carré
            const sourceSize = Math.min(img.width, img.height);
            const sourceX = (img.width - sourceSize) / 2;
            const sourceY = (img.height - sourceSize) / 2;

            thumbCtx.fillStyle = '#FFFFFF';
            thumbCtx.fillRect(0, 0, thumbSize, thumbSize);
            thumbCtx.drawImage(
              img,
              sourceX, sourceY, sourceSize, sourceSize,
              0, 0, thumbSize, thumbSize
            );

            thumbCanvas.toBlob(
              (thumbnailBlob) => {
                if (!thumbnailBlob) {
                  console.warn('Échec création thumbnail, on utilise full');
                  resolve({ full: fullFile, thumbnail: fullBlob });
                  return;
                }

                resolve({
                  full: fullFile,
                  thumbnail: thumbnailBlob,
                  dimensions: { width, height },
                  originalSize: file.size,
                  compressedSize: fullBlob.size,
                  thumbnailSize: thumbnailBlob.size
                });
              },
              'image/jpeg',
              0.5 // Qualité plus basse pour thumbnail
            );
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl); // ✅ Nettoyage mémoire en cas d'erreur
      reject(new Error('Erreur chargement image'));
    };

    img.src = objectUrl;
  });
};

/**
 * Compresse plusieurs images en parallèle
 * @param {File[]} files - Fichiers à compresser
 * @param {Function} onProgress - Callback progression (index, total)
 * @returns {Promise<Array>}
 */
export const optimizeImages = async (files, onProgress) => {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (!file.type.startsWith('image/')) {
      results.push({ file, isImage: false });
      continue;
    }

    try {
      const optimized = await optimizeImage(file);
      results.push({
        ...optimized,
        originalName: file.name,
        isImage: true
      });

      onProgress?.(i + 1, files.length);

      console.log(`✅ Image ${i + 1}/${files.length} optimisée:`, {
        nom: file.name,
        avant: (file.size / 1024).toFixed(1) + ' KB',
        après: (optimized.compressedSize / 1024).toFixed(1) + ' KB',
        thumbnail: (optimized.thumbnailSize / 1024).toFixed(1) + ' KB',
        ratio: ((1 - optimized.compressedSize / file.size) * 100).toFixed(0) + '% économisé'
      });
    } catch (error) {
      console.error(`❌ Erreur compression ${file.name}:`, error);
      results.push({ file, error: error.message, isImage: true });
    }
  }

  return results;
};

/**
 * Charge une image de manière progressive (thumbnail puis full)
 * @param {string} thumbnailUrl - URL du thumbnail
 * @param {string} fullUrl - URL de l'image complète
 * @param {Function} onLoad - Callback (isThumbnail, url)
 */
export const progressiveImageLoad = (thumbnailUrl, fullUrl, onLoad) => {
  // 1. Charger thumbnail d'abord
  if (thumbnailUrl) {
    const thumbImg = new Image();
    thumbImg.onload = () => {
      onLoad(true, thumbnailUrl);

      // 2. Charger image complète en background
      if (fullUrl && fullUrl !== thumbnailUrl) {
        const fullImg = new Image();
        fullImg.onload = () => {
          onLoad(false, fullUrl);
        };
        fullImg.src = fullUrl;
      }
    };
    thumbImg.src = thumbnailUrl;
  } else if (fullUrl) {
    // Pas de thumbnail, charger direct
    const img = new Image();
    img.onload = () => {
      onLoad(false, fullUrl);
    };
    img.src = fullUrl;
  }
};

/**
 * Estime le temps de chargement pour une image
 * @param {number} sizeBytes - Taille en bytes
 * @returns {string} - Estimation human-readable
 */
export const estimateLoadTime = (sizeBytes) => {
  // Vitesses réseau typiques (bytes/sec)
  const speeds = {
    '4G': 5 * 1024 * 1024,    // 5 MB/s
    '3G': 750 * 1024,          // 750 KB/s
    '2G': 150 * 1024,          // 150 KB/s
    'slow': 50 * 1024          // 50 KB/s
  };

  // On prend 3G comme référence (cas moyen mobile)
  const seconds = sizeBytes / speeds['3G'];

  if (seconds < 1) return 'Instantané';
  if (seconds < 2) return '~1 seconde';
  return `~${Math.ceil(seconds)} secondes`;
};
