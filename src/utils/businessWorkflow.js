import { normalizePlanningText, parisDay, shiftPlanningDay } from './planningAssistant.js';
export const WORKFLOW_STATUSES = { todo:'À traiter', planned:'Planifié', in_progress:'En cours', waiting:'En attente', procedure:'Procédure', cancelled:'Annulé', completed:'Terminé' };
export const WORKFLOW_TYPES = { intervention:'Intervention', chantier:'Chantier', odoo_quote:'Devis Odoo' };
export const terminalWorkflowStatus = status => ['completed','cancelled'].includes(status);
export function workflowSourceUrl(item) {
    if (item.source_type === 'intervention') return `/planning/${encodeURIComponent(item.source_key)}`;
    if (item.source_type === 'chantier') return `/chantiers/${encodeURIComponent(item.source_key)}`;
    const reference=String(item.title || '').split(' · ')[0].slice(0,100);
    return reference ? `/odoo-quotes?search=${encodeURIComponent(reference)}` : '/odoo-quotes';
}
export function interpretManagerReply(message, now = new Date()) {
    const text = normalizePlanningText(message), statuses = [];
    if (/\b(?:a reprendre|reprendre|a replanifier|reprogrammer)\b/.test(text)) statuses.push('todo');
    const negated = /\b(?:pas|non|jamais|ne)\b/.test(text);
    if (/\b(?:attent[es]?|attend|attendons|attends|attendre|standby|stand by|piece|materiel)\b/.test(text)) statuses.push('waiting');
    if (/\b(?:procedure|assurance|litige|expertise|administratif|administrative)\b/.test(text)) statuses.push('procedure');
    if (/\b(?:planifie|programme|rendez vous|rendezvous|rdv)\b/.test(text)) statuses.push('planned');
    if (/\b(?:en cours|travaux en cours|demarre|commence)\b/.test(text)) statuses.push('in_progress');
    if (/\b(?:annule|annulee|annulation|abandonne|abandonnee)\b/.test(text)) statuses.push('cancelled');
    if (/\b(?:termine|terminee|termines|finis|fini|acheve|achevee)\b/.test(text)) statuses.push('completed');
    const distinct = [...new Set(statuses)];
    const today = parisDay(now), dates = [];
    let remaining = text.replace(/\bapres[ -]demain\b/g, () => { dates.push(shiftPlanningDay(today,2)); return ''; });
    if (/\bdemain\b/.test(remaining)) dates.push(shiftPlanningDay(today,1));
    for (const m of remaining.matchAll(/\bdans\s+(\d+)\s+jours?\b/g)) if (Number(m[1])<=366) dates.push(shiftPlanningDay(today,Number(m[1])));
    for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)) dates.push(`${m[3] || today.slice(0,4)}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
    const weekdays=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    for (const m of text.matchAll(/\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)\b/g)) {
        const day=new Date(`${today}T12:00:00Z`).getUTCDay(); let delta=(weekdays.indexOf(m[1])-day+7)%7; if(!delta) delta=7; dates.push(shiftPlanningDay(today,delta));
    }
    const uniqueDates=[...new Set(dates)];
    return { status: !negated && distinct.length===1 ? distinct[0] : '', nextReview:uniqueDates.length===1 ? uniqueDates[0] : shiftPlanningDay(today,7), needsClarification:negated || distinct.length!==1 || uniqueDates.length>1 };
}
export function validateWorkflowReply({ status, reason, nextReview, confirmed }, now = new Date()) {
    if (!WORKFLOW_STATUSES[status]) return 'Choisissez le statut à appliquer.';
    if (String(reason || '').trim().length < 3 || String(reason).length > 2000) return 'Précisez un motif de 3 à 2000 caractères.';
    if (terminalWorkflowStatus(status)) return confirmed ? '' : 'Confirmez explicitement l’annulation ou la fin des travaux.';
    if (['waiting','procedure'].includes(status) && !nextReview) return 'Choisissez la date du prochain contrôle.';
    if (nextReview) {
        const date=new Date(`${nextReview}T12:00:00Z`), today=parisDay(now);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==nextReview || nextReview<=today || nextReview>shiftPlanningDay(today,366)) return 'Le prochain contrôle doit être entre demain et les 366 prochains jours.';
    }
    return '';
}
