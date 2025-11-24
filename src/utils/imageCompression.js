/**
 * Utilitaire de compression d'images pour mobile
 * Réduit la taille des images avant upload pour économiser la bande passante
 */

/**
 * Compresse une image en réduisant sa résolution et sa qualité
 * @param {File} file - Fichier image à compresser
 * @param {Object} options - Options de compression
 * @param {number} options.maxSizeMB - Taille maximale en MB (défaut: 1)
 * @param {number} options.maxWidthOrHeight - Dimension maximale (défaut: 1920)
 * @param {number} options.initialQuality - Qualité initiale (défaut: 0.9)
 * @returns {Promise<File>} - Fichier compressé
 */
export const compressImage = async (file, options = {}) => {
    const {
        maxSizeMB = 1,
        maxWidthOrHeight = 1920,
        initialQuality = 0.9
    } = options;

    // Vérifier si c'est une image
    if (!file.type.startsWith('image/')) {
        console.warn('Le fichier n\'est pas une image, compression ignorée');
        return file;
    }

    // Si l'image est déjà petite, ne pas compresser
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB <= maxSizeMB) {
        console.log(`Image déjà optimale (${fileSizeMB.toFixed(2)}MB), compression ignorée`);
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => {
            reject(new Error('Erreur de lecture du fichier'));
        };

        reader.onload = (e) => {
            const img = new Image();

            img.onerror = () => {
                reject(new Error('Erreur de chargement de l\'image'));
            };

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Redimensionner si trop grand
                    if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
                        if (width > height) {
                            height = (height / width) * maxWidthOrHeight;
                            width = maxWidthOrHeight;
                        } else {
                            width = (width / height) * maxWidthOrHeight;
                            height = maxWidthOrHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');

                    // Améliorer la qualité du redimensionnement
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.drawImage(img, 0, 0, width, height);

                    // Fonction pour compresser avec une qualité donnée
                    const compressWithQuality = (quality) => {
                        return new Promise((resolveBlob) => {
                            canvas.toBlob(
                                (blob) => {
                                    if (!blob) {
                                        reject(new Error('Erreur de création du blob'));
                                        return;
                                    }
                                    resolveBlob(blob);
                                },
                                'image/jpeg',
                                quality
                            );
                        });
                    };

                    // Compresser progressivement jusqu'à atteindre la taille cible
                    const compressIteratively = async () => {
                        let quality = initialQuality;
                        let blob = await compressWithQuality(quality);

                        // Réduire la qualité jusqu'à atteindre la taille cible
                        while (blob.size / (1024 * 1024) > maxSizeMB && quality > 0.1) {
                            quality -= 0.1;
                            blob = await compressWithQuality(quality);
                        }

                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });

                        const originalSizeMB = file.size / (1024 * 1024);
                        const compressedSizeMB = compressedFile.size / (1024 * 1024);
                        const reduction = ((1 - compressedSizeMB / originalSizeMB) * 100).toFixed(1);

                        console.log(`✅ Image compressée: ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB (${reduction}% de réduction)`);

                        resolve(compressedFile);
                    };

                    compressIteratively().catch(reject);

                } catch (error) {
                    reject(error);
                }
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
};

/**
 * Compresse plusieurs images en parallèle
 * @param {File[]} files - Tableau de fichiers
 * @param {Object} options - Options de compression
 * @returns {Promise<File[]>} - Tableau de fichiers compressés
 */
export const compressImages = async (files, options = {}) => {
    const compressionPromises = files.map(file =>
        compressImage(file, options).catch(error => {
            console.error(`Erreur compression ${file.name}:`, error);
            return file; // Retourner le fichier original en cas d'erreur
        })
    );

    return Promise.all(compressionPromises);
};

/**
 * Estime la taille après compression
 * @param {File} file - Fichier image
 * @param {Object} options - Options de compression
 * @returns {Promise<Object>} - Informations sur la compression estimée
 */
export const estimateCompression = async (file, options = {}) => {
    const { maxSizeMB = 1 } = options;

    const originalSizeMB = file.size / (1024 * 1024);

    if (!file.type.startsWith('image/')) {
        return {
            willCompress: false,
            originalSize: originalSizeMB,
            estimatedSize: originalSizeMB,
            reduction: 0
        };
    }

    if (originalSizeMB <= maxSizeMB) {
        return {
            willCompress: false,
            originalSize: originalSizeMB,
            estimatedSize: originalSizeMB,
            reduction: 0
        };
    }

    // Estimation basée sur des moyennes observées
    const estimatedSize = Math.min(maxSizeMB, originalSizeMB * 0.3);
    const reduction = ((1 - estimatedSize / originalSizeMB) * 100);

    return {
        willCompress: true,
        originalSize: originalSizeMB,
        estimatedSize,
        reduction
    };
};

export default {
    compressImage,
    compressImages,
    estimateCompression
};
