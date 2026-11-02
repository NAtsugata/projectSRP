import { normalizePlanningText,parisDay,shiftPlanningDay } from './planningLanguage.js';
export const REQUEST_CATEGORIES={transport:'Transport',meals:'Repas',accommodation:'Hébergement',supplies:'Fournitures',phone:'Téléphone',parking:'Parking',fuel:'Carburant',other:'Autre'};
export const validRequestDay=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value || ''))return false;const d=new Date(`${value}T12:00:00Z`);return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;};
const months=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
const iso=(day,month,year)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
export function requestDates(message,now=new Date()) {
    let text=normalizePlanningText(message).replace(/(?:\d[\d \u00a0]*)(?:[,.]\d{1,2})?\s*(?:€|euros?\b|eur\b)/g,' '),today=parisDay(now),year=Number(today.slice(0,4)),found=[];
    const take=(pattern,fn)=>{text=text.replace(pattern,(...args)=>{found.push(...fn(args));return ' ';});};
    take(/\bdu\s+(\d{1,2})\s+au\s+(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?\b/g,a=>[iso(a[1],months.indexOf(a[3])+1,a[4] || year),iso(a[2],months.indexOf(a[3])+1,a[4] || year)]);
    take(/\bdu\s+(\d{1,2})\s+au\s+(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/g,a=>[iso(a[1],a[3],a[4] || year),iso(a[2],a[3],a[4] || year)]);
    take(/\b(\d{4}-\d{2}-\d{2})\b/g,a=>[a[1]]);
    take(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/g,a=>[iso(a[1],a[2],a[3] || year)]);
    take(/\b(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?\b/g,a=>[iso(a[1],months.indexOf(a[2])+1,a[3] || year)]);
    take(/\bapres[- ]demain\b/g,()=>[shiftPlanningDay(today,2)]);
    take(/\bavant[- ]hier\b/g,()=>[shiftPlanningDay(today,-2)]);
    take(/\b(?:aujourd hui|aujourd’hui|aujourdhui)\b/g,()=>[today]);
    take(/\bdemain\b/g,()=>[shiftPlanningDay(today,1)]);take(/\bhier\b/g,()=>[shiftPlanningDay(today,-1)]);
    take(/\bdans\s+(\d{1,3})\s+jours?\b/g,a=>[shiftPlanningDay(today,Number(a[1]))]);
    const weekdays=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    take(/\b(dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)(?:\s+prochain)?\b/g,a=>{const offset=(weekdays.indexOf(a[1])-new Date(`${today}T12:00:00Z`).getUTCDay()+7)%7;return[shiftPlanningDay(today,offset || 7)];});
    return {dates:[...new Set(found)],invalid:found.some(d=>!validRequestDay(d))};
}
export function parseRequestCommand(message,preferredKind='',now=new Date()) {
    const original=String(message || '').trim().slice(0,1000),text=normalizePlanningText(original),warnings=[];
    const leave=/\b(?:conges?|vacances?|absence|absent|rtt|repos|sans solde)\b/.test(text) || /\bposer\s+(?:du|le|demain|lundi|mardi|mercredi|jeudi|vendredi)\b/.test(text),expense=/\b(?:frais|depense|remboursement|rembourser|repas|restaurant|carburant|essence|gazole|parking|peage|hotel|facture)\b/.test(text);
    const kind=preferredKind || (leave && !expense?'leave':expense && !leave?'expense':'');
    if(/\b(?:ne veux pas|ne souhaite pas|pas de conges?|ne pas envoyer)\b/.test(text))return{kind:'',values:{},warnings:['La phrase contient une négation. Précisez la demande que vous souhaitez préparer.']};
    if(/\b(?:supprime|supprimer|annule|annuler|approuve|approuver|valide|valider|refuse|refuser)\b/.test(text))return{kind:'',values:{},warnings:['Cet assistant prépare de nouvelles demandes personnelles. Les décisions et suppressions se font dans les écrans autorisés.']};
    if(!['leave','expense'].includes(kind))return{kind:'',values:{},warnings:['Choisissez Congé / absence ou Note de frais. Je vous aiderai à compléter les champs.']};
    const {dates,invalid}=requestDates(original,now);
    if(invalid || dates.length>(kind==='leave'?2:1))warnings.push('Les dates sont ambiguës ou invalides : précisez-les dans le formulaire.');
    if(!dates.length)warnings.push('Date à compléter : aucune date précise reconnue.');
    const valid=!invalid && dates.length<=(kind==='leave'?2:1),values=kind==='leave'?{startDate:valid?dates[0] || '':'',endDate:valid?dates[1] || dates[0] || '':'',reason:original.slice(0,500)}:{date:valid?dates[0] || '':'',category:'other',amount:'',description:original.slice(0,1000)};
    if(kind==='leave' && dates.length===1 && /\b(?:[2-9]|[1-9]\d+)\s+jours?\b/.test(text)){values.endDate='';warnings.push('Précisez la date de fin pour cette durée en jours. Le décompte sera vérifié par le responsable.');}
    if(kind==='leave' && values.startDate>values.endDate)warnings.push('La date de fin précède la date de début. Corrigez la période.');
    if(kind==='expense') {
        const amounts=[...text.matchAll(/(\d{1,3}(?:[ \u00a0]\d{3})+(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?\b|eur\b)/g)].map(m=>m[1].replace(/[ \u00a0]/g,'').replace(',','.'));
        if(amounts.length===1)values.amount=amounts[0];else warnings.push(amounts.length?'Plusieurs montants reconnus : précisez le montant total.':'Montant à compléter : indiquez par exemple 18,50 euros.');
        const categories=[['fuel',/\b(?:carburant|essence|gazole|gasoil|diesel|plein)\b/],['parking',/\bparking\b/],['meals',/\b(?:repas|restaurant|dejeuner|diner)\b/],['accommodation',/\b(?:hotel|hebergement|nuit)\b/],['phone',/\b(?:telephone|telephonie)\b/],['supplies',/\b(?:fournitures?|materiel|outils?)\b/],['transport',/\b(?:transport|train|taxi|peage|bus)\b/]].filter(([,pattern])=>pattern.test(text));
        if(categories.length===1)values.category=categories[0][0];else if(categories.length>1)warnings.push('Plusieurs catégories possibles : choisissez la catégorie à retenir.');
    }
    return {kind,values,warnings};
}
export function validatePersonalRequest(kind,values) {
    if(kind==='leave') {
        if(!validRequestDay(values.startDate)||!validRequestDay(values.endDate)||values.endDate<values.startDate)return 'Vérifiez les dates de début et de fin.';
        if(!String(values.reason || '').trim() || String(values.reason).length>500)return 'Précisez le motif, dans la limite de 500 caractères.';
    } else if(kind==='expense') {
        if(!validRequestDay(values.date))return 'Précisez une date valide.';
        if(!Object.hasOwn(REQUEST_CATEGORIES,values.category))return 'Choisissez une catégorie de frais.';
        const raw=String(values.amount || '').replace(',','.');
        if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||Number(raw)<=0||Number(raw)>1000000)return 'Précisez un montant positif en euros, avec deux décimales maximum.';
        if(!String(values.description || '').trim() || String(values.description).length>1000)return 'Précisez la description, dans la limite de 1000 caractères.';
    } else return 'Choisissez le type de demande.';
    return '';
}
export function assistantDraft(kind,values,profile,now=Date.now()) {
    if(!profile?.id || !profile?.organization_id)throw new Error('Session requise.');
    const allowed=kind==='leave'?['startDate','endDate','reason']:kind==='expense'?['date','amount','category','description']:[];
    if(!allowed.length)throw new Error('Type de demande invalide.');
    return {id:crypto.randomUUID(),kind,owner:profile.id,organization:profile.organization_id,expires:now+30*60*1000,values:Object.fromEntries(allowed.map(k=>[k,String(values[k] || '')]))};
}
export function readAssistantDraft(draft,profile,now=Date.now()) {
    if(!draft || !Number.isFinite(draft.expires) || draft.owner!==profile?.id || draft.organization!==profile?.organization_id || draft.expires<now || draft.expires>now+31*60*1000 || !['leave','expense'].includes(draft.kind))return null;
    const keys=draft.kind==='leave'?['startDate','endDate','reason']:['date','amount','category','description'];
    return {id:draft.id,kind:draft.kind,values:Object.fromEntries(keys.map(k=>[k,String(draft.values?.[k] || '').slice(0,1000)]))};
}
