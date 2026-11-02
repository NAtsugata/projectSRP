// Local French scheduling grammar. No external AI or network requests.
export const normalizePlanningText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim();
export function parisDay(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const pick = key => parts.find(part => part.type === key).value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
export function shiftPlanningDay(day, offset) {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}
export function timeMinutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}
const durationPattern = () => /\b(?:pendant|durant|duree(?: de)?)\s+(\d+)\s*(h(?:eures?)?|min(?:utes?)?)(?:\s*(\d{1,2})(?:\s*min(?:utes?)?)?)?\b/g;
const clockPattern = () => /\b(?:a\s+)?(\d{1,2})\s*(?:h(?:eures?)?(?:\s*(\d{2}))?|:(\d{2}))(?!\d)/g;
const weekdays = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
function normalizeSchedule(value) {
    const numbers = { un:1, une:1, deux:2, trois:3, quatre:4, cinq:5, six:6, sept:7, huit:8, neuf:9, dix:10, onze:11, douze:12 };
    return normalizePlanningText(value)
        .replace(/(?:,?\s+(?:stp|svp|s il te plait|s il vous plait|merci))+[.!?]*$/g, '')
        .replace(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s+(heures?|jours?)\b/g, (_, n, unit) => `${numbers[n]} ${unit}`)
        .replace(/\b(\d{1,2})\s*heures? et demie\b/g, '$1h30')
        .replace(/\b(\d{1,2})\s*heures? et quart\b/g, '$1h15')
        .replace(/\b(\d{1,2})\s*heures?\s+(quinze|trente|quarante cinq)\b/g, (_, h, m) => `${h}h${{ quinze:'15', trente:'30', 'quarante cinq':'45' }[m]}`)
        .replace(/\ba midi\b/g, 'a 12h00');
}
function collectDetails(text, now) {
    let rest = text;
    const today = parisDay(now), dates = new Set(), errors = [];
    // Expand ranges before individual dates so intermediate days are retained.
    const addRange = (start,end) => {
        if (start>end || start<today || end>shiftPlanningDay(start,13)) { errors.push('Choisissez une période de 1 à 14 jours à venir.'); return; }
        for(let day=start;day<=end;day=shiftPlanningDay(day,1)) dates.add(day);
    };
    rest = rest.replace(/\bdu\s+(\d{1,2})\s+au\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/g,(match,a,b,month,year)=>{
        const m=months.indexOf(month);if(m<0)return match;
        const prefix=`${year || today.slice(0,4)}-${String(m+1).padStart(2,'0')}-`;
        addRange(prefix+a.padStart(2,'0'),prefix+b.padStart(2,'0'));return ' ';
    });
    rest = rest.replace(/\b(?:de|du)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(?:a|au)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/g,(_,a,b)=>{
        const current=new Date(`${today}T12:00:00Z`).getUTCDay(),offset=(weekdays.indexOf(a)-current+7)%7;
        const start=shiftPlanningDay(today,offset);addRange(start,shiftPlanningDay(start,(weekdays.indexOf(b)-weekdays.indexOf(a)+7)%7));return ' ';
    });
    rest = rest.replace(/\bdu\s+(\d{1,2})(?:\/(\d{1,2}))?\s+au\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g,(_,a,m,b,n,y)=>{
        addRange(`${y || today.slice(0,4)}-${(m || n).padStart(2,'0')}-${a.padStart(2,'0')}`,`${y || today.slice(0,4)}-${n.padStart(2,'0')}-${b.padStart(2,'0')}`);return ' ';
    });
    rest = rest.replace(/\b(?:a partir de\s+)?demain\s+(?:pendant|durant)\s+(\d+)\s+jours?\b/g,(_,n)=>{addRange(shiftPlanningDay(today,1),shiftPlanningDay(today,Number(n)));return ' ';});
    const lengths = [...rest.matchAll(durationPattern())];
    const duration = lengths.length ? Number(lengths[0][1]) * (lengths[0][2].startsWith('h') ? 60 : 1) + Number(lengths[0][3] || 0) : 60;
    const durations = lengths.map(m => Number(m[1]) * (m[2].startsWith('h') ? 60 : 1) + Number(m[3] || 0));
    if (new Set(durations).size > 1) errors.push('Plusieurs durées sont indiquées. Faites une demande par durée.');
    rest = rest.replace(durationPattern(), ' ');
    if (/\b(?:pendant|durant|duree)\b/.test(rest)) errors.push('Précisez la durée dans les champs ci-dessous.');
    const clocks = [...rest.matchAll(clockPattern())];
    const times = clocks.map(m => `${m[1].padStart(2,'0')}:${m[2] || m[3] || '00'}`);
    rest = rest.replace(clockPattern(), ' ');
    // A bare hour is accepted only after an explicit “à”.
    for (const m of rest.matchAll(/\ba\s+(\d{1,2})\b(?!\s*\/)/g)) times.push(`${m[1].padStart(2,'0')}:00`);
    rest = rest.replace(/\ba\s+\d{1,2}\b(?!\s*\/)/g, ' ');
    if (/\b\d{1,2}\s*(?:h|:)\s*\d{1,3}\b|\b(?:quart|demie|moins|heures?|minutes?)\b/.test(rest)) errors.push('Horaire ou durée à préciser dans les champs ci-dessous.');
    if (new Set(times).size > 1) errors.push('Plusieurs heures différentes sont indiquées. Faites une demande par horaire.');
    const time = times[0] || null;
    // An explicit date accompanied by a weekday is one date, not two events.
    const explicitDate = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}(?:/\\d{4})?|\\d{1,2}\\s+(?:' + months.join('|') + ')(?:\\s+\\d{4})?)';
    rest = rest.replace(new RegExp('\\b(' + weekdays.join('|') + ')\\s+(?:le\\s+)?(' + explicitDate + ')', 'g'), (_, label, dateText) => {
        let day = dateText;
        if (dateText.includes('/')) {
            const [d,m,y] = dateText.split('/'); day = `${y || today.slice(0,4)}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
        } else if (!dateText.includes('-')) {
            const [d,m,y] = dateText.split(' '); day = `${y || today.slice(0,4)}-${String(months.indexOf(m)+1).padStart(2,'0')}-${d.padStart(2,'0')}`;
        }
        const parsed = new Date(`${day}T12:00:00Z`);
        if (!Number.isNaN(parsed.getTime()) && parsed.getUTCDay() !== weekdays.indexOf(label)) errors.push('Le jour de semaine ne correspond pas à la date. Vérifiez la date ci-dessous.');
        return dateText;
    });
    rest = rest.replace(/\bapres[ -]demain\b/g, () => { dates.add(shiftPlanningDay(today, 2)); return ' '; });
    rest = rest.replace(/\bdemain\b/g, () => { dates.add(shiftPlanningDay(today, 1)); return ' '; });
    rest = rest.replace(/\baujourd hui\b/g, () => { dates.add(today); return ' '; });
    rest = rest.replace(/\bdans\s+(\d+)\s+jours?\b/g, (_, n) => { if (Number(n) <= 366) dates.add(shiftPlanningDay(today, Number(n))); else errors.push('La date doit être dans les 366 prochains jours.'); return ' '; });
    rest = rest.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, day) => { dates.add(day); return ' '; });
    rest = rest.replace(/\b(?:le\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g, (_, d, m, y) => { dates.add(`${y || today.slice(0,4)}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`); return ' '; });
    const namedDate = new RegExp('\\b(?:le\\s+)?(\\d{1,2})\\s+(' + months.join('|') + ')(?:\\s+(\\d{4}))?\\b', 'g');
    rest = rest.replace(namedDate, (_, d, month, y) => { dates.add(`${y || today.slice(0,4)}-${String(months.indexOf(month)+1).padStart(2,'0')}-${d.padStart(2,'0')}`); return ' '; });
    const weekPattern = new RegExp('\\b(?:ce\\s+)?(' + weekdays.join('|') + ')(?:\\s+(prochain|de la semaine prochaine))?\\b', 'g');
    rest = rest.replace(weekPattern, (_, day, next) => {
        const current = new Date(`${today}T12:00:00Z`).getUTCDay(), wanted = weekdays.indexOf(day);
        let offset = (wanted-current+7)%7;
        if (next === 'de la semaine prochaine') offset = (current === 0 ? 1 : 8-current) + (wanted+6)%7;
        else if (next && offset === 0) offset = 7;
        dates.add(shiftPlanningDay(today, offset)); return ' ';
    });
    const afternoon = /\bapres[ -]midi\b/.test(rest), morning = /\bmatin\b/.test(rest);
    if (afternoon && morning) errors.push('Choisissez un moment de la journée par demande.');
    const period = afternoon ? 'afternoon' : morning ? 'morning' : '';
    rest = rest.replace(/\b(?:le\s+)?(?:matin|apres[ -]midi)\b/g, ' ');
    if (/\b(?:pas|sauf|entre|avant|apres|soir)\b/.test(rest)) errors.push('Cette contrainte nécessite une précision dans les champs ci-dessous.');
    return { rest, dates: [...dates].sort(), time, duration, period, errors };
}
function cleanPart(value) {
    return value.replace(/\s+/g, ' ').replace(/^[,;:\s]+|[,;:.!?\s]+$/g, '').replace(/^(?:et\s+)+|(?:\s+et)+$/g, '').trim();
}
const withoutTitle = value => normalizePlanningText(value).replace(/^(?:(?:madame|mme|monsieur|m|mademoiselle|mlle)\.?\s+)+/, '');

export function validatePlanningDraft(draft, { employees = [], clients = [], now = new Date() } = {}) {
    const ids = [...new Set(draft.staffIds || [])], staff = employees.filter(p => ids.includes(p.id));
    const client = clients.find(c => c.id === draft.clientId);
    if (!ids.length || staff.length !== ids.length) return { error: 'Choisissez les intervenants de votre entité.' };
    if (!client) return { error: 'Choisissez un client de votre entité.' };
    const today = parisDay(now), limit = shiftPlanningDay(today, 366), dates = [...new Set(draft.dates || [])].sort();
    if (!dates.length || dates.length > 14) return { error: 'Choisissez entre 1 et 14 dates.' };
    if (dates.some(day => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return true;
        const parsed = new Date(`${day}T12:00:00Z`);
        return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== day || day < today || day > limit;
    })) return { error: 'La date est invalide, passée ou au-delà des 366 prochains jours.' };
    const duration = Number(draft.duration), time = draft.time || null;
    if (time && timeMinutes(time) === null) return { error: 'Heure invalide.' };
    if (!Number.isInteger(duration) || duration < 15 || duration > 480 || duration % 15) return { error: 'Choisissez une durée de 15 minutes à 8 heures, par pas de 15 minutes.' };
    return { client, staff: ids.map(id => staff.find(p => p.id === id)), dates, time, duration, period: ['morning','afternoon'].includes(draft.period) ? draft.period : '' };
}

function parseSingleCommand(message, context = {}) {
    const { employees = [], clients = [], now = new Date(), staffChoices = {} } = context;
    const text = normalizeSchedule(message), details = collectDetails(text, now), cleaned = details.rest;
    const draft = { staffIds: [], clientId: '', dates: details.dates, time: details.time || '', duration: details.duration, period: details.period };
    if (/\b(?:annule|annuler|supprime|supprimer|deplace|deplacer|reporte|reporter)\b/.test(text)) return { draft, unsupportedIntent: true, error: 'Pour déplacer, annuler ou supprimer un rendez-vous, ouvrez sa fiche dans l’agenda. Ce formulaire prépare une création.' };
    const appointment = cleaned.match(/\b(?:rendez[ -]?vous|rdv)\b/), chez = cleaned.match(/\bchez\b/), marker = appointment || chez;
    if (!marker) return { draft, error: 'Complétez les champs ci-dessous pour préparer le rendez-vous.' };
    const role = cleaned.match(/\b(?:pour|avec)\b/);
    let peoplePart = cleanPart(role ? cleaned.slice(role.index+role[0].length).split(/\b(?:chez|rendez[ -]?vous|rdv)\b/)[0] : cleaned.slice(0, marker.index));
    if (!peoplePart && appointment && chez && chez.index > appointment.index) peoplePart = cleanPart(cleaned.slice(appointment.index+appointment[0].length, chez.index));
    peoplePart = peoplePart.replace(/^(?:(?:peux tu|tu peux|merci de|je voudrais|je veux|cree|creer|programme|programmer|planifie|planifier|mets|mettre|ajoute|ajouter|organise|organiser|prevois|prevoir)\s+)+/, '');
    const clientMarker = chez || appointment;
    const clientPart = cleanPart(cleaned.slice(clientMarker.index+clientMarker[0].length).split(/\b(?:pour|avec)\b/)[0]);
    const words = peoplePart.split(/\s+et\s+|[,;+]/).map(cleanPart).filter(Boolean);
    if (!words.length) words.push('intervenant');
    const staff = [], staffQuestions = [];
    for (const word of words) {
        const terms = word.split(' ');
        const candidates = employees.filter(employee => {
            const name = normalizePlanningText(employee.full_name);
            return name === word || terms.every(term => term.length >= 3 && (name.split(/[\s-]+/).some(token => token.startsWith(term)) || term.length >= 4 && name.replace(/[\s-]+/g, '').includes(term)));
        });
        const chosen = employees.find(p => p.id === staffChoices[word]);
        if (chosen || candidates.length === 1) staff.push(chosen || candidates[0]);
        else staffQuestions.push({ word, ambiguous: candidates.length > 1, candidates: (candidates.length ? candidates : employees).map(({ id, full_name }) => ({ id, full_name })) });
    }
    draft.staffIds = [...new Set(staff.map(p => p.id))];
    const target = normalizePlanningText(clientPart), bare = withoutTitle(clientPart);
    const matches = target.length < 3 ? [] : clients.filter(client => normalizePlanningText(`${client.name} ${client.company_name || ''}`).includes(target) || bare.length >= 3 && (withoutTitle(client.name).includes(bare) || withoutTitle(client.company_name).includes(bare)));
    if (matches.length === 1) draft.clientId = matches[0].id;
    if (staffQuestions.length) return { draft, staffQuestions, error: staffQuestions.some(q => q.ambiguous) ? 'Plusieurs personnes correspondent. Choisissez les intervenants ci-dessous.' : 'Intervenants à préciser dans les champs ci-dessous.' };
    if (matches.length !== 1) return { draft, error: matches.length ? 'Plusieurs clients correspondent. Choisissez le client ci-dessous.' : 'Choisissez le client de votre entité dans les champs ci-dessous.' };
    if (details.errors.length) return { draft, error: details.errors[0] };
    const parsed = validatePlanningDraft(draft, context);
    return { ...parsed, draft };
}

export function parsePlanningCommand(message, context = {}) {
    const fullDay=/\b(?:toute la journee|journee complete|journee entiere|toute une journee)\b/;
    const parts=normalizeSchedule(String(message).replace(/\n/g,' ; ')).split(/\s*(?:;|\bpuis\b|\bensuite\b|\bet (?=chez\b))\s*/).filter(Boolean);
    const requests=[];let previous=null;
    for(let part of parts){
        const allDay=fullDay.test(part);part=part.replace(fullDay,' ');
        let parsed=parseSingleCommand(part,context);
        if(previous && parsed.error && !parsed.unsupportedIntent){
            if(parsed.staffQuestions?.some(q=>q.word!=='intervenant'))return parsed;
            const details=collectDetails(part,context.now || new Date());
            if(details.errors.length)return {...parsed,error:details.errors[0]};
            const draft={...parsed.draft};
            if(!draft.staffIds.length)draft.staffIds=previous.draft.staffIds;
            if(!draft.dates.length)draft.dates=previous.draft.dates;
            if(!draft.clientId && !/\bchez\b/.test(part))draft.clientId=previous.draft.clientId;
            parsed={...validatePlanningDraft(draft,context),draft};
        }
        if(parsed.error)return parsed;
        previous=parsed;
        if(allDay){
            if(parsed.time || parsed.duration!==60 || parsed.period)return {...parsed,error:'Pour une journée complète, retirez l’heure, la durée ou la demi-journée indiquée.'};
            requests.push({...parsed,time:'08:00',duration:240,period:'morning'},{...parsed,time:'13:00',duration:300,period:'afternoon'});
        }else requests.push(parsed);
    }
    if(!requests.length)return parseSingleCommand(message,context);
    if(requests.reduce((n,r)=>n+r.dates.length,0)>14)return {...requests[0],error:'Un lot peut contenir 14 rendez-vous maximum. Réduisez la période ou le nombre de chantiers.'};
    return {...requests[0],requests};
}
