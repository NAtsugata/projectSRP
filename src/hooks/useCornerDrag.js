// src/hooks/useCornerDrag.js
// Hook pour gérer le drag des coins dans le document scanner

import { useState, useCallback } from 'react';

/**
 * Hook pour gérer le déplacement des coins d'un quadrilatère
 * @param {React.RefObject} containerRef - Référence au conteneur (canvas/image)
 * @param {Function} setCorners - Setter pour mettre à jour les coins
 * @returns {Object} - Handlers et état du drag
 */
export const useCornerDrag = (containerRef, setCorners) => {
  const [draggedCorner, setDraggedCorner] = useState(null);

  const handleCornerMouseDown = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedCorner(index);
  }, []);

  const handleCornerTouchStart = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedCorner(index);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (draggedCorner === null || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggedCorner] = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
      return newCorners;
    });
  }, [draggedCorner, containerRef, setCorners]);

  const handleTouchMove = useCallback((e) => {
    if (draggedCorner === null || !containerRef.current) return;
    e.preventDefault();

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;

    setCorners(prev => {
      const newCorners = [...prev];
      newCorners[draggedCorner] = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
      return newCorners;
    });
  }, [draggedCorner, containerRef, setCorners]);

  const handleMouseUp = useCallback(() => {
    setDraggedCorner(null);
  }, []);

  return {
    draggedCorner,
    handleCornerMouseDown,
    handleCornerTouchStart,
    handleMouseMove,
    handleTouchMove,
    handleMouseUp
  };
};

export default useCornerDrag;
