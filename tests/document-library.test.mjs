import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/utils/documentLibrary.js',import.meta.url),'utf8');
const {documentLibrary}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const profile={id:'one',organization_id:'a',is_admin:false};
const rows=[{id:1,organization_id:'a',user_id:'one',title:'Rapport été',category:'rapport',tags:['chantier'],file_size:100,created_at:'2026-11-01'}, {id:2,organization_id:'a',user_id:'two',title:'Facture',category:'facture',file_size:400,created_at:'2026-10-30'}, {id:3,organization_id:'b',user_id:'one',title:'Autre entité',file_size:900,created_at:'2026-11-02'}];
test('employee library and counters exclude other owners and entities, including after a role switch',()=>{
 const own=documentLibrary(rows,profile,{},new Date('2026-11-03'));
 assert.deepEqual(own.documents.map(row=>row.id),[1]);assert.equal(own.totalBytes,100);assert.equal(own.thisMonth,1);
 assert.equal(documentLibrary(rows,{...profile,is_admin:true}).total,2);
 assert.equal(documentLibrary(rows,null).total,0);
});
test('library filters accents, tags, category and admin owner, and sorts without mutating source',()=>{
 assert.equal(documentLibrary(rows,profile,{search:'ete'}).documents.length,1);
 assert.equal(documentLibrary(rows,profile,{search:'chantier'}).documents.length,1);
 assert.equal(documentLibrary(rows,profile,{category:'facture'}).documents.length,0);
 assert.deepEqual(documentLibrary(rows,{...profile,is_admin:true},{owner:'two'}).documents.map(row=>row.id),[2]);
 assert.deepEqual(documentLibrary(rows,{...profile,is_admin:true},{sort:'oldest'}).documents.map(row=>row.id),[2,1]);assert.equal(rows[0].id,1);
});
