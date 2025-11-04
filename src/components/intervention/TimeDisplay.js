// src/components/intervention/TimeDisplay.js
// Affichage temps écoulé avec chronomètre live

import React, { useState, useEffect } from 'react';
import './TimeDisplay.css';

const TimeDisplay = ({ arrivalTime, departureTime }) => {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!arrivalTime) {
      setIsRunning(false);
      setElapsed(0);
      return;
    }

    if (departureTime) {
      // Intervention terminée
      const start = new Date(arrivalTime);
      const end = new Date(departureTime);
      setElapsed(Math.floor((end - start) / 1000));
      setIsRunning(false);
      return;
    }

    // Intervention en cours
    setIsRunning(true);

    const calculateElapsed = () => {
      const start = new Date(arrivalTime);
      const now = new Date();
      setElapsed(Math.floor((now - start) / 1000));
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [arrivalTime, departureTime]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  if (!arrivalTime) {
    return (
      <div className="time-display time-display-empty">
        <div className="time-empty-icon">⏱️</div>
        <p className="time-empty-text">Cliquez sur "Arrivée" pour démarrer</p>
      </div>
    );
  }

  return (
    <div className={`time-display ${isRunning ? 'time-running' : 'time-completed'}`}>
      {/* Chronomètre Principal */}
      <div className="time-main">
        <div className="time-label">
          {isRunning ? (
            <>
              <span className="pulse-dot"></span>
              En cours
            </>
          ) : (
            'Terminé'
          )}
        </div>
        <div className={`time-value ${isRunning ? 'animate-pulse' : ''}`}>
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Détails */}
      <div className="time-details">
        <div className="time-detail">
          <div className="time-detail-label">Arrivée</div>
          <div className="time-detail-value">{formatDateTime(arrivalTime)}</div>
        </div>

        {departureTime && (
          <>
            <div className="time-separator">→</div>
            <div className="time-detail">
              <div className="time-detail-label">Départ</div>
              <div className="time-detail-value">{formatDateTime(departureTime)}</div>
            </div>
          </>
        )}
      </div>

      {/* Estimation */}
      {isRunning && elapsed > 0 && (
        <div className="time-estimation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          <span>
            {elapsed < 1800 && 'Intervention récente'}
            {elapsed >= 1800 && elapsed < 3600 && 'Pensez à faire une pause'}
            {elapsed >= 3600 && 'Intervention longue en cours'}
          </span>
        </div>
      )}
    </div>
  );
};

export default TimeDisplay;
