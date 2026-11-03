import { normalizePlanningText, parisDay, timeMinutes } from './planningLanguage.js';
export { normalizePlanningText, parisDay, shiftPlanningDay, timeMinutes, parsePlanningCommand, validatePlanningDraft } from './planningLanguage.js';
export const minutesTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export function slotAvailable({ date, time, duration, staffIds, period }, { interventions = [], absences = [], leaves = [] }) {
    const start = timeMinutes(time), end = start === null ? null : start + duration;
    if (start === null || !Number.isInteger(duration) || duration < 15 || duration > 480 || duration % 15 || start < 480 || end > 1080 || start < 780 && end > 720 || !staffIds.length) return false;
    if (period === 'morning' && end > 720 || period === 'afternoon' && start < 780) return false;
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
    if(parsed.requests){
        const bookings=[],conflicts=[];
        for(const request of parsed.requests){
            const extra=bookings.filter(b=>b.time).map(b=>({date:b.date,time:b.time,duration_minutes:b.duration,intervention_assignments:b.staffIds.map(user_id=>({user_id}))}));
            const next=proposePlanning({...request,requests:undefined},{...context,interventions:[...(context.interventions || []),...extra]});
            bookings.push(...next.bookings.map(b=>({...b,clientName:request.client.name,staffNames:request.staff.map(p=>p.full_name).join(' et ')})));conflicts.push(...next.conflicts);
        }
        return {...parsed,bookings,conflicts};
    }
    const staffIds = parsed.staff.map(person => person.id);
    const bookings = [], conflicts = [];
    for (const date of parsed.dates) {
        const possible = [];
        for (let start = 480; start + parsed.duration <= 1080; start += 30) {
            const time = minutesTime(start);
            if (slotAvailable({ date, time, duration: parsed.duration, staffIds, period: parsed.period }, context)) possible.push(time);
        }
        const chosen = parsed.time ? possible.includes(parsed.time) || slotAvailable({ date, time: parsed.time, duration: parsed.duration, staffIds, period: parsed.period }, context) ? parsed.time : null : possible[0];
        if (!chosen) conflicts.push(date);
        bookings.push({ date, time: chosen || '', duration: parsed.duration, staffIds, clientId: parsed.client.id, service: 'Rendez-vous', period: parsed.period || '', alternatives: possible.slice(0, 5) });
    }
    return { ...parsed, bookings, conflicts };
}

export function planningBacklog(interventions, now = new Date()) {
    const today = parisDay(now);
    return interventions.filter(item => !item.is_archived && !['terminee','annulee'].includes(normalizePlanningText(item.status)) && item.date && item.date <= today)
        .sort((a,b) => a.date.localeCompare(b.date)).slice(0, 5);
}
