import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let source=await readFile(new URL('../src/services/personalRequestService.js',import.meta.url),'utf8');
source=source.replace("import { supabase } from '../lib/supabaseClient';",'').replace("import { useAuthStore } from '../store/authStore';",'').replace("from '../utils/requestAssistant'",`from '${new URL('../src/utils/requestAssistant.js',import.meta.url).href}'`);
async function fixture(){
 const mocks=`export const state={id:'me',org:'org',auth:'me',rows:[],fail:false,uploads:[]};const useAuthStore={getState:()=>({profile:{id:state.id,organization_id:state.org}})};
 class Query{constructor(table){this.table=table;this.filters=[]}select(){return this}eq(k,v){this.filters.push([k,v]);return this}order(){return this}limit(){return Promise.resolve({data:state.rows.filter(r=>r.table===this.table&&this.filters.every(([k,v])=>r[k]===v)),error:null})}insert(rows){this.values=rows;return this}async single(){if(this.table==='profiles')return{data:{id:state.auth,organization_id:'org',full_name:'Demo'}};if(state.fail)return{error:new Error('Enregistrement indisponible')};const row={...this.values[0],table:this.table};state.rows.push(row);return{data:row,error:null}}async maybeSingle(){return{data:state.rows.find(r=>r.table===this.table&&this.filters.every(([k,v])=>String(r[k])===String(v)))||null,error:null}}}
 const supabase={auth:{getUser:async()=>({data:{user:{id:state.auth}}})},from:t=>new Query(t),storage:{from:()=>({upload:async(path)=>{state.uploads.push(path);return{error:null}}})}};`;
 return import('data:text/javascript;base64,'+Buffer.from(mocks+source+`\n// ${Math.random()}`).toString('base64'));
}
const values={startDate:'2026-11-12',endDate:'2026-11-15',reason:'Motif personnel',user_id:'other',status:'approved'};
test('submitting a personal request forces the authenticated owner, organization and pending status',async()=>{
 const f=await fixture();await f.submitPersonalRequest('leave',values,{id:'8900101001001001',scope:{id:'me',org:'org'}});const row=f.state.rows[0];assert.equal(row.user_id,'me');assert.equal(row.organization_id,'org');assert.equal(row.status,'pending');assert.equal(row.type,undefined);assert.equal(row.days_count,undefined);
});
test('an exact retry returns the saved request without duplicating it or overwriting a new decision',async()=>{
 const f=await fixture(),command={id:'8900101001001001',scope:{id:'me',org:'org'}};await f.submitPersonalRequest('leave',values,command);f.state.rows[0].status='approved';const retry=await f.submitPersonalRequest('leave',values,command);assert.equal(f.state.rows.length,1);assert.equal(retry.status,'approved');await assert.rejects(()=>f.submitPersonalRequest('leave',{...values,reason:'Different'},command));
});
test('a foreign session or organization cannot submit under the old identity',async()=>{
 for(const change of [s=>s.id='other',s=>s.org='other',s=>s.auth='other']){const f=await fixture();change(f.state);await assert.rejects(()=>f.submitPersonalRequest('leave',values,{id:'8900101001001001',scope:{id:'me',org:'org'}}));assert.equal(f.state.rows.length,0);}
});
test('database failures are returned as failures and the same command remains retryable',async()=>{
 const f=await fixture(),command={id:'8900101001001001',scope:{id:'me',org:'org'}};f.state.fail=true;await assert.rejects(()=>f.submitPersonalRequest('leave',values,command),/indisponible/);assert.equal(f.state.rows.length,0);f.state.fail=false;await f.submitPersonalRequest('leave',values,command);assert.equal(f.state.rows.length,1);
});
