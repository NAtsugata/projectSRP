const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const groups=[
 ['completed','Terminé',['completed','complete','termine','terminee','done']],
 ['cancelled','Annulé',['cancelled','canceled','annule','annulee']],
 ['rejected','Refusé',['rejected','rejete','rejetee','refuse','refusee']],
 ['approved','Validé',['approved','approuve','approuvee','valide','validee']],
 ['paid','Payé',['paid','paye','payee']],
 ['running','En cours',['in_progress','en cours']],
 ['waiting','En attente',['waiting','pending','en attente','standby','stand by']],
 ['procedure','En procédure',['procedure','en procedure']],
 ['planned','Planifié',['planned','planifie','planifiee','a venir']],
 ['todo','À faire',['todo','a traiter','a faire','a reprendre']],
];
export function statusPresentation(value){const found=groups.find(row=>row[2].includes(normalize(value)));return found?{tone:found[0],label:found[1]}:{tone:'neutral',label:String(value || 'À préciser')};}
export function interventionStageStatus(intervention){
 const status=statusPresentation(intervention?.status);
 if(['completed','cancelled'].includes(status.tone))return intervention.status;
 return intervention?.report?.arrivalTime?'En cours':intervention?.status || 'planned';
}
