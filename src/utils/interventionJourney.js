import { statusPresentation } from './statusPresentation.js';
export function interventionJourney(report={},status){
 const photos=(report.files || []).filter(f=>typeof f==='string'?/^data:image\/|\.(png|jpe?g|webp)(\?|$)/i.test(f):f?.type?.startsWith('image/') || /^data:image\/|\.(png|jpe?g|webp)(\?|$)/i.test(f?.url || '')).length;
 const checks=report.quick_checkpoints || [],checked=checks.filter(c=>c.done).length;
 const terminal=['completed','cancelled'].includes(statusPresentation(status).tone);
 const stages=[{label:'Arrivée',detail:report.arrivalTime?'Heure enregistrée':'À enregistrer',done:!!report.arrivalTime,tab:0},
 {label:'Photos',detail:`${photos}/2 minimum`,done:photos>=2,tab:1},
 {label:'Contrôles',detail:checks.length?`${checked}/${checks.length} validés`:'Aucun contrôle prévu',done:checked===checks.length,tab:2},
 {label:'Rapport',detail:report.signature?'Signature recueillie':'Signature à recueillir',done:!!report.signature,tab:3}];
 const next=stages.find(s=>!s.done) || stages[3];
 return {stages,completed:stages.filter(s=>s.done).length,terminal,next,photos};
}
