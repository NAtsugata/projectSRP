import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('offline expense snapshots never cross account, entity or role boundaries',async()=>{
 const source=await readFile(new URL('../src/utils/offlineStorage.js',import.meta.url),'utf8');
 const start=source.indexOf('export const cacheExpenses ='),end=source.indexOf('/**',source.indexOf('export const getCachedExpenses ='));
 const body=source.slice(start,end);
 const module=await import('data:text/javascript;base64,'+Buffer.from(`const rows=new Map(),STORES={META:'meta'};const logger={log(){}};const saveToStore=async(s,row)=>rows.set(row.key,row);const getFromStore=async(s,key)=>rows.get(key);${body}`).toString('base64'));
 const a={id:'a',org:'one',admin:false},b={id:'b',org:'one',admin:false};
 await module.cacheExpenses([{id:1,user_id:'a',organization_id:'one'},{id:2,user_id:'b',organization_id:'one'},{id:3,user_id:'a',organization_id:'two'}],a);
 assert.deepEqual((await module.getCachedExpenses(a)).map(r=>r.id),[1]);
 for(const scope of [b,{...a,org:'two'},{...a,admin:true},undefined])assert.deepEqual(await module.getCachedExpenses(scope),[]);
 await module.cacheExpenses([],a);assert.deepEqual(await module.getCachedExpenses(a),[]);
});

test('all expense mutation failures reject instead of triggering success handlers',async()=>{
 let source=await readFile(new URL('../src/hooks/useExpenses.js',import.meta.url),'utf8');
 source=source.replace(/^import .*;\r?\n/gm,'');
 const prefix=`export const mutations=[];const profile={id:'me',organization_id:'org',is_admin:true};const useAuthStore=()=>({user:{id:'me'},profile});useAuthStore.getState=()=>({profile});const useQueryClient=()=>({invalidateQueries(){},setQueriesData(){throw new Error('Unexpected success')}});const useQuery=()=>({});const useMutation=opts=>{mutations.push(opts);return{mutateAsync:opts.mutationFn}};const logger={log(){},warn(){}};const getConnectionState=()=>true;const navigator={onLine:true};const expenseService=new Proxy({},{get:()=>async()=>({data:null,error:new Error('Database rejected write')})});`;
 const module=await import('data:text/javascript;base64,'+Buffer.from(prefix+source).toString('base64'));module.useExpenses();
 assert.equal(module.mutations.length,6);
 for(const mutation of module.mutations)await assert.rejects(()=>mutation.mutationFn({id:'x',updates:{},comment:''}),/Database rejected write/);
});

test('offline writes are never replayed under another account or from legacy unscoped entries',async()=>{
 let source=await readFile(new URL('../src/utils/syncService.js',import.meta.url),'utf8');source=source.replace(/import[\s\S]*?from ['"][^'"]+['"];\r?\n/g,'');
 const prefix=`export const state={profile:{id:'a',organization_id:'org'},operations:[{id:1,type:'CREATE_EXPENSE',payload:{}}],writes:[]};const useAuthStore={getState:()=>state};const supabase={auth:{getUser:async()=>({data:{user:{id:state.profile.id}}})}};const expenseService={createExpense:async p=>{state.writes.push(p);return{data:{}}}};const logger={log(){},warn(){},error(){}};const navigator={onLine:true};const addToSyncQueue=async o=>state.operations.push({...o,id:state.operations.length+1});const getPendingSyncOperations=async()=>[...state.operations];const removeSyncOperation=async id=>{state.operations=state.operations.filter(o=>o.id!==id)};const saveToStore=async()=>{};const STORES_ENUM={SYNC_QUEUE:'queue'};`;
 const module=await import('data:text/javascript;base64,'+Buffer.from(prefix+source).toString('base64'));
 await module.queueOperation('CREATE_EXPENSE',{description:'draft a'});
 module.state.profile={id:'b',organization_id:'org'};await module.syncPendingOperations();assert.equal(module.state.writes.length,0);
 module.state.profile={id:'a',organization_id:'elsewhere'};await module.syncPendingOperations();assert.equal(module.state.writes.length,0);
 module.state.profile={id:'a',organization_id:'org'};await module.syncPendingOperations();assert.equal(module.state.writes.length,1);assert.equal(module.state.operations.length,1);assert.equal(module.state.operations[0].scope,undefined);
});
