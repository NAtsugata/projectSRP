// src/components/agenda/DroppableTimeSlot.js
// Zone de drop pour recevoir les interventions déplacées

import React, { useState } from 'react';
import './DroppableTimeSlot.css';

/**
 * DroppableTimeSlot Component
 * Zone de drop pour créneaux horaires qui peut recevoir des interventions
 *
 * @param {string} date - Date du créneau (format YYYY-MM-DD)
 * @param {string} time - Heure du créneau (format HH:MM)
 * @param {string} employeeId - ID de l'employé pour ce créneau
 * @param {Function} onDrop - Callback appelé quand une intervention est déposée
 * @param {Function} onValidateDrop - Callback pour valider si le drop est autorisé
 * @param {boolean} disabled - Désactiver le drop
 * @param {React.ReactNode} children - Le contenu de la zone
 */
const DroppableTimeSlot = ({
  date,
  time,
  employeeId,
  onDrop,
  onValidateDrop,
  disabled = false,
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [canDrop, setCanDrop] = useState(true);

  const handleDragEnter = (e) => {
    e.preventDefault();
    if (disabled) return;

    setIsDragOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disabled) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';

    // Valider si le drop est autorisé
    if (onValidateDrop) {
      try {
        const dragData = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
        const isValid = onValidateDrop({
          interventionId: dragData.interventionId,
          targetDate: date,
          targetTime: time,
          targetEmployeeId: employeeId,
          currentDate: dragData.currentDate,
          currentTime: dragData.currentTime,
          currentEmployeeId: dragData.currentEmployeeId
        });
        setCanDrop(isValid !== false);
      } catch (err) {
        setCanDrop(true);
      }
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();

    // Vérifier que l'on quitte vraiment la zone (pas juste un enfant)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (
      x <= rect.left ||
      x >= rect.right ||
      y <= rect.top ||
      y >= rect.bottom
    ) {
      setIsDragOver(false);
      setCanDrop(true);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOver(false);
    setCanDrop(true);

    if (disabled) return;

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json'));

      // Vérifier qu'on ne drop pas sur le même emplacement
      if (
        dragData.currentDate === date &&
        dragData.currentTime === time &&
        dragData.currentEmployeeId === employeeId
      ) {
        return;
      }

      // Valider avant de drop
      if (onValidateDrop) {
        const isValid = onValidateDrop({
          interventionId: dragData.interventionId,
          targetDate: date,
          targetTime: time,
          targetEmployeeId: employeeId,
          currentDate: dragData.currentDate,
          currentTime: dragData.currentTime,
          currentEmployeeId: dragData.currentEmployeeId
        });

        if (isValid === false) {
          return;
        }
      }

      // Appeler le callback de drop
      if (onDrop) {
        onDrop({
          interventionId: dragData.interventionId,
          targetDate: date,
          targetTime: time,
          targetEmployeeId: employeeId,
          sourceDate: dragData.currentDate,
          sourceTime: dragData.currentTime,
          sourceEmployeeId: dragData.currentEmployeeId
        });
      }
    } catch (err) {
      console.error('Erreur lors du drop:', err);
    }
  };

  const className = [
    'droppable-time-slot',
    isDragOver ? 'drag-over' : '',
    disabled ? 'drop-disabled' : '',
    isDragOver && !canDrop ? 'drop-invalid' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-date={date}
      data-time={time}
      data-employee-id={employeeId}
    >
      {children}
      {isDragOver && (
        <div className="drop-indicator">
          {canDrop ? (
            <>
              <div className="drop-icon">📌</div>
              <div className="drop-text">Déposer ici</div>
            </>
          ) : (
            <>
              <div className="drop-icon">🚫</div>
              <div className="drop-text">Conflit détecté</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DroppableTimeSlot;
