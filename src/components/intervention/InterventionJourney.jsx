import { CheckIcon } from '../SharedUI';
import { interventionJourney } from '../../utils/interventionJourney';
import './InterventionJourney.css';

const nextActions = ['Enregistrer mon arrivée', 'Ajouter les photos', 'Vérifier les contrôles', 'Compléter le rapport'];

export default function InterventionJourney({ report, status, onSelect, onArrival, busy }) {
  const { stages, completed, terminal, next } = interventionJourney(report, status);
  const action = terminal ? 'Voir le rapport' : completed === stages.length ? 'Vérifier et clôturer' : nextActions[next.tab];

  const handleNext = () => {
    if (!terminal && next.tab === 0 && !report.arrivalTime) onArrival();
    else onSelect(terminal ? 3 : next.tab);
  };

  return (
    <section className="intervention-journey" aria-labelledby="intervention-journey-title">
      <header>
        <h2 id="intervention-journey-title">Suivi de l’intervention</h2>
        <span>{completed} sur {stages.length}</span>
      </header>
      <progress max={stages.length} value={completed} aria-label="Étapes renseignées" />
      <ol>
        {stages.map(stage => (
            <li key={stage.tab}>
              <div className="journey-stage" aria-current={!terminal && !stage.done && next.tab === stage.tab ? 'step' : undefined}>
                <span className={`journey-stage-icon${stage.done ? ' is-done' : ''}`} aria-hidden="true">{stage.done && <CheckIcon />}</span>
                <span><strong>{stage.label}</strong><small>{stage.detail}</small></span>
              </div>
            </li>
        ))}
      </ol>
      <button type="button" className="journey-primary" disabled={busy} onClick={handleNext}>
        {action}
      </button>
    </section>
  );
}
