export function workflowQueue(items,{search='',order='priority',now=new Date()}={}){
 const terminal=item=>['completed','cancelled'].includes(item.status);
 const overdue=item=>!terminal(item)&&!!item.due_at&&Number.isFinite(Date.parse(item.due_at))&&new Date(item.due_at)<=now;
 const blocked=item=>!terminal(item)&&['waiting','procedure'].includes(item.status);
 const age=item=>Date.parse(item.last_activity_at) || 0;
 const normalize=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const terms=normalize(search).trim().split(/\s+/).filter(Boolean);
 const rows=items.filter(item=>terms.every(term=>normalize(`${item.title} ${item.reason || ''}`).includes(term))).map((item,index)=>({item,index}));
 rows.sort((a,b)=>order==='title'?String(a.item.title).localeCompare(String(b.item.title),'fr'):order==='recent'?age(b.item)-age(a.item):Number(overdue(b.item))-Number(overdue(a.item))||Number(blocked(b.item))-Number(blocked(a.item))||Number(!!b.item.legacy)-Number(!!a.item.legacy)||age(a.item)-age(b.item)||a.index-b.index);
 return {items:rows.map(row=>row.item),overdue:items.filter(overdue).length,blocked:items.filter(blocked).length,legacy:items.filter(item=>item.legacy).length};
}
