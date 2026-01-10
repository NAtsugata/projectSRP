// src/components/agenda/DraggableIntervention.js
// Wrapper pour rendre une intervention draggable (glisser-déposer)

import React from 'react';
import './DraggableIntervention.css';

/**
 * DraggableIntervention Component
 * Wrapper qui rend une intervention déplaçable par drag & drop
 *
 * @param {Object} intervention - L'intervention à rendre draggable
 * @param {Function} onDragStart - Callback appelé au début du drag
 * @param {Function} onDragEnd - Callback appelé à la fin du drag
 * @param {boolean} disabled - Désactiver le drag (ex: vue readonly)
 * @param {React.ReactNode} children - Le contenu à rendre draggable
 */
const DraggableIntervention = ({
  intervention,
  onDragStart,
  onDragEnd,
  disabled = false,
  children
}) => {
  const handleDragStart = (e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    // Ajouter une classe pour le style pendant le drag
    e.currentTarget.classList.add('dragging');

    // Stocker les données de l'intervention dans le dataTransfer
    const dragData = {
      interventionId: intervention.id,
      currentDate: intervention.date,
      currentTime: intervention.time,
      currentEmployeeId: intervention.employee_id,
      duration: intervention.duration || 1,
      type: intervention.type
    };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));

    // Créer une image de drag personnalisée
    const dragImage = e.currentTarget.cloneNode(true);
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(2deg)';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);

    // Nettoyer après un court délai
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    if (onDragStart) {
      onDragStart(intervention);
    }
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');

    if (onDragEnd) {
      onDragEnd(intervention);
    }
  };

  const handleDragOver = (e) => {
    // Empêcher le comportement par défaut pour permettre le drop
    e.preventDefault();
  };

  return (
    <div
      className={`draggable-intervention ${disabled ? 'drag-disabled' : ''}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      {children}
    </div>
  );
};

export default DraggableIntervention;
