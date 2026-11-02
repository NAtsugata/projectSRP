import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRequestCommand,requestDates,validatePersonalRequest,assistantDraft,readAssistantDraft} from '../src/utils/requestAssistant.js';
const now=new Date('2026-11-02T12:00:00Z');
test('French leave requests recognize shared month, shared slash date and explicit year',()=>{
 for(const text of ['Congés du 12 au 15 novembre','Je veux poser du 12 au 15/11','Congé du 12/11/2026 au 15/11/2026']){
  const p=parseRequestCommand(text,'',now);assert.equal(p.kind,'leave');assert.equal(p.values.startDate,'2026-11-12');assert.equal(p.values.endDate,'2026-11-15');
 }
});
test('expense amount and category are extracted without mistaking decimal euros for dates',()=>{
 const p=parseRequestCommand('Repas professionnel hier de 18,50 euros','',now);assert.equal(p.kind,'expense');assert.equal(p.values.amount,'18.50');assert.equal(p.values.date,'2026-11-01');assert.equal(p.values.category,'meals');
 const q=parseRequestCommand('Note de frais de 1 234,56 euros le 12/10/2026','',now);assert.equal(q.values.amount,'1234.56');assert.equal(q.values.date,'2026-10-12');
});
test('multiple amounts, missing dates, invalid dates and durations remain explicit manual fields',()=>{
 assert.equal(parseRequestCommand('repas 18 euros et 5 euros','',now).values.amount,'');
 assert.equal(parseRequestCommand('repas 18 euros','',now).values.date,'');
 assert.equal(parseRequestCommand('congé le 31/02/2026','',now).values.startDate,'');
 assert.equal(parseRequestCommand('congé 3 jours à partir de demain','',now).values.endDate,'');
 assert.deepEqual(requestDates('après-demain',now).dates,['2026-11-04']);
});
test('approval, deletion, negation and mixed intentions never become automatic personal requests',()=>{
 for(const text of ['Approuve mon congé demain','Supprimer ma dépense','Je ne veux pas de congé demain','Congé et remboursement demain'])assert.equal(parseRequestCommand(text,'',now).kind,'');
});
test('validation checks exact dates and positive euro amounts, without choosing compensation rules',()=>{
 assert.equal(validatePersonalRequest('leave',{startDate:'2026-11-12',endDate:'2026-11-15',reason:'RTT à vérifier'}),'');
 assert.ok(validatePersonalRequest('leave',{startDate:'2026-11-15',endDate:'2026-11-12',reason:'Motif'}));
 for(const amount of ['-1','0','18.555','1e3'])assert.ok(validatePersonalRequest('expense',{date:'2026-11-01',category:'meals',amount,description:'Repas'}));
});
test('draft transfer is bound to the exact account and entity, expires and strips extra fields',()=>{
 const profile={id:'me',organization_id:'org'},time=now.getTime(),draft=assistantDraft('expense',{date:'2026-11-01',amount:'18.50',category:'meals',description:'Repas',user_id:'someone',status:'approved'},profile,time);
 assert.equal(draft.values.user_id,undefined);assert.equal(draft.values.status,undefined);assert.ok(readAssistantDraft(draft,profile,time));
 assert.equal(readAssistantDraft(draft,{id:'other',organization_id:'org'},time),null);assert.equal(readAssistantDraft(draft,{id:'me',organization_id:'other'},time),null);assert.equal(readAssistantDraft(draft,profile,time+31*60*1000),null);assert.equal(readAssistantDraft({...draft,expires:undefined},profile,time),null);
});
