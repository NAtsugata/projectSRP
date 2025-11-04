// src/components/intervention/TimeTrackerEnhanced.js
// Chronomètre avancé avec pause/reprise pour chantiers multi-jours

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangleIcon } from '../SharedUI';
import './TimeTrackerEnhanced.css';

/**
 * TimeTrackerEnhanced - Gestion complète du temps avec pause/reprise
 *
 * @param {Object} report - Rapport d'intervention avec timers
 * @param {Function} onUpdateReport - Callback pour mettre à jour le rapport
 * @param {boolean} disabled - Mode lecture seule
 */
const TimeTrackerEnhanced = ({ report, onUpdateReport, disabled = false }) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Mise à jour du timer chaque seconde
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // État actuel du chantier
  const status = useMemo(() => {
    if (report.departureTime) return 'completed';
    if (report.isPaused) return 'paused';
    if (report.arrivalTime) return 'running';
    return 'not_started';
  }, [report.arrivalTime, report.departureTime, report.isPaused]);

  // Calcul du temps total travaillé
  const timeStats = useMemo(() => {
    const pauses = report.pauseHistory || [];

    // Temps de pause total
    let totalPauseSeconds = 0;
    pauses.forEach(pause => {
      if (pause.start && pause.end) {
        const pauseDuration = (new Date(pause.end) - new Date(pause.start)) / 1000;
        totalPauseSeconds += pauseDuration;
      }
    });

    // Pause en cours
    if (report.isPaused && report.pauseStartedAt) {
      const currentPauseDuration = (currentTime - new Date(report.pauseStartedAt)) / 1000;
      totalPauseSeconds += currentPauseDuration;
    }

    // Temps total écoulé
    let totalElapsed = 0;
    if (report.arrivalTime) {
      const endTime = report.departureTime ? new Date(report.departureTime) : currentTime;
      totalElapsed = (endTime - new Date(report.arrivalTime)) / 1000;
    }

    // Temps travaillé = temps total - pauses
    const workedSeconds = Math.max(0, totalElapsed - totalPauseSeconds);

    return {
      totalElapsed: Math.floor(totalElapsed),
      totalPause: Math.floor(totalPauseSeconds),
      worked: Math.floor(workedSeconds),
      pauseCount: pauses.filter(p => p.start && p.end).length
    };
  }, [report.arrivalTime, report.departureTime, report.isPaused, report.pauseStartedAt, report.pauseHistory, currentTime]);

  // Format du temps (ex: 2h 34m 12s)
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  // Démarrer le chantier
  const handleStart = useCallback(async () => {
    const now = new Date().toISOString();
    const updated = {
      ...report,
      arrivalTime: now,
      isPaused: false,
      pauseHistory: []
    };
    await onUpdateReport(updated);
  }, [report, onUpdateReport]);

  // Mettre en pause
  const handlePause = useCallback(async () => {
    const now = new Date().toISOString();
    const updated = {
      ...report,
      isPaused: true,
      pauseStartedAt: now
    };
    await onUpdateReport(updated);
  }, [report, onUpdateReport]);

  // Reprendre
  const handleResume = useCallback(async () => {
    const now = new Date().toISOString();
    const pauseHistory = report.pauseHistory || [];

    // Ajouter la pause à l'historique
    if (report.pauseStartedAt) {
      pauseHistory.push({
        start: report.pauseStartedAt,
        end: now,
        duration: Math.floor((new Date(now) - new Date(report.pauseStartedAt)) / 1000)
      });
    }

    const updated = {
      ...report,
      isPaused: false,
      pauseStartedAt: null,
      pauseHistory
    };
    await onUpdateReport(updated);
  }, [report, onUpdateReport]);

  // Terminer le chantier
  const handleFinish = useCallback(async () => {
    // Si en pause, terminer la pause d'abord
    let updated = { ...report };

    if (report.isPaused && report.pauseStartedAt) {
      const now = new Date().toISOString();
      const pauseHistory = report.pauseHistory || [];
      pauseHistory.push({
        start: report.pauseStartedAt,
        end: now,
        duration: Math.floor((new Date(now) - new Date(report.pauseStartedAt)) / 1000)
      });
      updated.pauseHistory = pauseHistory;
      updated.isPaused = false;
      updated.pauseStartedAt = null;
    }

    updated.departureTime = new Date().toISOString();
    await onUpdateReport(updated);
  }, [report, onUpdateReport]);

  // Badge de statut
  const StatusBadge = () => {
    const badges = {
      not_started: { label: 'Non démarré', color: '#6b7280', icon: '⏸️' },
      running: { label: 'En cours', color: '#10b981', icon: '🔴' },
      paused: { label: 'En pause', color: '#f59e0b', icon: '⏸️' },
      completed: { label: 'Terminé', color: '#3b82f6', icon: '✓' }
    };

    const badge = badges[status];
    return (
      <div className="time-status-badge" style={{ background: badge.color }}>
        <span className={`status-icon ${status === 'running' ? 'pulse' : ''}`}>{badge.icon}</span>
        <span>{badge.label}</span>
      </div>
    );
  };

  return (
    <div className="time-tracker-enhanced">
      {/* Header avec statut */}
      <div className="tracker-header">
        <h3 className="tracker-title">⏱️ Suivi du temps</h3>
        <StatusBadge />
      </div>

      {/* Affichage du temps */}
      <div className="time-display-grid">
        {/* Temps travaillé (principal) */}
        <div className="time-card time-card-primary">
          <div className="time-card-label">Temps travaillé</div>
          <div className="time-card-value">{formatTime(timeStats.worked)}</div>
        </div>

        {/* Temps total écoulé */}
        <div className="time-card">
          <div className="time-card-label">Temps total</div>
          <div className="time-card-value">{formatTime(timeStats.totalElapsed)}</div>
        </div>

        {/* Temps de pause */}
        {timeStats.totalPause > 0 && (
          <div className="time-card">
            <div className="time-card-label">En pause</div>
            <div className="time-card-value">{formatTime(timeStats.totalPause)}</div>
            <div className="time-card-meta">{timeStats.pauseCount} pause(s)</div>
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      <div className="tracker-actions">
        {status === 'not_started' && (
          <button
            onClick={handleStart}
            disabled={disabled}
            className="btn-tracker btn-tracker-start"
          >
            <span className="btn-icon">▶️</span>
            Démarrer le chantier
          </button>
        )}

        {status === 'running' && (
          <>
            <button
              onClick={handlePause}
              disabled={disabled}
              className="btn-tracker btn-tracker-pause"
            >
              <span className="btn-icon">⏸️</span>
              Mettre en pause
            </button>
            <button
              onClick={handleFinish}
              disabled={disabled}
              className="btn-tracker btn-tracker-finish"
            >
              <span className="btn-icon">⏹️</span>
              Terminer
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button
              onClick={handleResume}
              disabled={disabled}
              className="btn-tracker btn-tracker-resume"
            >
              <span className="btn-icon">▶️</span>
              Reprendre le travail
            </button>
            <button
              onClick={handleFinish}
              disabled={disabled}
              className="btn-tracker btn-tracker-finish"
            >
              <span className="btn-icon">⏹️</span>
              Terminer quand même
            </button>
          </>
        )}
      </div>

      {/* Alerte pour chantiers longs */}
      {status === 'running' && timeStats.worked > 4 * 3600 && (
        <div className="tracker-alert">
          <AlertTriangleIcon />
          <div>
            <strong>Chantier long détecté</strong>
            <p>Si le chantier continue demain, pensez à le mettre en pause avant de partir.</p>
          </div>
        </div>
      )}

      {/* Historique des pauses */}
      {report.pauseHistory && report.pauseHistory.length > 0 && (
        <details className="pause-history">
          <summary>📋 Historique des pauses ({report.pauseHistory.length})</summary>
          <ul className="pause-list">
            {report.pauseHistory.map((pause, idx) => (
              <li key={idx} className="pause-item">
                <span className="pause-label">Pause #{idx + 1}</span>
                <span className="pause-duration">{formatTime(pause.duration)}</span>
                <span className="pause-time">
                  {new Date(pause.start).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {' → '}
                  {new Date(pause.end).toLocaleString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default TimeTrackerEnhanced;
