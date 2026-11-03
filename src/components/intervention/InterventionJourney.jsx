import { interventionJourney } from '../../utils/interventionJourney';
import StatusBadge from '../ui/StatusBadge';
import './InterventionJourney.css';
export default function InterventionJourney({report,status,activeTab,onSelect,onArrival,busy}){
 const {stages,completed,terminal,next}=interventionJourney(report,status);
 const act=()=>{if(next.tab===0&&!report.arrivalTime)onArrival();else onSelect(next.tab);};
 const action=terminal?'Consulter le rapport':next.tab===0?'Enregistrer mon arrivée':next.tab===1?'Ajouter les photos':next.tab===2?'Vérifier les contrôles':completed===4?'Vérifier et terminer':'Compléter le rapport';
 return <section className="intervention-journey" aria-label="Mon parcours d’intervention"><header><div><small>MON PARCOURS</small><h2>{terminal?'Intervention clôturée':'Une étape à la fois'}</h2></div><StatusBadge status={status}/></header>
 <div className="journey-progress"><span>{completed} étape{completed>1?'s':''} renseignée{completed>1?'s':''} sur 4</span><progress max="4" value={completed} aria-label="Étapes renseignées"/></div>
 <ol>{stages.map((stage,i)=><li key={stage.label}><button type="button" aria-current={activeTab===stage.tab?'step':undefined} onClick={()=>onSelect(stage.tab)}><span className={`journey-number ${stage.done?'is-done':''}`}>{stage.done?'✓':i+1}</span><span><strong>{stage.label}</strong><small>{stage.detail}</small></span></button></li>)}</ol>
 <div className="journey-next"><div><strong>{terminal?'Compte rendu disponible':`Prochaine étape : ${next.label.toLowerCase()}`}</strong><p>{terminal?'Consultez les photos et les informations enregistrées.':'Vos informations restent dans la fiche. La clôture se confirme après vérification.'}</p></div><button type="button" disabled={busy} onClick={terminal?()=>onSelect(3):act}>{action}<span aria-hidden="true"> →</span></button></div>
 <div className="journey-mobile-action"><span>{terminal?'Compte rendu':`Étape ${next.tab+1} sur 4`}</span><button type="button" disabled={busy} onClick={terminal?()=>onSelect(3):act}>{action} →</button></div>
 </section>;
}
