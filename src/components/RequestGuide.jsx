import { Link } from 'react-router-dom';
import { statusPresentation } from '../utils/statusPresentation';
import './RequestGuide.css';
export default function RequestGuide({kind='leave',rows=[],compact=false}){
 const waiting=rows.filter(row=>statusPresentation(row.status).tone==='waiting').length;
 const approved=rows.filter(row=>['approved','paid'].includes(statusPresentation(row.status).tone)).length;
 const rejected=rows.filter(row=>statusPresentation(row.status).tone==='rejected').length;
 return <section className={`request-guide ${compact?'is-compact':''}`} aria-label="Comment suivre ma demande"><div className="request-guide-intro"><div><small>UN PARCOURS SIMPLE</small><h2>De ma demande à la réponse</h2><p>Je complète les informations, je vérifie, puis je retrouve la décision de mon responsable.</p></div>{!compact&&<Link to={`/my-requests?type=${kind}`}>Préparer avec l’assistant →</Link>}</div><ol><li><span>1</span><div><strong>Préparer</strong><small>Dates ou montant, motif et pièces utiles</small></div></li><li><span>2</span><div><strong>Vérifier et envoyer</strong><small>Une confirmation avant l’envoi</small></div></li><li><span>3</span><div><strong>Suivre la réponse</strong><small>Statut et retour du responsable</small></div></li></ol>{!compact&&<div className="request-guide-counts" aria-label="Demandes chargées sur cet écran"><span><strong>{waiting}</strong> en attente</span><span><strong>{approved}</strong> validée{approved>1?'s':''}</span><span><strong>{rejected}</strong> refusée{rejected>1?'s':''}</span><small>Sur les demandes affichées sur cet écran</small></div>}</section>;
}
