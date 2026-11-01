import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretManagerReply,validateWorkflowReply,terminalWorkflowStatus,workflowSourceUrl } from '../src/utils/businessWorkflow.js';
const now=new Date('2026-11-01T12:00:00Z');
test('waiting for a part Friday proposes waiting and a dated next action',()=>{
 assert.deepEqual(interpretManagerReply('On attend la pièce vendredi',now),{status:'waiting',nextReview:'2026-11-06',needsClarification:false});
});
test('administrative procedure remains distinct from completion and payment',()=>{
 assert.equal(interpretManagerReply('Le dossier est chez l’assurance',now).status,'procedure');
 assert.equal(interpretManagerReply('Facture payée',now).status,'');
 assert.equal(interpretManagerReply('Intervention terminée',now).status,'completed');
});
test('negation and conflicting statuses require a manager choice',()=>{
 for(const text of ['Pas terminé','Ne pas annuler','En attente de confirmation d’annulation','Assurance : travaux terminés']){
  assert.equal(interpretManagerReply(text,now).status,'',text);
  assert.equal(interpretManagerReply(text,now).needsClarification,true,text);
 }
});
test('terminal statuses require reason and confirmation',()=>{
 for(const status of ['completed','cancelled']){
  assert.ok(validateWorkflowReply({status,reason:'Retour gérant',confirmed:false},now));
  assert.equal(validateWorkflowReply({status,reason:'Retour gérant',confirmed:true},now),'');
 }
 assert.ok(validateWorkflowReply({status:'completed',reason:'',confirmed:true},now));
 assert.equal(terminalWorkflowStatus('waiting'),false);
});
test('waiting and procedures require a valid future review date',()=>{
 for(const status of ['waiting','procedure']){
  for(const nextReview of ['','2026-11-01','2026-02-30','2028-01-01'])assert.ok(validateWorkflowReply({status,reason:'Motif de suivi',nextReview},now));
  assert.equal(validateWorkflowReply({status,reason:'Motif de suivi',nextReview:'2026-11-06'},now),'');
 }
});
test('source links encode identifiers and never navigate to arbitrary hosts',()=>{
 assert.equal(workflowSourceUrl({source_type:'intervention',source_key:12}),'/planning/12');
 assert.equal(workflowSourceUrl({source_type:'chantier',source_key:'a/b'}),'/chantiers/a%2Fb');
 assert.equal(workflowSourceUrl({source_type:'odoo_quote',source_key:'https://other.example'}),'/odoo-quotes');
 assert.equal(workflowSourceUrl({source_type:'odoo_quote',source_key:'12',title:'S001 · Client exemple'}),'/odoo-quotes?search=S001');
});
