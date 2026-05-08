// src/components/intervention/ImageGalleryOptimized.js
// Galerie optimisée avec pagination pour chargement rapide

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { XIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LoaderIcon } from '../SharedUI';
import { useDownload } from '../../hooks/useDownload';
import logger from '../../utils/logger';
import './ImageGallery.css';

/**
 * ImageThumbnail - Miniature optimisée avec IntersectionObserver
 * Affiche preview locale avec progression d'upload
 */
const ImageThumbnail = ({ src, alt, onClick, isLoading, status, progress = 0, index, onDelete }) => {
  const [loadState, setLoadState] = useState('idle');
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    if (!src || isLoading) return;

    // IntersectionObserver pour lazy loading agressif
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && loadState === 'idle') {
            setLoadState('loading');
            const img = new Image();
            img.onload = () => setLoadState('loaded');
            img.onerror = () => setLoadState('error');
            img.src = src;
          }
        });
      },
      {
        rootMargin: '100px', // Charger 100px avant que l'image soit visible
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, loadState, isLoading]);

  // Upload en cours - afficher la preview locale avec progression
  if (isLoading || status === 'uploading' || status === 'pending') {
    const progressPercent = Math.round(progress || 0);

    return (
      <div
        className="image-thumbnail"
        onClick={onClick}
        style={{ position: 'relative', overflow: 'hidden', background: '#1f2937' }}
      >
        {/* Afficher la preview locale en arrière-plan */}
        {src ? (
          <img
            src={src}
            alt={alt || 'Uploading...'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.6
            }}
          />
        ) : (
          /* Placeholder si pas de preview */
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#374151',
            color: '#9ca3af',
            fontSize: 24
          }}>
            📷
          </div>
        )}

        {/* Overlay avec progression */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: src ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}
        >
          {/* Cercle de progression */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: `conic-gradient(#0ea5a5 ${progressPercent * 3.6}deg, rgba(255,255,255,0.3) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 11,
                fontWeight: 600
              }}
            >
              {progressPercent}%
            </div>
          </div>

          {/* Texte */}
          <div style={{ color: 'white', fontSize: 10, fontWeight: 500 }}>
            Envoi...
          </div>
        </div>
      </div>
    );
  }

  // En attente de chargement
  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div ref={imgRef} className="image-thumbnail loading" onClick={onClick}>
        <div className="thumbnail-placeholder">
          <span>{index + 1}</span>
        </div>
      </div>
    );
  }

  // Erreur
  if (loadState === 'error') {
    return (
      <div className="image-thumbnail error" onClick={onClick}>
        <span>❌</span>
      </div>
    );
  }

  // Image chargée
  return (
    <div ref={imgRef} className="image-thumbnail" onClick={onClick}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
      />
      {onDelete && (
        <button
          className="thumbnail-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Supprimer cette image ?')) {
              onDelete();
            }
          }}
          title="Supprimer"
        >
          ✕
        </button>
      )}
    </div>
  );
};

/**
 * ImageGalleryOptimized - Galerie avec pagination
 */
const ImageGalleryOptimized = ({
  images,
  uploadQueue = [],
  emptyMessage = "Aucune photo. Ajoutez-en avec le bouton ci-dessous.",
  imagesPerPage = 12,
  onDeleteImage
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Combiner upload queue + images existantes
  const allItems = [
    ...uploadQueue.map((item, index) => {
      const mapped = {
        ...item,
        isUploading: item.status === 'uploading' || item.status === 'pending',
        id: item.id || `upload-${index}`
      };
      logger.log('Upload item mapped:', mapped.id, 'preview:', mapped.preview ? 'OK' : 'NULL', 'status:', mapped.status);
      return mapped;
    }),
    ...images.map((img, index) => ({
      ...img,
      isUploading: false,
      id: img.id || img.url || `image-${index}`
    }))
  ];

  // Debug
  if (uploadQueue.length > 0) {
    logger.log('ImageGalleryOptimized - uploadQueue:', uploadQueue.length, 'allItems:', allItems.length);
  }

  // Pagination
  const totalPages = Math.ceil(allItems.length / imagesPerPage);
  const startIndex = (currentPage - 1) * imagesPerPage;
  const endIndex = startIndex + imagesPerPage;
  const currentImages = allItems.slice(startIndex, endIndex);

  // Reset page si plus d'images
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const openLightbox = useCallback((index) => {
    // Index global dans toutes les images (pas juste la page actuelle)
    const globalIndex = startIndex + index;
    setLightboxIndex(globalIndex);
    setLightboxOpen(true);
  }, [startIndex]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // Affichage vide
  if (allItems.length === 0) {
    return (
      <div className="image-gallery-empty">
        <span className="empty-icon">📸</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Statistiques */}
      <div className="gallery-stats">
        <span className="gallery-count">
          {allItems.length} photo{allItems.length > 1 ? 's' : ''}
        </span>
        {uploadQueue.length > 0 && (
          <span className="gallery-uploading">
            {uploadQueue.length} en cours d'envoi...
          </span>
        )}
      </div>

      {/* Grille d'images */}
      <div className="image-gallery">
        {currentImages.map((item, index) => (
          <ImageThumbnail
            key={item.id}
            src={item.preview || item.url}
            alt={item.name}
            isLoading={item.isUploading}
            status={item.status}
            progress={item.progress}
            index={startIndex + index}
            onClick={() => !item.isUploading && openLightbox(index)}
            onDelete={!item.isUploading && onDeleteImage ? () => onDeleteImage(item) : null}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="gallery-pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            ← Précédent
          </button>
          <span className="pagination-info">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={images} // Seulement les images complètes (pas upload queue)
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
          onDelete={onDeleteImage}
        />
      )}
    </>
  );
};

/**
 * Lightbox - Vue plein écran simple et rapide
 */
const Lightbox = ({ images, initialIndex, onClose, onDelete }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentImage = images[currentIndex] || images[0];

  // Bloquer scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Navigation clavier
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, images.length]);

  // Reset loading
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  const handlePrevious = () => {
    setCurrentIndex((p) => (p === 0 ? images.length - 1 : p - 1));
  };

  const handleNext = () => {
    setCurrentIndex((p) => (p === images.length - 1 ? 0 : p + 1));
  };

  const { downloadFile } = useDownload();
  const [isDownloadingHD, setIsDownloadingHD] = useState(false);

  const handleDownload = async () => {
    await downloadFile(currentImage.url, currentImage.name || 'image.jpg');
  };

  const handleDownloadHD = async () => {
    if (!currentImage.originalUrl || isDownloadingHD) return;
    setIsDownloadingHD(true);
    try {
      const hdName = currentImage.name
        ? currentImage.name.replace(/(\.[^.]+)?$/, (_, ext) => `-HD${ext || '.jpg'}`)
        : 'image-HD.jpg';
      await downloadFile(currentImage.originalUrl, hdName);
    } finally {
      setIsDownloadingHD(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(currentImage);

      // Fermer le lightbox si c'était la dernière image
      if (images.length === 1) {
        onClose();
      } else {
        // Ajuster l'index si on supprime la dernière image
        if (currentIndex >= images.length - 1) {
          setCurrentIndex(Math.max(0, images.length - 2));
        }
      }
      setShowDeleteConfirm(false);
    } catch (error) {
      logger.error('Erreur suppression image:', error);
      alert('Erreur lors de la suppression de l\'image');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentImage) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lightbox-header">
          <div className="lightbox-title">
            <span className="lightbox-counter">
              {currentIndex + 1} / {images.length}
            </span>
            {currentImage.name && (
              <span className="lightbox-filename">{currentImage.name}</span>
            )}
          </div>
          <div className="lightbox-actions">
            <button className="lightbox-btn" onClick={handleDownload} title="Télécharger (qualité affichage)">
              <DownloadIcon />
            </button>
            {currentImage.originalUrl && (
              <button
                className="lightbox-btn lightbox-btn-hd"
                onClick={handleDownloadHD}
                disabled={isDownloadingHD}
                title="Télécharger en haute qualité (fichier original)"
              >
                {isDownloadingHD ? (
                  <LoaderIcon className="animate-spin" style={{ width: 16, height: 16 }} />
                ) : (
                  <>
                    <DownloadIcon />
                    <span className="hd-badge">HD</span>
                  </>
                )}
              </button>
            )}
            {onDelete && (
              <button
                className="lightbox-btn lightbox-btn-delete"
                onClick={() => setShowDeleteConfirm(true)}
                title="Supprimer"
                style={{ color: '#dc2626' }}
              >
                🗑️
              </button>
            )}
            <button className="lightbox-btn" onClick={onClose} title="Fermer">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="lightbox-image-container">
          {!imageLoaded && (
            <div className="lightbox-loading">
              <LoaderIcon className="animate-spin" />
            </div>
          )}
          <img
            src={currentImage.url}
            alt={currentImage.name}
            className={`lightbox-image ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
            draggable={false}
          />
        </div>

        {/* Navigation */}
        {images.length > 1 && (
          <>
            <button
              className="lightbox-nav lightbox-nav-prev"
              onClick={handlePrevious}
            >
              <ChevronLeftIcon />
            </button>
            <button
              className="lightbox-nav lightbox-nav-next"
              onClick={handleNext}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {/* Confirmation de suppression */}
      {showDeleteConfirm && (
        <div
          className="lightbox-delete-confirm"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
            zIndex: 10,
            maxWidth: '90%',
            width: '400px'
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600 }}>
            Confirmer la suppression
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280' }}>
            Voulez-vous vraiment supprimer cette image ? Cette action est irréversible.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                background: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '0.375rem',
                background: '#dc2626',
                color: 'white',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                opacity: isDeleting ? 0.6 : 1
              }}
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGalleryOptimized;
