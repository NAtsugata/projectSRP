import { parisDay, shiftPlanningDay } from './planningAssistant.js';
import { getDayTeamIds } from './teamForDate.js';

const validDay=date=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date || ''))return false;const parsed=new Date(`${date}T12:00:00Z`);return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===date;};

export function employeeOccurrences(interventions=[],userId) {
    return interventions.flatMap(item=>{
        if(item.is_archived || item.status==='Annulée')return [];
        const dates=Array.isArray(item.scheduled_dates) && item.scheduled_dates.length?item.scheduled_dates:[item.date];
        return [...new Set(dates)].filter(validDay).filter(date=>{
            const team=getDayTeamIds(item,date);
            return !userId || !team.length || team.includes(userId);
        }).map(date=>({item,date,key:`${item.id}:${date}`}));
    }).sort((a,b)=>a.date.localeCompare(b.date)||(a.item.time || '99:99').localeCompare(b.item.time || '99:99')||String(a.item.id).localeCompare(String(b.item.id)));
}
export function employeeOverview(interventions=[],userId,now=new Date()) {
    const today=parisDay(now),tomorrow=shiftPlanningDay(today,1),dayOfWeek=new Date(`${today}T12:00:00Z`).getUTCDay();
    const monday=shiftPlanningDay(today,-((dayOfWeek+6)%7)),occurrences=employeeOccurrences(interventions,userId);
    const week=Array.from({length:7},(_,i)=>{const date=shiftPlanningDay(monday,i),rows=occurrences.filter(r=>r.date===date);return {date,total:rows.length,completed:rows.filter(r=>r.item.status==='Terminée').length};});
    const todayRows=occurrences.filter(row=>row.date===today),future=occurrences.filter(row=>row.date>=today && row.item.status!=='Terminée');
    const next=todayRows.find(row=>row.item.status==='En cours') || future[0] || null;
    return {today,tomorrow,week,todayRows,occurrences,next,weekTotal:week.reduce((sum,d)=>sum+d.total,0),todayCompleted:todayRows.filter(row=>row.item.status==='Terminée').length};
}
export function employeeTimeLabel(item) {
    const time=String(item.time || '').slice(0,5);
    if(!/^\d{2}:\d{2}$/.test(time))return 'Horaire à préciser';
    const [hours,minutes]=time.split(':').map(Number),duration=Number(item.duration_minutes);
    if(hours>23 || minutes>59)return 'Horaire à préciser';
    if(!Number.isInteger(duration) || duration<=0)return time;
    const end=hours*60+minutes+duration;
    return `${time} – ${String(Math.floor(end/60)%24).padStart(2,'0')}:${String(end%60).padStart(2,'0')}${end>=1440?` (+${Math.floor(end/1440)} j)`:''}`;
}
