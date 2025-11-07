// src/components/intervention/ImageGallery.js
// Galerie d'images mobile-first avec lightbox, zoom et swipe

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { XIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LoaderIcon } from '../SharedUI';
import './ImageGallery.css';

/**
 * ImageThumbnail - Miniature avec loading state
 */
const ImageThumbnail = ({ src, alt, onClick, isLoading, status }) => {
  const [loadState, setLoadState] = useState('loading');
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) {
      setLoadState('error');
      return;
    }
    // Reset state quand src change
    setLoadState('loading');
    const img = new Image();
    img.onload = () => setLoadState('loaded');
    img.onerror = () => setLoadState('error');
    img.src = src;
  }, [src]);

  // Afficher le loader pour les uploads en cours
  if (isLoading || loadState === 'loading' || status === 'uploading' || status === 'pending') {
    return (
      <div className="image-thumbnail loading" onClick={onClick}>
        <LoaderIcon className="animate-spin" />
        {status === 'uploading' && (
          <div className="upload-badge">⬆️</div>
        )}
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="image-thumbnail error" onClick={onClick}>
        <span>❌</span>
      </div>
    );
  }

  return (
    <div className="image-thumbnail" onClick={onClick}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
      />
    </div>
  );
};

/**
 * Lightbox - Vue plein écran avec navigation
 */
const Lightbox = ({ images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentImage = images[currentIndex];

  // Bloquer le scroll du body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Reset loading state à chaque changement d'image
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Navigation clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, onClose]);

  // Swipe detection
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) handleNext();
    if (isRightSwipe) handlePrevious();
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = currentImage.name || 'image';
    link.click();
  };

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
            <button
              className="lightbox-btn"
              onClick={handleDownload}
              title="Télécharger"
            >
              <DownloadIcon />
            </button>
            <button
              className="lightbox-btn"
              onClick={onClose}
              title="Fermer (Échap)"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Image principale */}
        <div
          className="lightbox-image-container"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {!imageLoaded && (
            <div className="lightbox-loading">
              <LoaderIcon className="animate-spin" />
            </div>
          )}
          <img
            src={currentImage.url}
            alt={currentImage.name || 'Image'}
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
              aria-label="Image précédente"
            >
              <ChevronLeftIcon />
            </button>
            <button
              className="lightbox-nav lightbox-nav-next"
              onClick={handleNext}
              aria-label="Image suivante"
            >
              <ChevronRightIcon />
            </button>
          </>
        )}

        {/* Indicateurs */}
        {images.length > 1 && (
          <div className="lightbox-indicators">
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`lightbox-indicator ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Aller à l'image ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ImageGallery Component
 */
const ImageGallery = ({ images, uploadQueue = [], emptyMessage = 'Aucune image' }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // Combiner les images uploadées et en cours d'upload
  const allItems = [
    ...uploadQueue.map((item) => ({ ...item, isUploading: true })),
    ...images
  ];

  if (allItems.length === 0) {
    return (
      <div className="image-gallery-empty">
        <span className="empty-icon">📷</span>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="image-gallery">
        {allItems.map((item, index) => {
          const isUploadItem = index < uploadQueue.length;
          const imageIndex = index - uploadQueue.length;

          return (
            <ImageThumbnail
              key={item.id || item.url || index}
              src={item.preview || item.url}
              alt={item.name || `Image ${index + 1}`}
              onClick={() => !item.isUploading && !isUploadItem && imageIndex >= 0 && openLightbox(imageIndex)}
              isLoading={item.isUploading}
              status={item.status}
            />
          );
        })}
      </div>

      {lightboxOpen && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </>
  );
};

export default ImageGallery;
