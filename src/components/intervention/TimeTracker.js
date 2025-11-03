// src/components/intervention/TimeTracker.js
// Composant pour tracker les heures d'arrivée/départ avec géolocalisation

import React, { useState } from 'react';
import { Button, LoadingSpinner } from '../ui';
import { useGeolocation } from '../../hooks/useGeolocation';
import { CheckCircleIcon, MapPinIcon, AlertTriangleIcon } from '../SharedUI';
import './TimeTracker.css';

/**
 * Composant TimeTracker
 * @param {string} type - 'arrival' | 'departure'
 * @param {string} time - Heure ISO ou null
 * @param {Object} geo - Données de géolocalisation
 * @param {Function} onMark - Callback (time, geo)
 * @param {Function} onUnmark - Callback
 */
const TimeTracker = ({ type, time, geo, onMark, onUnmark }) => {
  const { requestPosition, loading: geoLoading, formatPosition } = useGeolocation();
  const [error, setError] = useState(null);

  const isArrival = type === 'arrival';
  const label = isArrival ? 'Arrivée' : 'Départ';
  const icon = '📍';

  const handleMark = async () => {
    setError(null);

    try {
      // Obtenir la géolocalisation
      const { data: position, error: geoError } = await requestPosition();

      if (geoError) {
        setError(`Impossible d'obtenir la position: ${geoError.message}`);
        // Continuer sans géolocalisation
      }

      // Marquer avec l'heure actuelle
      const currentTime = new Date().toISOString();
      onMark(currentTime, position);
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    }
  };

  const handleUnmark = () => {
    setError(null);
    onUnmark();
  };

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  const formattedPosition = geo ? formatPosition(geo) : null;

  return (
    <div className="time-tracker">
      <div className="time-tracker-header">
        <h4 className="time-tracker-title">
          {icon} {label}
        </h4>

        {time ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnmark}
            aria-label={`Annuler ${label.toLowerCase()}`}
          >
            Annuler
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleMark}
            loading={geoLoading}
            disabled={geoLoading}
            aria-label={`Marquer ${label.toLowerCase()}`}
          >
            {geoLoading ? 'GPS...' : `Marquer ${label.toLowerCase()}`}
          </Button>
        )}
      </div>

      {time && (
        <div className="time-tracker-info">
          <div className="time-tracker-time">
            <CheckCircleIcon className="time-tracker-icon success" aria-hidden="true" />
            <div>
              <p className="time-tracker-label">Heure</p>
              <p className="time-tracker-value">{formatTime(time)}</p>
            </div>
          </div>

          {formattedPosition && (
            <div className="time-tracker-geo">
              <MapPinIcon className="time-tracker-icon" aria-hidden="true" />
              <div>
                <p className="time-tracker-label">Position</p>
                <p className="time-tracker-value">
                  <a
                    href={formattedPosition.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="time-tracker-link"
                    aria-label="Voir la position sur Google Maps"
                  >
                    {formattedPosition.display}
                  </a>
                  <span className="time-tracker-accuracy">
                    {formattedPosition.accuracy}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="time-tracker-error" role="alert">
          <AlertTriangleIcon className="time-tracker-icon" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {geoLoading && (
        <div className="time-tracker-loading">
          <LoadingSpinner size="sm" text="Récupération de la position GPS..." />
        </div>
      )}
    </div>
  );
};

export default TimeTracker;
