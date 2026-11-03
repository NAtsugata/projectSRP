const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function documentLibrary(rows,profile,{search='',category='all',owner='all',sort='recent'}={},now=new Date()){
 const scoped=(Array.isArray(rows)?rows:[]).filter(doc=>profile?.id && profile?.organization_id && (!doc.organization_id || doc.organization_id===profile.organization_id) && (profile.is_admin===true || doc.user_id===profile.id));
 const counts={all:scoped.length};for(const doc of scoped)counts[doc.category || 'autre']=(counts[doc.category || 'autre'] || 0)+1;
 const query=normalize(search.trim());
 const documents=scoped.filter(doc=>(category==='all' || (doc.category || 'autre')===category) && (profile.is_admin!==true || owner==='all' || doc.user_id===owner) && (!query || normalize([doc.title,doc.description,...(doc.tags || [])].join(' ')).includes(query)));
 documents.sort((a,b)=>sort==='name'?String(a.title || '').localeCompare(String(b.title || ''),'fr'):((Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0))*(sort==='oldest'?-1:1));
 return {documents,counts,total:scoped.length,totalBytes:scoped.reduce((sum,doc)=>sum+(Number(doc.file_size)||0),0),thisMonth:scoped.filter(doc=>{const date=new Date(doc.created_at);return date.getMonth()===now.getMonth() && date.getFullYear()===now.getFullYear();}).length};
}
