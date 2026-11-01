import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { interventionDate, isUrgentIntervention, localDateKey, upcomingInterventions } from '../../utils/workspaceTracking';

export default function UpcomingInterventions({ interventions = [] }) {
  const [focus, setFocus] = useState('upcoming');
  const today = localDateKey();
  const rows = useMemo(() => upcomingInterventions(interventions, focus, today), [interventions, focus, today]);
  return (
    <section className="workspace-upcoming" aria-labelledby="workspace-upcoming-title">
      <div className="workspace-section-heading"><h3 id="workspace-upcoming-title">Suivi des interventions</h3><Link to="/planning">Tout voir →</Link></div>
      <div className="workspace-upcoming-tabs" aria-label="Filtrer le suivi">
        {[['upcoming', 'À venir'], ['today', 'Aujourd’hui'], ['urgent', 'Urgentes']].map(([value, label]) =>
          <button key={value} type="button" aria-pressed={focus === value} onClick={() => setFocus(value)}>{label}</button>)}
      </div>
      {rows.length ? <ul className="workspace-upcoming-list">{rows.slice(0, 5).map(item => {
        const date = interventionDate(item, today);
        const urgent = isUrgentIntervention(item);
        const inProgress = item.status === 'En cours' || Boolean(item.report?.arrivalTime);
        return <li key={item.id}><Link to={`/planning/${item.id}`} className="workspace-upcoming-row">
          <span className="workspace-upcoming-date">{date ? new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'À fixer'}<small>{item.time?.slice(0, 5) || 'Horaire à fixer'}</small></span>
          <span className="workspace-upcoming-name"><strong>{item.client || 'Client à préciser'}</strong><small>{[item.service, item.address].filter(Boolean).join(' · ') || 'Ouvrir la fiche intervention'}</small></span>
          <span className={`status-badge ${urgent ? 'status-danger' : inProgress ? 'status-warning' : 'status-info'}`}>{urgent ? 'Urgente' : inProgress ? 'En cours' : 'Planifiée'}</span>
          <span aria-hidden="true">›</span>
        </Link></li>;
      })}</ul> : <p className="workspace-upcoming-empty" role="status">{focus === 'urgent' ? 'Aucune intervention urgente.' : focus === 'today' ? 'Aucune intervention prévue aujourd’hui.' : 'Aucune intervention à venir.'}</p>}
    </section>
  );
}
