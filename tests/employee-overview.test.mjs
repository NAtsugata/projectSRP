import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeOccurrences,employeeOverview,employeeTimeLabel } from '../src/utils/employeeOverview.js';

test('a multi-day intervention uses only assigned dates and does not restore the original unassigned date',()=>{
 const item={id:1,date:'2026-11-01',scheduled_dates:['2026-11-02','2026-11-03','2026-11-03'],daily_assignments:{'2026-11-02':['other'],'2026-11-03':['me']},intervention_assignments:[{user_id:'me'},{user_id:'other'}]};
 assert.deepEqual(employeeOccurrences([item],'me').map(r=>r.date),['2026-11-03']);
});
test('today and week counts exclude cancelled and archived records, with actual completion statuses',()=>{
 const base={date:'2026-11-02',intervention_assignments:[{user_id:'me'}]};
 const result=employeeOverview([{...base,id:1,status:'Terminée'},{...base,id:2,status:'En cours'},{...base,id:3,status:'Annulée'},{...base,id:4,is_archived:true},{...base,id:5,date:'2026-11-03'},{...base,id:6,intervention_assignments:[{user_id:'other'}]}],'me',new Date('2026-11-02T08:00:00Z'));
 assert.equal(result.todayRows.length,2);assert.equal(result.todayCompleted,1);assert.equal(result.weekTotal,3);assert.equal(result.next.item.id,2);assert.equal(result.week[0].date,'2026-11-02');assert.equal(result.week[6].date,'2026-11-08');
});
test('a past unresolved appointment never becomes the next future appointment',()=>{
 const result=employeeOverview([{id:1,date:'2023-01-01'},{id:2,date:'2026-11-03',time:'09:00'},{id:3,date:'2026-11-03',time:'08:00'}],null,new Date('2026-11-02T08:00:00Z'));
 assert.equal(result.next.item.id,3);assert.equal(employeeOverview([],null,new Date('2026-11-02T08:00:00Z')).next,null);
});
test('the employee day follows Paris rather than the device UTC date',()=>{
 const result=employeeOverview([],null,new Date('2026-11-01T23:30:00Z'));assert.equal(result.today,'2026-11-02');assert.equal(result.tomorrow,'2026-11-03');
});
test('unknown durations are never presented as an invented end time',()=>{
 assert.equal(employeeTimeLabel({time:'08:30:00'}),'08:30');assert.equal(employeeTimeLabel({time:'08:30',duration_minutes:90}),'08:30 – 10:00');assert.equal(employeeTimeLabel({}),'Horaire à préciser');assert.equal(employeeTimeLabel({time:'28:00'}),'Horaire à préciser');
});

test('malformed dates cannot crash the employee dashboard or its chart',()=>{
 assert.deepEqual(employeeOccurrences([{id:1,scheduled_dates:['bad','2026-02-30','2026-11-02']},{id:2,date:'2026-99-99'}]).map(r=>r.date),['2026-11-02']);
});
