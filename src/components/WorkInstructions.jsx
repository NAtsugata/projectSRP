import { useEffect,useRef,useState } from 'react';
import { requestOdoo } from '../services/odooService';
import './WorkInstructions.css';

const quantity=value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(value);

export default function WorkInstructions({interventionId,fallback,isAdmin=false}){
    const [orderReference,setOrderReference]=useState('');
    const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),alive=useRef(true);
    useEffect(()=>{alive.current=true;setBusy(true);setError('');let active=true;requestOdoo({action:'work_instructions',interventionId:Number(interventionId),...(orderReference?{orderReference}:{})})
        .then(result=>{if(active)setData(result);}).catch(e=>{if(active){setData(null);setError(e.message);}}).finally(()=>{if(active)setBusy(false);});
        return()=>{active=false;alive.current=false;};},[interventionId,orderReference]);
    return <section className="work-instructions" aria-labelledby="work-instructions-title">
        <header><div><small>DEVIS SYNCHRONISÉ</small><h2 id="work-instructions-title">Travaux à réaliser</h2></div>{busy&&<span>Actualisation…</span>}</header>
        {isAdmin&&data?.choices?.length>0&&<label>Devis validé à consulter<select disabled={busy} value={orderReference} onChange={e=>setOrderReference(e.target.value)}><option value="">Devis de l’intervention (automatique)</option>{data.choices.map(order=><option key={order.reference} value={order.reference}>{order.reference}{order.date?` · ${String(order.date).slice(0,10)}`:''}</option>)}</select><small>Les employés voient le devis rattaché ou, à défaut, le dernier devis validé du client.</small></label>}
        {error&&<p role="alert">Les désignations Odoo ne sont pas disponibles : {error}</p>}
        {!busy&&!error&&!data?.orders?.length&&<><p>Aucune désignation de devis trouvée automatiquement pour ce client.</p>{fallback&&<p><strong>Mission indiquée :</strong> {fallback}</p>}</>}
        {data?.orders?.map(order=><article key={order.reference}><div className="work-order-heading"><h3>{order.reference}</h3><span>{order.lines.length} prestation{order.lines.length>1?'s':''}</span></div><ol>{order.lines.slice(0,3).map((line,index)=><li key={`${order.reference}:${index}`}><span>{line.designation}</span><strong>{quantity(line.quantity)} {line.unit}</strong></li>)}</ol>{order.lines.length>3&&<details><summary>Voir {order.lines.length-3===1?'la prestation restante':`les ${order.lines.length-3} autres prestations`}</summary><ol start="4">{order.lines.slice(3).map((line,index)=><li key={`${order.reference}:more:${index}`}><span>{line.designation}</span><strong>{quantity(line.quantity)} {line.unit}</strong></li>)}</ol></details>}</article>)}
        {!!data?.orders?.length&&<p className="work-instructions-note">Informations techniques uniquement. Les tarifs, remises, taxes et totaux ne sont jamais transmis.</p>}
    </section>;
}
