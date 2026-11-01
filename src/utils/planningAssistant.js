export const normalizePlanningText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
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
export const minutesTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export function parsePlanningCommand(message, { employees = [], clients = [], now = new Date(), staffChoices = {} } = {}) {
    const normalized = normalizePlanningText(message);
    const marker = normalized.match(/\b(?:rendez[ -]?vous|rdv|chez)\b/);
    if (!marker) return { error: 'Indiquez les intervenants, puis « rendez-vous chez [client] demain ». Les propositions à traiter sont aussi disponibles ci-dessous.' };
    const peoplePart = normalized.slice(0, marker.index);
    let clientPart = normalized.slice(marker.index + marker[0].length).replace(/^\s*chez\s+/, '');
    clientPart = clientPart.split(/\b(?:demain|apres[ -]demain|aujourd hui|a\s+\d|le\s+\d|pendant|duree)\b/)[0].trim();
    const teamWords = peoplePart.split(/\s+(?:et|avec)\s+|[,;+]/).map(value => value.replace(/^(?:planifie|programme|mets|met|ajoute|pour)\s+/, '').trim()).filter(Boolean);
    const staff = [], missing = [], ambiguous = [], staffQuestions = [];
    for (const word of teamWords) {
        const terms = word.split(' ').filter(Boolean);
        const candidates = employees.filter(employee => {
            const name = normalizePlanningText(employee.full_name);
            // Legacy profiles sometimes store first and last names without spaces.
            // Keep short abbreviations as prefixes; require 4 letters for an interior match.
            return name === word || terms.every(term => term.length >= 3 && (name.split(/[\s-]+/).some(token => token.startsWith(term)) || term.length >= 4 && name.replace(/[\s-]+/g, '').includes(term)));
        });
        const chosen = employees.find(employee => employee.id === staffChoices[word]);
        if (chosen) { staff.push(chosen); continue; }
        if (candidates.length === 1) staff.push(candidates[0]);
        else {
            if (candidates.length > 1) ambiguous.push(word); else missing.push(word);
            staffQuestions.push({ word, candidates: (candidates.length ? candidates : employees).map(({ id, full_name }) => ({ id, full_name })) });
        }
    }
    if (!staff.length || missing.length || ambiguous.length) return { staffQuestions, error: ambiguous.length ? `Plusieurs personnes correspondent à « ${ambiguous.join(', ')} ». Choisissez la bonne personne ci-dessous.` : `Intervenants à préciser${missing.length ? ' : ' + missing.join(', ') : ''}. Choisissez un nom enregistré ci-dessous ou corrigez votre demande.` };
    const target = normalizePlanningText(clientPart);
    if (target.length < 3) return { error: 'Précisez le nom du client après « rendez-vous chez ».' };
    const matches = clients.filter(client => normalizePlanningText(`${client.name} ${client.company_name || ''}`).includes(target));
    if (matches.length !== 1) return { error: matches.length ? `Plusieurs clients correspondent à « ${clientPart} ». Précisez leur nom complet.` : `Client « ${clientPart} » introuvable dans votre entité. Ajoutez-le dans Clients ou précisez son nom.` };
    let remaining = normalized;
    const dates = new Set(), today = parisDay(now);
    if (/\bapres[ -]demain\b/.test(remaining)) { dates.add(shiftPlanningDay(today, 2)); remaining = remaining.replace(/\bapres[ -]demain\b/g, ''); }
    if (/\bdemain\b/.test(remaining)) dates.add(shiftPlanningDay(today, 1));
    if (/\baujourd hui\b/.test(remaining)) dates.add(today);
    for (const match of normalized.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)) {
        const day = `${match[3] || today.slice(0, 4)}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        const parsed = new Date(`${day}T12:00:00Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== day || day < today) return { error: 'La date est invalide ou passée. Précisez une date future au format JJ/MM/AAAA.' };
        dates.add(day);
    }
    if (!dates.size) return { error: 'Précisez demain, après-demain ou une date JJ/MM/AAAA.' };
    if (dates.size > 14) return { error: 'Limitez chaque demande à 14 dates.' };
    const hour = normalized.match(/\ba\s+(\d{1,2})(?:h(?:(\d{2}))?|:(\d{2}))(?!\d)/);
    const time = hour ? `${hour[1].padStart(2,'0')}:${hour[2] || hour[3] || '00'}` : null;
    if (time && timeMinutes(time) === null) return { error: 'Heure invalide.' };
    const length = normalized.match(/\b(?:pendant|duree(?: de)?)\s+(\d+)\s*(h|min)/);
    const duration = length ? Number(length[1]) * (length[2] === 'h' ? 60 : 1) : 60;
    if (duration < 15 || duration > 480 || duration % 15 !== 0) return { error: 'Choisissez une durée de 15 minutes à 8 heures, par pas de 15 minutes.' };
    return { client: matches[0], staff: [...new Map(staff.map(person => [person.id, person])).values()], dates: [...dates].sort(), time, duration };
}

export function slotAvailable({ date, time, duration, staffIds }, { interventions = [], absences = [], leaves = [] }) {
    const start = timeMinutes(time), end = start === null ? null : start + duration;
    if (start === null || !Number.isInteger(duration) || duration < 15 || duration > 480 || duration % 15 || start < 480 || end > 1080 || start < 780 && end > 720 || !staffIds.length) return false;
    const people = new Set(staffIds);
    if (absences.some(item => people.has(item.employee_id) && item.start_date <= date && item.end_date >= date)) return false;
    if (leaves.some(item => people.has(item.user_id) && ['approved','approuve','approuvee','valide','validee'].includes(normalizePlanningText(item.status)) && item.start_date <= date && item.end_date >= date)) return false;
    return !interventions.some(item => {
        if (item.is_archived || ['terminee','annulee'].includes(normalizePlanningText(item.status))) return false;
        if (!(item.date === date || Array.isArray(item.scheduled_dates) && item.scheduled_dates.includes(date))) return false;
        const assigned = (item.intervention_assignments || []).some(assignment => people.has(assignment.user_id));
        if (!assigned) return false;
        const bookedStart = timeMinutes(item.time_start || item.time);
        if (bookedStart === null || !Number.isFinite(Number(item.duration_minutes)) || Number(item.duration_minutes) <= 0) return true;
        return bookedStart < end && bookedStart + Number(item.duration_minutes) > start;
    });
}

export function proposePlanning(parsed, context) {
    if (parsed.error) return parsed;
    const staffIds = parsed.staff.map(person => person.id);
    const bookings = [], conflicts = [];
    for (const date of parsed.dates) {
        const possible = [];
        for (let start = 480; start + parsed.duration <= 1080; start += 30) {
            const time = minutesTime(start);
            if (slotAvailable({ date, time, duration: parsed.duration, staffIds }, context)) possible.push(time);
        }
        const chosen = parsed.time ? possible.includes(parsed.time) || slotAvailable({ date, time: parsed.time, duration: parsed.duration, staffIds }, context) ? parsed.time : null : possible[0];
        if (!chosen) conflicts.push(date);
        bookings.push({ date, time: chosen || '', duration: parsed.duration, staffIds, clientId: parsed.client.id, service: 'Rendez-vous', alternatives: possible.slice(0, 5) });
    }
    return { ...parsed, bookings, conflicts };
}

export function planningBacklog(interventions, now = new Date()) {
    const today = parisDay(now);
    return interventions.filter(item => !item.is_archived && !['terminee','annulee'].includes(normalizePlanningText(item.status)) && item.date && item.date <= today)
        .sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);
}
