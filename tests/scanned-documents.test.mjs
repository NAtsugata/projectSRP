import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../src/services/scannedDocumentsService.js',import.meta.url),'utf8');
async function fixture() {
    const imports=`export const state={org:'org-a',profileId:'user-a',authId:'user-a',uploads:[],rows:[],removed:[],failure:null,changeScope:false};
    const getOrgId=()=>state.org,useAuthStore={getState:()=>({profile:{id:state.profileId}})},sanitizeFilename=value=>value,logger={log(){},warn(){},error(){}};
    const storageService={uploadFile:async(file,path)=>{state.uploads.push({file,path});if(state.changeScope)state.org='org-b';return{publicURL:'signed-demo',filePath:path,error:null}},deleteFile:async path=>{state.removed.push(path);return{error:null}}};
    const supabase={auth:{getUser:async()=>({data:{user:{id:state.authId}}})},from:()=>({insert:rows=>({select:()=>({single:async()=>{if(state.failure)return{data:null,error:state.failure};state.rows.push(...rows);return{data:{id:'saved',...rows[0]},error:null}}})})})};`;
    return import(`data:text/javascript;base64,${Buffer.from(imports+source.replace(/^import .*;\r?\n/gm,'')+`\n// ${Math.random()}`).toString('base64')}`);
}
const pages=()=>[{blob:new Blob(['%PDF-test'],{type:'application/pdf'}),pageCount:2}];
test('one multi-page PDF keeps its MIME type, extension, organization and page count',async()=>{
    const {default:service,state}=await fixture();
    const result=await service.saveDocuments(pages(),{user_id:'user-a',title:'Test',category:'rapport'});
    assert.equal(result.error,null);assert.equal(state.rows.length,1);assert.equal(state.rows[0].organization_id,'org-a');assert.equal(state.rows[0].user_id,'user-a');assert.equal(state.rows[0].file_type,'application/pdf');assert.match(state.rows[0].file_name,/\.pdf$/);assert.equal(state.rows[0].metadata.pageCount,2);assert.match(state.uploads[0].path,/^org-a\/employees\/user-a\/scans\//);
});
test('a failed metadata save reports failure and cleans up only the new uploaded PDF',async()=>{
    const {default:service,state}=await fixture();state.failure=new Error('Quota exhausted');
    const result=await service.saveDocuments(pages(),{user_id:'user-a'});
    assert.equal(result.error.message,'Quota exhausted');assert.equal(state.rows.length,0);assert.deepEqual(state.removed,[state.uploads[0].path]);
});
test('another owner or an organization change cannot write a scan into the wrong entity',async()=>{
    const {default:service,state}=await fixture();
    assert.ok((await service.saveDocuments(pages(),{user_id:'someone-else'})).error);assert.equal(state.uploads.length,0);
    state.changeScope=true;assert.ok((await service.saveDocuments(pages(),{user_id:'user-a'})).error);assert.equal(state.rows.length,0);assert.equal(state.removed.length,0);
});
