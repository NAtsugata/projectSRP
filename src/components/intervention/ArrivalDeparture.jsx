// src/components/intervention/ArrivalDeparture.jsx
// Interface modernisée pour marquer arrivée et départ

import React from 'react';
import './ArrivalDeparture.css';

const ArrivalDeparture = ({ report, onMarkArrival, onMarkDeparture, disabled = false }) => {
  const { arrivalTime, departureTime, arrivalGeo, departureGeo } = report || {};

  const formatTime = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  };

  const calculateDuration = () => {
    if (!arrivalTime) return null;
    const now = departureTime ? new Date(departureTime) : new Date();
    const start = new Date(arrivalTime);
    const diff = Math.floor((now - start) / 1000 / 60); // minutes
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
  };

  const duration = calculateDuration();

  return (
    <div className="arrival-departure-container">
      <h3 className="section-title">⏱️ Temps sur site</h3>

      {/* Arrivée */}
      <div className={`time-card ${arrivalTime ? 'completed' : ''}`}>
        <div className="time-card-icon">
          {arrivalTime ? '✅' : '⏸️'}
        </div>
        <div className="time-card-content">
          <div className="time-card-header">
            <span className="time-label">Arrivée sur site</span>
            {arrivalTime && (
              <span className="time-value">{formatTime(arrivalTime)}</span>
            )}
          </div>
          {arrivalGeo && (
            <div className="geo-info">
              📍 Précision ±{Math.round(arrivalGeo.acc || 0)}m
            </div>
          )}
          {!arrivalTime && (
            <button
              className="time-action-btn arrival-btn"
              onClick={onMarkArrival}
              disabled={disabled}
            >
              🚀 Marquer l'arrivée
            </button>
          )}
        </div>
      </div>

      {/* Durée */}
      {duration && (
        <div className="duration-display">
          <span className="duration-icon">⏱️</span>
          <span className="duration-value">{duration}</span>
          {!departureTime && <span className="duration-label">(en cours)</span>}
        </div>
      )}

      {/* Départ */}
      <div className={`time-card ${departureTime ? 'completed' : ''} ${!arrivalTime ? 'disabled' : ''}`}>
        <div className="time-card-icon">
          {departureTime ? '✅' : !arrivalTime ? '⏸️' : '🕐'}
        </div>
        <div className="time-card-content">
          <div className="time-card-header">
            <span className="time-label">Départ du site</span>
            {departureTime && (
              <span className="time-value">{formatTime(departureTime)}</span>
            )}
          </div>
          {departureGeo && (
            <div className="geo-info">
              📍 Précision ±{Math.round(departureGeo.acc || 0)}m
            </div>
          )}
          {!departureTime && arrivalTime && (
            <button
              className="time-action-btn departure-btn"
              onClick={onMarkDeparture}
              disabled={disabled}
            >
              🏁 Marquer le départ
            </button>
          )}
          {!arrivalTime && (
            <div className="time-hint">
              Attendez d'être arrivé sur site
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArrivalDeparture;
