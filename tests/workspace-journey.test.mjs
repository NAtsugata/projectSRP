import test from 'node:test';
import assert from 'node:assert/strict';
import { statusPresentation,interventionStageStatus } from '../src/utils/statusPresentation.js';
import { interventionJourney } from '../src/utils/interventionJourney.js';
import { workflowQueue } from '../src/utils/workflowQueue.js';

test('terminal intervention statuses remain terminal even when an arrival is present',()=>{
 for(const status of ['Terminée','completed','Annulée','cancelled'])assert.equal(interventionStageStatus({status,report:{arrivalTime:'2026-11-02T08:00:00Z'}}),status);
 assert.equal(interventionStageStatus({status:'Planifiée',report:{arrivalTime:'2026-11-02T08:00:00Z'}}),'En cours');
 assert.equal(statusPresentation('Terminée').tone,statusPresentation('completed').tone);
 assert.equal(statusPresentation('unrecognized').tone,'neutral');
});
test('the next action follows saved evidence and never implies that work is automatically closed',()=>{
 const report={quick_checkpoints:[{done:false}]};
 assert.equal(interventionJourney(report,'Planifiée').next.tab,0);
 report.arrivalTime='2026-11-02T08:00:00Z';assert.equal(interventionJourney(report,'En cours').next.tab,1);
 report.files=[{type:'image/jpeg'},{type:'application/pdf'},'https://example.com/photo.png'];
 assert.equal(interventionJourney(report,'En cours').photos,2);assert.equal(interventionJourney(report,'En cours').next.tab,2);
 report.quick_checkpoints[0].done=true;assert.equal(interventionJourney(report,'En cours').next.tab,3);
 report.signature='signature';const result=interventionJourney(report,'En cours');assert.equal(result.completed,4);assert.equal(result.terminal,false);
 assert.equal(interventionJourney(report,'Terminée').terminal,true);
});
test('manager queue sorts overdue and blocked work without including completed items in urgent counts or mutating source',()=>{
 const rows=[{id:1,title:'Terminé',status:'completed',due_at:'2026-01-01'}, {id:2,title:'Pièce manquante',status:'waiting',due_at:'2026-11-10',reason:'Attente moteur'}, {id:3,title:'Contrôle',status:'in_progress',due_at:'2026-11-01'}, {id:4,title:'Ancien',status:'todo',legacy:true}];
 const result=workflowQueue(rows,{now:new Date('2026-11-02T12:00:00Z')});
 assert.equal(result.overdue,1);assert.equal(result.blocked,1);assert.equal(result.legacy,1);assert.deepEqual(result.items.slice(0,2).map(i=>i.id),[3,2]);assert.deepEqual(rows.map(i=>i.id),[1,2,3,4]);
 assert.deepEqual(workflowQueue(rows,{search:'attente moteur'}).items.map(i=>i.id),[2]);
});
