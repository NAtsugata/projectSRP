import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { validatePersonalRequest } from '../utils/requestAssistant';

export function personalRequestId(kind) {
    if(kind==='expense')return crypto.randomUUID();
    const n=crypto.getRandomValues(new Uint32Array(2));
    return String((n[0]&0x1fffff)*4294967296+n[1] || 1);
}
export function requestScope(){const p=useAuthStore.getState().profile;if(!p?.id || !p.organization_id)throw new Error('Connectez-vous au portail.');return{id:p.id,org:p.organization_id};}
function assertScope(scope){const current=requestScope();if(current.id!==scope.id || current.org!==scope.org)throw new Error('La session a changé. Rouvrez votre demande.');}
async function verify(scope){assertScope(scope);const {data,error}=await supabase.auth.getUser();if(error || data?.user?.id!==scope.id)throw new Error('Reconnectez-vous avant d’envoyer la demande.');const profile=await supabase.from('profiles').select('id,organization_id,full_name').eq('id',data.user.id).single();if(profile.error || profile.data?.organization_id!==scope.org)throw new Error('Entité non autorisée.');assertScope(scope);return profile.data;}
const columns={leave:'id,start_date,end_date,reason,status,rejection_reason',expense:'id,date,category,amount,description,status,admin_comment,is_paid'};
const table=kind=>kind==='leave'?'leave_requests':kind==='expense'?'expenses':null;
async function existing(kind,id,scope){const result=await supabase.from(table(kind)).select(columns[kind]).eq('organization_id',scope.org).eq('user_id',scope.id).eq('id',id).maybeSingle();if(result.error)throw result.error;assertScope(scope);return result.data;}
function same(kind,row,values){return kind==='leave'?row.start_date===values.startDate && row.end_date===values.endDate && (row.reason || '')===values.reason.trim():row.date===values.date && row.category===values.category && Number(row.amount)===Number(String(values.amount).replace(',','.')) && row.description===values.description.trim();}
export async function listPersonalRequests(kind,scope=requestScope()) {
    if(!table(kind))throw new Error('Type de demande invalide.');
    await verify(scope);const result=await supabase.from(table(kind)).select(columns[kind]).eq('organization_id',scope.org).eq('user_id',scope.id).order(kind==='leave'?'start_date':'date',{ascending:false}).limit(50);
    if(result.error)throw result.error;assertScope(scope);return result.data || [];
}
export async function submitPersonalRequest(kind,values,{id,scope,files=[]}) {
    const invalid=validatePersonalRequest(kind,values);if(invalid)throw new Error(invalid);
    if(!id || (kind==='leave'?!/^[1-9][0-9]{0,15}$/.test(id):!/^[a-f0-9-]{36}$/i.test(id)))throw new Error('Identifiant de demande invalide.');
    if(files.length>3 || files.some(f=>!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type) || f.size>5*1024*1024 || !f.size))throw new Error('Ajoutez au maximum 3 justificatifs JPEG, PNG, WebP ou PDF de 5 Mo chacun.');
    const profile=await verify(scope),saved=await existing(kind,id,scope);
    if(saved){if(!same(kind,saved,values))throw new Error('Cette demande a déjà été enregistrée avec un autre contenu.');return saved;}
    let row={id,organization_id:scope.org,user_id:scope.id,status:'pending'};
    if(kind==='leave')row={...row,user_name:profile.full_name,start_date:values.startDate,end_date:values.endDate,reason:values.reason.trim()};
    else {
        const receipts=[];
        for(const file of files){
            const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
            assertScope(scope);const name=file.name.replace(/[^\p{L}\p{N}._ -]/gu,'_').slice(-100),path=`${scope.org}/employees/${scope.id}/expenses/${id}/${hash}-${name}`;
            const upload=await supabase.storage.from('expense-receipts').upload(path,file,{upsert:false,contentType:file.type});
            if(upload.error && String(upload.error.statusCode)!=='409')throw upload.error;
            assertScope(scope);receipts.push({bucket:'expense-receipts',path,name,size:file.size,mime:file.type});
        }
        row={...row,date:values.date,category:values.category,amount:Number(String(values.amount).replace(',','.')),description:values.description.trim(),receipts};
    }
    assertScope(scope);const result=await supabase.from(table(kind)).insert([row]).select(columns[kind]).single();
    if(result.error){if(result.error.code==='23505'){const duplicate=await existing(kind,id,scope);if(duplicate && same(kind,duplicate,values))return duplicate;}throw result.error;}
    assertScope(scope);return result.data;
}
