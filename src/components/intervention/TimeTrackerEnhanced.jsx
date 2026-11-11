import { useEffect, useState } from 'react';
import { CheckIcon } from '../SharedUI';
import { interventionTimeStats } from '../../utils/interventionTime';
import './TimeTrackerEnhanced.css';

const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dayAndTime = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function formatDate(value, formatter = clock) {
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? formatter.format(date) : '—';
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes === 0) return seconds > 0 ? '< 1 min' : '0 min';
  const hours = Math.floor(minutes / 60);
  return hours ? hours + ' h ' + String(minutes % 60).padStart(2, '0') : minutes + ' min';
}

export default function TimeTrackerEnhanced({ report, onAction, busy, disabled, error }) {
  const [now, setNow] = useState(Date.now);
  const { arrivalTime, departureTime, isPaused, arrivalGeo, departureGeo } = report;
  const live = Boolean(arrivalTime && !departureTime);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  const stats = interventionTimeStats(report, now);
  const status = departureTime ? 'Départ enregistré' : !arrivalTime ? 'À venir' : isPaused ? 'En pause' : 'En cours';
  const action = !arrivalTime ? 'arrival' : isPaused ? 'resume' : 'pause';
  const actionLabel = { arrival: 'Enregistrer l’arrivée', resume: 'Reprendre le travail', pause: 'Mettre en pause' }[action];
  const events = [
    { label: 'Arrivée', value: arrivalTime, geo: arrivalGeo },
    { label: 'Départ', value: departureTime, geo: departureGeo },
  ];
  const pauses = Array.isArray(report.pauseHistory) ? report.pauseHistory : [];

  return (
    <section className="site-time" id="time-section" aria-labelledby="site-time-title" aria-busy={busy}>
      <header className="site-time-heading">
        <h3 id="site-time-title">Temps sur site</h3>
        <span className="site-time-status" data-state={live && !isPaused ? 'running' : undefined}>{status}</span>
      </header>

      <dl className="site-time-events">
        {events.map(({ label, value, geo }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="site-time-event-dot" data-recorded={Boolean(value)} aria-hidden="true">{value && <CheckIcon />}</span>
              <span>{formatDate(value)}</span>
              {geo && Number.isFinite(geo.acc) && <small>GPS ±{Math.round(geo.acc)} m</small>}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="site-time-totals">
        <div><dt>Temps travaillé</dt><dd>{formatDuration(stats?.worked)}</dd></div>
        <div><dt>Temps sur site</dt><dd>{formatDuration(stats?.elapsed)}</dd></div>
      </dl>

      {error && <p className="site-time-error" role="alert">{error}</p>}
      {!departureTime && !disabled && (
        <div className="site-time-actions">
          <button className="site-time-primary" type="button" disabled={busy} onClick={() => onAction(action)}>
            {busy ? 'Enregistrement…' : actionLabel}
          </button>
          {arrivalTime && (
            <button className="site-time-secondary" type="button" disabled={busy} onClick={() => onAction('departure')}>
              Enregistrer le départ
            </button>
          )}
        </div>
      )}

      {live && !isPaused && stats?.worked > 4 * 3600 && <p className="site-time-hint">Si le chantier continue demain, mettez le compteur en pause avant de partir.</p>}
      {pauses.length > 0 && (
        <details className="site-time-history">
          <summary>Historique des pauses ({pauses.length})</summary>
          <ul>{pauses.map((pause, index) => (
            <li key={index}>{formatDate(pause?.start, dayAndTime)} → {formatDate(pause?.end, dayAndTime)} <strong>{formatDuration(pause?.duration)}</strong></li>
          ))}</ul>
        </details>
      )}
    </section>
  );
}
